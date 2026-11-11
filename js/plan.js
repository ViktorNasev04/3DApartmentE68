/* Apartment Е63, read off the architect's floor plan.
   All numbers are centimetres. X runs west → east, Y north → south.
   Origin: the north-west inner corner of the bedroom. In the 3D scene 1 unit = 1 m (x = X/100, z = Y/100).

   The plan is parametric: every wall hangs on a named line (LINES) and can be moved along it.
   Walls, rooms, ceiling zones, door swings, lights and camera views are rebuilt from the current lines by setLines().
   The exports below are live bindings, so other modules always read the current plan. */

export const H = 265;                       // clear ceiling height

/* Lines the walls hang on (cm), with their values on the architect's plan.
   axis 'x': a line of constant X (the wall runs north–south and moves east–west); 'y': constant Y.
   Each line is the face of its wall named in the comment; the wall's thickness lies on the other side. */
export const LINES = {
  core:    { axis: 'x', v: -202, name: 'Западна стена', note: 'баня, склад и антре' },                 // east face of the concrete core
  closet:  { axis: 'x', v: -100, name: 'Стена на склада', note: 'склад / коридор' },                   // east face of the closet partition
  kitchen: { axis: 'x', v: -54,  name: 'Стена на кухнята', note: 'към съседите' },                      // east face of the wall behind the kitchen
  bedW:    { axis: 'x', v: 0,    name: 'Стена баня – спалня', note: 'баня и коридор / спалня' },        // east face of the bedroom's west partition
  niche:   { axis: 'x', v: 18,   name: 'Край на нишата за кухнята', note: 'стената над кухнята', end: true, min: -10, max: 60 },
  bedE:    { axis: 'x', v: 398,  name: 'Стена спалня – лоджия', note: 'с вратата към лоджията' },       // west face of the bedroom's east wall
  livE:    { axis: 'x', v: 456,  name: 'Източна стена на дневната', note: 'при масата' },              // west face
  bay:     { axis: 'x', v: 548,  name: 'Стена с прозореца', note: 'еркерът на дневната' },              // west face
  logE:    { axis: 'x', v: 573,  name: 'Парапет на лоджията' },                                         // west face
  north:   { axis: 'y', v: 0,    name: 'Северна фасада', note: 'баня, спалня и лоджия' },               // south face
  bathS:   { axis: 'y', v: 190,  name: 'Стена баня – коридор' },                                         // north face
  bedS:    { axis: 'y', v: 323,  name: 'Стена спалня – дневна', note: 'зад ТВ стената' },              // north face (bedroom side); the living side is 12 cm south
  corrS:   { axis: 'y', v: 365,  name: 'Стена склад – антре', max: 398 },                                // north face
  cap:     { axis: 'y', v: 510,  name: 'Стена над кухнята', note: 'краят на нишата' },                  // south face
  stub:    { axis: 'y', v: 565,  name: 'Край на прозореца', note: 'късата стена след еркера' },         // north face
  wardN:   { axis: 'y', v: 570,  name: 'Стена зад гардероба', note: 'в антрето', min: 515 },             // north face
  livS:    { axis: 'y', v: 785,  name: 'Южна стена на дневната' },                                      // north face
};
const DEFAULT = Object.freeze(Object.fromEntries(Object.entries(LINES).map(([k, d]) => [k, d.v])));
export const PLAN_LINES = DEFAULT;          // the lines as drawn on the architect's plan
const RANGE = 150;                          // how far a line may move from the plan

/* b − a ≥ g keeps every room, door and window in one piece */
const GAPS = [
  ['core', 'closet', 52], ['closet', 'bedW', 85], ['core', 'kitchen', 85], ['kitchen', 'niche', 40], ['bedW', 'niche', 0],
  ['niche', 'livE', 200], ['livE', 'bay', 20], ['bedW', 'bedE', 250], ['bedE', 'bay', 140], ['bedE', 'logE', 115],
  ['north', 'bathS', 120], ['bathS', 'bedS', 95], ['north', 'bedS', 250], ['bedS', 'corrS', 10], ['bathS', 'corrS', 112],
  ['corrS', 'cap', 72], ['cap', 'wardN', 30], ['bedS', 'stub', 140], ['stub', 'livS', 125], ['cap', 'livS', 150], ['bedS', 'livS', 300],
];

/* Walls are axis-aligned rectangles. kind: rc = concrete, ext = facade, int = partition, parapet.
   line: the line the wall moves with. out: which side faces outdoors or a neighbour; the dollhouse view lowers that wall when
   the camera is on that side. open: openings along the wall's long axis (a0..a1, same axis as the wall) from b0 to b1 above the floor. */
function walls(L){
  const { core, closet, kitchen, bedW, niche, bedE, livE, bay, logE, north, bathS, bedS, corrS, cap, stub, wardN, livS } = L;
  return [
    { id: 'core', line: 'core', x0: core - 40, y0: north - 30, x1: core, y1: wardN + 25, kind: 'rc', out: 'w',
      open: [{ a0: 410, a1: 510, b0: 0, b1: 210, type: 'entrance' }] },
    { id: 'north', line: 'north', x0: core, y0: north - 30, x1: bedE, y1: north, kind: 'ext', out: 'n',
      open: [{ a0: core + 7, a1: core + 77, b0: 160, b1: 250, type: 'window' }] },
    { id: 'bed-log', line: 'bedE', x0: bedE, y0: north - 30, x1: bedE + 40, y1: bedS + 12, kind: 'ext', out: 'e',
      open: [{ a0: north + 65, a1: north + 245, b0: 0, b1: 245, type: 'balcony' }] },
    { id: 'log-n', line: 'north', x0: bedE + 40, y0: north - 30, x1: logE + 25, y1: north, kind: 'ext', out: 'n' },
    { id: 'log-e', line: 'logE', x0: logE, y0: north, x1: logE + 25, y1: bedS, kind: 'parapet', h: 105, out: 'e' },
    { id: 'log-liv', line: 'bedS', x0: bedE + 40, y0: bedS, x1: logE + 25, y1: bedS + 12, kind: 'ext', out: 'n',
      open: [{ a0: bedE + 40, a1: bedE + 140, b0: 0, b1: 245, type: 'glassdoor' }] },
    { id: 'bay', line: 'bay', x0: bay, y0: bedS + 12, x1: bay + 35, y1: stub, kind: 'ext', out: 'e',
      open: [{ a0: bedS + 17, a1: stub - 5, b0: 45, b1: 245, type: 'window' }] },
    { id: 'stub', line: 'stub', x0: livE, y0: stub, x1: bay + 35, y1: stub + 25, kind: 'ext', out: 's' },
    { id: 'east', line: 'livE', x0: livE, y0: stub + 25, x1: livE + 35, y1: livS + 35, kind: 'ext', out: 'e' },
    { id: 'south', line: 'livS', x0: kitchen - 25, y0: livS, x1: livE, y1: livS + 35, kind: 'rc', out: 's' },
    { id: 'e64', line: 'kitchen', x0: kitchen - 25, y0: cap - 12, x1: kitchen, y1: livS, kind: 'rc', out: 'w' },
    { id: 'ward', line: 'wardN', x0: core, y0: wardN, x1: kitchen - 25, y1: wardN + 25, kind: 'rc', out: 's' },
    { id: 'cap', line: 'cap', x0: kitchen, y0: cap - 12, x1: niche, y1: cap, kind: 'int' },
    { id: 'bed-w', line: 'bedW', x0: bedW - 12, y0: north, x1: bedW, y1: bedS + 12, kind: 'int',
      open: [{ a0: bedS - 83, a1: bedS - 3, b0: 0, b1: 210, type: 'door', hinge: 1, side: 1 }] },
    { id: 'bed-s', line: 'bedS', x0: bedW, y0: bedS, x1: bedE, y1: bedS + 12, kind: 'int' },
    { id: 'column', line: 'bedS', x0: 85, y0: bedS - 10, x1: 113, y1: bedS, kind: 'rc' },
    { id: 'bath-s', line: 'bathS', x0: core, y0: bathS, x1: bedW - 12, y1: bathS + 12, kind: 'int',
      open: [{ a0: closet - 10, a1: bedW - 35, b0: 0, b1: 210, type: 'door', hinge: 1, side: -1 }] },
    { id: 'closet', line: 'closet', x0: closet - 12, y0: bathS + 12, x1: closet, y1: corrS, kind: 'int',
      open: [{ a0: bedS - 73, a1: bedS - 3, b0: 0, b1: 210, type: 'door', hinge: 1, side: 1 }] },
    { id: 'corr-s', line: 'corrS', x0: core, y0: corrS, x1: closet, y1: corrS + 12, kind: 'int' },
  ];
}

/* Rooms: official areas from the plan (area0, for the walls as drawn), floor rectangles [x0, y0, x1, y1] with thresholds,
   label: where the name sits in the top view. */
function rooms(L){
  const { core, closet, kitchen, bedW, niche, bedE, livE, bay, logE, north, bathS, bedS, corrS, cap, stub, wardN, livS } = L;
  return [
    { id: 'living', name: 'Дневна с кухня', code: 'Е63.2', area0: 23.48,
      rects: [[niche, bedS + 12, bay, stub], [niche, stub, livE, livS], [kitchen, cap, niche, livS]], label: [livE - 186, livS - 145] },
    { id: 'bed', name: 'Спалня', code: 'Е63.5', area0: 12.79,
      rects: [[bedW, north, bedE, bedS], [bedW - 12, bedS - 83, bedW, bedS - 3]], label: [(bedW + bedE)/2 + 1, bedS - 73] },
    { id: 'bath', name: 'Баня', code: 'Е63.4', area0: 3.61,
      rects: [[core, north, bedW - 12, bathS], [closet - 10, bathS, bedW - 35, bathS + 12]], label: [(core + bedW - 12)/2, bathS - 70] },
    { id: 'corridor', name: 'Коридор и склад', code: 'Е63.3', area0: 3.06,
      rects: [[closet, bathS + 12, bedW - 12, corrS + 12], [core, bathS + 12, closet - 12, corrS], [closet - 12, bedS - 73, closet, bedS - 3]],
      label: [(closet + bedW - 12)/2, (bathS + corrS)/2 + 12] },
    { id: 'antre', name: 'Антре', code: 'Е63.1', area0: 3.72,
      rects: [[core, corrS + 12, niche, cap], [core, cap, kitchen - 25, wardN], [bedW - 12, bedS + 12, niche, corrS + 12], [core - 40, 410, core, 510]],
      label: [(core + niche)/2, (corrS + 12 + cap)/2 + 1] },
    { id: 'loggia', name: 'Лоджия', code: 'Е63.6', area0: 4.39,
      rects: [[bedE + 40, north, logE, bedS], [bedE, north + 65, bedE + 40, north + 245], [bedE + 40, bedS, bedE + 140, bedS + 12]],
      label: [(bedE + 40 + logE)/2, north + 170] },
  ];
}

/* Zones of the suspended ceiling with the LED cove: the open living space with the kitchen, hall and passage,
   the bedroom and the bathroom. The storage closet and the loggia keep a plain ceiling. maxBand caps the band in small rooms.
   The rectangles are the same as the rooms' (the shell matches them by value). */
function zones(L, R){
  const r = id => R.find(q => q.id === id).rects;
  const [liv, bed, bath, corr, antre] = ['living', 'bed', 'bath', 'corridor', 'antre'].map(r);
  return [
    { id: 'open', rects: [...liv, antre[0], antre[1], antre[2], corr[0]] },
    { id: 'bed', rects: [bed[0]] },
    { id: 'bath', rects: [bath[0]], maxBand: 0.35 },
  ];
}

/* Ceiling lights (evening mode), [X, Y] */
function lights(L){
  const { core, closet, bedW, niche, bedE, livE, logE, north, bathS, bedS, corrS, cap, livS } = L;
  const bx = (core + bedW - 12)/2;
  return [
    { room: 'living', at: [livE - 168, bedS + 147], light: 1.3 }, { room: 'living', at: [niche + 102, livS - 95], small: true },
    { room: 'bed', at: [bedE - 169, north + 165], light: 1.1, r: 0.30 },
    { room: 'bath', at: [bx, (north + bathS)/2], light: 0.6, spots: [[core + 45, north + 50], [bedW - 62, north + 52], [bx, bathS - 50]] },
    { room: 'corridor', at: [(closet + bedW - 12)/2, (bathS + corrS)/2 + 12], small: true },
    { room: 'antre', at: [(core + niche)/2, (corrS + 12 + cap)/2 + 1], small: true, light: 0.5 },
    { room: 'loggia', at: [(bedE + 40 + logE)/2, north + 160], small: true },
  ];
}

/* Floor area swept by doors that open into a room (metres): keep free when placing things automatically */
function swings(L){
  const { core, closet, bedW, bedE, north, bathS, bedS } = L;
  const m = (id, x0, z0, x1, z1) => ({ id, x0: x0/100, z0: z0/100, x1: x1/100, z1: z1/100 });
  return [
    m('loggia', bedE + 40, bedS + 12, bedE + 140, bedS + 112),
    m('balcony', bedE - 90, north + 155, bedE, north + 245),
    m('bedroom', bedW, bedS - 83, bedW + 80, bedS - 3),
    m('bath', closet - 10, bathS - 75, bedW - 35, bathS),
    m('closet', closet, bedS - 73, closet + 70, bedS - 3),
    m('entrance', core, 410, core + 100, 510),
  ];
}

/* Camera presets in metres: p = eye, t = target, h = horizontal field of view. Room views follow the walls. */
function views(L){
  const { core, kitchen, bedW, bedE, livE, bedS, livS } = L;
  return {
    over:    { name: 'Целият апартамент', p: [9.6, 9.2, 12.4], t: [1.78, 0.4, 3.95], h: 44, fit: true },
    top:     { name: 'Отгоре', p: [1.78, 21.0, 3.96], t: [1.78, 0, 3.95], h: 30, fit: true },
    living:  { name: 'Дневна', p: [1.85, 1.62, (livS - 20)/100], t: [3.00, 1.05, (bedS + 39)/100], h: 74, room: 'living' },
    ceiling: { name: 'Таванът', p: [0.75, 1.45, (livS - 40)/100], t: [3.55, 2.15, 4.25], h: 84, room: 'living' },
    kitchen: { name: 'Кухня', p: [(livE - 61)/100, 1.62, 5.55], t: [(kitchen + 34)/100, 1.05, 6.75], h: 72, room: 'living' },
    bed:     { name: 'Спалня', p: [(bedE - 23)/100, 1.62, (bedS - 18)/100], t: [1.35, 0.85, 0.55], h: 76, room: 'bed' },
    bath:    { name: 'Баня', p: [(bedW - 22)/100, 1.60, 1.12], t: [(core + 27)/100, 0.95, 0.42], h: 92, room: 'bath' },
    antre:   { name: 'Антре', p: [0.95, 1.60, 4.62], t: [(core + 2)/100, 1.10, 4.42], h: 76, room: 'antre' },
    loggia:  { name: 'Лоджия', p: [(bedE + 72)/100, 1.62, (bedS - 18)/100], t: [5.25, 0.85, 0.20], h: 78, room: 'loggia' },
  };
}

/* Room sizes the user can type in. a..b is the measured span (cm) along `axis`; `edit` is the line that moves when the
   number changes (chosen so the living room keeps its size when another room is adjusted); `at` places the dimension line. */
export const MEASURES = [
  { id: 'liv-d',  room: 'living', name: 'Дълбочина, от спалнята до южната стена', axis: 'y', a: L => L.bedS + 12, b: L => L.livS, edit: 'livS', at: L => L.livE - 60 },
  { id: 'liv-w',  room: 'living', name: 'Ширина при кухнята', axis: 'x', a: L => L.kitchen, b: L => L.livE, edit: 'livE', at: L => L.livS - 40 },
  { id: 'liv-w2', room: 'living', name: 'Ширина при прозореца', axis: 'x', a: L => L.niche, b: L => L.bay, edit: 'bay', at: L => L.bedS + 100 },
  { id: 'liv-n',  room: 'living', name: 'До края на прозореца', axis: 'y', a: L => L.bedS + 12, b: L => L.stub, edit: 'stub', at: L => L.bay - 45 },
  { id: 'kit-d',  room: 'living', name: 'Нишата за кухнята, дължина', axis: 'y', a: L => L.cap, b: L => L.livS, edit: 'cap', at: L => L.niche - 18 },
  { id: 'kit-w',  room: 'living', name: 'Нишата за кухнята, ширина', axis: 'x', a: L => L.kitchen, b: L => L.niche, edit: 'niche', at: L => L.cap + 40 },
  { id: 'bed-w',  room: 'bed', name: 'Ширина', axis: 'x', a: L => L.bedW, b: L => L.bedE, edit: 'bedE', at: L => L.bedS - 18 },
  { id: 'bed-d',  room: 'bed', name: 'Дълбочина', axis: 'y', a: L => L.north, b: L => L.bedS, edit: 'north', at: L => L.bedE - 45 },
  { id: 'bath-w', room: 'bath', name: 'Ширина', axis: 'x', a: L => L.core, b: L => L.bedW - 12, edit: 'core', at: L => L.north + 25 },
  { id: 'bath-d', room: 'bath', name: 'Дълбочина', axis: 'y', a: L => L.north, b: L => L.bathS, edit: 'bathS', at: L => L.bedW - 30 },
  { id: 'store-w', room: 'corridor', name: 'Склад, ширина', axis: 'x', a: L => L.core, b: L => L.closet - 12, edit: 'closet', at: L => L.bathS + 45 },
  { id: 'store-d', room: 'corridor', name: 'Склад, дълбочина', axis: 'y', a: L => L.bathS + 12, b: L => L.corrS, edit: 'corrS', at: L => L.closet - 40 },
  { id: 'antre-d', room: 'antre', name: 'Дълбочина до гардероба', axis: 'y', a: L => L.corrS + 12, b: L => L.wardN, edit: 'wardN', at: L => L.core + 35 },
  { id: 'log-w',  room: 'loggia', name: 'Ширина', axis: 'x', a: L => L.bedE + 40, b: L => L.logE, edit: 'logE', at: L => L.north + 290 },
];
export const measureOf = (m, L = LINE) => m.b(L) - m.a(L);

const rectArea = rects => rects.reduce((s, q) => s + (q[2] - q[0])*(q[3] - q[1]), 0);
const AREA0 = Object.fromEntries(rooms(DEFAULT).map(r => [r.id, rectArea(r.rects)]));

/* ---------- the current plan (live bindings) ---------- */
export let LINE = { ...DEFAULT };           // current value of every line (cm)
export let WALLS = [], ROOMS = [], CEIL_ZONES = [], CEILING_LIGHTS = [], DOOR_SWINGS = [], VIEWS = {}, WALL_RECTS = [];
export let BOUNDS = { x0: 0, z0: 0, x1: 0, z1: 0 };
export let TOTAL_AREA = 61.77;              // with the share of walls, as on the plan
export let PLAN_KEY = '';

/* allowed interval for one line, given all the others */
export function lineRange(id, L = LINE){
  const d = LINES[id];
  let lo = d.min ?? d.v - RANGE, hi = d.max ?? d.v + RANGE;
  for (const [a, b, g] of GAPS){ if (b === id) lo = Math.max(lo, L[a] + g); if (a === id) hi = Math.min(hi, L[b] - g); }
  return [lo, hi];
}
export function clampLine(id, v, L = LINE){
  const [lo, hi] = lineRange(id, L);
  return lo > hi ? L[id] : Math.round(Math.min(hi, Math.max(lo, v)));
}
/* overrides → a full, valid set of lines (a few passes so moves that depend on each other settle) */
export function resolveLines(over = {}){
  const L = { ...DEFAULT };
  const keys = Object.keys(over).filter(k => LINES[k] && Number.isFinite(+over[k]));
  for (let pass = 0; pass < 3; pass++) for (const k of keys) L[k] = clampLine(k, +over[k], L);
  return L;
}
/* only the lines that differ from the plan */
export function overridesOf(L){
  const o = {};
  for (const k of Object.keys(LINES)) if (L[k] !== DEFAULT[k]) o[k] = L[k];
  return o;
}
export const defaultLine = id => DEFAULT[id];

export function setLines(over = {}){
  const L = resolveLines(over);
  const key = JSON.stringify(overridesOf(L));
  if (key === PLAN_KEY && WALLS.length) return false;
  PLAN_KEY = key; LINE = L;
  WALLS = walls(L);
  ROOMS = rooms(L).map(r => ({ ...r, area: Math.round((r.area0 + (rectArea(r.rects) - AREA0[r.id])/1e4)*100)/100 }));
  CEIL_ZONES = zones(L, ROOMS);
  CEILING_LIGHTS = lights(L);
  DOOR_SWINGS = swings(L);
  VIEWS = views(L);
  WALL_RECTS = WALLS.map(w => ({ id: w.id, line: w.line, x0: w.x0/100, z0: w.y0/100, x1: w.x1/100, z1: w.y1/100, low: w.kind === 'parapet' }));
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const r of ROOMS) for (const q of r.rects){ x0 = Math.min(x0, q[0]); z0 = Math.min(z0, q[1]); x1 = Math.max(x1, q[2]); z1 = Math.max(z1, q[3]); }
  BOUNDS = { x0: x0/100, z0: z0/100, x1: x1/100, z1: z1/100 };
  TOTAL_AREA = Math.round((61.77 + ROOMS.reduce((s, r) => s + r.area - r.area0, 0))*100)/100;
  return true;
}
setLines({});

export const cm = v => v / 100;

/* Room under a point (metres) or null */
export function roomAt(x, z) {
  const X = x * 100, Y = z * 100;
  for (const r of ROOMS) for (const [x0, y0, x1, y1] of r.rects) if (X >= x0 && X <= x1 && Y >= y0 && Y <= y1) return r;
  return null;
}
