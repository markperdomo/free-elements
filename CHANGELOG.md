# Changelog

## 0.2.2 — 2026-09-28 (prerelease)

- Portable macOS packaging using Office's shared add-ins location instead of a developer's home directory.
- Universal Apple Silicon/Intel installer, versioned native bundle, and release checksums.
- Palette attachment to PowerPoint's right edge, with a toggle for floating mode.
- Home ribbon labeled **Free Elements**, with the FE icon embedded in the PPAM.
- Public installation/tool guides, MIT license, contribution templates, CI, and release instructions.
- Build metadata checks exported VBA library paths and native source hashes before packaging.

The editing engine is based on the locally validated 0.2.1 implementation. The installer is unsigned/unnotarized. Live Intel testing and broader PowerPoint/macOS coverage are still needed.

## 0.2.1 — 2026-09-28 (local development)

- Native VBA/AppKit tools for position, spacing, size, shape, format, and text.
- Lazy palette opening, callback cleanup, modal guards, and local format presets.
- Installed engine passed 44 host assertions twice, including after reload, on Apple Silicon PowerPoint 16.113.2.

## 0.1.0 — 2026-09-27 (prototype)

- Dependency-free browser playground and experimental Office.js adapter with layout, formatting, shape, and text tools.
