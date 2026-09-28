import test from 'node:test';
import assert from 'node:assert/strict';
import { PowerPointAdapter } from '../src/adapters/powerpoint.js';

// Contract tests do not replace real Office validation. They exercise the
// selection boundary, unsupported-type preflight, and precisely scoped writes.
function mock() {
  const writes = [], syncs = [];
  const make = (id, top) => {
    const shape = { id, name: id, type: 'GeometricShape', left: 20, top, width: 100, height: 40,
      fill: { setSolidColor: color => writes.push(['fill', id, color]) },
      textFrame: { textRange: { font: {} } }, lineFormat: {} };
    return new Proxy(shape, { set(target, key, value) { writes.push([key, id, value]); target[key] = value; return true; } });
  };
  const items = [make('a', 10), make('b', 60)];
  const context = { presentation: { id: 'deck1', load() {},
    getSelectedShapes: () => ({ items, load() {} }),
    getSelectedSlides: () => ({ items: [{ id: 'slide1' }], load() {} }),
  }, async sync() { syncs.push(writes.length); } };
  return { items, writes, syncs, context, adapter: new PowerPointAdapter({ run: fn => fn(context) }) };
}
test('Office geometry writes only changed properties after preflight', async () => {
  const m = mock(); await m.adapter.readSelection();
  await m.adapter.execute('align', { edge: 'top', referenceId: 'a' });
  assert.deepEqual(m.writes, [['top', 'b', 10]]);
  assert.deepEqual(m.syncs, [0, 0, 1]);
});
test('Office stale selection, different deck and unsupported shapes make no operation writes', async () => {
  for (const change of ['selection', 'deck', 'type']) {
    const m = mock(); await m.adapter.readSelection();
    if (change === 'selection') m.items.pop();
    if (change === 'deck') m.context.presentation.id = 'other-deck';
    if (change === 'type') m.items[1].type = 'Group';
    m.writes.length = 0;
    await assert.rejects(m.adapter.execute('align', { edge: 'top', referenceId: 'a' }));
    assert.deepEqual(m.writes, []);
  }
});
test('Office rejects invalid operation before any edits', async () => {
  const m = mock(); await m.adapter.readSelection();
  await assert.rejects(m.adapter.execute('space', { axis: 'horizontal', gap: NaN }));
  assert.deepEqual(m.writes, []);
});
test('Office fill-only formatting never rewrites text or dimensions', async () => {
  const m = mock(); await m.adapter.readSelection();
  await m.adapter.execute('format', { style: { fill: '#aabbcc' } });
  assert.deepEqual(m.writes, [['fill', 'a', '#AABBCC'], ['fill', 'b', '#AABBCC']]);
  assert.deepEqual(m.items[0].textFrame.textRange.font, {});
});
