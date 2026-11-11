/* Dolby Atmos layout: angles from the listening position to every speaker, and a 5.1.2 kit placed around the sofa. */
import { TYPES, shapesOf, sofaDims } from './catalog.js';
import { WALL_RECTS, DOOR_SWINGS, roomAt } from './plan.js';

const D2R = Math.PI/180, EAR = 1.05;

/* Dolby's recommended angles; "near" is still workable */
export const RANGES = {
  center:   { ok: [0, 5],     near: [0, 10],   text: '0°' },
  front:    { ok: [22, 30],   near: [15, 36],  text: '22–30°' },
  surround: { ok: [110, 120], near: [90, 135], text: '110–120°' },
  top:      { ok: [65, 100],  near: [45, 120], text: '65–100°, най-добре 80°' },
};
const NAMES = { center: 'Централна', front: 'Предна', surround: 'Задна', top: 'Таванна', sub: 'Субуфер' };
export const SOUND_TYPES = new Set(['speaker', 'centerspk', 'sub', 'ceilspk', 'listener']);
export const isSound = (it) => !!it && (SOUND_TYPES.has(it.type) || (it.type === 'tvunit' && it.p.audio === 'lcr'));

const toWorld = (it, lx, lz) => { const a = it.rot*D2R, c = Math.cos(a), s = Math.sin(a); return [it.x + lx*c + lz*s, it.z - lx*s + lz*c]; };

/* every speaker in the layout, in world coordinates */
function sources(items, ceilingY){
  const out = [];
  for (const it of items){
    const T = TYPES[it.type]; if (!T || !T.sources) continue;
    for (const s of T.sources(it.p)){
      const [x, z] = toWorld(it, s.x, s.z);
      out.push({ id: it.id, role: s.role, x, z, y: s.y == null ? ceilingY(x, z) - 0.02 : s.y });
    }
  }
  return out;
}

/* angle of each speaker as seen from the listener, with a verdict against Dolby's ranges */
export function diagram(items, ceilingY){
  const L = items.find(i => i.type === 'listener'); if (!L) return null;
  const a = L.rot*D2R, f = [Math.sin(a), Math.cos(a)], r = [-Math.cos(a), Math.sin(a)];
  const speakers = sources(items, ceilingY).map(s => {
    const vx = s.x - L.x, vz = s.z - L.z, fwd = vx*f[0] + vz*f[1], side = vx*r[0] + vz*r[1];
    const az = Math.atan2(side, fwd)/D2R;
    let role = s.role, value = null, text = 'суб';
    if (role === 'speaker') role = Math.abs(az) < 60 ? 'front' : 'surround';
    if (role === 'top'){ value = Math.atan2(s.y - EAR, fwd)/D2R; text = `${Math.round(value)}° ↑`; }
    else if (role !== 'sub'){ value = Math.abs(az); text = `${Math.round(value)}°`; }
    const R = RANGES[role];
    const status = value == null || !R ? 'info' : value >= R.ok[0] - 0.5 && value <= R.ok[1] + 0.5 ? 'ok' : value >= R.near[0] && value <= R.near[1] ? 'near' : 'bad';
    const name = NAMES[role] + (role === 'center' || role === 'sub' ? '' : az < 0 ? ' лява' : ' дясна');
    return { ...s, role, az, value, text, status, name, dist: Math.hypot(vx, vz, s.y - EAR) };
  });
  return { listener: L, ear: [L.x, EAR, L.z], speakers };
}

/* first wall face hit by a ray on the floor plan (axis-aligned rectangles, slab test) */
function rayWall(o, d, maxT){
  let best = null;
  for (const w of WALL_RECTS){
    let t0 = 0.05, t1 = maxT;
    for (const [oo, dd, lo, hi] of [[o[0], d[0], w.x0, w.x1], [o[1], d[1], w.z0, w.z1]]){
      if (Math.abs(dd) < 1e-9){ if (oo < lo || oo > hi){ t0 = Infinity; break; } continue; }
      let a = (lo - oo)/dd, b = (hi - oo)/dd; if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    if (t0 <= t1 && (!best || t0 < best)) best = t0;
  }
  return best;
}

function inDoorSwing(type, p, x, z, rot){
  const a = rot*D2R, c = Math.cos(a), s = Math.sin(a);
  for (const [x0, z0, x1, z1] of shapesOf(type, p)){
    const pts = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([lx, lz]) => [x + lx*c + lz*s, z - lx*s + lz*c]);
    const bx0 = Math.min(...pts.map(q => q[0])), bx1 = Math.max(...pts.map(q => q[0])), bz0 = Math.min(...pts.map(q => q[1])), bz1 = Math.max(...pts.map(q => q[1]));
    if (DOOR_SWINGS.some(d => bx0 < d.x1 && bx1 > d.x0 && bz0 < d.z1 && bz1 > d.z0)) return true;
  }
  return false;
}

/* 5.1.2 around the sofa: listener on the middle seat, L/C/R in the TV unit (or on stands), surrounds at 115°,
   two ceiling speakers 80° up, the subwoofer where it fits. Returns a new layout; earlier sound pieces are replaced. */
export function soundKit(layout, { problems, ceilingY, fieldAt }){
  const items = layout.items.filter(i => !SOUND_TYPES.has(i.type));
  const sofa = items.find(i => i.type === 'sofa');
  if (!sofa) return { error: 'Няма диван в модела. Сложи диван и пробвай пак.' };
  const p = sofaDims(sofa.p), depth = p.kind === 'straight' ? p.D : Math.max(p.C, p.D + 0.4);
  const s0 = p.kind === 'corner-l' ? -p.L/2 + 0.95 : -p.L/2 + 0.28;
  const s1 = p.kind === 'corner-r' ? p.L/2 - 0.95 : p.L/2 - 0.28;
  const lx0 = (s0 + s1)/2;
  const [Lx, Lz] = toWorld(sofa, lx0, -depth/2 + 0.32);
  const a = sofa.rot*D2R, f = [Math.sin(a), Math.cos(a)], r = [-Math.cos(a), Math.sin(a)];
  const at = (fw, rt) => [Lx + f[0]*fw + r[0]*rt, Lz + f[1]*fw + r[1]*rt];
  const face = (x, z) => Math.atan2(Lx - x, Lz - z)/D2R;
  const out = items.map(i => ({ ...i, p: { ...i.p } }));
  let n = 0;
  const add = (type, x, z, rot, pp) => { out.push({ id: `snd-${type}-${n++}`, type, x: Math.round(x*1000)/1000, z: Math.round(z*1000)/1000, rot: Math.round(rot), p: pp }); };
  const notes = [];
  add('listener', Lx, Lz, sofa.rot, {});

  const tv = out.find(i => i.type === 'tvunit');
  if (tv) tv.p.audio = 'lcr';
  else {
    for (const k of [-1, 1]){ const [x, z] = at(2.2*Math.cos(26*D2R), k*2.2*Math.sin(26*D2R)); add('speaker', x, z, face(x, z), { kind: 'tower', mount: 'stand', color: 'black' }); }
    const [x, z] = at(2.2, 0); add('centerspk', x, z, face(x, z), { y: 0.55, color: 'black' });
  }

  const latR = lx0 + p.L/2 + 0.15, latL = p.L/2 - lx0 + 0.15;   // seat to the arm on each side, plus a gap
  for (const [k, lat] of [[1, latR], [-1, latL]]){
    const th = 115*D2R, d = [f[0]*Math.cos(th) + k*r[0]*Math.sin(th), f[1]*Math.cos(th) + k*r[1]*Math.sin(th)];
    const tStand = lat/Math.sin(th), hit = rayWall([Lx, Lz], d, tStand + 0.6);
    if (hit != null){
      const t = Math.max(0.9, hit - 0.12), x = Lx + d[0]*t, z = Lz + d[1]*t;
      add('speaker', x, z, face(x, z), { kind: 'shelf', mount: 'wall', color: 'black' });
    } else {
      const x = Lx + d[0]*tStand, z = Lz + d[1]*tStand;
      add('speaker', x, z, face(x, z), { kind: 'shelf', mount: 'stand', color: 'black' });
      if (problems({ id: 'tmp', type: 'speaker', x, z, rot: face(x, z), p: { kind: 'shelf', mount: 'stand' } }).length) notes.push('Едната задна тонколона опира в мебел. Премести я малко по линията към дивана.');
    }
  }

  /* the two ceiling speakers stay symmetric: the widest spacing that fits the raised middle of the ceiling on both sides */
  const cy = ceilingY(Lx, Lz), fw = Math.max(0.05, (cy - EAR)*Math.tan(10*D2R));
  let pair = null;
  for (const dfw of [0, -0.1, 0.1, -0.2, 0.2]){
    for (const lat of [1.05, 0.95, 0.85, 0.75, 0.65]){
      const q = [-1, 1].map(k => at(fw + dfw, k*lat));
      if (q.every(([x, z]) => fieldAt(x, z, 0.15))){ pair = q; break; }
    }
    if (pair) break;
  }
  if (!pair){ pair = [-1, 1].map(k => at(fw, k*0.9)); notes.push('Таванните тонколони не се събраха в средното поле на тавана.'); }
  for (const [x, z] of pair) add('ceilspk', x, z, 0, {});

  const sub = { color: 'black' }, cands = [];
  if (tv) for (const k of [-1, 1]) cands.push([...toWorld(tv, k*(tv.p.W/2 + 0.24), -TYPES.tvunit.size(tv.p)[1]/2 + 0.21), tv.rot]);
  const front = depth - 0.32 - 0.25;
  cands.push([...at(front, -(latL + 0.07)), sofa.rot], [...at(front, latR + 0.07), sofa.rot], [...at(-0.9, -(latL + 0.1)), sofa.rot], [...at(-0.9, latR + 0.1), sofa.rot]);
  const ok = ([x, z, rot]) => roomAt(x, z) && !problems({ id: 'tmp', type: 'sub', x, z, rot, p: sub }).length && !inDoorSwing('sub', sub, x, z, rot);
  const c = cands.find(ok);
  if (c) add('sub', c[0], c[1], c[2], sub); else notes.push('Не намерих свободно място за субуфера. Сложи го от каталога.');
  return { layout: { ...layout, items: out }, notes };
}
