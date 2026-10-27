# Vitals Widget

A modern, customizable desktop system monitoring widget for GNOME Shell. Vitals Widget moves system metrics out of the top panel and places them directly onto your desktop with progress rings and text metrics.

![Preview](assets/preview.jpg)

---

## Features

- **Monitored Vitals:** Track CPU usage, RAM utilization, storage space, temperatures, and GPU stats in real time.
- **Flexible Positioning:** Choose the monitor, then place the widget at a distance from any edge or the center, in pixels or as a percentage of the screen — or just drag it where you want it.
- **Customizable Layouts:**
  - Horizontal or vertical orientation for both the main container and individual vital cards.
  - Adjustable background colors, border styling, padding, and rounded corners.
  - Toggle circular progress rings, text labels, or detailed popups independently.
- **Individual Sensor Controls:**
  - Enable or disable specific sensors (CPU, RAM, Storage, Temp, GPU).
  - Set custom update intervals per sensor (from 500ms to 5min).
  - Choose temperature units: **Celsius (°C)**, **Fahrenheit (°F)**, or **Percentage (%)**.

---

## Compatibility

- **GNOME Shell Versions:** `45`, `46`, `47`, `48`, `49`, `50`, `51`
- **Architecture:** Native GJS / ES Module (ESM) extension requiring no compilation dependencies.

---

## Installation

### Option 1: Install from GNOME Extensions (Recommended)
Install directly from [extensions.gnome.org/extension/9072/vitals-widget](https://extensions.gnome.org/extension/9072/vitals-widget/).

### Option 2: Manual Installation from Source

1. Clone the repository:
   ```bash
   git clone [https://github.com/stinmark/vitals-widget.git](https://github.com/stinmark/vitals-widget.git)
   cd vitals-widget

```

2. Run the build script to create the extension zip:


```bash
chmod +x build.sh
./build.sh

```


3. Extract and install to your local extensions folder:


```bash
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/vitalsWidget@ctrln3rd.github.com"
mkdir -p "$EXT_DIR"
unzip -o vitalsWidget@ctrln3rd.github.com.zip -d "$EXT_DIR"

```


4. Compile GSettings schemas locally:
```bash
glib-compile-schemas "$EXT_DIR/schemas/"

```


5. Restart GNOME Shell (`Alt + F2`, type `r` on X11, or log out and log back in on Wayland) and enable the extension:
```bash
gnome-extensions enable vitalsWidget@ctrln3rd.github.com

```



---

## Configuration

Access the extension preferences via GNOME Extensions app or via terminal:

```bash
gnome-extensions prefs vitalsWidget@ctrln3rd.github.com

```

### Settings Overview

* **General Tab:** Configure widget placement, orientation, container colors, padding, ring diameters, and icon styles.


* **Vitals Tab:** Toggle individual sensors, change ring colors, set update frequencies, and select temperature units.


* **About Tab:** Developer details, GitHub source links, issue reporting, and donation links.



---

## Building & Releasing

To create a release bundle manually, run:

```bash
./build.sh

```

This compiles the `schemas/` directory with `glib-compile-schemas` and creates `vitalsWidget@ctrln3rd.github.com.zip` ready for upload to GNOME Shell Extensions.

---

## License & Credits

* **Developer:** Austine ([@stinmark](https://github.com/stinmark))


* **License:** [GNU General Public License v3.0](https://www.google.com/search?q=LICENSE)


```

```
