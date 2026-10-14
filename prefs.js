import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";
import { createAboutPage } from "./prefs/AboutPage.js";
import { createGeneralPage } from "./prefs/GeneralPage.js";
import { createVitalsPage } from "./prefs/VitalsPage.js";

export default class VitalsWidgetPreferences extends ExtensionPreferences {
  async fillPreferencesWindow(window) {
    const settings = this.getSettings();
    // Add pages in order: About, General, Vitals
    window.add(createGeneralPage(settings));
    window.add(createVitalsPage(settings));
    window.add(createAboutPage());
  }
}
