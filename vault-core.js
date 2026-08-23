(() => {
  'use strict';

  const FORMAT = 'bhc-universal-xray-vault';
  const SCHEMA_VERSION = 1;
  const PREFIX = 'bhc_xray_';

  const clone = value => JSON.parse(JSON.stringify(value));
  const byteSize = value => new Blob([JSON.stringify(value)]).size;

  function buildBundle({ appVersion = 'unknown', storage = localStorage, keys = {} } = {}) {
    const data = {};
    Object.entries(keys).forEach(([name, key]) => {
      const raw = storage.getItem(key);
      if (raw == null) return;
      try { data[name] = JSON.parse(raw); }
      catch { data[name] = raw; }
    });
    const counts = {
      journal: Array.isArray(data.journal) ? data.journal.length : 0,
      frictionRules: Array.isArray(data.friction) ? data.friction.length : 0,
      outcomes: Array.isArray(data.outcomes) ? data.outcomes.length : 0,
      loops: Array.isArray(data.loops) ? data.loops.length : 0
    };
    const bundle = {
      format: FORMAT,
      schemaVersion: SCHEMA_VERSION,
      appVersion,
      exportedAt: new Date().toISOString(),
      counts,
      data,
      extensionBridge: {
        format: 'bhc-xray-extension-portable',
        frictionRules: clone(data.friction || []),
        evidenceLens: data.lens || 'all',
        note: 'PWA cannot read browser-extension storage directly. This bridge contains only portable settings already present in the PWA.'
      }
    };
    bundle.sizeBytes = byteSize(bundle);
    return bundle;
  }

  function validateBundle(payload) {
    const problems = [];
    if (!payload || typeof payload !== 'object') problems.push('Tiedosto ei sisällä JSON-objektia.');
    if (payload?.format !== FORMAT) problems.push('Tuntematon varmuuskopioformaatti.');
    if (Number(payload?.schemaVersion) !== SCHEMA_VERSION) problems.push(`Tuntematon skeemaversio: ${payload?.schemaVersion ?? '—'}.`);
    if (!payload?.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) problems.push('data-osa puuttuu tai on virheellinen.');
    return { ok: problems.length === 0, problems };
  }

  function restoreBundle(payload, { storage = localStorage, keys = {}, clear = true } = {}) {
    const check = validateBundle(payload);
    if (!check.ok) throw new Error(check.problems.join(' '));
    if (clear) Object.values(keys).forEach(key => storage.removeItem(key));
    const restored = [];
    Object.entries(keys).forEach(([name, key]) => {
      if (!(name in payload.data)) return;
      storage.setItem(key, JSON.stringify(payload.data[name]));
      restored.push(name);
    });
    return { restored, count: restored.length };
  }

  function clearKnownData({ storage = localStorage, keys = {} } = {}) {
    const removed = [];
    Object.values(keys).forEach(key => {
      if (storage.getItem(key) != null) removed.push(key);
      storage.removeItem(key);
    });
    return removed;
  }

  function selfTest() {
    const mem = new Map();
    const storage = { getItem:k=>mem.has(k)?mem.get(k):null, setItem:(k,v)=>mem.set(k,String(v)), removeItem:k=>mem.delete(k) };
    const keys = { journal:`${PREFIX}journal_v1`, settings:`${PREFIX}settings_v1` };
    storage.setItem(keys.journal, JSON.stringify([{id:'a'}]));
    storage.setItem(keys.settings, JSON.stringify({reduceMotion:true}));
    storage.setItem('foreign_key', 'KEEP');
    const bundle = buildBundle({ appVersion:'test', storage, keys });
    clearKnownData({ storage, keys });
    const restored = restoreBundle(bundle, { storage, keys });
    const ok = validateBundle(bundle).ok && restored.count === 2 && JSON.parse(storage.getItem(keys.journal)).length === 1 && storage.getItem('foreign_key') === 'KEEP';
    return { ok, version:'1.8.0', format:FORMAT, schemaVersion:SCHEMA_VERSION, problems: ok ? [] : ['roundtrip failed'] };
  }

  window.BHCVaultCore = Object.freeze({ FORMAT, SCHEMA_VERSION, buildBundle, validateBundle, restoreBundle, clearKnownData, selfTest });
})();
