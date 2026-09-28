# Tool guide

Open **Home → Free Elements** after loading the add-in. Measurements are in PowerPoint points (72 points = 1 inch). Icons have tooltips and accessibility labels.

The palette attaches just inside PowerPoint's right edge and follows its window. Use the attachment icon beside Pin to switch to floating mode. Attachment overlays the editing area rather than shrinking the slide workspace.

## Reference and selection

The reference can be the first or last shape in the order PowerPoint provides, which is not necessarily click order. For a precise reference, select one shape, click **Pin**, then include it in the larger selection. A pinned shape must belong to the current slide/presentation and remain selected.

Position tools target the reference, selection bounds, or the slide. Size and shape-matching tools use the reference. Select unrotated AutoShapes, text boxes, or supported text placeholders on one slide.

## Position, spacing, and size

- **Position:** align left, center, right, top, middle, or bottom.
- **Spacing:** distribute equal edge-to-edge gaps, apply a fixed Gap, arrange a grid using Cols, or swap the centers of exactly two shapes. A zero fixed gap stacks shapes without space between them.
- **Size:** match width, height, or both. Centers keeps each shape centered in its previous position; Top left preserves its top-left corner.

## Shape

Match point angles or adjustment handles, arrange a chevron chain, set right-arrow head depth/shaft percentage, or apply a physical corner radius. These require matching supported AutoShape types. Set Radius, Arrow head, and Shaft % under **Values & options**.

## Format and presets

Fill, Line, and Text checkboxes choose which properties to apply. The eyedropper captures a simple reference format; the paintbrush applies the checked properties. Colors are explicit RGB values, so theme-color links are not preserved. Text formatting applies across the shape and does not preserve mixed runs for the selected font properties.

Expand **Values & options → Saved formats**, enter a name, and use **+** to save. Choose a preset and **↓** to load its values; then click Apply to change selected shapes. **−** removes a preset. Native presets stay local to the Mac user and do not sync with web-playground presets.

## Text

Use autofit, wrapping, bullets/numbering, indentation, margins, and paragraph alignment. The four margin fields are independent; increment buttons change all four by one point.

**Split** makes editable copies for paragraphs. **Merge** creates a new text box from selected text, ordered top-to-bottom then left-to-right. Both retain the original shapes. Copies use plain text and current Format font values; rich runs, links, and original bullet metadata are not copied. Split operates on paragraphs, not the text cursor position.

## Undo and errors

Click the slide before pressing **⌘Z**. Native Undo grouping has been verified for selected actions, not every host version. Validation rejects unsupported inputs before editing where possible. Unexpected host errors can leave partial edits; inspect the slide and use Undo when needed.
