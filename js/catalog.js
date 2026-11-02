/* Furniture catalogue: each type has parameters, a footprint and a builder.
   Local frame of every piece: origin at the centre of its footprint, floor at y = 0, front faces +z, back (wall side) at −z. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng } from './textures.js';

export const CATEGORIES = [
  { id: 'living', name: 'Дневна' },
  { id: 'dining', name: 'Хранене' },
  { id: 'kitchen', name: 'Кухня' },
  { id: 'bedroom', name: 'Спалня' },
  { id: 'bath', name: 'Баня и склад' },
  { id: 'other', name: 'Антре, лоджия, други' },
];

const FABRICS = [['cream', 0xf0ebe2, 'Букле, кремаво'], ['sand', 0xd8c9b1, 'Бежово'], ['olive', 0x67704b, 'Маслинено'], ['stone', 0xa9a49b, 'Сиво'], ['clay', 0xb98a6a, 'Теракота']];
const FINISH = [['oak', 0, 'Дъб'], ['walnut', 0x5a3e2b, 'Орех'], ['white', 0xf1eee8, 'Бяло'], ['greige', 0xcdc3b6, 'Грейж'], ['olive', 0x7a8160, 'Маслинено'], ['black', 0x26241f, 'Черно']];
const KITCHEN = [['greige', 0xcdc3b6, 'Грейж мат'], ['white', 0xf1eee8, 'Бяло мат'], ['oak', 0, 'Дъб'], ['olive', 0x7a8160, 'Маслинено']];
const LINEN = [['white', 0xf4f1ea, 'Бяло'], ['linen', 0xd9cdb9, 'Лен'], ['olive', 0x7d8562, 'Маслинено'], ['stone', 0xb3aea6, 'Сиво']];
const RUGS = [['cream', 0xffffff, 'Кремав'], ['sand', 0xe2cfb0, 'Пясък'], ['stone', 0xbdb8b0, 'Сив'], ['olive', 0xa8ad8a, 'Маслинен']];
const BOXCOL = [['oak', 0, 'Дъб'], ['white', 0xf1eee8, 'Бяло'], ['greige', 0xcdc3b6, 'Грейж'], ['black', 0x26241f, 'Черно'], ['cream', 0xf0ebe2, 'Букле'], ['olive', 0x67704b, 'Маслинено']];

const pick = (list, key) => (list.find(o => o[0] === key) || list[0]);

/* ---------- building helpers ---------- */
let C = null;                                  // build context: materials and caches, set by build()
function scaleBoxUV(geo, w, h, d, s){
  const uv = geo.attributes.uv, dims = [[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++){ const i = f*4 + k; uv.setXY(i, uv.getX(i)*dims[f][0]/s, uv.getY(i)*dims[f][1]/s); }
  uv.needsUpdate = true; return geo;
}
function box(parent, w, h, d, mat, x, y, z, cast = true){
  const m = new THREE.Mesh(scaleBoxUV(new THREE.BoxGeometry(w, h, d), w, h, d, 0.9), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
}
function rbox(parent, w, h, d, r, mat, x, y, z){
  const rr = Math.max(0.002, Math.min(r, w/2 - 0.001, h/2 - 0.001, d/2 - 0.001));
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, rr), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function cyl(parent, rt, rb, h, mat, x, y, z, seg = 32){
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function lathe(parent, profile, mat, x, y, z, s = 1, seg = 40){
  const m = new THREE.Mesh(new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(p[0]*s, p[1]*s)), seg), mat);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function blob(parent, w, d, x, z, round, opacity = 0.7){
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), C.blob(round, opacity));
  m.rotation.x = -Math.PI/2; m.position.set(x, 0.0035, z); m.renderOrder = 2; m.castShadow = false; m.receiveShadow = false;
  parent.add(m); return m;
}
function led(parent, w, h, d, x, y, z){ const m = box(parent, w, h, d, C.M.led, x, y, z, false); m.receiveShadow = false; return m; }
function rectLight(parent, w, h, x, y, z, intensity){
  const l = new THREE.RectAreaLight(0xffc98e, intensity, w, h);
  l.position.set(x, y, z); l.rotation.x = -Math.PI/2; l.userData.evening = true; l.userData.base = intensity; parent.add(l); return l;
}
const finishMat = (key, list = FINISH) => key === 'oak' ? C.M.oakH : key === 'walnut' ? C.M.walnutH : C.paint(pick(list, key)[1], 0.55);
const finishMatV = (key, list = FINISH) => key === 'oak' ? C.M.oakV : key === 'walnut' ? C.M.walnutV : C.paint(pick(list, key)[1], 0.55);

const VASE_TALL = [[0,0],[0.06,0],[0.075,0.05],[0.07,0.16],[0.045,0.25],[0.03,0.30],[0.035,0.31],[0,0.31]];
const VASE_ROUND = [[0,0],[0.05,0],[0.09,0.05],[0.095,0.10],[0.07,0.16],[0.035,0.18],[0.04,0.19],[0,0.19]];
const BOWL = [[0,0],[0.04,0],[0.09,0.03],[0.11,0.06],[0.105,0.065],[0.08,0.035],[0,0.03]];

/* ---------- pieces ---------- */
function tvUnit(p){
  const g = new THREE.Group(), M = C.M, H = C.H, W = p.W, zb = -0.19;
  if (p.style === 'lowboard'){
    const zb2 = -0.20;
    box(g, W, 0.42, 0.40, M.oakH, 0, 0.21 + 0.18, 0);
    const n = Math.max(2, Math.round(W/0.6));
    for (let i = 1; i < n; i++) box(g, 0.004, 0.40, 0.004, M.blackGloss, -W/2 + i*W/n, 0.39, 0.201, false);
    led(g, W - 0.08, 0.006, 0.012, 0, 0.176, 0.10);
    const s = p.tv === '55' ? 0.85 : p.tv === '75' ? 1.15 : 1;
    const tv = new THREE.Group(); tv.position.set(0, 1.25, zb2 + 0.03); g.add(tv);
    box(tv, 1.45*s, 0.835*s, 0.03, M.blackGloss, 0, 0, 0);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.43*s, 0.815*s), M.screen); scr.position.z = 0.0155; tv.add(scr);
    box(g, 0.92, 0.06, 0.09, M.black, 0, 0.63, 0.0);
    lathe(g, VASE_TALL, M.ceramicCream, -W/2 + 0.25, 0.60, 0.02);
    lathe(g, VASE_ROUND, M.ceramicOlive, W/2 - 0.25, 0.60, 0.02, 0.8);
    blob(g, W + 0.2, 0.6, 0, 0.05, false, 0.5);
    return g;
  }
  const colW = 0.45, cab0 = 0.22, cab1 = 0.62, top = 2.45;
  const sw = W - 2*colW;
  const stone = new THREE.Mesh(new THREE.PlaneGeometry(sw, top, 120, 150), M.stone);
  stone.position.set(0, top/2, zb + 0.004); stone.receiveShadow = true; g.add(stone);
  box(g, W, cab1 - cab0, 0.36, M.oakH, 0, (cab0 + cab1)/2, zb + 0.18);
  const nd = Math.max(3, Math.round(W/0.47)), gap = 0.004, dw = (W - gap*(nd + 1))/nd;
  for (let i = 0; i < nd; i++){
    const x = -W/2 + gap + dw/2 + i*(dw + gap);
    if (i === 1){
      const ns = 14, slw = dw/ns;
      box(g, dw, cab1 - cab0 - 0.008, 0.008, M.blackGloss, x, (cab0 + cab1)/2, zb + 0.364, false);
      for (let k = 0; k < ns; k++) box(g, slw*0.62, cab1 - cab0 - 0.012, 0.018, M.oakV, x - dw/2 + slw*(k + 0.5), (cab0 + cab1)/2, zb + 0.37, false);
    } else box(g, dw, cab1 - cab0 - 0.008, 0.018, M.oakV, x, (cab0 + cab1)/2, zb + 0.369, false);
  }
  led(g, W - 0.08, 0.006, 0.012, 0, cab0 - 0.004, zb + 0.30);
  const shelfYs = [1.16, 1.74];
  for (const cx of [-W/2 + colW/2, W/2 - colW/2]){
    const h = top - cab1;
    box(g, colW, h, 0.018, M.oakV, cx, cab1 + h/2, zb + 0.009);
    box(g, 0.022, h, 0.32, M.oakV, cx - colW/2 + 0.011, cab1 + h/2, zb + 0.16);
    box(g, 0.022, h, 0.32, M.oakV, cx + colW/2 - 0.011, cab1 + h/2, zb + 0.16);
    for (const y of shelfYs){ box(g, colW - 0.044, 0.03, 0.31, M.oakH, cx, y, zb + 0.165); led(g, colW - 0.07, 0.006, 0.01, cx, y - 0.019, zb + 0.29); }
    led(g, colW - 0.07, 0.006, 0.01, cx, top - 0.004, zb + 0.29);
  }
  for (const x of [-W/2 + colW + 0.012, W/2 - colW - 0.012]) led(g, 0.006, top - 0.02, 0.01, x, top/2, zb + 0.05);
  box(g, W, H - top, 0.38, M.oakH, 0, (top + H)/2, 0);
  led(g, sw - 0.04, 0.006, 0.01, 0, top - 0.004, zb + 0.09);
  const s = p.tv === '55' ? 0.85 : p.tv === '75' ? 1.15 : 1;
  const tv = new THREE.Group(); tv.position.set(0, 1.22, zb + 0.085); g.add(tv);
  box(tv, 1.45*s, 0.835*s, 0.03, M.blackGloss, 0, 0, 0);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.43*s, 0.815*s), M.screen); scr.position.z = 0.0155; tv.add(scr);
  box(g, 0.92, 0.06, 0.09, M.black, 0, 0.73, zb + 0.10);
  if (p.decor){
    const lx = -W/2 + colW/2, rx = W/2 - colW/2;
    lathe(g, VASE_TALL, M.ceramicCream, lx, 1.175, zb + 0.15);
    lathe(g, BOWL, M.ceramicDark, lx, 1.755, zb + 0.16);
    box(g, 0.24, 0.035, 0.18, M.book1, lx, 0.637, zb + 0.16); box(g, 0.21, 0.03, 0.16, M.book2, lx + 0.01, 0.67, zb + 0.16);
    lathe(g, VASE_ROUND, M.ceramicOlive, rx - 0.07, 1.175, zb + 0.15, 0.8); lathe(g, VASE_TALL, M.ceramicCream, rx + 0.09, 1.175, zb + 0.15, 0.65);
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.045, 0.018, 64, 8, 2, 3), M.ceramicCream); knot.position.set(rx, 1.80, zb + 0.16); knot.castShadow = true; g.add(knot);
    lathe(g, VASE_ROUND, M.ceramicCream, rx, 0.635, zb + 0.16, 0.9);
    const px = -W/2 + colW + 0.18;
    lathe(g, VASE_TALL, M.ceramicCream, px, cab1, zb + 0.20, 1.05);
    for (let i = 0; i < 6; i++){
      const a = (i/6)*Math.PI*2, tilt = 0.18 + (i%2)*0.1, len = 0.42 + (i%3)*0.08;
      const stem = new THREE.Group(); stem.position.set(px, cab1 + 0.30, zb + 0.20); stem.rotation.set(Math.cos(a)*tilt, 0, Math.sin(a)*tilt); g.add(stem);
      cyl(stem, 0.003, 0.003, len, M.stem, 0, len/2, 0, 4);
      const plume = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), M.pampas); plume.scale.set(0.8, 3.2, 0.8); plume.position.y = len + 0.06; plume.castShadow = true; stem.add(plume);
    }
  }
  rectLight(g, sw - 0.04, 0.12, 0, top - 0.01, zb + 0.10, 14);
  rectLight(g, W - 0.1, 0.14, 0, cab0 - 0.01, zb + 0.26, 9);
  return g;
}

function sofa(p){
  const g = new THREE.Group(), mat = C.fabric(pick(FABRICS, p.color)[1]), M = C.M;
  const corner = p.kind !== 'straight';
  const L = p.L, D = p.D, Cd = corner ? Math.max(p.C, D + 0.4) : D;
  const zb = -Cd/2, arm = 0.28, Wc = 0.95;
  const s = p.kind === 'corner-l' ? -1 : 1;            // chaise side seen from the front: left = local −x, right = local +x
  const channels = (x0, x1, fn) => {
    const n = Math.max(2, Math.round((x1 - x0)/0.333)), cw = (x1 - x0)/n;
    for (let i = 0; i < n; i++) fn(x0 + cw*(i + 0.5), cw);
  };
  if (!corner){
    const inner = L - 2*arm;
    channels(-inner/2, inner/2, (x, cw) => {
      rbox(g, cw + 0.014, 0.42, D - 0.20, 0.15, mat, x, 0.21, zb + 0.20 + (D - 0.20)/2);
      const b = rbox(g, cw + 0.014, 0.42, 0.28, 0.13, mat, x, 0.58, zb + 0.15); b.rotation.x = -0.10;
    });
    rbox(g, inner, 0.42, 0.26, 0.10, mat, 0, 0.21, zb + 0.13);
    for (const k of [-1, 1]) rbox(g, arm, 0.64, D, 0.15, mat, k*(L/2 - arm/2), 0.32, zb + D/2);
    blob(g, L + 0.35, D + 0.30, 0, 0, false, 0.85);
  } else {
    const cx0 = s > 0 ? L/2 - Wc : -L/2, cx1 = cx0 + Wc;  // chaise band
    const mx0 = s > 0 ? -L/2 + arm : -L/2 + Wc, mx1 = s > 0 ? L/2 - Wc : L/2 - arm;
    channels(mx0, mx1, (x, cw) => rbox(g, cw + 0.014, 0.42, D - 0.20, 0.15, mat, x, 0.21, zb + 0.20 + (D - 0.20)/2));
    const bx0 = s > 0 ? -L/2 + arm : -L/2, bx1 = s > 0 ? L/2 : L/2 - arm;
    channels(bx0, bx1, (x, cw) => { const b = rbox(g, cw + 0.014, 0.42, 0.28, 0.13, mat, x, 0.58, zb + 0.15); b.rotation.x = -0.10; });
    rbox(g, bx1 - bx0, 0.42, 0.26, 0.10, mat, (bx0 + bx1)/2, 0.21, zb + 0.13);
    const n = 3, cw = Wc/n, len = Cd - 0.20;
    for (let i = 0; i < n; i++) rbox(g, cw + 0.012, 0.42, len, 0.15, mat, cx0 + cw*(i + 0.5), 0.21, zb + 0.20 + len/2);
    rbox(g, arm, 0.64, D, 0.15, mat, -s*(L/2 - arm/2), 0.32, zb + D/2);
    blob(g, L + 0.3, D + 0.25, 0, zb + D/2, false, 0.85);
    blob(g, Wc + 0.3, Cd - D + 0.2, (cx0 + cx1)/2, zb + D + (Cd - D)/2, false, 0.75);
  }
  if (p.pillows){
    const span = corner ? (s > 0 ? [-L/2 + arm, L/2 - Wc] : [-L/2 + Wc, L/2 - arm]) : [-L/2 + arm, L/2 - arm];
    const w = span[1] - span[0], z = zb + 0.33;
    const p1 = rbox(g, 0.48, 0.44, 0.13, 0.06, mat, span[0] + w*0.18, 0.64, z); p1.rotation.set(-0.28, -0.08, 0.05);
    const p2 = rbox(g, 0.46, 0.42, 0.13, 0.06, M.olive, span[0] + w*0.78, 0.63, z); p2.rotation.set(-0.30, 0.10, -0.07);
    const p3 = rbox(g, 0.42, 0.40, 0.12, 0.06, M.olive, span[0] + w*0.40, 0.62, z + 0.03); p3.rotation.set(-0.33, -0.05, 0.10);
  }
  return g;
}
function sofaShapes(p){
  if (p.kind === 'straight') return [[-p.L/2, -p.D/2, p.L/2, p.D/2]];
  const Cd = Math.max(p.C, p.D + 0.4), zb = -Cd/2, Wc = 0.95, s = p.kind === 'corner-l' ? -1 : 1;
  const cx0 = s > 0 ? p.L/2 - Wc : -p.L/2;
  return [[-p.L/2, zb, p.L/2, zb + p.D], [cx0, zb, cx0 + Wc, Cd/2]];
}

function armchair(p){
  const g = new THREE.Group(), mat = C.fabric(pick(FABRICS, p.color)[1]);
  const W = 0.82, D = 0.84;
  rbox(g, W, 0.36, D, 0.14, mat, 0, 0.18, 0);
  rbox(g, W - 0.30, 0.14, D - 0.24, 0.06, mat, 0, 0.42, 0.08);
  const b = rbox(g, W, 0.46, 0.22, 0.10, mat, 0, 0.56, -D/2 + 0.12); b.rotation.x = -0.12;
  for (const k of [-1, 1]) rbox(g, 0.16, 0.58, D, 0.08, mat, k*(W/2 - 0.08), 0.29, 0);
  blob(g, W + 0.3, D + 0.3, 0, 0, true, 0.7);
  return g;
}

function coffeeTable(p){
  const g = new THREE.Group(), r = p.D/2;
  const mat = p.finish === 'travertine' ? C.M.travertine : p.finish === 'black' ? C.M.black : C.M.oakH;
  cyl(g, r, r, 0.035, mat, 0, 0.345, 0, 64);
  cyl(g, r*0.62, r*0.66, 0.33, mat, 0, 0.165, 0, 48);
  lathe(g, BOWL, C.M.ceramicDark, r*0.25, 0.3625, -r*0.15, 1.2);
  box(g, 0.24, 0.03, 0.18, C.M.book1, -r*0.3, 0.378, r*0.15);
  blob(g, p.D + 0.25, p.D + 0.25, 0, 0, true, 0.6);
  return g;
}

function sideTable(){
  const g = new THREE.Group(), M = C.M;
  cyl(g, 0.21, 0.21, 0.03, M.oakH, 0, 0.50, 0, 48);
  cyl(g, 0.022, 0.022, 0.48, M.black, 0, 0.25, 0, 16);
  cyl(g, 0.15, 0.15, 0.015, M.black, 0, 0.008, 0, 40);
  lathe(g, VASE_ROUND, M.ceramicDark, 0, 0.515, 0, 0.7);
  blob(g, 0.55, 0.55, 0, 0, true, 0.7);
  return g;
}

function rug(p){
  const g = new THREE.Group(), mat = C.rug(pick(RUGS, p.color)[1]);
  if (p.round){
    const r = Math.min(p.W, p.D)/2;
    const top = new THREE.Mesh(new THREE.CircleGeometry(r, 64), mat); top.rotation.x = -Math.PI/2; top.position.y = 0.0062; top.receiveShadow = true; g.add(top);
    const edge = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.006, 64, 1, true), mat); edge.position.y = 0.003; g.add(edge);
  } else {
    const top = new THREE.Mesh(new THREE.PlaneGeometry(p.W, p.D), mat); top.rotation.x = -Math.PI/2; top.position.y = 0.0062; top.receiveShadow = true; g.add(top);
    box(g, p.W, 0.006, p.D, mat, 0, 0.003, 0, false);
  }
  return g;
}

function plant(p){
  const g = new THREE.Group(), M = C.M, s = p.S;
  lathe(g, [[0,0],[0.17,0],[0.20,0.30],[0.21,0.40],[0.19,0.40],[0.18,0.38],[0,0.38]], M.ceramicCream, 0, 0.006, 0);
  const tree = new THREE.Group(); tree.scale.setScalar(s); g.add(tree);
  const V = (x,y,z) => new THREE.Vector3(x,y,z);
  const tube = (pts, r) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, r, 6), M.trunk); m.castShadow = true; tree.add(m); };
  tube([V(0,0.36,0), V(0.03,0.75,0.01), V(-0.02,1.10,0.03), V(0.01,1.32,0)], 0.022);
  const crowns = [[0.14,1.60,0.05,0.19],[-0.15,1.54,-0.06,0.18],[0.02,1.82,-0.04,0.20],[-0.06,1.42,0.15,0.15],[0.17,1.40,-0.13,0.15]];
  crowns.forEach(c => tube([V(0.01,1.15,0.01), V(c[0]*0.5, (1.15+c[1])/2, c[2]*0.5), V(c[0], c[1]-0.04, c[2])], 0.009));
  const NL = 1100, RR = rng(4);
  const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), M.leaf, NL);
  const dm = new THREE.Object3D(), ca = new THREE.Color(0x66714c), cb = new THREE.Color(0x98a27f), cc = new THREE.Color();
  for (let i = 0; i < NL; i++){
    const c = crowns[i % crowns.length], r = c[3]*Math.cbrt(RR());
    const th = RR()*Math.PI*2, ph = Math.acos(2*RR()-1);
    dm.position.set(c[0] + r*Math.sin(ph)*Math.cos(th), c[1] + r*Math.cos(ph)*0.75, c[2] + r*Math.sin(ph)*Math.sin(th));
    dm.rotation.set(RR()*Math.PI, RR()*Math.PI, RR()*Math.PI);
    dm.scale.set(0.036, 0.004, 0.009); dm.updateMatrix(); leaves.setMatrixAt(i, dm.matrix);
    leaves.setColorAt(i, cc.copy(ca).lerp(cb, RR()));
  }
  leaves.castShadow = true; leaves.receiveShadow = true; leaves.userData.keep = true; tree.add(leaves);
  blob(g, 0.6, 0.6, 0, 0, true, 0.7);
  return g;
}

function floorLamp(){
  const g = new THREE.Group(), M = C.M;
  for (let i = 0; i < 3; i++){
    const a = i/3*Math.PI*2, leg = cyl(g, 0.012, 0.012, 1.42, M.oakV, Math.sin(a)*0.14, 0.70, Math.cos(a)*0.14, 10);
    leg.rotation.set(Math.cos(a)*0.2, 0, -Math.sin(a)*0.2);
  }
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.23, 0.30, 40, 1, true), M.lampShade);
  shade.position.set(0, 1.48, 0); shade.castShadow = true; g.add(shade);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), M.lampShade); glow.rotation.x = Math.PI/2; glow.position.y = 1.36; g.add(glow);
  blob(g, 0.55, 0.55, 0, 0, true, 0.55);
  return g;
}

function pendant(g, h0){
  const M = C.M, H = C.H, pg = new THREE.Group(); pg.userData.keep = true; pg.userData.ceiling = true; g.add(pg);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 40, 28), M.lampShade); globe.position.y = h0; pg.add(globe);
  cyl(pg, 0.004, 0.004, H - h0 - 0.22, M.black, 0, (H + h0 + 0.22)/2, 0, 6);
  cyl(pg, 0.06, 0.06, 0.02, M.black, 0, H - 0.01, 0, 24);
  const spot = new THREE.SpotLight(0xffc690, 6, 0, 1.15, 1, 2);
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005; spot.shadow.radius = 6;
  spot.position.set(0, h0 - 0.10, 0); spot.target.position.set(0, 0, 0);
  spot.userData.evening = true; spot.userData.base = 6;
  pg.add(spot); pg.add(spot.target);
  const glow = new THREE.PointLight(0xffc690, 0.8, 0, 2); glow.position.set(0, h0 + 0.02, 0); glow.userData.evening = true; glow.userData.base = 0.8; pg.add(glow);
  return pg;
}

function tableRound(p){
  const g = new THREE.Group(), M = C.M, r = p.D/2;
  cyl(g, r, r, 0.026, M.oakH, 0, 0.737, 0, 96);
  const prof = [[0,0],[0.27,0],[0.27,0.012]];
  for (let i = 1; i <= 12; i++){ const t = i/12, y = 0.012 + t*0.70; prof.push([0.15 + 0.12*Math.pow(1-t, 1.7), y]); }
  prof.push([0, 0.712]);
  lathe(g, prof, M.oakV, 0, 0.003, 0, 1, 64);
  cyl(g, 0.15, 0.13, 0.02, M.ceramicDark, 0.05, 0.76, -0.02, 40);
  lathe(g, VASE_TALL, M.ceramicCream, -0.05, 0.77, 0, 0.75, 32);
  blob(g, p.D + 0.3, p.D + 0.3, 0, 0, true, 0.6);
  if (p.lamp) pendant(g, 1.72);
  return g;
}

function tableRect(p){
  const g = new THREE.Group(), M = C.M;
  const legMat = p.legs === 'black' ? M.black : M.oakV;
  box(g, p.L, 0.03, p.W, M.oakH, 0, 0.745, 0);
  box(g, p.L - 0.16, 0.07, p.W - 0.16, M.oakH, 0, 0.695, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]){
    const l = cyl(g, 0.022, 0.016, 0.70, legMat, sx*(p.L/2 - 0.09), 0.35, sz*(p.W/2 - 0.09), 12);
    l.rotation.z = sx*0.04; l.rotation.x = -sz*0.04;
  }
  lathe(g, VASE_TALL, M.ceramicCream, 0.1, 0.76, 0, 0.75, 32);
  blob(g, p.L + 0.3, p.W + 0.3, 0, 0, false, 0.6);
  if (p.lamp) pendant(g, 1.72);
  return g;
}

function chair(){
  const g = new THREE.Group(), M = C.M, inner = new THREE.Group(); inner.rotation.y = Math.PI; g.add(inner);
  const fab = C.fabric(0xcbbca5);
  rbox(inner, 0.48, 0.07, 0.46, 0.03, fab, 0, 0.455, 0);
  box(inner, 0.44, 0.03, 0.42, M.oakH, 0, 0.405, 0);
  [[-0.205,-0.19],[0.205,-0.19],[-0.205,0.19],[0.205,0.19]].forEach(([x, z]) => {
    const l = cyl(inner, 0.017, 0.013, 0.42, M.oakV, x*1.04, 0.205, z*1.04, 10);
    l.rotation.z = -Math.sign(x)*0.07; l.rotation.x = Math.sign(z)*0.07;
  });
  const rail = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.017, 8, 40, Math.PI), M.oakH);
  rail.rotation.x = Math.PI/2; rail.position.set(0, 0.76, 0); rail.castShadow = true; inner.add(rail);
  [[-0.245,0],[0.245,0],[0,0.245]].forEach(([x, z]) => cyl(inner, 0.014, 0.014, 0.30, M.oakV, x, 0.62, z, 8));
  const back = new THREE.Mesh(new THREE.CylinderGeometry(0.228, 0.228, 0.17, 28, 1, true, -1.15, 2.3), C.fabricBack(0xcbbca5));
  back.position.set(0, 0.64, 0); back.castShadow = true; inner.add(back);
  blob(g, 0.62, 0.62, 0, 0, true, 0.55);
  return g;
}

function barCounter(p){
  const g = new THREE.Group();
  box(g, p.L, p.H - 0.04, p.D - 0.06, p.color === 'oak' ? C.M.oakV : C.paint(pick(KITCHEN, p.color)[1], 0.6), 0, (p.H - 0.04)/2, -0.03);
  box(g, p.L + 0.02, 0.04, p.D, p.top === 'oak' ? C.M.oakH : C.M.worktop, 0, p.H - 0.02, 0);
  blob(g, p.L + 0.25, p.D + 0.25, 0, 0, false, 0.5);
  return g;
}

function kitchenRun(p){
  const g = new THREE.Group(), M = C.M, L = p.L;
  const cab = p.color === 'oak' ? M.oakV : C.paint(pick(KITCHEN, p.color)[1], 0.62);
  box(g, L, 0.10, 0.56, M.blackGloss, 0, 0.05, -0.02, false);
  box(g, L, 0.78, 0.60, cab, 0, 0.49, 0);
  box(g, L, 0.03, 0.64, M.worktop, 0, 0.895, 0.02);
  for (let x = -L/2 + 0.60; x < L/2 - 0.1; x += 0.60) box(g, 0.004, 0.76, 0.004, M.blackGloss, x, 0.49, 0.301, false);
  const at = v => Math.max(-L/2 + 0.3, Math.min(L/2 - 0.3, -L/2 + v));
  if (p.sink){
    const x = at(p.sinkAt);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.42), M.ceramicDark); s.rotation.x = -Math.PI/2; s.position.set(x, 0.9115, 0.03); g.add(s);
    const tap = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 24, Math.PI), M.black); tap.position.set(x, 1.0, -0.22); g.add(tap);
    box(g, 0.02, 0.12, 0.02, M.black, x - 0.09, 0.96, -0.22, false);
  }
  if (p.hob){
    const x = at(p.hobAt);
    const h = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.50), M.blackGloss); h.rotation.x = -Math.PI/2; h.position.set(x, 0.9115, 0.03); g.add(h);
  }
  if (p.uppers){
    box(g, L, 0.72, 0.35, cab, 0, 1.82, -0.30 + 0.175);
    for (let x = -L/2 + 0.60; x < L/2 - 0.1; x += 0.60) box(g, 0.004, 0.70, 0.004, M.blackGloss, x, 1.82, -0.30 + 0.351, false);
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.55), M.worktop); sp.position.set(0, 1.185, -0.298); g.add(sp);
    led(g, L - 0.1, 0.006, 0.008, 0, 1.458, -0.30 + 0.32);
    rectLight(g, L - 0.15, 0.22, 0, 1.455, -0.30 + 0.20, 7);
  }
  blob(g, L + 0.3, 0.95, 0, 0.12, false, 0.5);
  return g;
}

function kitchenTall(p){
  const g = new THREE.Group(), M = C.M;
  const cab = p.color === 'oak' ? M.oakV : C.paint(pick(KITCHEN, p.color)[1], 0.62);
  box(g, p.W, 0.10, 0.56, M.blackGloss, 0, 0.05, -0.02, false);
  box(g, p.W, p.H - 0.10, 0.60, cab, 0, 0.10 + (p.H - 0.10)/2, 0);
  box(g, p.W - 0.01, 0.004, 0.004, M.blackGloss, 0, 0.95, 0.301, false);
  box(g, 0.012, 0.5, 0.02, M.black, p.W/2 - 0.05, 1.25, 0.31, false);
  box(g, 0.012, 0.3, 0.02, M.black, p.W/2 - 0.05, 0.62, 0.31, false);
  blob(g, p.W + 0.2, 0.9, 0, 0.1, false, 0.5);
  return g;
}

function bedPuffy(p){
  const g = new THREE.Group(), M = C.M, W = p.W, L = 2.0, side = 0.15, foot = 0.30, headT = 0.20;
  const TW = W + 2*side, D = headT + L + foot, zh = -D/2, zm0 = zh + headT, zm1 = zm0 + L, zc = (zm0 + zm1)/2;
  const fab = C.fabric(0xe9e1d3), bedd = C.paint(pick(LINEN, p.linen)[1], 0.95);
  const nh = Math.max(7, Math.round(TW/0.22)), ch = TW/nh;
  for (let i = 0; i < nh; i++) rbox(g, ch + 0.012, 1.12, headT, 0.10, fab, -TW/2 + ch*(i + 0.5), 0.58, zh + headT/2);
  for (const k of [-1, 1]) rbox(g, side + 0.02, 0.44, L + 0.02, 0.09, fab, k*(W/2 + side/2), 0.22, zc);
  const nf = Math.max(6, Math.round(TW/0.23)), cf = TW/nf;
  for (let i = 0; i < nf; i++) rbox(g, cf + 0.012, 0.50, foot + 0.02, 0.14, fab, -TW/2 + cf*(i + 0.5), 0.25, zm1 + foot/2);
  box(g, W, 0.24, L, fab, 0, 0.12, zc);
  rbox(g, W - 0.01, 0.22, L - 0.02, 0.06, M.bedding, 0, 0.35, zc);
  rbox(g, W + 0.05, 0.09, L - 0.38, 0.04, bedd, 0, 0.50, zm0 + 0.38 + (L - 0.38)/2);
  for (const k of [-1, 1]){
    const pl = rbox(g, Math.min(0.72, W/2 - 0.04), 0.18, 0.44, 0.08, M.bedding, k*W/4, 0.60, zm0 + 0.24); pl.rotation.x = -0.4;
    const cu = rbox(g, Math.min(0.52, W/2 - 0.14), 0.30, 0.12, 0.05, M.olive, k*W/4.4, 0.64, zm0 + 0.48); cu.rotation.x = -0.32;
  }
  rbox(g, W + 0.08, 0.035, 0.66, 0.015, M.olive, 0, 0.56, zm0 + L*0.58);
  blob(g, TW + 0.3, D + 0.3, 0, 0, false, 0.75);
  return g;
}

function bed(p){
  if (p.head === 'puffy') return bedPuffy(p);
  const g = new THREE.Group(), M = C.M, W = p.W, L = 2.0, D = L + 0.14;
  const head = p.head === 'oak' ? M.oakV : C.fabric(0xe9e2d6);
  const bedd = C.paint(pick(LINEN, p.linen)[1], 0.95);
  const zh = -D/2;
  if (p.head === 'oak'){
    box(g, W + 0.12, 1.05, 0.06, M.oakH, 0, 0.525, zh + 0.03);
    for (let x = -W/2 - 0.02; x <= W/2 + 0.03; x += 0.09) box(g, 0.05, 1.03, 0.025, M.oakV, x, 0.53, zh + 0.07, false);
  } else {
    const n = Math.max(5, Math.round((W + 0.12)/0.26)), cw = (W + 0.12)/n;
    for (let i = 0; i < n; i++) rbox(g, cw + 0.01, 1.08, 0.12, 0.05, head, -(W + 0.12)/2 + cw*(i + 0.5), 0.54, zh + 0.06);
  }
  rbox(g, W + 0.08, 0.30, L + 0.02, 0.05, p.head === 'oak' ? M.oakH : head, 0, 0.15, zh + 0.12 + L/2);
  rbox(g, W, 0.22, L - 0.02, 0.06, M.bedding, 0, 0.41, zh + 0.13 + L/2);
  const duv = rbox(g, W + 0.06, 0.10, L - 0.42, 0.045, bedd, 0, 0.555, zh + 0.12 + 0.42 + (L - 0.42)/2);
  duv.castShadow = true;
  const np = W >= 1.75 ? 3 : 2;
  for (let i = 0; i < np; i++){
    const x = -W/2 + (W/np)*(i + 0.5);
    const pl = rbox(g, Math.min(0.62, W/np - 0.04), 0.16, 0.42, 0.07, M.bedding, x, 0.62, zh + 0.36); pl.rotation.x = -0.35;
  }
  rbox(g, W + 0.10, 0.035, 0.48, 0.015, M.olive, 0, 0.62, zh + 0.12 + L - 0.30);
  blob(g, W + 0.4, D + 0.3, 0, 0, false, 0.75);
  return g;
}

function nightstand(p){
  const g = new THREE.Group(), M = C.M;
  box(g, 0.45, 0.22, 0.38, finishMat(p.finish), 0, 0.44, 0);
  box(g, 0.43, 0.004, 0.004, M.blackGloss, 0, 0.44, 0.191, false);
  if (p.lamp){
    lathe(g, VASE_ROUND, M.ceramicCream, -0.06, 0.55, -0.03, 1.1);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.18, 32, 1, true), M.lampShade);
    shade.position.set(-0.06, 0.86, -0.03); shade.castShadow = true; g.add(shade);
    box(g, 0.16, 0.03, 0.11, M.book2, 0.11, 0.565, 0.04);
  }
  blob(g, 0.6, 0.5, 0, 0, false, 0.4);
  return g;
}

function wardrobe(p){
  const g = new THREE.Group(), M = C.M, W = p.W, D = p.D, Ht = p.H;
  const body = finishMatV(p.finish);
  box(g, W - 0.02, 0.06, D - 0.06, M.blackGloss, 0, 0.03, -0.03, false);
  if (p.doors === 'glass'){
    const y0 = 0.06, hh = Ht - 0.06, t = 0.02, n = Math.max(2, Math.round(W/0.55)), dw = W/n;
    box(g, W, hh, t, body, 0, y0 + hh/2, -D/2 + t/2);
    for (const sx of [-1, 1]) box(g, t, hh, D - 0.03, body, sx*(W/2 - t/2), y0 + hh/2, -0.015);
    box(g, W, t, D - 0.03, body, 0, Ht - t/2, -0.015); box(g, W, t, D - 0.03, body, 0, y0 + t/2, -0.015);
    for (let i = 1; i < n; i++) box(g, t, hh - 2*t, D - 0.06, body, -W/2 + i*dw, y0 + hh/2, -0.03);
    box(g, W - 2*t, t, D - 0.06, body, 0, 0.55, -0.03);
    cyl(g, 0.012, 0.012, W - 0.06, M.black, 0, Ht - 0.32, -0.04, 10).rotation.z = Math.PI/2;
    const R = rng(Math.round(W*100)), tones = [0x4a4844, 0xcfc6b8, 0x6b7350, 0x8c7a63, 0xe8e2d6, 0x2f2e2c];
    for (let x = -W/2 + 0.08; x < W/2 - 0.08; x += 0.045 + R()*0.03){
      const h = 0.7 + R()*0.45;
      box(g, 0.02, h, 0.42, C.paint(tones[Math.floor(R()*tones.length)], 0.95), x, Ht - 0.34 - h/2, -0.04, false);
    }
    for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) box(g, dw*0.22, 0.12, 0.30, M.book2, -W/2 + dw*(i + 0.25 + k*0.25), 0.62, -0.06, false);
    for (const sx of [-1, 1]) led(g, 0.008, hh - 0.1, 0.008, sx*(W/2 - t - 0.01), y0 + hh/2, D/2 - 0.06);
    for (let i = 0; i < n; i++){
      const cx = -W/2 + dw*(i + 0.5), fz = D/2 - 0.012;
      for (const sx of [-1, 1]) box(g, 0.025, hh, 0.025, M.black, cx + sx*(dw/2 - 0.0125), y0 + hh/2, fz, false);
      box(g, dw, 0.025, 0.025, M.black, cx, Ht - 0.0125, fz, false); box(g, dw, 0.025, 0.025, M.black, cx, y0 + 0.0125, fz, false);
      for (const f of [0.34, 0.68]) box(g, dw, 0.018, 0.022, M.black, cx, y0 + hh*f, fz, false);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(dw - 0.05, hh - 0.05), M.smoke); gl.position.set(cx, y0 + hh/2, fz); gl.renderOrder = 3; g.add(gl);
      box(g, 0.012, 0.5, 0.025, M.black, cx + (i % 2 ? -1 : 1)*(dw/2 - 0.06), 1.05, fz + 0.02, false);
    }
  } else if (p.doors === 'sliding'){
    box(g, W, Ht - 0.06, D - 0.05, body, 0, 0.06 + (Ht - 0.06)/2, -0.025);
    box(g, W/2 + 0.02, Ht - 0.10, 0.02, body, -W/4, 0.06 + (Ht - 0.06)/2, D/2 - 0.035);
    box(g, W/2 + 0.02, Ht - 0.10, 0.02, body, W/4, 0.06 + (Ht - 0.06)/2, D/2 - 0.012);
    box(g, W, 0.03, 0.05, M.black, 0, Ht - 0.015, D/2 - 0.025, false);
  } else {
    box(g, W, Ht - 0.06, D, body, 0, 0.06 + (Ht - 0.06)/2, 0);
    const n = Math.max(2, Math.round(W/0.5)), dw = W/n;
    for (let i = 1; i < n; i++) box(g, 0.004, Ht - 0.10, 0.004, M.blackGloss, -W/2 + i*dw, 0.06 + (Ht - 0.06)/2, D/2 + 0.001, false);
    for (let i = 0; i < n; i++){
      const hx = -W/2 + dw*(i + (i % 2 ? 0.12 : 0.88));
      box(g, 0.012, 0.32, 0.02, M.black, hx, 1.05, D/2 + 0.01, false);
    }
  }
  blob(g, W + 0.25, D + 0.25, 0, 0, false, 0.6);
  return g;
}

function dresser(p){
  const g = new THREE.Group(), M = C.M;
  box(g, p.W, 0.66, 0.45, finishMat(p.finish), 0, 0.14 + 0.33, 0);
  for (const y of [0.36, 0.58]) box(g, p.W - 0.02, 0.004, 0.004, M.blackGloss, 0, y, 0.226, false);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.015, 0.012, 0.14, M.black, sx*(p.W/2 - 0.05), 0.07, sz*0.17, 8);
  lathe(g, VASE_TALL, M.ceramicCream, -p.W/2 + 0.2, 0.80, 0, 0.9);
  blob(g, p.W + 0.25, 0.7, 0, 0, false, 0.5);
  return g;
}

function desk(p){
  const g = new THREE.Group(), M = C.M;
  box(g, p.W, 0.03, 0.6, M.oakH, 0, 0.745, 0);
  for (const sx of [-1, 1]){
    box(g, 0.03, 0.73, 0.03, M.black, sx*(p.W/2 - 0.05), 0.365, -0.26);
    box(g, 0.03, 0.73, 0.03, M.black, sx*(p.W/2 - 0.05), 0.365, 0.26);
    box(g, 0.03, 0.03, 0.55, M.black, sx*(p.W/2 - 0.05), 0.70, 0);
  }
  blob(g, p.W + 0.2, 0.8, 0, 0, false, 0.4);
  return g;
}

function shelf(p){
  const g = new THREE.Group(), M = C.M, mat = finishMat(p.finish);
  for (const sx of [-1, 1]) box(g, 0.025, p.H, 0.35, mat, sx*(p.W/2 - 0.0125), p.H/2, 0);
  const n = Math.max(3, Math.round(p.H/0.38));
  for (let i = 0; i <= n; i++) box(g, p.W - 0.05, 0.025, 0.34, mat, 0, 0.05 + i*(p.H - 0.08)/n, 0);
  box(g, 0.3, 0.22, 0.25, M.ceramicCream, -p.W/4, 0.05 + (p.H - 0.08)/n + 0.12, 0);
  blob(g, p.W + 0.2, 0.55, 0, 0, false, 0.45);
  return g;
}

function shower(p){
  const g = new THREE.Group(), M = C.M, W = p.W, D = p.D;
  if (p.glass === 'side'){
    const s = p.side === 'left' ? -1 : 1, gx = s*(W/2 - 0.006);
    box(g, W - 0.24, 0.004, 0.05, M.black, 0, 0.003, -D/2 + 0.09, false);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(0.008, 2.0, D - 0.02), M.showerGlass); gl.position.set(gx, 1.0, 0); gl.renderOrder = 3; g.add(gl);
    box(g, 0.022, 0.022, D, M.black, gx, 2.0, 0, false);
    box(g, 0.022, 0.022, D, M.black, gx, 0.011, 0, false);
    box(g, 0.026, 2.0, 0.026, M.black, gx, 1.0, D/2 - 0.013, false);
    box(g, 0.022, 2.0, 0.03, M.black, gx, 1.0, -D/2 + 0.015, false);
    cyl(g, 0.15, 0.15, 0.012, M.black, -s*0.05, 2.15, -D/2 + 0.32, 32);
    box(g, 0.02, 0.02, 0.32, M.black, -s*0.05, 2.17, -D/2 + 0.16, false);
    const bx = -s*(W/2 - 0.16);
    box(g, 0.022, 1.15, 0.022, M.black, bx, 1.32, -D/2 + 0.035, false);
    box(g, 0.16, 0.06, 0.06, M.black, bx, 1.0, -D/2 + 0.045, false);
    const hh = box(g, 0.035, 0.22, 0.035, M.black, bx, 1.55, -D/2 + 0.07, false); hh.rotation.x = 0.25;
    return g;
  }
  box(g, W, 0.04, D, M.porcelain, 0, 0.02, 0);
  box(g, 0.5, 0.004, 0.04, M.steel, 0, 0.042, D/2 - 0.12, false);
  const s = p.side === 'left' ? -1 : 1;
  const gw = Math.min(W - 0.05, Math.max(0.5, W*0.62));
  const gx = s*(W/2 - gw/2);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(gw, 1.96, 0.008), M.showerGlass); glass.position.set(gx, 1.02, D/2 - 0.01); glass.renderOrder = 3; g.add(glass);
  box(g, gw, 0.02, 0.02, M.black, gx, 2.01, D/2 - 0.01, false);
  box(g, 0.02, 1.96, 0.03, M.black, s*(W/2 - 0.01), 1.02, D/2 - 0.01, false);
  box(g, 0.015, 0.015, D, M.black, gx - s*gw/2 + s*0.01, 2.01, 0, false);
  cyl(g, 0.15, 0.15, 0.01, M.black, 0, 2.15, -D/2 + 0.28, 32);
  box(g, 0.02, 0.02, 0.26, M.black, 0, 2.17, -D/2 + 0.13, false);
  box(g, 0.02, 0.9, 0.02, M.black, -s*(W/2 - 0.25), 1.30, -D/2 + 0.03, false);
  return g;
}

function toilet(p){
  const g = new THREE.Group(), M = C.M;
  if (p.kind === 'floor'){
    rbox(g, 0.30, 0.30, 0.40, 0.10, M.porcelain, 0, 0.15, 0.03);
    rbox(g, 0.37, 0.16, 0.56, 0.12, M.porcelain, 0, 0.33, 0.04);
    rbox(g, 0.38, 0.03, 0.50, 0.014, M.white, 0, 0.425, 0.07);
    rbox(g, 0.36, 0.38, 0.16, 0.05, M.porcelain, 0, 0.63, -0.25);
    cyl(g, 0.025, 0.025, 0.012, M.steel, 0, 0.825, -0.25, 20);
    blob(g, 0.55, 0.8, 0, 0, false, 0.4);
    return g;
  }
  rbox(g, 0.36, 0.30, 0.50, 0.13, M.porcelain, 0, 0.27, 0.02);
  rbox(g, 0.37, 0.025, 0.45, 0.012, M.white, 0, 0.43, 0.04);
  box(g, 0.24, 0.16, 0.012, M.black, 0, 1.05, -0.27, false);
  return g;
}

function vanity(p){
  const g = new THREE.Group(), M = C.M, W = p.W, slab = p.style === 'slab';
  if (slab){
    rbox(g, W, 0.20, 0.46, 0.015, M.stoneSlab, 0, 0.80, 0);
    const basin = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.3, W - 0.24), 0.30), C.paint(0xcdbfa6, 0.4)); basin.rotation.x = -Math.PI/2; basin.position.set(0, 0.9015, 0.04); g.add(basin);
    cyl(g, 0.016, 0.019, 0.30, M.black, 0, 1.05, -0.17, 16);
    box(g, 0.022, 0.022, 0.15, M.black, 0, 1.19, -0.11, false);
    box(g, 0.012, 0.012, 0.07, M.black, 0.035, 1.12, -0.17, false);
    cyl(g, 0.032, 0.032, 0.15, M.black, W/2 - 0.2, 0.975, -0.12, 16);
    lathe(g, VASE_ROUND, M.ceramicCream, W/2 - 0.09, 0.90, -0.11, 0.85);
    const RR = rng(12), leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), M.leaf, 140);
    const dm = new THREE.Object3D(), ca = new THREE.Color(0x56603f), cb = new THREE.Color(0x7d8a5c), cc = new THREE.Color();
    for (let i = 0; i < 140; i++){
      const a = RR()*Math.PI*2, r = 0.02 + RR()*0.13, h = 1.06 + RR()*0.28;
      dm.position.set(W/2 - 0.09 + Math.cos(a)*r, h, -0.11 + Math.sin(a)*r*0.8);
      dm.rotation.set(RR()*0.6 - 0.3 + Math.PI/2*0.4, a, RR()*0.8);
      dm.scale.set(0.006, 0.03, 0.002); dm.updateMatrix(); leaves.setMatrixAt(i, dm.matrix); leaves.setColorAt(i, cc.copy(ca).lerp(cb, RR()));
    }
    leaves.castShadow = true; leaves.userData.keep = true; g.add(leaves);
    led(g, W - 0.06, 0.006, 0.01, 0, 0.697, 0.12);
    rectLight(g, W - 0.1, 0.12, 0, 0.69, 0.06, 4);
  } else {
    box(g, W, 0.40, 0.46, finishMat(p.finish), 0, 0.62, 0);
    box(g, W - 0.01, 0.004, 0.004, M.blackGloss, 0, 0.62, 0.231, false);
    rbox(g, W + 0.01, 0.10, 0.47, 0.02, M.porcelain, 0, 0.87, 0.005);
    const basin = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.16, 0.30), M.white); basin.rotation.x = -Math.PI/2; basin.position.set(0, 0.921, 0.04); g.add(basin);
    box(g, 0.025, 0.20, 0.025, M.black, 0, 1.02, -0.18, false);
    box(g, 0.025, 0.025, 0.12, M.black, 0, 1.11, -0.13, false);
  }
  if (p.mirror){
    const r = Math.min(0.36, W/2 - 0.01), my = slab ? 1.56 : 1.58;
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 56), M.mirror); m.position.set(0, my, -0.215); g.add(m);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.01, 8, 64), M.black); ring.position.copy(m.position); g.add(ring);
    const glow = new THREE.Mesh(new THREE.RingGeometry(r + 0.004, r + 0.055, 64), M.led); glow.position.set(0, my, -0.231); g.add(glow);
  }
  blob(g, W + 0.2, 0.6, 0, 0, false, 0.35);
  return g;
}

function washer(){
  const g = new THREE.Group(), M = C.M;
  rbox(g, 0.60, 0.85, 0.58, 0.02, M.white, 0, 0.425, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 12, 48), M.steel); ring.position.set(0, 0.45, 0.295); g.add(ring);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.16, 40), M.blackGloss); glass.position.set(0, 0.45, 0.292); g.add(glass);
  box(g, 0.5, 0.004, 0.004, M.steel, 0, 0.73, 0.291, false);
  blob(g, 0.8, 0.8, 0, 0, false, 0.5);
  return g;
}

function boiler(){
  const g = new THREE.Group(), M = C.M;
  const c = cyl(g, 0.225, 0.225, 0.80, M.white, 0, 1.85, 0, 40); c.rotation.y = 0.3;
  box(g, 0.08, 0.06, 0.12, M.steel, 0, 1.40, 0, false);
  return g;
}

function acOutdoor(){
  const g = new THREE.Group(), M = C.M;
  box(g, 0.80, 0.55, 0.30, C.paint(0xd9d7d2, 0.6), 0, 0.32, 0);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.012, 8, 48), M.black); ring.position.set(-0.1, 0.32, 0.151); g.add(ring);
  const fan = new THREE.Mesh(new THREE.CircleGeometry(0.19, 40), C.paint(0x55524d, 0.8)); fan.position.set(-0.1, 0.32, 0.151); g.add(fan);
  for (const sx of [-1, 1]) box(g, 0.05, 0.05, 0.36, M.black, sx*0.3, 0.025, 0, false);
  return g;
}

function bistro(){
  const g = new THREE.Group(), M = C.M;
  cyl(g, 0.30, 0.30, 0.02, M.black, 0, 0.72, 0, 40);
  cyl(g, 0.02, 0.02, 0.71, M.black, 0, 0.355, 0, 10);
  cyl(g, 0.2, 0.2, 0.01, M.black, 0, 0.005, 0, 30);
  for (const sx of [-1, 1]){
    const c = new THREE.Group(); c.position.set(sx*0.48, 0, 0); c.rotation.y = -sx*Math.PI/2; g.add(c);
    box(c, 0.40, 0.025, 0.38, M.oakH, 0, 0.45, 0);
    box(c, 0.40, 0.30, 0.02, M.oakH, 0, 0.72, -0.19);
    for (const lx of [-0.18, 0.18]) for (const lz of [-0.17, 0.17]) box(c, 0.02, 0.45, 0.02, M.black, lx, 0.225, lz, false);
  }
  blob(g, 1.3, 0.8, 0, 0, false, 0.5);
  return g;
}

function customBox(p){
  const g = new THREE.Group();
  const mat = p.color === 'oak' ? C.M.oakH : p.color === 'cream' || p.color === 'olive' ? C.fabric(pick(BOXCOL, p.color)[1]) : C.paint(pick(BOXCOL, p.color)[1], 0.6);
  rbox(g, p.W, p.H, p.D, 0.02, mat, 0, p.H/2, 0);
  blob(g, p.W + 0.25, p.D + 0.25, 0, 0, false, 0.5);
  return g;
}

function stoneWall(p){
  const g = new THREE.Group(), M = C.M, ledge = p.kind !== 'relief', dens = 40;
  const geo = new THREE.PlaneGeometry(p.W, p.H, Math.max(8, Math.round(p.W*dens)), Math.max(8, Math.round(p.H*dens)));
  const su = ledge ? p.W/0.8 : p.W/1.9, sv = ledge ? p.H/0.8 : p.H/2.45;
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i)*su, uv.getY(i)*sv);
  const st = new THREE.Mesh(geo, ledge ? M.ledge : M.stone); st.position.set(0, p.H/2, -0.02); st.receiveShadow = true; g.add(st);
  if (p.led){
    led(g, p.W - 0.04, 0.006, 0.01, 0, p.H - 0.01, 0.0);
    for (const k of [-1, 1]) led(g, 0.008, p.H - 0.04, 0.01, k*(p.W/2 - 0.006), p.H/2, 0.0);
    rectLight(g, p.W - 0.08, 0.10, 0, p.H - 0.03, 0.04, Math.min(16, 6*p.W));
  }
  return g;
}

function shoeboard(p){
  const g = new THREE.Group(), M = C.M, W = p.W, D = p.D, Ht = 0.92, body = finishMatV(p.finish), t = 0.02;
  const Wo = 0.46, s = p.open === 'right' ? 1 : -1, xo = s*(W/2 - Wo/2), Wc = W - Wo, xc = -s*(W/2 - Wc/2);
  box(g, Wc - 0.01, 0.06, D - 0.04, M.blackGloss, xc, 0.03, -0.02, false);
  box(g, Wc, Ht - 0.06, D, body, xc, 0.06 + (Ht - 0.06)/2, 0);
  const n = Math.max(2, Math.round(Wc/0.42)), dw = Wc/n;
  for (let i = 1; i < n; i++) box(g, 0.004, Ht - 0.10, 0.004, M.blackGloss, xc - Wc/2 + i*dw, 0.06 + (Ht - 0.06)/2, D/2 + 0.001, false);
  box(g, Wo, Ht, t, body, xo, Ht/2, -D/2 + t/2);
  box(g, t, Ht, D, body, s*(W/2 - t/2), Ht/2, 0);
  box(g, Wo, t, D, body, xo, Ht - t/2, 0);
  const R = rng(7), tones = [0x2a2622, 0xcbb89c, 0x5b4636, 0xe6dfd2], shelves = [0.04, 0.33, 0.62];
  for (const y of shelves){
    box(g, Wo - t, t, D - 0.02, body, xo - s*t/2, y, 0);
    led(g, Wo - 0.07, 0.005, 0.008, xo - s*t/2, y + 0.27, D/2 - 0.04);
    for (let k = 0; k < 2; k++){
      const col = C.paint(tones[Math.floor(R()*tones.length)], 0.6), x0 = xo - s*t/2 - Wo/4 + k*Wo/2;
      for (const dx of [-0.042, 0.042]) rbox(g, 0.072, 0.08, Math.min(0.25, D - 0.05), 0.03, col, x0 + dx, y + t/2 + 0.04, 0);
    }
  }
  cyl(g, 0.035, 0.04, 0.16, M.black, xc - Wc/2 + 0.18, Ht + 0.08, -0.02, 16);
  for (let i = 0; i < 5; i++){ const st = cyl(g, 0.0025, 0.0025, 0.26, M.oakV, xc - Wc/2 + 0.18, Ht + 0.29, -0.02, 4); st.rotation.set((i - 2)*0.08, 0, (i%2 ? 1 : -1)*0.12); }
  box(g, 0.26, 0.05, 0.19, M.book1, xc - Wc/2 + 0.48, Ht + 0.025, 0); box(g, 0.22, 0.03, 0.16, M.book2, xc - Wc/2 + 0.48, Ht + 0.065, 0);
  lathe(g, BOWL, M.ceramicDark, xc + 0.05, Ht, 0, 1.2);
  lathe(g, VASE_TALL, M.ceramicDark, xc + Wc/2 - 0.16, Ht, 0, 0.8);
  if (p.art){
    const aw = Math.min(1.5, W*0.72), ah = aw*0.6, ay = 1.32 + ah/2, ax = xc*0.25;
    box(g, aw + 0.06, ah + 0.06, 0.035, M.walnutH, ax, ay, -D/2 + 0.018);
    box(g, aw + 0.01, ah + 0.01, 0.01, C.paint(0xf1ece2, 0.9), ax, ay, -D/2 + 0.036, false);
    const cnv = new THREE.Mesh(new THREE.PlaneGeometry(aw - 0.08, ah - 0.08), M.art); cnv.position.set(ax, ay, -D/2 + 0.042); g.add(cnv);
  }
  blob(g, W + 0.25, D + 0.25, 0, 0, false, 0.5);
  return g;
}

function towel(){
  const g = new THREE.Group(), M = C.M;
  box(g, 0.02, 0.02, 0.06, M.black, 0, 1.48, 0, false);
  rbox(g, 0.32, 0.64, 0.03, 0.012, M.towel, 0, 1.14, 0.015);
  rbox(g, 0.30, 0.10, 0.045, 0.02, M.towel, 0, 1.44, 0.02);
  return g;
}

function bench(p){
  const g = new THREE.Group(), mat = C.fabric(pick(FABRICS, p.color)[1]);
  const n = Math.max(4, Math.round(p.W/0.24)), cw = p.W/n;
  for (let i = 0; i < n; i++) rbox(g, cw + 0.012, 0.44, 0.44, 0.15, mat, -p.W/2 + cw*(i + 0.5), 0.22, 0);
  blob(g, p.W + 0.25, 0.7, 0, 0, false, 0.6);
  return g;
}

function floorMirror(){
  const g = new THREE.Group(), M = C.M, inner = new THREE.Group(); inner.rotation.x = -0.14; inner.position.z = -0.06; g.add(inner);
  box(inner, 0.62, 1.72, 0.03, M.black, 0, 0.86, 0);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 1.66), M.mirror); m.position.set(0, 0.86, 0.016); inner.add(m);
  return g;
}

/* ---------- the catalogue ---------- */
const R = (key, label, min, max, step, def, extra) => ({ key, label, type: 'range', min, max, step, def, ...extra });
const CH = (key, label, options, def, extra) => ({ key, label, type: 'choice', options, def, ...extra });
const CO = (key, label, options, def) => ({ key, label, type: 'color', options, def });
const B = (key, label, def, extra) => ({ key, label, type: 'bool', def, ...extra });

export const TYPES = {
  tvunit: { name: 'ТВ секция', cat: 'living', build: tvUnit,
    params: [CH('style', 'Вид', [['stone', 'С камък до тавана'], ['lowboard', 'Нисък шкаф']], 'stone'), R('W', 'Ширина', 1.6, 3.4, 0.05, 2.8), CH('tv', 'Телевизор', [['55', '55"'], ['65', '65"'], ['75', '75"']], '65'), B('decor', 'Декорация', true, { if: p => p.style === 'stone' })],
    size: p => [p.W, p.style === 'lowboard' ? 0.40 : 0.38], note: 'по поръчка' },
  sofa: { name: 'Диван', cat: 'living', build: sofa, shapes: sofaShapes,
    params: [CH('kind', 'Вид', [['straight', 'Прав'], ['corner-l', 'Ъглов, шезлонгът вляво'], ['corner-r', 'Ъглов, шезлонгът вдясно']], 'straight'),
      R('L', 'Дължина', 1.6, 3.4, 0.05, 2.6), R('C', 'Дълбочина при шезлонга', 1.4, 2.2, 0.05, 1.65, { if: p => p.kind !== 'straight' }),
      R('D', 'Дълбочина', 0.85, 1.15, 0.05, 1.0), CO('color', 'Дамаска', FABRICS, 'cream'), B('pillows', 'Възглавници', true)],
    size: p => [p.L, p.kind === 'straight' ? p.D : Math.max(p.C, p.D + 0.4)] },
  armchair: { name: 'Кресло', cat: 'living', build: armchair, params: [CO('color', 'Дамаска', FABRICS, 'sand')], size: () => [0.82, 0.84] },
  coffee: { name: 'Холна масичка', cat: 'living', build: coffeeTable,
    params: [R('D', 'Диаметър', 0.5, 1.1, 0.05, 0.8), CH('finish', 'Материал', [['oak', 'Дъб'], ['travertine', 'Травертин'], ['black', 'Черно']], 'travertine')],
    size: p => [p.D, p.D], round: true },
  side: { name: 'Помощна масичка', cat: 'living', build: sideTable, params: [], size: () => [0.42, 0.42], round: true },
  rug: { name: 'Килим', cat: 'living', build: rug, flat: true,
    params: [R('W', 'Дължина', 0.5, 3.4, 0.05, 2.4), R('D', 'Ширина', 0.4, 2.6, 0.05, 1.6), B('round', 'Кръгъл', false), CO('color', 'Цвят', RUGS, 'cream')],
    size: p => p.round ? [Math.min(p.W, p.D), Math.min(p.W, p.D)] : [p.W, p.D] },
  plant: { name: 'Маслиново дърво', cat: 'living', build: plant, params: [R('S', 'Височина', 0.7, 1.3, 0.05, 1.0)], size: () => [0.45, 0.45], round: true },
  lamp: { name: 'Лампион', cat: 'living', build: floorLamp, params: [], size: () => [0.5, 0.5], round: true },
  tableRound: { name: 'Кръгла маса KLIPLEV', cat: 'dining', build: tableRound, carries: 'chair',
    params: [R('D', 'Диаметър', 0.8, 1.4, 0.05, 1.2), B('lamp', 'Висяща лампа отгоре', true)],
    size: p => [p.D, p.D], round: true, price: p => Math.abs(p.D - 1.2) < 0.01 ? 299 : null, shop: 'JYSK' },
  tableRect: { name: 'Правоъгълна маса', cat: 'dining', build: tableRect, carries: 'chair',
    params: [R('L', 'Дължина', 1.0, 2.4, 0.05, 1.6), R('W', 'Ширина', 0.7, 1.1, 0.05, 0.9), CH('legs', 'Крака', [['oak', 'Дъб'], ['black', 'Черни']], 'oak'), B('lamp', 'Висяща лампа отгоре', true)],
    size: p => [p.L, p.W] },
  chair: { name: 'Стол EJSING', cat: 'dining', build: chair, params: [], size: () => [0.50, 0.50], price: () => 50, shop: 'JYSK', priceNote: 'промо, редовна 74.99 €' },
  bar: { name: 'Бар плот', cat: 'dining', build: barCounter,
    params: [R('L', 'Дължина', 0.8, 2.6, 0.05, 1.8), R('D', 'Дълбочина', 0.35, 0.7, 0.05, 0.45), CH('H', 'Височина', [[0.9, '90 см'], [1.05, '105 см']], 0.9), CH('top', 'Плот', [['stone', 'Като кухнята'], ['oak', 'Дъб']], 'stone'), CO('color', 'Цокъл', KITCHEN, 'greige')],
    size: p => [p.L, p.D] },
  kitchen: { name: 'Кухня — шкафове', cat: 'kitchen', build: kitchenRun,
    params: [R('L', 'Дължина', 0.4, 3.6, 0.05, 2.0), CO('color', 'Фронтове', KITCHEN, 'greige'), B('sink', 'Мивка', true), R('sinkAt', 'Мивка — от левия край', 0.3, 3.3, 0.05, 1.1, { if: p => p.sink }),
      B('hob', 'Котлон', false), R('hobAt', 'Котлон — от левия край', 0.3, 3.3, 0.05, 0.45, { if: p => p.hob }), B('uppers', 'Горни шкафове', true)],
    size: p => [p.L, 0.60] },
  kitchenTall: { name: 'Колона с хладилник', cat: 'kitchen', build: kitchenTall,
    params: [CH('W', 'Ширина', [[0.6, '60 см'], [0.7, '70 см']], 0.7), R('H', 'Височина', 2.0, 2.6, 0.05, 2.2), CO('color', 'Фронт', KITCHEN, 'greige')],
    size: p => [p.W, 0.60] },
  bed: { name: 'Легло', cat: 'bedroom', build: bed,
    params: [CH('W', 'Матрак', [[1.4, '140 × 200'], [1.6, '160 × 200'], [1.8, '180 × 200']], 1.6), CH('head', 'Рамка', [['puffy', 'Обли канали отвсякъде'], ['boucle', 'Табла с канали'], ['oak', 'Дъбови летви']], 'puffy'), CO('linen', 'Завивка', LINEN, 'white')],
    size: p => p.head === 'puffy' ? [p.W + 0.30, 2.50] : [p.W + 0.12, 2.14] },
  nightstand: { name: 'Нощно шкафче', cat: 'bedroom', build: nightstand, params: [CO('finish', 'Цвят', FINISH, 'oak'), B('lamp', 'Нощна лампа', true)], size: () => [0.45, 0.38] },
  wardrobe: { name: 'Гардероб', cat: 'bedroom', build: wardrobe,
    params: [R('W', 'Ширина', 0.6, 3.6, 0.05, 1.7), R('D', 'Дълбочина', 0.35, 0.7, 0.05, 0.6), R('H', 'Височина', 1.8, 2.65, 0.05, 2.4), CO('finish', 'Цвят', FINISH, 'greige'), CH('doors', 'Врати', [['hinged', 'Отваряеми'], ['sliding', 'Плъзгащи'], ['glass', 'Стъкло с черна рамка']], 'hinged')],
    size: p => [p.W, p.D] },
  bench: { name: 'Пейка, букле', cat: 'bedroom', build: bench, params: [R('W', 'Ширина', 0.9, 2.0, 0.05, 1.6), CO('color', 'Дамаска', FABRICS, 'cream')], size: p => [p.W, 0.44] },
  stonewall: { name: 'Стена с камък', cat: 'other', build: stoneWall, wall: true,
    params: [CH('kind', 'Камък', [['ledge', 'Стифиран'], ['relief', 'Релефен (като на секцията)']], 'ledge'), R('W', 'Ширина', 0.6, 4.0, 0.05, 2.4), R('H', 'Височина', 1.0, 2.65, 0.05, 2.65), B('led', 'LED по краищата', true)], size: p => [p.W, 0.05] },
  shoeboard: { name: 'Скрин с рафтове за обувки', cat: 'bedroom', build: shoeboard,
    params: [R('W', 'Ширина', 1.2, 2.6, 0.05, 2.0), R('D', 'Дълбочина', 0.25, 0.45, 0.01, 0.32), CO('finish', 'Цвят', FINISH, 'greige'), CH('open', 'Рафтовете', [['left', 'Отляво'], ['right', 'Отдясно']], 'left'), B('art', 'Картина отгоре', true)],
    size: p => [p.W, p.D] },
  dresser: { name: 'Скрин', cat: 'bedroom', build: dresser, params: [R('W', 'Ширина', 0.8, 1.8, 0.05, 1.2), CO('finish', 'Цвят', FINISH, 'oak')], size: p => [p.W, 0.45] },
  desk: { name: 'Бюро', cat: 'bedroom', build: desk, params: [R('W', 'Ширина', 0.9, 1.8, 0.05, 1.2)], size: p => [p.W, 0.6] },
  shower: { name: 'Душ', cat: 'bath', build: shower,
    params: [CH('glass', 'Вид', [['side', 'Без корито, стъкло отстрани'], ['front', 'С корито, стъкло отпред']], 'side'), R('W', 'Ширина', 0.7, 1.4, 0.05, 0.9), R('D', 'Дълбочина', 0.7, 1.4, 0.05, 1.0), CH('side', 'Стъклото', [['left', 'Отляво'], ['right', 'Отдясно']], 'right')],
    size: p => [p.W, p.D] },
  toilet: { name: 'Тоалетна', cat: 'bath', build: toilet, params: [CH('kind', 'Вид', [['floor', 'Стояща, с казанче'], ['wall', 'Окачена']], 'floor')], size: p => [0.38, p.kind === 'wall' ? 0.55 : 0.66] },
  vanity: { name: 'Мивка', cat: 'bath', build: vanity, params: [CH('style', 'Вид', [['slab', 'Каменен плот с LED'], ['cabinet', 'Шкаф с мивка']], 'slab'), R('W', 'Ширина', 0.45, 1.2, 0.05, 0.75), { ...CO('finish', 'Шкаф', FINISH, 'oak'), if: p => p.style === 'cabinet' }, B('mirror', 'Кръгло огледало с LED', true)], size: p => [p.W, 0.47] },
  towel: { name: 'Кърпа на кука', cat: 'bath', build: towel, params: [], size: () => [0.34, 0.06], wall: true },
  washer: { name: 'Пералня', cat: 'bath', build: washer, params: [], size: () => [0.60, 0.60] },
  boiler: { name: 'Бойлер 80 л', cat: 'bath', build: boiler, params: [], size: () => [0.46, 0.46], round: true, wall: true },
  shelf: { name: 'Етажерка', cat: 'bath', build: shelf, params: [R('W', 'Ширина', 0.5, 1.4, 0.05, 0.9), R('H', 'Височина', 0.8, 2.4, 0.05, 1.8), CO('finish', 'Цвят', FINISH, 'white')], size: p => [p.W, 0.35] },
  mirror: { name: 'Огледало, стоящо', cat: 'other', build: floorMirror, params: [], size: () => [0.62, 0.28] },
  bistro: { name: 'Масичка и 2 стола', cat: 'other', build: bistro, params: [], size: () => [1.30, 0.70] },
  ac: { name: 'Климатик, външно тяло', cat: 'other', build: acOutdoor, params: [], size: () => [0.80, 0.36] },
  box: { name: 'Друго (по размер)', cat: 'other', build: customBox,
    params: [{ key: 'name', label: 'Име', type: 'text', def: 'Мебел' }, R('W', 'Ширина', 0.1, 3.6, 0.05, 1.0), R('D', 'Дълбочина', 0.1, 2.4, 0.05, 0.5), R('H', 'Височина', 0.05, 2.65, 0.05, 0.8), CO('color', 'Цвят', BOXCOL, 'oak')],
    size: p => [p.W, p.D] },
};

export function defaults(type){
  const p = {};
  for (const d of TYPES[type].params) p[d.key] = d.def;
  return p;
}
export function withDefaults(type, params){ return { ...defaults(type), ...(params || {}) }; }
export function displayName(item){ return item.type === 'box' ? (item.p.name || TYPES.box.name) : TYPES[item.type].name; }

/* footprint rectangles in local coordinates [x0, z0, x1, z1] */
export function shapesOf(type, p){
  const T = TYPES[type];
  if (T.shapes) return T.shapes(p);
  const [w, d] = T.size(p);
  return [[-w/2, -d/2, w/2, d/2]];
}

/* ---------- build & merge ---------- */
export function setBuildContext(ctx){ C = ctx; }

/* Bake each piece into a few meshes, one per material: far fewer draw calls for the planner. Lights and instanced meshes stay as they are. */
function compact(src){
  src.updateMatrixWorld(true);
  const out = new THREE.Group();
  const buckets = new Map();
  const keepers = [];
  src.traverse(o => {
    if (o === src) return;
    if (o.isLight || o.isInstancedMesh || o.userData.keep){ keepers.push(o); return; }
    if (!o.isMesh || Array.isArray(o.material)) return;
    if (o.parent && keepers.includes(o.parent)) return;
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal' && name !== 'uv') geo.deleteAttribute(name);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2), 2));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    geo.applyMatrix4(o.matrixWorld);
    const key = o.material.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '') + (o.renderOrder || 0);
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder, geos: [] });
    buckets.get(key).geos.push(geo);
  });
  for (const b of buckets.values()){
    const merged = b.geos.length === 1 ? b.geos[0] : mergeGeometries(b.geos, false);
    if (b.geos.length > 1) b.geos.forEach(gg => gg.dispose());
    const m = new THREE.Mesh(merged, b.mat); m.castShadow = b.cast; m.receiveShadow = b.receive; m.renderOrder = b.order || 0;
    out.add(m);
  }
  for (const o of keepers){
    const m = o.matrixWorld.clone();
    o.removeFromParent();
    m.decompose(o.position, o.quaternion, o.scale);
    out.add(o);
    if (o.isSpotLight || o.isDirectionalLight){
      const t = o.target; const tm = t.matrixWorld.clone(); t.removeFromParent(); tm.decompose(t.position, t.quaternion, t.scale); out.add(t);
    }
  }
  src.traverse(o => { if (o.isMesh && o.geometry && !keepers.includes(o)) o.geometry.dispose(); });
  return out;
}

export function buildItem(item){
  const T = TYPES[item.type];
  const raw = T.build(item.p);
  const g = compact(raw);
  g.userData.itemId = item.id;
  return g;
}

export function disposeItem(g){
  g.traverse(o => { if (o.isMesh) o.geometry.dispose(); if (o.isLight && o.shadow && o.shadow.map) o.shadow.map.dispose(); });
}

export { FABRICS, FINISH, KITCHEN, LINEN, RUGS };
