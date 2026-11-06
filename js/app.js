/* Entry point: renderer, scene, light modes, camera views, wall cut-away, labels, and wiring of editor, storage and page UI. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { H as Hcm, VIEWS, ROOMS, BOUNDS, roomAt } from './plan.js';
import { createMaterials, BONDS } from './materials.js';
import { loadPhotoFace } from './textures.js';
import { buildShell, CUT } from './shell.js';
import { setBuildContext, TYPES } from './catalog.js';
import { diagram, soundKit, isSound } from './sound.js';
import { Editor } from './editor.js';
import { Store } from './store.js';
import { presetLayout, DEFAULT_PRESET, migrate } from './layouts.js';
import { initUI } from './ui.js';

const Hm = Hcm / 100;
const stage = document.getElementById('stage');
const canvas = document.getElementById('c');
const veil = document.getElementById('veil');
const fail = (msg) => { veil.classList.remove('off'); veil.innerHTML = msg + '<small>Опитай в Chrome или Safari на по-нов телефон или компютър</small>'; };

/* ---------- HTML labels over the canvas ---------- */
class Labels {
  constructor(el){ this.el = el; this.groups = new Map(); this.v = new THREE.Vector3(); }
  set(name, list){
    const old = this.groups.get(name) || [];
    old.forEach(l => l.el.remove());
    const made = list.map(o => {
      const el = document.createElement('div'); el.className = 'lbl ' + (o.cls || '');
      if (o.html) el.innerHTML = o.html; else el.textContent = o.text;
      this.el.appendChild(el);
      return { el, p: new THREE.Vector3(o.x, o.y, o.z) };
    });
    this.groups.set(name, made);
  }
  show(name, on){ (this.groups.get(name) || []).forEach(l => l.el.classList.toggle('gone', !on)); }
  update(camera, w, h){
    for (const list of this.groups.values()) for (const l of list){
      const v = this.v.copy(l.p).project(camera);
      if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1){ l.el.style.visibility = 'hidden'; continue; }
      l.el.style.visibility = '';
      l.el.style.transform = `translate(${((v.x + 1)/2*w).toFixed(1)}px, ${((1 - v.y)/2*h).toFixed(1)}px) translate(-50%, -50%)`;
    }
  }
}

function start(){
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); }
  catch (e){ fail('3D изгледът не тръгна на това устройство'); return; }
  if (!renderer.capabilities.isWebGL2){ fail('3D изгледът иска по-нов браузър'); return; }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  RectAreaLightUniformsLib.init();

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 90);

  const mats = createMaterials(renderer);
  const { M, FLOOR } = mats;
  setBuildContext({ ...mats, H: Hm });

  const shell = buildShell(mats);
  scene.add(shell.group);

  /* mirror under the glossy floor */
  const fw = BOUNDS.x1 - BOUNDS.x0, fd = BOUNDS.z1 - BOUNDS.z0;
  const reflector = new Reflector(new THREE.PlaneGeometry(fw, fd), { textureWidth: 512, textureHeight: 512, color: 0xffffff, clipBias: 0.002, multisample: 0 });
  reflector.rotation.x = -Math.PI/2; reflector.position.set((BOUNDS.x0 + BOUNDS.x1)/2, -0.0006, (BOUNDS.z0 + BOUNDS.z1)/2);
  scene.add(reflector);

  /* lights */
  const hemi = new THREE.HemisphereLight(0xfff2e2, 0x9c8b76, 0.4); scene.add(hemi);
  const cx = (BOUNDS.x0 + BOUNDS.x1)/2, cz = (BOUNDS.z0 + BOUNDS.z1)/2;
  const sun = new THREE.DirectionalLight(0xfff1dc, 5.2);
  sun.position.set(cx + 10.5, 7.2, cz + 2.2); sun.target.position.set(cx, 0, cz); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;

  /* postprocessing */
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0.3, 0.4, 1.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* controls */
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 0.3; controls.maxDistance = 34; controls.maxPolarAngle = Math.PI*0.53;
  controls.screenSpacePanning = true;

  const labels = new Labels(document.getElementById('labels'));
  let need = true, ui = null;
  const requestRender = () => { need = true; };

  const editor = new Editor({ scene, camera, controls, canvas, stage, labels, requestRender });
  editor.yOf = (it) => TYPES[it.type] && TYPES[it.type].ceiling ? shell.ceilingYAt(it.x, it.z) - Hm : 0;
  const store = new Store();

  /* ---------- state ---------- */
  const state = { mode: 'day', walls: 'auto', view: 'over', quality: 0 };

  const evening = () => state.mode === 'evening';
  function syncLights(){
    const eve = evening();
    scene.traverse(o => { if (o.isLight && o.userData.evening) o.visible = eve; });
  }
  function applyMode(){
    const eve = evening();
    const sky = eve ? M.skyEve : M.skyDay;
    shell.skies.forEach(s => { s.material = sky; });
    scene.background = new THREE.Color(eve ? 0x1a1713 : 0xe9e5de);
    stage.dataset.mode = state.mode;
    scene.environmentIntensity = eve ? 0.10 : 0.55;
    hemi.intensity = eve ? 0.14 : 0.46;
    hemi.color.set(eve ? 0xffe2c0 : 0xf3f1ec);
    sun.visible = !eve;
    syncLights();
    M.led.color.setRGB(...(eve ? [4.2, 2.9, 1.6] : [1.9, 1.75, 1.5]));
    M.lampShade.emissiveIntensity = eve ? 1.1 : 0;
    M.flush.emissiveIntensity = eve ? 0.45 : 0;
    M.ceilingField.emissiveIntensity = eve ? 0.10 : 0;
    M.screen.emissiveIntensity = eve ? 0.5 : 0.35;
    renderer.toneMappingExposure = eve ? 1.0 : 0.95;
    bloom.strength = eve ? 0.30 : 0.10;
    requestRender();
  }

  /* floors from the layout */
  function applyFloors(){
    for (const r of ROOMS) shell.setFloor(r.id, editor.floors[r.id] || 'tile');
    const t = FLOOR.tile.userData.tile;
    t.uOff.value = (BONDS[editor.bond] || BONDS.third).off;
    t.uRot.value = editor.dir ? 1 : 0;
    FLOOR.oak.userData.tile.uRot.value = editor.dir ? 1 : 0;
    requestRender();
  }

  /* suspended ceiling; the stats feed the LED note in the page */
  let ceilingStats = null, ceilingKey = '';
  function applyCeiling(){
    const key = JSON.stringify(editor.ceiling);
    if (key === ceilingKey) return;
    ceilingKey = key;
    ceilingStats = shell.setCeiling(editor.ceiling);
    editor.refreshHeights(); renderSound();
    if (ui) ui.renderCeiling(ceilingStats);
    requestRender();
  }

  /* Dolby diagram: dashed lines from the listener's ears to every speaker, with the angle at the speaker */
  const soundG = new THREE.Group(); scene.add(soundG);
  const dash = (color) => new THREE.LineDashedMaterial({ color, dashSize: 0.07, gapSize: 0.05, depthTest: false, transparent: true });
  const lineMats = { ok: dash(0x3f9b5c), near: dash(0xd9912b), bad: dash(0xc8463d), info: dash(0x8a8378) };
  let soundData = null, soundShown = false;
  function renderSound(){
    for (const c of [...soundG.children]){ soundG.remove(c); c.geometry.dispose(); }
    soundData = diagram(editor.items, shell.ceilingYAt);
    if (!soundData){ labels.set('sound', []); soundShown = false; return; }
    const ear = new THREE.Vector3(...soundData.ear);
    for (const s of soundData.speakers){
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([ear, new THREE.Vector3(s.x, s.y, s.z)]), lineMats[s.status]);
      line.computeLineDistances(); line.renderOrder = 20; soundG.add(line);
    }
    labels.set('sound', soundData.speakers.map(s => ({ x: s.x, y: s.y + 0.16, z: s.z, text: s.text, cls: 'snd ' + s.status })));
    labels.show('sound', soundShown);
  }
  function syncSound(plan){
    const show = !!soundData && (plan || isSound(editor.item(editor.selected)));
    soundG.visible = show;
    for (const g of editor.root.children) if (g.userData.soundOnly) g.visible = show;
    if (show !== soundShown){ soundShown = show; labels.show('sound', show); }
  }

  /* ---------- wall cut-away ---------- */
  const inFlat = (x, z) => !!roomAt(x, z);
  function cutFor(w){
    if (w.kind === 'parapet' || state.walls === 'full') return null;
    if (state.walls === 'low') return CUT;
    const p = camera.position;
    const above = p.y > Hm + 0.15;
    if (!above && inFlat(p.x, p.z)) return null;
    const x0 = w.x0/100, x1 = w.x1/100, z0 = w.y0/100, z1 = w.y1/100;
    if (w.out === 'n' && p.z < z0) return CUT;
    if (w.out === 's' && p.z > z1) return CUT;
    if (w.out === 'e' && p.x > x1) return CUT;
    if (w.out === 'w' && p.x < x0) return CUT;
    return null;
  }
  let lastAbove = null, lastPlan = null;
  const look = new THREE.Vector3();
  function updateVisibility(){
    shell.applyCut(cutFor);
    const p = camera.position;
    const above = p.y > Hm - 0.05 || state.walls === 'low';
    const inside = !above && p.x > BOUNDS.x0 - 0.5 && p.x < BOUNDS.x1 + 1.2 && p.z > BOUNDS.z0 - 0.5 && p.z < BOUNDS.z1 + 0.5;
    shell.ceilGroup.visible = !above;
    shell.roof.visible = !above;
    shell.lamps.forEach(l => { l.disc.visible = !above && l.on; });
    shell.skies.forEach(s => { s.visible = inside; });
    camera.getWorldDirection(look);
    const plan = state.walls === 'low' || (above && look.y < -0.82);
    if (above !== lastAbove){
      lastAbove = above;
      editor.root.traverse(o => { if (o.userData.ceiling) o.visible = !above; });
    }
    if (plan !== lastPlan){ lastPlan = plan; labels.show('rooms', plan); }
    syncSound(plan);
  }

  /* ---------- camera views ---------- */
  let aspect = 1, curH = 60, tween = null;
  function setFovOn(cam, h){ const v = 2*Math.atan(Math.tan(THREE.MathUtils.degToRad(h)/2)/aspect); cam.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(v), 22, 92); cam.updateProjectionMatrix(); }
  function setFov(h){ curH = h; setFovOn(camera, h); }
  /* whole-flat views: back off along the preset direction until the flat fits the current frame */
  const corners = [];
  for (const x of [BOUNDS.x0 - 0.4, BOUNDS.x1 + 0.25]) for (const z of [BOUNDS.z0 - 0.3, BOUNDS.z1 + 0.35]) for (const y of [-0.24, Hm]) corners.push(new THREE.Vector3(x, y, z));
  function fitted(v){
    const t = new THREE.Vector3(...v.t), dir = new THREE.Vector3(...v.p).sub(t).normalize();
    const cam = camera.clone(); setFovOn(cam, v.h);
    const fits = (d) => {
      cam.position.copy(t).addScaledVector(dir, d); cam.lookAt(t); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      return corners.every(c => { const q = c.clone().project(cam); return Math.abs(q.x) < 0.96 && q.y < 0.80 && q.y > -0.90 && q.z < 1; });
    };
    let lo = 3, hi = 80;
    for (let i = 0; i < 24; i++){ const m = (lo + hi)/2; if (fits(m)) hi = m; else lo = m; }
    return t.clone().addScaledVector(dir, hi);
  }
  function goView(name, instant){
    const v = VIEWS[name]; if (!v) return;
    state.view = name;
    const fromP = camera.position.clone(), fromT = controls.target.clone(), fromH = curH;
    const toP = v.fit ? fitted(v) : new THREE.Vector3(...v.p), toT = new THREE.Vector3(...v.t);
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (instant || reduce){ camera.position.copy(toP); controls.target.copy(toT); setFov(v.h); controls.update(); lastAbove = null; requestRender(); return; }
    const t0 = performance.now(), dur = 1100;
    tween = (now) => {
      let k = Math.min(1, (now - t0)/dur); k = k < 0.5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3)/2;
      camera.position.lerpVectors(fromP, toP, k); controls.target.lerpVectors(fromT, toT, k); setFov(fromH + (v.h - fromH)*k);
      if (k >= 1) tween = null;
    };
  }
  controls.addEventListener('start', () => { tween = null; if (state.view){ state.view = null; ui && ui.syncViews(); } });
  controls.addEventListener('change', requestRender);

  /* room names in the top view */
  labels.set('rooms', ROOMS.map(r => ({ x: r.label[0]/100, y: 0.05, z: r.label[1]/100, cls: 'room', html: `<b>${r.name}</b><span>${r.area.toFixed(2)} м²</span>` })));

  /* ---------- sizing & quality ---------- */
  let reflScale = 0.5, useComposer = true;
  function resize(){
    const r = stage.getBoundingClientRect(), w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false); composer.setSize(w, h);
    const pr = renderer.getPixelRatio();
    reflector.getRenderTarget().setSize(Math.max(64, Math.round(w*pr*reflScale)), Math.max(64, Math.round(h*pr*reflScale)));
    aspect = w/h; camera.aspect = aspect; setFov(curH); requestRender();
  }
  new ResizeObserver(resize).observe(stage);
  function degrade(){
    state.quality++;
    if (state.quality === 1){ renderer.setPixelRatio(1); composer.setPixelRatio(1); reflScale = 0.35; }
    if (state.quality === 2){
      reflector.visible = false; useComposer = false;
      FLOOR.tile.transparent = false; FLOOR.tile.opacity = 1; FLOOR.tile.needsUpdate = true;
      sun.shadow.mapSize.set(1024, 1024); if (sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; }
    }
    resize();
  }

  /* compass */
  const needle = document.getElementById('needle'), needleS = document.getElementById('needleS');
  const dir = new THREE.Vector3();
  function updateCompass(){
    camera.getWorldDirection(dir);
    if (Math.abs(dir.y) > 0.999) dir.set(0, 0, -1).applyQuaternion(camera.quaternion).setY(0);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const f = Math.abs(dir.y) > 0.98 ? up : dir;
    const a = Math.atan2(f.x, -f.z), deg = -THREE.MathUtils.radToDeg(a);
    needle.setAttribute('transform', `rotate(${deg.toFixed(1)} 22 22)`);
    needleS.setAttribute('transform', `rotate(${(-deg).toFixed(1)} 22 34)`);
  }

  /* ---------- loop: render only when something changed ---------- */
  let slow = 0, ready = false;
  function frame(now){
    requestAnimationFrame(frame);
    if (tween){ tween(now); need = true; }
    const moved = controls.update();
    if (camera.position.y < 0.15) camera.position.y = 0.15;
    if (!(moved || need)) return;
    need = false;
    updateVisibility();
    const t0 = performance.now();
    if (useComposer) composer.render(); else renderer.render(scene, camera);
    const dt = performance.now() - t0;
    if (dt > 60 && ++slow > 8 && state.quality < 2){ slow = 0; degrade(); }
    const r = stage.getBoundingClientRect();
    labels.update(camera, r.width, r.height);
    updateCompass();
    if (!ready){ ready = true; window.__ready = true; veil.classList.add('off'); }
  }

  /* ---------- layout start-up ---------- */
  const saved = store.loadCurrent();
  const mig = saved ? migrate(saved.layout) : { layout: presetLayout(DEFAULT_PRESET), changed: false };
  let layout = mig.layout;
  try { editor.applyLayout(layout, { resetHistory: true }); if (mig.changed) store.saveCurrent(editor.serialize()); }
  catch (e){ console.error(e); editor.applyLayout(presetLayout(DEFAULT_PRESET), { resetHistory: true }); }
  let touched = false;
  editor.addEventListener('change', (e) => {
    const d = e.detail || {};
    if (!d.moved){ syncLights(); lastAbove = null; }
    if (d.floors || d.layout) applyFloors();
    if (d.ceiling || d.layout) applyCeiling();
    renderSound();
    if (d.commit){ touched = true; store.saveCurrent(editor.serialize()); }
    requestRender();
  });
  applyFloors(); applyCeiling(); applyMode();

  /* the photographed tile replaces the stand-in once it arrives */
  loadPhotoFace('assets/kanyon-gridzho-60x120.jpg').then(c => { mats.setTilePhoto(c); ui && ui.refreshSwatches(); requestRender(); }).catch(() => {});

  const app = {
    THREE, scene, camera, controls, renderer, editor, store, state, mats, labels,
    requestRender, goView,
    setMode(m){ state.mode = m; applyMode(); },
    setWalls(w){ state.walls = w; requestRender(); },
    soundReport(){ return soundData; },
    addSoundKit(){
      const res = soundKit(editor.serialize(), { problems: (it) => editor.problems(it), ceilingY: shell.ceilingYAt, fieldAt: shell.fieldFits });
      if (res.error) return res;
      editor.applyLayout(res.layout); editor.commit();
      const L = editor.items.find(i => i.type === 'listener'); if (L) editor.select(L.id);
      goView('top');
      return res;
    },
  };
  ui = initUI(app);
  ui.renderCeiling(ceilingStats);

  store.addEventListener('variants', () => ui.renderVariants());
  store.addEventListener('error', (e) => ui.toast(e.detail));
  store.connect().then(remote => {
    if (remote && !touched && (!saved || remote.savedAt > saved.savedAt + 1000)){
      try { editor.applyLayout(migrate(remote.layout).layout, { resetHistory: true }); ui.toast('Заредих последната подредба от другото ти устройство.'); } catch (_){}
    }
    ui.renderVariants();
  });
  if (mig.changed) setTimeout(() => ui.toast('Спалнята и банята са по колажите. Останалото е както го остави.'), 1200);

  resize(); goView('over', true);
  requestAnimationFrame(frame);
  window.__app = app;
}

requestAnimationFrame(() => setTimeout(() => {
  try { start(); } catch (e){ console.error(e); fail('3D изгледът не тръгна на това устройство'); }
}, 30));
