# Running and installing Free Elements

For the VBA/AppKit version that runs without Node, use the [native instructions and delivery status](NATIVE.md). The instructions below are for the experimental Office.js implementation.

## Browser playground — available now

From this project directory:

```sh
npm start
```

Open [http://localhost:4317](http://localhost:4317). This mode requires no PowerPoint, Office account, or certificates. It edits the sample slide only. The server listens on loopback, not the local network. Stop it with Ctrl+C.

## PowerPoint for Mac — development sideload

The task pane and Home ribbon button work in PowerPoint for Mac 16.113.2 (LTSC 2024). Live shape edits and native Undo have been checked; see the [validation record](VALIDATION.md). You need an editable PowerPoint environment supporting PowerPointApi 1.5. The manifest allows the pane to load on API 1.1 hosts so the runtime can explain missing capabilities; editing remains gated on API 1.5. Microsoft's [requirement-set matrix](https://learn.microsoft.com/en-us/javascript/api/requirement-sets/powerpoint/powerpoint-api-requirement-sets) lists version support.

1. Create a development certificate:

   ```sh
   npm run cert
   ```

   The generated certificate is for `localhost` and `127.0.0.1`, valid for one year. Its key stays in `.certs`, excluded from Git. The script does not modify the Keychain or any trust settings, and refuses to overwrite an existing pair.

2. For Office to accept HTTPS, import `.certs/localhost.crt` into your login Keychain using Keychain Access and trust that specific development certificate for SSL. This is a local setup step you perform intentionally; the project does not change system-wide certificate trust or disable certificate validation. If you already have a trusted localhost certificate, place its PEM certificate/key at `.certs/localhost.crt` and `.certs/localhost.key` instead.

3. Start the HTTPS server and leave it running:

   ```sh
   npm run start:office
   ```

   The manifest uses `https://localhost:3443`. Changing the server port also requires changing the URLs in `public/manifest.xml` and re-sideloading.

4. Preview the manifest installation, then copy it:

   ```sh
   npm run sideload -- --dry-run
   npm run sideload
   ```

   This writes just this file:

   ```text
   ~/Library/Containers/com.microsoft.Powerpoint/Data/Documents/wef/free-elements.xml
   ```

   The helper refuses to overwrite a manifest belonging to another add-in. It checks standard application locations for PowerPoint before installing; nonstandard installations can copy the XML manually.

   If macOS denies terminal access to the Office container, the helper stages `dist/sideload/free-elements.xml` and prints Finder instructions. You can also prepare this file with `npm run sideload -- --stage`. Copy it in Finder, using Cmd+Shift+G to reach the destination folder. Replace only Free Elements' existing manifest. No Full Disk Access change is required.

5. Restart PowerPoint, open a disposable presentation, then choose **Home → Add-ins → Free Elements**. Once activated, use the dedicated **Home → Free Elements** button. Exact menu placement can vary by Office version. Use the documented [Mac sideloading procedure](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-an-office-add-in-on-mac) if the add-in is not listed.

6. If the Developer Add-ins entry is disabled, activate the already-sideloaded add-in through its test document:

   ```sh
   npm run host:test
   ```

   In Finder, right-click `dist/powerpoint-smoke-with-addin.pptx` and choose **Open With → Microsoft PowerPoint**. This matters if another application handles `.pptx` files by default. The deck contains four test shapes plus a development add-in reference, following [Microsoft's test-document pattern](https://github.com/OfficeDev/Office-Addin-Scripts/tree/master/packages/office-addin-dev-settings/templates). It loads Free Elements and activates its Home ribbon button. This succeeded on the local Mac; the ribbon then opened the pane in an ordinary presentation too. The script refuses to overwrite an existing test deck unless explicitly passed `--force`.

Office.js is loaded from Microsoft's official CDN, so a PowerPoint session needs access to that runtime. The playground has no external runtime dependency. The app contains no backend or telemetry; it edits the open document through Office's API and saves presets to local origin storage.

The compact palette uses small icon rows. Hover to identify a tool, or enable **Labels** at the bottom. Expand **Saved formats** only when needed. On hosts supporting TaskPaneApi 1.1, the pane requests a width of 270 pixels, the documented [Mac minimum](https://learn.microsoft.com/en-us/javascript/api/office/office.taskpane). Older hosts retain manual resizing and the same compact controls. To load an interface update, close the pane and reopen it with the Home ribbon button; the manifest does not need to be reinstalled for HTML/CSS changes.

The add-in manifest version begins at `1.0.0.0`, as required by Microsoft's validator. The application's version is tracked separately in `package.json`.

## Remove the development add-in

```sh
npm run sideload -- --remove --dry-run
npm run sideload -- --remove
```

Restart PowerPoint and stop the local server. If Office still displays a cached entry, follow Microsoft's cache-removal guidance linked from the Mac sideloading page. Do not delete unrelated manifests. Remove the specific Free Elements development certificate from your login Keychain when you no longer need it; the helper does not alter trust settings. Presets are retained unless separately removed from the application's storage.

## Real-host acceptance checklist

Use a new presentation and save it before testing:

`tests/fixtures/powerpoint-smoke.pptx` provides four editable, unrotated rectangles for these checks. Work on a disposable copy.

- Load the pane, confirm PowerPoint mode, and verify unsupported hosts show an actionable error.
- Create three or four unrotated AutoShapes/text boxes with different sizes and positions; verify selection refresh and the explicit reference dropdown.
- Align all six ways, using both reference and selection bounds. Confirm the reference and unrelated axis remain unchanged.
- Check equal-gap spacing with unequal widths/heights and fixed-spacing behavior with overlapping shapes.
- Match sizes with center and top-left anchors; check that width-only sizing behaves predictably for the shapes used.
- Verify swapping exactly two shapes and grid ordering.
- Apply fill-only, outline-only, and text-only formats. Verify content, unrelated formatting, and shape IDs remain intact.
- Capture an opaque solid simple format, save/load it, and reopen the pane to check persistence.
- Try a changed selection, multi-slide selection, groups, pictures, lines, gradients, and mixed-font capture. Verify unsupported operations produce a clear error without intentionally queuing edits.
- Exercise PowerPoint Undo after each kind of operation and record how Office groups changes. Save, close, and reopen the presentation to verify persistence and text fidelity.
- Test signed-in Mac Office on both CPU architectures before distributing a native component; test Windows/web separately before claiming cross-platform compatibility.

The initial live smoke checks pass; the full checklist remains broader than those checks. See the validation record for completed items. Browser and mocked-adapter tests alone do not establish host compatibility.
