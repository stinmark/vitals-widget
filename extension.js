import St from "gi://St";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Clutter from "gi://Clutter";
import Meta from "gi://Meta";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { VitalItem } from "./vitals.js";
import { VitalType } from "./config.js";
import { CPUSensor } from "./sensors/cpu.js";
import { RAMSensor } from "./sensors/ram.js";
import { StorageSensor } from "./sensors/storage.js";
import { TempSensor } from "./sensors/temp.js";
import { GPUSensor } from "./sensors/gpu.js";

// Offset of the widget's near side from the monitor origin along one axis.
// anchor: "start" (left/top), "center" or "end" (right/bottom)
function axisOffset(anchor, monitorSize, widgetSize, distance) {
  if (anchor === "center") return (monitorSize - widgetSize) / 2 + distance;
  if (anchor === "end") return monitorSize - widgetSize - distance;
  return distance;
}

function toAnchor(anchor) {
  if (anchor === "right" || anchor === "bottom") return "end";
  if (anchor === "center") return "center";
  return "start";
}

function overlaps(monitor, width, height, x, y) {
  return (
    x < monitor.x + monitor.width &&
    x + width > monitor.x &&
    y < monitor.y + monitor.height &&
    y + height > monitor.y
  );
}

// Keep the whole widget inside the monitor (top-left aligned if it is larger)
export function clampToMonitor({ monitor, width, height, x, y }) {
  return {
    x: Math.max(monitor.x, Math.min(x, monitor.x + monitor.width - width)),
    y: Math.max(monitor.y, Math.min(y, monitor.y + monitor.height - height)),
  };
}

// Absolute stage position of the widget for the configured anchor, unit and
// distance on each axis. Distances are measured from the full monitor edge.
export function computePosition({
  monitor,
  monitors,
  width,
  height,
  anchorX,
  anchorY,
  unitX,
  unitY,
  valueX,
  valueY,
}) {
  const dx = unitX === "pixels" ? valueX : (monitor.width * valueX) / 100;
  const dy = unitY === "pixels" ? valueY : (monitor.height * valueY) / 100;
  const pos = {
    x: Math.round(
      monitor.x + axisOffset(toAnchor(anchorX), monitor.width, width, dx),
    ),
    y: Math.round(
      monitor.y + axisOffset(toAnchor(anchorY), monitor.height, height, dy),
    ),
  };
  // Never leave the widget where no monitor can show it
  if (!monitors.some((m) => overlaps(m, width, height, pos.x, pos.y)))
    return clampToMonitor({ monitor, width, height, ...pos });
  return pos;
}

// Size of the actor for placing it. While a relayout is pending (set_position
// queues one) width/height return the size it is about to get; off the stage
// asking would warn, so it counts as empty
export function layoutSize(actor) {
  if (!actor.get_stage()) return { width: 0, height: 0 };
  return { width: actor.width, height: actor.height };
}

const VitalsWidget = GObject.registerClass(
  class VitalsWidget extends St.BoxLayout {
    _vitals;
    _sensors;
    _settings;
    _intervals = new Map();
    _handlerIds = [];
    _monitorsChangedId = null;
    _sizeHandlerIds = [];
    _positionLaterId = null;

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
      const positionKeys = [
        "position-x",
        "position-y",
        "position-x-anchor",
        "position-y-anchor",
        "position-x-unit",
        "position-y-unit",
      ];
      positionKeys.forEach((key) => {
        this._handlerIds.push(
          this._settings.connect(`changed::${key}`, () =>
            this._updatePosition(),
          ),
        );
      });
      // Recompute the position when monitors are added/removed or rearranged
      this._monitorsChangedId = Main.layoutManager.connect(
        "monitors-changed",
        () => this._updatePosition(),
      );
      // Keep the distance from right/bottom/center anchors when the size changes
      ["notify::width", "notify::height"].forEach((signal) => {
        this._sizeHandlerIds.push(
          this.connect(signal, () => this._queuePositionUpdate()),
        );
      });

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
      // Before enable() adds it the widget has no size yet; its size change
      // re-runs this anyway
      const pos = computePosition({
        monitor,
        monitors: Main.layoutManager.monitors,
        ...layoutSize(this),
        anchorX: this._settings.get_string("position-x-anchor"),
        anchorY: this._settings.get_string("position-y-anchor"),
        unitX: this._settings.get_string("position-x-unit"),
        unitY: this._settings.get_string("position-y-unit"),
        valueX: this._settings.get_double("position-x"),
        valueY: this._settings.get_double("position-y"),
      });
      this.set_position(pos.x, pos.y);
    }

    // Size changes are notified during allocation: move on the next frame
    _queuePositionUpdate() {
      if (this._positionLaterId) return;
      this._positionLaterId = global.compositor
        .get_laters()
        .add(Meta.LaterType.BEFORE_REDRAW, () => {
          this._positionLaterId = null;
          this._updatePosition();
          return GLib.SOURCE_REMOVE;
        });
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
      if (this._monitorsChangedId) {
        Main.layoutManager.disconnect(this._monitorsChangedId);
        this._monitorsChangedId = null;
      }
      this._sizeHandlerIds.forEach((id) => this.disconnect(id));
      this._sizeHandlerIds = [];
      if (this._positionLaterId) {
        global.compositor.get_laters().remove(this._positionLaterId);
        this._positionLaterId = null;
      }
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
    // Now that it has a size: right, bottom and center anchors need it
    this._widget._updatePosition();
  }

  disable() {
    if (this._widget) {
      Main.layoutManager._backgroundGroup.remove_child(this._widget);
      this._widget.destroy();
      this._widget = null;
    }
  }
}
