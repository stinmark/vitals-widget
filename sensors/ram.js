import Gio from "gi://Gio";

export class RAMSensor {
  _memTotal = 0;
  _memAvailable = 0;
  _memUsed = 0;
  _currentUsage = 0;

  async getValue() {
    try {
      const file = Gio.File.new_for_path("/proc/meminfo");
      const [contents] = await file.load_contents_async(null);

      if (!contents) return 0;
      const data = new TextDecoder().decode(contents);
      const lines = data.split("\n");
      this._memTotal = 0;
      this._memAvailable = 0;

      for (const line of lines) {
        if (line.startsWith("MemTotal:"))
          this._memTotal = this._parseMemValue(line);
        else if (line.startsWith("MemAvailable:"))
          this._memAvailable = this._parseMemValue(line);
        if (this._memTotal > 0 && this._memAvailable > 0) break;
      }

      this._memUsed = this._memTotal - this._memAvailable;
      this._currentUsage =
        this._memTotal === 0
          ? 0
          : Math.max(0, Math.min(100, (this._memUsed / this._memTotal) * 100));
      return this._currentUsage;
    } catch (e) {
      return 0;
    }
  }

  async getDetails() {
    const formatBytes = (kb) => {
      const gb = kb / (1024 * 1024);
      return gb >= 1 ? `${gb.toFixed(2)} GB` : `${(kb / 1024).toFixed(2)} MB`;
    };

    const details = [
      { label: "Usage", value: `${Math.round(this._currentUsage)}%` },
      { label: "Total", value: formatBytes(this._memTotal) },
      { label: "Used", value: formatBytes(this._memUsed) },
      { label: "Available", value: formatBytes(this._memAvailable) },
    ];

    // Get additional memory info
    try {
      const file = Gio.File.new_for_path("/proc/meminfo");
      const [contents] = await file.load_contents_async(null);

      if (contents) {
        const data = new TextDecoder().decode(contents);
        const lines = data.split("\n");
        let memFree = 0,
          buffers = 0,
          cached = 0,
          swapTotal = 0,
          swapFree = 0;
        for (const line of lines) {
          if (line.startsWith("MemFree:")) memFree = this._parseMemValue(line);
          else if (line.startsWith("Buffers:"))
            buffers = this._parseMemValue(line);
          else if (line.startsWith("Cached:"))
            cached = this._parseMemValue(line);
          else if (line.startsWith("SwapTotal:"))
            swapTotal = this._parseMemValue(line);
          else if (line.startsWith("SwapFree:"))
            swapFree = this._parseMemValue(line);
        }

        if (buffers > 0)
          details.push({ label: "Buffers", value: formatBytes(buffers) });
        if (cached > 0)
          details.push({ label: "Cached", value: formatBytes(cached) });
        if (swapTotal > 0) {
          const swapUsed = swapTotal - swapFree;
          details.push({
            label: "Swap",
            value: `${formatBytes(swapUsed)} / ${formatBytes(swapTotal)}`,
          });
        }
      }
    } catch (e) {
      // Ignore errors
    }
    return details;
  }

  _parseMemValue(line) {
    const match = line.match(/:\s*(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
}
