/* Page UI around the 3D stage: views, light and wall toggles, catalogue, settings of the selected piece,
   variants, floors and tile count, costs, material swatches. */
import { CATEGORIES, TYPES, shapesOf, displayName } from './catalog.js';
import { VIEWS, ROOMS, TOTAL_AREA } from './plan.js';
import { FINISHES, BONDS } from './materials.js';
import { PRESETS, presetLayout } from './layouts.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)){
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids) if (c != null) e.append(c);
  return e;
};
const cm = v => Math.round(v * 100);
const eur = v => v.toLocaleString('bg-BG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const ICON = {
  rotl: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h6a6 6 0 1 1-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9.5 3.5 6 7l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  rotr: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 7h-6a6 6 0 1 0 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M14.5 3.5 18 7l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7H15a5 5 0 0 1 0 10H8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M11.5 3.5 8 7l3.5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  redo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 7H9a5 5 0 0 0 0 10h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12.5 3.5 16 7l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  del: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

export function initUI(app){
  const { editor, store, mats } = app;

  /* ---------- toast ---------- */
  const toastEl = $('#toast'); let toastT = null;
  function toast(msg){ toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('on'), 3200); }

  /* ---------- stage HUD ---------- */
  const modeBtns = { day: $('#m-day'), evening: $('#m-eve') };
  for (const [m, b] of Object.entries(modeBtns)) b.addEventListener('click', () => { app.setMode(m); syncHud(); });
  const wallBtns = { auto: $('#w-auto'), low: $('#w-low'), full: $('#w-full') };
  for (const [w, b] of Object.entries(wallBtns)) b.addEventListener('click', () => { app.setWalls(w); syncHud(); });
  const undoB = $('#undo'), redoB = $('#redo');
  undoB.innerHTML = ICON.undo; redoB.innerHTML = ICON.redo;
  undoB.addEventListener('click', () => editor.undo());
  redoB.addEventListener('click', () => editor.redo());
  function syncHud(){
    for (const [m, b] of Object.entries(modeBtns)) b.setAttribute('aria-pressed', app.state.mode === m);
    for (const [w, b] of Object.entries(wallBtns)) b.setAttribute('aria-pressed', app.state.walls === w);
    undoB.disabled = !editor.past.length; redoB.disabled = !editor.future.length;
  }

  /* selection bar inside the stage */
  const selbar = $('#selbar'), selName = $('#sel-name');
  $('#sel-rotl').innerHTML = ICON.rotl; $('#sel-rotr').innerHTML = ICON.rotr; $('#sel-dup').innerHTML = ICON.copy; $('#sel-del').innerHTML = ICON.del;
  $('#sel-rotl').addEventListener('click', () => editor.selected && editor.rotateBy(editor.selected, -90));
  $('#sel-rotr').addEventListener('click', () => editor.selected && editor.rotateBy(editor.selected, 90));
  $('#sel-dup').addEventListener('click', () => editor.selected && editor.duplicate(editor.selected));
  $('#sel-del').addEventListener('click', () => editor.selected && editor.remove(editor.selected));
  $('#sel-close').addEventListener('click', () => editor.select(null));
  $('#add-open').addEventListener('click', () => { setTab('add'); if (window.matchMedia('(max-width: 1099px)').matches) $('#dock').scrollIntoView({ behavior: 'smooth', block: 'start' }); });

  /* ---------- views ---------- */
  const views = $('#views');
  for (const [k, v] of Object.entries(VIEWS)){
    views.append(el('button', { type: 'button', 'data-view': k, 'aria-pressed': 'false', text: v.name, onclick: () => { app.goView(k); syncViews(); } }));
  }
  function syncViews(){ views.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === app.state.view)); }

  /* ---------- dock: tabs ---------- */
  const tabs = { item: $('#tab-item'), add: $('#tab-add') }, bodies = { item: $('#dock-item'), add: $('#dock-add') };
  function setTab(t){
    for (const k of Object.keys(tabs)){ tabs[k].setAttribute('aria-selected', k === t); bodies[k].hidden = k !== t; }
  }
  tabs.item.addEventListener('click', () => setTab('item'));
  tabs.add.addEventListener('click', () => setTab('add'));

  /* catalogue */
  const add = bodies.add;
  for (const c of CATEGORIES){
    const list = el('div', { class: 'cat-list' });
    for (const [type, T] of Object.entries(TYPES)){
      if (T.cat !== c.id) continue;
      const p = Object.fromEntries(T.params.map(d => [d.key, d.def]));
      const [w, d] = T.size(p);
      const price = T.price ? T.price(p) : null;
      list.append(el('button', { type: 'button', class: 'cat-item', onclick: () => {
        editor.add(type);
        setTab('item');
        if (window.matchMedia('(max-width: 1099px)').matches) $('#stage').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } }, el('b', { text: T.name }), el('span', { class: 'num', text: T.round ? `Ø${cm(w)}` : `${cm(w)} × ${cm(d)} см` }), price != null ? el('span', { class: 'num price', text: eur(price) }) : null));
    }
    add.append(el('h4', { text: c.name }), list);
  }

  /* settings of the selected piece */
  const itemBody = bodies.item;
  let raf = 0, pendingParam = null;
  function liveParam(id, key, val){
    pendingParam = [id, key, val];
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; const [a, b, c] = pendingParam; editor.setParam(a, b, c); });
  }
  function renderItem(){
    const it = editor.item(editor.selected);
    itemBody.replaceChildren();
    if (!it){
      itemBody.append(el('p', { class: 'muted', text: 'Докосни мебел в модела, за да я избереш. После я влачи с пръст или мишка. От „Добави“ слагаш нова.' }),
        el('ul', { class: 'tips' },
          el('li', { text: 'Сините линии показват колко място остава до стените и до другите мебели.' }),
          el('li', { text: 'Червен контур значи, че мебелта застъпва стена или друга мебел.' }),
          el('li', { text: 'На компютър: R завърта, стрелките местят с 1 см, Delete маха, Ctrl+Z връща.' })));
      return;
    }
    const T = TYPES[it.type];
    const sh = shapesOf(it.type, it.p);
    const w = Math.max(...sh.map(r => r[2])) - Math.min(...sh.map(r => r[0])), d = Math.max(...sh.map(r => r[3])) - Math.min(...sh.map(r => r[1]));
    itemBody.append(el('div', { class: 'item-head' }, el('h3', { text: displayName(it) }), el('span', { class: 'num', text: T.round ? `Ø${cm(w)} см` : `${cm(w)} × ${cm(d)} см` })));
    itemBody.append(el('p', { class: 'warn', id: 'item-warn', role: 'status' }));
    renderWarn();
    const form = el('div', { class: 'params' });
    for (const def of T.params){
      if (def.if && !def.if(it.p)) continue;
      const id = `p-${def.key}`;
      const row = el('div', { class: 'param' });
      if (def.type === 'range'){
        const isScale = def.key === 'S';
        const out = el('output', { class: 'num', for: id, text: isScale ? `×${it.p[def.key].toFixed(2)}` : `${cm(it.p[def.key])} см` });
        const inp = el('input', { type: 'range', id, min: def.min, max: def.max, step: def.step, value: it.p[def.key] });
        inp.addEventListener('input', () => { const v = +inp.value; out.textContent = isScale ? `×${v.toFixed(2)}` : `${cm(v)} см`; liveParam(it.id, def.key, v); });
        inp.addEventListener('change', () => { editor.setParam(it.id, def.key, +inp.value); editor.commit(); });
        row.append(el('label', { for: id }, el('span', { text: def.label }), out), inp);
      } else if (def.type === 'choice'){
        const seg = el('div', { class: 'chips', role: 'group', 'aria-label': def.label });
        for (const [val, label] of def.options){
          seg.append(el('button', { type: 'button', 'aria-pressed': String(it.p[def.key] === val), text: label, onclick: () => { editor.setParam(it.id, def.key, val); editor.commit(); renderItem(); } }));
        }
        row.append(el('span', { class: 'plabel', text: def.label }), seg);
      } else if (def.type === 'color'){
        const seg = el('div', { class: 'swatch-row', role: 'group', 'aria-label': def.label });
        for (const [val, hex, label] of def.options){
          const btn = el('button', { type: 'button', class: 'sw-btn', title: label, 'aria-label': label, 'aria-pressed': String(it.p[def.key] === val), onclick: () => { editor.setParam(it.id, def.key, val); editor.commit(); renderItem(); } });
          if (val === 'oak') btn.style.backgroundImage = `url(${swatchURL('oak')})`; else btn.style.background = '#' + hex.toString(16).padStart(6, '0');
          seg.append(btn);
        }
        const cur = def.options.find(o => o[0] === it.p[def.key]);
        row.append(el('span', { class: 'plabel', text: `${def.label}: ${cur ? cur[2] : ''}` }), seg);
      } else if (def.type === 'bool'){
        const inp = el('input', { type: 'checkbox', id, checked: !!it.p[def.key] });
        inp.addEventListener('change', () => { editor.setParam(it.id, def.key, inp.checked); editor.commit(); renderItem(); });
        row.classList.add('check'); row.append(inp, el('label', { for: id, text: def.label }));
      } else if (def.type === 'text'){
        const inp = el('input', { type: 'text', id, value: it.p[def.key] || '', maxlength: '40' });
        inp.addEventListener('change', () => { editor.setParam(it.id, def.key, inp.value.trim() || def.def); editor.commit(); renderItem(); renderCosts(); });
        row.append(el('label', { for: id, text: def.label }), inp);
      }
      form.append(row);
    }
    // rotation
    {
      const out = el('output', { class: 'num', for: 'p-rot', text: `${Math.round(it.rot)}°` });
      const inp = el('input', { type: 'range', id: 'p-rot', min: 0, max: 355, step: 5, value: Math.round(it.rot / 5) * 5 % 360 });
      inp.addEventListener('input', () => { out.textContent = `${inp.value}°`; editor.setRot(it.id, +inp.value, false); });
      inp.addEventListener('change', () => editor.commit());
      const btns = el('div', { class: 'chips' },
        ...[[-90, '−90°'], [-15, '−15°'], [15, '+15°'], [90, '+90°']].map(([a, t]) => el('button', { type: 'button', text: t, onclick: () => editor.rotateBy(it.id, a) })));
      form.append(el('div', { class: 'param' }, el('label', { for: 'p-rot' }, el('span', { text: 'Завъртане' }), out), inp, btns));
    }
    // price and note
    {
      const def = T.price ? T.price(it.p) : null;
      const pr = el('input', { type: 'number', id: 'p-price', min: '0', step: '0.01', inputmode: 'decimal', placeholder: def != null ? String(def) : 'няма', value: it.price ?? '' });
      pr.addEventListener('change', () => { const v = pr.value.trim() === '' ? null : Math.max(0, +pr.value); editor.setMeta(it.id, { price: Number.isFinite(v) ? v : null }); editor.commit(); renderCosts(); });
      const nt = el('input', { type: 'text', id: 'p-note', maxlength: '60', placeholder: T.shop ? T.shop : 'магазин, модел', value: it.note || '' });
      nt.addEventListener('change', () => { editor.setMeta(it.id, { note: nt.value.trim() }); editor.commit(); renderCosts(); });
      form.append(el('div', { class: 'param two' },
        el('div', {}, el('label', { for: 'p-price', text: 'Цена, €' }), pr),
        el('div', {}, el('label', { for: 'p-note', text: 'Бележка' }), nt)));
    }
    itemBody.append(form, el('div', { class: 'item-actions' },
      el('button', { type: 'button', class: 'btn ghost', text: 'Копие', onclick: () => editor.duplicate(it.id) }),
      el('button', { type: 'button', class: 'btn ghost danger', text: 'Махни', onclick: () => editor.remove(it.id) })));
  }

  function renderWarn(){
    const w = document.getElementById('item-warn'); if (!w) return;
    const issues = editor.issues || [];
    const names = issues.map(i => i.kind === 'wall' ? 'стена' : displayName(editor.item(i.id) || { type: 'box', p: {} }));
    w.textContent = issues.length ? 'Застъпва: ' + [...new Set(names)].join(', ') : '';
    w.hidden = !issues.length;
  }

  /* ---------- variants ---------- */
  const presetsEl = $('#presets');
  for (const P of PRESETS){
    presetsEl.append(el('div', { class: 'preset' }, el('b', { text: P.name }), el('p', { text: P.note }),
      el('button', { type: 'button', class: 'btn ghost', text: 'Зареди', onclick: () => { editor.applyLayout(presetLayout(P.id)); editor.commit(); toast(`Зареден: ${P.name}. С „Назад“ се връщаш.`); } })));
  }
  const savedEl = $('#saved'), noteEl = $('#storage-note');
  function renderVariants(){
    savedEl.replaceChildren();
    const list = store.variants || [];
    if (!list.length) savedEl.append(el('li', { class: 'muted', text: 'Още няма запазени варианти.' }));
    for (const v of list){
      const when = new Date(v.savedAt || Date.now()).toLocaleString('bg-BG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const n = (v.layout && v.layout.items) ? v.layout.items.length : 0;
      savedEl.append(el('li', {}, el('div', {}, el('b', { text: v.name }), el('span', { class: 'muted num', text: `${when} · ${n} мебели` })),
        el('div', { class: 'row-actions' },
          el('button', { type: 'button', class: 'btn ghost', text: 'Зареди', onclick: () => { editor.applyLayout(v.layout); editor.commit(); toast(`Зареден вариант „${v.name}“.`); } }),
          el('button', { type: 'button', class: 'btn ghost danger', text: 'Изтрий', 'aria-label': `Изтрий ${v.name}`, onclick: () => store.deleteVariant(v.id) }))));
    }
    noteEl.textContent = store.mode === 'shared'
      ? (store.status === 'slow' ? 'Връзката с базата е бавна. Вариантите може да не са най-новите.' : 'Вариантите се пазят в артефакта: виждаш ги от всяко устройство, а Claude може да ги прочете.')
      : 'Вариантите се пазят в този браузър. За да ги пренесеш, копирай ги като текст.';
  }
  const saveName = $('#save-name');
  $('#save-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = saveName.value.trim() || `Вариант ${(store.variants || []).length + 1}`;
    const ok = await store.saveVariant(name, editor.serialize());
    if (ok){ saveName.value = ''; toast(`Запазих „${name}“.`); }
  });
  $('#export-btn').addEventListener('click', async () => {
    const txt = JSON.stringify(editor.serialize());
    const ta = $('#io-text'); ta.value = txt;
    try { await navigator.clipboard.writeText(txt); toast('Копирах подредбата. Можеш да я пратиш в чата.'); }
    catch (_){ ta.focus(); ta.select(); toast('Текстът е маркиран. Копирай го ръчно.'); }
  });
  function importText(txt){
    try {
      const data = JSON.parse(txt);
      const layout = data.layout && data.layout.items ? data.layout : data;
      if (!Array.isArray(layout.items)) throw new Error('no items');
      editor.applyLayout(layout); editor.commit(); toast('Подредбата е заредена.');
    } catch (_){ toast('Текстът не е подредба от този модел. Копирай го целия и опитай пак.'); }
  }
  $('#import-btn').addEventListener('click', () => importText($('#io-text').value));
  $('#import-file').addEventListener('change', async (e) => { const f = e.target.files && e.target.files[0]; if (f) importText(await f.text()); e.target.value = ''; });

  /* ---------- rooms and floors ---------- */
  const roomsBody = $('#rooms-body'), bondSel = $('#bond'), dirSel = $('#dir');
  for (const [k, b] of Object.entries(BONDS)) bondSel.append(el('option', { value: k, text: b.name }));
  bondSel.addEventListener('change', () => editor.setFloors(null, bondSel.value));
  dirSel.addEventListener('change', () => editor.setFloors(null, null, +dirSel.value));
  function renderRooms(){
    roomsBody.replaceChildren();
    let sum = 0;
    for (const r of ROOMS){
      sum += r.area;
      const sel = el('select', { id: `fl-${r.id}`, 'aria-label': `Под: ${r.name}` });
      for (const [k, f] of Object.entries(FINISHES)) sel.append(el('option', { value: k, text: f.short, selected: (editor.floors[r.id] || 'tile') === k }));
      sel.addEventListener('change', () => editor.setFloors({ [r.id]: sel.value }));
      roomsBody.append(el('tr', {}, el('td', {}, el('b', { text: r.name }), el('small', { text: `ап. ${r.code}` })), el('td', { class: 'r num', text: r.area.toFixed(2) }), el('td', {}, sel)));
    }
    $('#rooms-sum').textContent = sum.toFixed(2);
    $('#rooms-total').textContent = TOTAL_AREA.toFixed(2);
    bondSel.value = editor.bond; dirSel.value = String(editor.dir);
  }

  function tileCalc(){
    const f = FINISHES.tile, rooms = ROOMS.filter(r => (editor.floors[r.id] || 'tile') === 'tile');
    const area = rooms.reduce((s, r) => s + r.area, 0), withCut = area * 1.10;
    const boxes = Math.ceil(withCut / f.price.boxM2 - 1e-9);
    return { rooms, area, withCut, boxes, cost: boxes * f.price.perBox };
  }

  /* ---------- costs ---------- */
  const costsBody = $('#costs-body');
  function renderCosts(){
    costsBody.replaceChildren();
    const t = tileCalc();
    let total = 0;
    if (t.boxes > 0){
      total += t.cost;
      costsBody.append(el('tr', {}, el('td', {}, el('b', { text: 'Гранитогрес Каньон Гриджо 60×120' }),
        el('small', { text: `${t.boxes} кашона × 36.70 € · ${t.area.toFixed(2)} м² + 10% фира = ${t.withCut.toFixed(1)} м², кашонът е 2.16 м² · ${t.rooms.map(r => r.name.toLowerCase()).join(', ')}` })),
        el('td', { class: 'r', text: eur(t.cost) })));
    }
    const groups = new Map();
    for (const it of editor.items){
      const T = TYPES[it.type];
      const price = it.price != null ? it.price : (T.price ? T.price(it.p) : null);
      const name = displayName(it);
      const key = name + '|' + price + '|' + (it.note || '');
      if (!groups.has(key)) groups.set(key, { name, price, note: it.note || (price != null && it.price == null ? [T.shop, T.priceNote].filter(Boolean).join(' · ') : ''), n: 0 });
      groups.get(key).n++;
    }
    const priced = [...groups.values()].filter(g => g.price != null);
    const unpriced = [...groups.values()].filter(g => g.price == null);
    for (const g of priced){
      total += g.price * g.n;
      costsBody.append(el('tr', {}, el('td', {}, el('b', { text: g.name }), el('small', { text: `${g.n} × ${eur(g.price)}${g.note ? ' · ' + g.note : ''}` })), el('td', { class: 'r', text: eur(g.price * g.n) })));
    }
    if (unpriced.length){
      costsBody.append(el('tr', { class: 'unpriced' }, el('td', {}, el('b', { text: 'Без цена засега' }),
        el('small', { text: unpriced.map(g => g.n > 1 ? `${g.name} × ${g.n}` : g.name).join(', ') })), el('td', { class: 'r', text: '—' })));
    }
    $('#costs-total').textContent = eur(total);
  }

  /* ---------- swatches ---------- */
  const swCache = {};
  function swatchURL(k){
    if (!swCache[k]){
      try { const src = k === 'oak' ? mats.swatches.oak : mats.swatches[k]; swCache[k] = (typeof src === 'function' ? src() : src).toDataURL('image/jpeg', 0.85); } catch (_){ swCache[k] = ''; }
    }
    return swCache[k];
  }
  function refreshSwatches(){
    delete swCache.tile;
    const map = { 'sw-tile': 'tile', 'sw-stone': 'stone', 'sw-oak': 'oak', 'sw-boucle': 'boucle', 'sw-plank': 'plank' };
    for (const [id, k] of Object.entries(map)){ const n = document.getElementById(id); if (n){ const u = swatchURL(k); if (u) n.style.backgroundImage = `url(${u})`; } }
  }

  /* ---------- wiring ---------- */
  function selbarSync(){
    const it = editor.item(editor.selected);
    selbar.hidden = !it;
    if (it) selName.textContent = displayName(it);
  }
  editor.addEventListener('select', () => { renderItem(); selbarSync(); if (editor.selected) setTab('item'); });
  let moveRaf = 0;
  editor.addEventListener('change', (e) => {
    const d = e.detail || {};
    syncHud();
    if (d.moved || d.params){ if (!moveRaf) moveRaf = requestAnimationFrame(() => { moveRaf = 0; renderWarn(); }); if (d.moved) return; }
    if (d.layout || d.history){ renderItem(); selbarSync(); }
    if (d.commit && !d.history && !d.params) { const it = editor.item(editor.selected); if (it && itemBody.querySelector('#p-rot')){ const r = itemBody.querySelector('#p-rot'); r.value = Math.round(it.rot / 5) * 5 % 360; itemBody.querySelector('output[for="p-rot"]').textContent = `${Math.round(it.rot)}°`; } }
    if (d.floors || d.layout || d.history) renderRooms();
    renderCosts();
  });

  syncHud(); syncViews(); setTab('add'); renderItem(); renderVariants(); renderRooms(); renderCosts(); refreshSwatches();

  return { renderVariants, syncViews, refreshSwatches, toast, renderCosts };
}
