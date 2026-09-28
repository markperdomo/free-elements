# Browser playground and Office.js prototype


After following the [development installation guide](INSTALLATION.md), keep `npm run start:office` running, open a presentation in PowerPoint, and choose **Home → Free Elements**. Select unrotated AutoShapes/text boxes on one slide and choose your reference shape. See [installation instructions](INSTALLATION.md) to reproduce the setup or activate the ribbon on a fresh profile.

Requires Node.js 20 or newer. There are no npm dependencies to install.

```sh
npm start
```

Open [the playground](http://localhost:4317). Four shapes start selected. Use **Match width and height**, **Align top**, then **Equal horizontal gaps** for a quick cleanup. Hover over an icon for its name, or turn on **Labels** at the bottom of the palette. Choose the reference shape in the **Ref** list. Click a shape to select it, Shift-click to add/remove shapes, or expand **Objects on the slide** for checkboxes. Drag a selected shape to move the selection.

```sh
npm test
```

## Implemented

- Six alignment directions, relative to a chosen shape or selection bounds.
- Equal horizontal/vertical gaps; fixed spacing; zero-gap stacking.
- Match width, height, or both, keeping centers or top-left corners fixed.
- Swap two shape centers and arrange selections in a grid.
- Shape tools: match arrow angles, form a chevron process chain, copy adjustment proportions, set right-arrow head/shaft dimensions, and apply a constant corner radius to rounded rectangles. Choose the actual shape kind in the Shape section.
- Text tools: four independent margins, margin increments, wrapping, shape/text autofit, paragraph alignment, bullets, numbering, and indentation.
- Split paragraphs into editable text-box copies or merge selected text into one copy. Originals are preserved; copies use the current Format font settings and merge in top-to-bottom/left-to-right order.
- Apply fill, outline, and text settings independently.
- Capture a simple reference format; save, load, and delete local presets.
- Playground selection, dragging, undo/redo, and SVG export.
- PowerPoint selection reads, shape geometry writes, basic formatting, explicit reference selection, capability checking, and selection-change protection.
- Home ribbon launch button, Mac manifest sideload/uninstall helper, localhost HTTPS setup, and a reproducible static package inspector.
- Compact icon palette with tooltips, optional labels, inline reference/spacing controls, and expandable settings. Including Shape and Text, primary controls occupy about 500 pixels vertically; the PowerPoint pane requests the Mac minimum width of 270 pixels on supported hosts.
- Laptop playground with a 208-pixel toolbar and a 16:9 slide that fits the remaining viewport in both dimensions. The object list expands on demand.
- A reproducible test deck that activates the installed development add-in when opened in PowerPoint.

Use the playground's example list to try chevrons, arrows, rounded corners, or multiline text. Shape adjustments and advanced paragraph tools require PowerPointApi 1.10 and are disabled on older hosts; they work in the installed Mac build. The shape-kind selector is explicit because Office.js does not expose the AutoShape preset name. This release does not implement EE's pentagon-header fitting, cursor-based splitting, language shortcuts, or rich-format text merging. See [tool help](http://localhost:4317/help.html) for exact behavior.
