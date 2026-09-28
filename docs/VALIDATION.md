# Validation record

## Prerelease 0.2.2 — September 28, 2026

This is a testing prerelease. Automated checks and package inspection do not establish compatibility with every PowerPoint or macOS version.

- **38 JavaScript tests** cover layout, formatting, Shape/Text operations, capability checks, mocked PowerPoint writes, and static-server boundaries. Layout coverage includes 150 deterministic randomized geometry cases within one test.
- **14 Python tests** cover native packaging, installer release gates, and source archive boundaries. Source archives require the Git index to match the reviewed public-file list; extra tracked files, missing files, symlinks, and packaged binaries are rejected.
- **59 Swift attachment-layout cases** cover movement, resizing, and displays with negative coordinates.
- [GitHub CI](https://github.com/markperdomo/free-elements/actions/workflows/ci.yml) runs the source suites on Linux and universal native compilation, signature checks, and attachment geometry on macOS.
- PowerPoint exported the distribution PPAM using the shared installation path. Its active VBA modules are `FreeElements` and `FEEvents`; packaging preserves the compiled VBA bytes.
- The arm64/x86_64 bundle compiled and passed strict ad-hoc signature verification. This is not Developer ID signing or notarization.
- The installer was expanded and inspected without installation. Checks covered the fixed Office add-ins destination, disabled bundle relocation, preinstall script, license and installation guide, payload hashes, and extracted native signature. The preinstall script refuses installation while PowerPoint is running and fails closed if process inspection fails.
- The public source archive contains only the reviewed distribution files. Source documentation was updated after the initial publication; the native installer was not changed by that update.

**Still unverified for this package:** administrator installation into the shared destination on a clean Mac/account; live Intel execution; the new attachment mode inside PowerPoint; broader Office/macOS versions; and notarized-download behavior. See [Mac installation](MAC_INSTALL.md) for requirements and unsigned-package handling.

## Earlier native host checks — 0.2.1

On Apple Silicon with PowerPoint for Mac 16.113.2 (LTSC 2024), the installed per-user 0.2.1 engine passed **44 assertions with no failures**, then passed again after unloading and reloading the add-in. The harness invoked the installed PPAM through qualified `Application.Run` calls. Coverage included geometry, reference membership, formatting, text operations, editable copies, shape adjustments, presets, and validation before edits.

An earlier native-button check aligned two right arrows to x=50 points; PowerPoint Undo restored their original x positions of 50 and 350 points. Saved OOXML independently confirmed the changes and Undo result.

A PowerPoint freeze occurred during an earlier development session; its cause remains unconfirmed. No freeze was observed in the later installed-engine test session. Direct palette close/reopen behavior and preset persistence through the palette still need final host checks. These earlier results do not establish the new 0.2.2 installation path or attachment mode.

## Office.js and browser checks

The experimental web implementation was tested separately on PowerPoint for Mac 16.113.2 and in a browser:

- Matching sizes, top alignment, and equal gaps produced four shapes at x=70/292/514/736, y=205, size=172×110 points. Saved PowerPoint XML confirmed the geometry.
- Fill-only formatting preserved text, geometry, and outlines; a native Undo restored the fills. Outline/text-only formatting preserved fills.
- Process-chain, physical arrowhead depth, and rounded-corner radius checks matched saved geometry within 0.002 points.
- Text margins, numbering, and editable paragraph split/merge copies were inspected in saved presentations. Source shapes remained present; Undo removed a merged copy.
- Browser checks covered format persistence, Undo/Redo, negative-value errors, compact layouts, and controls at narrow viewport sizes.
- Microsoft's manifest validator accepted the development manifest. The pane and Home ribbon command loaded through the documented development test-document mechanism.

Mocked API tests verify adapter behavior, not Office runtime semantics. Browser text fitting approximates layout; PowerPoint performs its own text layout.

## Remaining coverage

Further work includes all command variants in the live native host, unsupported selections and complex shapes, save/close/reopen fidelity, Undo grouping across commands, preset persistence through the actual palette, other CPU/Office/macOS combinations, and organization policy restrictions. Groups, rotated bounds, rich-format copying, caret-position splitting, and complete PPTX import/export are outside the current feature scope.
