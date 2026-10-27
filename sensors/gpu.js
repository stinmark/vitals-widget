import GLib from "gi://GLib";
import Gio from "gi://Gio";

export class GPUSensor {
  _gpuType = "none";
  _gpuPaths = [];
  _nvidiaSmiPath = "";
  _errorCount = 0;
  _maxErrors = 5;
  _disabled = false;
  _currentUsage = 0;
  _gpuCount = 0;

  constructor() {
    this._detectGPUs();
  }

  _detectGPUs() {
    // 1. Check for NVIDIA
    const nvidiaPath = GLib.find_program_in_path("nvidia-smi");
    if (nvidiaPath) {
      this._gpuType = "nvidia";
      this._nvidiaSmiPath = nvidiaPath;
      this._gpuCount = 1;
      return;
    }

    // 2. Check for AMD and intel via sysfs (scanning all cards)
    for (let i = 0; i < 10; i++) {
      const baseDir = `/sys/class/drm/card${i}/device`;
      // Check for AMD
      if (
        Gio.File.new_for_path(`${baseDir}/gpu_busy_percent`).query_exists(null)
      ) {
        this._gpuPaths.push(`${baseDir}/gpu_busy_percent`);
        this._gpuType = "amd_sysfs";
      }
      // Check for Intel (i915/xe drivers often expose 'busy' info differently)
      else if (
        Gio.File.new_for_path(
          `${baseDir}/gt/gt0/rps_act_freq_mhz`,
        ).query_exists(null)
      ) {
        this._gpuPaths.push(`${baseDir}/gt/gt0/rps_act_freq_mhz`);

        if (this._gpuType === "none") {
          this._gpuType = "intel";
        }
      }
    }

    if (this._gpuPaths.length > 0) {
      //this._gpuType = "amd_sysfs";
      this._gpuCount = this._gpuPaths.length;
      return;
    }

    this._gpuType = "none";
  }

  async getValue() {
    if (this._disabled || this._gpuType === "none") return 0;

    try {
      let usages = [];
      switch (this._gpuType) {
        case "nvidia":
          const proc = Gio.Subprocess.new(
            [
              this._nvidiaSmiPath,
              "--query-gpu=utilization.gpu",
              "--format=csv,noheader,nounits",
            ],
            Gio.SubprocessFlags.STDOUT_PIPE,
          );
          const [success, stdout] = proc.communicate_utf8(null, null);
          usages =
            stdout
              ?.trim()
              .split("\n")
              .map((val) => parseInt(val)) || [];
          break;
        case "intel":
        case "amd_sysfs":
          for (const path of this._gpuPaths) {
            const usage = await this._readSysfsUsage(path);
            usages.push(usage);
          }

          break;
        case "amd_radeontop":
          return await this._getAmdRadeontopUsage();
      }

      if (usages.length === 0) return 0;
      const sum = usages.reduce((a, b) => a + b, 0);
      this._currentUsage = Math.round(sum / usages.length);
      this._gpuCount = usages.length;
      this._errorCount = 0; // Reset error count on success
      return this._currentUsage;
    } catch (e) {
      this._handleError(e);
      return 0;
    }
  }

  async getDetails() {
    const details = [
      { label: "Usage", value: `${Math.round(this._currentUsage)}%` },
      {
        label: "Type",
        value:
          this._gpuType === "none"
            ? "Not detected"
            : this._gpuType.toUpperCase().replace("_", " "),
      },
    ];

    if (this._gpuType !== "none") {
      details.push({ label: "GPU Count", value: this._gpuCount.toString() });
      // Get detailed info based on GPU type
      try {
        switch (this._gpuType) {
          case "nvidia":
            const proc = Gio.Subprocess.new(
              [
                this._nvidiaSmiPath,
                "--query-gpu=name,temperature.gpu,memory.used,memory.total",
                "--format=csv,noheader,nounits",
              ],
              Gio.SubprocessFlags.STDOUT_PIPE,
            );

            const [success, stdout] = proc.communicate_utf8(null, null);
            if (stdout) {
              const lines = stdout.trim().split("\n");
              lines.forEach((line, idx) => {
                const [name, temp, memUsed, memTotal] = line.split(", ");
                if (lines.length > 1) {
                  details.push({ label: `GPU ${idx}`, value: name });
                } else {
                  details.push({ label: "Name", value: name });
                }

                if (temp)
                  details.push({
                    label: `Temperature ${idx}`,
                    value: `${temp}°C`,
                  });
                if (memUsed && memTotal) {
                  details.push({
                    label: `Memory ${idx}`,
                    value: `${memUsed}MB / ${memTotal}MB`,
                  });
                }
              });
            }

            break;
          case "intel":
          case "amd_sysfs": {
            for (let i = 0; i < this._gpuPaths.length; i++) {
              const path = this._gpuPaths[i];

              // Get the base device directory
              const deviceDir = path.substring(0, path.lastIndexOf("/"));
              const baseDir = deviceDir.includes("/gt/gt0")
                ? deviceDir.replace("/gt/gt0", "")
                : deviceDir;

              // 1. Vendor/Model Identification
              const vendorId = await this._readSysfsValue(`${baseDir}/vendor`);
              const vendorName = vendorId.includes("0x8086")
                ? "Intel"
                : vendorId.includes("0x1002")
                  ? "AMD"
                  : vendorId;
              details.push({ label: `Card ${i} Vendor`, value: vendorName });

              // 2. Specific metrics based on type
              switch (this._gpuType) {
                case "amd_sysfs":
                  const vramUsed = await this._readSysfsValue(
                    `${baseDir}/mem_info_vram_used`,
                  );
                  const vramTotal = await this._readSysfsValue(
                    `${baseDir}/mem_info_vram_total`,
                  );
                  if (vramTotal !== "0") {
                    const usedGB = (parseInt(vramUsed) / 1024 ** 3).toFixed(2);
                    const totalGB = (parseInt(vramTotal) / 1024 ** 3).toFixed(
                      2,
                    );
                    details.push({
                      label: `VRAM ${i}`,
                      value: `${usedGB} / ${totalGB} GB`,
                    });
                  }

                  break;
                case "intel":
                  const freq = await this._readSysfsValue(
                    `${baseDir}/gt/gt0/rps_act_freq_mhz`,
                  );
                  details.push({ label: `Clock ${i}`, value: `${freq} MHz` });
                  break;
              }
            }

            break;
          }
          case "amd_radeontop":
            details.push({ label: "Info", value: "Using radeontop utility" });
            break;
        }
      } catch (e) {
        // Ignore errors in detailed info
      }
    }
    return details;
  }
  async _readSysfsUsage(path) {
    try {
      const file = Gio.File.new_for_path(path);
      const [contents] = await file.load_contents_async(null);
      const data = new TextDecoder().decode(contents);
      return parseInt(data.trim()) || 0;
    } catch {
      return 0;
    }
  }

  _handleError(e) {
    this._errorCount++;
    if (this._errorCount >= this._maxErrors) this._disabled = true;
  }

  // helper to read text from sysfs files
  async _readSysfsValue(path) {
    try {
      const file = Gio.File.new_for_path(path);
      const [contents] = await file.load_contents_async(null);
      return new TextDecoder().decode(contents).trim();
    } catch {
      return "0";
    }
  }
}
