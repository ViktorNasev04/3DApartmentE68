/* Saving: the working layout lives in this browser; saved variants go to the artifact's database when the page runs
   as a claude.ai artifact (so they follow you to other devices and Claude can read them), otherwise to this browser too. */
const KEY_CUR = 'e63.layout.v1', KEY_VAR = 'e63.variants.v1';

function readLocal(key){ try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (_){ return null; } }
function writeLocal(key, v){ try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (_){ return false; } }

export class Store extends EventTarget {
  constructor(){
    super();
    this.db = null; this.mode = 'local'; this.status = 'ok';
    this.variants = readLocal(KEY_VAR) || [];
    this._remoteTimer = null; this._lastRemote = null; this._writing = null;
  }
  _emit(type, detail){ this.dispatchEvent(new CustomEvent(type, { detail })); }

  loadCurrent(){ const v = readLocal(KEY_CUR); return v && v.layout ? v : null; }
  saveCurrent(layout){
    const rec = { savedAt: Date.now(), layout };
    writeLocal(KEY_CUR, rec);
    if (!this.db) return;
    clearTimeout(this._remoteTimer);
    this._remoteTimer = setTimeout(() => this._pushCurrent(rec), 2500);
  }
  async _pushCurrent(rec){
    const body = JSON.stringify(rec.layout);
    if (body === this._lastRemote) return;
    if (this._writing){ await this._writing.catch(() => {}); }
    this._writing = this.db.doc('layouts/current').set({ savedAt: rec.savedAt, layout: rec.layout })
      .then(() => { this._lastRemote = body; })
      .catch(() => {});
    return this._writing;
  }

  /* resolves when we know where variants live; never rejects */
  async connect(){
    const c = window.claude;
    if (!c || typeof c.use !== 'function'){ this._emit('variants'); return null; }
    let db = null;
    try { db = await c.use('db'); } catch (_){ db = null; }
    if (!db){ this._emit('variants'); return null; }
    this.db = db; this.mode = 'shared';
    let first = true;
    const slow = setTimeout(() => { if (first){ this.status = 'slow'; this._emit('variants'); } }, 10000);
    this._unsub = db.collection('variants').orderBy('savedAt', 'desc').onSnapshot(snap => {
      if (!snap.metadata.fromCache){ first = false; clearTimeout(slow); this.status = 'ok'; }
      this.variants = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => v && v.layout && typeof v.name === 'string');
      this._emit('variants');
    }, () => { first = false; clearTimeout(slow); this.status = 'error'; this.db = null; this.mode = 'local'; this.variants = readLocal(KEY_VAR) || []; this._emit('variants'); });
    let remote = null;
    try {
      const snap = await db.doc('layouts/current').get();
      if (snap.exists){ const d = snap.data(); if (d && d.layout) remote = { savedAt: +d.savedAt || 0, layout: d.layout }; this._lastRemote = remote ? JSON.stringify(remote.layout) : null; }
    } catch (_){}
    this._emit('variants');
    return remote;
  }

  async saveVariant(name, layout){
    const rec = { name: String(name).slice(0, 80), savedAt: Date.now(), layout };
    if (this.db){
      try { await this.db.collection('variants').add(rec); return true; }
      catch (e){ this._emit('error', e && e.code === 'quota_exceeded' ? 'Базата е пълна. Изтрий стар вариант и опитай пак.' : 'Вариантът не се запази. Опитай пак след малко.'); return false; }
    }
    rec.id = 'v' + rec.savedAt.toString(36);
    this.variants = [rec, ...this.variants].slice(0, 40);
    const ok = writeLocal(KEY_VAR, this.variants);
    if (!ok) this._emit('error', 'Браузърът не позволява запис. Копирай варианта като текст.');
    this._emit('variants');
    return ok;
  }
  async deleteVariant(id){
    if (this.db){ try { await this.db.doc('variants/' + id).delete(); } catch (_){ this._emit('error', 'Вариантът не се изтри. Опитай пак.'); } return; }
    this.variants = this.variants.filter(v => v.id !== id);
    writeLocal(KEY_VAR, this.variants); this._emit('variants');
  }
}
