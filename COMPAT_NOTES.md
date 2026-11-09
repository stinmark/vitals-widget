# Compatibility Notes — Developer Reference

> [!NOTE]
> This file is listed in `.gitignore` and is **not included in any build or release**.
> It exists solely as a local developer reference.

---

## `getPhysicalMonitors()` shim — GNOME 46 / 47 / 48

### Why it exists

`MetaMonitorManager.get_monitors()` was only **promoted to the public Mutter API**
(`META_EXPORT` in `meta-monitor-manager.h`) in **GNOME 49**.

On GNOME 46, 47, and 48 the function exists in C but lives in the **private backend
header** (`meta-monitor-manager-private.h`). Because it is not exported it is
**never included in the GObject Introspection typelib**, so GJS cannot see it at
all — hence the runtime error:

```
TypeError: monitorManager.get_monitors is not a function
```

The error `monitorManager.get_monitors is not a function` on GNOME 46/47/48
is because **both** `MetaMonitorManager.get_monitors()` and
`MetaLogicalMonitor.get_monitors()` are in private backend headers with no
`META_EXPORT` before GNOME 49. Neither is included in the GObject Introspection
typelib, so GJS cannot see either of them.

The fix uses `org.gnome.Mutter.DisplayConfig` D-Bus `GetCurrentState` instead,
which has been stable across all GNOME versions and is already used by the prefs
page for the same purpose.

### Source evidence

| Branch | Location of `get_monitors` |
|---|---|
| `gnome-46` | `src/backends/meta-monitor-manager-private.h` — **not exported** |
| `gnome-47` | `src/backends/meta-monitor-manager-private.h` — **not exported** |
| `gnome-48` | `src/backends/meta-monitor-manager-private.h` — **not exported** |
| `gnome-49` | `src/meta/meta-monitor-manager.h` + `META_EXPORT` — ✅ **public** |
| `gnome-50+` | same as 49 |

---

## How to revert when GNOME 49 becomes the minimum supported version

Once `metadata.json` drops `"46"`, `"47"`, and `"48"` from `shell-version`,
the D-Bus shim can be removed and the two affected methods restored to use
the native Mutter API directly.

### Step 1 — Update `metadata.json`

```json
"shell-version": ["49", "50", "51"]
```

### Step 2 — Delete `fetchMonitorsFromDBus()` from `extension.js`

Remove the entire function block (search for `fetchMonitorsFromDBus`):

```js
function fetchMonitorsFromDBus() { ... }
```

### Step 3 — Remove `_cachedMonitors` and `_refreshMonitorCache()`

Remove the field declaration:
```js
_cachedMonitors = null;
```

Remove the method:
```js
_refreshMonitorCache() { ... }
```

### Step 4 — Restore `_targetMonitor()`

```js
// Replace:
const connector = pickMonitorConnector(
  this._cachedMonitors ?? [],
  ...
);

// With:
const connector = pickMonitorConnector(
  monitorManager.get_monitors().map((m) => ({
    vendor: m.get_vendor() ?? "",
    product: m.get_product() ?? "",
    serial: m.get_serial() ?? "",
    connector: m.get_connector(),
  })),
  ...
);
```

Also change the constructor call from `this._refreshMonitorCache()` back to
`this._updatePosition()`.

### Step 5 — Restore `_saveDraggedPosition()`

```js
// Replace:
const monitors = this._cachedMonitors ?? [];
const dropped = monitors.find(
  (m) => monitorManager.get_monitor_for_connector(m.connector) === monitor.index,
);
if (dropped) {
  batch.set_string("monitor-connector", dropped.connector);
  batch.set_string("monitor-name", dropped.name ?? "");
  batch.set_value("monitor-id", new GLib.Variant("(sss)", [
    dropped.vendor, dropped.product, dropped.serial,
  ]));
}

// With:
const dropped = monitorManager.get_monitors().find(
  (m) => monitorManager.get_monitor_for_connector(m.get_connector()) === monitor.index,
);
if (dropped) {
  batch.set_string("monitor-connector", dropped.get_connector());
  batch.set_string("monitor-name", dropped.get_display_name() ?? "");
  batch.set_value("monitor-id", new GLib.Variant("(sss)", [
    dropped.get_vendor() ?? "",
    dropped.get_product() ?? "",
    dropped.get_serial() ?? "",
  ]));
}
```

Also change the `monitors-changed` handler back to `() => this._updatePosition()`.

### Step 6 — Delete this file and remove it from `.gitignore`

```bash
rm COMPAT_NOTES.md
# then remove the COMPAT_NOTES.md line from .gitignore
```

---

## References

- Mutter GNOME 48 private header: `src/backends/meta-monitor-manager-private.h`
- Mutter GNOME 49 public header: `src/meta/meta-monitor-manager.h`
- GitLab: https://gitlab.gnome.org/GNOME/mutter
