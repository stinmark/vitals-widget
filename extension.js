import St from "gi://St";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Clutter from "gi://Clutter";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { VitalItem } from "./vitals.js";
import { VitalType } from "./config.js";
import { CPUSensor } from "./sensors/cpu.js";
import { RAMSensor } from "./sensors/ram.js";
import { StorageSensor } from "./sensors/storage.js";
import { TempSensor } from "./sensors/temp.js";
import { GPUSensor } from "./sensors/gpu.js";

const VitalsWidget = GObject.registerClass(
  class VitalsWidget extends St.BoxLayout {
    _vitals;
    _sensors;
    _settings;
    _intervals = new Map();
    _handlerIds = [];

    constructor(settings) {
      super({
        style_class: "vitals-widget-container",
        reactive: true,
        can_focus: true,
      });

      this._settings = settings;
      this._vitals = new Map();
      this._sensors = new Map();
      this._buildUI();
      this._initializeSensors();
      this._connectSettings();
      this._updatePosition();
      this._startUpdates();
    }

    _buildUI() {
      this._updateContainerStyle();
      this.orientation = this._settings.get_string("orientation") === "vertical"
        ? Clutter.Orientation.VERTICAL
        : Clutter.Orientation.HORIZONTAL;      
    }

    _initializeSensors() {
      this._sensors.set(VitalType.CPU, new CPUSensor());
      this._sensors.set(VitalType.RAM, new RAMSensor());
      this._sensors.set(VitalType.STORAGE, new StorageSensor());
      this._sensors.set(VitalType.TEMP, new TempSensor());
      this._sensors.set(VitalType.GPU, new GPUSensor());

      Object.values(VitalType).forEach((type) => {
        const sensor = this._sensors.get(type); // Get the specific sensor
        const vital = new VitalItem(type, this._settings, sensor);
        this._vitals.set(type, vital);
        this.add_child(vital);
      });

      this._updateVitalsVisibility();
    }

    _connectSettings() {
      // Track every handler ID to disconnect them in destroy()
      this._handlerIds.push(
        this._settings.connect("changed::position-x", () =>
          this._updatePosition(),
        ),
      );
      this._handlerIds.push(
        this._settings.connect("changed::position-y", () =>
          this._updatePosition(),
        ),
      );

      // Inside _connectSettings()
      this._handlerIds.push(
        this._settings.connect("changed::orientation", () => {
          this.orientation = this._settings.get_string("orientation") === "vertical"
          ? Clutter.Orientation.VERTICAL
          : Clutter.Orientation.HORIZONTAL;
        }),
      );

      const styleKeys = [
        "background-color",
        "border-color",
        "border-radius",
        "vital-spacing",
        "padding-horizontal",
        "padding-vertical",
      ];
      styleKeys.forEach((key) => {
        this._handlerIds.push(
          this._settings.connect(`changed::${key}`, () => {
            if (this._vitals.size === 0) return;
            this._updateContainerStyle();
          }),
        );
      });
      Object.values(VitalType).forEach((type) => {
        this._handlerIds.push(
          this._settings.connect(`changed::show-${type}`, () =>
            this._updateVitalsVisibility(),
          ),
        );
        this._handlerIds.push(
          this._settings.connect(`changed::${type}-update-interval`, () => {
            this._restartVitalTimer(type);
          }),
        );
      });
    }

    _updateContainerStyle() {
      const bgColor = this._settings.get_string("background-color");
      const borderColor = this._settings.get_string("border-color");
      const borderRadius = this._settings.get_int("border-radius");
      const spacing = this._settings.get_int("vital-spacing");
      const padH = this._settings.get_int("padding-horizontal");
      const padV = this._settings.get_int("padding-vertical");

      this.set_style(`
            background-color: ${bgColor};
            border: 2px solid ${borderColor};
            border-radius: ${borderRadius}px;
            padding: ${padV}px ${padH}px;
            spacing: ${spacing}px;
        `);
    }

    _updateVitalsVisibility() {
      this._vitals.forEach((vital, type) => {
        vital.visible = this._settings.get_boolean(`show-${type}`);
      });
    }

    _updatePosition() {
      const monitor = Main.layoutManager.primaryMonitor;
      if (!monitor) return;
      const x = (monitor.width * this._settings.get_double("position-x")) / 100;
      const y =
        (monitor.height * this._settings.get_double("position-y")) / 100;
      this.set_position(monitor.x + Math.round(x), monitor.y + Math.round(y));
    }

    _startUpdates() {
      this._clearTimers();
      this._sensors.forEach((sensor, type) => {
        this._restartVitalTimer(type);
      });
    }

    _restartVitalTimer(type) {
      const oldId = this._intervals.get(type);
      if (oldId) GLib.source_remove(oldId);
      const interval = this._settings.get_int(`${type}-update-interval`);
      const id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, interval, () => {
        const vital = this._vitals.get(type);
        const sensor = this._sensors.get(type);
        if (this._vitals.size > 0 && vital && vital.visible && sensor) {
          sensor
            .getValue()
            .then((value) => {
              vital.update(value);
            })
            .catch((err) => {
              console.error(`[VitalsWidget] Error getting ${type} value:`, err);
              vital.update(0);
            });
          return GLib.SOURCE_CONTINUE;
        }
        return GLib.SOURCE_REMOVE;
      });
      this._intervals.set(type, id);
    }

    _clearTimers() {
      this._intervals.forEach((id) => GLib.source_remove(id));
      this._intervals.clear();
    }

    destroy() {
      // 1. Kill timers
      this._clearTimers();
      // 2. Disconnect all settings signals
      this._handlerIds.forEach((id) => this._settings.disconnect(id));
      this._handlerIds = [];
      // 3. Destroy children
      this._sensors.forEach((sensor) => sensor.destroy?.());
      this._vitals.forEach((vital) => vital.destroy());
      this._vitals.clear();
      super.destroy();
    }
  },
);

export default class VitalsWidgetExtension extends Extension {
  _widget = null;
  enable() {
    const settings = this.getSettings();
    this._widget = new VitalsWidget(settings);
    Main.layoutManager._backgroundGroup.add_child(this._widget);
  }

  disable() {
    if (this._widget) {
      Main.layoutManager._backgroundGroup.remove_child(this._widget);
      this._widget.destroy();
      this._widget = null;
    }
  }
}
