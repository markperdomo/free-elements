# Install Free Elements on Mac

You need desktop PowerPoint for Mac with VBA, macOS 12+ (or the newer minimum required by your Office version), and an administrator account. The installer includes Apple Silicon and Intel code; live testing has so far used Apple Silicon and PowerPoint 16.113.2.

## Download and install

1. Download `FreeElements-0.2.2-macOS.pkg` from [GitHub Releases](https://github.com/markperdomo/free-elements/releases/tag/v0.2.2). Check its adjacent checksum in Terminal with `shasum -a 256 -c FreeElements-0.2.2-macOS.pkg.sha256` from the download folder.
2. Save your work and quit PowerPoint. The installer refuses to copy files while PowerPoint is running, including in another signed-in user session.
3. Open the package and follow macOS Installer. It installs only Free Elements files in:

   ```text
   /Library/Application Support/Microsoft/Office365/User Content.localized/Add-Ins.localized/Free Elements/Program/
   ```

4. Start PowerPoint. Choose **Tools → PowerPoint Add-ins**, click **+**, press **⌘⇧G**, and paste the folder above. Select `FreeElements.ppam` and ensure it is loaded.
5. Open a presentation and choose **Home → Free Elements**. The green FE ribbon icon opens the palette. Hover over controls for help.

Shared files are installed for all users of this Mac. Each user loads the add-in through their own PowerPoint add-ins manager. The installer does not change macro security, register login items, install a server, or modify other add-ins.

## Unsigned prerelease

The installer is **not Developer ID signed or notarized**. Its native bundle has a local ad-hoc signature, which is not an Apple developer identity. If macOS blocks the download, inspect the source/release and decide whether to trust it. Apple's [instructions for opening software from an unidentified developer](https://support.apple.com/102445) describe approving an individual installer in **System Settings → Privacy & Security → Open Anyway**, when available.

Do not disable Gatekeeper, remove quarantine recursively, or disable PowerPoint's macro protection. If your organization requires signed software, wait for a signed release or ask your administrator to review a source build. Approval of the installer may still be insufficient under a managed Office/macOS policy; report the exact error with your OS and PowerPoint version.

## First use

Work on a copy initially. Select two or more unrotated AutoShapes or text boxes. Choose the reference and try Align top or Match width. Use **⌘Z with the slide focused** to undo. The palette hides when PowerPoint is inactive; reopen it from the ribbon after closing a presentation. See [Tool guide](USAGE.md).

## Updating

Remove/unload the old FreeElements entry in **Tools → PowerPoint Add-ins**, save work, and quit PowerPoint before running a newer installer. Load the new shared `FreeElements.ppam` afterward. Versioned bundles avoid replacing an earlier version's binary. Local format presets are retained.

If you previously built the per-user version under `~/Library/Group Containers/UBF8T346G9.Office/Free Elements/Program`, remove that entry before adding the shared version. Load only one FreeElements PPAM at a time. The separate Office.js prototype may appear as another ribbon button; it is not needed by the native add-in.

## Uninstall

1. Remove/unload **FreeElements** in PowerPoint's add-ins manager, then quit PowerPoint.
2. In Finder, go to the shared folder above and move **only its parent `Free Elements` folder** to Trash. Administrator permission may be required. Leave other Office add-ins in place.

Local presets remain in the `org.freeelements.palette` preferences suite and can be retained for a future reinstall.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Installer says PowerPoint is running | Quit the application, not just its document windows; check other user sessions |
| No ribbon button | Open a presentation and ensure FreeElements is loaded under Tools → PowerPoint Add-ins |
| Native library/file not found | Keep the bundle and PPAM at the installed path; do not run the add-in from Downloads |
| Macro blocked | Keep protection enabled; follow the specific trust prompt only if you trust Free Elements, or consult your administrator |
| Native code blocked | Review the unsigned-prerelease note; source builds and organizational signing are alternatives |
| Command rejects selection | Use supported, unrotated shapes on one slide; pinned references must remain selected |
| Two Free Elements buttons | Remove the old native registration or the optional web prototype |

Include macOS version, CPU architecture, PowerPoint version, exact error text, and reproduction steps in bug reports. Use an anonymized example, not a private presentation.
