#!/bin/sh
# Packs this folder as a .vsix and installs it into the newest VS Code server that `code serve-web` downloaded.
# serve-web has no extensions-folder option, and its server ignores extension folders that weren't installed.
set -eu

here=$(cd "$(dirname "$0")" && pwd)
server=$(ls -td "$HOME"/.vscode/cli/serve-web/*/ 2>/dev/null | head -n 1)
if [ -z "$server" ]; then
  echo "No VS Code server yet: open the Code view once so serve-web downloads it, then run this again." >&2
  exit 1
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
mkdir "$work/extension"
cp "$here/package.json" "$here/extension.js" "$work/extension/"
cat > "$work/[Content_Types].xml" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension=".json" ContentType="application/json"/>
  <Default Extension=".js" ContentType="application/javascript"/>
  <Default Extension=".vsixmanifest" ContentType="text/xml"/>
</Types>
XML
cat > "$work/extension.vsixmanifest" <<'XML'
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="reveal-in-finder" Version="1.0.0" Publisher="voice-orchestrator"/>
    <DisplayName>Reveal in Finder (Code view)</DisplayName>
    <Description xml:space="preserve">Reveal in Finder for the Code view's browser VS Code.</Description>
  </Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation>
  <Dependencies/>
  <Assets><Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/></Assets>
</PackageManifest>
XML
(cd "$work" && zip -qr reveal-in-finder.vsix "[Content_Types].xml" extension.vsixmanifest extension)
"$server/bin/code-server" --install-extension "$work/reveal-in-finder.vsix" --force
