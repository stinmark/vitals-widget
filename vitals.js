import St from "gi://St";
import Clutter from "gi://Clutter";
import GObject from "gi://GObject";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import { RingProgress } from "./ring.js";
import { ICONS } from "./icons.js";

export const VitalItem = GObject.registerClass(
  class VitalItem extends St.BoxLayout {
    _type;
    _settings;
    _sensor;
    _ringProgress = null;
    _icon = null;
    _label = null;
    _handlerIds = [];
    _currentValue = 0;
    // Popup Menu variables
    _menu;
    _menuManager;

    constructor(type, settings, sensor) {
      super({
        style_class: "vital-item",
        vertical: true,
        x_align: Clutter.ActorAlign.CENTER,
        reactive: true,
        can_focus: true,
      });

      this._type = type;
      this._settings = settings;
      this._sensor = sensor;
      this._buildUI();

      // Initialize Native Popup Menu
      this._menu = new PopupMenu.PopupMenu(this, 0.5, St.Side.TOP);
      this._menu.actor.add_style_class_name("vitals-menu");
      this._menuManager = new PopupMenu.PopupMenuManager(this);
      this._menuManager.addMenu(this._menu);

      // Hide menu by default and add to UI Group
      this._menu.actor.hide();
      Main.layoutManager.uiGroup.add_child(this._menu.actor);
      this._connectSettings();
      this._updateStyle();

      // Click event to toggle menu
      this.connect("button-press-event", (actor, event) => {
        this._toggleMenu();
        return Clutter.EVENT_STOP;
      });
    }

    // Inside VitalItem class in vitals.ts
    async _toggleMenu() {
      // Check if popups are enabled in settings
      const popupsEnabled = this._settings.get_boolean("enable-popups");
      if (!popupsEnabled) return;
      if (this._menu.isOpen) {
        this._menu.close();
        return;
      }
      this._menu.removeAll();

      // Add Header with Bold Styling
      const title = new PopupMenu.PopupMenuItem(this._type.toUpperCase(), {
        reactive: false,
      });

      // Applying bold via inline style or class
      title.label.style = "font-weight: bold; font-size: 1.1em;";
      this._menu.addMenuItem(title);
      this._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
      const details = await this._sensor.getDetails();

      details.forEach((item) => {
        // Create a custom box for the menu item to style label and value separately
        const menuItem = new PopupMenu.PopupBaseMenuItem({ reactive: false });
        const box = new St.BoxLayout({ x_expand: true });
        const label = new St.Label({
          text: `${item.label}: `,
          style: "font-weight: bold; padding-right: 10px;", // Bold label
        });
        const value = new St.Label({
          text: item.value,
        });
        box.add_child(label);
        box.add_child(value);
        menuItem.add_child(box);
        this._menu.addMenuItem(menuItem);
      });
      this._menu.open();
    }

    _getGIcon(color) {
      const svgFunc = ICONS[this._type];
      const svgString = svgFunc ? svgFunc(color) : "";
      const encoder = new TextEncoder();
      const data = encoder.encode(svgString);
      const bytes = new GLib.Bytes(data);
      return Gio.BytesIcon.new(bytes);
    }

    _buildUI() {
      this.vertical =
        this._settings.get_string("vital-orientation") === "vertical";
      const container = new St.Widget({
        layout_manager: new Clutter.BinLayout(),
      });

      if (this._settings.get_boolean("show-rings")) {
        this._ringProgress = new RingProgress(this._type, this._settings);
        container.add_child(this._ringProgress);
      }

      if (this._settings.get_boolean("show-icons")) {
        this._icon = this._createIcon();
        container.add_child(this._icon);
      }

      if (
        this._settings.get_boolean("show-rings") ||
        this._settings.get_boolean("show-icons")
      ) {
        this.add_child(container);
      }

      if (this._settings.get_boolean("show-labels")) {
        this._label = new St.Label({
          text: "",
          style_class: "vital-label",
          x_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._label);
      }
    }

    _createIcon() {
      const diameter = this._settings.get_int("ring-diameter");
      const iconSize = Math.round(diameter * 0.5);
      const iconColor = this._settings.get_string("icon-color");
      return new St.Icon({
        gicon: this._getGIcon(iconColor),
        style_class: "vital-icon",
        icon_size: iconSize,
        style: `width: ${iconSize}px; height: ${iconSize}px;`,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
        y_expand: true,
      });
    }

    _connectSettings() {
      const keys = [
        "show-icons",
        "show-labels",
        "show-rings",
        "ring-diameter",
        "vital-orientation",
        "temp-unit",
      ];
      keys.forEach((key) => {
        this._handlerIds.push(
          this._settings.connect(`changed::${key}`, () => {
            this._rebuildUI();
          }),
        );
      });
      const styleKeys = [
        `${this._type}-color`,
        "icon-color",
        "inactive-ring-color",
        "label-font-size",
      ];
      styleKeys.forEach((key) => {
        this._handlerIds.push(
          this._settings.connect(`changed::${key}`, () => {
            this._updateStyle();
          }),
        );
      });
    }

    _updateStyle() {
      const iconColor = this._settings.get_string("icon-color");
      if (this._icon) {
        this._icon.gicon = this._getGIcon(iconColor);
      }

      if (this._label) {
        this._label.set_style(
          `color: ${iconColor}; font-size: ${this._settings.get_int("label-font-size")}px;`,
        );
      }
    }

    _rebuildUI() {
      if (this._ringProgress) {
        this._ringProgress.destroy();
      }
      this.destroy_all_children();
      this._label = null;
      this._icon = null;
      this._ringProgress = null;
      this._buildUI();
      if (this._ringProgress) {
        this.update(this._currentValue);
      }
    }

    update(value) {
      try {
        const safeValue =
          typeof value === "number" && !isNaN(value) ? value : 0;
        this._currentValue = Math.min(100, Math.max(0, safeValue));
        if (this._ringProgress) {
          this._ringProgress.setValue(this._currentValue);
        }

        if (this._label) {
          let labelText = `${Math.round(this._currentValue)}%`;
          if (this._type === "temp") {
            if (this._currentValue === 0) {
              labelText = "⏸";
            } else if (this._currentValue === 100) {
              labelText = "⚠";
            } else {
              const unit = this._settings.get_string("temp-unit");
              if (unit === "celcius" || unit === "fahrenheit") {
                // Calculate Celsius from percentage: (percentage * range / 100) + min
                // range = 90 - 35 = 55
                const celsius = this._currentValue * 0.55 + 35;
                if (unit === "fahrenheit") {
                  const fahrenheit = (celsius * 9) / 5 + 32;
                  labelText = `${Math.round(fahrenheit)}°F`;
                } else {
                  labelText = `${Math.round(celsius)}°C`;
                }
              }
            }
          }
          this._label.set_text(labelText);
        }
      } catch (e) {
        console.debug(`[VitalsWidget] Update error: ${e}`);
      }
    }

    destroy() {
      this._menu.destroy();
      this._handlerIds.forEach((id) => this._settings.disconnect(id));
      this._handlerIds = [];
      if (this._ringProgress) {
        this._ringProgress.destroy();
        this._ringProgress = null;
      }
      this._label = null;
      this._icon = null;
      super.destroy();
    }
  },
);
