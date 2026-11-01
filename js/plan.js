/* Apartment Е63, read off the architect's floor plan.
   All numbers are centimetres. X runs west → east, Y north → south.
   Origin: the north-west inner corner of the bedroom. In the 3D scene 1 unit = 1 m (x = X/100, z = Y/100). */

export const H = 265;                       // clear ceiling height

/* Walls are axis-aligned rectangles. kind: rc = concrete, ext = facade, int = partition, parapet.
   out: which side faces outdoors or a neighbour; the dollhouse view lowers that wall when the camera is on that side.
   open: openings along the wall's long axis (a0..a1, same axis as the wall) from b0 to b1 above the floor. */
export const WALLS = [
  { id: 'core', x0: -242, y0: -30, x1: -202, y1: 595, kind: 'rc', out: 'w',
    open: [{ a0: 410, a1: 510, b0: 0, b1: 210, type: 'entrance' }] },
  { id: 'north', x0: -202, y0: -30, x1: 398, y1: 0, kind: 'ext', out: 'n',
    open: [{ a0: -195, a1: -125, b0: 160, b1: 250, type: 'window' }] },
  { id: 'bed-log', x0: 398, y0: -30, x1: 438, y1: 335, kind: 'ext', out: 'e',
    open: [{ a0: 65, a1: 245, b0: 0, b1: 245, type: 'balcony' }] },
  { id: 'log-n', x0: 438, y0: -30, x1: 598, y1: 0, kind: 'ext', out: 'n' },
  { id: 'log-e', x0: 573, y0: 0, x1: 598, y1: 323, kind: 'parapet', h: 105, out: 'e' },
  { id: 'log-liv', x0: 438, y0: 323, x1: 598, y1: 335, kind: 'ext', out: 'n',
    open: [{ a0: 438, a1: 538, b0: 0, b1: 245, type: 'glassdoor' }] },
  { id: 'bay', x0: 548, y0: 335, x1: 583, y1: 565, kind: 'ext', out: 'e',
    open: [{ a0: 340, a1: 560, b0: 45, b1: 245, type: 'window' }] },
  { id: 'stub', x0: 456, y0: 565, x1: 583, y1: 590, kind: 'ext', out: 's' },
  { id: 'east', x0: 456, y0: 590, x1: 491, y1: 820, kind: 'ext', out: 'e' },
  { id: 'south', x0: -79, y0: 785, x1: 456, y1: 820, kind: 'rc', out: 's' },
  { id: 'e64', x0: -79, y0: 498, x1: -54, y1: 785, kind: 'rc', out: 'w' },
  { id: 'ward', x0: -202, y0: 570, x1: -79, y1: 595, kind: 'rc', out: 's' },
  { id: 'cap', x0: -54, y0: 498, x1: 18, y1: 510, kind: 'int' },
  { id: 'bed-w', x0: -12, y0: 0, x1: 0, y1: 335, kind: 'int',
    open: [{ a0: 240, a1: 320, b0: 0, b1: 210, type: 'door', hinge: 1, side: 1 }] },
  { id: 'bed-s', x0: 0, y0: 323, x1: 398, y1: 335, kind: 'int' },
  { id: 'column', x0: 85, y0: 313, x1: 113, y1: 323, kind: 'rc' },
  { id: 'bath-s', x0: -202, y0: 190, x1: -12, y1: 202, kind: 'int',
    open: [{ a0: -110, a1: -35, b0: 0, b1: 210, type: 'door', hinge: 1, side: -1 }] },
  { id: 'closet', x0: -112, y0: 202, x1: -100, y1: 365, kind: 'int',
    open: [{ a0: 250, a1: 320, b0: 0, b1: 210, type: 'door', hinge: 1, side: 1 }] },
  { id: 'corr-s', x0: -202, y0: 365, x1: -100, y1: 377, kind: 'int' },
];

/* Rooms: official areas from the plan, floor rectangles [x0, y0, x1, y1] (thresholds included),
   label: where the name sits in the top view. */
export const ROOMS = [
  { id: 'living', name: 'Дневна с кухня', code: 'Е63.2', area: 23.48,
    rects: [[18, 335, 548, 565], [18, 565, 456, 785], [-54, 510, 18, 785]], label: [270, 640] },
  { id: 'bed', name: 'Спалня', code: 'Е63.5', area: 12.79,
    rects: [[0, 0, 398, 323], [-12, 240, 0, 320]], label: [200, 250] },
  { id: 'bath', name: 'Баня', code: 'Е63.4', area: 3.61,
    rects: [[-202, 0, -12, 190], [-110, 190, -35, 202]], label: [-107, 120] },
  { id: 'corridor', name: 'Коридор и склад', code: 'Е63.3', area: 3.06,
    rects: [[-100, 202, -12, 377], [-202, 202, -112, 365], [-112, 250, -100, 320]], label: [-56, 290] },
  { id: 'antre', name: 'Антре', code: 'Е63.1', area: 3.72,
    rects: [[-202, 377, 18, 510], [-202, 510, -79, 570], [-12, 335, 18, 377], [-242, 410, -202, 510]], label: [-92, 445] },
  { id: 'loggia', name: 'Лоджия', code: 'Е63.6', area: 4.39,
    rects: [[438, 0, 573, 323], [398, 65, 438, 245], [438, 323, 538, 335]], label: [505, 170] },
];

export const TOTAL_AREA = 61.77;            // with the share of walls, as on the plan

/* Ceiling lights (evening mode), [X, Y] */
export const CEILING_LIGHTS = [
  { room: 'living', at: [288, 470], light: 1.3 }, { room: 'living', at: [120, 690], small: true },
  { room: 'bed', at: [229, 165], light: 1.1, r: 0.30 }, { room: 'bath', at: [-107, 95], light: 0.6, spots: [[-157, 50], [-62, 52], [-107, 140]] },
  { room: 'corridor', at: [-56, 290], small: true }, { room: 'antre', at: [-92, 445], small: true, light: 0.5 },
  { room: 'loggia', at: [505, 160], small: true },
];

/* Camera presets in metres: p = eye, t = target, h = horizontal field of view. */
export const VIEWS = {
  over:    { name: 'Целият апартамент', p: [9.6, 9.2, 12.4], t: [1.78, 0.4, 3.95], h: 44, fit: true },
  top:     { name: 'Отгоре', p: [1.78, 21.0, 3.96], t: [1.78, 0, 3.95], h: 30, fit: true },
  living:  { name: 'Дневна', p: [1.85, 1.62, 7.65], t: [3.00, 1.05, 3.62], h: 74, room: 'living' },
  kitchen: { name: 'Кухня', p: [3.95, 1.62, 5.55], t: [-0.20, 1.05, 6.75], h: 72, room: 'living' },
  bed:     { name: 'Спалня', p: [3.75, 1.62, 3.05], t: [1.35, 0.85, 0.55], h: 76, room: 'bed' },
  bath:    { name: 'Баня', p: [-0.22, 1.60, 1.12], t: [-1.75, 0.95, 0.42], h: 92, room: 'bath' },
  antre:   { name: 'Антре', p: [0.95, 1.60, 4.62], t: [-2.00, 1.10, 4.42], h: 76, room: 'antre' },
  loggia:  { name: 'Лоджия', p: [4.70, 1.62, 3.05], t: [5.25, 0.85, 0.20], h: 78, room: 'loggia' },
};

export const cm = v => v / 100;

/* Room under a point (metres) or null */
export function roomAt(x, z) {
  const X = x * 100, Y = z * 100;
  for (const r of ROOMS) for (const [x0, y0, x1, y1] of r.rects) if (X >= x0 && X <= x1 && Y >= y0 && Y <= y1) return r;
  return null;
}

/* Wall rectangles in metres, for snapping and clearance */
export const WALL_RECTS = WALLS.map(w => ({ id: w.id, x0: w.x0 / 100, z0: w.y0 / 100, x1: w.x1 / 100, z1: w.y1 / 100, low: w.kind === 'parapet' }));

/* Floor extent of the whole flat (metres) */
export const BOUNDS = (() => {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const r of ROOMS) for (const q of r.rects) { x0 = Math.min(x0, q[0]); z0 = Math.min(z0, q[1]); x1 = Math.max(x1, q[2]); z1 = Math.max(z1, q[3]); }
  return { x0: x0 / 100, z0: z0 / 100, x1: x1 / 100, z1: z1 / 100 };
})();
