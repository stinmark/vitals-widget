import Gio from "gi://Gio";

export class StorageSensor {
  _currentUsage = 0;
  _total = "0";
  _used = "0";
  _available = "0";
  _device = "";
  _mountPoint = "/";

  _formatBytes(bytes) {
    const unit = 1000;
    if (bytes < unit) return `${bytes} B`;
    const gb = bytes / Math.pow(unit, 3);

    if (gb >= 1) {
      // GNOME System Monitor usually shows 1 decimal place (e.g., 253.3 GB)
      return `${gb.toFixed(1)} GB`;
    }

    const mb = bytes / Math.pow(unit, 2);
    return `${mb.toFixed(1)} MB`;
  }

  async _findStorageDevice() {
    try {
      const file = Gio.File.new_for_path("/proc/mounts");
      const [contents] = await file.load_contents_async(null);
      if (!contents) return;

      const data = new TextDecoder().decode(contents);
      const lines = data.split("\n");

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2 && parts[1] === this._mountPoint) {
          this._device = parts[0];
          break;
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }

  async getValue() {
    try {
      // Find the device if we haven't yet
      if (!this._device) {
        await this._findStorageDevice();
      }

      const file = Gio.File.new_for_path(this._mountPoint);

      // Query filesystem info
      const info = await new Promise((resolve, reject) => {
        file.query_filesystem_info_async(
          "filesystem::*",
          0,
          null,
          (obj, res) => {
            try {
              const result = file.query_filesystem_info_finish(res);
              resolve(result);
            } catch (e) {
              reject(e);
            }
          },
        );
      });

      // Get size and free space
      const size = info.get_attribute_uint64("filesystem::size");
      const free = info.get_attribute_uint64("filesystem::free");
      const used = size - free;
      this._total = this._formatBytes(size);
      this._used = this._formatBytes(used);
      this._available = this._formatBytes(free);

      // Calculate percentage
      this._currentUsage = size === 0 ? 0 : Math.round((used / size) * 100);
      return this._currentUsage;
    } catch (e) {
      console.error(`StorageSensor Error: ${e}`);
      return 0;
    }
  }

  async getDetails() {
    const details = [
      { label: "Total Capacity", value: this._total },
      { label: "Used Space", value: this._used },
      { label: "Available", value: this._available },
      { label: "Usage (%)", value: `${Math.round(this._currentUsage)}%` },
    ];
    return details;
  }
}
