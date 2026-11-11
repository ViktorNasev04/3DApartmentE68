/* The building shell: walls with their openings, floors, ceilings, slab, curtains, sky and ceiling lights.
   Built from the current plan; the app builds a new shell whenever a wall moves.
   Walls are rebuilt into one merged mesh whenever the set of lowered (cut) walls changes. */
import * as THREE from 'three';
import { WALLS, ROOMS, H as Hcm, CEILING_LIGHTS, CEIL_ZONES, BOUNDS, LINE } from './plan.js';
import { buildCove } from './ceiling.js';

const H = Hcm / 100;
export const CUT = 0.95;                    // height of a lowered wall in the dollhouse view

/* ---------- small geometry helpers ---------- */
function pushQuad(arr, a, b, c, d, n){      // four corners, counter-clockwise seen from the normal side
  for (const p of [a, b, c, a, c, d]){ arr.pos.push(p[0], p[1], p[2]); arr.nor.push(n[0], n[1], n[2]); }
}
function boxFaces(sides, caps, x0, y0, z0, x1, y1, z1){
  pushQuad(caps, [x0,y1,z0], [x0,y1,z1], [x1,y1,z1], [x1,y1,z0], [0,1,0]);
  pushQuad(sides, [x0,y0,z1], [x1,y0,z1], [x1,y1,z1], [x0,y1,z1], [0,0,1]);
  pushQuad(sides, [x1,y0,z0], [x0,y0,z0], [x0,y1,z0], [x1,y1,z0], [0,0,-1]);
  pushQuad(sides, [x1,y0,z1], [x1,y0,z0], [x1,y1,z0], [x1,y1,z1], [1,0,0]);
  pushQuad(sides, [x0,y0,z0], [x0,y0,z1], [x0,y1,z1], [x0,y1,z0], [-1,0,0]);
}
function toGeometry(arr){
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(arr.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(arr.nor, 3));
  return g;
}
/* horizontal quad on y with uv = world metres (for the tiling shader) */
function floorGeometry(rects, y, down){
  const pos = [], nor = [], uv = [];
  for (const [x0, z0, x1, z1] of rects){
    const v = down ? [[x0,z0],[x1,z0],[x1,z1],[x0,z0],[x1,z1],[x0,z1]] : [[x0,z0],[x0,z1],[x1,z1],[x0,z0],[x1,z1],[x1,z0]];
    for (const [x, z] of v){ pos.push(x, y, z); nor.push(0, down ? -1 : 1, 0); uv.push(x, z); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}
/* vertical tiled panel along a wall face; uv = (metres along the face, height) */
function wallPanel(ax, a0, a1, fixed, y0, y1, normalSign){
  const pos = [], nor = [], uv = [];
  const P = (a, y) => ax === 'x' ? [a, y, fixed] : [fixed, y, a];
  let quad = [[a0,y0],[a1,y0],[a1,y1],[a0,y0],[a1,y1],[a0,y1]];
  const n = ax === 'x' ? [0,0,normalSign] : [normalSign,0,0];
  const flip = ax === 'x' ? normalSign < 0 : normalSign > 0;
  if (flip) quad = [quad[0], quad[2], quad[1], quad[3], quad[5], quad[4]];
  for (const [a, y] of quad){ pos.push(...P(a, y)); nor.push(...n); uv.push(a, y); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

export function buildShell(ctx){
  const { M, FLOOR, BATHWALL } = ctx;
  const group = new THREE.Group(); group.name = 'shell';

  /* ---------- walls: solid pieces between openings ---------- */
  const pieces = [];                         // {wall, x0,z0,x1,z1, y0,y1}
  const fixtures = [];                       // meshes that belong to a wall opening, cut with it
  for (const w of WALLS){
    const x0 = w.x0/100, z0 = w.y0/100, x1 = w.x1/100, z1 = w.y1/100;
    const top = (w.h || Hcm)/100;
    const ax = (x1 - x0) >= (z1 - z0) ? 'x' : 'z';
    const A0 = ax === 'x' ? x0 : z0, A1 = ax === 'x' ? x1 : z1;
    const piece = (a0, a1, y0, y1) => {
      if (a1 - a0 < 1e-4 || y1 - y0 < 1e-4) return;
      pieces.push(ax === 'x' ? { wall:w, x0:a0, z0, x1:a1, z1, y0, y1 } : { wall:w, x0, z0:a0, x1, z1:a1, y0, y1 });
    };
    const opens = (w.open || []).map(o => ({ ...o, a0:o.a0/100, a1:o.a1/100, b0:o.b0/100, b1:o.b1/100 })).sort((a, b) => a.a0 - b.a0);
    let a = A0;
    for (const o of opens){
      piece(a, o.a0, 0, top);
      piece(o.a0, o.a1, o.b1, top);         // lintel
      piece(o.a0, o.a1, 0, o.b0);           // sill
      a = o.a1;
      buildOpening(w, ax, o, { x0, z0, x1, z1 });
    }
    piece(a, A1, 0, top);
  }

  const wallSides = new THREE.Mesh(new THREE.BufferGeometry(), M.wall);
  const wallCaps = new THREE.Mesh(new THREE.BufferGeometry(), M.wallCut);
  wallSides.castShadow = wallSides.receiveShadow = true; wallCaps.receiveShadow = true;
  wallSides.userData.shell = wallCaps.userData.shell = true;
  group.add(wallSides, wallCaps);

  let cutKey = null;
  function applyCut(cutOf){                  // cutOf(wall) -> height limit in metres or null
    const key = WALLS.map(w => { const c = cutOf(w); return c == null ? '' : c.toFixed(2); }).join('|');
    if (key === cutKey) return false;
    cutKey = key;
    const sides = { pos:[], nor:[] }, caps = { pos:[], nor:[] };
    for (const p of pieces){
      const c = cutOf(p.wall);
      const y1 = c == null ? p.y1 : Math.min(p.y1, c);
      if (y1 - p.y0 < 1e-4) continue;
      boxFaces(sides, caps, p.x0, p.y0, p.z0, p.x1, y1, p.z1);
    }
    wallSides.geometry.dispose(); wallCaps.geometry.dispose();
    wallSides.geometry = toGeometry(sides); wallCaps.geometry = toGeometry(caps);
    for (const f of fixtures){
      const c = cutOf(f.userData.wall);
      const { y0, y1, baseY } = f.userData;
      if (c == null || c >= y1){ f.visible = true; f.scale.y = 1; f.position.y = baseY; }
      else if (c <= y0 + 0.01){ f.visible = false; }
      else { f.visible = true; const k = (c - y0)/(y1 - y0); f.scale.y = k; f.position.y = y0 + (baseY - y0)*k; }
    }
    return true;
  }

  /* ---------- openings ---------- */
  function fixture(mesh, wall, y0, y1){
    mesh.userData.wall = wall; mesh.userData.y0 = y0; mesh.userData.y1 = y1; mesh.userData.baseY = mesh.position.y;
    mesh.castShadow = true; mesh.receiveShadow = true;
    fixtures.push(mesh); group.add(mesh); return mesh;
  }
  /* box positioned in wall coordinates: a along the wall, y up, n across (0 = wall centre line) */
  function wbox(wall, ax, rect, mat, a0, a1, y0, y1, n0, n1){
    const mid = ax === 'x' ? (rect.z0 + rect.z1)/2 : (rect.x0 + rect.x1)/2;
    const g = ax === 'x' ? new THREE.BoxGeometry(a1 - a0, y1 - y0, n1 - n0) : new THREE.BoxGeometry(n1 - n0, y1 - y0, a1 - a0);
    const m = new THREE.Mesh(g, mat);
    const ac = (a0 + a1)/2, nc = mid + (n0 + n1)/2;
    m.position.set(ax === 'x' ? ac : nc, (y0 + y1)/2, ax === 'x' ? nc : ac);
    return fixture(m, wall, y0, y1);
  }
  function wplane(wall, ax, rect, mat, a0, a1, y0, y1, n){
    const mid = ax === 'x' ? (rect.z0 + rect.z1)/2 : (rect.x0 + rect.x1)/2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(a1 - a0, y1 - y0), mat);
    if (ax === 'z') m.rotation.y = Math.PI/2;
    m.position.set(ax === 'x' ? (a0 + a1)/2 : mid + n, (y0 + y1)/2, ax === 'x' ? mid + n : (a0 + a1)/2);
    m.renderOrder = 3;
    const f = fixture(m, wall, y0, y1); f.castShadow = false; return f;
  }

  function buildOpening(w, ax, o, rect){
    const T = ax === 'x' ? rect.z1 - rect.z0 : rect.x1 - rect.x0;     // wall thickness
    const half = T/2;
    if (o.type === 'window' || o.type === 'balcony' || o.type === 'glassdoor'){
      const fw = 0.055, fd = 0.07;
      const box = (a0, a1, y0, y1) => wbox(w, ax, rect, M.black, a0, a1, y0, y1, -fd/2, fd/2);
      box(o.a0, o.a1, o.b0, o.b0 + fw); box(o.a0, o.a1, o.b1 - fw, o.b1);
      box(o.a0, o.a0 + fw, o.b0, o.b1); box(o.a1 - fw, o.a1, o.b0, o.b1);
      const mid = (o.a0 + o.a1)/2;
      if (o.type !== 'glassdoor') box(mid - 0.025, mid + 0.025, o.b0, o.b1);
      if (o.type === 'balcony'){ box(o.a0, mid, 0.95, 0.99); }
      wplane(w, ax, rect, M.glass, o.a0 + fw, o.a1 - fw, o.b0 + fw, o.b1 - fw, 0);
      if (o.type === 'window' && o.b0 > 0.1){                          // inside sill
        const inSide = w.out === 'n' ? 1 : w.out === 'e' ? -1 : w.out === 's' ? -1 : 1;
        const n0 = inSide > 0 ? 0 : -half - 0.03, n1 = inSide > 0 ? half + 0.03 : 0;
        wbox(w, ax, rect, M.worktop, o.a0, o.a1, o.b0 - 0.02, o.b0, n0, n1);
      }
      if (o.type === 'glassdoor'){                                      // lever handle on the room side
        const s = 1;
        wbox(w, ax, rect, M.black, o.a0 + 0.08, o.a0 + 0.10, 1.0, 1.16, s*0.04, s*0.06);
      }
      return;
    }
    // doors: lining, architraves on both faces, leaf
    const dark = o.type === 'entrance';
    const trim = dark ? M.entrance : M.door;
    const lw = 0.035;
    wbox(w, ax, rect, trim, o.a0, o.a0 + lw, 0, o.b1, -half - 0.01, half + 0.01);
    wbox(w, ax, rect, trim, o.a1 - lw, o.a1, 0, o.b1, -half - 0.01, half + 0.01);
    wbox(w, ax, rect, trim, o.a0, o.a1, o.b1 - lw, o.b1, -half - 0.01, half + 0.01);
    for (const s of [-1, 1]){
      const n0 = s > 0 ? half : -half - 0.015, n1 = s > 0 ? half + 0.015 : -half;
      wbox(w, ax, rect, trim, o.a0 - 0.06, o.a0, 0, o.b1 + 0.06, n0, n1);
      wbox(w, ax, rect, trim, o.a1, o.a1 + 0.06, 0, o.b1 + 0.06, n0, n1);
      wbox(w, ax, rect, trim, o.a0 - 0.06, o.a1 + 0.06, o.b1, o.b1 + 0.06, n0, n1);
    }
    const leafW = (o.a1 - o.a0) - 2*lw, leafH = o.b1 - lw - 0.005, lt = 0.04;
    if (dark){                                                          // entrance: closed
      wbox(w, ax, rect, M.entrance, o.a0 + lw, o.a1 - lw, 0.005, leafH, -0.03, 0.03);
      const inner = w.out === 'w' ? 1 : -1;
      wbox(w, ax, rect, M.steel, o.a0 + lw + 0.06, o.a0 + lw + 0.20, 1.02, 1.045, inner*0.035, inner*0.075);
      return;
    }
    // interior door, open 90° along the wall on the swing side
    const hingeA = o.hinge ? o.a1 - lw : o.a0 + lw;
    const dirA = o.hinge ? -1 : 1;                 // towards the opening centre
    const face = (o.side > 0 ? half : -half);
    const midN = ax === 'x' ? (rect.z0 + rect.z1)/2 : (rect.x0 + rect.x1)/2;
    const g = new THREE.BoxGeometry(ax === 'x' ? lt : leafW, leafH, ax === 'x' ? leafW : lt);
    const leaf = new THREE.Mesh(g, M.door);
    const along = hingeA + dirA*lt/2;
    const across = midN + face + o.side*leafW/2;
    leaf.position.set(ax === 'x' ? along : across, leafH/2 + 0.005, ax === 'x' ? across : along);
    fixture(leaf, w, 0.005, leafH);
    const hx = ax === 'x' ? along : midN + face + o.side*(leafW - 0.07);
    const hz = ax === 'x' ? midN + face + o.side*(leafW - 0.07) : along;
    const knob = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.12), M.black);
    knob.position.set(hx, 1.02, hz); fixture(knob, w, 1.01, 1.03);
  }

  /* ---------- floors, ceilings, slab ---------- */
  const floors = new Map();
  const ceilGroup = new THREE.Group(), plainG = new THREE.Group(), coveG = new THREE.Group();
  ceilGroup.add(plainG, coveG); group.add(ceilGroup);
  const zoneKey = new Set(CEIL_ZONES.flatMap(z => z.rects.map(q => q.join(','))));
  const restRects = [];
  for (const r of ROOMS){
    const rects = r.rects.map(q => q.map(v => v/100));
    const f = new THREE.Mesh(floorGeometry(rects, 0, false), FLOOR.tile);
    f.receiveShadow = true; f.renderOrder = 1; f.userData.room = r.id; f.userData.floor = true;
    group.add(f); floors.set(r.id, f);
    const c = new THREE.Mesh(floorGeometry(rects, H, true), M.ceiling);
    c.userData.room = r.id; plainG.add(c);
    for (const q of r.rects) if (!zoneKey.has(q.join(','))) restRects.push(q.map(v => v/100));
  }
  const rest = new THREE.Mesh(floorGeometry(restRects, H, true), M.ceiling); coveG.add(rest);
  /* invisible lid that keeps the sun out except through the glazing; off in the dollhouse view */
  const roofMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }); roofMat.shadowSide = THREE.DoubleSide;
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.x1 - BOUNDS.x0 + 1.6, BOUNDS.z1 - BOUNDS.z0 + 1.6), roofMat);
  roof.rotation.x = -Math.PI/2; roof.position.set((BOUNDS.x0 + BOUNDS.x1)/2, H + 0.03, (BOUNDS.z0 + BOUNDS.z1)/2); roof.castShadow = true; group.add(roof);
  {
    const slab = { pos:[], nor:[] }, caps = { pos:[], nor:[] };
    const all = [...ROOMS.flatMap(r => r.rects), ...WALLS.map(w => [w.x0, w.y0, w.x1, w.y1])];
    for (const q of all) boxFaces(slab, caps, q[0]/100, -0.24, q[1]/100, q[2]/100, -0.004, q[3]/100);
    const m = new THREE.Mesh(toGeometry(slab), M.slab); m.receiveShadow = true; group.add(m);
  }

  /* ---------- bathroom wall tiles ---------- */
  {
    const t = 0.004, top = H, L = LINE;
    const c = L.core/100, e = (L.bedW - 12)/100, n = L.north/100, s = L.bathS/100;
    const w0 = (L.core + 7)/100, w1 = (L.core + 77)/100, d0 = (L.closet - 10)/100, d1 = (L.bedW - 35)/100;
    const panels = [
      wallPanel('z', n, s, c + t, 0, top, 1),                              // west wall, faces east
      wallPanel('z', n, s, e - t, 0, top, -1),                             // east wall, faces west
      wallPanel('x', c, w0, n + t, 0, top, 1),                             // north wall around the window
      wallPanel('x', w0, w1, n + t, 0, 1.60, 1),
      wallPanel('x', w0, w1, n + t, 2.50, top, 1),
      wallPanel('x', w1, e, n + t, 0, top, 1),
      wallPanel('x', c, d0, s - t, 0, top, -1),                            // south wall around the door
      wallPanel('x', d0, d1, s - t, 2.10, top, -1),
      wallPanel('x', d1, e, s - t, 0, top, -1),
    ];
    for (const g of panels){
      const m = new THREE.Mesh(g, BATHWALL); m.receiveShadow = true; m.userData.bathwall = true; group.add(m);
    }
  }

  /* ---------- curtains at the living-room window ---------- */
  function curtain(width, height, waves, amp, mat){
    const g = new THREE.PlaneGeometry(width, height, Math.max(24, waves*8), 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++){ const x = p.getX(i); p.setZ(i, Math.sin((x/width)*Math.PI*2*waves)*amp); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = mat === M.linen; m.receiveShadow = true; return m;
  }
  const curtains = new THREE.Group(); group.add(curtains);
  {
    const z0 = (LINE.bedS + 17)/100, z1 = (LINE.stub - 5)/100, x = LINE.bay/100;
    const sheer = curtain(z1 - z0 + 0.2, 2.52, 11, 0.025, M.sheer);
    sheer.rotation.y = -Math.PI/2; sheer.position.set(x - 0.09, 1.32, (z0 + z1)/2); sheer.renderOrder = 3; curtains.add(sheer);
    for (const z of [z0 - 0.02, z1 + 0.02]){
      const c = curtain(0.42, 2.55, 3, 0.045, M.linen); c.rotation.y = -Math.PI/2; c.position.set(x - 0.16, 1.31, z); curtains.add(c);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, z1 - z0 + 0.7), M.black);
    rail.position.set(x - 0.13, 2.60, (z0 + z1)/2); curtains.add(rail);
  }
  {                                          // bedroom, at the balcony door to the loggia
    const z0 = (LINE.north + 65)/100, z1 = (LINE.north + 245)/100, x = LINE.bedE/100;
    const sheer = curtain(z1 - z0 + 0.25, 2.52, 10, 0.022, M.sheer);
    sheer.rotation.y = -Math.PI/2; sheer.position.set(x - 0.08, 1.32, (z0 + z1)/2); sheer.renderOrder = 3; curtains.add(sheer);
    const c = curtain(0.40, 2.55, 3, 0.045, M.linenDark); c.castShadow = true; c.rotation.y = -Math.PI/2; c.position.set(x - 0.15, 1.31, z1 + 0.06); curtains.add(c);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, z1 - z0 + 0.6), M.black);
    rail.position.set(x - 0.12, 2.60, (z0 + z1)/2 + 0.05); curtains.add(rail);
  }

  /* ---------- outside: sky planes seen through the glazing ---------- */
  const sz0 = (LINE.north - 90)/100, sz1 = (LINE.stub + 105)/100;
  const skyE = new THREE.Mesh(new THREE.PlaneGeometry(sz1 - sz0, 4.8), M.skyEve);
  skyE.rotation.y = -Math.PI/2; skyE.position.set(Math.max(LINE.bay + 142, LINE.logE + 117)/100, 1.55, (sz0 + sz1)/2); group.add(skyE);
  const skyN = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.4), M.skyEve);
  skyN.position.set((LINE.core + 42)/100, 2.05, (LINE.north - 90)/100); group.add(skyN);
  const skies = [skyE, skyN];

  /* ---------- ceiling lights ---------- */
  const lamps = [];
  for (const L of CEILING_LIGHTS){
    const x = L.at[0]/100, z = L.at[1]/100, r = L.r ?? (L.small ? 0.13 : 0.24);
    let disc;
    if (L.spots){
      disc = new THREE.Group();
      for (const [sx, sz] of L.spots){ const s = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 24), M.flush); s.position.set(sx/100, H - 0.006, sz/100); s.userData.spot = true; disc.add(s); }
    } else {
      disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, 48), M.flush);
      disc.position.set(x, H - 0.025, z);
    }
    group.add(disc);
    const light = L.light ? new THREE.PointLight(0xffdcb5, L.light, 0, 2) : null;
    if (light){ light.position.set(x, H - 0.25, z); light.userData.evening = true; light.userData.base = L.light; group.add(light); }
    const inZone = CEIL_ZONES.some(zn => zn.rects.some(q => L.at[0] > q[0] && L.at[0] < q[2] && L.at[1] > q[1] && L.at[1] < q[3]));
    lamps.push({ disc, light, room: L.room, inZone, spots: !!L.spots, on: true });
  }

  function setFloor(roomId, key){ const f = floors.get(roomId); if (f && FLOOR[key]) f.material = FLOOR[key]; }

  /* ceiling style: plain, or suspended with the LED cove; returns LED lengths for the cove */
  let cove = null, fieldNow = null, dropNow = 0;
  const inZone = (x, z) => CEIL_ZONES.some(zn => zn.rects.some(q => x*100 > q[0] && x*100 < q[2] && z*100 > q[1] && z*100 < q[3]));
  function setCeiling(cfg){
    if (cove){ coveG.remove(cove.group); cove.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); cove = null; }
    const on = !!cfg && cfg.style === 'cove';
    plainG.visible = !on; coveG.visible = on;
    let stats = null;
    if (on){
      const all = new THREE.Group(), fieldAts = [];
      let steps = 0, walls = 0;
      for (const z of CEIL_ZONES){
        const c = buildCove([z], H, { band: Math.min(cfg.band, z.maxBand ?? 9), drop: cfg.drop }, { field: M.ceilingField, ceiling: M.ceiling, led: M.led });
        all.add(c.group); steps += c.ledSteps; walls += c.ledWalls; fieldAts.push(c.fieldAt);
      }
      coveG.add(all); cove = { group: all };
      const fieldAt = (x, z) => fieldAts.some(f => f(x, z));
      fieldNow = fieldAt; dropNow = cfg.drop;
      stats = { steps, walls, low: H - cfg.drop, high: H };
      for (const l of lamps){
        l.on = !l.inZone || l.spots;
        if (l.light && l.inZone) l.light.position.y = H - 0.65;      // no hot spot on the lowered band
        if (l.spots) l.disc.children.forEach(s => { s.position.y = (fieldAt(s.position.x, s.position.z) ? H : H - cfg.drop) - 0.006; });
      }
    } else {
      fieldNow = null; dropNow = 0;
      for (const l of lamps){ l.on = true; if (l.light) l.light.position.y = H - 0.25; if (l.spots) l.disc.children.forEach(s => { s.position.y = H - 0.006; }); }
    }
    return stats;
  }

  /* ceiling height at a point, and whether a round fixture of radius m fits in the raised middle of the cove */
  const ceilingYAt = (x, z) => fieldNow && inZone(x, z) && !fieldNow(x, z) ? H - dropNow : H;
  const fieldFits = (x, z, m = 0) => !fieldNow || !inZone(x, z) || [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]].every(([dx, dz]) => fieldNow(x + dx, z + dz));

  /* geometry is per shell, materials are shared and stay */
  function dispose(){ group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); group.removeFromParent(); }

  return { group, applyCut, floors, ceilGroup, roof, skies, lamps, curtains, setFloor, setCeiling, ceilingYAt, fieldFits, dispose, wallMeshes: [wallSides, wallCaps] };
}
