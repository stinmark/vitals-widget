import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";

export function createAboutPage() {
  const aboutPage = new Adw.PreferencesPage({
    title: "About",
    icon_name: "help-about-symbolic",
  });

  // Project Info Group
  const projectGroup = new Adw.PreferencesGroup({
    title: "Vitals Widget Extension",
    description: "System monitoring widget for GNOME Shell",
  });
  aboutPage.add(projectGroup);

  // Version/Description row
  const versionRow = new Adw.ActionRow({
    title: "Vitals Widget",
    subtitle: "Monitor CPU, RAM, GPU, temperature and storage",
  });
  projectGroup.add(versionRow);

  // Support Group
  const supportGroup = new Adw.PreferencesGroup({
    title: "Support Development",
    description: "Help keep this extension maintained and improved",
  });
  aboutPage.add(supportGroup);

  // Ko-fi donation link
  const kofiRow = new Adw.ActionRow({
    title: "Support via github",
    subtitle: "♥️ Buy me a coffee",
    activatable: true,
  });
  const kofiIcon = new Gtk.Image({
    icon_name: "external-link-symbolic",
  });
  kofiRow.add_suffix(kofiIcon);
  kofiRow.connect("activated", () => {
    Gio.AppInfo.launch_default_for_uri(
      "https://github.com/sponsors/stinmark",
      null,
    );
  });
  supportGroup.add(kofiRow);

  // Links Group
  const linksGroup = new Adw.PreferencesGroup({
    title: "Links",
  });
  aboutPage.add(linksGroup);

  // GitHub link
  const githubRow = new Adw.ActionRow({
    title: "Source Code",
    subtitle: "View on GitHub",
    activatable: true,
  });
  const githubIcon = new Gtk.Image({
    icon_name: "external-link-symbolic",
  });
  githubRow.add_suffix(githubIcon);
  githubRow.connect("activated", () => {
    Gio.AppInfo.launch_default_for_uri(
      "https://github.com/stinmark/vitals-widget",
      null,
    );
  });
  linksGroup.add(githubRow);

  // Report Issue link
  const issueRow = new Adw.ActionRow({
    title: "Report an Issue",
    subtitle: "Found a bug? Let us know",
    activatable: true,
  });
  const issueIcon = new Gtk.Image({
    icon_name: "external-link-symbolic",
  });
  issueRow.add_suffix(issueIcon);
  issueRow.connect("activated", () => {
    Gio.AppInfo.launch_default_for_uri(
      "https://github.com/stinmark/vitals-widget/issues",
      null,
    );
  });
  linksGroup.add(issueRow);

  // Credits Group
  const creditsGroup = new Adw.PreferencesGroup({
    title: "Credits",
  });
  aboutPage.add(creditsGroup);

  const authorRow = new Adw.ActionRow({
    title: "Developer",
    subtitle: "Austine",
  });
  creditsGroup.add(authorRow);

  const licenseRow = new Adw.ActionRow({
    title: "License",
    subtitle: "GNU General Public License v3.0",
  });
  creditsGroup.add(licenseRow);
  return aboutPage;
}
