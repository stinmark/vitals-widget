import Gio from "gi://Gio";

Gio._promisify(
  Gio.File.prototype,
  "load_contents_async",
  "load_contents_finish",
);

export class CPUSensor {
  _lastTotal = 0;
  _lastIdle = 0;
  _currentUsage = 0;
  _cores = 0;
  _modelName = "Unknown";

  constructor() {
    this._updateStats();
    this._getCPUInfo();
  }

  async getValue() {
    this._currentUsage = await this._updateStats();
    return this._currentUsage;
  }

  // Reads a single integer value from a sysfs path
  async _readFreqFile(path) {
    try {
      const file = Gio.File.new_for_path(path);
      const [contents] = await file.load_contents_async(null);
      if (!contents) return "N/A";
      const freqKHz = parseInt(new TextDecoder().decode(contents).trim());
      if (isNaN(freqKHz)) return "N/A";
      if (freqKHz >= 1000000) {
        return `${(freqKHz / 1000000).toFixed(2)} GHz`;
      }
      return `${Math.round(freqKHz / 1000)} MHz`;
    } catch (e) {
      return "N/A";
    }
  }

  async getDetails() {
    const details = [
      { label: "Usage", value: `${Math.round(this._currentUsage)}%` },
      { label: "Model", value: this._modelName },
      { label: "Cores", value: this._cores.toString() },
    ];

    // Fetch Frequency Details by averaging all cores
    let totalFreqKHz = 0;
    let validCores = 0;
    for (let i = 0; i < this._cores; i++) {
      const path = `/sys/devices/system/cpu/cpu${i}/cpufreq/scaling_cur_freq`;
      try {
        const file = Gio.File.new_for_path(path);
        const [contents] = await file.load_contents_async(null);
        if (contents) {
          const freq = parseInt(new TextDecoder().decode(contents).trim());
          if (!isNaN(freq)) {
            totalFreqKHz += freq;
            validCores++;
          }
        }
      } catch (e) {
        // Skip core if path doesn't exist
      }
    }

    const avgFreqKHz = validCores > 0 ? totalFreqKHz / validCores : 0;
    let currentFreqStr = "N/A";
    if (avgFreqKHz >= 1000000) {
      currentFreqStr = `${(avgFreqKHz / 1000000).toFixed(2)} GHz`;
    } else if (avgFreqKHz > 0) {
      currentFreqStr = `${Math.round(avgFreqKHz / 1000)} MHz`;
    }

    // Use cpu0 just for Min/Max labels (as they are usually uniform)
    const basePath = "/sys/devices/system/cpu/cpu0/cpufreq";
    const minFreq = await this._readFreqFile(`${basePath}/scaling_min_freq`);
    const maxFreq = await this._readFreqFile(`${basePath}/scaling_max_freq`);

    details.push(
      { label: "Frequency", value: currentFreqStr },
      { label: "Min Freq", value: minFreq },
      { label: "Max Freq", value: maxFreq },
    );
    return details;
  }

  async _getCPUInfo() {
    try {
      const file = Gio.File.new_for_path("/proc/cpuinfo");
      const [contents] = await file.load_contents_async(null);
      if (!contents) return;
      const data = new TextDecoder().decode(contents);
      const lines = data.split("\n");
      let coreCount = 0;

      for (const line of lines) {
        if (line.startsWith("model name")) {
          const match = line.match(/:\s*(.+)/);
          if (match && this._modelName === "Unknown") {
            this._modelName = match[1].trim();
          }
        } else if (line.startsWith("processor")) {
          coreCount++;
        }
      }
      this._cores = coreCount;
    } catch (e) {
      // Ignore errors
    }
  }

  async _updateStats() {
    try {
      const file = Gio.File.new_for_path("/proc/stat");
      const [contents] = await file.load_contents_async(null);

      if (!contents) return 0;
      const data = new TextDecoder().decode(contents);
      const lines = data.split("\n");
      const cpuLine = lines[0];

      if (!cpuLine.startsWith("cpu ")) return 0;
      const times = cpuLine
        .split(/\s+/)
        .slice(1)
        .map((x) => parseInt(x))
        .filter((x) => !isNaN(x));

      if (times.length < 4) return 0;
      const idle = times[3];
      const total = times.reduce((acc, val) => acc + val, 0);
      const totalDelta = total - this._lastTotal;
      const idleDelta = idle - this._lastIdle;
      this._lastTotal = total;
      this._lastIdle = idle;

      if (totalDelta === 0) return 0;
      return (1 - idleDelta / totalDelta) * 100;
    } catch (e) {
      return 0;
    }
  }
}
