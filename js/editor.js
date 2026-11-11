/* Furniture editing: selection, dragging on the floor, rotation, snapping to walls, clearances, overlap warnings and undo. */
import * as THREE from 'three';
import { TYPES, buildItem, disposeItem, shapesOf, withDefaults } from './catalog.js';
import { WALL_RECTS, roomAt, ROOMS, LINES, resolveLines, overridesOf } from './plan.js';
import { LAYOUT_REV } from './layouts.js';
import { CEILING_DEFAULT } from './ceiling.js';

const SNAP = 0.06;                      // snap to a wall face closer than this (m)
const COL_SEL = 0xe8a33d, COL_BAD = 0xd9534f, COL_DIM = 0x2d6cdf;
const rad = d => d * Math.PI / 180;
const r2 = v => Math.round(v * 1000) / 1000;
let seq = 0;
const uid = () => 'i' + Date.now().toString(36).slice(-5) + (seq++).toString(36);

/* world corners of a local rectangle under rotation (three.js rotation.y convention) */
function corners(rect, x, z, a){
  const [x0, z0, x1, z1] = rect, c = Math.cos(a), s = Math.sin(a);
  return [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(([lx, lz]) => [x + lx*c + lz*s, z - lx*s + lz*c]);
}
function bounds(polys){
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of polys) for (const [x, z] of p){ if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
  return { x0, z0, x1, z1 };
}
/* separating-axis test for convex polygons: penetration depth, 0 when apart */
function overlapDepth(a, b){
  let min = Infinity;
  for (const poly of [a, b]) for (let i = 0; i < poly.length; i++){
    const p = poly[i], q = poly[(i + 1) % poly.length];
    let ax = -(q[1] - p[1]), az = q[0] - p[0]; const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
    let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
    for (const v of a){ const d = v[0]*ax + v[1]*az; if (d < amin) amin = d; if (d > amax) amax = d; }
    for (const v of b){ const d = v[0]*ax + v[1]*az; if (d < bmin) bmin = d; if (d > bmax) bmax = d; }
    const depth = Math.min(amax, bmax) - Math.max(amin, bmin);
    if (depth <= 0) return 0;
    if (depth < min) min = depth;
  }
  return min;
}
/* wall outlines of the current plan, rebuilt when the walls move */
let polysOf = null, polys = [];
function wallPolys(){
  if (polysOf !== WALL_RECTS){ polysOf = WALL_RECTS; polys = WALL_RECTS.map(w => ({ w, poly: [[w.x0, w.z0], [w.x1, w.z0], [w.x1, w.z1], [w.x0, w.z1]] })); }
  return polys;
}
/* only known lines with finite values, as whole centimetres */
const cleanWalls = (o) => overridesOf(resolveLines(Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => LINES[k] && Number.isFinite(+v)).map(([k, v]) => [k, Math.round(+v)]))));

export class Editor extends EventTarget {
  constructor({ scene, camera, controls, canvas, stage, labels, requestRender }){
    super();
    Object.assign(this, { scene, camera, controls, canvas, stage, labels, requestRender });
    this.items = []; this.meshes = new Map();
    this.root = new THREE.Group(); this.root.name = 'furniture'; scene.add(this.root);
    this.viz = new THREE.Group(); this.viz.name = 'selection'; scene.add(this.viz);
    this.selected = null;
    this.floors = {}; this.bond = 'third'; this.dir = 0; this.ceiling = { ...CEILING_DEFAULT };
    this.walls = {};                    // moved walls: line id → cm, only where they differ from the plan
    this.enabled = true;                // false while the walls are being edited
    this.past = []; this.future = []; this.current = null;
    this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.drag = null; this.tap = null; this.issues = [];
    this.yOf = () => 0;                 // height offset per piece; the app lifts ceiling speakers with the ceiling
    this.vizMats = {
      sel: new THREE.MeshBasicMaterial({ color: COL_SEL, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false }),
      bad: new THREE.MeshBasicMaterial({ color: COL_BAD, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false }),
      fill: new THREE.MeshBasicMaterial({ color: COL_SEL, transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
      fillBad: new THREE.MeshBasicMaterial({ color: COL_BAD, transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
      dim: new THREE.MeshBasicMaterial({ color: COL_DIM, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false }),
    };
    this._bind();
  }

  /* ---------- state ---------- */
  item(id){ return this.items.find(i => i.id === id) || null; }
  serialize(){
    return { v: 1, rev: LAYOUT_REV, floors: { ...this.floors }, bond: this.bond, dir: this.dir, ceiling: { ...this.ceiling }, walls: { ...this.walls },
      items: this.items.map(i => { const o = { id: i.id, type: i.type, x: r2(i.x), z: r2(i.z), rot: Math.round(i.rot * 10) / 10, p: { ...i.p } }; if (i.price != null) o.price = i.price; if (i.note) o.note = i.note; return o; }) };
  }
  applyLayout(layout, { resetHistory = false, keepSelection = false } = {}){
    const next = (layout.items || []).filter(i => TYPES[i.type]).map(i => ({ id: i.id || uid(), type: i.type, x: +i.x || 0, z: +i.z || 0, rot: +i.rot || 0, p: withDefaults(i.type, i.p), price: i.price ?? null, note: i.note || '' }));
    const old = new Map(this.items.map(i => [i.id, i]));
    for (const n of next){
      const o = old.get(n.id);
      if (o && o.type === n.type && JSON.stringify(o.p) === JSON.stringify(n.p)){
        const m = this.meshes.get(n.id); m.position.set(n.x, this.yOf(n), n.z); m.rotation.y = rad(n.rot);
        old.delete(n.id);
      } else {
        if (o) old.delete(n.id), this._dropMesh(n.id);
        this._makeMesh(n);
      }
    }
    for (const id of old.keys()) this._dropMesh(id);
    this.items = next;
    this.floors = { ...(layout.floors || {}) }; this.bond = layout.bond || 'third'; this.dir = layout.dir ? 1 : 0;
    this.ceiling = { ...CEILING_DEFAULT, ...(layout.ceiling || {}) };
    if (layout.walls) this.walls = cleanWalls(layout.walls);   // a layout without walls keeps the current ones
    if (!keepSelection || !this.item(this.selected)) this.select(null); else this._updateViz();
    if (resetHistory){ this.past = []; this.future = []; this.current = JSON.stringify(this.serialize()); }
    this._emit('change', { commit: false, layout: true });
    this.requestRender();
  }
  commit(){
    const s = JSON.stringify(this.serialize());
    if (s === this.current) return;
    if (this.current) this.past.push(this.current);
    if (this.past.length > 80) this.past.shift();
    this.current = s; this.future = [];
    this._emit('change', { commit: true });
  }
  undo(){ if (!this.past.length) return; this.future.push(this.current); this.current = this.past.pop(); this.applyLayout(JSON.parse(this.current), { keepSelection: true }); this._emit('change', { commit: true, history: true }); }
  redo(){ if (!this.future.length) return; this.past.push(this.current); this.current = this.future.pop(); this.applyLayout(JSON.parse(this.current), { keepSelection: true }); this._emit('change', { commit: true, history: true }); }
  setFloors(floors, bond, dir){ if (floors) this.floors = { ...this.floors, ...floors }; if (bond) this.bond = bond; if (dir != null) this.dir = dir; this._emit('change', { commit: false, floors: true }); this.commit(); }
  setCeiling(cfg, commit = true){ this.ceiling = { ...this.ceiling, ...cfg }; this._emit('change', { commit: false, ceiling: true }); if (commit) this.commit(); }
  /* walls: full set of overrides; pieces listed in `moves` are shifted with them (furniture standing against a moved wall) */
  setWalls(walls, { commit = true, moves = null } = {}){
    this.walls = cleanWalls(walls);
    if (moves) for (const { id, x, z } of moves){ const it = this.item(id); if (it) this.place(it, x, z); }
    if (moves && moves.length) this._updateViz();
    this._emit('change', { commit: false, walls: true });
    if (commit) this.commit();
    this.requestRender();
  }

  _makeMesh(it){
    const g = buildItem(it);
    g.position.set(it.x, this.yOf(it), it.z); g.rotation.y = rad(it.rot);
    this.root.add(g); this.meshes.set(it.id, g);
  }
  _dropMesh(id){ const m = this.meshes.get(id); if (!m) return; this.root.remove(m); disposeItem(m); this.meshes.delete(id); }
  _emit(type, detail){ this.dispatchEvent(new CustomEvent(type, { detail })); }

  /* ---------- geometry queries ---------- */
  polys(it, x = it.x, z = it.z, rot = it.rot){ return shapesOf(it.type, it.p).map(r => corners(r, x, z, rad(rot))); }
  box(it, x, z, rot){ return bounds(this.polys(it, x, z, rot)); }
  solid(it){ const T = TYPES[it.type]; if (T.flat || T.ceiling) return false; return typeof T.wall === 'function' ? !T.wall(it.p) : !T.wall; }
  refreshHeights(){ for (const it of this.items){ const m = this.meshes.get(it.id); if (m) m.position.y = this.yOf(it); } }
  related(a, b){ const ta = TYPES[a.type], tb = TYPES[b.type]; return (ta.carries && ta.carries === b.type) || (tb.carries && tb.carries === a.type); }

  problems(it){
    if (!this.solid(it)) return [];
    const mine = this.polys(it), out = [];
    for (const { w, poly } of wallPolys()) for (const p of mine) if (overlapDepth(p, poly) > 0.012){ out.push({ kind: 'wall', id: w.id }); break; }
    for (const o of this.items){
      if (o === it || !this.solid(o) || this.related(it, o)) continue;
      const theirs = this.polys(o);
      if (mine.some(p => theirs.some(q => overlapDepth(p, q) > 0.012))) out.push({ kind: 'item', id: o.id });
    }
    return out;
  }

  /* free distance from each side of the piece to the nearest wall or other piece */
  clearances(it){
    const T = TYPES[it.type];
    if (T.ceiling || T.marker || (typeof T.wall === 'function' ? T.wall(it.p) : T.wall)) return [];
    const b = this.box(it);
    const obs = WALL_RECTS.map(w => ({ x0: w.x0, z0: w.z0, x1: w.x1, z1: w.z1 }));
    if (this.solid(it)) for (const o of this.items) if (o !== it && this.solid(o) && !this.related(it, o)) obs.push(this.box(o));
    const res = [];
    const span = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);
    const dirs = [
      { k: 'x+', test: o => o.x0 >= b.x1 - 0.005 && span(b.z0, b.z1, o.z0, o.z1) > 0.02, d: o => o.x0 - b.x1, seg: (o, d) => { const m = (Math.max(b.z0, o.z0) + Math.min(b.z1, o.z1))/2; return [[b.x1, m], [b.x1 + d, m]]; } },
      { k: 'x-', test: o => o.x1 <= b.x0 + 0.005 && span(b.z0, b.z1, o.z0, o.z1) > 0.02, d: o => b.x0 - o.x1, seg: (o, d) => { const m = (Math.max(b.z0, o.z0) + Math.min(b.z1, o.z1))/2; return [[b.x0, m], [b.x0 - d, m]]; } },
      { k: 'z+', test: o => o.z0 >= b.z1 - 0.005 && span(b.x0, b.x1, o.x0, o.x1) > 0.02, d: o => o.z0 - b.z1, seg: (o, d) => { const m = (Math.max(b.x0, o.x0) + Math.min(b.x1, o.x1))/2; return [[m, b.z1], [m, b.z1 + d]]; } },
      { k: 'z-', test: o => o.z1 <= b.z0 + 0.005 && span(b.x0, b.x1, o.x0, o.x1) > 0.02, d: o => b.z0 - o.z1, seg: (o, d) => { const m = (Math.max(b.x0, o.x0) + Math.min(b.x1, o.x1))/2; return [[m, b.z0], [m, b.z0 - d]]; } },
    ];
    for (const D of dirs){
      let best = null, bd = Infinity;
      for (const o of obs) if (D.test(o)){ const d = D.d(o); if (d < bd){ bd = d; best = o; } }
      if (best && bd < 3.2) res.push({ dir: D.k, d: Math.max(0, bd), seg: D.seg(best, Math.max(0, bd)) });
    }
    return res;
  }

  /* move a candidate position so the piece sits flush with a nearby wall face */
  snap(it, x, z){
    const b = this.box(it, x, z);
    let dx = 0, dz = 0, bx = SNAP, bz = SNAP;
    const ov = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 0.02;
    for (const w of WALL_RECTS){
      if (ov(b.z0, b.z1, w.z0, w.z1)){
        const l = w.x0 - b.x1; if (Math.abs(l) < bx && l > -SNAP){ bx = Math.abs(l); dx = l; }
        const r = w.x1 - b.x0; if (Math.abs(r) < bx && r < SNAP){ bx = Math.abs(r); dx = r; }
      }
      if (ov(b.x0, b.x1, w.x0, w.x1)){
        const t = w.z0 - b.z1; if (Math.abs(t) < bz && t > -SNAP){ bz = Math.abs(t); dz = t; }
        const u = w.z1 - b.z0; if (Math.abs(u) < bz && u < SNAP){ bz = Math.abs(u); dz = u; }
      }
    }
    return [x + dx, z + dz];
  }

  /* ---------- editing ---------- */
  select(id, silent){
    this.selected = id && this.item(id) ? id : null;
    this._updateViz();
    if (!silent) this._emit('select', { id: this.selected });
    this.requestRender();
  }
  findSpot(it, x, z){
    const free = (px, pz) => { const o = { ...it, x: px, z: pz }; return roomAt(px, pz) && this.problems(o).length === 0; };
    if (free(x, z)) return [x, z];
    for (let r = 0.15; r <= 2.4; r += 0.15) for (let k = 0; k < 16; k++){
      const a = k/16*Math.PI*2, px = x + Math.cos(a)*r, pz = z + Math.sin(a)*r;
      if (free(px, pz)) return [px, pz];
    }
    return [x, z];
  }
  add(type, params, at){
    const it = { id: uid(), type, x: 0, z: 0, rot: at?.rot ?? 0, p: withDefaults(type, params), price: null, note: '' };
    let x = at?.x, z = at?.z;
    if (x == null){ const t = this.controls.target; x = t.x; z = t.z; if (!roomAt(x, z)){ const r = ROOMS[0].label; x = r[0]/100; z = r[1]/100; } }
    [it.x, it.z] = this.findSpot(it, x, z);
    this.items.push(it); this._makeMesh(it);
    this.select(it.id); this.commit(); this.requestRender();
    return it;
  }
  duplicate(id){
    const s = this.item(id); if (!s) return;
    const it = { ...s, id: uid(), p: { ...s.p } };
    [it.x, it.z] = this.findSpot(it, s.x + 0.3, s.z + 0.3);
    this.items.push(it); this._makeMesh(it);
    this.select(it.id); this.commit(); this.requestRender();
  }
  remove(id){
    const i = this.items.findIndex(t => t.id === id); if (i < 0) return;
    this.items.splice(i, 1); this._dropMesh(id);
    if (this.selected === id) this.select(null);
    this.commit(); this.requestRender();
  }
  carried(it){
    const T = TYPES[it.type]; if (!T.carries) return [];
    const b = this.box(it), m = 0.75;
    return this.items.filter(o => o.type === T.carries && o.x > b.x0 - m && o.x < b.x1 + m && o.z > b.z0 - m && o.z < b.z1 + m);
  }
  place(it, x, z, rot = it.rot){
    it.x = x; it.z = z; it.rot = ((rot % 360) + 360) % 360;
    const m = this.meshes.get(it.id); m.position.set(x, this.yOf(it), z); m.rotation.y = rad(it.rot);
  }
  rotateBy(id, deg, commit = true){
    const it = this.item(id); if (!it) return;
    const kids = this.carried(it), a = rad(deg), c = Math.cos(a), s = Math.sin(a);
    for (const k of kids){ const dx = k.x - it.x, dz = k.z - it.z; this.place(k, it.x + dx*c + dz*s, it.z - dx*s + dz*c, k.rot + deg); }
    this.place(it, it.x, it.z, it.rot + deg);
    this._updateViz(); if (commit) this.commit(); this._emit('change', { commit: false, moved: true }); this.requestRender();
  }
  setRot(id, deg, commit = true){ const it = this.item(id); if (!it) return; this.rotateBy(id, deg - it.rot, commit); }
  nudge(id, dx, dz){
    const it = this.item(id); if (!it) return;
    for (const k of this.carried(it)) this.place(k, k.x + dx, k.z + dz);
    this.place(it, it.x + dx, it.z + dz);
    this._updateViz(); this._emit('change', { commit: false, moved: true }); this.requestRender();
  }
  setParam(id, key, val){
    const it = this.item(id); if (!it) return;
    it.p = { ...it.p, [key]: val };
    this._dropMesh(id); this._makeMesh(it);
    this._updateViz(); this._emit('change', { commit: false, params: true }); this.requestRender();
  }
  setMeta(id, meta){ const it = this.item(id); if (!it) return; Object.assign(it, meta); this._emit('change', { commit: false, meta: true }); }

  /* ---------- selection drawing ---------- */
  _updateViz(){
    const v = this.viz;
    for (const c of [...v.children]){ v.remove(c); c.geometry?.dispose(); }
    this.labels.set('measure', []);
    this.issues = [];
    const it = this.item(this.selected);
    if (!it){ this.requestRender(); return; }
    this.issues = this.problems(it);
    const bad = this.issues.length > 0, M = this.vizMats;
    const lw = 0.04, y = 0.012;
    for (const poly of this.polys(it)){
      for (let i = 0; i < 4; i++){
        const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % 4];
        const len = Math.hypot(bx - ax, bz - az);
        const s = new THREE.Mesh(new THREE.PlaneGeometry(len + lw, lw), bad ? M.bad : M.sel);
        s.rotation.x = -Math.PI/2; s.rotation.z = -Math.atan2(bz - az, bx - ax);
        s.position.set((ax + bx)/2, y, (az + bz)/2); s.renderOrder = 10; v.add(s);
      }
      const sh = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
      const f = new THREE.Mesh(new THREE.ShapeGeometry(sh), bad ? M.fillBad : M.fill);
      f.rotation.x = -Math.PI/2; f.position.y = 0.008; f.renderOrder = 9; v.add(f);
    }
    const labels = [];
    for (const c of this.clearances(it)){
      const [[ax, az], [bx, bz]] = c.seg, len = Math.hypot(bx - ax, bz - az);
      if (len > 0.005){
        const s = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.022), M.dim);
        s.rotation.x = -Math.PI/2; s.rotation.z = -Math.atan2(bz - az, bx - ax);
        s.position.set((ax + bx)/2, 0.014, (az + bz)/2); s.renderOrder = 11; v.add(s);
        for (const [px, pz] of [[ax, az], [bx, bz]]){
          const t = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.12), M.dim);
          t.rotation.x = -Math.PI/2; t.rotation.z = -Math.atan2(bz - az, bx - ax);
          t.position.set(px, 0.014, pz); t.renderOrder = 11; v.add(t);
        }
      }
      labels.push({ x: (ax + bx)/2, y: 0.05, z: (az + bz)/2, text: Math.round(c.d*100) + ' см', cls: c.d < 0.6 && c.d > 0.001 ? 'tight' : '' });
    }
    this.labels.set('measure', labels);
    this.requestRender();
  }

  /* ---------- pointer & keyboard ---------- */
  _pick(e){
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left)/r.width)*2 - 1, -((e.clientY - r.top)/r.height)*2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return r;
  }
  _hitItem(e){
    this._pick(e);
    const hits = this.ray.intersectObjects(this.root.children, true);
    for (const h of hits){
      let o = h.object, shown = true; while (o && !o.userData.itemId){ if (!o.visible) shown = false; o = o.parent; }
      if (o && shown && o.visible) return o.userData.itemId;
    }
    return null;
  }
  _floor(e){ this._pick(e); const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(this.plane, p) ? p : null; }

  _bind(){
    const down = (e) => {
      if (!this.enabled || e.target !== this.canvas || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const id = this._hitItem(e);
      this.tap = { x: e.clientX, y: e.clientY, t: performance.now(), id, pid: e.pointerId, multi: !!this.tap && this.tap.pid !== e.pointerId };
      if (this.drag) return;
      if (id && (e.pointerType === 'mouse' || id === this.selected)){
        const it = this.item(id), p = this._floor(e); if (!it || !p) return;
        this.controls.enabled = false;
        this.drag = { id, pid: e.pointerId, ox: p.x - it.x, oz: p.z - it.z, sx: it.x, sz: it.z, moved: false, kids: this.carried(it).map(k => ({ k, dx: k.x - it.x, dz: k.z - it.z })), alt: e.altKey };
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_){}
        if (this.selected !== id) this.select(id);
        this.stage.classList.add('dragging');
      }
    };
    const move = (e) => {
      const d = this.drag; if (!d || e.pointerId !== d.pid) return;
      const p = this._floor(e); if (!p) return;
      const it = this.item(d.id); if (!it) return;
      let x = p.x - d.ox, z = p.z - d.oz;
      if (!e.altKey) [x, z] = this.snap(it, x, z);
      x = Math.round(x*100)/100; z = Math.round(z*100)/100;
      if (!d.moved && Math.hypot(x - d.sx, z - d.sz) < 0.01) return;
      d.moved = true;
      this.place(it, x, z);
      for (const { k, dx, dz } of d.kids) this.place(k, x + dx, z + dz);
      this._updateViz(); this._emit('change', { commit: false, moved: true }); this.requestRender();
    };
    const up = (e) => {
      const d = this.drag;
      if (d && e.pointerId === d.pid){
        this.drag = null; this.controls.enabled = true; this.stage.classList.remove('dragging');
        try { this.canvas.releasePointerCapture(e.pointerId); } catch (_){}
        if (d.moved){ this.commit(); this.tap = null; return; }
      }
      const t = this.tap;
      if (t && e.pointerId === t.pid && !t.multi && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 7 && performance.now() - t.t < 450){
        this.select(t.id);
      }
      if (t && e.pointerId === t.pid) this.tap = null;
    };
    this.stage.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
      const id = this.selected;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z'){ e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); return; }
      if (mod && e.key.toLowerCase() === 'y'){ e.preventDefault(); this.redo(); return; }
      if (!id || !this.enabled) return;
      const step = e.shiftKey ? 0.10 : 0.01;
      const keys = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (keys[e.key]){ e.preventDefault(); this.nudge(id, ...keys[e.key]); clearTimeout(this._nt); this._nt = setTimeout(() => this.commit(), 400); return; }
      if (e.key === 'Delete' || e.key === 'Backspace'){ e.preventDefault(); this.remove(id); return; }
      if (e.key === 'Escape'){ this.select(null); return; }
      if (e.key.toLowerCase() === 'r'){ e.preventDefault(); this.rotateBy(id, e.shiftKey ? -90 : 90); return; }
      if (e.key.toLowerCase() === 'q'){ e.preventDefault(); this.rotateBy(id, -15); return; }
      if (e.key.toLowerCase() === 'e'){ e.preventDefault(); this.rotateBy(id, 15); return; }
      if (mod && e.key.toLowerCase() === 'd'){ e.preventDefault(); this.duplicate(id); }
    });
  }
}
