import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gdk from "gi://Gdk";
import Gio from "gi://Gio";
import { VitalType, getVitalDisplayName } from "../config.js";

export function createVitalsPage(settings) {
  const vitalsPage = new Adw.PreferencesPage({
    title: "Vitals",
    icon_name: "applications-system-symbolic",
  });
  Object.values(VitalType).forEach((type) => {
    createVitalGroup(vitalsPage, settings, type);
  });
  return vitalsPage;
}
// Helper to create a setting group for a specific vital type

function createVitalGroup(page, settings, type) {
  const group = new Adw.PreferencesGroup({
    title: getVitalDisplayName(type),
  });
  page.add(group);

  const enableRow = new Adw.SwitchRow({
    title: "Show",
    subtitle: `Display ${getVitalDisplayName(type)} indicator`,
  });
  settings.bind(
    `show-${type}`,
    enableRow,
    "active",
    Gio.SettingsBindFlags.DEFAULT,
  );
  group.add(enableRow);

  addColorRow(group, settings, `${type}-color`, "Ring Color");

  // Temperature Unit selection specifically for the temp group
  if (type === "temp") {
    const tempUnitRow = new Adw.ComboRow({
      title: "Temperature Unit",
      model: new Gtk.StringList({
        strings: ["Percentage", "Celsius", "Fahrenheit"],
      }),
    });
    // Map gschema enum values to row indices
    const unitValue = settings.get_string("temp-unit");

    tempUnitRow.selected =
      unitValue === "fahrenheit" ? 2 : unitValue === "celcius" ? 1 : 0;
    tempUnitRow.connect("notify::selected", () => {
      const values = ["percentage", "celcius", "fahrenheit"];
      settings.set_string("temp-unit", values[tempUnitRow.selected]);
    });
    group.add(tempUnitRow);
  }
  addSpinRow(
    group,
    settings,
    `${type}-update-interval`,
    "Update Interval (ms)",
    500,
    300000,
    500,
  );
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
