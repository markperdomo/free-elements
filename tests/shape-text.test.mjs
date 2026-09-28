import test from 'node:test';
import assert from 'node:assert/strict';
import {adjustShapes} from '../src/core/shape.js';
import {textPatches,textCopies,previewText} from '../src/core/text.js';
import {DemoAdapter} from '../src/adapters/demo.js';
import {PowerPointAdapter} from '../src/adapters/powerpoint.js';
const shape = (id,extra={})=>({id,name:id,left:20,top:30,width:160,height:80,adjustments:[.3],rotation:0,...extra});

test('process chains interlock using point depth and preserve the chosen reference exactly',()=> {
 const shapes=[shape('a',{left:10,width:140}),shape('b',{left:200}),shape('c',{left:500,height:100})];
 const before=structuredClone(shapes);
 const result=adjustShapes(shapes,'chain',{kind:'Chevron',referenceId:'b',gap:6});
 assert.deepEqual(shapes,before);
 assert.deepEqual(result[1],shapes[1]);
 assert.deepEqual(result.map(s=>[s.left,s.top,s.width,s.height,s.adjustments[0]]),[[58,30,160,80,.3],[200,30,160,80,.3],[342,30,160,80,.3]]);
});
test('matching arrow angles preserves slope across different dimensions',()=> {
 const shapes=[shape('a',{adjustments:[.4,.5]}),shape('b',{width:100,height:160,adjustments:[.7,.3]})];
 const result=adjustShapes(shapes,'angles',{kind:'RightArrow',referenceId:'a'});
 assert.equal(result[1].adjustments[0],.7);
 assert.equal(result[1].adjustments[1]*100/160, .5*80/80);
});
test('rounded corners use a constant physical radius and arrows keep a constant head depth',()=> {
 const shapes=[shape('a'),shape('b',{width:100,height:120})];
 const rounds=adjustShapes(shapes,'radius',{kind:'RoundRectangle',radius:12});
 assert.deepEqual(rounds.map(s=>s.adjustments[0]*Math.min(s.width,s.height)),[12,12]);
 const arrows=adjustShapes(shapes.map(s=>({...s,adjustments:[.5,.5]})),'arrow',{kind:'RightArrow',head:24,shaft:40});
 assert.deepEqual(arrows.map(s=>s.adjustments),[[.4,.3],[.4,.24]]);
});
test('shape preflight rejects wrong types, rotations, excessive radius and impossible point angles',()=> {
 assert.throws(()=>adjustShapes([shape('a',{kind:'Chevron'})],'radius',{kind:'RoundRectangle',radius:4}),/only/);
 assert.throws(()=>adjustShapes([shape('a',{adjustments:[]})],'radius',{kind:'RoundRectangle',radius:4}),/handles/);
 assert.throws(()=>adjustShapes([shape('a',{rotation:45})],'radius',{kind:'RoundRectangle',radius:4}),/unrotated/);
 assert.throws(()=>adjustShapes([shape('a')],'radius',{kind:'RoundRectangle',radius:41}),/half/);
 assert.throws(()=>adjustShapes([shape('a'),shape('b',{width:10,height:160})],'angles',{kind:'Chevron',referenceId:'a'}),/fit/);
});
test('text edits are selective, wrapping has consistent mixed-selection behavior and margins clamp at zero',()=> {
 const shapes=[shape('a',{textFrame:{wordWrap:true,leftMargin:.2}}),shape('b',{textFrame:{wordWrap:false,leftMargin:8}})];
 assert.deepEqual(textPatches(shapes,'wrap'),[{frame:{wordWrap:true}},{frame:{wordWrap:true}}]);
 assert.deepEqual(textPatches(shapes,'fit-shape'),[{frame:{autoSizeSetting:'AutoSizeShapeToFitText'}},{frame:{autoSizeSetting:'AutoSizeShapeToFitText'}}]);
 assert.deepEqual(textPatches(shapes,'margin-decrease').map(p=>p.frame.leftMargin),[0,7]);
 assert.throws(()=>textPatches(shapes,'margins',{margins:{leftMargin:-1}}),/margin/);
});
test('indent respects paragraph boundaries and refuses mixed values',()=> {
 assert.deepEqual(textPatches([shape('a',{paragraph:{indentLevel:8}})],'indent'),[{paragraph:{indentLevel:8}}]);
 assert.deepEqual(textPatches([shape('a',{paragraph:{indentLevel:0}})],'outdent'),[{paragraph:{indentLevel:0}}]);
 assert.throws(()=>textPatches([shape('a',{paragraph:{indentLevel:null}})],'indent'),/single/);
});
test('split copies retain Unicode and blank paragraphs; merge uses stable visual order without changing sources',()=> {
 const original=[shape('a',{text:'One\r\n\r\n🚀 Three'})];
 const before=structuredClone(original);
 assert.deepEqual(textCopies(original,'split').map(s=>s.text),['One','','🚀 Three']);
 assert.deepEqual(original,before);
 const merged=textCopies([shape('c',{text:'C',top:90}),shape('b',{text:'B',left:80}),shape('a',{text:'A'})],'merge');
 assert.equal(merged[0].text,'A\nB\nC');
 assert.throws(()=>textCopies([shape('a',{text:'Single paragraph'})],'split'),/two paragraphs/);
});
test('demo copies have unique IDs, preserve originals, and participate in Undo/Redo',async()=> {
 const demo=new DemoAdapter(); demo.reset('text'); const original=structuredClone(demo.shapes);
 await demo.execute('text',{action:'split',style:{fontSize:18}});
 assert.equal(demo.shapes.length,4);assert.equal(new Set(demo.shapes.map(s=>s.id)).size,4);assert.deepEqual(demo.shapes[0],original[0]);
 demo.undo();assert.deepEqual(demo.shapes,original);assert.deepEqual(demo.selected,[]);
 demo.redo();assert.equal(demo.shapes.length,4);
});
test('preview wrapping and shrink-to-fit respond to available text bounds',()=> {
 const s=shape('a',{text:'A long sentence that should wrap over several lines',style:{fontSize:18},textFrame:{wordWrap:true}});
 const normal=previewText(s);assert.ok(normal.lines.length>1);
 const fitted=previewText({...s,height:30,textFrame:{wordWrap:true,autoSizeSetting:'AutoSizeTextToFitShape'}});
 assert.ok(fitted.fontSize<18);assert.ok(fitted.height<=30);
});
function office(support=true) {
 const writes=[];
 const track=(type,obj)=>new Proxy({...obj,load(){}},{set(target,key,value){writes.push([type,key,value]);target[key]=value;return true;}});
 const frame=track('frame',{wordWrap:true,leftMargin:7,rightMargin:7,topMargin:3,bottomMargin:3,textRange:{paragraphFormat:track('paragraph',{indentLevel:2,bulletFormat:track('bullet',{})})}});
 const proxy={...shape('a'),type:'GeometricShape',textFrame:frame,load(){},adjustments:{count:1,load(){},get(){return {value:.3};},set(i,v){writes.push(['adjustment',i,v]);}}};
 const context={presentation:{id:'deck',load(){},getSelectedShapes:()=>({items:[proxy],load(){}}),getSelectedSlides:()=>({items:[{id:'slide'}],load(){}})},async sync(){}};
 return {adapter:new PowerPointAdapter({run:fn=>fn(context)},()=>support),writes,proxy};
}
test('Office text tools update only their own properties and keep text/font/geometry intact',async()=> {
 const m=office();await m.adapter.readSelection();await m.adapter.execute('text',{action:'wrap'});
 assert.deepEqual(m.writes,[['frame','wordWrap',false]]);
 m.writes.length=0;await m.adapter.execute('text',{action:'numbering'});
 assert.deepEqual(m.writes,[['bullet','visible',true],['bullet','type','Numbered'],['bullet','style','ArabicNumeralPeriod']]);
});
test('Office advanced tools gate unsupported hosts and invalid shape edits before writes',async()=> {
 const old=office(false);await old.adapter.readSelection();
 await assert.rejects(old.adapter.execute('shape',{action:'radius',kind:'RoundRectangle',radius:10}),/Update/);
 await assert.rejects(old.adapter.execute('text',{action:'numbering'}),/newer/);assert.deepEqual(old.writes,[]);
 const m=office();await m.adapter.readSelection();await assert.rejects(m.adapter.execute('shape',{action:'radius',kind:'RoundRectangle',radius:500}),/half/);assert.deepEqual(m.writes,[]);
 await m.adapter.execute('shape',{action:'radius',kind:'RoundRectangle',radius:10});assert.deepEqual(m.writes,[['adjustment',0,.125]]);
});
