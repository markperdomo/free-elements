import { transform } from '../core/layout.js';
import { applyStyle, defaultStyle, validateStyle } from '../core/format.js';
import { adjustShapes } from '../core/shape.js';
import { textPatches, applyTextPatches, textCopies, previewText } from '../core/text.js';

export function sampleShapes() {
  return [
    { id: 'discover', name: '01 · Discover', left: 70, top: 205, width: 172, height: 110, text: 'Discover', style: { ...defaultStyle } },
    { id: 'define', name: '02 · Define', left: 292, top: 237, width: 150, height: 90, text: 'Define', style: { ...defaultStyle, fill: '#D8E4EB', line: '#7290A1' } },
    { id: 'develop', name: '03 · Develop', left: 496, top: 196, width: 184, height: 128, text: 'Develop', style: { ...defaultStyle, fill: '#F2E4CD', line: '#B6A079' } },
    { id: 'deliver', name: '04 · Deliver', left: 752, top: 230, width: 140, height: 100, text: 'Deliver', style: { ...defaultStyle, fill: '#EADDD8', line: '#AF8C7F' } },
  ];
}

export class DemoAdapter {
  constructor() { this.reset(); }
  reset(example = this.example || 'layout') {
    this.example = example; this.serial = 0;
    this.shapes = sampleShapes().map(s=>({...s,paragraph:{indentLevel:0}}));
    if (['Chevron','RightArrow','RoundRectangle'].includes(example)) this.shapes = this.shapes.map((s,i)=>({...s,kind:example,adjustments:example==='RightArrow'?[.35+i*.1,.3+i*.12]:[.12+i*.12]}));
    if (example === 'text') this.shapes = [{...this.shapes[0],width:320,height:160,text:'Define the problem\nExplore possible solutions\nBuild and test the idea',textFrame:{verticalAlignment:'Top'},paragraph:{horizontalAlignment:'Left',indentLevel:0}}];
    this.selected = this.shapes.map(s => s.id); this.past = []; this.future = [];
  }
  async readSelection() { return { scope: 'demo', shapes: structuredClone(this.shapes.filter(s => this.selected.includes(s.id))) }; }
  commit(shapes) {
    if (JSON.stringify(shapes) === JSON.stringify(this.shapes)) return;
    this.past.push(structuredClone(this.shapes));
    if (this.past.length > 100) this.past.shift();
    this.shapes = shapes; this.future = [];
  }
  async execute(command, options) {
    const { shapes } = await this.readSelection();
    if (command === 'text' && ['split','merge'].includes(options.action)) {
      const style = validateStyle(options.style);
      const copies = textCopies(shapes,options.action,{...options,fontSize:style.fontSize}).map(s=>({...s,id:`copy-${++this.serial}`,style:{...defaultStyle,...style,fill:'#FFFFFF',lineWidth:0},textFrame:{wordWrap:true,autoSizeSetting:'AutoSizeShapeToFitText',verticalAlignment:'Top'},paragraph:{horizontalAlignment:'Left',indentLevel:0}}));
      this.commit([...this.shapes,...copies]); this.selected = copies.map(s=>s.id); return;
    }
    const updated = command === 'shape' ? adjustShapes(shapes,options.action,options) : command === 'text' ? applyTextPatches(shapes,textPatches(shapes,options.action,options)) : command === 'format' ? applyStyle(shapes, options.style) : transform(shapes, command, options);
    this.commit(this.shapes.map(s => {
      const next = updated.find(u => u.id === s.id);
      if (!next) return s;
      if (command === 'text' && next.textFrame?.autoSizeSetting === 'AutoSizeShapeToFitText') return {...next,height:previewText(next).height};
      return next;
    }));
  }
  async capture(id) {
    const shape = this.shapes.find(s => s.id === id && this.selected.includes(id));
    if (!shape) throw new Error('Select a reference shape to capture.');
    return { ...shape.style };
  }
  undo() { if (!this.past.length) return; this.future.push(this.shapes); this.shapes = this.past.pop(); this.selected = this.selected.filter(id=>this.shapes.some(s=>s.id===id)); }
  redo() { if (!this.future.length) return; this.past.push(this.shapes); this.shapes = this.future.pop(); this.selected = this.selected.filter(id=>this.shapes.some(s=>s.id===id)); }
}
