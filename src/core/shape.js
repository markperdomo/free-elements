import { validateShapes } from './layout.js';

export const shapeKinds = ['Chevron', 'RightArrow', 'RoundRectangle'];
const countFor = kind => kind === 'RightArrow' ? 2 : 1;
const minSide = shape => Math.min(shape.width, shape.height);
function number(value, name, min, max = Infinity) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be between ${min} and ${max === Infinity ? 'a finite value' : max}.`);
  return value;
}
function reference(shapes, id) {
  const result = shapes.find(s => s.id === id);
  if (!result) throw new Error('Choose a reference shape.');
  return result;
}

// Office does not expose the AutoShape preset name. The user explicitly chooses
// the kind; adjustment counts are validated before any writes are queued.
export function adjustShapes(shapes, action, options = {}) {
  validateShapes(shapes, ['chain', 'angles', 'match-adjustments'].includes(action) ? 2 : 1);
  const { kind } = options;
  if (!shapeKinds.includes(kind)) throw new Error('Choose the selected shape kind.');
  for (const s of shapes) {
    if (s.kind && s.kind !== kind) throw new Error(`Select only ${kind} shapes, or change the Shape kind setting.`);
    if (!Array.isArray(s.adjustments) || s.adjustments.length !== countFor(kind) || s.adjustments.some(v => !Number.isFinite(v))) {
      throw new Error(`“${s.name || s.id}” does not have the adjustment handles expected for ${kind}. Select matching AutoShapes.`);
    }
    if (Math.abs(s.rotation || 0) % 360 > 1e-6) throw new Error('Shape tools currently need unrotated shapes.');
  }
  const next = structuredClone(shapes);
  const source = ['chain', 'angles', 'match-adjustments'].includes(action) ? reference(shapes, options.referenceId) : null;
  if (action === 'radius') {
    if (kind !== 'RoundRectangle') throw new Error('Choose Rounded rectangles and select rounded rectangle shapes.');
    const radius = number(options.radius, 'Corner radius', 0);
    if (shapes.some(s => radius > minSide(s) / 2)) throw new Error('Radius cannot exceed half the shortest side of any selected shape.');
    for (const s of next) s.adjustments[0] = radius / minSide(s);
  } else if (action === 'arrow') {
    if (kind !== 'RightArrow') throw new Error('Choose Right arrows and select right arrow shapes.');
    const head = number(options.head, 'Arrowhead depth', 0.1);
    const shaft = number(options.shaft, 'Shaft percentage', 1, 99) / 100;
    if (shapes.some(s => head >= s.width)) throw new Error('Arrowhead depth must be less than every arrow’s width.');
    for (const s of next) s.adjustments = [shaft, head / minSide(s)];
  } else if (action === 'angles') {
    if (kind === 'RoundRectangle') throw new Error('Matching angles works with chevrons and right arrows.');
    const index = kind === 'RightArrow' ? 1 : 0;
    const slope = source.adjustments[index] * minSide(source) / source.height;
    for (const s of next) {
      const depth = slope * s.height;
      if (depth >= s.width || depth < 0) throw new Error('The reference angle will not fit inside one of these shapes.');
      s.adjustments[index] = depth / minSide(s);
    }
  } else if (action === 'match-adjustments') {
    for (const s of next) s.adjustments = [...source.adjustments];
  } else if (action === 'chain') {
    if (kind !== 'Chevron') throw new Error('Process chains currently use right-facing chevrons.');
    const gap = number(options.gap, 'Gap', 0);
    const depth = source.adjustments[0] * minSide(source);
    if (depth < 0 || depth >= source.width) throw new Error('The reference chevron needs a point shallower than its width.');
    const ordered = [...next].sort((a, b) => a.left - b.left || a.top - b.top || a.id.localeCompare(b.id));
    const anchor = ordered.findIndex(s => s.id === source.id);
    const step = source.width - depth + gap;
    ordered.forEach((s, i) => Object.assign(s, {left: source.left + (i - anchor) * step,
      top: source.top, width: source.width, height: source.height, adjustments: [...source.adjustments]}));
  } else throw new Error('Unknown shape command.');
  validateShapes(next);
  return next;
}
