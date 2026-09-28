// Original 20px line icons. Accent color marks the edge, gap, or size being changed.
const ns = 'http://www.w3.org/2000/svg';
const paths = {
  refresh: ['M16 7a6 6 0 1 0 0 6', 'M16 3v4h-4'],
  copy: ['M7 5V3h10v12h-3', 'M3 7h10v10H3z'],
  apply: ['M4 3h12v5H4z', 'M10 8v3H7v6h3v-4'],
  swap: ['M3 6h13l-3-3M17 14H4l3 3', 'M4 9v3M16 8v3'],
  grid: ['M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h5v5h-5z'],
  'equal-h': ['M2 5h3v10H2zM8 3h4v14H8zM15 5h3v10h-3z', 'M5 10h3M12 10h3'],
  'equal-v': ['M5 2h10v3H5zM3 8h14v4H3zM5 15h10v3H5z', 'M10 5v3M10 12v3'],
  'space-h': ['M2 4h5v12H2zM13 4h5v12h-5z', 'M7 10h6M9 8l-2 2 2 2M11 8l2 2-2 2'],
  'space-v': ['M4 2h12v5H4zM4 13h12v5H4z', 'M10 7v6M8 9l2-2 2 2M8 11l2 2 2-2'],
  width: ['M3 7h14v10H3z', 'M3 3h14M3 1v4M17 1v4M7 10l-3 2 3 2M13 10l3 2-3 2'],
  height: ['M7 3h10v14H7z', 'M3 3v14M1 3h4M1 17h4M10 7l2-3 2 3M10 13l2 3 2-3'],
  both: ['M7 7h10v10H7z', 'M7 3h10M7 1v4M17 1v4M3 7v10M1 7h4M1 17h4'],
  save: ['M3 3h12l2 2v12H3zM6 3v5h8V3M6 17v-6h8v6'],
  load: ['M2 6h6l2 2h8l-3 9H2zM2 6V3h6l2 3h6v2'],
  trash: ['M4 5h12M7 5V3h6v2M6 5l1 12h6l1-12M9 8v6M11 8v6'],
  angles: ['M2 5h5l4 5-4 5H2l4-5zM11 3h4l4 7-4 7h-4l4-7z','M7 5l4 5-4 5'],
  chain: ['M1 5h5l4 5-4 5H1l4-5zM10 5h5l4 5-4 5h-5l4-5z','M7 10h6'],
  handles: ['M3 3h12l3 7-3 7H3l3-7z','M15 1v4M13 3h4M1 10h4M3 8v4'],
  arrow: ['M2 7h9V3l7 7-7 7v-4H2z','M11 3v14'],
  radius: ['M3 17V8a5 5 0 0 1 5-5h9','M8 3v5H3M8 8l4 4'],
  margins: ['M2 2h16v16H2zM6 6h8v8H6z','M2 5h4M14 5h4M5 2v4M5 14v4'],
  'fit-shape': ['M5 5h10v10H5zM8 8h4M10 8v4','M1 6V1h5M14 1h5v5M19 14v5h-5M6 19H1v-5'],
  'fit-text': ['M2 2h16v16H2zM6 6h8M10 6v8','M3 10h3M14 10h3'],
  wrap: ['M3 4h14M3 8h10M3 13h6M3 17h14','M16 8v5H9l3-3M9 13l3 3'],
  split: ['M2 2h16v5H2zM2 13h16v5H2z','M1 10h18M10 7v6'],
  merge: ['M2 2h5v16H2zM13 2h5v16h-5z','M6 10h8M8 8l2 2-2 2M12 8l-2 2 2 2'],
  bullets: ['M7 4h11M7 10h11M7 16h11','M2 4h1M2 10h1M2 16h1'],
  numbering: ['M7 4h11M7 10h11M7 16h11','M2 2h1v4M1 8h3v2H1v2h3M1 14h3v4H1M2 16h2'],
  'plain-text': ['M3 4h14M3 10h14M3 16h14'],
  indent: ['M2 3h16M8 8h10M8 12h10M2 17h16','M2 7l3 3-3 3'],
  outdent: ['M2 3h16M8 8h10M8 12h10M2 17h16','M5 7l-3 3 3 3'],
  'no-fit': ['M3 3h14v14H3zM6 7h8M10 7v6','M2 18L18 2'],
  'text-left': ['M2 3h16M2 7h10M2 11h16M2 15h10'],
  'text-center': ['M2 3h16M5 7h10M2 11h16M5 15h10'],
  'text-right': ['M2 3h16M8 7h10M2 11h16M8 15h10'],
};

function node(tag, attrs) {
  const result = document.createElementNS(ns, tag);
  for (const [name, value] of Object.entries(attrs)) result.setAttribute(name, value);
  return result;
}

export function icon(name) {
  const svg = node('svg', { viewBox: '0 0 20 20', 'aria-hidden': 'true', fill: 'none',
    stroke: 'currentColor', 'stroke-width': '1.3', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  if (name.startsWith('align-')) {
    const edge = name.slice(6), horizontal = ['left', 'center', 'right'].includes(edge);
    const fraction = ({ left: 0, center: .5, right: 1, top: 0, middle: .5, bottom: 1 })[edge];
    const coordinate = 3 + 14 * fraction;
    [7, 12].forEach((length, i) => svg.append(node('rect', horizontal ?
      { x: coordinate - length * fraction, y: 4 + i * 8, width: length, height: 4, rx: .5, class: 'icon-shape' } :
      { y: coordinate - length * fraction, x: 4 + i * 8, height: length, width: 4, rx: .5, class: 'icon-shape' })));
    svg.append(node('path', { d: horizontal ? `M${coordinate} 1v18` : `M1 ${coordinate}h18`, class: 'icon-accent' }));
  } else {
    (paths[name] || []).forEach((d, i) => svg.append(node('path', { d, class: i ? 'icon-accent' : 'icon-base' })));
  }
  return svg;
}
