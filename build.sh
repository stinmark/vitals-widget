#!/usr/bin/env bash

set -e

# Configuration
UUID="vitalsWidget@ctrln3rd.github.com"
SCHEMA_NAME="org.gnome.shell.extensions.vitalsWidget.gschema.xml"
BUILD_DIR="build"
ZIP_NAME="${UUID}.zip"

echo "==> Cleaning old build artifacts..."
rm -rf "${BUILD_DIR}" "${ZIP_NAME}"

echo "==> Compiling GSettings GLib schemas..."
if [ -d "schemas" ]; then
    glib-compile-schemas schemas/
fi

echo "==> Creating temporary build directory..."
mkdir -p "${BUILD_DIR}"

echo "==> Copying extension files..."
# Copy root extension files
cp -r metadata.json extension.js prefs.js config.js icons.js ring.js vitals.js stylesheet.css "${BUILD_DIR}/"

# Copy subdirectories required by the runtime
cp -r prefs sensors schemas "${BUILD_DIR}/"

# Optional: include LICENSE if present
if [ -f "LICENSE" ]; then
    cp LICENSE "${BUILD_DIR}/"
fi

echo "==> Creating release ZIP package (${ZIP_NAME})..."
(cd "${BUILD_DIR}" && zip -r "../${ZIP_NAME}" .)

echo "==> Cleaning up temporary build directory..."
rm -rf "${BUILD_DIR}"

echo "==> Build complete! Package generated: ${ZIP_NAME}"
