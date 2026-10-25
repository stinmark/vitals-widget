import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gdk from "gi://Gdk";
import Gio from "gi://Gio";

export function createGeneralPage(settings) {
  const generalPage = new Adw.PreferencesPage({
    title: "General",
    icon_name: "preferences-system-symbolic",
  });

  // Position Group
  const positionGroup = new Adw.PreferencesGroup({
    title: "Widget Position",
    description:
      "Position on screen (drag widget to reposition or use sliders)",
  });
  generalPage.add(positionGroup);

  addAxisRows(positionGroup, settings, "x");
  addAxisRows(positionGroup, settings, "y");

  // Visibility Group
  const visibilityGroup = new Adw.PreferencesGroup({
    title: "Visibility & Interaction",
    description:
      "Control what elements are visible. At least one must be active.",
  });
  generalPage.add(visibilityGroup);

  const showRingsRow = new Adw.SwitchRow({ title: "Show Rings" });
  const showLabelsRow = new Adw.SwitchRow({ title: "Show Text Labels" });
  const popupRow = new Adw.SwitchRow({
    title: "Enable Details Popup",
    subtitle: "Show details when clicking a sensor",
  });

  // Bind settings
  settings.bind(
    "show-rings",
    showRingsRow,
    "active",
    Gio.SettingsBindFlags.DEFAULT,
  );
  settings.bind(
    "show-labels",
    showLabelsRow,
    "active",
    Gio.SettingsBindFlags.DEFAULT,
  );
  settings.bind(
    "enable-popups",
    popupRow,
    "active",
    Gio.SettingsBindFlags.DEFAULT,
  );

  // Prevent both being disabled
  showRingsRow.connect("notify::active", () => {
    if (!showRingsRow.active && !showLabelsRow.active) {
      showLabelsRow.active = true;
    }
  });

  showLabelsRow.connect("notify::active", () => {
    if (!showLabelsRow.active && !showRingsRow.active) {
      showRingsRow.active = true;
    }
  });
  visibilityGroup.add(showRingsRow);
  visibilityGroup.add(showLabelsRow);
  visibilityGroup.add(popupRow);

  // Layout & Container Group
  const layoutGroup = new Adw.PreferencesGroup({
    title: "Layout & Container",
    description: "Main widget container and spacing settings",
  });
  generalPage.add(layoutGroup);

  // Orientation row
  const orientationRow = new Adw.ComboRow({
    title: "Layout Orientation",
    model: new Gtk.StringList({ strings: ["Horizontal", "Vertical"] }),
  });

  // Load initial state
  orientationRow.selected =
    settings.get_string("orientation") === "vertical" ? 1 : 0;
  // Connect signal to save changes
  orientationRow.connect("notify::selected", () => {
    const value = orientationRow.selected === 1 ? "vertical" : "horizontal";
    settings.set_string("orientation", value);
  });
  layoutGroup.add(orientationRow);

  const fontSizeRow = new Adw.SpinRow({
    title: "Label Font Size",
    adjustment: new Gtk.Adjustment({
      lower: 6,
      upper: 24,
      step_increment: 1,
    }),
  });
  settings.bind(
    "label-font-size",
    fontSizeRow,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );
  layoutGroup.add(fontSizeRow);

  addSpinRow(
    layoutGroup,
    settings,
    "vital-spacing",
    "Spacing Between Vitals",
    0,
    200,
  );
  addSpinRow(
    layoutGroup,
    settings,
    "padding-horizontal",
    "Horizontal Padding",
    0,
    100,
  );
  addSpinRow(
    layoutGroup,
    settings,
    "padding-vertical",
    "Vertical Padding",
    0,
    100,
  );
  addSpinRow(layoutGroup, settings, "border-radius", "Border Radius", 0, 50);
  addColorRow(layoutGroup, settings, "background-color", "Background Color");
  addColorRow(layoutGroup, settings, "border-color", "Border Color");

  // Vitals Orientation row
  const vitalOrientRow = new Adw.ComboRow({
    title: "Vital Content Orientation",
    subtitle: "Stacking of icon and label inside each vital",
    model: new Gtk.StringList({ strings: ["Horizontal", "Vertical"] }),
  });

  // Load initial state
  vitalOrientRow.selected =
    settings.get_string("vital-orientation") === "vertical" ? 1 : 0;
  // Connect signal to save changes
  vitalOrientRow.connect("notify::selected", () => {
    const value = vitalOrientRow.selected === 1 ? "vertical" : "horizontal";
    settings.set_string("vital-orientation", value);
  });
  layoutGroup.add(vitalOrientRow);

  // Rings & Icons Group
  const ringsGroup = new Adw.PreferencesGroup({
    title: "Rings & Icons",
    description: "Global settings for circular indicators",
  });
  generalPage.add(ringsGroup);

  addSpinRow(ringsGroup, settings, "ring-diameter", "Ring Diameter", 20, 200);
  addSpinRow(ringsGroup, settings, "ring-width", "Ring Thickness", 1, 20);
  addColorRow(
    ringsGroup,
    settings,
    "inactive-ring-color",
    "Inactive Ring Color",
  );
  addColorRow(ringsGroup, settings, "icon-color", "Icon and Label Color");
  return generalPage;
}
// Spin range for a position distance. Wide enough that existing values
// (e.g. 200% to reach a second monitor) are never clamped by the row.
export function distanceRange(anchor, unit) {
  const max = unit === "pixels" ? 20000 : 1000;
  return {
    lower: anchor === "center" ? -max : 0,
    upper: max,
    digits: unit === "pixels" ? 0 : 1,
  };
}
// Helper to add a SpinRow for numeric settings

function addSpinRow(group, settings, key, title, lower, upper, step = 1) {
  const row = new Adw.SpinRow({
    title,
    adjustment: new Gtk.Adjustment({ lower, upper, step_increment: step }),
  });
  settings.bind(key, row, "value", Gio.SettingsBindFlags.DEFAULT);
  group.add(row);
}
// Helper to add the anchor, unit and distance rows of one position axis
function addAxisRows(group, settings, axis) {
  const horizontal = axis === "x";
  const name = horizontal ? "Horizontal" : "Vertical";
  const anchorKey = `position-${axis}-anchor`;
  const unitKey = `position-${axis}-unit`;
  const anchors = horizontal
    ? ["left", "center", "right"]
    : ["top", "center", "bottom"];
  const units = ["percent", "pixels"];

  const anchorRow = new Adw.ComboRow({
    title: `${name} Anchor`,
    model: new Gtk.StringList({
      strings: horizontal
        ? ["Left", "Center", "Right"]
        : ["Top", "Center", "Bottom"],
    }),
  });
  anchorRow.selected = anchors.indexOf(settings.get_string(anchorKey));

  const unitRow = new Adw.ComboRow({
    title: `${name} Unit`,
    model: new Gtk.StringList({ strings: ["Percent of screen", "Pixels"] }),
  });
  unitRow.selected = units.indexOf(settings.get_string(unitKey));

  // The range must be set before binding, or the bound value gets clamped
  const range = distanceRange(
    settings.get_string(anchorKey),
    settings.get_string(unitKey),
  );
  const distanceRow = new Adw.SpinRow({
    title: `${name} Distance`,
    subtitle: `From the chosen edge. With Center, negative values move ${horizontal ? "left" : "up"}`,
    digits: range.digits,
    adjustment: new Gtk.Adjustment({
      lower: range.lower,
      upper: range.upper,
      step_increment: 1,
    }),
  });
  settings.bind(
    `position-${axis}`,
    distanceRow,
    "value",
    Gio.SettingsBindFlags.DEFAULT,
  );

  const updateRange = () => {
    const r = distanceRange(
      settings.get_string(anchorKey),
      settings.get_string(unitKey),
    );
    distanceRow.adjustment.lower = r.lower;
    distanceRow.adjustment.upper = r.upper;
    distanceRow.digits = r.digits;
  };
  anchorRow.connect("notify::selected", () => {
    settings.set_string(anchorKey, anchors[anchorRow.selected]);
    updateRange();
  });
  unitRow.connect("notify::selected", () => {
    settings.set_string(unitKey, units[unitRow.selected]);
    updateRange();
  });

  group.add(anchorRow);
  group.add(unitRow);
  group.add(distanceRow);
}
// Helper to add a color picker row

function addColorRow(group, settings, key, title) {
  const row = new Adw.ActionRow({ title });
  const colorButton = new Gtk.ColorButton();
  colorButton.set_use_alpha(true);
  const colorStr = settings.get_string(key);
  const rgba = new Gdk.RGBA();

  rgba.parse(colorStr);
  colorButton.set_rgba(rgba);
  colorButton.connect("color-set", () => {
    const color = colorButton.get_rgba();
    const colorString = `rgba(${Math.round(color.red * 255)}, ${Math.round(color.green * 255)}, ${Math.round(color.blue * 255)}, ${color.alpha})`;
    settings.set_string(key, colorString);
  });

  row.add_suffix(colorButton);
  row.set_activatable_widget(colorButton);
  group.add(row);
}
