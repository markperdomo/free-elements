# Release checklist

`package.json` is the version source for native bundles, installers, and source archives. Do not reuse a version for changed native code once it has been published or loaded into a host under test.

## Build and validate

1. Update `package.json`, `CHANGELOG.md`, and versioned download links together.
2. Run `npm test` and `python3 -m unittest discover -s native/tests -p 'test_*.py'`.
3. Build universal native code with `python3 scripts/build-native.py --distribution --output-dir dist/distribution`.
4. Import only generated `FEEvents.cls` and `FreeElements.bas` into an empty PowerPoint project. Save its editable PPTM and use File → Export → PowerPoint Add-In to create `dist/distribution/FreeElements-base.ppam`. Do not ship test/probe/helper modules.
5. Package the ribbon and payload:

   ```sh
   python3 scripts/package-native.py \
     --input dist/distribution/FreeElements-base.ppam \
     --output dist/distribution/FreeElements.ppam \
     --build-dir dist/distribution
   python3 scripts/package-installer.py
   ```

6. Expand the `.pkg` with `pkgutil --expand-full` into a fresh temporary directory. Verify the installation location, non-relocatable bundle, preinstall script, file list, checksums, and signature. Test installation on a clean Mac/account when available and state any untested combinations in release notes.
7. Test the actual PPAM in PowerPoint: opening/closing the palette, attachment/floating, changing presentations, a geometry command plus Undo, saved presets, and unload/reload. Run the installed-engine harness where possible. Do not substitute mocked tests for host validation.
8. Review any new public files and update `scripts/public-files.json` explicitly, then audit staged source with `python3 scripts/package-source.py --check`. The Git index must match that reviewed file list exactly. Research, vendor packages, certificates/keys, user decks, module caches, and generated native binaries must stay excluded. `tests/fixtures/powerpoint-smoke.pptx` is a synthetic test fixture.
9. Commit the reviewed source, run CI, tag `v<version>`, and create the source archive with `python3 scripts/package-source.py`. Build on a clean checkout for release reproducibility.

The VBA compiler/export step needs desktop PowerPoint and remains manual. CI builds the universal Swift bundle and runs the automated suites; it does not fabricate `vbaProject.bin` or claim a headless PowerPoint test.

## Signing and notarization

Unsigned local builds use an ad-hoc signature and must be labeled **unsigned / unnotarized prerelease**. SHA-256 is an integrity check, not a publisher identity. Do not add quarantine-removal or global security-disable commands to the installer.

For a signed release, configure your own Apple Developer credentials outside the repository:

```sh
python3 scripts/build-native.py --distribution --output-dir dist/distribution \
  --sign-identity 'Developer ID Application: YOUR NAME (TEAMID)'
# Export/package the matching PPAM as above, then:
python3 scripts/package-installer.py \
  --sign-identity 'Developer ID Installer: YOUR NAME (TEAMID)'
xcrun notarytool submit dist/github/FreeElements-VERSION-macOS.pkg \
  --keychain-profile YOUR_NOTARY_PROFILE --wait
xcrun stapler staple dist/github/FreeElements-VERSION-macOS.pkg
xcrun stapler validate dist/github/FreeElements-VERSION-macOS.pkg
spctl --assess --type install --verbose dist/github/FreeElements-VERSION-macOS.pkg
```

Replace placeholders. Recompute the `.pkg.sha256` **after stapling**, because stapling changes the file. Signing/notarization must pass before claiming either in the public release. Follow Apple's current [notarization guidance](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution).

## Publish on GitHub

Publish the audited source under `markperdomo/free-elements`, with a short PowerPoint/Mac description and relevant repository topics. Enable issues and private vulnerability reporting. Mark early releases as prereleases and link the installation guide from the release notes.

Upload only the final `FreeElements-<version>-macOS.pkg`, its `.sha256`, the source ZIP, and its `.sha256`. Do not attach older `dist/native` ZIPs: they contain per-user development builds. Verify the uploaded checksums and that repository/release links are public after publishing.
