/* Procedural textures: noise, stone, oak, bouclé, rug, TV picture, sky, contact shadows, and the faces the floor shader tiles */

/* ================= noise ================= */
function makeNoise(seed){
  const perm = new Uint8Array(512), p = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = (seed * 9301 + 49297) % 233280 || 1;
  for (let i = 255; i > 0; i--){ s = (s * 16807) % 2147483647; const j = s % (i + 1); const t = p[i]; p[i] = p[j]; p[j] = t; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = [1,-1,1,-1,1,-1,0,0], gy = [1,1,-1,-1,0,0,1,-1];
  const F2 = 0.5*(Math.sqrt(3)-1), G2 = (3-Math.sqrt(3))/6;
  return function(xin, yin){
    const s = (xin+yin)*F2, i = Math.floor(xin+s), j = Math.floor(yin+s), t = (i+j)*G2;
    const x0 = xin-(i-t), y0 = yin-(j-t);
    const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
    const x1 = x0-i1+G2, y1 = y0-j1+G2, x2 = x0-1+2*G2, y2 = y0-1+2*G2;
    const ii = i & 255, jj = j & 255;
    let n = 0, tt, g;
    tt = 0.5-x0*x0-y0*y0; if (tt > 0){ g = perm[ii+perm[jj]] & 7; tt *= tt; n += tt*tt*(gx[g]*x0+gy[g]*y0); }
    tt = 0.5-x1*x1-y1*y1; if (tt > 0){ g = perm[ii+i1+perm[jj+j1]] & 7; tt *= tt; n += tt*tt*(gx[g]*x1+gy[g]*y1); }
    tt = 0.5-x2*x2-y2*y2; if (tt > 0){ g = perm[ii+1+perm[jj+1]] & 7; tt *= tt; n += tt*tt*(gx[g]*x2+gy[g]*y2); }
    return 70*n;
  };
}
function fbm(n, x, y, oct){ let a = 0.5, f = 1, s = 0; for (let o = 0; o < oct; o++){ s += a*n(x*f, y*f); f *= 2.03; a *= 0.5; } return s; }
function rng(seed){ let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v,a,b) => v < a ? a : v > b ? b : v;
const smooth = (a,b,v) => { const t = clamp((v-a)/(b-a),0,1); return t*t*(3-2*t); };
const mk = (w,h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

/* ================= procedural textures ================= */
function stoneMaps(){
  const w = 380, h = 490, n = makeNoise(7), n2 = makeNoise(29), n3 = makeNoise(41);
  const H = new Float32Array(w*h); let lo = 9, hi = -9;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const px = x/w*1.9*2.4, py = y/h*2.45*2.4;
    const wx = fbm(n2, px*0.6, py*0.6, 2);
    const a = fbm(n, px + wx*0.9, py + wx*0.9, 4);
    let r = 1 - Math.abs(fbm(n2, px*1.7 + 3, py*1.7, 3)); r = r*r*r;
    const g = n3(px*12, py*12)*0.05;
    const v = 0.6*(a*0.5+0.5) + 0.42*r + g;
    H[y*w+x] = v; if (v < lo) lo = v; if (v > hi) hi = v;
  }
  for (let i = 0; i < H.length; i++) H[i] = (H[i]-lo)/(hi-lo);
  const hc = mk(w,h), cc = mk(w,h), nc = mk(w,h);
  const hd = hc.getContext('2d').createImageData(w,h), cd = cc.getContext('2d').createImageData(w,h), nd = nc.getContext('2d').createImageData(w,h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const i = y*w + x, v = H[i], k = i*4;
    hd.data[k] = hd.data[k+1] = hd.data[k+2] = v*255; hd.data[k+3] = 255;
    const shade = 0.80 + 0.22*v;
    cd.data[k] = 240*shade; cd.data[k+1] = 233*shade; cd.data[k+2] = 222*shade; cd.data[k+3] = 255;
    const xl = H[y*w + Math.max(0,x-1)], xr = H[y*w + Math.min(w-1,x+1)];
    const yu = H[Math.max(0,y-1)*w + x], yd = H[Math.min(h-1,y+1)*w + x];
    const s = 9, dx = (xr-xl)*s, dy = (yu-yd)*s;
    const len = Math.hypot(dx, dy, 1);
    nd.data[k] = (-dx/len*0.5+0.5)*255; nd.data[k+1] = (-dy/len*0.5+0.5)*255; nd.data[k+2] = (1/len*0.5+0.5)*255; nd.data[k+3] = 255;
  }
  hc.getContext('2d').putImageData(hd,0,0); cc.getContext('2d').putImageData(cd,0,0); nc.getContext('2d').putImageData(nd,0,0);
  return { height: hc, color: cc, normal: nc };
}
function woodCanvas(horizontal){
  const s = 512, c = mk(s,s), ctx = c.getContext('2d'), img = ctx.createImageData(s,s), d = img.data;
  const n = makeNoise(horizontal ? 5 : 6), n2 = makeNoise(17);
  const A = [216,186,146], B = [184,149,108];
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++){
    const u = horizontal ? y : x, v = horizontal ? x : y;
    const g = fbm(n, u*0.01, v*0.0016, 3);
    const ring = Math.sin(u*0.13 + g*2.2 + fbm(n2, u*0.004, v*0.0015, 2)*3.2)*0.5 + 0.5;
    const fine = n(u*0.9, v*0.02)*0.5 + 0.5;
    const pore = n2(u*1.6, v*0.08) > 0.55 ? 0.18 : 0;
    const t = clamp(0.45*ring + 0.3*fine + 0.2*(g*0.5+0.5) + pore, 0, 1);
    const k = (y*s + x)*4;
    d[k] = A[0] + (B[0]-A[0])*t; d[k+1] = A[1] + (B[1]-A[1])*t; d[k+2] = A[2] + (B[2]-A[2])*t; d[k+3] = 255;
  }
  ctx.putImageData(img,0,0);
  return c;
}
function boucleCanvas(){
  const s = 256, c = mk(s,s), ctx = c.getContext('2d'), R = rng(3);
  ctx.fillStyle = '#808080'; ctx.fillRect(0,0,s,s);
  for (let i = 0; i < 2600; i++){
    const x = R()*s, y = R()*s, r = 1.4 + R()*2.2, gv = Math.floor(120 + R()*120);
    ctx.strokeStyle = `rgb(${gv},${gv},${gv})`; ctx.lineWidth = 1.3;
    for (const ox of [-s,0,s]) for (const oy of [-s,0,s]){ ctx.beginPath(); ctx.arc(x+ox, y+oy, r, 0, Math.PI*2); ctx.stroke(); }
  }
  return c;
}
function rugCanvas(){
  const w = 600, h = 400, c = mk(w,h), ctx = c.getContext('2d'), img = ctx.createImageData(w,h), d = img.data, n = makeNoise(77);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const k = (y*w + x)*4;
    const weave = ((x % 3) === 0 ? -6 : 0) + ((y % 4) === 0 ? -5 : 0);
    const cloud = fbm(n, x*0.01, y*0.01, 3)*14;
    const border = (x < 26 || x > w-27 || y < 26 || y > h-27) && !(x < 14 || x > w-15 || y < 14 || y > h-15) ? -22 : 0;
    const base = 214 + weave + cloud + border + (Math.random()-0.5)*10;
    d[k] = base; d[k+1] = base - 7; d[k+2] = base - 18; d[k+3] = 255;
  }
  ctx.putImageData(img,0,0);
  return c;
}
function tvCanvas(){
  const w = 640, h = 368, c = mk(w,h), ctx = c.getContext('2d'), R = rng(11);
  let g = ctx.createLinearGradient(0,0,0,h*0.58);
  g.addColorStop(0,'#24324a'); g.addColorStop(0.65,'#7f6f7a'); g.addColorStop(1,'#e2a670');
  ctx.fillStyle = g; ctx.fillRect(0,0,w,h*0.58);
  g = ctx.createLinearGradient(0,h*0.58,0,h);
  g.addColorStop(0,'#c99266'); g.addColorStop(0.4,'#4b4a57'); g.addColorStop(1,'#1b2232');
  ctx.fillStyle = g; ctx.fillRect(0,h*0.58,w,h);
  ctx.fillStyle = 'rgba(255,228,180,.85)'; ctx.beginPath(); ctx.arc(w*0.62, h*0.52, 16, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = 'rgba(255,214,160,.35)'; ctx.fillRect(w*0.62-14, h*0.6, 28, 3); ctx.fillRect(w*0.62-9, h*0.64, 18, 2);
  for (let i = 0; i < 70; i++){
    const x = R()*w, th = 40 + R()*90, base = h*0.58;
    const left = x < w*0.35 || x > w*0.82;
    if (!left && R() < 0.75) continue;
    ctx.fillStyle = `rgba(${18+R()*14},${26+R()*14},${30+R()*10},1)`;
    ctx.beginPath(); ctx.moveTo(x, base - th); ctx.lineTo(x - th*0.13, base); ctx.lineTo(x + th*0.13, base); ctx.fill();
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.moveTo(x, base + th*0.8); ctx.lineTo(x - th*0.13, base); ctx.lineTo(x + th*0.13, base); ctx.fill(); ctx.globalAlpha = 1;
  }
  return c;
}
function skyCanvas(evening){
  const w = 1024, h = 640, c = mk(w,h), ctx = c.getContext('2d'), n = makeNoise(evening ? 3 : 4), R = rng(evening ? 21 : 22);
  const g = ctx.createLinearGradient(0,0,0,h*0.62);
  if (evening){ g.addColorStop(0,'#141c30'); g.addColorStop(0.55,'#4a4560'); g.addColorStop(1,'#d48c58'); }
  else { g.addColorStop(0,'#8fb0ca'); g.addColorStop(0.7,'#c9d7e0'); g.addColorStop(1,'#eef0ea'); }
  ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
  ctx.fillStyle = evening ? '#2a2c3a' : '#9aa8b2';
  ctx.beginPath(); ctx.moveTo(0,h);
  for (let x = 0; x <= w; x += 4){ const y = h*0.5 - (fbm(n, x*0.003, 0.5, 4)*0.5+0.5)*h*0.16 - Math.sin(x/w*Math.PI)*h*0.05; ctx.lineTo(x,y); }
  ctx.lineTo(w,h); ctx.fill();
  for (let i = 0; i < 46; i++){
    const bw = 30 + R()*70, bh = 40 + R()*150, x = R()*w, y = h*0.62 - bh*0.4 + R()*30;
    ctx.fillStyle = evening ? `rgb(${30+R()*14},${30+R()*12},${38+R()*12})` : `rgb(${196+R()*30},${190+R()*28},${180+R()*26})`;
    ctx.fillRect(x, y, bw, h - y);
    if (evening){
      for (let wy = y + 8; wy < h; wy += 11) for (let wx = x + 5; wx < x + bw - 5; wx += 10){
        if (R() < 0.22){ ctx.fillStyle = `rgba(255,${190+R()*40},${110+R()*50},${0.6+R()*0.4})`; ctx.fillRect(wx, wy, 4, 5); }
      }
    } else {
      ctx.fillStyle = 'rgba(120,140,155,.35)';
      for (let wy = y + 8; wy < h; wy += 12) ctx.fillRect(x + 4, wy, bw - 8, 3);
    }
  }
  return c;
}
function blobCanvas(round){
  const s = 128, c = mk(s,s), ctx = c.getContext('2d');
  if (round){
    const g = ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);
    g.addColorStop(0,'rgba(0,0,0,0.55)'); g.addColorStop(0.55,'rgba(0,0,0,0.28)'); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
  } else {
    const img = ctx.createImageData(s,s), hw = 40, rr = 16;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++){
      const qx = Math.abs(x-64)-hw+rr, qy = Math.abs(y-64)-hw+rr;
      const out = Math.hypot(Math.max(qx,0), Math.max(qy,0)) + Math.min(Math.max(qx,qy),0) - rr;
      img.data[(y*s+x)*4+3] = 255*0.62*(1 - smooth(-12, 22, out));
    }
    ctx.putImageData(img,0,0);
  }
  return c;
}

/* ================= tile faces (u = the tile's long side) ================= */
// Oak plank, 1.20 × 0.20 m
function plankFace(){
  const w = 1200, h = 200, c = mk(w,h), ctx = c.getContext('2d'), img = ctx.createImageData(w,h), d = img.data;
  const n = makeNoise(31), n2 = makeNoise(37), R = rng(5);
  const A = [206,172,128], B = [168,129,88];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const g = fbm(n, x*0.0016, y*0.012, 3);
    const ring = Math.sin(y*0.16 + g*3.0 + fbm(n2, x*0.0012, y*0.006, 2)*4.0)*0.5 + 0.5;
    const fine = n(x*0.02, y*0.9)*0.5 + 0.5;
    const knot = Math.max(0, 1 - Math.hypot((x-820)/38, (y-120)/16)) * 0.6;
    const t = clamp(0.42*ring + 0.28*fine + 0.22*(g*0.5+0.5) + knot, 0, 1);
    const k = (y*w + x)*4;
    d[k] = A[0] + (B[0]-A[0])*t; d[k+1] = A[1] + (B[1]-A[1])*t; d[k+2] = A[2] + (B[2]-A[2])*t; d[k+3] = 255;
  }
  ctx.putImageData(img,0,0);
  ctx.strokeStyle = 'rgba(70,48,28,.25)'; ctx.lineWidth = 2; ctx.strokeRect(1,1,w-2,h-2);
  return c;
}
// Matte stone-look porcelain, square; tone = [r,g,b]
function stoneFace(seed, tone, size = 512){
  const c = mk(size,size), ctx = c.getContext('2d'), img = ctx.createImageData(size,size), d = img.data;
  const n = makeNoise(seed), n2 = makeNoise(seed+9);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){
    const v = fbm(n, x*0.006, y*0.006, 4)*0.5 + fbm(n2, x*0.03, y*0.03, 2)*0.25;
    const grain = (Math.random()-0.5)*7;
    const k = (y*size + x)*4, s = 1 + v*0.16;
    d[k] = tone[0]*s + grain; d[k+1] = tone[1]*s + grain; d[k+2] = tone[2]*s + grain; d[k+3] = 255;
  }
  ctx.putImageData(img,0,0);
  return c;
}
// Light glazed wall tile with soft veins, 1.20 × 0.60 m
function wallTileFace(){
  const w = 640, h = 320, c = mk(w,h), ctx = c.getContext('2d'), img = ctx.createImageData(w,h), d = img.data;
  const n = makeNoise(71), n2 = makeNoise(73);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const wx = fbm(n2, x*0.003, y*0.006, 2);
    const vein = 1 - smooth(0, 0.035, Math.abs(fbm(n, x*0.00375 + wx, y*0.009 + wx*0.8, 4)));
    const cloud = fbm(n2, x*0.006, y*0.006, 3);
    const k = (y*w + x)*4, base = 228 + cloud*9 - vein*15;
    d[k] = base; d[k+1] = base - 9; d[k+2] = base - 24; d[k+3] = 255;
  }
  ctx.putImageData(img,0,0);
  return c;
}
// The photographed Каньон Гриджо face (portrait 60 × 120) turned so its long side runs along u
function loadPhotoFace(url){
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => {
      const c = mk(im.height, im.width), ctx = c.getContext('2d');
      ctx.translate(c.width, 0); ctx.rotate(Math.PI/2); ctx.drawImage(im, 0, 0);
      resolve(c);
    };
    im.onerror = () => reject(new Error('tile photo did not load'));
    im.src = url;
  });
}

// Stacked ledgestone, 0.80 × 0.80 m, seamless both ways: colour, normal and height maps
function ledgeMaps(){
  const S = 512, ppc = S/80, R = rng(91), n = makeNoise(57), n2 = makeNoise(59);
  const Hm = new Float32Array(S*S), T = new Float32Array(S*S*3).fill(-1);
  const rows = [];
  for (let y = 0; y < S;){ const h = Math.round((2.5 + R()*4.5)*ppc); rows.push([y, Math.min(S, y + h)]); y += h; }
  if (rows.length > 1 && rows[rows.length - 1][1] - rows[rows.length - 1][0] < 2*ppc){ rows.pop(); rows[rows.length - 1][1] = S; }
  for (const [y0, y1] of rows){
    let x = Math.floor(R()*S), covered = 0;
    while (covered < S){
      const L = Math.min(Math.round((12 + R()*36)*ppc), S - covered);
      const depth = R(), gap = 1 + Math.round(R()*1.5);
      const b = 0.80 + R()*0.24, warm = (R() - 0.5)*12;
      const tone = [228*b + warm, 214*b + warm*0.6, 190*b - warm*0.4];
      for (let yy = y0 + 1; yy < y1 - 1; yy++) for (let k = gap; k < L - gap; k++){
        const xx = (x + k) % S;
        const de = Math.min(k - gap, L - gap - 1 - k, yy - y0 - 1, y1 - 2 - yy);
        const edge = Math.min(1, de/(1.0*ppc));
        const nz = fbm(n, xx*0.035, yy*0.035, 3);
        Hm[yy*S + xx] = (0.25 + 0.70*depth)*(0.45 + 0.55*Math.sqrt(edge)) + nz*0.10;
        const i = (yy*S + xx)*3, sh = 0.84 + 0.16*edge + nz*0.14 + fbm(n2, xx*0.14, yy*0.14, 2)*0.05;
        T[i] = tone[0]*sh; T[i+1] = tone[1]*sh; T[i+2] = tone[2]*sh;
      }
      x = (x + L) % S; covered += L;
    }
  }
  const hc = mk(S,S), cc = mk(S,S), nc = mk(S,S);
  const hd = hc.getContext('2d').createImageData(S,S), cd = cc.getContext('2d').createImageData(S,S), nd = nc.getContext('2d').createImageData(S,S);
  const at = (x, y) => Hm[((y + S) % S)*S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++){
    const i = y*S + x, k = i*4, v = Hm[i];
    hd.data[k] = hd.data[k+1] = hd.data[k+2] = Math.min(255, v*255); hd.data[k+3] = 255;
    if (T[i*3] < 0){ cd.data[k] = 74; cd.data[k+1] = 65; cd.data[k+2] = 54; }
    else { cd.data[k] = T[i*3]; cd.data[k+1] = T[i*3+1]; cd.data[k+2] = T[i*3+2]; }
    cd.data[k+3] = 255;
    const dx = (at(x+1, y) - at(x-1, y))*6, dy = (at(x, y-1) - at(x, y+1))*6, len = Math.hypot(dx, dy, 1);
    nd.data[k] = (-dx/len*0.5 + 0.5)*255; nd.data[k+1] = (-dy/len*0.5 + 0.5)*255; nd.data[k+2] = (1/len*0.5 + 0.5)*255; nd.data[k+3] = 255;
  }
  hc.getContext('2d').putImageData(hd,0,0); cc.getContext('2d').putImageData(cd,0,0); nc.getContext('2d').putImageData(nd,0,0);
  return { height: hc, color: cc, normal: nc };
}
// Warm travertine-look porcelain, square
function travertineFace(seed, tone, size = 384){
  const c = mk(size,size), ctx = c.getContext('2d'), img = ctx.createImageData(size,size), d = img.data;
  const n = makeNoise(seed), n2 = makeNoise(seed + 5);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++){
    const band = fbm(n, x*0.003, y*0.02, 3), cloud = fbm(n2, x*0.01, y*0.01, 2);
    const pore = n2(x*0.22, y*0.7) > 0.6 ? 0.88 : 1;
    const s = (1 + band*0.07 + cloud*0.05)*pore, grain = (Math.random() - 0.5)*5, k = (y*size + x)*4;
    d[k] = tone[0]*s + grain; d[k+1] = tone[1]*s + grain; d[k+2] = tone[2]*s + grain; d[k+3] = 255;
  }
  ctx.putImageData(img,0,0);
  return c;
}
// Abstract canvas for the picture above the sideboard: beige, an olive field and a charcoal band
function artCanvas(){
  const w = 600, h = 360, c = mk(w,h), ctx = c.getContext('2d'), img = ctx.createImageData(w,h), d = img.data, n = makeNoise(83);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const t = fbm(n, x*0.02, y*0.02, 4), k = (y*w + x)*4;
    let r = 214 + t*22, g = 205 + t*20, b = 186 + t*18;
    if (x > 70 && x < 330 && y > 205 && y < 300){ r = 104 + t*18; g = 110 + t*18; b = 84 + t*14; }
    if (x > 330 && x < 520 && y > 232 && y < 300){ r = 52 + t*12; g = 50 + t*12; b = 46 + t*10; }
    if (Math.abs(fbm(n, x*0.006 + 3, y*0.03, 3)) < 0.02 && y < 200) { r -= 30; g -= 30; b -= 28; }
    d[k] = r; d[k+1] = g; d[k+2] = b; d[k+3] = 255;
  }
  ctx.putImageData(img,0,0);
  return c;
}

export { makeNoise, fbm, rng, clamp, smooth, mk, stoneMaps, ledgeMaps, woodCanvas, boucleCanvas, rugCanvas, tvCanvas, skyCanvas, blobCanvas, plankFace, stoneFace, travertineFace, wallTileFace, artCanvas, loadPhotoFace };
