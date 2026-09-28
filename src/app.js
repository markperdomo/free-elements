import { DemoAdapter } from './adapters/demo.js';
import { PowerPointAdapter } from './adapters/powerpoint.js';
import { validateStyle, parsePresets } from './core/format.js';
import { icon } from './ui/icons.js';
import { previewText } from './core/text.js';

const $ = id => document.getElementById(id);
const officeMode = new URLSearchParams(location.search).get('host') === 'powerpoint';
let adapter, busy = false, snapshot = { shapes: [] }, presets = [], drag = null;
const presetKey = 'free-elements.formats.v1';
const svgNS = 'http://www.w3.org/2000/svg';

function element(name, attrs = {}, text) {
  const node = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}
function status(message, error = false) {
  $('status').textContent = message; $('status').title = message;
  $('status').classList.toggle('error', error);
}
for (const edge of ['left', 'center', 'right', 'top', 'middle', 'bottom']) {
  const button = document.createElement('button');
  button.className = 'icon-button';
  button.dataset.command = 'align'; button.dataset.edge = edge;
  button.setAttribute('aria-label', `Align ${edge}`);
  button.title = `Align ${edge} to the chosen reference or selection bounds`;
  const label = document.createElement('span'); label.textContent = edge[0].toUpperCase() + edge.slice(1);
  button.append(icon(`align-${edge}`), label);
  $('alignment-tools').append(button);
}
document.querySelectorAll('[data-icon]').forEach(button => button.prepend(icon(button.dataset.icon)));
function showLabels(show) {
  document.querySelector('.tool-panel').classList.toggle('show-labels', show);
  $('toggle-labels').setAttribute('aria-pressed', String(show));
  $('toggle-labels').title = `${show ? 'Hide' : 'Show'} labels below the tool icons`;
}
try { showLabels(localStorage.getItem('free-elements.labels.v1') === 'true'); } catch {}
$('toggle-labels').addEventListener('click', () => {
  const show = $('toggle-labels').getAttribute('aria-pressed') !== 'true'; showLabels(show);
  try { localStorage.setItem('free-elements.labels.v1', String(show)); } catch {}
});

function renderSlide() {
  if (officeMode || !adapter) return;
  const svg = $('slide'); svg.replaceChildren();
  svg.append(element('rect', { width: 960, height: 540, fill: '#FFFFFF' }));
  svg.append(element('text', { x: 55, y: 57, fill: '#6D805B', 'font-family': 'Arial', 'font-size': 10, 'letter-spacing': 2 }, 'FROM POSSIBILITY TO PROGRESS'));
  svg.append(element('text', { x: 55, y: 110, fill: '#2C3D30', 'font-family': 'Georgia', 'font-size': 34 }, 'A clear path from idea to impact.'));
  svg.append(element('text', { x: 55, y: 141, fill: '#919889', 'font-family': 'Arial', 'font-size': 12 }, 'Four stages. One shared direction.'));
  for (const shape of adapter.shapes) {
    const selected = adapter.selected.includes(shape.id), ref = $('reference').value === shape.id;
    const group = element('g', { 'data-shape': shape.id, tabindex: 0, role: 'button', 'aria-label': `${shape.name}${selected ? ', selected' : ''}`, style: 'cursor:move' });
    const {left:x,top:y,width:w,height:h} = shape;
    const paint = {fill:shape.style.fill,stroke:shape.style.line,'stroke-width':shape.style.lineWidth,'data-outline':'true'};
    const depth = Math.min(w,h)*(shape.adjustments?.[shape.kind==='RightArrow'?1:0] || 0);
    if (shape.kind === 'Chevron') group.append(element('path',{...paint,d:`M${x} ${y}H${x+w-depth}L${x+w} ${y+h/2}L${x+w-depth} ${y+h}H${x}L${x+depth} ${y+h/2}Z`}));
    else if (shape.kind === 'RightArrow') {
      const halfShaft = h*shape.adjustments[0]/2;
      group.append(element('path',{...paint,d:`M${x} ${y+h/2-halfShaft}H${x+w-depth}V${y}L${x+w} ${y+h/2}L${x+w-depth} ${y+h}V${y+h/2+halfShaft}H${x}Z`}));
    } else group.append(element('rect', {...paint,x,y,width:w,height:h,rx:shape.kind==='RoundRectangle'?depth:3}));
    const text = previewText(shape), {frame,paragraph} = text;
    const anchor = paragraph.horizontalAlignment === 'Left' ? 'start' : paragraph.horizontalAlignment === 'Right' ? 'end' : 'middle';
    const textX = anchor==='start' ? x+frame.leftMargin+text.indent : anchor==='end' ? x+w-frame.rightMargin : x+(w+frame.leftMargin-frame.rightMargin+text.indent)/2;
    const contentHeight = text.lines.length*text.lineHeight;
    const textTop = frame.verticalAlignment.startsWith('Top') ? y+frame.topMargin : frame.verticalAlignment.startsWith('Bottom') ? y+h-frame.bottomMargin-contentHeight : y+frame.topMargin+(h-frame.topMargin-frame.bottomMargin-contentHeight)/2;
    const textNode = element('text', {x:textX,'text-anchor':anchor,fill:shape.style.fontColor,'font-family':shape.style.font,'font-size':text.fontSize,'font-weight':shape.style.bold?700:400});
    text.lines.forEach((line,i)=>textNode.append(element('tspan',{x:textX,y:textTop+text.fontSize+i*text.lineHeight},line || '\u00a0')));
    group.append(textNode);
    if (selected) {
      group.append(element('rect', { x: shape.left - 5, y: shape.top - 5, width: shape.width + 10, height: shape.height + 10,
        fill: 'none', stroke: ref ? '#577A32' : '#9CB57E', 'stroke-width': 1, 'stroke-dasharray': ref ? 'none' : '4 3', 'data-selection': 'true' }));
      for (const [x, y] of [[shape.left - 5, shape.top - 5], [shape.left + shape.width + 5, shape.top + shape.height + 5]]) {
        group.append(element('rect', { x: x - 2.5, y: y - 2.5, width: 5, height: 5, fill: '#fff', stroke: '#577A32', 'stroke-width': 1, 'data-selection': 'true' }));
      }
      if (ref) group.append(element('text', { x: shape.left, y: shape.top - 15, 'font-family': 'Arial', 'font-size': 9, fill: '#668345', 'data-selection': 'true' }, 'REFERENCE'));
    }
    svg.append(group);
  }
  svg.append(element('line', { x1: 55, x2: 905, y1: 478, y2: 478, stroke: '#E4E8DD', 'stroke-width': 1 }));
  svg.append(element('text', { x: 55, y: 505, fill: '#9DA591', 'font-family': 'Arial', 'font-size': 9 }, 'FREE ELEMENTS  /  STRATEGY WORKSHOP'));
  svg.append(element('text', { x: 905, y: 505, fill: '#9DA591', 'font-family': 'Arial', 'font-size': 9, 'text-anchor': 'end' }, '01'));
  $('undo').disabled = !adapter.past.length;
  $('redo').disabled = !adapter.future.length;
}

function renderObjects() {
  if (officeMode) return;
  $('object-list').replaceChildren();
  for (const shape of adapter.shapes) {
    const label = document.createElement('label'); label.className = 'object-row';
    label.classList.toggle('selected', adapter.selected.includes(shape.id));
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = adapter.selected.includes(shape.id);
    checkbox.addEventListener('change', () => { toggleSelection(shape.id); refresh(); });
    const dot = document.createElement('span'); dot.className = 'object-dot'; dot.style.background = shape.style.fill;
    const size = document.createElement('small'); size.textContent = `${shape.width.toFixed(0)} × ${shape.height.toFixed(0)} pt`;
    label.append(checkbox, dot, document.createTextNode(shape.name), size); $('object-list').append(label);
  }
}

async function refresh() {
  snapshot = await adapter.readSelection();
  const previous = $('reference').value;
  $('reference').replaceChildren(...snapshot.shapes.map(shape => {
    const option = document.createElement('option'); option.value = shape.id; option.textContent = shape.name || shape.id; return option;
  }));
  if (snapshot.shapes.some(s => s.id === previous)) $('reference').value = previous;
  $('selection-count').textContent = `${snapshot.shapes.length} selected`;
  renderSlide(); renderObjects();
}

async function run(action) {
  if (busy || !adapter) return;
  busy = true; $('tools').disabled = true;
  try { await action(); await refresh(); }
  catch (error) {
    status(`${error.message || 'The operation failed.'}${officeMode ? ' If PowerPoint changed any shapes, use its Undo command.' : ''}`, true);
  } finally { busy = false; $('tools').disabled = false; }
}

function formStyle() {
  const style = {};
  if ($('use-fill').checked) style.fill = $('fill').value;
  if ($('use-line').checked) { style.line = $('line').value; style.lineWidth = $('line-width').valueAsNumber; }
  if ($('use-font').checked) Object.assign(style, { font: $('font').value, fontSize: $('font-size').valueAsNumber, fontColor: $('font-color').value, bold: $('bold').checked });
  return validateStyle(style);
}
function setForm(style) {
  const mapping = { fill: 'fill', line: 'line', lineWidth: 'line-width', font: 'font', fontSize: 'font-size', fontColor: 'font-color' };
  for (const [key, id] of Object.entries(mapping)) if (style[key] !== undefined) $(id).value = style[key];
  $('bold').checked = style.bold ?? false;
  $('use-fill').checked = style.fill !== undefined;
  $('use-line').checked = style.line !== undefined || style.lineWidth !== undefined;
  $('use-font').checked = ['font', 'fontSize', 'fontColor', 'bold'].some(key => style[key] !== undefined);
}
function renderPresets() {
  const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Saved formats';
  $('presets').replaceChildren(placeholder, ...presets.map((p, i) => { const option = document.createElement('option'); option.value = String(i); option.textContent = p.name; return option; }));
}
function savePresets(next) {
  try { localStorage.setItem(presetKey, JSON.stringify(next)); }
  catch { throw new Error('Browser storage is unavailable or full. Your format was not saved.'); }
  presets = next; renderPresets();
}

document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => run(async () => {
  const command = button.dataset.command;
  const options = { ...button.dataset, gap: $('gap').valueAsNumber, columns: $('columns').valueAsNumber, anchor: $('resize-anchor').value,
    referenceId: command === 'align' && $('align-target').value === 'selection' ? null : $('reference').value };
  if (command === 'shape') Object.assign(options,{kind:$('shape-kind').value,radius:$('corner-radius').valueAsNumber,head:$('arrow-head').valueAsNumber,shaft:$('arrow-shaft').valueAsNumber});
  if (command === 'text') Object.assign(options,{margins:{leftMargin:$('margin-left').valueAsNumber,rightMargin:$('margin-right').valueAsNumber,topMargin:$('margin-top').valueAsNumber,bottomMargin:$('margin-bottom').valueAsNumber},style:{font:$('font').value,fontSize:$('font-size').valueAsNumber,fontColor:$('font-color').value,bold:$('bold').checked}});
  await adapter.execute(command, options);
  status(command==='text' && ['split','merge'].includes(options.action) ? 'Editable copies created. Originals kept.' : `${button.getAttribute('aria-label') || button.textContent.trim()} · ${snapshot.shapes.length} shape${snapshot.shapes.length === 1 ? '' : 's'}`);
})));
$('open-text-options').addEventListener('click',()=> { $('text-options').open = !$('text-options').open; });
$('text-options').addEventListener('toggle',()=> $('open-text-options').setAttribute('aria-expanded',String($('text-options').open)));
$('example').addEventListener('change',()=>run(async()=> {
  adapter.reset($('example').value);
  if (['Chevron','RightArrow','RoundRectangle'].includes($('example').value)) $('shape-kind').value = $('example').value;
  status('Example loaded. Select shapes, then choose a tool.');
}));
$('refresh').addEventListener('click', () => run(async () => { await refresh(); status('Selection refreshed.'); }));
$('reference').addEventListener('change', renderSlide);
$('apply-format').addEventListener('click', () => run(async () => { await adapter.execute('format', { style: formStyle() }); status('Format applied.'); }));
$('capture').addEventListener('click', () => run(async () => { setForm(await adapter.capture($('reference').value)); status('Reference format captured. Choose shapes and apply it.'); }));
$('save-preset').addEventListener('click', () => run(async () => {
  const name = $('preset-name').value.trim();
  if (!name) throw new Error('Name your format before saving it.');
  const next = presets.filter(p => p.name !== name);
  if (next.length >= 30) throw new Error('You can save 30 formats. Delete one before adding another.');
  next.push({ name, style: formStyle() }); savePresets(next); $('presets').value = String(next.length - 1); status(`Saved “${name}” in this browser.`);
}));
$('load-preset').addEventListener('click', () => run(async () => {
  if ($('presets').value === '') throw new Error('Choose a saved format.');
  const preset = presets[Number($('presets').value)]; setForm(preset.style); $('preset-name').value = preset.name; status('Format loaded. Apply it when ready.');
}));
$('delete-preset').addEventListener('click', () => run(async () => {
  if ($('presets').value === '') throw new Error('Choose a saved format to delete.');
  savePresets(presets.filter((_, i) => i !== Number($('presets').value))); status('Saved format deleted.');
}));

function toggleSelection(id) { adapter.selected = adapter.selected.includes(id) ? adapter.selected.filter(s => s !== id) : [...adapter.selected, id]; }
function slidePoint(event) { const rect = $('slide').getBoundingClientRect(); return { x: (event.clientX - rect.left) * 960 / rect.width, y: (event.clientY - rect.top) * 540 / rect.height }; }
$('slide').addEventListener('pointerdown', event => {
  if (officeMode || busy || event.button !== 0) return;
  const id = event.target.closest('[data-shape]')?.dataset.shape;
  if (!id) { adapter.selected = []; refresh(); return; }
  event.preventDefault();
  if (event.shiftKey) toggleSelection(id); else if (!adapter.selected.includes(id)) adapter.selected = [id];
  if (adapter.selected.includes(id)) {
    drag = { origin: slidePoint(event), shapes: structuredClone(adapter.shapes), moved: false, id, shift: event.shiftKey };
    $('slide').setPointerCapture(event.pointerId);
  }
  refresh();
});
$('slide').addEventListener('pointermove', event => {
  if (!drag) return;
  const point = slidePoint(event), dx = point.x - drag.origin.x, dy = point.y - drag.origin.y;
  if (Math.abs(dx) + Math.abs(dy) < 2 && !drag.moved) return;
  drag.moved = true;
  adapter.shapes = drag.shapes.map(s => adapter.selected.includes(s.id) ? { ...s, left: s.left + dx, top: s.top + dy } : s);
  renderSlide();
});
function finishDrag(cancel = false) {
  if (!drag) return;
  const next = adapter.shapes; adapter.shapes = drag.shapes;
  if (!cancel && drag.moved) adapter.commit(next);
  else if (!cancel && !drag.shift) adapter.selected = [drag.id];
  drag = null; refresh();
}
$('slide').addEventListener('pointerup', () => finishDrag());
$('slide').addEventListener('pointercancel', () => finishDrag(true));
$('slide').addEventListener('keydown', event => {
  if (event.key !== ' ' && event.key !== 'Enter') return;
  const id = event.target.closest('[data-shape]')?.dataset.shape;
  if (id) { event.preventDefault(); toggleSelection(id); refresh(); }
});
$('select-all').addEventListener('click', () => run(async () => { adapter.selected = adapter.shapes.map(s => s.id); status('All shapes selected.'); }));
$('reset').addEventListener('click', () => run(async () => { adapter.reset(); status('Playground reset.'); }));
$('undo').addEventListener('click', () => run(async () => { adapter.undo(); status('Undone.'); }));
$('redo').addEventListener('click', () => run(async () => { adapter.redo(); status('Redone.'); }));
document.addEventListener('keydown', event => {
  if (officeMode || busy || /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    event.preventDefault(); run(async () => { if (event.shiftKey) adapter.redo(); else adapter.undo(); });
  }
});
$('export').addEventListener('click', () => {
  const svg = $('slide').cloneNode(true);
  svg.querySelectorAll('[data-selection]').forEach(node => node.remove());
  svg.querySelectorAll('[data-shape]').forEach(node => { node.removeAttribute('tabindex'); node.removeAttribute('role'); node.removeAttribute('style'); });
  svg.setAttribute('width', '960'); svg.setAttribute('height', '540');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
  const link = document.createElement('a'); link.href = url; link.download = 'free-elements-slide.svg'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status('Slide exported as SVG.');
});

async function connectOffice() {
  document.body.classList.add('office'); $('mode').textContent = 'PowerPoint';
  $('tools').disabled = true; status('Connecting to PowerPoint…');
  await new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://appsforoffice.microsoft.com/lib/1/hosted/office.js';
    const timer = setTimeout(() => reject(new Error('PowerPoint connection timed out. Open this pane from the installed add-in and check your connection.')), 20000);
    script.onerror = () => { clearTimeout(timer); reject(new Error('Could not load the Microsoft Office runtime.')); };
    script.onload = () => Office.onReady().then(info => {
      clearTimeout(timer);
      if (info.host !== Office.HostType.PowerPoint) reject(new Error('Open this pane inside PowerPoint. The playground is available at the home URL.'));
      else resolve();
    }).catch(error => { clearTimeout(timer); reject(error); });
    document.head.append(script);
  });
  if (!Office.context.requirements.isSetSupported('PowerPointApi', '1.5')) throw new Error('This PowerPoint version does not support the required PowerPointApi 1.5. Update Office to use these tools.');
  adapter = new PowerPointAdapter();
  document.querySelectorAll('[data-requires]').forEach(button=> {
    if (!Office.context.requirements.isSetSupported('PowerPointApi',button.dataset.requires)) {
      button.disabled = true; button.title += ' — unavailable in this PowerPoint version';
    }
  });
  $('shape-unavailable').hidden = Office.context.requirements.isSetSupported('PowerPointApi','1.10');
  // Width is optional: older hosts still get the compact layout and manual resizing.
  try {
    if (Office.context.requirements.isSetSupported('TaskPaneApi', '1.1')) {
      Office.extensionLifeCycle.taskpane.setWidth(270);
    }
  } catch { /* Pane sizing must never prevent the editing tools from connecting. */ }
  $('panel-footer').textContent = 'pt · ⌘Z on slide';
  $('panel-footer').title = 'Click the slide, then press ⌘Z for PowerPoint Undo.';
  Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, () => {
    // Copies select their new shapes. Keep the operation result visible when
    // that selection event arrives after the write has completed.
    if (!busy) run(async () => {});
  });
}

try {
  try { presets = parsePresets(localStorage.getItem(presetKey)); } catch { presets = []; }
  renderPresets();
  if (officeMode) await connectOffice(); else adapter = new DemoAdapter();
  $('tools').disabled = false;
  await run(async () => { await refresh(); status(officeMode ? 'Select shapes on your slide, then choose a tool.' : 'Four shapes selected. Discover is your reference.'); });
} catch (error) { $('tools').disabled = true; status(error.message, true); }
