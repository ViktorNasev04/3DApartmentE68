import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { rng, clamp, mk, marbleFace, drawFloor, stoneMaps, woodCanvas, boucleCanvas, rugCanvas, tvCanvas, skyCanvas, blobCanvas } from './textures.js';

const state = window.__room;
const veil = document.getElementById('veil');
const fail = (msg) => { veil.classList.remove('off'); veil.innerHTML = msg + '<small>Планът отдолу е в мащаб</small>'; };

/* ================= scene ================= */
function start(){
  const canvas = document.getElementById('c');
  const stage = document.getElementById('stage');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias:false, powerPreference:'high-performance' });
  } catch(e){ fail('3D изгледът не тръгна на това устройство'); return; }
  if (!renderer.capabilities.isWebGL2){ fail('3D изгледът иска по-нов браузър'); return; }

  const W = 5.20, D = 4.50, H = 2.65;
  const TV = { x0:1.30, x1:4.10, cx:2.70, d:0.38, colW:0.45, cab0:0.22, cab1:0.62, top:2.45 };
  const DOOR = { x0:4.12, x1:5.12, h:2.40 };
  const WIN = { z0:0.45, z1:2.05, y0:0.40, y1:2.40 };
  const HALL = { z0:0.15, z1:1.65, h:2.10 };

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 60);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  /* ----- textures ----- */
  const faces = [1,2,3,4].map(marbleFace);
  const floorTex = new THREE.CanvasTexture(drawFloor(faces, W, D, 9));
  floorTex.colorSpace = THREE.SRGBColorSpace; floorTex.anisotropy = maxAniso;
  const hallTex = new THREE.CanvasTexture(drawFloor(faces, 1.2, 1.5, 12));
  hallTex.colorSpace = THREE.SRGBColorSpace;
  const st = stoneMaps();
  const stoneColor = new THREE.CanvasTexture(st.color); stoneColor.colorSpace = THREE.SRGBColorSpace;
  const stoneNormal = new THREE.CanvasTexture(st.normal);
  const stoneHeight = new THREE.CanvasTexture(st.height);
  const oakVc = woodCanvas(false), oakHc = woodCanvas(true);
  const wrap = (t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; return t; };
  const oakV = wrap(new THREE.CanvasTexture(oakVc)), oakH = wrap(new THREE.CanvasTexture(oakHc));
  const boucleC = boucleCanvas();
  const boucle = new THREE.CanvasTexture(boucleC); boucle.wrapS = boucle.wrapT = THREE.RepeatWrapping; boucle.repeat.set(5,5);
  const rugTex = new THREE.CanvasTexture(rugCanvas()); rugTex.colorSpace = THREE.SRGBColorSpace;
  const tvTex = new THREE.CanvasTexture(tvCanvas()); tvTex.colorSpace = THREE.SRGBColorSpace;
  const skyEve = new THREE.CanvasTexture(skyCanvas(true)); skyEve.colorSpace = THREE.SRGBColorSpace;
  const skyDay = new THREE.CanvasTexture(skyCanvas(false)); skyDay.colorSpace = THREE.SRGBColorSpace;
  const blobRect = new THREE.CanvasTexture(blobCanvas(false));
  const blobRound = new THREE.CanvasTexture(blobCanvas(true));

  /* swatches on the page */
  try {
    document.getElementById('sw-tile').style.backgroundImage = `url(${faces[0].toDataURL('image/jpeg',0.85)})`;
    document.getElementById('sw-stone').style.backgroundImage = `url(${st.color.toDataURL('image/jpeg',0.85)})`;
    document.getElementById('sw-oak').style.backgroundImage = `url(${oakVc.toDataURL('image/jpeg',0.85)})`;
    const bc = mk(160,160), bx = bc.getContext('2d'); bx.fillStyle = '#efe9df'; bx.fillRect(0,0,160,160);
    bx.globalAlpha = 0.18; bx.drawImage(boucleC,0,0,160,160);
    document.getElementById('sw-boucle').style.backgroundImage = `url(${bc.toDataURL('image/jpeg',0.9)})`;
  } catch(e){}

  /* ----- materials ----- */
  const M = {
    wall: new THREE.MeshStandardMaterial({ color:0xd8cec1, roughness:0.93 }),
    ceiling: new THREE.MeshStandardMaterial({ color:0xf2eee8, roughness:0.95 }),
    floor: new THREE.MeshPhysicalMaterial({ map:floorTex, roughness:0.16, clearcoat:0.7, clearcoatRoughness:0.06, transparent:true, opacity:0.80 }),
    hallFloor: new THREE.MeshStandardMaterial({ map:hallTex, roughness:0.2 }),
    skirting: new THREE.MeshStandardMaterial({ color:0xb7ab9a, roughness:0.3 }),
    oakV: new THREE.MeshStandardMaterial({ map:oakV, roughness:0.55 }),
    oakH: new THREE.MeshStandardMaterial({ map:oakH, roughness:0.55 }),
    stone: new THREE.MeshStandardMaterial({ map:stoneColor, normalMap:stoneNormal, normalScale:new THREE.Vector2(1.2,1.2), displacementMap:stoneHeight, displacementScale:0.045, roughness:0.96 }),
    boucle: new THREE.MeshPhysicalMaterial({ color:0xf0ebe2, roughness:0.95, bumpMap:boucle, bumpScale:3, sheen:0.6, sheenRoughness:0.6, sheenColor:new THREE.Color(0xffffff) }),
    olive: new THREE.MeshPhysicalMaterial({ color:0x58613f, roughness:0.75, sheen:1, sheenRoughness:0.45, sheenColor:new THREE.Color(0x9da77d) }),
    chairFabric: new THREE.MeshPhysicalMaterial({ color:0xcbbca5, roughness:0.92, bumpMap:boucle, bumpScale:2, sheen:0.4, sheenRoughness:0.6, sheenColor:new THREE.Color(0xffffff), side:THREE.DoubleSide }),
    black: new THREE.MeshStandardMaterial({ color:0x1c1b19, roughness:0.45, metalness:0.4 }),
    blackGloss: new THREE.MeshStandardMaterial({ color:0x0d0d0e, roughness:0.12, metalness:0.2 }),
    kitchen: new THREE.MeshStandardMaterial({ color:0xcdc3b6, roughness:0.62 }),
    worktop: new THREE.MeshStandardMaterial({ color:0xe6dfd4, roughness:0.28 }),
    ceramicCream: new THREE.MeshStandardMaterial({ color:0xe9e1d3, roughness:0.7 }),
    ceramicDark: new THREE.MeshStandardMaterial({ color:0x3b342d, roughness:0.6 }),
    ceramicOlive: new THREE.MeshStandardMaterial({ color:0x6c7450, roughness:0.4 }),
    leaf: new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.75 }),
    trunk: new THREE.MeshStandardMaterial({ color:0x6a5a48, roughness:0.9 }),
    glass: new THREE.MeshPhysicalMaterial({ color:0xffffff, roughness:0.04, metalness:0, transparent:true, opacity:0.12, depthWrite:false }),
    sheer: new THREE.MeshStandardMaterial({ color:0xfbf8f2, roughness:0.9, transparent:true, opacity:0.55, side:THREE.DoubleSide, depthWrite:false }),
    linen: new THREE.MeshStandardMaterial({ color:0xc9bca9, roughness:0.95, side:THREE.DoubleSide }),
    rug: new THREE.MeshStandardMaterial({ map:rugTex, roughness:1 }),
    rugEdge: new THREE.MeshStandardMaterial({ color:0xc9bba6, roughness:1 }),
    pampas: new THREE.MeshStandardMaterial({ color:0xe3d3b6, roughness:1 }),
    book1: new THREE.MeshStandardMaterial({ color:0xd9cfbf, roughness:0.8 }),
    book2: new THREE.MeshStandardMaterial({ color:0x8c7a63, roughness:0.8 }),
    screen: new THREE.MeshStandardMaterial({ color:0x000000, emissive:0xffffff, emissiveMap:tvTex, emissiveIntensity:0.55, roughness:0.08, metalness:0.1 }),
    led: new THREE.MeshBasicMaterial({ color:0xffffff }),
    pendant: new THREE.MeshStandardMaterial({ color:0xf3ece0, roughness:0.85, emissive:0xffcf98, emissiveIntensity:0 }),
    flush: new THREE.MeshStandardMaterial({ color:0xf6f2ea, roughness:0.6, emissive:0xffe2bd, emissiveIntensity:0 }),
    skyEve: new THREE.MeshBasicMaterial({ map:skyEve, toneMapped:false }),
    skyDay: new THREE.MeshBasicMaterial({ map:skyDay, toneMapped:false }),
  };
  M.wall.shadowSide = THREE.DoubleSide;

  const root = new THREE.Group(); scene.add(root);

  function scaleBoxUV(geo, w, h, d, s){
    const uv = geo.attributes.uv, dims = [[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
    for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++){ const i = f*4 + k; uv.setXY(i, uv.getX(i)*dims[f][0]/s, uv.getY(i)*dims[f][1]/s); }
    uv.needsUpdate = true; return geo;
  }
  function box(w,h,d, mat, x,y,z, parent=root, cast=true){
    const g = scaleBoxUV(new THREE.BoxGeometry(w,h,d), w,h,d, 0.9);
    const m = new THREE.Mesh(g, mat); m.position.set(x,y,z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
  }
  function rbox(w,h,d,r, mat, x,y,z, parent=root){
    const m = new THREE.Mesh(new RoundedBoxGeometry(w,h,d,4,r), mat); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  }
  function blob(w, d, x, z, round, opacity=1, parent=root, y=0.003){
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w,d), new THREE.MeshBasicMaterial({ map: round ? blobRound : blobRect, transparent:true, depthWrite:false, opacity, toneMapped:false }));
    m.rotation.x = -Math.PI/2; m.position.set(x, y, z); m.renderOrder = 2; parent.add(m); return m;
  }
  const leds = [];
  function ledStrip(w,h,d, x,y,z){ const m = box(w,h,d, M.led, x,y,z, root, false); m.receiveShadow = false; leds.push(m); return m; }

  /* ----- room shell (single-sided: walls facing away from the camera vanish = dollhouse cut) ----- */
  function wallFromShape(shape, holes){
    const s = new THREE.Shape(shape.map(p => new THREE.Vector2(p[0], p[1])));
    (holes || []).forEach(h => s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1])))));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), M.wall); m.receiveShadow = true; m.castShadow = true; return m;
  }
  const north = wallFromShape([[0,0],[DOOR.x0,0],[DOOR.x0,DOOR.h],[DOOR.x1,DOOR.h],[DOOR.x1,0],[W,0],[W,H],[0,H]]);
  root.add(north);
  const south = wallFromShape([[0,0],[W,0],[W,H],[0,H]]);
  south.rotation.y = Math.PI; south.position.set(W, 0, D); root.add(south);
  const west = wallFromShape([[-D,0],[-HALL.z1,0],[-HALL.z1,HALL.h],[-HALL.z0,HALL.h],[-HALL.z0,0],[0,0],[0,H],[-D,H]]);
  west.rotation.y = Math.PI/2; root.add(west);
  const east = wallFromShape([[0,0],[D,0],[D,H],[0,H]], [[[WIN.z0,WIN.y0],[WIN.z1,WIN.y0],[WIN.z1,WIN.y1],[WIN.z0,WIN.y1]]]);
  east.rotation.y = -Math.PI/2; east.position.set(W,0,0); root.add(east);

  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.ceiling);
  ceiling.rotation.x = Math.PI/2; ceiling.position.set(W/2, H, D/2); root.add(ceiling);
  const roofMat = new THREE.MeshBasicMaterial({ colorWrite:false, depthWrite:false }); roofMat.shadowSide = THREE.DoubleSide;
  const roof = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.6, D + 0.6), roofMat);
  roof.rotation.x = -Math.PI/2; roof.position.set(W/2, H + 0.005, D/2); roof.castShadow = true; root.add(roof);

  const reflector = new Reflector(new THREE.PlaneGeometry(W, D), { textureWidth:512, textureHeight:512, color:0xffffff, clipBias:0.002, multisample:0 });
  reflector.rotation.x = -Math.PI/2; reflector.position.set(W/2, -0.0005, D/2); root.add(reflector);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.floor);
  floor.rotation.x = -Math.PI/2; floor.position.set(W/2, 0, D/2); floor.receiveShadow = true; floor.renderOrder = 1; root.add(floor);

  /* hall beyond the west opening */
  const hallF = new THREE.Mesh(new THREE.PlaneGeometry(1.2, HALL.z1-HALL.z0), M.hallFloor);
  hallF.rotation.x = -Math.PI/2; hallF.position.set(-0.6, 0, (HALL.z0+HALL.z1)/2); hallF.receiveShadow = true; root.add(hallF);
  const hb = new THREE.Mesh(new THREE.PlaneGeometry(HALL.z1-HALL.z0, H), M.wall); hb.rotation.y = Math.PI/2; hb.position.set(-1.2, H/2, (HALL.z0+HALL.z1)/2); root.add(hb);
  const hs1 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, H), M.wall); hs1.position.set(-0.6, H/2, HALL.z0); root.add(hs1);
  const hs2 = new THREE.Mesh(new THREE.PlaneGeometry(1.2, H), M.wall); hs2.rotation.y = Math.PI; hs2.position.set(-0.6, H/2, HALL.z1); root.add(hs2);
  const hallCeil = new THREE.Mesh(new THREE.PlaneGeometry(1.2, HALL.z1-HALL.z0), M.ceiling); hallCeil.rotation.x = Math.PI/2; hallCeil.position.set(-0.6, H, (HALL.z0+HALL.z1)/2); root.add(hallCeil);

  /* skirting */
  box(W, 0.07, 0.012, M.skirting, W/2, 0.035, D-0.006, root, false);
  box(0.012, 0.07, D, M.skirting, W-0.006, 0.035, D/2, root, false);
  box(TV.x0, 0.07, 0.012, M.skirting, TV.x0/2, 0.035, 0.006, root, false);

  /* ----- window (east) & loggia door (north), black frames ----- */
  const fw = 0.05;
  function frameRect(x0,y0,x1,y1, fixed, along){ // along: 'x' (frame in XY plane at z=fixed) or 'z' (frame in ZY plane at x=fixed)
    const parts = [];
    const L = along === 'x';
    const len = (L ? x1-x0 : x1-x0);
    const midA = (x0+x1)/2, midY = (y0+y1)/2;
    const mkp = (a, y, la, ly) => L ? box(la, ly, 0.06, M.black, a, y, fixed) : box(0.06, ly, la, M.black, fixed, y, a);
    parts.push(mkp(midA, y0+fw/2, len, fw)); parts.push(mkp(midA, y1-fw/2, len, fw));
    parts.push(mkp(x0+fw/2, midY, fw, y1-y0)); parts.push(mkp(x1-fw/2, midY, fw, y1-y0));
    parts.push(mkp(midA, midY, 0.04, y1-y0));
    return parts;
  }
  frameRect(WIN.z0, WIN.y0, WIN.z1, WIN.y1, W+0.10, 'z');
  const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.z1-WIN.z0, WIN.y1-WIN.y0), M.glass);
  winGlass.rotation.y = -Math.PI/2; winGlass.position.set(W+0.10, (WIN.y0+WIN.y1)/2, (WIN.z0+WIN.z1)/2); winGlass.renderOrder = 3; root.add(winGlass);
  const skyE = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.6), M.skyEve);
  skyE.rotation.y = -Math.PI/2; skyE.position.set(W+0.40, 1.35, (WIN.z0+WIN.z1)/2); root.add(skyE);
  box(0.30, 0.03, WIN.z1-WIN.z0+0.04, M.worktop, W-0.03+0.12, WIN.y0-0.015, (WIN.z0+WIN.z1)/2, root, false);
  frameRect(DOOR.x0, 0, DOOR.x1, DOOR.h, -0.10, 'x');
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.x1-DOOR.x0, DOOR.h), M.glass);
  doorGlass.position.set((DOOR.x0+DOOR.x1)/2, DOOR.h/2, -0.10); doorGlass.renderOrder = 3; root.add(doorGlass);
  const skyN = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.8), M.skyEve);
  skyN.position.set((DOOR.x0+DOOR.x1)/2, 1.4, -1.6); root.add(skyN);
  const loggia = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.x1-DOOR.x0+0.1, 1.5), M.hallFloor);
  loggia.rotation.x = -Math.PI/2; loggia.position.set((DOOR.x0+DOOR.x1)/2, -0.02, -0.85); root.add(loggia);
  // door reveal (wall thickness)
  const rv1 = new THREE.Mesh(new THREE.PlaneGeometry(0.2, DOOR.h), M.wall); rv1.rotation.y = Math.PI/2; rv1.position.set(DOOR.x0, DOOR.h/2, -0.1); root.add(rv1);
  const rv2 = new THREE.Mesh(new THREE.PlaneGeometry(0.2, DOOR.h), M.wall); rv2.rotation.y = -Math.PI/2; rv2.position.set(DOOR.x1, DOOR.h/2, -0.1); root.add(rv2);
  const rv3 = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.x1-DOOR.x0, 0.2), M.wall); rv3.rotation.x = Math.PI/2; rv3.position.set((DOOR.x0+DOOR.x1)/2, DOOR.h, -0.1); root.add(rv3);
  // window reveals
  const wr = (w,h,rx,ry,x,y,z) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w,h), M.wall); m.rotation.set(rx,ry,0); m.position.set(x,y,z); root.add(m); };
  wr(0.2, WIN.y1-WIN.y0, 0, 0, W+0.1, (WIN.y0+WIN.y1)/2, WIN.z0);
  wr(0.2, WIN.y1-WIN.y0, 0, Math.PI, W+0.1, (WIN.y0+WIN.y1)/2, WIN.z1);
  wr(0.2, WIN.z1-WIN.z0, Math.PI/2, 0, W+0.1, WIN.y1, (WIN.z0+WIN.z1)/2);

  /* curtains */
  function curtain(width, height, waves, amp, mat){
    const g = new THREE.PlaneGeometry(width, height, Math.max(24, waves*8), 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++){ const x = p.getX(i); p.setZ(i, Math.sin((x/width)*Math.PI*2*waves)*amp); }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.castShadow = mat === M.linen; m.receiveShadow = true; return m;
  }
  const sheer = curtain(WIN.z1-WIN.z0+0.25, 2.52, 11, 0.025, M.sheer);
  sheer.rotation.y = -Math.PI/2; sheer.position.set(W-0.10, 1.32, (WIN.z0+WIN.z1)/2 + 0.05); sheer.renderOrder = 3; root.add(sheer);
  [[WIN.z0-0.08],[WIN.z1+0.16]].forEach(([z]) => {
    const c = curtain(0.42, 2.55, 3, 0.045, M.linen); c.rotation.y = -Math.PI/2; c.position.set(W-0.17, 1.31, z); root.add(c);
  });
  box(0.03, 0.03, WIN.z1-WIN.z0+0.9, M.black, W-0.14, 2.60, (WIN.z0+WIN.z1)/2+0.04, root, false);

  /* ----- TV wall ----- */
  const sw = TV.x1 - TV.x0 - 2*TV.colW;
  const stoneGeo = new THREE.PlaneGeometry(sw, TV.top, 150, 190);
  const stone = new THREE.Mesh(stoneGeo, M.stone); stone.position.set(TV.cx, TV.top/2, 0.004); stone.receiveShadow = true; root.add(stone);
  // floating cabinet
  box(TV.x1-TV.x0, TV.cab1-TV.cab0, 0.36, M.oakH, TV.cx, (TV.cab0+TV.cab1)/2, 0.18);
  const nd = 6, gap = 0.004, dw = (TV.x1-TV.x0 - gap*(nd+1))/nd;
  for (let i = 0; i < nd; i++){
    const x = TV.x0 + gap + dw/2 + i*(dw+gap);
    if (i === 1){
      const ns = 14, slw = dw/ns;
      box(dw, TV.cab1-TV.cab0-0.008, 0.008, M.blackGloss, x, (TV.cab0+TV.cab1)/2, 0.364, root, false);
      for (let k = 0; k < ns; k++) box(slw*0.62, TV.cab1-TV.cab0-0.012, 0.018, M.oakV, x - dw/2 + slw*(k+0.5), (TV.cab0+TV.cab1)/2, 0.37, root, false);
    } else box(dw, TV.cab1-TV.cab0-0.008, 0.018, M.oakV, x, (TV.cab0+TV.cab1)/2, 0.369, root, false);
  }
  ledStrip(TV.x1-TV.x0-0.08, 0.006, 0.012, TV.cx, TV.cab0-0.004, 0.30);
  // side columns
  const shelfYs = [1.16, 1.74];
  [TV.x0 + TV.colW/2, TV.x1 - TV.colW/2].forEach(cx => {
    const h = TV.top - TV.cab1;
    box(TV.colW, h, 0.018, M.oakV, cx, TV.cab1 + h/2, 0.009);
    box(0.022, h, 0.32, M.oakV, cx - TV.colW/2 + 0.011, TV.cab1 + h/2, 0.16);
    box(0.022, h, 0.32, M.oakV, cx + TV.colW/2 - 0.011, TV.cab1 + h/2, 0.16);
    shelfYs.forEach(y => { box(TV.colW-0.044, 0.03, 0.31, M.oakH, cx, y, 0.165); ledStrip(TV.colW-0.07, 0.006, 0.01, cx, y-0.019, 0.29); });
    ledStrip(TV.colW-0.07, 0.006, 0.01, cx, TV.top-0.004, 0.29);
  });
  // stone edge LED (vertical) + header with soffit LED
  [TV.x0 + TV.colW + 0.012, TV.x1 - TV.colW - 0.012].forEach(x => ledStrip(0.006, TV.top - 0.02, 0.01, x, TV.top/2, 0.05));
  box(TV.x1-TV.x0, H - TV.top, 0.38, M.oakH, TV.cx, (TV.top + H)/2, 0.19);
  ledStrip(sw - 0.04, 0.006, 0.01, TV.cx, TV.top - 0.004, 0.09);
  // TV + soundbar
  const tvG = new THREE.Group(); tvG.position.set(TV.cx, 1.22, 0.085); root.add(tvG);
  box(1.45, 0.835, 0.03, M.blackGloss, 0, 0, 0, tvG);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.43, 0.815), M.screen); scr.position.z = 0.0155; tvG.add(scr);
  box(0.92, 0.06, 0.09, M.black, TV.cx, 0.73, 0.1);
  // decor
  function vase(profile, mat, x, y, z, s=1){
    const pts = profile.map(p => new THREE.Vector2(p[0]*s, p[1]*s));
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), mat); m.position.set(x,y,z); m.castShadow = true; m.receiveShadow = true; root.add(m); return m;
  }
  const tall = [[0,0],[0.06,0],[0.075,0.05],[0.07,0.16],[0.045,0.25],[0.03,0.30],[0.035,0.31],[0,0.31]];
  const round = [[0,0],[0.05,0],[0.09,0.05],[0.095,0.10],[0.07,0.16],[0.035,0.18],[0.04,0.19],[0,0.19]];
  const bowl = [[0,0],[0.04,0],[0.09,0.03],[0.11,0.06],[0.105,0.065],[0.08,0.035],[0,0.03]];
  const lx = TV.x0 + TV.colW/2, rx = TV.x1 - TV.colW/2;
  vase(tall, M.ceramicCream, lx, 1.175, 0.15);
  vase(bowl, M.ceramicDark, lx, 1.755, 0.16);
  box(0.24, 0.035, 0.18, M.book1, lx, 0.637, 0.16); box(0.21, 0.03, 0.16, M.book2, lx+0.01, 0.67, 0.16);
  vase(round, M.ceramicOlive, rx - 0.07, 1.175, 0.15, 0.8); vase(tall, M.ceramicCream, rx + 0.09, 1.175, 0.15, 0.65);
  const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.045, 0.018, 64, 8, 2, 3), M.ceramicCream); knot.position.set(rx, 1.80, 0.16); knot.castShadow = true; root.add(knot);
  vase(round, M.ceramicCream, rx, 0.635, 0.16, 0.9);
  // pampas on cabinet top
  vase(tall, M.ceramicCream, TV.x0 + TV.colW + 0.18, TV.cab1, 0.20, 1.05);
  const stemMat = new THREE.MeshStandardMaterial({ color:0xb9a68a, roughness:1 });
  for (let i = 0; i < 6; i++){
    const a = (i/6)*Math.PI*2, tilt = 0.18 + (i%2)*0.1, len = 0.42 + (i%3)*0.08;
    const stem = new THREE.Group(); stem.position.set(TV.x0 + TV.colW + 0.18, TV.cab1 + 0.30, 0.20); stem.rotation.set(Math.cos(a)*tilt, 0, Math.sin(a)*tilt); root.add(stem);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.003,0.003,len,4), stemMat); s.position.y = len/2; stem.add(s);
    const plume = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), M.pampas); plume.scale.set(0.8, 3.2, 0.8); plume.position.y = len + 0.06; stem.add(plume);
  }

  /* ----- rug, sofa, side table ----- */
  const SOFA = { cx:2.70, z0:1.45, L:2.60, D:1.00 };
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.40, 1.60), M.rug); rug.rotation.x = -Math.PI/2; rug.position.set(SOFA.cx, 0.0062, 1.40); rug.receiveShadow = true; root.add(rug);
  box(2.40, 0.006, 1.60, M.rugEdge, SOFA.cx, 0.003, 1.40, root, false);

  const sofa = new THREE.Group(); sofa.position.set(SOFA.cx, 0.006, SOFA.z0 + SOFA.D/2); root.add(sofa);
  (function buildSofa(){
    const arm = 0.30, n = 6, inner = SOFA.L - 2*arm, cw = inner/n;
    for (let i = 0; i < n; i++){
      const x = -inner/2 + cw*(i+0.5);
      rbox(cw+0.014, 0.42, 0.80, 0.15, M.boucle, x, 0.21, -0.10, sofa);
      const b = rbox(cw+0.014, 0.42, 0.28, 0.13, M.boucle, x, 0.58, 0.35, sofa); b.rotation.x = 0.10;
    }
    rbox(inner, 0.42, 0.26, 0.10, M.boucle, 0, 0.21, 0.37, sofa);
    [-1,1].forEach(s => rbox(arm, 0.64, SOFA.D, 0.15, M.boucle, s*(SOFA.L/2 - arm/2), 0.32, 0, sofa));
    const p1 = rbox(0.48, 0.44, 0.13, 0.06, M.boucle, -0.66, 0.64, 0.17, sofa); p1.rotation.set(0.28, 0.08, 0.05);
    const p2 = rbox(0.46, 0.42, 0.13, 0.06, M.olive, 0.58, 0.63, 0.17, sofa); p2.rotation.set(0.30, -0.10, -0.07);
    const p3 = rbox(0.42, 0.40, 0.12, 0.06, M.olive, -0.18, 0.62, 0.20, sofa); p3.rotation.set(0.33, 0.05, 0.10);
  })();
  blob(2.95, 1.30, SOFA.cx, SOFA.z0 + 0.5, false, 0.85, root, 0.0075);
  // side table
  const stx = 4.25, stz = 1.75;
  const stTop = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.03, 48), M.oakH); stTop.position.set(stx, 0.50, stz); stTop.castShadow = true; root.add(stTop);
  const stLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.48, 16), M.black); stLeg.position.set(stx, 0.25, stz); stLeg.castShadow = true; root.add(stLeg);
  const stBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.015, 40), M.black); stBase.position.set(stx, 0.008, stz); root.add(stBase);
  vase(round, M.ceramicDark, stx, 0.515, stz, 0.7);
  blob(0.55, 0.55, stx, stz, true, 0.7);

  /* olive tree */
  const px = 0.82, pz = 0.45;
  vase([[0,0],[0.17,0],[0.20,0.30],[0.21,0.40],[0.19,0.40],[0.18,0.38],[0,0.38]], M.ceramicCream, px, 0.006, pz);
  const tree = new THREE.Group(); tree.position.set(px, 0, pz); root.add(tree);
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
  leaves.castShadow = true; leaves.receiveShadow = true; tree.add(leaves);
  blob(0.6, 0.6, px, pz, true, 0.7);

  /* ----- kitchen (west wall, from the sketch) ----- */
  const K = { d:0.62, z0:1.75, zt:2.40, legX1:1.22, legZ0:3.88 };
  box(K.d, 2.20, K.zt-K.z0, M.kitchen, K.d/2, 1.10, (K.z0+K.zt)/2);
  box(0.004, 2.12, 0.004, M.blackGloss, K.d+0.001, 1.10, (K.z0+K.zt)/2, root, false);
  const runL = D - K.zt;
  box(0.56, 0.10, runL, M.blackGloss, 0.27, 0.05, K.zt + runL/2, root, false);
  box(0.60, 0.78, runL, M.kitchen, 0.30, 0.49, K.zt + runL/2);
  box(0.64, 0.03, runL, M.worktop, 0.32, 0.895, K.zt + runL/2);
  for (let z = K.zt + 0.60; z < D - 0.1; z += 0.60) box(0.004, 0.76, 0.004, M.blackGloss, 0.601, 0.49, z, root, false);
  box(0.62, 0.10, D-K.legZ0, M.blackGloss, K.d + 0.28, 0.05, (K.legZ0+D)/2, root, false);
  box(K.legX1-K.d, 0.78, D-K.legZ0, M.kitchen, (K.d+K.legX1)/2, 0.49, (K.legZ0+D)/2);
  box(K.legX1-K.d+0.01, 0.03, D-K.legZ0+0.02, M.worktop, (K.d+K.legX1)/2, 0.895, (K.legZ0+D)/2 - 0.01);
  const hob = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.50), M.blackGloss); hob.rotation.x = -Math.PI/2; hob.position.set((K.d+K.legX1)/2, 0.9115, (K.legZ0+D)/2); root.add(hob);
  const sink = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.48), M.ceramicDark); sink.rotation.x = -Math.PI/2; sink.position.set(0.33, 0.9115, 3.35); root.add(sink);
  const tap = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 24, Math.PI), M.black); tap.position.set(0.10, 1.02, 3.35); tap.rotation.y = Math.PI/2; root.add(tap);
  box(0.02, 0.12, 0.02, M.black, 0.10, 0.96, 3.26, root, false);
  box(0.35, 0.72, runL, M.kitchen, 0.175, 1.82, K.zt + runL/2);
  for (let z = K.zt + 0.60; z < D - 0.1; z += 0.60) box(0.004, 0.70, 0.004, M.blackGloss, 0.351, 1.82, z, root, false);
  const splash = new THREE.Mesh(new THREE.PlaneGeometry(runL, 0.55), M.worktop); splash.rotation.y = Math.PI/2; splash.position.set(0.002, 1.185, K.zt + runL/2); root.add(splash);
  ledStrip(0.008, 0.006, runL - 0.1, 0.32, 1.458, K.zt + runL/2);
  blob(0.95, runL + 0.3, 0.42, K.zt + runL/2, false, 0.5);

  /* ----- ceiling lights ----- */
  const flush = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.06, 48), M.flush); flush.position.set(SOFA.cx, H - 0.03, 1.15); root.add(flush);

  /* ----- dining sets (two sizes, toggled) ----- */
  function chair(){
    const g = new THREE.Group();
    rbox(0.48, 0.07, 0.46, 0.03, M.chairFabric, 0, 0.455, 0, g);
    box(0.44, 0.03, 0.42, M.oakH, 0, 0.405, 0, g);
    [[-0.205,-0.19],[0.205,-0.19],[-0.205,0.19],[0.205,0.19]].forEach(([x,z]) => {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.013, 0.42, 10), M.oakV);
      l.position.set(x*1.04, 0.205, z*1.04); l.rotation.z = -Math.sign(x)*0.07; l.rotation.x = Math.sign(z)*0.07; l.castShadow = true; g.add(l);
    });
    const rail = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.017, 8, 40, Math.PI), M.oakH);
    rail.rotation.x = Math.PI/2; rail.position.set(0, 0.76, 0.0); rail.castShadow = true; g.add(rail);
    [[-0.245,0],[0.245,0],[0,0.245]].forEach(([x,z]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.30, 8), M.oakV); p.position.set(x, 0.62, z); p.castShadow = true; g.add(p);
    });
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.228, 0.228, 0.17, 28, 1, true, -1.15, 2.3), M.chairFabric);
    back.position.set(0, 0.64, 0); back.castShadow = true; g.add(back);
    return g;
  }
  function diningSet(r, cx, cz, angles){
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.026, 96), M.oakH); top.position.set(cx, 0.737, cz); top.castShadow = true; top.receiveShadow = true; g.add(top);
    const prof = [[0,0],[0.27,0],[0.27,0.012]];
    for (let i = 1; i <= 12; i++){ const t = i/12, y = 0.012 + t*0.70; prof.push([0.15 + 0.12*Math.pow(1-t, 1.7), y]); }
    prof.push([0,0.712]);
    const ped = new THREE.Mesh(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0],p[1])), 64), M.oakV);
    ped.position.set(cx, 0.003, cz); ped.castShadow = true; ped.receiveShadow = true; g.add(ped);
    const dist = r + 0.175;
    angles.forEach(a => {
      const rad = a*Math.PI/180;
      const c = chair(); const x = cx + Math.cos(rad)*dist, z = cz + Math.sin(rad)*dist;
      c.position.set(x, 0.003, z); c.rotation.y = Math.atan2(-(cx-x), -(cz-z)); g.add(c);
      blob(0.62, 0.62, x, z, true, 0.55, g);
    });
    blob(r*2 + 0.3, r*2 + 0.3, cx, cz, true, 0.6, g);
    // decor on table
    const tray = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.02, 40), M.ceramicDark); tray.position.set(cx+0.05, 0.76, cz-0.02); tray.castShadow = true; g.add(tray);
    const vz = new THREE.Mesh(new THREE.LatheGeometry(tall.map(p => new THREE.Vector2(p[0]*0.75, p[1]*0.75)), 32), M.ceramicCream); vz.position.set(cx-0.05, 0.77, cz+0.0); vz.castShadow = true; g.add(vz);
    return g;
  }
  const TABLES = { corner:{ x:4.40, z:3.70 }, center:{ x:2.70, z:3.20 } };
  const sets = { corner: diningSet(0.60, 4.40, 3.70, [-75,-135,165]), center: diningSet(0.60, 2.70, 3.20, [180,0,90]) };
  root.add(sets.corner); root.add(sets.center);

  const pendantG = new THREE.Group(); root.add(pendantG);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.22, 40, 28), M.pendant); globe.position.y = 1.72; pendantG.add(globe);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, H - 1.94, 6), M.black); cord.position.y = (H + 1.94)/2; pendantG.add(cord);
  const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 24), M.black); canopy.position.y = H - 0.01; pendantG.add(canopy);

  /* ----- lights ----- */
  const hemi = new THREE.HemisphereLight(0xfff2e2, 0x9c8b76, 0.4); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 5.5);
  sun.position.set(9.5, 4.2, 1.0); sun.target.position.set(2.8, 0, 1.9); scene.add(sun); scene.add(sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left:-3.8, right:3.8, top:3.8, bottom:-3.8, near:1, far:20 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;

  const warm = 0xffc98e;
  const rect = (w, h, x, y, z, intensity) => {
    const l = new THREE.RectAreaLight(warm, intensity, w, h); l.position.set(x, y, z); l.rotation.x = -Math.PI/2; l.userData.base = intensity; scene.add(l); return l;
  };
  const rects = [
    rect(sw - 0.04, 0.12, TV.cx, TV.top - 0.01, 0.10, 14),
    rect(TV.x1 - TV.x0 - 0.1, 0.14, TV.cx, TV.cab0 - 0.01, 0.26, 9),
    rect(TV.colW - 0.06, 0.24, TV.x0 + TV.colW/2, TV.top - 0.02, 0.16, 10),
    rect(TV.colW - 0.06, 0.24, TV.x1 - TV.colW/2, TV.top - 0.02, 0.16, 10),
    rect(0.22, runL - 0.15, 0.30, 1.455, K.zt + runL/2, 7),
  ];
  const pendSpot = new THREE.SpotLight(0xffc690, 6, 0, 1.15, 1, 2);
  pendSpot.castShadow = true; pendSpot.shadow.mapSize.set(1024, 1024); pendSpot.shadow.bias = -0.0005; pendSpot.shadow.radius = 6;
  pendantG.add(pendSpot); pendantG.add(pendSpot.target);
  const pendGlow = new THREE.PointLight(0xffc690, 0.8, 0, 2); pendantG.add(pendGlow);
  const flushL = new THREE.PointLight(0xffdcb5, 0.7, 0, 2); flushL.position.set(SOFA.cx, H - 0.25, 1.15); scene.add(flushL);

  /* ----- postprocessing ----- */
  const rt = new THREE.WebGLRenderTarget(4, 4, { type:THREE.HalfFloatType, samples:4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4,4), 0.3, 0.4, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ----- controls & views ----- */
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 0.3; controls.maxDistance = 16; controls.maxPolarAngle = Math.PI*0.53;
  controls.screenSpacePanning = true;

  const VIEWS = {
    tv:     { p:[1.75, 1.60, 4.38], t:[2.85, 1.00, 0.35], h:72 },
    sofa:   { p:[2.70, 1.12, 2.10], t:[2.70, 1.18, 0.00], h:78 },
    dining: { p:[0.95, 1.58, 3.55], t:[4.40, 0.80, 3.35], h:74 },
    over:   { p:[8.20, 6.40, 8.60], t:[2.55, 0.55, 2.20], h:46 },
    top:    { p:[2.60, 10.8, 2.27], t:[2.60, 0.00, 2.25], h:44 },
  };
  const VIEWS_CENTER = {
    tv:     { p:[4.45, 1.55, 4.38], t:[2.45, 0.95, 0.40], h:70 },
    dining: { p:[4.85, 1.52, 0.50], t:[2.00, 0.72, 3.30], h:76 },
  };
  let aspect = 1, curH = 80;
  function setFov(h){ curH = h; const v = 2*Math.atan(Math.tan(THREE.MathUtils.degToRad(h)/2)/aspect); camera.fov = clamp(THREE.MathUtils.radToDeg(v), 34, 88); camera.updateProjectionMatrix(); }
  let tween = null;
  function goView(name, instant){
    const v = (state.layout === 'center' && VIEWS_CENTER[name]) || VIEWS[name]; if (!v) return;
    const fromP = camera.position.clone(), fromT = controls.target.clone(), fromH = curH;
    const toP = new THREE.Vector3(...v.p), toT = new THREE.Vector3(...v.t);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant || reduce){ camera.position.copy(toP); controls.target.copy(toT); setFov(v.h); controls.update(); need = true; return; }
    const t0 = performance.now(), dur = 1100;
    tween = (now) => {
      let k = clamp((now - t0)/dur, 0, 1); k = k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3)/2;
      camera.position.lerpVectors(fromP, toP, k); controls.target.lerpVectors(fromT, toT, k); setFov(fromH + (v.h - fromH)*k);
      if (k >= 1) tween = null;
    };
  }

  /* ----- state application ----- */
  function applyTable(){
    const lay = state.layout === 'center' ? 'center' : 'corner';
    sets.corner.visible = lay === 'corner'; sets.center.visible = lay === 'center';
    pendantG.position.set(TABLES[lay].x, 0, TABLES[lay].z);
    pendSpot.position.set(0, 1.62, 0); pendSpot.target.position.set(0, 0, 0);
    pendGlow.position.set(0, 1.74, 0);
  }
  function applyMode(){
    const eve = state.mode === 'evening';
    const sky = eve ? M.skyEve : M.skyDay;
    skyE.material = sky; skyN.material = sky;
    scene.background = new THREE.Color(eve ? 0x1a1713 : 0xe7e2da);
    stage.style.background = eve ? '#1a1713' : '#e7e2da';
    document.getElementById('compass').style.color = eve ? '#efe8dc' : '#2a2520';
    scene.environmentIntensity = eve ? 0.08 : 0.38;
    hemi.intensity = eve ? 0.14 : 0.36;
    hemi.color.set(eve ? 0xffe2c0 : 0xf3f1ec);
    sun.visible = !eve;
    rects.forEach(l => l.intensity = l.userData.base * (eve ? 1 : 0.18));
    M.led.color.setRGB(...(eve ? [4.2, 2.9, 1.6] : [1.1, 1.0, 0.86]));
    M.pendant.emissiveIntensity = eve ? 1.1 : 0;
    M.flush.emissiveIntensity = eve ? 0.45 : 0;
    pendSpot.visible = eve; pendGlow.visible = eve; flushL.visible = eve;
    M.screen.emissiveIntensity = eve ? 0.5 : 0.35;
    renderer.toneMappingExposure = eve ? 1.0 : 0.85;
    bloom.strength = eve ? 0.30 : 0.10;
  }

  let need = true;
  state.listeners.push(() => {
    applyTable(); applyMode();
    if (state.viewChanged){ state.viewChanged = false; goView(state.view); }
    else if (state.layoutChanged){ state.layoutChanged = false; if (state.view === 'tv' || state.view === 'dining') goView(state.view); }
    need = true;
  });
  controls.addEventListener('change', () => { need = true; });
  controls.addEventListener('start', () => {
    if (tween) tween = null;
    if (state.view){ state.view = null; document.querySelectorAll('.views button').forEach(b => b.setAttribute('aria-pressed','false')); }
  });

  /* ----- sizing ----- */
  let reflScale = 0.5;
  function resize(){
    const r = stage.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false); composer.setSize(w, h);
    const pr = renderer.getPixelRatio();
    reflector.getRenderTarget().setSize(Math.round(w*pr*reflScale), Math.round(h*pr*reflScale));
    aspect = w/h; camera.aspect = aspect; setFov(curH); need = true;
  }
  new ResizeObserver(resize).observe(stage);

  /* compass: rotate the north arrow with the camera */
  const needle = document.getElementById('needle'), needleS = document.getElementById('needleS');
  const dir = new THREE.Vector3();
  function updateCompass(){
    camera.getWorldDirection(dir);
    const a = Math.atan2(dir.x, -dir.z);
    const deg = -THREE.MathUtils.radToDeg(a);
    needle.setAttribute('transform', `rotate(${deg.toFixed(1)} 22 22)`);
    needleS.setAttribute('transform', `rotate(${(-deg).toFixed(1)} 22 34)`);
  }

  /* ----- loop: render only when something changed ----- */
  let slow = 0;
  function frame(now){
    requestAnimationFrame(frame);
    if (tween){ tween(now); need = true; }
    const moved = controls.update();
    if (camera.position.y < 0.15){ camera.position.y = 0.15; }
    if (!(moved || need)) return;
    need = false;
    const cp = camera.position;
    const inside = cp.y < H - 0.05 && cp.x > -1.3 && cp.x < W + 0.3 && cp.z > -0.3 && cp.z < D + 0.3;
    ceiling.visible = hallCeil.visible = cp.y < H - 0.05;
    skyE.visible = skyN.visible = loggia.visible = inside;
    flush.visible = cp.y < H - 0.05;
    globe.visible = cord.visible = canopy.visible = cp.y < 8;
    const t0 = performance.now();
    composer.render();
    const dt = performance.now() - t0;
    if (dt > 55 && ++slow > 8 && renderer.getPixelRatio() > 1){ renderer.setPixelRatio(1); composer.setPixelRatio(1); reflScale = 0.4; resize(); slow = 0; }
    updateCompass();
    if (!window.__ready){ window.__ready = true; veil.classList.add('off'); }
  }

  applyTable(); applyMode(); resize(); goView(state.view || 'tv', true);
  requestAnimationFrame(frame);

  window.__debug = { scene, camera, controls, goView, need: () => { need = true; } };
}

requestAnimationFrame(() => setTimeout(() => {
  try { start(); } catch(e){ console.error(e); fail('3D изгледът не тръгна на това устройство'); }
}, 30));
