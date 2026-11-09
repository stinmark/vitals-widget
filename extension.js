import St from "gi://St";
import GObject from "gi://GObject";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
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

// Inverse of axisOffset: distance from the anchor for a given offset
function axisDistance(anchor, monitorSize, widgetSize, offset) {
  if (anchor === "center") return offset - (monitorSize - widgetSize) / 2;
  if (anchor === "end") return monitorSize - widgetSize - offset;
  return offset;
}

function toSettingValue(unit, distance, monitorSize) {
  if (unit === "pixels") return Math.round(distance);
  return Math.round((distance / monitorSize) * 1000) / 10;
}

// Settings values that place the widget at (x, y) with the given anchors and
// units: the inverse of computePosition
export function positionToValues({
  monitor,
  width,
  height,
  x,
  y,
  anchorX,
  anchorY,
  unitX,
  unitY,
}) {
  const dx = axisDistance(toAnchor(anchorX), monitor.width, width, x - monitor.x);
  const dy = axisDistance(toAnchor(anchorY), monitor.height, height, y - monitor.y);
  return {
    valueX: toSettingValue(unitX, dx, monitor.width),
    valueY: toSettingValue(unitY, dy, monitor.height),
  };
}

// Index of the monitor containing the point, or -1
export function monitorIndexAt(monitors, x, y) {
  return monitors.findIndex(
    (m) =>
      x >= m.x && x < m.x + m.width && y >= m.y && y < m.y + m.height,
  );
}

// Connector of the monitor saved as id = [vendor, product, serial], or null
// for the primary monitor or when it is not connected. Identical monitors
// are told apart by the saved connector.
export function pickMonitorConnector(monitors, id, savedConnector) {
  if (id.every((part) => part === "")) return null;
  const matches = monitors.filter(
    (m) => m.vendor === id[0] && m.product === id[1] && m.serial === id[2],
  );
  if (matches.length === 0) return null;
  return (matches.find((m) => m.connector === savedConnector) ?? matches[0])
    .connector;
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
    // Pointer press being tracked as a click or a drag
    _press = null;
    _dragging = false;
    _dragGrab = null;

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
        "monitor-id",
        "monitor-connector",
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
        const visible = this._settings.get_boolean(`show-${type}`);
        vital.visible = visible;
        if (visible) {
          if (!this._intervals.has(type)) {
            this._restartVitalTimer(type);
          }
        } else {
          const timerId = this._intervals.get(type);
          if (timerId) {
            GLib.source_remove(timerId);
            this._intervals.delete(type);
          }
        }
      });
    }

    // Monitor chosen in the settings if connected, otherwise the primary one
    _targetMonitor() {
      const layout = Main.layoutManager;
      const monitorManager = global.backend.get_monitor_manager();
      const connector = pickMonitorConnector(
        monitorManager.get_monitors().map((m) => ({
          vendor: m.get_vendor() ?? "",
          product: m.get_product() ?? "",
          serial: m.get_serial() ?? "",
          connector: m.get_connector(),
        })),
        this._settings.get_value("monitor-id").deepUnpack(),
        this._settings.get_string("monitor-connector"),
      );
      // -1 when the monitor is connected but off, e.g. a closed laptop lid
      const index =
        connector === null
          ? -1
          : monitorManager.get_monitor_for_connector(connector);
      return (index >= 0 && layout.monitors[index]) || layout.primaryMonitor;
    }

    _updatePosition() {
      // While dragging the pointer decides where the widget is
      if (this._dragging) return;
      const monitor = this._targetMonitor();
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

    vfunc_button_press_event(event) {
      if (event.get_button() !== Clutter.BUTTON_PRIMARY)
        return Clutter.EVENT_PROPAGATE;
      // The release went to another grab (e.g. a modal dialog): drop the
      // press, and a press outside the widget is not ours
      if (this._press) {
        this._endPress();
        this._updatePosition();
        if (!this.contains(global.stage.get_event_actor(event)))
          return Clutter.EVENT_PROPAGATE;
      }
      const [x, y] = event.get_coords();
      this._press = {
        x,
        y,
        widgetX: this.x,
        widgetY: this.y,
        actor: global.stage.get_event_actor(event),
      };
      this._dragGrab = global.stage.grab(this);
      return Clutter.EVENT_STOP;
    }

    vfunc_motion_event(event) {
      if (!this._press) return Clutter.EVENT_PROPAGATE;
      // The release went to another grab (e.g. the overview): drop the press
      if (!(event.get_state() & Clutter.ModifierType.BUTTON1_MASK)) {
        this._endPress();
        this._updatePosition();
        return Clutter.EVENT_PROPAGATE;
      }
      const [x, y] = event.get_coords();
      const dx = x - this._press.x;
      const dy = y - this._press.y;
      if (!this._dragging) {
        const threshold = St.Settings.get().drag_threshold;
        if (
          !this._settings.get_boolean("allow-drag") ||
          (Math.abs(dx) <= threshold && Math.abs(dy) <= threshold)
        )
          return Clutter.EVENT_STOP;
        this._dragging = true;
      }
      // Keep the widget inside the monitor under the pointer
      const monitors = Main.layoutManager.monitors;
      const monitor =
        monitors[monitorIndexAt(monitors, x, y)] ?? this._targetMonitor();
      const pos = clampToMonitor({
        monitor,
        width: this.width,
        height: this.height,
        x: Math.round(this._press.widgetX + dx),
        y: Math.round(this._press.widgetY + dy),
      });
      this.set_position(pos.x, pos.y);
      return Clutter.EVENT_STOP;
    }

    vfunc_button_release_event(event) {
      if (event.get_button() !== Clutter.BUTTON_PRIMARY || !this._press)
        return Clutter.EVENT_PROPAGATE;
      const [x, y] = event.get_coords();
      const { actor } = this._press;
      const dragged = this._dragging;
      this._endPress();
      if (dragged) {
        this._saveDraggedPosition(x, y);
      } else {
        // A click without moving opens the popup of the sensor under it
        for (let a = actor; a && a !== this; a = a.get_parent()) {
          if (a instanceof VitalItem) {
            a.toggleMenu();
            break;
          }
        }
      }
      return Clutter.EVENT_STOP;
    }

    _endPress() {
      this._dragGrab?.dismiss();
      this._dragGrab = null;
      this._press = null;
      this._dragging = false;
    }

    // Save where the widget was dropped, measured from the monitor under the
    // pointer with the current anchors and units. That monitor becomes the
    // chosen one if it is not the one the position was measured from.
    _saveDraggedPosition(px, py) {
      const monitors = Main.layoutManager.monitors;
      const current = this._targetMonitor();
      const monitor = monitors[monitorIndexAt(monitors, px, py)] ?? current;
      // delay() cannot be undone, so write through a separate object; all
      // keys then reach the widget as one change
      const batch = new Gio.Settings({
        settings_schema: this._settings.settings_schema,
        backend: this._settings.backend,
      });
      batch.delay();
      if (monitor.index !== current.index) {
        const monitorManager = global.backend.get_monitor_manager();
        const dropped = monitorManager
          .get_monitors()
          .find(
            (m) =>
              monitorManager.get_monitor_for_connector(m.get_connector()) ===
              monitor.index,
          );
        if (dropped) {
          batch.set_string("monitor-connector", dropped.get_connector());
          batch.set_string("monitor-name", dropped.get_display_name() ?? "");
          batch.set_value(
            "monitor-id",
            new GLib.Variant("(sss)", [
              dropped.get_vendor() ?? "",
              dropped.get_product() ?? "",
              dropped.get_serial() ?? "",
            ]),
          );
        }
      }
      const values = positionToValues({
        monitor,
        width: this.width,
        height: this.height,
        x: this.x,
        y: this.y,
        anchorX: this._settings.get_string("position-x-anchor"),
        anchorY: this._settings.get_string("position-y-anchor"),
        unitX: this._settings.get_string("position-x-unit"),
        unitY: this._settings.get_string("position-y-unit"),
      });
      batch.set_double("position-x", values.valueX);
      batch.set_double("position-y", values.valueY);
      batch.apply();
    }

    _startUpdates() {
      this._clearTimers();
      this._sensors.forEach((sensor, type) => {
        this._restartVitalTimer(type);
      });
    }

    _restartVitalTimer(type) {
      const oldId = this._intervals.get(type);
      if (oldId) {
        GLib.source_remove(oldId);
        this._intervals.delete(type);
      }
      if (!this._settings.get_boolean(`show-${type}`)) return;

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
        this._intervals.delete(type);
        return GLib.SOURCE_REMOVE;
      });
      this._intervals.set(type, id);
    }

    _clearTimers() {
      this._intervals.forEach((id) => GLib.source_remove(id));
      this._intervals.clear();
    }

    destroy() {
      // A drag interrupted by disable() (e.g. screen lock) is not saved
      if (this._press) this._endPress();
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
