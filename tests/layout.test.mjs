import test from 'node:test';
import assert from 'node:assert/strict';
import { align, distribute, space, matchSize, swap, grid, transform, geometryPatch, bounds } from '../src/core/layout.js';
import { applyStyle, validateStyle, parsePresets } from '../src/core/format.js';
import { DemoAdapter } from '../src/adapters/demo.js';

const s = (id, left, top, width, height) => ({ id, left, top, width, height });
const fixture = () => [s('a', 10, 20, 20, 40), s('b', 90, 100, 30, 20), s('c', 200, 160, 50, 60)];
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

for (const [edge, pos, size, fraction] of [['left', 'left', 'width', 0], ['center', 'left', 'width', .5], ['right', 'left', 'width', 1], ['top', 'top', 'height', 0], ['middle', 'top', 'height', .5], ['bottom', 'top', 'height', 1]]) {
  test(`align ${edge} preserves reference, dimensions and unrelated axis`, () => {
    const shapes = fixture(), before = structuredClone(shapes), result = align(shapes, edge, 'b');
    assert.deepEqual(result[1], shapes[1]);
    result.forEach((out, i) => {
      close(out[pos] + fraction * out[size], shapes[1][pos] + fraction * shapes[1][size]);
      assert.equal(out.width, shapes[i].width); assert.equal(out.height, shapes[i].height);
      assert.equal(out[pos === 'left' ? 'top' : 'left'], shapes[i][pos === 'left' ? 'top' : 'left']);
    });
    assert.deepEqual(shapes, before);
  });
}
test('selection alignment uses outside bounds', () => {
  const shapes = fixture(), result = align(shapes, 'right');
  for (const shape of result) assert.equal(shape.left + shape.width, 250);
});
for (const axis of ['horizontal', 'vertical']) {
  test(`${axis} distribution keeps unequal-sized endpoints and equalizes edge gaps`, () => {
    const shapes = fixture(), result = distribute([shapes[2], shapes[0], shapes[1]], axis);
    assert.deepEqual(result.map(s => s.id), ['c', 'a', 'b']);
    const sorted = [result[1], result[2], result[0]], pos = axis === 'horizontal' ? 'left' : 'top', size = axis === 'horizontal' ? 'width' : 'height';
    assert.deepEqual(sorted[0], shapes[0]); assert.deepEqual(sorted[2], shapes[2]);
    close(sorted[1][pos] - sorted[0][pos] - sorted[0][size], sorted[2][pos] - sorted[1][pos] - sorted[1][size]);
  });
}
test('distribution refuses overlap and insufficient selection without changing input', () => {
  const shapes = [s('a', 0, 0, 100, 50), s('b', 10, 20, 100, 50), s('c', 30, 40, 100, 50)], before = structuredClone(shapes);
  assert.throws(() => distribute(shapes, 'horizontal'), /Not enough room/);
  assert.deepEqual(shapes, before);
  assert.throws(() => distribute(shapes.slice(0, 2), 'horizontal'), /at least 3/);
});
test('fixed spacing handles overlap, zero gap, fractional sizes and keeps original order', () => {
  const shapes = [s('b', 2, 0, 10.5, 4), s('a', 0, 10, 20.25, 8), s('c', 4, 20, 15, 8)];
  const result = space(shapes, 'horizontal', 2.5);
  assert.equal(result[1].left, 0); close(result[0].left, 22.75); close(result[2].left, 35.75);
  assert.equal(space(shapes, 'horizontal', 0)[0].left, 20.25);
});
test('matching size preserves centers and reference', () => {
  const shapes = fixture(), result = matchSize(shapes, 'both', 'b');
  result.forEach((r, i) => { assert.equal(r.width, 30); assert.equal(r.height, 20); close(r.left + r.width / 2, shapes[i].left + shapes[i].width / 2); close(r.top + r.height / 2, shapes[i].top + shapes[i].height / 2); });
  assert.deepEqual(result[1], shapes[1]);
});
test('width-only matching can anchor top left', () => {
  const shapes = fixture(), result = matchSize(shapes, 'width', 'a', 'top-left');
  result.forEach((r, i) => { assert.equal(r.width, 20); assert.equal(r.height, shapes[i].height); assert.equal(r.left, shapes[i].left); assert.equal(r.top, shapes[i].top); });
});
test('swap exchanges centers without resizing and is its own inverse', () => {
  const shapes = fixture().slice(0, 2), result = swap(shapes);
  close(result[0].left + result[0].width / 2, shapes[1].left + shapes[1].width / 2);
  assert.deepEqual(swap(result), shapes);
  assert.throws(() => swap(fixture()), /exactly two/);
});
test('grid places variable dimensions into cells without overlap', () => {
  const result = grid(fixture(), 2, 10);
  assert.deepEqual(result.map(s => [s.left, s.top]), [[10, 20], [70, 20], [10, 90]]);
});
test('invalid numbers, IDs, choices, and stale references are rejected', () => {
  const shapes = fixture();
  for (const gap of [-1, NaN, Infinity, '24']) assert.throws(() => space(shapes, 'horizontal', gap));
  for (const columns of [0, -1, 4, 1.5, NaN]) assert.throws(() => grid(shapes, columns, 10));
  assert.throws(() => align(shapes, 'diagonal'));
  assert.throws(() => align(shapes, 'left', 'missing'));
  assert.throws(() => space(shapes, 'diagonal', 5));
  assert.throws(() => matchSize(shapes, 'depth', 'a'));
  assert.throws(() => align([shapes[0], shapes[0]], 'left'));
  assert.throws(() => align([{ ...shapes[0], width: 0 }, shapes[1]], 'left'));
  assert.throws(() => bounds([{ ...shapes[0], left: NaN }]));
  assert.throws(() => transform(shapes, 'not-a-command'));
});
test('patch only contains changed geometry', () => {
  const shape = fixture()[0];
  assert.deepEqual(geometryPatch(shape, { ...shape, left: shape.left + 1e-10, top: 90, name: 'different' }), { top: 90 });
});
test('randomized spacing and resize invariants cover negative coordinates and large shapes', () => {
  // Deterministic pseudo-random fixtures keep failures reproducible.
  let seed = 834;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let trial = 0; trial < 150; trial++) {
    const shapes = Array.from({ length: 3 + Math.floor(random() * 12) }, (_, i) => s(String(i), random() * 2000 - 1000, random() * 1000 - 500, 1 + random() * 200, 1 + random() * 200));
    const gap = random() * 50, result = space(shapes, 'horizontal', gap).sort((a, b) => a.left - b.left);
    for (let i = 1; i < result.length; i++) close(result[i].left - result[i - 1].left - result[i - 1].width, gap);
    const matched = matchSize(shapes, 'height', shapes[0].id);
    matched.forEach((r, i) => close(r.top + r.height / 2, shapes[i].top + shapes[i].height / 2));
  }
});
test('formatting is selective and preserves geometry/content', () => {
  const shapes = [{ ...fixture()[0], text: 'Keep me', style: { fill: '#000000', fontSize: 16 } }];
  const result = applyStyle(shapes, { fill: '#aabbcc' });
  assert.equal(result[0].style.fontSize, 16); assert.equal(result[0].style.fill, '#AABBCC');
  assert.equal(result[0].text, 'Keep me'); assert.equal(result[0].left, 10); assert.equal(shapes[0].style.fill, '#000000');
});
test('unsafe or invalid format input fails', () => {
  for (const style of [{}, { fill: 'url(javascript:x)' }, { fontSize: Infinity }, { fontSize: 0 }, { lineWidth: -1 }, { font: ' ' }, { bold: null }]) assert.throws(() => validateStyle(style));
});
test('presets tolerate corrupt storage without using malformed styles', () => {
  assert.deepEqual(parsePresets('{broken'), []);
  assert.deepEqual(parsePresets('{"name":"bad"}'), []);
  assert.deepEqual(parsePresets(JSON.stringify([{ name: 'Good', style: { fill: '#abcdef' } }, { name: 'Bad', style: { fontSize: -2 } }])), [{ name: 'Good', style: { fill: '#ABCDEF' } }]);
});
test('demo edits only selection, undo/redo restore state, new edits invalidate redo', async () => {
  const adapter = new DemoAdapter(), original = structuredClone(adapter.shapes);
  adapter.selected = ['discover', 'define'];
  await adapter.execute('align', { edge: 'top', referenceId: 'discover' });
  assert.deepEqual(adapter.shapes[2], original[2]);
  const changed = structuredClone(adapter.shapes);
  adapter.undo(); assert.deepEqual(adapter.shapes, original);
  adapter.redo(); assert.deepEqual(adapter.shapes, changed);
  adapter.undo(); await adapter.execute('match', { dimension: 'both', referenceId: 'define' });
  assert.equal(adapter.future.length, 0);
});
