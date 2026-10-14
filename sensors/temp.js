import Gio from "gi://Gio";

// Comprehensive map of hwmon chip names to categories.
const SENSOR_MAP = {
  // CPUs
  coretemp: "CPU",
  k10temp: "CPU",
  zentemp: "CPU",
  // GPUs
  nvidia: "GPU",
  amdgpu: "GPU",
  radeon: "GPU",
  // Storage
  nvme: "Drive",
  drivetemp: "Drive",
  // Motherboards / EC
  nct6775: "Board",
  nct6779: "Board",
  it87: "Board",
  thinkpad: "Board",
  dell_smm: "Board",
  acpitz: "Board",
};

export class TempSensor {
  MIN_TEMP = 35; // idle
  MAX_TEMP = 90; // throttling
  _sensors = [];
  _discovered = false;
  _lastReadings = new Map();
  _peakTemp = 0;

  // Returns the "Hottest Critical Sensor" percentage.
  async getValue() {
    await this._ensureDiscovered();
    const readings = await Promise.all(
      this._sensors.map((s) => this._readSensor(s)),
    );
    let currentMax = 0;

    for (const reading of readings) {
      if (!reading) continue;
      this._lastReadings.set(reading.label, {
        value: reading.value,
        cat: reading.category,
      });
      // Only CPU and GPU drive the main "Health" percentage
      if (reading.category === "CPU" || reading.category === "GPU") {
        if (reading.value > currentMax) currentMax = reading.value;
      }
    }

    this._peakTemp = currentMax;
    if (currentMax === 0) return 0;
    // Normalize percentage based on the hottest critical component
    const pct =
      ((currentMax - this.MIN_TEMP) / (this.MAX_TEMP - this.MIN_TEMP)) * 100;
    return Math.max(0, Math.min(100, pct));
  }

  // Returns a categorized list of all sensors.
  async getDetails() {
    const details = [
      { label: "System Peak", value: `${Math.round(this._peakTemp)} °C` },
      { label: "Condition", value: this.getCondition() },
    ];
    // Sort: CPU first, then GPU, then Drive, then Board. Highest temps first within groups.
    const categories = ["CPU", "GPU", "Drive", "Board"];
    for (const cat of categories) {
      const items = Array.from(this._lastReadings.entries())
        .filter(([_, data]) => data.cat === cat)
        .sort((a, b) => b[1].value - a[1].value);
      for (const [label, data] of items) {
        details.push({
          label: `[${cat}] ${label}`,
          value: `${Math.round(data.value)} °C`,
        });
      }
    }
    return details;
  }

  // --- Discovery Logic ---
  async _ensureDiscovered() {
    if (this._discovered) return;
    this._discovered = true;
    await this._discoverHwmon();
    if (this._sensors.length === 0) await this._discoverThermalZones();
  }

  async _discoverHwmon() {
    const BASE = "/sys/class/hwmon";
    const chipDirs = await this._listDir(BASE);
    if (!chipDirs) return;
    await Promise.all(
      chipDirs
        .filter((n) => n.startsWith("hwmon"))
        .map(async (dir) => {
          const path = `${BASE}/${dir}`;
          const chipName = await this._readTextFile(`${path}/name`);
          if (!chipName) return;
          const baseName = chipName.split(".")[0];
          const category = SENSOR_MAP[baseName] || "Board";
          const files = await this._listDir(path);
          if (!files) return;
          const inputs = files.filter((f) => /^temp\d+_input$/.test(f));
          await Promise.all(
            inputs.map(async (file) => {
              const idx = file.replace("temp", "").replace("_input", "");
              const rawLabel = await this._readTextFile(
                `${path}/temp${idx}_label`,
              );
              this._sensors.push({
                path: `${path}/${file}`,
                label: rawLabel
                  ? `${chipName} - ${rawLabel}`
                  : `${chipName} T${idx}`,
                category,
              });
            }),
          );
        }),
    );
  }

  async _discoverThermalZones() {
    const BASE = "/sys/class/thermal";
    const entries = await this._listDir(BASE);
    if (!entries) return;
    await Promise.all(
      entries
        .filter((n) => n.startsWith("thermal_zone"))
        .map(async (zone) => {
          const type = await this._readTextFile(`${BASE}/${zone}/type`);
          this._sensors.push({
            path: `${BASE}/${zone}/temp`,
            label: type || zone,
            category: "Board",
          });
        }),
    );
  }

  // --- Helper Methods ---
  async _readSensor(sensor) {
    const raw = await this._readTextFile(sensor.path);
    if (!raw) return null;
    const val = parseInt(raw, 10) / 1000;
    if (isNaN(val) || val <= 5 || val > 120) return null;
    return { label: sensor.label, value: val, category: sensor.category };
  }

  async _readTextFile(path) {
    try {
      const file = Gio.File.new_for_path(path);
      const [contents] = await file.load_contents_async(null);
      return new TextDecoder().decode(contents).trim();
    } catch {
      return null;
    }
  }

  async _listDir(dirPath) {
    try {
      const dir = Gio.File.new_for_path(dirPath);
      const enumerator = await new Promise((res, rej) => {
        dir.enumerate_children_async("standard::name", 0, 0, null, (_, r) => {
          try {
            res(dir.enumerate_children_finish(r));
          } catch (e) {
            rej(e);
          }
        });
      });
      const names = [];
      while (true) {
        const batch = await new Promise((res, rej) => {
          enumerator.next_files_async(64, 0, null, (_, r) => {
            try {
              res(enumerator.next_files_finish(r));
            } catch (e) {
              rej(e);
            }
          });
        });
        if (batch.length === 0) break;
        batch.forEach((info) => names.push(info.get_name()));
      }
      return names;
    } catch {
      return null;
    }
  }

  // Returns a human-readable string describing the thermal state
  getCondition() {
    const temp = this._peakTemp;
    if (temp === 0) return "Unknown";
    if (temp < 40) return "Very Idle";
    if (temp < 50) return "Idle";
    if (temp < 70) return "Normal";
    if (temp < 85) return "Heating";
    return "Throttling";
  }
}
