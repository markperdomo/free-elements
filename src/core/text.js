import { validateShapes, bounds } from './layout.js';

export const defaultTextFrame = Object.freeze({leftMargin:7.2,rightMargin:7.2,topMargin:3.6,bottomMargin:3.6,wordWrap:true,autoSizeSetting:'AutoSizeNone',verticalAlignment:'Middle'});
export const marginKeys = ['leftMargin','rightMargin','topMargin','bottomMargin'];
export function textPatches(shapes, action, options = {}) {
  validateShapes(shapes);
  const states = shapes.map(s => ({...defaultTextFrame,...s.textFrame}));
  if (action === 'margins') {
    const margins = options.margins;
    if (!margins || marginKeys.some(k => !Number.isFinite(margins[k]) || margins[k] < 0 || margins[k] > 1000)) throw new Error('Each text margin must be between 0 and 1000 points.');
    return shapes.map(() => ({frame:Object.fromEntries(marginKeys.map(k=>[k,margins[k]]))}));
  }
  if (action === 'margin-increase' || action === 'margin-decrease') {
    const delta = action === 'margin-increase' ? 1 : -1;
    return states.map(s => ({frame:Object.fromEntries(marginKeys.map(k => [k,Math.max(0,s[k]+delta)]))}));
  }
  if (action === 'wrap') {
    const wordWrap = !states.every(s => s.wordWrap === true);
    return shapes.map(() => ({frame:{wordWrap}}));
  }
  if (action === 'fit-shape' || action === 'fit-text' || action === 'no-autofit') {
    const autoSizeSetting = {'fit-shape':'AutoSizeShapeToFitText','fit-text':'AutoSizeTextToFitShape','no-autofit':'AutoSizeNone'}[action];
    return shapes.map(() => ({frame:{autoSizeSetting}}));
  }
  if (action === 'bullets' || action === 'numbering' || action === 'no-bullets') {
    return shapes.map(() => ({paragraph:{bullet:action === 'no-bullets' ? 'None' : action === 'numbering' ? 'Numbered' : 'Unnumbered'}}));
  }
  if (action === 'indent' || action === 'outdent') {
    return shapes.map(s => {
      const level = s.paragraph?.indentLevel;
      if (!Number.isInteger(level) || level < 0 || level > 8) throw new Error('Select paragraphs with a single indentation level.');
      return {paragraph:{indentLevel:Math.max(0,Math.min(8,level+(action==='indent'?1:-1)))}};
    });
  }
  if (['text-left','text-center','text-right'].includes(action)) return shapes.map(() => ({paragraph:{horizontalAlignment:{'text-left':'Left','text-center':'Center','text-right':'Right'}[action]}}));
  throw new Error('Unknown text command.');
}

export function applyTextPatches(shapes, patches) {
  return shapes.map((s,i) => ({...s,textFrame:{...defaultTextFrame,...s.textFrame,...patches[i].frame},paragraph:{...s.paragraph,...patches[i].paragraph}}));
}

// Split/merge create editable copies, preserving the originals and their rich
// formatting. The new boxes use the chosen font; no source text is rewritten.
export function textCopies(shapes, action, options = {}) {
  validateShapes(shapes, action === 'merge' ? 2 : 1);
  if (shapes.some(s => typeof s.text !== 'string')) throw new Error('These shapes do not contain readable text.');
  const gap = options.gap ?? 6;
  if (!Number.isFinite(gap) || gap < 0) throw new Error('Gap must be a nonnegative number.');
  const region = bounds(shapes);
  const ordered = [...shapes].sort((a,b)=>a.top-b.top || a.left-b.left || a.id.localeCompare(b.id));
  let chunks;
  if (action === 'merge') chunks = [ordered.map(s=>s.text).filter(Boolean).join('\n')];
  else if (action === 'split') {
    if (shapes.length !== 1) throw new Error('Select one text box to split into paragraph copies.');
    chunks = shapes[0].text.split(/\r\n|\r|\n/);
    if (chunks.length < 2) throw new Error('The selected box needs at least two paragraphs.');
  } else throw new Error('Unknown text copy command.');
  if (!chunks.some(s=>s.trim())) throw new Error('The selected text is empty.');
  if (chunks.length > 100) throw new Error('Split up to 100 paragraphs at a time.');
  const height = Math.max(24,(options.fontSize || 18)*1.4+7.2);
  let top = region.top + 12;
  return chunks.map((text,i)=> {
    const result = {name:`${action === 'merge' ? 'Merged' : 'Paragraph'} ${i+1}`,left:region.left+12,top,width:region.width,height:action==='merge'?Math.max(region.height,height*ordered.length):height,text};
    top += height+gap;
    return result;
  });
}

// Approximate metrics for the SVG playground; PowerPoint does its own layout.
export function previewText(shape) {
  const frame = {...defaultTextFrame,...shape.textFrame};
  const paragraph = {horizontalAlignment:'Center',indentLevel:0,...shape.paragraph};
  const indent = paragraph.indentLevel * 12;
  const width = Math.max(1,shape.width-frame.leftMargin-frame.rightMargin-indent);
  const originalSize = shape.style?.fontSize || 18;
  function linesAt(size) {
    const capacity = Math.max(1,Math.floor(width/(size*.55)));
    return (shape.text || '').split(/\r\n|\r|\n/).flatMap((text,index)=> {
      const prefix = paragraph.bullet === 'Numbered' ? `${index+1}. ` : paragraph.bullet === 'Unnumbered' ? '• ' : '';
      const source = prefix+text;
      if (!frame.wordWrap) return [source];
      const lines = []; let rest = source;
      while (rest.length > capacity) {
        let cut = rest.lastIndexOf(' ',capacity);
        if (cut < 1) cut = capacity;
        lines.push(rest.slice(0,cut)); rest = rest.slice(cut).replace(/^ /,'');
      }
      lines.push(rest); return lines;
    });
  }
  let size = originalSize, lines = linesAt(size);
  if (frame.autoSizeSetting === 'AutoSizeTextToFitShape') {
    const availableHeight = Math.max(1,shape.height-frame.topMargin-frame.bottomMargin);
    while (size > 1 && (lines.length*size*1.2>availableHeight || (!frame.wordWrap && Math.max(...lines.map(l=>l.length))*size*.55>width))) {size=Math.max(1,size-.5);lines=linesAt(size);}
  }
  return {frame,paragraph,indent,lines,fontSize:size,lineHeight:size*1.2,height:lines.length*size*1.2+frame.topMargin+frame.bottomMargin};
}
