import { transform, geometryPatch, validateShapes } from '../core/layout.js';
import { validateStyle } from '../core/format.js';
import { adjustShapes } from '../core/shape.js';
import { textPatches, textCopies, marginKeys } from '../core/text.js';

// Office proxies stay within their PowerPoint.run context. Only plain data leaves it.
// Restrict the MVP to simple shapes; groups, tables, charts, pictures and lines
// need separate formatting/geometry contracts before they can be supported.
const supported = new Set(['GeometricShape', 'TextBox']);
const properties = ['id', 'name', 'type', 'left', 'top', 'width', 'height'];

async function selection(context) {
  const shapes = context.presentation.getSelectedShapes();
  const slides = context.presentation.getSelectedSlides();
  context.presentation.load('id');
  shapes.load(properties.map(p => `items/${p}`).join(','));
  slides.load('items/id');
  await context.sync();
  if (slides.items.length !== 1) throw new Error('Select shapes on a single slide in Normal view.');
  return {
    proxies: shapes.items,
    slide: slides.items[0],
    scope: `${context.presentation.id}:${slides.items[0].id}`,
    shapes: shapes.items.map(s => Object.fromEntries(properties.map(key => [key, s[key]]))),
  };
}

function assertSupported(shapes) {
  validateShapes(shapes);
  const bad = shapes.find(s => !supported.has(s.type));
  if (bad) throw new Error(`“${bad.name}” is a ${bad.type}. This version supports text boxes and AutoShapes. Ungroup shapes first.`);
}

function assertSelection(current, expected) {
  if (!expected || current.scope !== expected.scope ||
      current.shapes.map(s => s.id).sort().join('|') !== expected.shapes.map(s => s.id).sort().join('|')) {
    throw new Error('Your selection changed. Refresh the selection, then try again.');
  }
}

function hexColor(value) {
  if (typeof value !== 'string') throw new Error('Mixed colors cannot be captured.');
  const candidate = value.startsWith('#') ? value : `#${value}`;
  if (/^#[0-9a-f]{6}$/i.test(candidate)) return candidate;
  // Office can return CSS names. Resolve in the task pane without trusting HTML.
  if (globalThis.document && CSS.supports('color', value)) {
    const canvas = document.createElement('canvas').getContext('2d');
    canvas.fillStyle = value;
    if (/^#[0-9a-f]{6}$/i.test(canvas.fillStyle)) return canvas.fillStyle;
  }
  throw new Error('This color cannot be captured as a solid RGB color.');
}

export class PowerPointAdapter {
  constructor(runtime = globalThis.PowerPoint, supports = version => globalThis.Office?.context.requirements.isSetSupported('PowerPointApi', version) ?? false) {
    this.runtime = runtime; this.expected = null; this.supports = supports;
  }
  async readSelection() {
    return this.runtime.run(async context => {
      const { scope, shapes } = await selection(context);
      this.expected = { scope, shapes };
      return this.expected;
    });
  }
  async execute(command, options) {
    await this.runtime.run(async context => {
      const current = await selection(context);
      assertSelection(current, this.expected);
      assertSupported(current.shapes);
      if (command === 'shape') {
        if (!this.supports('1.10')) throw new Error('Shape adjustments need a PowerPoint version that supports these tools. Update PowerPoint to enable them.');
        for (const s of current.proxies) { s.adjustments.load('count'); s.load('rotation'); }
        await context.sync();
        const values = current.proxies.map(s => Array.from({length:s.adjustments.count},(_,i)=>s.adjustments.get(i)));
        await context.sync();
        const source = current.shapes.map((s,i)=>({...s,rotation:current.proxies[i].rotation,adjustments:values[i].map(v=>v.value)}));
        const next = adjustShapes(source, options.action, options);
        // Validate the complete selection before queuing geometry or handle edits.
        next.forEach((s,i)=> {
          const proxy = current.proxies[i];
          Object.assign(proxy, geometryPatch(source[i],s));
          s.adjustments.forEach((value,j)=> {if (Math.abs(value-source[i].adjustments[j]) > 1e-8) proxy.adjustments.set(j,value);});
        });
      } else if (command === 'text') {
        const advanced = ['numbering','indent','outdent'];
        if (advanced.includes(options.action) && !this.supports('1.10')) throw new Error('This paragraph tool needs a newer PowerPoint version.');
        if (['split','merge'].includes(options.action)) {
          const style = validateStyle(options.style);
          for (const s of current.proxies) s.textFrame.textRange.load('text');
          await context.sync();
          const copies = textCopies(current.shapes.map((s,i)=>({...s,text:current.proxies[i].textFrame.textRange.text})),options.action,{...options,fontSize:style.fontSize});
          const created = copies.map(copy=> {
            const shape = current.slide.shapes.addTextBox(copy.text, {left:copy.left,top:copy.top,width:copy.width,height:copy.height});
            shape.name = copy.name;
            const font = shape.textFrame.textRange.font;
            for (const [key,target] of [['font','name'],['fontSize','size'],['fontColor','color'],['bold','bold']]) if (style[key] !== undefined) font[target] = style[key];
            shape.textFrame.wordWrap = true;
            shape.textFrame.autoSizeSetting = 'AutoSizeShapeToFitText';
            shape.load('id');
            return shape;
          });
          await context.sync();
          if (this.supports('1.6')) current.slide.setSelectedShapes(created.map(s=>s.id));
        } else {
          const needsFrame = ['wrap','margin-increase','margin-decrease'].includes(options.action);
          const needsIndent = ['indent','outdent'].includes(options.action);
          for (const s of current.proxies) {
            if (needsFrame) s.textFrame.load([...marginKeys,'wordWrap'].join(','));
            if (needsIndent) s.textFrame.textRange.paragraphFormat.load('indentLevel');
          }
          if (needsFrame || needsIndent) await context.sync();
          const source = current.shapes.map((s,i)=>({...s,
            textFrame:needsFrame ? Object.fromEntries([...marginKeys,'wordWrap'].map(k=>[k,current.proxies[i].textFrame[k]])) : {},
            paragraph:needsIndent ? {indentLevel:current.proxies[i].textFrame.textRange.paragraphFormat.indentLevel} : {},
          }));
          const patches = textPatches(source,options.action,options);
          patches.forEach((patch,i)=> {
            const frame = current.proxies[i].textFrame;
            Object.assign(frame,patch.frame);
            const paragraph = frame.textRange.paragraphFormat;
            for (const [key,value] of Object.entries(patch.paragraph || {})) {
              if (key === 'bullet') {
                // Setting visible last can reset numbered lists to plain bullets
                // in PowerPoint for Mac. Establish visibility before their type.
                paragraph.bulletFormat.visible = value !== 'None';
                if (this.supports('1.10')) {
                  paragraph.bulletFormat.type = value;
                  if (value === 'Numbered') paragraph.bulletFormat.style = 'ArabicNumeralPeriod';
                }
              } else paragraph[key] = value;
            }
          });
        }
      } else if (command === 'format') {
        const style = validateStyle(options.style);
        for (const shape of current.proxies) {
          if (style.fill !== undefined) shape.fill.setSolidColor(style.fill);
          if (style.line !== undefined) shape.lineFormat.color = style.line;
          if (style.lineWidth !== undefined) {
            shape.lineFormat.visible = style.lineWidth > 0;
            if (style.lineWidth > 0) shape.lineFormat.weight = style.lineWidth;
          }
          if (Object.keys(style).some(k => ['font', 'fontSize', 'fontColor', 'bold'].includes(k))) {
            const font = shape.textFrame.textRange.font;
            if (style.font !== undefined) font.name = style.font;
            if (style.fontSize !== undefined) font.size = style.fontSize;
            if (style.fontColor !== undefined) font.color = style.fontColor;
            if (style.bold !== undefined) font.bold = style.bold;
          }
        }
      } else {
        const updated = transform(current.shapes, command, options);
        for (let i = 0; i < updated.length; i++) {
          const patch = geometryPatch(current.shapes[i], updated[i]);
          for (const [key, value] of Object.entries(patch)) current.proxies[i][key] = value;
        }
      }
      // Queue writes only after validation. Office batches aren't guaranteed to
      // be transactional: use PowerPoint Undo if the host reports a write error.
      await context.sync();
    });
  }
  async capture(id) {
    return this.runtime.run(async context => {
      const current = await selection(context);
      assertSelection(current, this.expected);
      const index = current.shapes.findIndex(s => s.id === id);
      if (index < 0) throw new Error('Choose a reference shape.');
      assertSupported([current.shapes[index]]);
      const source = current.proxies[index];
      source.fill.load('type,foregroundColor,transparency');
      source.lineFormat.load('color,weight,visible,transparency,dashStyle,style');
      source.textFrame.textRange.font.load('name,size,color,bold');
      await context.sync();
      const fill = source.fill, line = source.lineFormat, font = source.textFrame.textRange.font;
      if (fill.type !== 'Solid' || fill.transparency !== 0 || line.transparency !== 0 ||
          line.visible !== true || line.dashStyle !== 'Solid' || line.style !== 'Single') {
        throw new Error('Capture supports opaque solid fills and visible, solid, single outlines. Set custom values below for other shapes.');
      }
      return validateStyle({ fill: hexColor(fill.foregroundColor), line: hexColor(line.color), lineWidth: line.weight,
        font: font.name, fontSize: font.size, fontColor: hexColor(font.color), bold: font.bold });
    });
  }
}
