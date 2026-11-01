/* Shared materials and the tiling shader used for floors and the bathroom walls */
import * as THREE from 'three';
import { stoneMaps, woodCanvas, boucleCanvas, rugCanvas, tvCanvas, skyCanvas, blobCanvas, plankFace, stoneFace, wallTileFace, mk } from './textures.js';

/* Floor finishes the rooms can switch between. size = tile [long, short] in metres, off = row offset of the default bond. */
export const FINISHES = {
  tile:    { name: 'Каньон Гриджо 60×120, гланц', short: 'Каньон Гриджо', size: [1.2, 0.6], grout: 0.0025, glossy: true,  price: { perBox: 36.70, boxM2: 2.16, perM2: 16.99 } },
  oak:     { name: 'Ламинат, светъл дъб', short: 'Ламинат дъб', size: [1.2, 0.2], grout: 0.0012, glossy: false },
  grey:    { name: 'Сив мат 60×60', short: 'Сив мат 60×60', size: [0.6, 0.6], grout: 0.0025, glossy: false },
  outdoor: { name: 'Антрацит 60×60, за навън', short: 'Антрацит', size: [0.6, 0.6], grout: 0.003, glossy: false },
};

export const BONDS = {
  third: { name: 'Отместване 1/3', off: 1/3 },
  half:  { name: 'Отместване 1/2', off: 1/2 },
  grid:  { name: 'Без отместване', off: 0 },
};

/* Tiling: vMapUv carries metres; each tile picks one of four mirrored copies of the face, grout is drawn analytically. */
function tiled(material, opts){
  const u = material.userData.tile = {
    uTile: { value: new THREE.Vector2(opts.size[0], opts.size[1]) },
    uOff: { value: opts.off ?? 1/3 },
    uRot: { value: opts.rot ?? 0 },
    uGrout: { value: opts.grout ?? 0.0025 },
    uGroutColor: { value: new THREE.Color(opts.groutColor ?? 0xb9b1a5) },
    uFlip: { value: opts.flip === false ? 0 : 1 },
    uVary: { value: opts.vary ?? 0.03 },
    uOrigin: { value: new THREE.Vector2(...(opts.origin || [0, 0])) },
  };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <map_pars_fragment>', `#include <map_pars_fragment>
uniform vec2 uTile; uniform float uOff; uniform float uRot; uniform float uGrout; uniform vec3 uGroutColor;
uniform float uFlip; uniform float uVary; uniform vec2 uOrigin;
float tileHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }`)
      .replace('#include <map_fragment>', `
float groutMask = 0.0;
#ifdef USE_MAP
{
  vec2 p = vMapUv - uOrigin;
  if (uRot > 0.5) p = vec2(p.y, -p.x);
  float row = floor(p.y / uTile.y);
  float px = p.x + fract(row * uOff) * uTile.x;
  vec2 s = vec2(px / uTile.x, p.y / uTile.y);
  vec2 cell = floor(s);
  vec2 f = s - cell;
  vec2 gx = dFdx(s), gy = dFdy(s);
  float h = tileHash(cell + vec2(17.0, 3.0));
  vec2 q = f;
  if (uFlip > 0.5) {
    if (h > 0.5) { q.x = 1.0 - q.x; gx.x = -gx.x; gy.x = -gy.x; }
    if (fract(h * 7.31) > 0.5) { q.y = 1.0 - q.y; gx.y = -gx.y; gy.y = -gy.y; }
  }
  vec4 tc = textureGrad(map, q, gx, gy);
  tc.rgb *= 1.0 - uVary + 2.0 * uVary * fract(h * 13.7);
  vec2 edge = min(f, 1.0 - f) * uTile;
  float d = min(edge.x, edge.y);
  float pxm = max(length(fwidth(p)), 1e-5);
  groutMask = clamp((uGrout * 0.5 - d) / pxm + 0.5, 0.0, 1.0) * clamp(uGrout / pxm, 0.0, 1.0);
  tc.rgb = mix(tc.rgb, uGroutColor, groutMask);
  diffuseColor *= tc;
  diffuseColor.a = mix(diffuseColor.a, 1.0, groutMask);
}
#endif`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.9, groutMask);`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
material.clearcoat *= 1.0 - groutMask;
#endif`);
  };
  material.customProgramCacheKey = () => 'tiled-v1';
  return material;
}

function faceTexture(canvas, maxAniso){
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function createMaterials(renderer){
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const wrap = (t, rep) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = maxAniso; if (rep) t.repeat.set(rep, rep); return t; };

  /* textures */
  const st = stoneMaps();
  const stoneColor = new THREE.CanvasTexture(st.color); stoneColor.colorSpace = THREE.SRGBColorSpace;
  const stoneNormal = new THREE.CanvasTexture(st.normal);
  const stoneHeight = new THREE.CanvasTexture(st.height);
  for (const t of [stoneColor, stoneNormal, stoneHeight]) t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping;
  const oakVc = woodCanvas(false), oakHc = woodCanvas(true);
  const oakV = wrap(new THREE.CanvasTexture(oakVc)), oakH = wrap(new THREE.CanvasTexture(oakHc));
  const boucleC = boucleCanvas();
  const boucle = new THREE.CanvasTexture(boucleC); boucle.wrapS = boucle.wrapT = THREE.RepeatWrapping; boucle.repeat.set(5,5);
  const rugTex = new THREE.CanvasTexture(rugCanvas()); rugTex.colorSpace = THREE.SRGBColorSpace;
  const tvTex = new THREE.CanvasTexture(tvCanvas()); tvTex.colorSpace = THREE.SRGBColorSpace;
  const skyEve = new THREE.CanvasTexture(skyCanvas(true)); skyEve.colorSpace = THREE.SRGBColorSpace;
  const skyDay = new THREE.CanvasTexture(skyCanvas(false)); skyDay.colorSpace = THREE.SRGBColorSpace;
  const blobRect = new THREE.CanvasTexture(blobCanvas(false));
  const blobRound = new THREE.CanvasTexture(blobCanvas(true));

  /* tile faces: the photo arrives later (setTilePhoto); until then a neutral stand-in of the same tone */
  const tileStandIn = stoneFace(11, [160, 147, 127], 256);
  const faces = {
    tile: faceTexture(tileStandIn, maxAniso),
    oak: faceTexture(plankFace(), maxAniso),
    grey: faceTexture(stoneFace(23, [150, 147, 141], 384), maxAniso),
    outdoor: faceTexture(stoneFace(29, [92, 90, 88], 384), maxAniso),
    wall: faceTexture(wallTileFace(), maxAniso),
  };

  const M = {
    wall: new THREE.MeshStandardMaterial({ color:0xddd5ca, roughness:0.93 }),
    wallCut: new THREE.MeshStandardMaterial({ color:0x3a352f, roughness:0.9 }),
    ceiling: new THREE.MeshStandardMaterial({ color:0xf2eee8, roughness:0.95 }),
    slab: new THREE.MeshStandardMaterial({ color:0xb9b2a8, roughness:0.95 }),
    outside: new THREE.MeshStandardMaterial({ color:0x8e887f, roughness:0.95 }),
    skirting: new THREE.MeshStandardMaterial({ color:0xb7ab9a, roughness:0.3 }),
    oakV: new THREE.MeshStandardMaterial({ map:oakV, roughness:0.55 }),
    oakH: new THREE.MeshStandardMaterial({ map:oakH, roughness:0.55 }),
    stone: new THREE.MeshStandardMaterial({ map:stoneColor, normalMap:stoneNormal, normalScale:new THREE.Vector2(1.2,1.2), displacementMap:stoneHeight, displacementScale:0.045, roughness:0.96 }),
    olive: new THREE.MeshPhysicalMaterial({ color:0x58613f, roughness:0.75, sheen:1, sheenRoughness:0.45, sheenColor:new THREE.Color(0x9da77d) }),
    black: new THREE.MeshStandardMaterial({ color:0x1c1b19, roughness:0.45, metalness:0.4 }),
    blackGloss: new THREE.MeshStandardMaterial({ color:0x0d0d0e, roughness:0.12, metalness:0.2 }),
    steel: new THREE.MeshStandardMaterial({ color:0x9a9894, roughness:0.35, metalness:0.8 }),
    white: new THREE.MeshStandardMaterial({ color:0xf3f1ec, roughness:0.35 }),
    porcelain: new THREE.MeshStandardMaterial({ color:0xf7f6f2, roughness:0.18 }),
    worktop: new THREE.MeshStandardMaterial({ color:0xe6dfd4, roughness:0.28 }),
    travertine: new THREE.MeshStandardMaterial({ color:0xd9ccb6, roughness:0.6 }),
    ceramicCream: new THREE.MeshStandardMaterial({ color:0xe9e1d3, roughness:0.7 }),
    ceramicDark: new THREE.MeshStandardMaterial({ color:0x3b342d, roughness:0.6 }),
    ceramicOlive: new THREE.MeshStandardMaterial({ color:0x6c7450, roughness:0.4 }),
    leaf: new THREE.MeshStandardMaterial({ color:0xffffff, roughness:0.75 }),
    trunk: new THREE.MeshStandardMaterial({ color:0x6a5a48, roughness:0.9 }),
    glass: new THREE.MeshPhysicalMaterial({ color:0xffffff, roughness:0.04, metalness:0, transparent:true, opacity:0.12, depthWrite:false }),
    showerGlass: new THREE.MeshPhysicalMaterial({ color:0xe8f0ee, roughness:0.05, transparent:true, opacity:0.22, depthWrite:false, side:THREE.DoubleSide }),
    mirror: new THREE.MeshStandardMaterial({ color:0xc9d0d2, roughness:0.02, metalness:1.0 }),
    smoke: new THREE.MeshPhysicalMaterial({ color:0x2a2622, roughness:0.08, metalness:0, transparent:true, opacity:0.42, depthWrite:false, side:THREE.DoubleSide }),
    sheer: new THREE.MeshStandardMaterial({ color:0xfbf8f2, roughness:0.9, transparent:true, opacity:0.55, side:THREE.DoubleSide, depthWrite:false }),
    linen: new THREE.MeshStandardMaterial({ color:0xc9bca9, roughness:0.95, side:THREE.DoubleSide }),
    bedding: new THREE.MeshStandardMaterial({ color:0xf4f1ea, roughness:0.95 }),
    pampas: new THREE.MeshStandardMaterial({ color:0xe3d3b6, roughness:1 }),
    stem: new THREE.MeshStandardMaterial({ color:0xb9a68a, roughness:1 }),
    book1: new THREE.MeshStandardMaterial({ color:0xd9cfbf, roughness:0.8 }),
    book2: new THREE.MeshStandardMaterial({ color:0x8c7a63, roughness:0.8 }),
    door: new THREE.MeshStandardMaterial({ color:0xeeebe5, roughness:0.5 }),
    entrance: new THREE.MeshStandardMaterial({ color:0x2b2a28, roughness:0.55, metalness:0.2 }),
    screen: new THREE.MeshStandardMaterial({ color:0x000000, emissive:0xffffff, emissiveMap:tvTex, emissiveIntensity:0.55, roughness:0.08, metalness:0.1 }),
    led: new THREE.MeshBasicMaterial({ color:0xffffff }),
    lampShade: new THREE.MeshStandardMaterial({ color:0xf3ece0, roughness:0.85, emissive:0xffcf98, emissiveIntensity:0, side:THREE.DoubleSide }),
    flush: new THREE.MeshStandardMaterial({ color:0xf6f2ea, roughness:0.6, emissive:0xffe2bd, emissiveIntensity:0 }),
    skyEve: new THREE.MeshBasicMaterial({ map:skyEve, toneMapped:false }),
    skyDay: new THREE.MeshBasicMaterial({ map:skyDay, toneMapped:false }),
  };
  M.wall.shadowSide = THREE.DoubleSide;

  /* floors */
  const floorMat = (key, extra) => {
    const f = FINISHES[key];
    const m = f.glossy
      ? new THREE.MeshPhysicalMaterial({ map:faces[key], roughness:0.16, clearcoat:0.7, clearcoatRoughness:0.06, transparent:true, opacity:0.82 })
      : new THREE.MeshStandardMaterial({ map:faces[key], roughness: key === 'oak' ? 0.55 : 0.82 });
    return tiled(m, { size: f.size, grout: f.grout, off: key === 'oak' ? 0.37 : 1/3, groutColor: key === 'oak' ? 0x6f5a43 : key === 'outdoor' ? 0x4c4a47 : 0xb9b1a5, vary: key === 'oak' ? 0.07 : 0.025, ...extra });
  };
  const FLOOR = { tile: floorMat('tile'), oak: floorMat('oak'), grey: floorMat('grey'), outdoor: floorMat('outdoor') };
  const BATHWALL = tiled(new THREE.MeshPhysicalMaterial({ map:faces.wall, roughness:0.2, clearcoat:0.4, clearcoatRoughness:0.1 }),
    { size: [1.2, 0.6], grout: 0.002, off: 0, rot: 1, groutColor: 0xd8d2c8, vary: 0.015 });

  /* fabric and finish variants are cached so furniture of the same colour shares one material */
  const cache = new Map();
  const fabric = (hex) => {
    const k = 'fab' + hex; if (!cache.has(k)) cache.set(k, new THREE.MeshPhysicalMaterial({ color:hex, roughness:0.95, bumpMap:boucle, bumpScale:3, sheen:0.6, sheenRoughness:0.6, sheenColor:new THREE.Color(0xffffff) }));
    return cache.get(k);
  };
  const fabricBack = (hex) => {
    const k = 'fabB' + hex; if (!cache.has(k)) cache.set(k, new THREE.MeshPhysicalMaterial({ color:hex, roughness:0.92, bumpMap:boucle, bumpScale:2, sheen:0.4, sheenRoughness:0.6, sheenColor:new THREE.Color(0xffffff), side:THREE.DoubleSide }));
    return cache.get(k);
  };
  const paint = (hex, rough = 0.6) => {
    const k = 'p' + hex + rough; if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ color:hex, roughness:rough }));
    return cache.get(k);
  };
  const rug = (hex) => {
    const k = 'rug' + hex; if (!cache.has(k)) cache.set(k, new THREE.MeshStandardMaterial({ map:rugTex, color:hex, roughness:1 }));
    return cache.get(k);
  };
  const blob = (round, opacity) => {
    const k = 'blob' + round + opacity.toFixed(2);
    if (!cache.has(k)) cache.set(k, new THREE.MeshBasicMaterial({ map: round ? blobRound : blobRect, transparent:true, depthWrite:false, opacity, toneMapped:false }));
    return cache.get(k);
  };

  function setTilePhoto(canvas){
    const t = faceTexture(canvas, maxAniso);
    faces.tile.dispose(); faces.tile = t;
    FLOOR.tile.map = t; FLOOR.tile.needsUpdate = true;
  }

  const swatches = { tile: () => faces.tile.image, stone: st.color, oak: oakVc, boucle: boucleC, plank: faces.oak.image };

  return { M, FLOOR, BATHWALL, fabric, fabricBack, paint, rug, blob, setTilePhoto, swatches, maxAniso, tvTex, faces };
}
