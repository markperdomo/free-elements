# Native development

For ordinary installation, use the [Mac installation guide](MAC_INSTALL.md). This page covers building from source. The native add-in combines VBA with a compact Swift/AppKit palette inside PowerPoint's process. It has no web runtime or helper application.

## Requirements

- macOS 12+ and a compatible desktop PowerPoint for Mac with VBA.
- Xcode command-line tools (`xcrun swiftc`, `lipo`, `codesign`).
- Python 3.10+. No third-party Python dependencies are required for building/packaging.
- Node.js 20+ only for the separate web playground and tests.

## Local build

```sh
python3 scripts/build-native.py
```

This builds `dist/native/FreeElements-0.2.2.bundle` for arm64 and x86_64, ad-hoc signs it, records source checksums in `native-build.json`, and generates imports under `dist/native/vba/`. Local generated VBA uses the current user's absolute Office-container path. A per-user PPAM is only for that user's development installation.

To choose another output directory, pass `--output-dir`. `--arch arm64` or `--arch x86_64` is useful for local iteration. Public installer builds require both architectures.

## Compile VBA in PowerPoint

1. Create a **new, empty presentation**. In **Tools → Macro → Visual Basic Editor**, select that presentation's project.
2. Use **File → Import File** to import `FEEvents.cls` and `FreeElements.bas` from the generated `vba` directory. Import both into the same project. Do not import tests or probe modules into a release project.
3. Save as `FreeElements-source.pptm` using **PowerPoint Macro-Enabled Presentation**.
4. Use **File → Export → PowerPoint Add-In (.ppam)** to export `FreeElements-base.ppam` beside the bundle.

Use PowerPoint's normal editor; programmatic VBA-project access is not required. This Mac PowerPoint build rejects numeric format 30 in `SaveCopyAs`, so use the Export UI instead. A renamed PPTM is not a PPAM.

```sh
python3 scripts/package-native.py
python3 scripts/install-native.py          # preview
python3 scripts/install-native.py --install
```

If macOS blocks Terminal from the Office container, copy the staged files with Finder. The destination is:

```text
~/Library/Group Containers/UBF8T346G9.Office/Free Elements/Program/
```

Load the PPAM using **Tools → PowerPoint Add-ins → +**, then open **Home → Free Elements**. Do not register both the local and shared distribution versions at the same time.

## Portable distribution build

```sh
python3 scripts/build-native.py --distribution --output-dir dist/distribution
```

Use the generated imports in `dist/distribution/vba`, then export a fresh `dist/distribution/FreeElements-base.ppam`. These declarations use the fixed shared installation path documented in [MAC_INSTALL.md](MAC_INSTALL.md).

```sh
python3 scripts/package-native.py \
  --input dist/distribution/FreeElements-base.ppam \
  --output dist/distribution/FreeElements.ppam \
  --build-dir dist/distribution
python3 scripts/package-installer.py
```

The resulting `.pkg` and checksum are under `dist/github`. The package contains the PPAM, universal versioned bundle, build manifest, license, and installation guide. Packaging verifies the compiled library path, source checksums, payload checksums, and native architecture/signature. It preserves `vbaProject.bin` byte for byte and adds the project ribbon and FE icon. See [RELEASING.md](RELEASING.md) for publication/signing.

## Tests

```sh
npm test
python3 -m unittest discover -s native/tests -p 'test_*.py'
xcrun swiftc -module-cache-path dist/native/module-cache \
  native/macos/FreeElements.swift native/tests/AttachmentLayoutTests.swift \
  -o dist/native/attachment-tests
dist/native/attachment-tests
```

For host checks, import `FENativeTests.bas` into a development presentation containing the core modules, then run `FERunNativeTests`. To test an installed add-in, import generated `FEInstalledTests.bas` into a separate empty presentation and run `FERunInstalledTests`. It invokes the loaded PPAM through `Application.Run`. Reports and editable test decks use timestamped names under the build directory.

The 0.2.1 engine passed 44 assertions twice on Apple Silicon PowerPoint 16.113.2, including after unload/reload. That record does not establish a new binary's compatibility on every Mac. [VALIDATION.md](VALIDATION.md) separates automated, earlier host, and release checks.

## Lifecycle

Never overwrite a loaded native bundle. Unload the add-in and quit PowerPoint before replacing files; use a new bundle version for code changes. Selection events do not call the native library before the palette opens. Add-in unload, presentation close, and palette close clear callbacks. Close the palette before resetting or editing VBA; reopen it to register a fresh callback.

The native palette can attach to the right side of PowerPoint or float using the control beside Pin. Attachment overlays the window; it does not resize PowerPoint's slide workspace. Native presets use the `org.freeelements.palette` preferences suite, separate from web presets.

Mac PowerPoint does not expose `StartNewUndoEntry` in its VBA type library. The engine attempts it late-bound only where supported. Confirm actual Undo behavior in the host rather than relying on the Windows API contract.
