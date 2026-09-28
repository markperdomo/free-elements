// Original layout algorithms. All measurements are PowerPoint points (1/72 inch).
// Pure functions: validate the entire operation before returning any changes.
const geometryKeys = ['left', 'top', 'width', 'height'];

export function validateShapes(shapes, minimum = 1) {
  if (!Array.isArray(shapes) || shapes.length < minimum) {
    throw new Error(`Select at least ${minimum} shape${minimum === 1 ? '' : 's'}.`);
  }
  const ids = new Set();
  for (const shape of shapes) {
    if (typeof shape.id !== 'string' || !shape.id || ids.has(shape.id)) throw new Error('Shape IDs must be unique.');
    ids.add(shape.id);
    if (geometryKeys.some(key => !Number.isFinite(shape[key]))) throw new Error('Shape measurements must be finite numbers.');
    if (shape.width <= 0 || shape.height <= 0) throw new Error('Use shapes with positive width and height; lines are not supported.');
  }
}

export function bounds(shapes) {
  validateShapes(shapes);
  const left = Math.min(...shapes.map(s => s.left));
  const top = Math.min(...shapes.map(s => s.top));
  return {
    left, top,
    width: Math.max(...shapes.map(s => s.left + s.width)) - left,
    height: Math.max(...shapes.map(s => s.top + s.height)) - top,
  };
}

function reference(shapes, id) {
  const shape = shapes.find(s => s.id === id);
  if (!shape) throw new Error('Choose a reference shape from the current selection.');
  return shape;
}

function axisSpec(axis) {
  if (axis === 'horizontal') return ['left', 'width'];
  if (axis === 'vertical') return ['top', 'height'];
  throw new Error('Choose a horizontal or vertical axis.');
}

function finite(value, label, minimum = -Infinity) {
  if (!Number.isFinite(value) || value < minimum) throw new Error(`${label} must be a number${minimum > -Infinity ? ` of at least ${minimum}` : ''}.`);
  return value;
}

export function align(shapes, edge, referenceId = null) {
  validateShapes(shapes, 2);
  const edges = {
    left: ['left', 'width', 0], center: ['left', 'width', 0.5], right: ['left', 'width', 1],
    top: ['top', 'height', 0], middle: ['top', 'height', 0.5], bottom: ['top', 'height', 1],
  };
  if (!edges[edge]) throw new Error('Unknown alignment.');
  const [position, size, fraction] = edges[edge];
  const target = referenceId ? reference(shapes, referenceId) : bounds(shapes);
  const coordinate = target[position] + target[size] * fraction;
  return shapes.map(s => ({ ...s, [position]: coordinate - s[size] * fraction }));
}

export function distribute(shapes, axis) {
  validateShapes(shapes, 3);
  const [position, size] = axisSpec(axis);
  const sorted = [...shapes].sort((a, b) => a[position] - b[position] || a.id.localeCompare(b.id));
  // Keep both outside shapes in place; equalize the gaps, not their centers.
  const first = sorted[0], last = sorted.at(-1);
  const occupied = sorted.reduce((sum, s) => sum + s[size], 0);
  const gap = (last[position] + last[size] - first[position] - occupied) / (sorted.length - 1);
  if (gap < -1e-8) throw new Error('Not enough room for equal gaps. Use fixed spacing to spread the shapes out.');
  let cursor = first[position];
  const changes = new Map(sorted.map(s => {
    const result = { ...s, [position]: cursor };
    cursor += s[size] + Math.max(0, gap);
    return [s.id, result];
  }));
  // Preserve exact endpoints despite floating-point accumulation.
  changes.set(last.id, { ...last });
  return shapes.map(s => changes.get(s.id));
}

export function space(shapes, axis, gap) {
  validateShapes(shapes, 2);
  finite(gap, 'Gap', 0);
  const [position, size] = axisSpec(axis);
  const sorted = [...shapes].sort((a, b) => a[position] - b[position] || a.id.localeCompare(b.id));
  let cursor = sorted[0][position];
  const changes = new Map(sorted.map(s => {
    const result = { ...s, [position]: cursor };
    cursor += s[size] + gap;
    return [s.id, result];
  }));
  return shapes.map(s => changes.get(s.id));
}

export function matchSize(shapes, dimension, referenceId, anchor = 'center') {
  validateShapes(shapes, 2);
  if (!['width', 'height', 'both'].includes(dimension)) throw new Error('Unknown size dimension.');
  if (!['center', 'top-left'].includes(anchor)) throw new Error('Unknown resize anchor.');
  const source = reference(shapes, referenceId);
  return shapes.map(s => {
    const width = dimension === 'height' ? s.width : source.width;
    const height = dimension === 'width' ? s.height : source.height;
    return { ...s, width, height,
      left: s.left + (anchor === 'center' ? (s.width - width) / 2 : 0),
      top: s.top + (anchor === 'center' ? (s.height - height) / 2 : 0),
    };
  });
}

export function swap(shapes) {
  validateShapes(shapes, 2);
  if (shapes.length !== 2) throw new Error('Select exactly two shapes to swap their centers.');
  return shapes.map((s, i) => ({ ...s,
    left: shapes[1 - i].left + (shapes[1 - i].width - s.width) / 2,
    top: shapes[1 - i].top + (shapes[1 - i].height - s.height) / 2,
  }));
}

export function grid(shapes, columns, gap) {
  validateShapes(shapes, 2);
  finite(gap, 'Gap', 0);
  if (!Number.isInteger(columns) || columns < 1 || columns > shapes.length) throw new Error('Columns must be between 1 and the number of selected shapes.');
  const origin = bounds(shapes);
  const sorted = [...shapes].sort((a, b) => a.top - b.top || a.left - b.left || a.id.localeCompare(b.id));
  const width = Math.max(...shapes.map(s => s.width));
  const height = Math.max(...shapes.map(s => s.height));
  const changes = new Map(sorted.map((s, i) => [s.id, { ...s,
    left: origin.left + (i % columns) * (width + gap),
    top: origin.top + Math.floor(i / columns) * (height + gap),
  }]));
  return shapes.map(s => changes.get(s.id));
}

export function transform(shapes, command, options = {}) {
  let result;
  switch (command) {
    case 'align': result = align(shapes, options.edge, options.referenceId); break;
    case 'distribute': result = distribute(shapes, options.axis); break;
    case 'space': result = space(shapes, options.axis, options.gap); break;
    case 'match': result = matchSize(shapes, options.dimension, options.referenceId, options.anchor); break;
    case 'swap': result = swap(shapes); break;
    case 'grid': result = grid(shapes, options.columns, options.gap); break;
    default: throw new Error('Unknown layout command.');
  }
  validateShapes(result);
  return result;
}

export function geometryPatch(before, after) {
  return Object.fromEntries(geometryKeys.filter(key => Math.abs(before[key] - after[key]) > 1e-8).map(key => [key, after[key]]));
}
