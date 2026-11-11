/* Moving walls: pick a wall in the model and drag it along its line, nudge it, or type a room size.
   Furniture standing against a moved wall goes with it. While the walls are edited, dimension lines show the room sizes. */
import * as THREE from 'three';
import { LINES, MEASURES, LINE, WALL_RECTS, measureOf, clampLine, defaultLine } from './plan.js';
import { TYPES } from './catalog.js';
import { CUT } from './shell.js';

const Y = CUT + 0.02;                         // drawing height: just above the lowered walls
const TOUCH = 0.035;                          // furniture closer than this to a wall face moves with the wall (m)
const MAGNET = 4;                             // cm: a dragged wall settles on its place in the plan

export class WallTool extends EventTarget {
  constructor({ scene, camera, canvas, stage, controls, labels, editor, requestRender, getShell }){
    super();
    Object.assign(this, { scene, camera, canvas, stage, controls, labels, editor, requestRender, getShell });
    this.active = false; this.selected = null; this.drag = null; this.tap = null;
    this.g = new THREE.Group(); this.g.name = 'walls'; this.g.visible = false; scene.add(this.g);
    const flat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    this.mats = { sel: flat(0xe8a33d, 0.95), selFill: flat(0xe8a33d, 0.45), dim: flat(0x2d6cdf, 0.9), hot: flat(0xe8a33d, 0.95) };
    this.ray = new THREE.Raycaster(); this.ndc = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CUT);
    this._bind();
  }

  _emit(type, detail){ this.dispatchEvent(new CustomEvent(type, { detail })); }

  setActive(on){
    on = !!on;
    if (on === this.active) return;
    this.active = on;
    this.editor.enabled = !on;
    if (on) this.editor.select(null);
    this.drag = null; this.tap = null;
    if (!on) this.selected = null;
    this.g.visible = on;
    this.draw();
    this._emit('active', { on });
    this._emit('select', { id: this.selected });
  }
  select(id){
    this.selected = id && LINES[id] ? id : null;
    this.draw();
    this._emit('select', { id: this.selected });
  }

  /* furniture standing with its back against a face of the walls on a line, with the chairs that go with a table: [{ id, x, z }].
     A piece that only touches the wall with its side (a kitchen run ending in a corner) stays where it is. */
  carriedFor(id){
    const ax = LINES[id].axis, ws = WALL_RECTS.filter(w => w.line === id), ed = this.editor, out = [];
    const span = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0) > 0.02;
    for (const it of ed.items){
      const T = TYPES[it.type]; if (!T || T.ceiling || T.marker) continue;
      const b = ed.box(it), a = it.rot*Math.PI/180;
      const back = [-Math.sin(a), -Math.cos(a)];                 // local −z (the wall side) in plan coordinates
      const faces = (dx, dz) => back[0]*dx + back[1]*dz > 0.85;  // back points that way, within about 30°
      const touch = ws.some(w => ax === 'x'
        ? span(b.z0, b.z1, w.z0, w.z1) && ((Math.abs(b.x1 - w.x0) < TOUCH && faces(1, 0)) || (Math.abs(b.x0 - w.x1) < TOUCH && faces(-1, 0)))
        : span(b.x0, b.x1, w.x0, w.x1) && ((Math.abs(b.z1 - w.z0) < TOUCH && faces(0, 1)) || (Math.abs(b.z0 - w.z1) < TOUCH && faces(0, -1))));
      if (touch && !out.includes(it)) out.push(it);
    }
    for (const it of [...out]) for (const k of ed.carried(it)) if (!out.includes(k)) out.push(k);
    return out.map(it => ({ id: it.id, x: it.x, z: it.z }));
  }

  /* put line `id` at v cm; carry: furniture with its positions when the line was at `from` */
  _apply(id, v, { commit, carry, from }){
    const nv = clampLine(id, v);
    const d = (nv - from)/100, ax = LINES[id].axis;
    const moves = carry.map(c => ({ id: c.id, x: ax === 'x' ? c.x + d : c.x, z: ax === 'y' ? c.z + d : c.z }));
    this.editor.setWalls({ ...this.editor.walls, [id]: nv }, { commit, moves });
    return nv;
  }
  /* one-off move (buttons, typed sizes, keys) */
  move(id, v, commit = true){
    if (!LINES[id]) return LINE[id];
    const from = LINE[id];
    if (clampLine(id, v) === from){ this.draw(); return from; }
    return this._apply(id, v, { commit, carry: this.carriedFor(id), from });
  }
  nudge(id, cm, commit = true){ return this.move(id, LINE[id] + cm, commit); }
  /* change a room size: the measure's own line moves */
  setMeasure(m, value){
    const cur = measureOf(m), probe = { ...LINE, [m.edit]: LINE[m.edit] + 1 };
    const sign = measureOf(m, probe) - cur;
    if (!sign || !Number.isFinite(value)) return;
    this.move(m.edit, LINE[m.edit] + sign*(Math.round(value) - cur));
  }
  resetAll(){
    const lines = Object.keys(this.editor.walls);
    if (!lines.length) return;
    const moves = new Map();
    for (const id of lines){
      const d = (defaultLine(id) - LINE[id])/100, ax = LINES[id].axis;
      for (const c of this.carriedFor(id)){
        const m = moves.get(c.id) || { id: c.id, x: c.x, z: c.z };
        if (ax === 'x') m.x += d; else m.z += d;
        moves.set(c.id, m);
      }
    }
    this.editor.setWalls({}, { commit: true, moves: [...moves.values()] });
  }
  /* measures that change when line `id` moves */
  affects(m, id){ return !!id && measureOf(m, { ...LINE, [id]: LINE[id] + 1 }) !== measureOf(m); }

  /* ---------- drawing: the selected wall and the dimension lines ---------- */
  draw(){
    const g = this.g;
    for (const c of [...g.children]){ g.remove(c); c.geometry.dispose(); }
    if (!this.active){ this.labels.set('dims', []); this.requestRender(); return; }
    const M = this.mats, sel = this.selected;
    const strip = (ax, az, bx, bz, w, mat, order = 30) => {
      const len = Math.hypot(bx - ax, bz - az); if (len < 0.002) return;
      const s = new THREE.Mesh(new THREE.PlaneGeometry(len, w), mat);
      s.rotation.x = -Math.PI/2; s.rotation.z = -Math.atan2(bz - az, bx - ax);
      s.position.set((ax + bx)/2, Y, (az + bz)/2); s.renderOrder = order; g.add(s);
    };
    const tags = [];
    if (sel){
      for (const w of WALL_RECTS.filter(r => r.line === sel)){
        const e = 0.012, x0 = w.x0 - e, x1 = w.x1 + e, z0 = w.z0 - e, z1 = w.z1 + e;
        const f = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), M.selFill);
        f.rotation.x = -Math.PI/2; f.position.set((x0 + x1)/2, Y - 0.002, (z0 + z1)/2); f.renderOrder = 29; g.add(f);
        for (const [ax, az, bx, bz] of [[x0, z0, x1, z0], [x1, z0, x1, z1], [x1, z1, x0, z1], [x0, z1, x0, z0]]) strip(ax, az, bx, bz, 0.03, M.sel, 31);
      }
      const main = WALL_RECTS.filter(r => r.line === sel).sort((a, b) => (b.x1 - b.x0) + (b.z1 - b.z0) - (a.x1 - a.x0) - (a.z1 - a.z0))[0];
      if (main) tags.push({ x: (main.x0 + main.x1)/2, y: Y, z: (main.z0 + main.z1)/2, text: LINES[sel].axis === 'x' ? '◀ ▶' : '▲ ▼', cls: 'dim grip' });
    }
    for (const m of MEASURES){
      const a = m.a(LINE)/100, b = m.b(LINE)/100, at = m.at(LINE)/100, hot = this.affects(m, sel);
      const mat = hot ? M.hot : M.dim, tick = 0.12;
      if (m.axis === 'x'){ strip(a, at, b, at, 0.018, mat); strip(a, at - tick/2, a, at + tick/2, 0.018, mat); strip(b, at - tick/2, b, at + tick/2, 0.018, mat); }
      else { strip(at, a, at, b, 0.018, mat); strip(at - tick/2, a, at + tick/2, a, 0.018, mat); strip(at - tick/2, b, at + tick/2, b, 0.018, mat); }
      const mid = (a + b)/2;
      tags.push({ x: m.axis === 'x' ? mid : at, y: Y, z: m.axis === 'x' ? at : mid, text: String(Math.round(measureOf(m))), cls: 'dim' + (hot ? ' hot' : '') });
    }
    this.labels.set('dims', tags);
    this.requestRender();
  }

  /* ---------- picking and dragging ---------- */
  _ray(e){
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left)/r.width)*2 - 1, -((e.clientY - r.top)/r.height)*2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return r;
  }
  _onPlane(e){ this._ray(e); const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(this.plane, p) ? p : null; }
  /* the wall under the pointer, with a margin of about 22 px so thin partitions are easy to hit on a phone */
  _pick(e){
    const r = this._ray(e);
    const p = new THREE.Vector3(); if (!this.ray.ray.intersectPlane(this.plane, p)) return null;
    const dist = this.camera.position.distanceTo(p);
    const perPx = 2*dist*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)/r.height;
    const tol = Math.min(0.35, Math.max(0.06, 22*perPx));
    let best = null, bd = Infinity;
    for (const w of WALL_RECTS){
      const dx = Math.max(w.x0 - p.x, 0, p.x - w.x1), dz = Math.max(w.z0 - p.z, 0, p.z - w.z1), d = Math.hypot(dx, dz);
      if (d <= tol && (d < bd - 1e-6 || (Math.abs(d - bd) < 1e-6 && (w.x1 - w.x0)*(w.z1 - w.z0) < (best.x1 - best.x0)*(best.z1 - best.z0)))){ bd = d; best = w; }
    }
    return best ? best.line : null;
  }

  _bind(){
    const down = (e) => {
      if (!this.active || e.target !== this.canvas || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const id = this._pick(e);
      this.tap = { x: e.clientX, y: e.clientY, t: performance.now(), id, pid: e.pointerId, multi: !!this.tap && this.tap.pid !== e.pointerId };
      if (this.drag || !id || !(e.pointerType === 'mouse' || id === this.selected)) return;
      const p = this._onPlane(e); if (!p) return;
      this.controls.enabled = false;
      this.drag = { id, pid: e.pointerId, p0: LINES[id].axis === 'x' ? p.x : p.z, from: LINE[id], last: LINE[id], carry: this.carriedFor(id), moved: false };
      try { this.canvas.setPointerCapture(e.pointerId); } catch (_){}
      if (this.selected !== id) this.select(id);
      this.stage.classList.add('dragging');
    };
    const move = (e) => {
      const d = this.drag; if (!d || e.pointerId !== d.pid) return;
      const p = this._onPlane(e); if (!p) return;
      const along = LINES[d.id].axis === 'x' ? p.x : p.z;
      let v = Math.round(d.from + (along - d.p0)*100);
      const def = defaultLine(d.id);
      if (!e.altKey && Math.abs(v - def) <= MAGNET) v = def;
      v = clampLine(d.id, v);
      if (v === d.last) return;
      d.last = v; d.moved = true;
      this._apply(d.id, v, { commit: false, carry: d.carry, from: d.from });
    };
    const up = (e) => {
      const d = this.drag;
      if (d && e.pointerId === d.pid){
        this.drag = null; this.controls.enabled = true; this.stage.classList.remove('dragging');
        try { this.canvas.releasePointerCapture(e.pointerId); } catch (_){}
        if (d.moved){ this.editor.commit(); this.tap = null; this._emit('moved', { id: d.id }); return; }
      }
      const t = this.tap;
      if (this.active && t && e.pointerId === t.pid && !t.multi && Math.hypot(e.clientX - t.x, e.clientY - t.y) < 7 && performance.now() - t.t < 450) this.select(t.id);
      if (t && e.pointerId === t.pid) this.tap = null;
    };
    this.stage.addEventListener('pointerdown', down, true);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', (e) => {
      if (!this.active || (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]'))) return;
      if (e.key === 'Escape'){ this.select(null); return; }
      const id = this.selected; if (!id || e.ctrlKey || e.metaKey) return;
      const step = e.shiftKey ? 10 : 1, ax = LINES[id].axis;
      const keys = ax === 'x' ? { ArrowLeft: -step, ArrowRight: step } : { ArrowUp: -step, ArrowDown: step };
      if (keys[e.key] == null) return;
      e.preventDefault();
      this.nudge(id, keys[e.key], false);
      clearTimeout(this._kt); this._kt = setTimeout(() => this.editor.commit(), 400);
    });
  }
}
