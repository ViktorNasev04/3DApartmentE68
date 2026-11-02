/* Suspended ceiling with an LED cove: a lowered band along the walls, a raised field in the middle,
   a light line along the step and a shadow-gap light line along the walls.
   The band is the zone eroded by a square of half-size `band` (L∞), so inner corners stay square;
   it is computed on the grid of the zone's own edges and their offsets, which makes it exact. */
import * as THREE from 'three';

export const CEILING_DEFAULT = { style: 'cove', band: 0.5, drop: 0.15 };

const uniq = (a) => [...new Set(a.map(v => Math.round(v * 10000) / 10000))].sort((p, q) => p - q);
const inside = (rects, x, z) => rects.some(r => x > r[0] && x < r[2] && z > r[1] && z < r[3]);
function covered(rects, x0, z0, x1, z1){
  const xs = uniq([x0, x1, ...rects.flatMap(r => [r[0], r[2]]).filter(v => v > x0 && v < x1)]);
  const zs = uniq([z0, z1, ...rects.flatMap(r => [r[1], r[3]]).filter(v => v > z0 && v < z1)]);
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < zs.length - 1; j++)
    if (!inside(rects, (xs[i] + xs[i+1])/2, (zs[j] + zs[j+1])/2)) return false;
  return true;
}
/* maximal rectangles from a cell mask on a non-uniform grid */
function greedy(mask, xs, zs){
  const nx = xs.length - 1, nz = zs.length - 1, used = new Uint8Array(nx*nz), out = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++){
    if (!mask[j*nx + i] || used[j*nx + i]) continue;
    let w = 1; while (i + w < nx && mask[j*nx + i + w] && !used[j*nx + i + w]) w++;
    let h = 1;
    grow: while (j + h < nz){ for (let k = 0; k < w; k++) if (!mask[(j + h)*nx + i + k] || used[(j + h)*nx + i + k]) break grow; h++; }
    for (let jj = j; jj < j + h; jj++) for (let ii = i; ii < i + w; ii++) used[jj*nx + ii] = 1;
    out.push([xs[i], zs[j], xs[i + w], zs[j + h]]);
  }
  return out;
}
/* boundary segments between cells where test(a, b) holds, merged along their line; n points towards the `a` side */
function edges(state, xs, zs, test){
  const nx = xs.length - 1, nz = zs.length - 1, out = [];
  const at = (i, j) => (i < 0 || j < 0 || i >= nx || j >= nz) ? 0 : state[j*nx + i];
  for (let j = 0; j <= nz; j++){                       // lines z = zs[j]
    let run = null;
    const flush = () => { if (run){ out.push({ a: [run.u0, zs[j]], b: [run.u1, zs[j]], n: [0, run.dir] }); run = null; } };
    for (let i = 0; i < nx; i++){
      const north = at(i, j - 1), south = at(i, j);
      const dir = test(north, south) ? -1 : test(south, north) ? 1 : 0;
      if (dir && run && run.dir === dir) run.u1 = xs[i + 1];
      else { flush(); if (dir) run = { dir, u0: xs[i], u1: xs[i + 1] }; }
    }
    flush();
  }
  for (let i = 0; i <= nx; i++){                       // lines x = xs[i]
    let run = null;
    const flush = () => { if (run){ out.push({ a: [xs[i], run.u0], b: [xs[i], run.u1], n: [run.dir, 0] }); run = null; } };
    for (let j = 0; j < nz; j++){
      const west = at(i - 1, j), east = at(i, j);
      const dir = test(west, east) ? -1 : test(east, west) ? 1 : 0;
      if (dir && run && run.dir === dir) run.u1 = zs[j + 1];
      else { flush(); if (dir) run = { dir, u0: zs[j], u1: zs[j + 1] }; }
    }
    flush();
  }
  return out;
}

/* plan of one zone: rects in metres → field and band rectangles, step and wall lines */
export function coveZone(rects, band){
  let X0 = Infinity, Z0 = Infinity, X1 = -Infinity, Z1 = -Infinity;
  for (const r of rects){ X0 = Math.min(X0, r[0]); Z0 = Math.min(Z0, r[1]); X1 = Math.max(X1, r[2]); Z1 = Math.max(Z1, r[3]); }
  const xs = uniq(rects.flatMap(r => [r[0], r[2], r[0] + band, r[2] - band]).filter(v => v >= X0 && v <= X1));
  const zs = uniq(rects.flatMap(r => [r[1], r[3], r[1] + band, r[3] - band]).filter(v => v >= Z0 && v <= Z1));
  const nx = xs.length - 1, nz = zs.length - 1;
  const state = new Uint8Array(nx*nz);                // 0 outside, 1 band, 2 field
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++){
    const cx = (xs[i] + xs[i+1])/2, cz = (zs[j] + zs[j+1])/2;
    if (!inside(rects, cx, cz)) continue;
    state[j*nx + i] = covered(rects, xs[i] - band, zs[j] - band, xs[i+1] + band, zs[j+1] + band) ? 2 : 1;
  }
  return {
    field: greedy(state.map(s => s === 2 ? 1 : 0), xs, zs),
    band: greedy(state.map(s => s === 1 ? 1 : 0), xs, zs),
    steps: edges(state, xs, zs, (a, b) => a === 2 && b === 1),     // n points into the field
    walls: edges(state, xs, zs, (a, b) => a > 0 && b === 0),       // n points into the zone
  };
}

/* meshes for all zones; returns the group and the LED lengths in metres */
export function buildCove(zones, H, cfg, mats){
  const { band, drop } = cfg, yb = H - drop;
  const g = new THREE.Group(); g.name = 'cove';
  const flat = (rects, y, mat) => {
    const pos = [], nor = [];
    for (const [x0, z0, x1, z1] of rects){
      for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]]){ pos.push(x, y, z); nor.push(0, -1, 0); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; g.add(m); return m;
  };
  const vert = (segs, y0, y1, mat) => {
    const pos = [], nor = [];
    for (const s of segs){
      const [ax, az] = s.a, [bx, bz] = s.b, [nx, nz] = s.n;
      let q = [[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]];
      const e1 = [q[1][0] - q[0][0], 0, q[1][2] - q[0][2]], cross = [-e1[2], 0, e1[0]];
      if (cross[0]*nx + cross[2]*nz < 0) q = [q[1], q[0], q[3], q[2]];
      for (const p of [q[0], q[1], q[2], q[0], q[2], q[3]]){ pos.push(...p); nor.push(nx, 0, nz); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; g.add(m); return m;
  };
  const strips = (segs, y, inset, width) => {
    const rects = [];
    for (const s of segs){
      const [ax, az] = s.a, [bx, bz] = s.b, [nx, nz] = s.n;
      if (nx === 0){ const zc = az + nz*inset; rects.push([Math.min(ax, bx), zc - width/2, Math.max(ax, bx), zc + width/2]); }
      else { const xc = ax + nx*inset; rects.push([xc - width/2, Math.min(az, bz), xc + width/2, Math.max(az, bz)]); }
    }
    return rects;
  };
  let ledSteps = 0, ledWalls = 0;
  const fields = [], bands = [], steps = [], walls = [];
  for (const z of zones){
    const r = coveZone(z.rects.map(q => q.map(v => v/100)), band);
    fields.push(...r.field); bands.push(...r.band); steps.push(...r.steps); walls.push(...r.walls);
  }
  for (const s of steps) ledSteps += Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
  for (const s of walls) ledWalls += Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]);
  flat(fields, H, mats.field);
  flat(bands, yb, mats.ceiling);
  vert(steps, yb, H, mats.ceiling);
  const ls = flat(strips(steps, H - 0.002, 0.018, 0.022), H - 0.002, mats.led); ls.receiveShadow = false;
  const lw = flat(strips(walls, yb - 0.002, 0.016, 0.014), yb - 0.002, mats.led); lw.receiveShadow = false;
  const fieldAt = (x, z) => fields.some(q => x > q[0] && x < q[2] && z > q[1] && z < q[3]);
  return { group: g, ledSteps, ledWalls, fieldAt };
}
