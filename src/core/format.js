export const defaultStyle = Object.freeze({
  fill: '#E7EDDE', line: '#72816A', lineWidth: 1,
  font: 'Arial', fontSize: 18, fontColor: '#24372B', bold: false,
});

export function validateStyle(style) {
  if (!style || typeof style !== 'object') throw new Error('Choose a valid format.');
  const result = {};
  for (const key of ['fill', 'line', 'fontColor']) {
    if (style[key] !== undefined) {
      if (typeof style[key] !== 'string' || !/^#[\da-f]{6}$/i.test(style[key])) throw new Error(`${key} must be a six-digit hex color.`);
      result[key] = style[key].toUpperCase();
    }
  }
  for (const [key, minimum, maximum] of [['lineWidth', 0, 50], ['fontSize', 1, 400]]) {
    if (style[key] !== undefined) {
      if (!Number.isFinite(style[key]) || style[key] < minimum || style[key] > maximum) throw new Error(`${key} must be between ${minimum} and ${maximum}.`);
      result[key] = style[key];
    }
  }
  if (style.font !== undefined) {
    if (typeof style.font !== 'string' || !style.font.trim() || style.font.length > 100) throw new Error('Enter a font name of 1–100 characters.');
    result.font = style.font.trim();
  }
  if (style.bold !== undefined) {
    if (typeof style.bold !== 'boolean') throw new Error('Bold must be true or false.');
    result.bold = style.bold;
  }
  if (!Object.keys(result).length) throw new Error('Choose at least one format property.');
  return result;
}

export function applyStyle(shapes, style) {
  if (!shapes.length) throw new Error('Select at least one shape.');
  const valid = validateStyle(style);
  return shapes.map(s => ({ ...s, style: { ...s.style, ...valid } }));
}

export function parsePresets(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 30).flatMap(p => {
      try {
        if (typeof p.name !== 'string' || !p.name.trim()) return [];
        return [{ name: p.name.trim().slice(0, 60), style: validateStyle(p.style) }];
      } catch { return []; }
    });
  } catch { return []; }
}
