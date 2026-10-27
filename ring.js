import St from "gi://St";
import GObject from "gi://GObject";
import Cairo from "gi://cairo";

export const RingProgress = GObject.registerClass(
  class RingProgress extends St.DrawingArea {
    _type;
    _settings;
    _value = 0;
    _secondValue = 0;
    _handlerIds = [];

    constructor(type, settings) {
      super({
        style_class: "ring-progress",
      });

      this._type = type;
      this._settings = settings;
      this._updateSize();
      this._connectSettings();
    }

    _updateSize() {
      if (!this._settings) return;
      const diameter = this._settings.get_int("ring-diameter");
      this.set_width(diameter);
      this.set_height(diameter);
    }

    _connectSettings() {
      const signals = [
        `changed::${this._type}-color`,
        "changed::ring-diameter",
        "changed::ring-width",
      ];

      signals.forEach((signal) => {
        const id = this._settings.connect(signal, () => {
          if (signal.includes("diameter")) this._updateSize();
          this.queue_repaint();
        });
        this._handlerIds.push(id);
      });
    }

    setValue(value, secondValue = 0) {
      this._value = Math.min(100, Math.max(0, value));
      this._secondValue = Math.min(100, Math.max(0, secondValue));
      this.queue_repaint();
    }

    vfunc_repaint() {
      if (!this._settings) return;
      const cr = this.get_context();
      const [width, height] = this.get_surface_size();
      if (!cr || width === 0 || height === 0) return;

      try {
        const diameter = this._settings.get_int("ring-diameter");
        const ringWidth = this._settings.get_int("ring-width");
        const color = this._parseColor(
          this._settings.get_string(`${this._type}-color`),
        );
        const inactiveColor = this._parseColor(
          this._settings.get_string("inactive-ring-color"),
        );
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.max(0, diameter / 2 - ringWidth / 2 - 2);
        const isDualRing = this._type === "gpu" && this._secondValue > 0;
        const innerRadius = isDualRing
          ? Math.max(0, radius - ringWidth - 4)
          : radius;

        // Draw outer ring (VRAM)
        cr.setLineWidth(ringWidth);
        cr.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        cr.setSourceRGBA(
          inactiveColor.r,
          inactiveColor.g,
          inactiveColor.b,
          inactiveColor.a,
        );
        cr.stroke();
        if (this._value > 0) {
          const startAngle = -Math.PI / 2;
          const endAngle = startAngle + (2 * Math.PI * this._value) / 100;
          cr.setLineWidth(ringWidth);
          cr.setLineCap(Cairo.LineCap.ROUND);
          cr.arc(centerX, centerY, radius, startAngle, endAngle);
          cr.setSourceRGBA(color.r, color.g, color.b, color.a);
          cr.stroke();
        }

        // Draw inner ring (GPU util) for dual ring mode
        if (isDualRing) {
          const secondColor = this._parseColor(
            this._settings.get_string("gpu-second-color"),
          );
          cr.setLineWidth(ringWidth);
          cr.arc(centerX, centerY, innerRadius, 0, 2 * Math.PI);
          cr.setSourceRGBA(
            inactiveColor.r,
            inactiveColor.g,
            inactiveColor.b,
            inactiveColor.a,
          );
          cr.stroke();
          if (this._secondValue > 0) {
            const startAngle = -Math.PI / 2;
            const endAngle =
              startAngle + (2 * Math.PI * this._secondValue) / 100;
            cr.setLineWidth(ringWidth);
            cr.setLineCap(Cairo.LineCap.ROUND);
            cr.arc(centerX, centerY, innerRadius, startAngle, endAngle);
            cr.setSourceRGBA(
              secondColor.r,
              secondColor.g,
              secondColor.b,
              secondColor.a,
            );
            cr.stroke();
          }
        }
      } catch (e) {
        logError(e, "VitalsWidget: Error in RingProgress repaint");
      }
    }

    _parseColor(colorStr) {
      let r = 0.2,
        g = 0.6,
        b = 1.0,
        a = 1.0;
      if (!colorStr) return { r, g, b, a };
      if (colorStr.startsWith("#")) {
        const hex = colorStr.slice(1);
        if (hex.length === 6) {
          r = parseInt(hex.substring(0, 2), 16) / 255;
          g = parseInt(hex.substring(2, 4), 16) / 255;
          b = parseInt(hex.substring(4, 6), 16) / 255;
        } else if (hex.length === 3) {
          r = parseInt(hex[0] + hex[0], 16) / 255;
          g = parseInt(hex[1] + hex[1], 16) / 255;
          b = parseInt(hex[2] + hex[2], 16) / 255;
        }
      } else if (colorStr.startsWith("rgb")) {
        const match = colorStr.match(
          /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/,
        );
        if (match) {
          r = parseInt(match[1]) / 255;
          g = parseInt(match[2]) / 255;
          b = parseInt(match[3]) / 255;
          a = match[4] ? parseFloat(match[4]) : 1.0;
        }
      }
      return { r, g, b, a };
    }

    destroy() {
      if (this._settings) {
        this._handlerIds.forEach((id) => this._settings.disconnect(id));
        this._handlerIds = [];
      }
      this._settings = null;
      super.destroy();
    }
  },
);
