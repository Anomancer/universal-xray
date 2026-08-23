(() => {
  'use strict';

  const VERSION = '2.0.0';
  const KEYS = {
    journal: 'bhc_xray_journal_v1',
    metrics: 'bhc_xray_metrics_v1',
    settings: 'bhc_xray_settings_v1',
    loops: 'bhc_xray_loops_v1',
    lens: 'bhc_xray_evidence_lens_v1',
    friction: 'bhc_xray_friction_rules_v1',
    outcomes: 'bhc_xray_outcomes_v1',
    pendingOutcome: 'bhc_xray_pending_outcome_v1'
  };

  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  const safeJson = (raw, fallback) => { try { return JSON.parse(raw); } catch { return fallback; } };
  const read = (key, fallback) => { try { return safeJson(localStorage.getItem(key), fallback); } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const euro = (n) => new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(n) || 0);
  const formatNum = (n, digits = 1) => new Intl.NumberFormat('fi-FI', { maximumFractionDigits: digits }).format(Number(n) || 0);
  const isFiniteValue = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

  const state = {
    journal: read(KEYS.journal, []),
    metrics: read(KEYS.metrics, { lastCasinoNet: null, lastScanCount: null }),
    settings: read(KEYS.settings, { reduceMotion: false, skinDefault: false }),
    loops: read(KEYS.loops, []),
    lens: read(KEYS.lens, 'all'),
    frictionRules: read(KEYS.friction, []),
    outcomes: read(KEYS.outcomes, []),
    pendingOutcome: read(KEYS.pendingOutcome, null),
    selectedPatternId: null,
    patternNodePositions: [],
    timer: null,
    timerEnds: null,
    calmRunning: true,
    lastLoop: null,
    engineReturnFocus: null,
    lastXrayAnalysis: null,
    frictionTimer: null,
    frictionEnds: null,
    frictionEval: null
  };


  const EVIDENCE_LABELS = {
    'measured': 'MEASURED',
    'calculated': 'CALCULATED',
    'simulated': 'SIMULATED',
    'user-reported': 'USER-REPORTED',
    'heuristic': 'HEURISTIC',
    'interpretation': 'INTERPRETATION'
  };
  const EMPIRICAL_EVIDENCE = new Set(['measured','calculated','simulated']);

  function applyEvidenceLens(mode = state.lens) {
    state.lens = mode === 'empirical' ? 'empirical' : 'all';
    write(KEYS.lens, state.lens);
    document.body.dataset.evidenceLens = state.lens;
    ['#evidenceLens','#mobileEvidenceLens'].forEach(selector => { const select=$(selector); if(select) select.value=state.lens; });
    $$('.evidence-layer').forEach(el => {
      const types = String(el.dataset.evidence || '').split(/\s+/).filter(Boolean);
      const visible = state.lens === 'all' || types.some(type => EMPIRICAL_EVIDENCE.has(type));
      el.classList.toggle('lens-hidden', !visible);
      el.setAttribute('aria-hidden', visible ? 'false' : 'true');
    });
  }

  function downloadJson(filename, payload) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function renderPatternDetail(item) {
    const box=$('#patternDetail'); if(!box) return;
    if(!item){ box.innerHTML='<p class="eyebrow">PATTERN PASSPORT</p><h2>Ei valintaa</h2><p>Valitse mekanismi kartalta tai listasta.</p>'; return; }
    const related=(item.related||[]).map(id=>window.BHCPatternLibrary?.passport?.(id)?.name||id);
    box.innerHTML='';
    const eye=document.createElement('p');eye.className='eyebrow';eye.textContent=`${String(item.family||'pattern').toUpperCase()} · ${String(item.detector||'atlas').toUpperCase()}`;
    const h=document.createElement('h2');h.textContent=item.name;
    const desc=document.createElement('p');desc.textContent=item.desc;
    const limit=document.createElement('div');limit.className='epistemic-brake';limit.innerHTML='<b>Episteminen raja:</b> ';limit.append(document.createTextNode(item.limit||'Tämä passport ei itsessään osoita intentiota tai kausaliteettia.'));
    const domains=document.createElement('div');domains.className='pattern-domain-tags';(item.domains||[]).forEach(d=>domains.append(tag(d)));
    const rtitle=document.createElement('h3');rtitle.textContent='Rakenteellisesti lähellä';
    const rel=document.createElement('div');rel.className='pattern-domain-tags';(related.length?related:['Ei eksplisiittisiä related-linkkejä']).forEach(d=>rel.append(tag(d)));
    const ftitle=document.createElement('h3');ftitle.textContent='Vapaaehtoisia kitkaideoita';
    const flist=document.createElement('ul');flist.className='atlas-friction-list';(item.friction||[]).forEach(x=>{const li=document.createElement('li');li.textContent=x;flist.append(li)});
    const btn=document.createElement('button');btn.type='button';btn.className='primary-button wide';btn.textContent='Tee tästä Friction Rule';btn.addEventListener('click',()=>{
      navigate('friction'); $('#frictionTriggerType').value='pattern'; syncFrictionTriggerUi(); populateFrictionPatterns(); $('#frictionPattern').value=item.id; $('#frictionName').value=`${item.name} · kitka`; $('#frictionPrompt').value=(item.friction||[])[0]||'Mitä huomaat ennen kuin jatkat?'; $('#frictionRuleForm').scrollIntoView({behavior:document.body.classList.contains('reduce-motion')?'auto':'smooth',block:'start'});
    });
    box.append(eye,h,desc,limit,domains,rtitle,rel,ftitle,flist,btn);
  }

  function drawPatternAtlas() {
    const lib=window.BHCPatternLibrary, canvas=$('#patternAtlasCanvas'); if(!lib||!canvas)return;
    const graph=lib.graph(); const ctx=canvas.getContext('2d'); const rect=canvas.getBoundingClientRect(); const d=Math.min(devicePixelRatio||1,2); const cssW=Math.max(320,rect.width||1100),cssH=Math.max(360,Math.min(560,cssW*.52));
    canvas.width=Math.round(cssW*d);canvas.height=Math.round(cssH*d);canvas.style.height=`${cssH}px`;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,cssW,cssH);
    const bg=ctx.createRadialGradient(cssW*.5,cssH*.45,0,cssW*.5,cssH*.45,Math.max(cssW,cssH)*.7);bg.addColorStop(0,'rgba(22,117,167,.12)');bg.addColorStop(1,'rgba(2,7,13,0)');ctx.fillStyle=bg;ctx.fillRect(0,0,cssW,cssH);
    const families=[...new Set(graph.nodes.map(n=>n.family))]; const familyAngles=new Map(families.map((f,i)=>[f,(Math.PI*2*i/families.length)-Math.PI/2]));
    const nodes=graph.nodes.map((n,i)=>{const base=familyAngles.get(n.family)||0; const peers=graph.nodes.filter(x=>x.family===n.family); const pi=peers.findIndex(x=>x.id===n.id); const spread=(pi-(peers.length-1)/2)*.18; const angle=base+spread; const radius=Math.min(cssW,cssH)*(.28+(i%2)*.025); return {...n,x:cssW/2+Math.cos(angle)*radius,y:cssH/2+Math.sin(angle)*radius,r: n.id===state.selectedPatternId?28:22};});
    const byId=new Map(nodes.map(n=>[n.id,n]));
    graph.edges.forEach(e=>{const a=byId.get(e.source),b=byId.get(e.target);if(!a||!b)return;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=e.reasons.includes('related')?'rgba(217,174,85,.36)':'rgba(88,220,255,.15)';ctx.lineWidth=Math.min(3,.6+e.weight*.45);ctx.stroke();});
    nodes.forEach(n=>{const selected=n.id===state.selectedPatternId;ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,Math.PI*2);ctx.fillStyle=selected?'rgba(217,174,85,.24)':'rgba(4,20,31,.94)';ctx.fill();ctx.strokeStyle=selected?'#d9ae55':'#58dcff';ctx.lineWidth=selected?2.5:1.3;ctx.stroke();ctx.fillStyle=selected?'#fff3cf':'#e9f8ff';ctx.font=`${selected?'800':'700'} 12px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';const label=n.name.length>18?n.name.slice(0,16)+'…':n.name;ctx.fillText(label,n.x,n.y);});
    state.patternNodePositions=nodes; if($('#atlasEdgeCount'))$('#atlasEdgeCount').textContent=`${graph.edges.length} LINKS`;
  }

  function renderPatternAtlas() {
    const lib = window.BHCPatternLibrary;
    const grid = $('#patternAtlasGrid'); const family=$('#patternFamily'); const stats=$('#patternStats');
    if (!lib || !grid || !family || !stats) return;
    const manifest=lib.manifest(), atlas=manifest.atlas||[], graph=manifest.graph||lib.graph();
    if(!family.dataset.ready){[...new Set(atlas.map(x=>x.family))].sort().forEach(name=>{const option=document.createElement('option');option.value=name;option.textContent=name;family.append(option)});family.dataset.ready='1';}
    const q=($('#patternSearch')?.value||'').trim().toLowerCase(),f=family.value; const rows=atlas.filter(x=>(!f||x.family===f)&&(!q||JSON.stringify(x).toLowerCase().includes(q)));
    if(!state.selectedPatternId || !atlas.some(x=>x.id===state.selectedPatternId)) state.selectedPatternId=rows[0]?.id||atlas[0]?.id||null;
    stats.textContent=`${rows.length}/${atlas.length} passportia · ${manifest.scanPatterns.length} tekstidetektoria · ${graph.edges.length} rakenteellista linkkiä`;
    grid.innerHTML='';
    rows.forEach(x=>{const card=document.createElement('article');card.className='panel pattern-passport';card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-pressed',String(x.id===state.selectedPatternId));
      const head=document.createElement('div');head.className='pattern-passport-head';const title=document.createElement('div');const p=document.createElement('p');p.className='eyebrow';p.textContent=x.family.toUpperCase();const h=document.createElement('h2');h.textContent=x.name;title.append(p,h);const detector=document.createElement('span');detector.className='status-badge '+(x.detector==='atlas-only'?'gold':'cyan');detector.textContent=x.detector.toUpperCase();head.append(title,detector);
      const desc=document.createElement('p');desc.textContent=x.desc;const tags=document.createElement('div');tags.className='pattern-domain-tags';x.domains.forEach(d=>tags.append(tag(d)));const limit=document.createElement('small');limit.className='passport-limit';limit.textContent=x.limit;
      const choose=()=>{state.selectedPatternId=x.id;renderPatternDetail(x);renderPatternAtlas();};card.addEventListener('click',choose);card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});card.append(head,desc,tags,limit);grid.append(card);});
    renderPatternDetail(lib.passport(state.selectedPatternId)); drawPatternAtlas();
  }
  $('#patternSearch')?.addEventListener('input', renderPatternAtlas);
  $('#patternFamily')?.addEventListener('change', renderPatternAtlas);
  $('#patternAtlasCanvas')?.addEventListener('click',e=>{const c=e.currentTarget,r=c.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const node=(state.patternNodePositions||[]).find(n=>Math.hypot(n.x-x,n.y-y)<=n.r+8);if(node){state.selectedPatternId=node.id;renderPatternAtlas();}});


  function renderModuleRegistry() {
    const core = window.BHCXrayCore;
    const listEl = $('#moduleRegistryList');
    if (!core || !listEl) return;
    const test = core.selfTest();
    $('#coreHealth').textContent = test.ok ? 'PASS' : 'CHECK';
    $('#coreHealth').classList.toggle('warn-text', !test.ok);
    $('#coreCount').textContent = `${test.count} modules · API v${core.API_VERSION}`;
    $('#moduleMetric').textContent = `${test.count} / ${test.count}`;
    listEl.innerHTML = '';
    core.list().forEach(m => {
      const row = document.createElement('div');
      row.className = 'registry-row';
      const identity = document.createElement('div');
      const title = document.createElement('b'); title.textContent = m.label;
      const meta = document.createElement('small'); meta.textContent = `${m.id} · v${m.version}`;
      identity.append(title, meta);
      const caps = document.createElement('div'); caps.className = 'registry-caps';
      m.evidence.forEach(type => {
        const tag = document.createElement('span');
        tag.className = `evidence-badge ${type}`;
        tag.textContent = EVIDENCE_LABELS[type] || type.toUpperCase();
        caps.append(tag);
      });
      row.append(identity, caps);
      listEl.append(row);
    });
    const patternTest = window.BHCPatternLibrary?.selfTest?.();
    if ($('#patternHealth') && patternTest) {
      $('#patternHealth').textContent = patternTest.ok ? 'PASS' : 'CHECK';
      $('#patternCount').textContent = `${patternTest.scanCount} scan · ${patternTest.atlasCount} passports`;
    }
    const frictionTest = window.BHCFrictionCore?.selfTest?.();
    if ($('#frictionHealth') && frictionTest) {
      $('#frictionHealth').textContent = frictionTest.ok ? 'PASS' : 'CHECK';
      $('#frictionCountEngine').textContent = `${state.frictionRules.length} local rules · core v${frictionTest.version}`;
    }
    const outcomeTest = window.BHCOutcomeCore?.selfTest?.();
    if ($('#outcomeHealth') && outcomeTest) { $('#outcomeHealth').textContent=outcomeTest.ok?'PASS':'CHECK'; $('#outcomeCountEngine').textContent=`${state.outcomes.length} outcomes · core v${outcomeTest.version}`; }
    const vaultTest = window.BHCVaultCore?.selfTest?.();
    if ($('#vaultEngineHealth') && vaultTest) { $('#vaultEngineHealth').textContent=vaultTest.ok?'PASS':'CHECK'; $('#vaultEngineCount').textContent=`schema v${vaultTest.schemaVersion} · ${vaultTest.format}`; }
    const oddsTest = window.BHCOddsCore?.selfTest?.();
    if ($('#oddsHealth') && oddsTest) { $('#oddsHealth').textContent=oddsTest.ok?'PASS':'CHECK'; $('#oddsCountEngine').textContent=`overround · lottery · pari-mutuel · v${oddsTest.version}`; }
    const marketTest = window.BHCMarketCore?.selfTest?.();
    if ($('#marketHealth') && marketTest) { $('#marketHealth').textContent=marketTest.ok?'PASS':'CHECK'; $('#marketCountEngine').textContent=`random walk · cost drag · leverage · v${marketTest.version}`; }
    log(`Module Core self-test ${test.ok ? 'PASS' : 'CHECK'} · ${test.count} modules`);
    if (patternTest) log(`Pattern Library self-test ${patternTest.ok ? 'PASS' : 'CHECK'} · ${patternTest.scanCount} scan patterns`);
    if (frictionTest) log(`Friction Core self-test ${frictionTest.ok ? 'PASS' : 'CHECK'} · ${state.frictionRules.length} local rules`);
    if (outcomeTest) log(`Outcome Core self-test ${outcomeTest.ok ? 'PASS' : 'CHECK'} · ${state.outcomes.length} outcomes`);
    if (vaultTest) log(`Vault Core self-test ${vaultTest.ok ? 'PASS' : 'CHECK'} · schema ${vaultTest.schemaVersion}`);
    if (oddsTest) log(`Odds Core self-test ${oddsTest.ok ? 'PASS' : 'CHECK'} · v${oddsTest.version}`);
    if (marketTest) log(`Market Core self-test ${marketTest.ok ? 'PASS' : 'CHECK'} · v${marketTest.version}`);
    if (!test.ok) test.problems.forEach(problem => log(`CORE: ${problem}`));
  }

  // No app code should initiate external network connections.
  const denyNetwork = (name) => (...args) => { throw new Error(`BHC X-Ray APP EGRESS 0: ${name} blocked`); };
  try {
    window.fetch = denyNetwork('fetch');
    navigator.sendBeacon = denyNetwork('sendBeacon');
    window.WebSocket = function () { throw new Error('BHC X-Ray APP EGRESS 0: WebSocket blocked'); };
    window.EventSource = function () { throw new Error('BHC X-Ray APP EGRESS 0: EventSource blocked'); };
  } catch (_) {}

  const toast = (message) => {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 2600);
  };

  const log = (message) => {
    const el = $('#engineLog');
    if (!el) return;
    const line = document.createElement('div');
    line.textContent = `[${new Date().toLocaleTimeString('fi-FI')}] ${message}`;
    el.prepend(line);
    while (el.children.length > 28) el.lastElementChild.remove();
  };

  function updateMetrics() {
    $('#journalCountMetric').textContent = String(state.journal.length);
    $('#journalSummaryTitle').textContent = `${state.journal.length} merkintää`;
    $('#lastCasinoMetric').textContent = state.metrics.lastCasinoNet == null ? '—' : euro(state.metrics.lastCasinoNet);
    $('#lastScanMetric').textContent = state.metrics.lastScanCount == null ? '—' : String(state.metrics.lastScanCount);
    $('#networkMetric').textContent = navigator.onLine ? 'LOCAL UI' : 'OFFLINE';
    $('#storageMetric').textContent = storageAvailable() ? 'READY' : 'BLOCKED';
  }

  function storageAvailable() {
    try {
      const k = '__bhc_xray_test__'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return true;
    } catch { return false; }
  }

  function navigate(route) {
    const registryAllows = route === 'home' || route === 'settings' || !!window.BHCXrayCore?.list().find(module => module.route === route);
    if (!registryAllows) route = 'home';
    const target = $(`.screen[data-screen="${route}"]`) || $('.screen[data-screen="home"]');
    $$('.screen').forEach(s => s.classList.toggle('active', s === target));
    $$('.main-nav a').forEach(a => a.classList.toggle('active', a.dataset.route === target.dataset.screen));
    $$('#mobileNav a').forEach(a => {
      if (a.dataset.route === target.dataset.screen) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.body.dataset.screen = target.dataset.screen;
    if (location.hash !== `#${target.id}`) history.replaceState(null, '', `#${target.id}`);
    closeMobileNav(false);
    target.scrollIntoView({ block: 'start' });
    $('#mainContent').focus({ preventScroll: true });
    if (route === 'journal') renderJournal();
    if (route === 'dependency') renderDependencyAnalysis(false);
    if (route === 'calm') resizeCalmCanvas();
    if (route === 'patterns') renderPatternAtlas();
    if (route === 'friction') renderFrictionLab();
    if (route === 'outcomes') renderOutcomeLab();
    if (route === 'vault') renderVault();
  }

  function routeFromHash() {
    const id = location.hash.replace('#', '') || 'home';
    const screen = $(`#${CSS.escape(id)}`)?.dataset.screen || id;
    navigate(screen);
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-route]');
    if (!link) return;
    event.preventDefault();
    navigate(link.dataset.route);
  });
  window.addEventListener('hashchange', routeFromHash);


  const onEvidenceLensChange = (e) => {
    applyEvidenceLens(e.target.value);
    toast(e.target.value === 'empirical' ? 'Näytetään MEASURED · CALCULATED · SIMULATED.' : 'Näytetään kaikki X-Ray Lens -kerrokset.');
    log(`X-Ray Lens · ${e.target.value}`);
  };
  $('#evidenceLens')?.addEventListener('change', onEvidenceLensChange);
  $('#mobileEvidenceLens')?.addEventListener('change', onEvidenceLensChange);

  $('#runCoreSelfTest')?.addEventListener('click', () => {
    const test = window.BHCXrayCore?.selfTest();
    const universalTest = window.BHCUniversalCore?.selfTest?.();
    const patternTest = window.BHCPatternLibrary?.selfTest?.();
    const vaultTest = window.BHCVaultCore?.selfTest?.();
    if (!test) return toast('Module Core ei ole käytettävissä.');
    renderModuleRegistry();
    if (universalTest) log(`Universal Core self-test ${universalTest.ok ? 'PASS' : 'CHECK'} · ${universalTest.problems.length} problems`);
    if (patternTest) log(`Pattern Library self-test ${patternTest.ok ? 'PASS' : 'CHECK'} · ${patternTest.problems.length} problems`);
    if (vaultTest) log(`Vault Core self-test ${vaultTest.ok ? 'PASS' : 'CHECK'} · ${vaultTest.problems.length} problems`);
    const ok = test.ok && (!universalTest || universalTest.ok) && (!patternTest || patternTest.ok) && (!vaultTest || vaultTest.ok);
    toast(ok ? `Core PASS · modules ${test.count}/${test.count} · Universal + Patterns + Vault PASS` : `Core CHECK · katso Engine Room`);
  });
  $('#exportRegistry')?.addEventListener('click', () => {
    const manifest = window.BHCXrayCore?.manifest();
    if (!manifest) return toast('Registry ei ole käytettävissä.');
    downloadJson(`BHC_XRAY_MODULE_REGISTRY_${VERSION}.json`, manifest);
    log('Module Registry exported');
  });

  function openMobileNav() {
    if (window.matchMedia('(min-width: 901px)').matches) return;
    const nav = $('#mobileNav');
    nav.hidden = false;
    nav.setAttribute('aria-hidden','false');
    $('#mobileNavBackdrop').hidden = false;
    $('#menuToggle').setAttribute('aria-expanded', 'true');
    document.body.classList.add('mobile-nav-open');
    requestAnimationFrame(() => nav.querySelector('a[aria-current="page"], a')?.focus());
  }
  function closeMobileNav(returnFocus = true) {
    const nav = $('#mobileNav');
    const wasOpen = !nav.hidden;
    nav.hidden = true;
    nav.setAttribute('aria-hidden','true');
    $('#mobileNavBackdrop').hidden = true;
    $('#menuToggle').setAttribute('aria-expanded', 'false');
    document.body.classList.remove('mobile-nav-open');
    if (returnFocus && wasOpen) $('#menuToggle').focus();
  }
  $('#menuToggle').addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); $('#mobileNav').hidden ? openMobileNav() : closeMobileNav(); });
  $('#mobileNavClose')?.addEventListener('click', () => closeMobileNav());
  $('#mobileNavBackdrop').addEventListener('click', () => closeMobileNav());
  window.addEventListener('resize', () => { if (window.innerWidth > 900) closeMobileNav(false); });

  // Engine Room
  function openEngine(trigger = document.activeElement) {
    state.engineReturnFocus = trigger;
    $('#engineDrawer').classList.add('open');
    $('#engineDrawer').setAttribute('aria-hidden', 'false');
    $('#drawerBackdrop').hidden = false;
    document.body.dataset.skin = 'off';
    document.body.classList.add('engine-open');
    $('#skinToggle').setAttribute('aria-pressed', 'true');
    $('#closeEngine').focus();
    log(`Engine Room opened · v${VERSION}`);
  }
  function closeEngine() {
    $('#engineDrawer').classList.remove('open');
    $('#engineDrawer').setAttribute('aria-hidden', 'true');
    $('#drawerBackdrop').hidden = true;
    document.body.classList.remove('engine-open');
    if (!state.settings.skinDefault) document.body.dataset.skin = 'on';
    $('#skinToggle').setAttribute('aria-pressed', String(document.body.dataset.skin === 'off'));
    state.engineReturnFocus?.focus?.();
  }
  $('#skinToggle').addEventListener('click', (e) => $('#engineDrawer').classList.contains('open') ? closeEngine() : openEngine(e.currentTarget));
  $('#openEngine').addEventListener('click', (e) => openEngine(e.currentTarget));
  $('#closeEngine').addEventListener('click', closeEngine);
  $('#drawerBackdrop').addEventListener('click', closeEngine);
  $('#engineSettings').addEventListener('click', closeEngine);
  function focusables(root) {
    return $$('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])', root).filter(el => !el.hidden && el.getClientRects().length);
  }
  document.addEventListener('keydown', e => {
    const drawerOpen = $('#engineDrawer').classList.contains('open');
    const menuOpen = !$('#mobileNav').hidden;
    if (e.key === 'Escape') {
      if (drawerOpen) return closeEngine();
      if (menuOpen) return closeMobileNav();
    }
    if (e.key !== 'Tab') return;
    const root = drawerOpen ? $('#engineDrawer') : menuOpen ? $('#mobileNav') : null;
    if (!root) return;
    const items = focusables(root); if (!items.length) return;
    const first=items[0], last=items[items.length-1];
    if (e.shiftKey && document.activeElement===first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement===last) { e.preventDefault(); first.focus(); }
  });

  // Casino X-Ray 2.0
  const casinoCanvas = $('#casinoChart');
  function drawLineChart(canvas, series, opts = {}) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#020a11'; ctx.fillRect(0, 0, w, h);
    const pad = 48;
    const values = series.flatMap(s => s.points.map(p => p.y)).filter(Number.isFinite);
    if (!values.length) {
      ctx.fillStyle = '#6f93a9'; ctx.font = '22px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Ei dataa', w/2, h/2); return;
    }
    let min = Math.min(...values), max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const xMax = Math.max(...series.flatMap(s => s.points.map(p => p.x)));
    ctx.strokeStyle = 'rgba(88,220,255,.11)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
      const y = pad + (h - pad*2) * i/5;
      ctx.beginPath(); ctx.moveTo(pad,y); ctx.lineTo(w-pad,y); ctx.stroke();
    }
    series.forEach((seriesItem, idx) => {
      ctx.strokeStyle = seriesItem.color || (idx === 0 ? '#58dcff' : '#d9ae55');
      ctx.lineWidth = 3; ctx.beginPath();
      seriesItem.points.forEach((point, i) => {
        const x = pad + (w - pad*2) * (point.x / (xMax || 1));
        const y = h - pad - (h - pad*2) * ((point.y - min) / (max - min));
        if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }); ctx.stroke();
    });
    ctx.fillStyle = '#86a8bb'; ctx.font = '16px system-ui'; ctx.textAlign = 'left';
    ctx.fillText(formatNum(max,0), 8, pad+4); ctx.fillText(formatNum(min,0), 8, h-pad+4);
  }
  drawLineChart(casinoCanvas, []);

  function casinoHouseEdge() {
    return Math.max(0, 100 - clamp(Number($('#casinoRtp').value) || 0, 0, 100));
  }
  function updateHouseEdgePreview() {
    $('#houseEdgePreview').textContent = `${formatNum(casinoHouseEdge(),1)} %`;
    updateSunkCost();
  }
  $('#casinoRtp').addEventListener('input', updateHouseEdgePreview);

  function formatDuration(minutes) {
    const m = Math.max(0, Number(minutes) || 0);
    if (m < 60) return `${formatNum(m,0)} min`;
    const hours = Math.floor(m / 60);
    const mins = Math.round(m % 60);
    return `${hours} h ${mins} min`;
  }

  $('#casinoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const rtp = Number($('#casinoRtp').value);
    const stake = Number($('#casinoStake').value);
    const spins = Number($('#casinoSpins').value);
    const requestedRuns = Number($('#casinoRuns').value);
    const bankroll = Number($('#casinoBankroll').value);
    const volatility = $('#casinoVolatility').value;
    const spinsPerMinute = Number($('#casinoSpeed').value);
    if (!(rtp > 0 && rtp <= 100 && stake > 0 && spins > 0 && requestedRuns > 0 && bankroll > 0 && spinsPerMinute > 0)) return toast('Tarkista simulaation arvot.');
    const runs = Math.max(1, Math.min(requestedRuns, Math.floor(5000000 / spins) || 1));
    if (runs < requestedRuns) toast(`Ajoerä rajattiin ${runs} rinnakkaiseen ajoon, jotta kokonaismäärä pysyy 5 miljoonassa kierroksessa.`);

    const status = $('#casinoRunStatus');
    status.textContent = 'AJETAAN'; status.className = 'status-badge cyan';
    log(`Casino 2.0 start · RTP ${rtp}% · ${spins} × ${runs} · ${volatility}`);
    const worker = new Worker('casino-worker.js');
    worker.onmessage = ({ data }) => {
      if (data.mode !== 'casino') return;
      $('#houseEdge').textContent = `${formatNum((1-data.targetRtp)*100,2)} %`;
      $('#theoreticalEv').textContent = euro(data.theoreticalNet);
      $('#simNet').textContent = euro(data.medianNet);
      $('#profitableRuns').textContent = `${data.profitableRuns}/${data.runs} (${formatNum(100*data.profitableRuns/data.runs,1)} %)`;
      $('#ruinRuns').textContent = `${data.ruinRuns}/${data.runs} (${formatNum(100*data.ruinRuns/data.runs,1)} %)`;
      $('#netRange').textContent = `${euro(data.p10Net)} → ${euro(data.p90Net)}`;
      $('#ldiwCount').textContent = `${formatNum(data.meanLdiw,0)} / ajo`;
      $('#sessionTime').textContent = formatDuration(data.count / spinsPerMinute);
      status.textContent = 'VALMIS'; status.className = 'status-badge gold';

      const theoreticalPoints = data.samples.map(point => ({ x: point.spin, y: data.start + (data.theoreticalNet * point.spin / data.count) }));
      drawLineChart(casinoCanvas, [
        { color:'#58dcff', points:data.samples.map(point => ({x:point.spin,y:point.balance})) },
        { color:'#d9ae55', points:theoreticalPoints }
      ]);

      $('#casinoInterpretation').innerHTML =
        `<span class="evidence-badge calculated">CALCULATED</span> House edge on <b>${formatNum((1-data.targetRtp)*100,2)} %</b> ja yhden ${formatNum(data.count,0)} kierroksen ajon teoreettinen nettotulos ${euro(data.theoreticalNet)}. ` +
        `<span class="evidence-badge simulated">SIMULATED</span> ${data.runs} synteettisessä ajossa mediaani oli <b>${euro(data.medianNet)}</b>; voitolle jäi ${data.profitableRuns}/${data.runs}. ` +
        `Yksi polku voi nousta tai laskea voimakkaasti. Volatiliteetti muuttaa jakaumaa, ei valittua RTP:tä.`;

      state.metrics.lastCasinoNet = data.medianNet; write(KEYS.metrics, state.metrics); updateMetrics();
      applyEvidenceLens();
      log(`Casino 2.0 done · median ${data.medianNet.toFixed(2)} · profitable ${data.profitableRuns}/${data.runs}`);
      worker.terminate();
    };
    worker.onerror = () => { status.textContent = 'VIRHE'; toast('Web Worker -simulaatio epäonnistui.'); worker.terminate(); };
    worker.postMessage({ mode:'casino', rtp, stake, spins, bankroll, runs, volatility });
  });

  $('#nearMissDemo').addEventListener('click', () => {
    $('#nearMissOutput').textContent = 'Ajetaan riippumattomuustestiä…';
    const worker = new Worker('casino-worker.js');
    worker.onmessage = ({data}) => {
      if (data.mode !== 'nearMiss') return;
      const ratio = data.baselineRate > 0 ? data.afterNearRate / data.baselineRate : NaN;
      $('#nearMissOutput').innerHTML =
        `<span class="evidence-badge simulated">SIMULATED</span> Seuraavan riippumattoman osuman taajuus near-missin jälkeen: <b>${formatNum(data.afterNearRate*100,3)} %</b>. ` +
        `Baseline: <b>${formatNum(data.baselineRate*100,3)} %</b>. Suhde ${Number.isFinite(ratio) ? formatNum(ratio,2) : '—'}×. ` +
        `Pieni ero kuuluu satunnaisvaihteluun; demossa next-spin-arvonta on riippumaton edellisestä visual labelista.`;
      log(`Near-miss independence demo · after ${data.afterNearRate.toFixed(6)} · base ${data.baselineRate.toFixed(6)}`);
      worker.terminate();
    };
    worker.postMessage({mode:'nearMiss', trials:200000});
  });

  function updateSunkCost() {
    const past = Math.max(0, Number($('#sunkPastLoss')?.value) || 0);
    const future = Math.max(0, Number($('#sunkFutureWager')?.value) || 0);
    const edge = casinoHouseEdge() / 100;
    if (!$('#sunkOutput')) return;
    const expectedExtraLoss = future * edge;
    const expectedPosition = -(past + expectedExtraLoss);
    $('#sunkOutput').innerHTML = `<span class="evidence-badge calculated">CALCULATED</span> Jo menetetty ${euro(past)} pysyy menneenä kustannuksena. Jos panostat vielä ${euro(future)} RTP:llä ${formatNum(100-edge*100,1)} %, lisäpanostuksen odotettu tappio on ${euro(expectedExtraLoss)} ja odotettu kokonaisasema ${euro(expectedPosition)}.`;
  }
  $('#sunkPastLoss')?.addEventListener('input', updateSunkCost);
  $('#sunkFutureWager')?.addEventListener('input', updateSunkCost);

  function updateReality() {
    const loss = Math.max(0, Number($('#realityLoss').value) || 0);
    const hv = Math.max(.01, Number($('#hourValue').value) || 1);
    $('#realityOutput').innerHTML = `<span class="evidence-badge calculated">CALCULATED</span> ${euro(loss)} = ${formatNum(loss/hv,1)} tuntia, jos oman tunnin arvoksi asetetaan ${euro(hv)}/h.`;
  }
  $('#realityLoss').addEventListener('input', updateReality); $('#hourValue').addEventListener('input', updateReality);

  // Odds X-Ray 1.10 · betting / lottery / racing mechanism bench
  const oddsCore = () => window.BHCOddsCore;
  const marketCore = () => window.BHCMarketCore;
  const pctText = (v, digits=2) => v == null || !Number.isFinite(Number(v)) ? '—' : `${formatNum(Number(v)*100,digits)} %`;

  function renderOddsMargin() {
    const core=oddsCore(); if(!core)return;
    const out=core.marketMargin($('#oddsMarketInput')?.value||'');
    const list=$('#oddsNormalizedList');
    if(!out.ok){ $('#oddsImpliedSum').textContent='—'; $('#oddsOverround').textContent='—'; $('#oddsPayoutProxy').textContent='—'; if(list) list.innerHTML=`<p class="empty-state">${escapeHtmlText(out.error)}</p>`; return; }
    $('#oddsImpliedSum').textContent=pctText(out.impliedSum,2);
    $('#oddsOverround').textContent=`${formatNum(out.overroundPct,2)} %`;
    $('#oddsPayoutProxy').textContent=pctText(out.quotedPayoutProxy,2);
    if(list){list.innerHTML='';out.rows.forEach((row,i)=>{const el=document.createElement('div');el.className='odds-row';el.innerHTML=`<b>${i+1}. kerroin ${formatNum(row.odds,2)}</b><span>raaka 1/odds ${pctText(row.rawImplied,2)}</span><span>normalisoitu ${pctText(row.normalized,2)}</span>`;list.append(el);});}
    applyEvidenceLens();
  }
  $('#oddsMarginForm')?.addEventListener('submit',e=>{e.preventDefault();renderOddsMargin();log('Odds X-Ray · overround recalculated');});

  function renderAcca(){
    const core=oddsCore(); if(!core)return;
    const out=core.accumulator({legProbability:(Number($('#accaLegProb')?.value)||0)/100,legs:Number($('#accaLegs')?.value)||1});
    $('#accaJoint').textContent=pctText(out.jointProbability,3);
    $('#accaMiss').textContent=pctText(out.atLeastOneMiss,3);
    $('#accaFairOdds').textContent=formatNum(out.fairJointDecimalOdds,2);
  }
  $('#accaForm')?.addEventListener('submit',e=>{e.preventDefault();renderAcca();log('Odds X-Ray · accumulator compounding calculated');});

  function renderLottery(){
    const core=oddsCore(); if(!core)return;
    const out=core.lottery({ticketPrice:$('#lotteryPrice')?.value,combinations:$('#lotteryCombos')?.value,jackpot:$('#lotteryJackpot')?.value,otherPrizeEv:$('#lotteryOtherEv')?.value});
    const oneIn=Math.max(1,Math.round(1/out.jackpotProbability));
    $('#lotteryProb').textContent=`1 / ${formatNum(oneIn,0)}`;
    $('#lotteryJackpotEv').textContent=euro(out.jackpotEv);
    $('#lotteryNetEv').textContent=euro(out.netEv);
    $('#lotteryReturn').textContent=pctText(out.returnRate,2);
  }
  $('#lotteryForm')?.addEventListener('submit',e=>{e.preventDefault();renderLottery();log('Odds X-Ray · lottery EV calculated');});

  function renderRacing(){
    const core=oddsCore(); if(!core)return;
    const out=core.pariMutuel({pool:$('#racingPool')?.value,takeoutPct:$('#racingTakeout')?.value,winningPoolSharePct:$('#racingWinnerShare')?.value,stake:$('#racingStake')?.value});
    $('#racingTakeoutAmount').textContent=euro(out.takeoutAmount);
    $('#racingNetPool').textContent=euro(out.netPool);
    $('#racingPayout').textContent=`${formatNum(out.payoutPerEuro,2)} ×`;
    $('#racingReturn').textContent=euro(out.exampleGrossReturn);
  }
  $('#racingForm')?.addEventListener('submit',e=>{e.preventDefault();renderRacing();log('Odds X-Ray · pari-mutuel pool calculated');});

  // Market X-Ray 1.10 · synthetic candles, null baseline, costs and leverage
  const marketCanvas=$('#marketCandleChart');
  let lastMarketCandles=[];
  function drawCandles(canvas,candles){
    if(!canvas)return;const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#020a11';ctx.fillRect(0,0,w,h);
    const arr=Array.isArray(candles)?candles:[];if(!arr.length){ctx.fillStyle='#6f93a9';ctx.font='22px system-ui';ctx.textAlign='center';ctx.fillText('Ei dataa',w/2,h/2);return;}
    const pad=42,min=Math.min(...arr.map(c=>c.low)),max=Math.max(...arr.map(c=>c.high)),span=Math.max(1e-12,max-min);const slot=(w-pad*2)/arr.length,body=Math.max(1,Math.min(8,slot*.62));
    ctx.strokeStyle='rgba(88,220,255,.08)';ctx.lineWidth=1;for(let i=0;i<=5;i++){const y=pad+(h-pad*2)*i/5;ctx.beginPath();ctx.moveTo(pad,y);ctx.lineTo(w-pad,y);ctx.stroke();}
    const yOf=v=>h-pad-(h-pad*2)*((v-min)/span);
    arr.forEach((c,i)=>{const x=pad+slot*(i+.5),yo=yOf(c.open),yc=yOf(c.close),yh=yOf(c.high),yl=yOf(c.low),green=c.close>=c.open;const color=green?'#72f4bd':'#ff6b73';ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,yh);ctx.lineTo(x,yl);ctx.stroke();const top=Math.min(yo,yc),bh=Math.max(1,Math.abs(yc-yo));ctx.fillRect(x-body/2,top,body,bh);});
    ctx.fillStyle='#86a8bb';ctx.font='15px system-ui';ctx.textAlign='left';ctx.fillText(formatNum(max,2),6,pad+4);ctx.fillText(formatNum(min,2),6,h-pad+4);
  }
  drawCandles(marketCanvas,[]);

  function generateMarketCandles(){
    const core=marketCore();if(!core)return;
    const steps=Number($('#marketSteps')?.value)||240,volatilityPct=Number($('#marketVol')?.value)||1;
    let seed=Date.now()>>>0;try{seed=crypto.getRandomValues(new Uint32Array(1))[0];}catch{}
    lastMarketCandles=core.simulateCandles({steps,volatilityPct,seed});const st=core.candleStats(lastMarketCandles);drawCandles(marketCanvas,lastMarketCandles);
    $('#marketTotalReturn').textContent=pctText(st.totalReturn,2);$('#marketDrawdown').textContent=pctText(st.maxDrawdown,2);$('#marketGreenRate').textContent=pctText(st.baselineGreenRate,2);$('#marketGreenRun').textContent=String(st.longestGreenRun);
    $('#marketCandleReadout').innerHTML=`<span class="evidence-badge simulated">SIMULATED</span> Seed ${seed}. Sarjassa löytyi <b>${st.threeGreenN}</b> kohtaa, joissa kolme vihreää kynttilää edelsi seuraavaa kynttilää. Tässä yhdessä satunnaissarjassa seuraava kynttilä oli vihreä ${st.afterThreeGreenRate==null?'—':pctText(st.afterThreeGreenRate,1)} niistä. Yksi chartti ei riitä edge-väitteeseen.`;
    applyEvidenceLens();
  }
  $('#marketCandleForm')?.addEventListener('submit',e=>{e.preventDefault();generateMarketCandles();log('Market X-Ray · synthetic candle path generated');});

  $('#marketNullRun')?.addEventListener('click',()=>{
    const core=marketCore();if(!core)return;const vol=Number($('#marketVol')?.value)||1;const out=core.patternNullExperiment({paths:250,steps:360,volatilityPct:vol,seed:(Date.now()>>>0)});
    $('#marketNullBase').textContent=pctText(out.baselineGreenRate,2);$('#marketNullAfter').textContent=pctText(out.afterThreeGreenRate,2);$('#marketNullDiff').textContent=out.difference==null?'—':`${out.difference>=0?'+':''}${formatNum(out.difference*100,2)} %-yks.`;$('#marketNullN').textContent=formatNum(out.threeGreenN,0);
    log(`Market null lab · ${out.paths} paths · difference ${(out.difference||0).toFixed(4)}`);
  });

  function renderMarketCost(){
    const core=marketCore();if(!core)return;const out=core.costDrag({capital:$('#marketCapital')?.value,tradesPerDay:$('#marketTradesDay')?.value,days:$('#marketDays')?.value,turnoverPct:$('#marketTurnover')?.value,spreadBps:$('#marketSpread')?.value,feeBps:$('#marketFees')?.value,slippageBps:$('#marketSlippage')?.value});
    $('#marketNotional').textContent=euro(out.totalNotional);$('#marketCostDrag').textContent=euro(out.cost);$('#marketCostPct').textContent=out.costPctOfCapital==null?'—':pctText(out.costPctOfCapital,2);
  }
  $('#marketCostForm')?.addEventListener('submit',e=>{e.preventDefault();renderMarketCost();log('Market X-Ray · transaction friction calculated');});

  function renderMarketLeverage(){
    const core=marketCore();if(!core)return;const out=core.leverageRisk({capital:$('#marketLevCapital')?.value,leverage:$('#marketLeverage')?.value,adverseMovePct:$('#marketAdverseMove')?.value});
    $('#marketNotionalLev').textContent=euro(out.notional);$('#marketLevPnl').textContent=euro(out.pnl);$('#marketLevEquity').textContent=euro(out.equityAfter);$('#marketWipeMove').textContent=`~${formatNum(out.approxWipeMovePct,2)} %`;
  }
  $('#marketLeverageForm')?.addEventListener('submit',e=>{e.preventDefault();renderMarketLeverage();log('Market X-Ray · leverage sensitivity calculated');});

  $('#marketHypeForm')?.addEventListener('submit',e=>{
    e.preventDefault();const text=$('#marketHypeText')?.value.trim()||'';const box=$('#marketHypeOutput');if(!text){box.innerHTML='<p class="empty-state">Liitä teksti ensin.</p>';return;}
    const analysis=window.BHCUniversalCore?.analyze?.(text,'trading');if(!analysis){box.innerHTML='<p class="empty-state">Universal Core ei ole käytettävissä.</p>';return;}
    const hits=analysis.patternHits||[];box.innerHTML='';if(!hits.length)box.innerHTML='<p class="empty-state">Ei osumia trading-linssin sanaston mukaan. Tämä ei tarkoita, että väite olisi tosi tai hyvä.</p>';
    hits.forEach(x=>{const row=document.createElement('div');row.className='pattern-row';const left=document.createElement('div');const b=document.createElement('b');b.textContent=x.name;const small=document.createElement('small');small.textContent=x.desc||'';left.append(b,small);const count=document.createElement('span');count.textContent=`× ${x.count}`;row.append(left,count);box.append(row);});
    const gaps=analysis.uncertainties?.length||0;const note=document.createElement('div');note.className='strip-result';note.innerHTML=`<span class="evidence-badge heuristic">HEURISTIC</span> ${hits.length} pattern-luokkaa · ${gaps} tarkistuskohtaa. Pattern-osuma ei todista ennustearvoa, intentiota tai sitä, että vastakkainen markkinanäkemys olisi oikea.`;box.append(note);applyEvidenceLens();log(`Market hype X-Ray · ${hits.length} pattern groups`);
  });

  // Dependency Lab · loop hypothesis + longitudinal descriptive analysis
  $('#loopForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      category: $('#loopCategory').value,
      trigger: $('#loopTrigger').value.trim() || '—',
      urge: $('#loopUrge').value.trim() || '—',
      action: $('#loopAction').value.trim() || '—',
      reward: $('#loopReward').value.trim() || '—',
      cost: $('#loopCost').value.trim() || '—',
      createdAt: new Date().toISOString()
    };
    state.lastLoop = data;
    const nodes = $$('#loopMap .loop-node strong');
    [data.trigger, data.urge, data.action, data.reward, data.cost].forEach((v,i) => { if(nodes[i]) nodes[i].textContent = v; });
    state.loops.unshift(data); state.loops = state.loops.slice(0,50); write(KEYS.loops,state.loops);
    toast('Silmukkahypoteesi tallennettu paikallisesti.');
    log(`Dependency loop hypothesis mapped · ${data.category}`);
  });
  $('#saveLoop').addEventListener('click', () => {
    if (!state.lastLoop) return toast('Piirrä silmukkahypoteesi ensin.');
    const item = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      schemaVersion: 2,
      date: new Date().toISOString().slice(0,10),
      category: state.lastLoop.category,
      urge: null, mood: null, sleep: null,
      triggerGroup: '', trigger: state.lastLoop.trigger,
      acted: null, action: state.lastLoop.action,
      rewardScore: null, reward: state.lastLoop.reward,
      afterCost: null, afterEffect: state.lastLoop.cost,
      note: `Silmukkahypoteesi · urge: ${state.lastLoop.urge}`,
      createdAt: new Date().toISOString()
    };
    state.journal.push(item); state.journal.sort((a,b)=>String(a.date).localeCompare(String(b.date))); write(KEYS.journal,state.journal); updateMetrics(); renderDependencyAnalysis(false); toast('Silmukkahypoteesi siirrettiin Journaliin täydennettäväksi.');
  });

  const depStatusText = { insufficient:'EI RIITÄ', preliminary:'ALUSTAVA', descriptive:'KUVAILEVA', none:'EI HAVAITTAVAA', unstable:'EPÄVAKAA' };
  const depMagnitudeText = { none:'hyvin pieni', small:'pieni', moderate:'kohtalainen', large:'suuri' };
  function depEffect(v, digits=2) { return v == null || !Number.isFinite(v) ? '—' : Number(v).toFixed(digits).replace('.', ','); }
  function depNull(v) { return v == null || !Number.isFinite(v) ? '—' : `${Math.round(v*100)} %`; }
  function dependencyCard(test) {
    const card=document.createElement('article'); card.className='correlation-card evidence-layer'; card.dataset.evidence='calculated interpretation';
    const titles={sleep:'Uni ↔ urge',trigger:'Trigger-ryhmä ↔ urge','action-cost':'Toiminta ↔ jälkikustannus','reward-cost':'Palkkio ↔ jälkikustannus',weekday:'Viikonpäivä ↔ urge'};
    const descriptions={
      sleep: test.effect == null ? 'Ei riittävästi uni + urge -pareja.' : `${test.effect < 0 ? 'Enemmän unta liittyi tässä aineistossa matalampaan urgeen.' : 'Enemmän unta liittyi tässä aineistossa korkeampaan urgeen.'}`,
      trigger: test.top ? `Korkein ryhmäkeskiarvo: ${test.top[0]} (${depEffect(test.top[1],1)}/10).` : 'Tarvitaan vähintään kaksi trigger-ryhmää, joissa kummassakin on useampi havainto.',
      'action-cost': test.actedMean == null || test.notActedMean == null ? 'Tarvitaan sekä toteutuneita että toteutumatta jääneitä toimintoja jälkikustannusarviolla.' : `Jälkikustannus: toiminta toteutui ${depEffect(test.actedMean,1)}/10 · ei toteutunut ${depEffect(test.notActedMean,1)}/10.`,
      'reward-cost': test.effect == null ? 'Tarvitaan välitön palkkio + jälkikustannus -pareja.' : `${test.effect > 0 ? 'Suurempi välitön palkkio liittyi suurempaan myöhempään kustannukseen.' : 'Suurempi välitön palkkio liittyi pienempään myöhempään kustannukseen.'}`,
      weekday: test.effect == null ? 'Viikonpäiväkontrolliin ei ole riittävästi käyttökelpoisia havaintoja.' : 'Baseline-kontrolli: näkyykö urge-vaihtelua myös viikonpäivän mukaan?'
    };
    const h=document.createElement('div'); h.className='correlation-card-head';
    const title=document.createElement('h3'); title.textContent=titles[test.kind]||test.kind;
    const badge=document.createElement('span'); badge.className=`analysis-status ${test.classification}`; badge.textContent=depStatusText[test.classification]||test.classification;
    h.append(title,badge);
    const metrics=document.createElement('div'); metrics.className='correlation-metrics';
    [[test.effectLabel||'effect',depEffect(test.effect)],['N',String(test.n||0)],['SHIFT-NULL',depNull(test.shiftP)],['MAGNITUDE',depMagnitudeText[test.magnitude]||'—']].forEach(([k,v])=>{const d=document.createElement('div');const sp=document.createElement('span');sp.textContent=k;const b=document.createElement('strong');b.textContent=v;d.append(sp,b);metrics.append(d);});
    const pp=document.createElement('p'); pp.textContent=descriptions[test.kind]||'';
    const caveat=document.createElement('small'); caveat.textContent=test.classification==='insufficient'?'Ei tulkita ennen vähimmäis-N:ää.':test.classification==='none'?'Efekti jäi tässä aineistossa hyvin pieneksi.':test.classification==='unstable'?'Efekti ei erotu vakaasti circular-shift-nullista.':'Kuvaileva yhteys, ei kausaalinen väite.';
    card.append(h,metrics,pp,caveat); return card;
  }
  function renderDependencyAnalysis(announce = false) {
    const core=window.BHCDependencyLab; if(!core) return;
    const out=core.analyze(state.journal);
    if ($('#depN')) $('#depN').textContent=String(out.n);
    if ($('#depStatus')) $('#depStatus').textContent=out.status==='insufficient'?'KERÄÄ DATAA':out.status==='preliminary'?'ALUSTAVA':'KUVAILEVA';
    const eligible=out.tests.filter(t=>t.classification!=='insufficient').length;
    if ($('#depTestCount')) $('#depTestCount').textContent=`${eligible} / ${out.tests.length}`;
    if ($('#depDetectable')) $('#depDetectable').textContent=out.status==='insufficient'?'—':String(out.detectableCount);
    const msg=$('#dependencyAnalysisMessage');
    if (msg) {
      if (out.n < 14) msg.innerHTML=`<span class="evidence-badge calculated">CALCULATED</span> ${out.n}/14 merkintää. Kerää vielä ${14-out.n}, ennen kuin kone tekee alustavia vertailuja.`;
      else if (!eligible) msg.innerHTML='<span class="evidence-badge calculated">CALCULATED</span> Merkintöjä on riittävästi, mutta rakenteisia kenttiä ei vielä ole tarpeeksi yksittäisiin testeihin. Vanhat 1.1-merkinnät säilyvät, mutta niitä ei täydennetä arvaamalla.';
      else if (out.noDetectablePattern) msg.innerHTML='<span class="evidence-badge calculated">CALCULATED</span> <b>Ei havaittavaa toistuvaa rakennetta tässä aineistossa. Oe.</b> Testattavat efektit jäivät pieniksi tai epävakaiksi circular-shift-nulliin nähden.';
      else msg.innerHTML=`<span class="evidence-badge calculated">CALCULATED</span> ${out.detectableCount} kuvailevaa kuviota ${eligible} käyttökelpoisesta testistä. ${out.n < 30 ? 'Aineisto on vielä alustava.' : 'Aineisto ylittää 30 havainnon kuvailevan rajan.'} Ei kausaalipäätelmiä.`;
    }
    const grid=$('#dependencyTestGrid'); if(grid){ grid.innerHTML=''; out.tests.forEach(t=>grid.append(dependencyCard(t))); }
    if (announce) { toast(out.n<14?`Tarvitaan vielä ${14-out.n} Journal-merkintää.`:out.noDetectablePattern?'Ei havaittavaa toistuvaa rakennetta. Oe.':`Analyysi valmis · ${out.detectableCount} kuvailevaa kuviota.`); log(`Dependency Correlation Bench · n=${out.n} · detectable=${out.detectableCount}`); }
  }
  $('#runDependencyAnalysis')?.addEventListener('click',()=>renderDependencyAnalysis(true));

  // Impulse Breaker
  function stopTimer(message = 'Viive keskeytetty.') {
    if (state.timer) clearInterval(state.timer);
    state.timer = null; state.timerEnds = null;
    toast(message);
  }
  function renderTimer() {
    if (!state.timerEnds) return;
    const ms = Math.max(0, state.timerEnds - Date.now());
    const total = Math.ceil(ms/1000); const m = Math.floor(total/60), s = total%60;
    $('#timerText').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if (ms <= 0) {
      stopTimer('Viive valmis. Päätös on nyt taas sinun.');
      $('#timerText').textContent = '00:00';
      $('#timerAlternative').textContent += ' · Viive päättyi. Tarkista, onko alkuperäinen impulssi muuttunut.';
      log('Impulse Breaker completed');
    }
  }
  $('#impulseForm').addEventListener('submit', (e) => {
    e.preventDefault(); stopTimer('');
    const minutes = Number($('#impulseMinutes').value);
    const intent = $('#impulseIntent').value.trim();
    const alt = $('#impulseAlternative').value.trim() || 'Ei kirjattua vaihtoehtoa.';
    if (!intent) return toast('Kirjoita ensin mitä tekisi mieli tehdä.');
    $('#timerIntent').textContent = intent;
    $('#timerAlternative').textContent = `Vaihtoehto: ${alt}`;
    state.timerEnds = Date.now() + minutes*60*1000;
    state.timer = setInterval(renderTimer, 250); renderTimer();
    log(`Impulse Breaker started · ${minutes} min`);
  });
  $('#cancelTimer').addEventListener('click', () => stopTimer());

  // Friction Lab 1.5 · voluntary local decision friction
  const frictionCore = () => window.BHCFrictionCore;

  function populateFrictionPatterns() {
    const lib = window.BHCPatternLibrary;
    const selects = [$('#frictionPattern'), $('#frictionTestPattern')].filter(Boolean);
    if (!lib || !selects.length) return;
    const manifest = lib.manifest();
    const map=new Map(); (manifest.scanPatterns||[]).forEach(p=>map.set(p.id,{id:p.id,name:p.name,group:p.group,detector:'scan'})); (manifest.atlas||[]).forEach(p=>{if(!map.has(p.id))map.set(p.id,{id:p.id,name:p.name,group:p.family,detector:p.detector||'atlas-only'});});
    const patterns=[...map.values()].sort((a,b)=>a.name.localeCompare(b.name,'fi'));
    selects.forEach((select, index) => {
      const previous = select.value;
      const placeholder = index === 1 ? '<option value="">Ei patternia</option>' : '';
      select.innerHTML = placeholder + patterns.map(p => `<option value="${escapeHtmlAttr(p.id)}">${escapeHtmlText(p.name)} · ${escapeHtmlText(p.id)}${p.detector==='atlas-only'?' · ATLAS ONLY':''}</option>`).join('');
      if (previous && patterns.some(p=>p.id===previous)) select.value=previous;
    });
  }

  function escapeHtmlText(value) { return String(value ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
  function escapeHtmlAttr(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function syncFrictionTriggerUi() {
    const type = $('#frictionTriggerType')?.value || 'domain';
    const valueWrap = $('#frictionTriggerValueWrap');
    const patternWrap = $('#frictionPatternWrap');
    if (valueWrap) valueWrap.hidden = type !== 'domain';
    if (patternWrap) patternWrap.hidden = type !== 'pattern';
    if ($('#frictionTriggerValue')) $('#frictionTriggerValue').required = type === 'domain';
  }
  $('#frictionTriggerType')?.addEventListener('change', syncFrictionTriggerUi);

  function saveFrictionRules() {
    write(KEYS.friction, state.frictionRules);
    renderFrictionLab();
    renderModuleRegistry();
  }

  function frictionRuleTriggerLabel(rule) {
    if (rule.trigger.type === 'domain') return `DOMAIN · ${rule.trigger.value}`;
    if (rule.trigger.type === 'pattern') return `PATTERN · ${rule.trigger.value}`;
    return 'MANUAL';
  }

  function renderFrictionLab() {
    const core = frictionCore();
    if (!core) return;
    state.frictionRules = (Array.isArray(state.frictionRules) ? state.frictionRules : []).map(core.normalizeRule);
    const list = $('#frictionRuleList');
    if (list) {
      list.innerHTML='';
      if (!state.frictionRules.length) list.innerHTML='<p class="empty-state">Ei vielä sääntöjä.</p>';
      state.frictionRules.forEach(rule => {
        const row=document.createElement('article'); row.className='friction-rule';
        const main=document.createElement('div'); main.className='friction-rule-main';
        const head=document.createElement('div'); head.className='friction-rule-head';
        const title=document.createElement('div'); const b=document.createElement('b'); b.textContent=rule.name; const meta=document.createElement('small'); meta.textContent=frictionRuleTriggerLabel(rule); title.append(b,meta);
        const enabled=document.createElement('label'); enabled.className='switch-mini'; const cb=document.createElement('input'); cb.type='checkbox'; cb.checked=rule.enabled; cb.setAttribute('aria-label',`Kytke sääntö ${rule.name}`); const span=document.createElement('span'); span.textContent=rule.enabled?'ON':'OFF'; enabled.append(cb,span); head.append(title,enabled);
        const desc=document.createElement('p'); desc.textContent=`Viive ${rule.delayMinutes} min${rule.prompt?` · ${rule.prompt}`:''}`;
        const tags=document.createElement('div'); tags.className='pattern-domain-tags';
        if(rule.actions.showJournal) tags.append(tag('JOURNAL'));
        if(rule.actions.offerCalm) tags.append(tag('CALM'));
        if(rule.actions.requireConfirm) tags.append(tag('CONFIRM'));
        main.append(head,desc,tags);
        const del=document.createElement('button'); del.type='button'; del.className='icon-button tiny'; del.textContent='×'; del.setAttribute('aria-label',`Poista sääntö ${rule.name}`);
        cb.addEventListener('change',()=>{ rule.enabled=cb.checked; rule.updatedAt=new Date().toISOString(); saveFrictionRules(); });
        del.addEventListener('click',()=>{ state.frictionRules=state.frictionRules.filter(x=>x.id!==rule.id); saveFrictionRules(); toast('Kitkasääntö poistettu.'); });
        row.append(main,del); list.append(row);
      });
    }
    const active=state.frictionRules.filter(r=>r.enabled).length;
    if ($('#frictionRuleCount')) $('#frictionRuleCount').textContent=`${active} ACTIVE`;
    if ($('#frictionCountEngine')) $('#frictionCountEngine').textContent=`${state.frictionRules.length} local rules · core v${core.VERSION}`;
    populateFrictionPatterns(); syncFrictionTriggerUi();
  }

  $('#frictionRuleForm')?.addEventListener('submit', e => {
    e.preventDefault();
    const core=frictionCore(); if(!core) return;
    const type=$('#frictionTriggerType').value;
    const value=type==='pattern'?$('#frictionPattern').value:type==='domain'?$('#frictionTriggerValue').value.trim():'';
    if (type!=='manual' && !value) return toast('Valitse tai kirjoita laukaisin.');
    const rule=core.normalizeRule({
      name:$('#frictionName').value.trim(), trigger:{type,value}, delayMinutes:Number($('#frictionDelay').value), prompt:$('#frictionPrompt').value.trim(),
      actions:{ showJournal:$('#frictionShowJournal').checked, offerCalm:$('#frictionOfferCalm').checked, requireConfirm:$('#frictionRequireConfirm').checked }
    });
    state.frictionRules.push(rule); saveFrictionRules();
    e.currentTarget.reset(); $('#frictionDelay').value='5'; $('#frictionShowJournal').checked=true; $('#frictionOfferCalm').checked=true; $('#frictionRequireConfirm').checked=true; syncFrictionTriggerUi();
    toast('Kitkasääntö tallennettu paikallisesti.'); log(`Friction rule saved · ${rule.name}`);
  });

  $('#exportFrictionRules')?.addEventListener('click',()=>{
    const core=frictionCore(); if(!core) return;
    downloadJson(`BHC_XRAY_FRICTION_RULES_${VERSION}.json`,core.exportBundle(state.frictionRules));
    log(`Friction rules exported · ${state.frictionRules.length}`);
  });

  $('#importFrictionRules')?.addEventListener('change', async e => {
    const file=e.target.files?.[0]; if(!file) return;
    try {
      const payload=JSON.parse(await file.text()); const incoming=frictionCore().importBundle(payload);
      const byId=new Map(state.frictionRules.map(r=>[r.id,r])); incoming.forEach(r=>byId.set(r.id,r)); state.frictionRules=[...byId.values()]; saveFrictionRules(); toast(`${incoming.length} kitkasääntöä tuotu.`); log(`Friction rules imported · ${incoming.length}`);
    } catch(err){ toast(`Tuonti epäonnistui: ${err.message}`); }
    e.target.value='';
  });

  function journalSnapshot() {
    const rows=[...state.journal].slice(-7);
    const nums=(key)=>rows.map(r=>isFiniteValue(r[key])?Number(r[key]):null).filter(v=>v!=null);
    const avg=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
    const urge=avg(nums('urge')); const mood=avg(nums('mood')); const sleep=avg(nums('sleep')); const acted=rows.filter(r=>r.acted===true).length;
    return { n:rows.length, urge, mood, sleep, acted };
  }

  function renderFrictionSession(evalOut) {
    state.frictionEval=evalOut;
    const session=$('#frictionSession'); if(!session) return;
    session.hidden=false;
    const tags=$('#frictionMatchedRules'); tags.innerHTML=''; evalOut.rules.forEach(r=>tags.append(tag(r.name)));
    const prompts=$('#frictionPrompts'); prompts.innerHTML='';
    if(evalOut.prompts.length) evalOut.prompts.forEach(p=>{const block=document.createElement('blockquote'); block.textContent=p; prompts.append(block);});
    else { const p=document.createElement('p'); p.className='microcopy'; p.textContent='Ei erillistä tarkistuskysymystä. Pysähdys itsessään on tämän säännön kitka.'; prompts.append(p); }
    const snap=$('#frictionJournalSnapshot');
    snap.hidden=!evalOut.actions.showJournal;
    if(evalOut.actions.showJournal){ const x=journalSnapshot(); snap.innerHTML=`<span class="evidence-badge user-reported">USER-REPORTED</span> <b>Viimeiset ${x.n} Journal-havaintoa:</b> urge ${x.urge==null?'—':formatNum(x.urge,1)}/10 · mieliala ${x.mood==null?'—':formatNum(x.mood,1)}/10 · uni ${x.sleep==null?'—':formatNum(x.sleep,1)} h · toiminta toteutui ${x.acted}/${x.n}.`; }
    $('#frictionCalmLink').hidden=!evalOut.actions.offerCalm;
    $('#frictionConfirmWrap').hidden=!evalOut.actions.requireConfirm;
    $('#frictionConfirm').checked=false; $('#frictionReflection').value=''; if($('#frictionUrgeBefore')) $('#frictionUrgeBefore').value='';
    stopFrictionTimer();
    state.frictionEnds=Date.now()+evalOut.delayMinutes*60*1000;
    state.frictionTimer=setInterval(renderFrictionClock,250); renderFrictionClock(); updateFrictionContinue();
    session.scrollIntoView({behavior:document.body.classList.contains('reduce-motion')?'auto':'smooth',block:'start'});
  }

  function stopFrictionTimer(){ if(state.frictionTimer) clearInterval(state.frictionTimer); state.frictionTimer=null; }
  function renderFrictionClock(){
    const ms=Math.max(0,(state.frictionEnds||0)-Date.now()); const total=Math.ceil(ms/1000); const m=Math.floor(total/60), sec=total%60;
    if($('#frictionClock')) $('#frictionClock').textContent=`${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    if(ms<=0){ stopFrictionTimer(); updateFrictionContinue(); }
  }
  function updateFrictionContinue(){
    const out=state.frictionEval; if(!out) return;
    const timeOk=!state.frictionEnds || Date.now()>=state.frictionEnds;
    const confirmOk=!out.actions.requireConfirm || $('#frictionConfirm').checked;
    const btn=$('#frictionContinue'); if(btn){btn.disabled=!(timeOk&&confirmOk); btn.textContent=timeOk?'Jatka päätökseen':`Odota ${Math.max(0,Math.ceil((state.frictionEnds-Date.now())/60000))} min`;}
  }
  $('#frictionConfirm')?.addEventListener('change',updateFrictionContinue);

  function runFrictionContext(context, announce=true){
    const core=frictionCore(); if(!core) return null;
    const out=core.evaluate(context,state.frictionRules);
    const result=$('#frictionTestResult');
    if(!out.matched){ if(result) result.innerHTML='<span class="evidence-badge calculated">CALCULATED</span> Ei osuvaa kitkasääntöä tässä testikontekstissa.'; if(announce) toast('Ei osuvaa kitkasääntöä.'); return out; }
    if(result) result.innerHTML=`<span class="evidence-badge calculated">CALCULATED</span> <b>${out.matchedCount} sääntöä osui.</b> Yhdistetty viive ${out.delayMinutes} min · ${out.prompts.length} tarkistuskysymystä.`;
    renderFrictionSession(out); if(announce) toast(`${out.matchedCount} kitkasääntöä aktivoitui.`); log(`Friction session · ${out.matchedCount} rules · ${out.delayMinutes} min`); return out;
  }

  $('#runFrictionTest')?.addEventListener('click',()=>runFrictionContext({url:$('#frictionTestUrl').value.trim(),patternIds:[$('#frictionTestPattern').value].filter(Boolean),manual:$('#frictionTestManual').checked}));
  $('#frictionContinue')?.addEventListener('click',()=>{
    if($('#frictionContinue').disabled)return; const out=state.frictionEval; if(!out)return;
    const urgeRaw=$('#frictionUrgeBefore')?.value;
    state.pendingOutcome={ id:crypto.randomUUID?crypto.randomUUID():`session-${Date.now()}`, source:'friction', createdAt:new Date().toISOString(), ruleIds:out.ruleIds||[], ruleNames:(out.rules||[]).map(r=>r.name), patternIds:out.context?.patternIds||[], domain:out.context?.domain||'', delayMinutes:out.delayMinutes||0, urgeBefore:urgeRaw===''?null:Number(urgeRaw), reflection:$('#frictionReflection')?.value.trim()||'' };
    write(KEYS.pendingOutcome,state.pendingOutcome); toast('Kitka valmis. Kirjaa seuraavaksi mitä päätökselle tapahtui.'); log('Friction session completed · pending Outcome created'); stopFrictionTimer(); $('#frictionSession').hidden=true; state.frictionEval=null; navigate('outcomes'); renderOutcomeLab();
  });
  $('#frictionEnd')?.addEventListener('click',()=>{ stopFrictionTimer(); $('#frictionSession').hidden=true; state.frictionEval=null; toast('Kitkatesti lopetettu.'); });

  // Outcome Lab 1.7 · close the voluntary friction loop with descriptive follow-up
  const outcomeCore=()=>window.BHCOutcomeCore;
  const percent=v=>v==null?'—':`${formatNum(v*100,1)} %`;
  function saveOutcomes(){ write(KEYS.outcomes,state.outcomes); renderOutcomeLab(); renderModuleRegistry(); }
  function renderOutcomeGroup(target, rows){
    const box=$(target); if(!box)return; box.innerHTML='';
    if(!rows?.length){box.innerHTML='<p class="empty-state">Ei ryhmiä vielä.</p>';return;}
    rows.slice(0,8).forEach(x=>{const row=document.createElement('div');row.className='outcome-group-row';const name=document.createElement('b');name.textContent=x.key;const n=document.createElement('span');n.textContent=`n=${x.n}`;const delta=document.createElement('span');delta.textContent=`Δ urge ${x.medianUrgeDelta==null?'—':formatNum(x.medianUrgeDelta,1)}`;const rate=document.createElement('span');rate.textContent=`jatkoi ${percent(x.continuedRate)}`;row.append(name,n,delta,rate);box.append(row);});
  }
  function renderPendingOutcome(){
    const box=$('#pendingOutcomeContext'); if(!box)return; const x=state.pendingOutcome;
    if(!x){box.innerHTML='<b>Ei odottavaa kitkasessiota.</b> Voit kirjata outcome-havainnon myös käsin.';return;}
    box.innerHTML=''; const b=document.createElement('b');b.textContent='Odottava kitkasessio'; const p=document.createElement('p');p.textContent=`${x.delayMinutes||0} min · ${(x.ruleNames||[]).join(', ')||'ei nimettyä sääntöä'}${x.domain?` · ${x.domain}`:''}`;
    const tags=document.createElement('div');tags.className='pattern-domain-tags';(x.patternIds||[]).forEach(id=>tags.append(tag(id)));const clear=document.createElement('button');clear.type='button';clear.className='ghost-button compact';clear.textContent='Hylkää konteksti';clear.addEventListener('click',()=>{state.pendingOutcome=null;write(KEYS.pendingOutcome,null);renderPendingOutcome();}); box.append(b,p,tags,clear);
    if(x.urgeBefore!=null && $('#outcomeUrgeBefore')) $('#outcomeUrgeBefore').value=x.urgeBefore;
  }
  function renderOutcomeLab(){
    const core=outcomeCore(); if(!core)return; state.outcomes=(Array.isArray(state.outcomes)?state.outcomes:[]).map(core.normalize); const analysis=core.analyze(state.outcomes);
    renderPendingOutcome(); if($('#outcomeSummaryTitle'))$('#outcomeSummaryTitle').textContent=`${analysis.overall.n} outcomea`;
    if($('#outcomeN'))$('#outcomeN').textContent=String(analysis.overall.n); if($('#outcomeDelta'))$('#outcomeDelta').textContent=analysis.overall.medianUrgeDelta==null?'—':formatNum(analysis.overall.medianUrgeDelta,1); if($('#outcomeContinueRate'))$('#outcomeContinueRate').textContent=percent(analysis.overall.continuedRate); if($('#outcomeNonContinueRate'))$('#outcomeNonContinueRate').textContent=percent(analysis.overall.nonContinueRate);
    const threshold=$('#outcomeThreshold'); if(threshold){const n=analysis.overall.n; threshold.innerHTML=n<8?`<b>Outcome Lab:</b> ${n}/8 · vielä ${8-n} havaintoa alustavaan yhteenvetoon.`:n<20?`<b>Outcome Lab:</b> ${n} havaintoa · PRELIMINARY alle 20 havainnolla.`:`<b>Outcome Lab:</b> ${n} havaintoa · DESCRIPTIVE. Ei kausaalipäätelmiä.`;}
    const msg=$('#outcomeMessage'); if(msg)msg.innerHTML=`<span class="evidence-badge calculated">CALCULATED</span> <b>${analysis.maturity}</b> · ${escapeHtmlText(analysis.message)}`;
    renderOutcomeGroup('#outcomeDelayGroups',analysis.byDelay); renderOutcomeGroup('#outcomeRuleGroups',analysis.byRule); renderOutcomeGroup('#outcomePatternGroups',analysis.byPattern);
    const list=$('#outcomeList'); if(list){list.innerHTML='';if(!state.outcomes.length)list.innerHTML='<p class="empty-state">Ei outcome-havaintoja.</p>';const visibleOutcomes=[...state.outcomes].slice(-200).reverse();if(state.outcomes.length>200){const note=document.createElement('p');note.className='list-limit-note';note.textContent=`Näytetään 200 uusinta ${state.outcomes.length} havainnosta. Analyysi ja export käyttävät koko aineistoa.`;list.append(note);}visibleOutcomes.forEach(item=>{const el=document.createElement('article');el.className='journal-entry';const time=document.createElement('time');time.dateTime=item.createdAt;time.textContent=new Date(item.createdAt).toLocaleDateString('fi-FI');const body=document.createElement('div');const pp=document.createElement('p');pp.textContent=item.note||item.reflection||'Ei tekstimuistiinpanoa.';const tags=document.createElement('div');tags.className='entry-tags';tags.append(tag(item.source.toUpperCase()));if(item.urgeDelta!=null)tags.append(tag(`Δ urge ${formatNum(item.urgeDelta,1)}`));tags.append(tag(item.decision));if(item.delayMinutes)tags.append(tag(`${item.delayMinutes} min`));(item.patternIds||[]).slice(0,3).forEach(id=>tags.append(tag(id)));body.append(pp,tags);const del=document.createElement('button');del.type='button';del.textContent='×';del.setAttribute('aria-label','Poista outcome-havainto');del.addEventListener('click',()=>{state.outcomes=state.outcomes.filter(x=>x.id!==item.id);saveOutcomes();});el.append(time,body,del);list.append(el);});}
  }
  $('#outcomeForm')?.addEventListener('submit',e=>{e.preventDefault();const core=outcomeCore();if(!core)return;const pending=state.pendingOutcome||{};const before=$('#outcomeUrgeBefore').value,after=$('#outcomeUrgeAfter').value,decision=$('#outcomeDecision').value,afterCost=$('#outcomeAfterCost').value,note=$('#outcomeNote').value.trim();if(before===''&&after===''&&decision==='unknown'&&!note)return toast('Kirjaa vähintään yksi outcome-havainto.');const item=core.normalize({...pending,source:pending.source||'manual',frictionSessionId:pending.id||'',urgeBefore:before===''?pending.urgeBefore:before,urgeAfter:after,decision,afterCost,note});state.outcomes.push(item);state.pendingOutcome=null;write(KEYS.pendingOutcome,null);saveOutcomes();e.currentTarget.reset();toast('Outcome tallennettu paikallisesti.');log(`Outcome stored · ${item.decision} · delta ${item.urgeDelta??'NA'}`);});
  $('#exportOutcomes')?.addEventListener('click',()=>{const core=outcomeCore();if(core)downloadJson(`BHC_XRAY_OUTCOMES_${VERSION}.json`,core.exportBundle(state.outcomes));});
  $('#importOutcomes')?.addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{const incoming=outcomeCore().importBundle(JSON.parse(await file.text()));const byId=new Map(state.outcomes.map(x=>[x.id,x]));incoming.forEach(x=>byId.set(x.id,x));state.outcomes=[...byId.values()];saveOutcomes();toast(`${incoming.length} outcomea tuotu.`);}catch(err){toast(`Tuonti epäonnistui: ${err.message}`);}e.target.value='';});
  $('#clearOutcomes')?.addEventListener('click',()=>{if(!confirm('Poistetaanko kaikki Outcome Lab -havainnot tästä selaimesta?'))return;state.outcomes=[];write(KEYS.outcomes,[]);renderOutcomeLab();renderModuleRegistry();toast('Outcome Lab tyhjennetty.');});

  // Universal X-Ray Bench 1.3 · claim decomposition, side-by-side skin mode and Claim Graph
  const EVIDENCE_CLASS = (type) => `evidence-badge ${type}`;

  function makeBenchItem(title, note, meta = '') {
    const row = document.createElement('div');
    row.className = 'decomp-item';
    const head = document.createElement('div');
    head.className = 'decomp-item-head';
    const b = document.createElement('b'); b.textContent = title;
    head.append(b);
    if (meta) { const tag = document.createElement('span'); tag.className = 'decomp-meta'; tag.textContent = meta; head.append(tag); }
    row.append(head);
    if (note) { const p = document.createElement('p'); p.textContent = note; row.append(p); }
    return row;
  }

  function renderBenchList(selector, items, emptyText, builder) {
    const root = $(selector); if (!root) return;
    root.innerHTML = '';
    if (!items.length) { const p = document.createElement('p'); p.className = 'empty-state'; p.textContent = emptyText; root.append(p); return; }
    items.slice(0, 16).forEach((item, index) => root.append(builder(item, index)));
    if (items.length > 16) { const p = document.createElement('p'); p.className='microcopy'; p.textContent=`+ ${items.length - 16} muuta havaintoa JSON-viennissä.`; root.append(p); }
  }

  function renderClaimGraph(rows) {
    const root = $('#claimGraph');
    root.innerHTML = '';
    if (!rows.length) { const p=document.createElement('p'); p.className='empty-state'; p.textContent='Ei väiteketjua tämän heuristiikan mukaan.'; root.append(p); return; }
    rows.forEach((row, index) => {
      const el = document.createElement('div'); el.className='claim-graph-row'; el.setAttribute('role','listitem');
      const left = document.createElement('div'); left.className='graph-node graph-context';
      const leftLabel = document.createElement('span'); leftLabel.textContent='TUKI / SILTA'; left.append(leftLabel);
      const leftItems = [...row.support.map(x=>x.label), ...row.assumption.map(x=>x.label)];
      const leftText=document.createElement('p'); leftText.textContent=leftItems.length ? leftItems.join(' · ') : 'Ei näkyvää tukiankkuria tai eksplisiittistä logiikkasiltaa.'; left.append(leftText);
      const arrow1=document.createElement('div'); arrow1.className='graph-arrow'; arrow1.textContent='→'; arrow1.setAttribute('aria-hidden','true');
      const claim=document.createElement('div'); claim.className='graph-node graph-claim';
      const claimLabel=document.createElement('span'); claimLabel.textContent=`CLAIM ${index+1}`; claim.append(claimLabel);
      const claimText=document.createElement('p'); claimText.textContent=row.claim.text; claim.append(claimText);
      const arrow2=document.createElement('div'); arrow2.className='graph-arrow'; arrow2.textContent='→'; arrow2.setAttribute('aria-hidden','true');
      const right=document.createElement('div'); right.className='graph-node graph-check';
      const rightLabel=document.createElement('span'); rightLabel.textContent='FRAME / CHECK'; right.append(rightLabel);
      const rightItems=[...row.pressure.map(x=>x.name), ...row.uncertainty.map(x=>x.label)];
      const rightText=document.createElement('p'); rightText.textContent=rightItems.length ? rightItems.join(' · ') : 'Ei tämän heuristiikan erityistä kehystys- tai epävarmuushavaintoa.'; right.append(rightText);
      el.append(left,arrow1,claim,arrow2,right); root.append(el);
    });
  }

  function renderUniversalBench(out) {
    state.lastXrayAnalysis = out;
    $('#xrayScore').textContent = String(out.score);
    $('#claimCount').textContent = String(out.structure.claims);
    $('#supportCount').textContent = String(out.supports.length);
    $('#bridgeCount').textContent = String(out.assumptions.length);
    $('#uncertaintyCount').textContent = String(out.uncertainties.length);
    $('#sentenceCount').textContent = String(out.structure.sentences);
    $('#questionCount').textContent = String(out.structure.questions);
    $('#absoluteCount').textContent = String(out.structure.absolutes);
    $('#pressureCount').textContent = String(out.structure.pressureCues);

    const patterns = $('#xrayPatterns'); patterns.innerHTML='';
    if (!out.patternHits.length) { const p=document.createElement('p'); p.className='empty-state'; p.textContent='Ei osumia tämän heuristiikan paine- tai kehystyssanastoilla. Se ei tarkoita, että väitteet olisivat automaattisesti tosia tai neutraaleja.'; patterns.append(p); }
    out.patternHits.sort((a,b)=>b.score-a.score).slice(0,10).forEach(h => {
      const el=document.createElement('div'); el.className='pattern-item';
      const icon=document.createElement('span'); icon.className='pattern-icon'; icon.textContent=h.icon;
      const copy=document.createElement('div'); const b=document.createElement('b'); b.textContent=h.name; const p=document.createElement('p'); p.textContent=h.desc; copy.append(b,p);
      const em=document.createElement('em'); em.textContent=`${h.count} osumaa · ${h.matches.join(', ')}`;
      el.append(icon,copy,em); patterns.append(el);
    });

    $('#skinOriginal').textContent = out.source;
    $('#skinStripped').textContent = out.stripped;
    $('#copySkinOff').disabled = false;
    $('#exportXrayAnalysis').disabled = false;

    renderBenchList('#claimList', out.claims, 'Ei selviä väitelauseita tämän heuristiikan mukaan.', (c,i)=>makeBenchItem(`Väite ${i+1}`, c.text, c.sentenceId.toUpperCase()));
    renderBenchList('#supportList', out.supports, 'Ei näkyviä numero-, lähde-, URL- tai lainausankkureita.', s=>makeBenchItem(s.label, s.matches.join(', '), s.sentenceId.toUpperCase()));
    renderBenchList('#assumptionList', out.assumptions, 'Ei eksplisiittisiä kausaali-, ehto-, pakko- tai tulkintasiltoja.', a=>makeBenchItem(a.label, a.note, a.sentenceId.toUpperCase()));
    const frames=[...out.frames.map(x=>({...x,kindLabel:'KEHYSTYS'})), ...out.hooks.map(x=>({...x,kindLabel:'TUNNEKOUKKU'}))];
    renderBenchList('#frameList', frames, 'Ei osumia tämän linssin kehystys- tai tunnekoukkusanastoilla.', h=>makeBenchItem(h.name, `${h.desc} Osumat: ${h.matches.join(', ')}`, h.kindLabel));
    renderBenchList('#incentiveList', out.incentives, 'Ei selkeää toimintakehotetta tämän sanaston perusteella.', i=>makeBenchItem(i.label, i.note, i.sentenceId ? i.sentenceId.toUpperCase() : 'CUE'));
    renderBenchList('#uncertaintyList', out.uncertainties, 'Ei erityistä tarkistusaukkoa tämän heuristiikan mukaan. Tämä ei todista väitteitä oikeiksi.', u=>makeBenchItem(u.label, u.note, u.sentenceId.toUpperCase()));
    renderBenchList('#countercaseList', out.countercases, 'Kysy: mikä havainto pitäisi nähdä, jos pääväite olisi väärä?', c=>makeBenchItem(c.label, c.note, c.sentenceId.toUpperCase()));
    renderClaimGraph(out.graph);

    const summary = $('#xraySummary'); summary.innerHTML='';
    const badge=document.createElement('span'); badge.className=EVIDENCE_CLASS('interpretation'); badge.textContent='INTERPRETATION'; summary.append(badge, document.createTextNode(' '));
    const b=document.createElement('b');
    if (out.patternHits.length || out.uncertainties.length) b.textContent=`${out.claims.length} väite-ehdokasta · ${out.patternHits.length} kuviotyyppiä · ${out.uncertainties.length} tarkistuskohtaa.`;
    else b.textContent=`${out.claims.length} väite-ehdokasta, mutta tämän heuristiikan painekuviot jäivät vähäisiksi.`;
    summary.append(b, document.createTextNode(' Tämä on paikallinen rakenneluku. Se ei arvioi kirjoittajan motiivia eikä tarkista ulkoisten väitteiden totuutta.'));

    state.metrics.lastScanCount = out.patternHits.length;
    write(KEYS.metrics,state.metrics); updateMetrics(); applyEvidenceLens(state.lens);
  }

  $('#xrayForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const text=$('#xrayText').value.trim(); const lens=$('#xrayLens').value;
    if (text.length < 10) return toast('Anna analysoitavaa tekstiä vähän enemmän.');
    const core=window.BHCUniversalCore;
    if (!core) return toast('Universal Core ei ole käytettävissä.');
    const out=core.analyze(text,lens);
    renderUniversalBench(out);
    log(`Universal Bench · lens ${lens} · claims ${out.claims.length} · patterns ${out.patternHits.length} · checks ${out.uncertainties.length}`);
  });

  $('#clearXray')?.addEventListener('click',()=>{
    $('#xrayText').value=''; state.lastXrayAnalysis=null;
    ['#claimCount','#supportCount','#bridgeCount','#uncertaintyCount','#sentenceCount','#questionCount','#absoluteCount','#pressureCount'].forEach(sel=>$(sel).textContent='—');
    $('#xrayScore').textContent='0'; $('#skinOriginal').textContent='Ei analyysiä vielä.'; $('#skinStripped').textContent='Ei analyysiä vielä.';
    ['#claimList','#supportList','#assumptionList','#frameList','#incentiveList','#uncertaintyList','#countercaseList'].forEach(sel=>{ const root=$(sel); root.innerHTML='<p class="empty-state">Ei analyysiä.</p>'; });
    $('#xrayPatterns').innerHTML='<p class="empty-state">Syötä teksti ja aja skannaus.</p>';
    $('#claimGraph').innerHTML='<p class="empty-state">Aja analyysi nähdäksesi väiteketjun.</p>';
    $('#copySkinOff').disabled=true; $('#exportXrayAnalysis').disabled=true;
    $('#xraySummary').innerHTML='<span class="evidence-badge interpretation">INTERPRETATION</span> Heuristiikka ei ole totuusautomaatti. Se tekee tekstin rakenteita näkyviksi, jotta niitä voi arvioida erikseen.';
    applyEvidenceLens(state.lens); toast('Universal Bench tyhjennetty.');
  });

  $('#copySkinOff')?.addEventListener('click', async()=>{
    const text=state.lastXrayAnalysis?.stripped; if(!text) return;
    try { await navigator.clipboard.writeText(text); toast('Riisuttu rakenne kopioitu.'); }
    catch { toast('Leikepöytä ei ollut käytettävissä tässä selaimessa.'); }
  });

  $('#exportXrayAnalysis')?.addEventListener('click',()=>{
    if(!state.lastXrayAnalysis) return;
    const safe={...state.lastXrayAnalysis, exportedAt:new Date().toISOString(), epistemicNote:'Heuristic decomposition; no external fact checking or intent inference.'};
    downloadJson(`BHC_UNIVERSAL_XRAY_${VERSION}.json`,safe); log('Universal Bench analysis exported');
  });

  // Journal · structured Dependency Lab data (schema v2, legacy-compatible)
  $('#journalDate').value = new Date().toISOString().slice(0,10);
  const optionalNumber = (selector) => { const v=$(selector)?.value; return v === '' || v == null ? null : Number(v); };
  $('#journalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const actedRaw=$('#journalActed').value;
    const item = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      schemaVersion: 2, date: $('#journalDate').value, category: $('#journalCategory').value,
      urge: Number($('#journalUrge').value), mood: Number($('#journalMood').value), sleep: optionalNumber('#journalSleep'),
      triggerGroup: $('#journalTriggerGroup').value, trigger: $('#journalTrigger').value.trim(),
      acted: actedRaw === 'yes' ? true : actedRaw === 'no' ? false : null, action: $('#journalAction').value.trim(),
      rewardScore: optionalNumber('#journalRewardScore'), reward: $('#journalReward').value.trim(),
      afterCost: optionalNumber('#journalAfterCost'), afterEffect: $('#journalAfterEffect').value.trim(),
      note: $('#journalNote').value.trim(), createdAt:new Date().toISOString()
    };
    state.journal.push(item); state.journal.sort((a,b)=>String(a.date).localeCompare(String(b.date))); write(KEYS.journal,state.journal); renderJournal(); renderDependencyAnalysis(false); updateMetrics(); toast('Journal-havainto tallennettu.'); log('Structured Journal entry stored locally');
    ['#journalTrigger','#journalAction','#journalReward','#journalAfterEffect','#journalNote'].forEach(sel=>{if($(sel))$(sel).value='';});
    $('#journalActed').value=''; $('#journalRewardScore').value=''; $('#journalAfterCost').value='';
  });
  function renderJournal() {
    const list=$('#journalList'); list.innerHTML='';
    if (!state.journal.length) list.innerHTML='<p class="empty-state">Ei vielä merkintöjä.</p>';
    const visibleJournal=[...state.journal].slice(-250).reverse();
    if(state.journal.length>250){const note=document.createElement('p');note.className='list-limit-note';note.textContent=`Näytetään 250 uusinta ${state.journal.length} merkinnästä. Correlation Bench ja export käyttävät koko aineistoa.`;list.append(note);}
    visibleJournal.forEach(item => {
      const el=document.createElement('article'); el.className='journal-entry';
      const time=document.createElement('time'); time.dateTime=item.date; time.textContent=item.date || '—';
      const body=document.createElement('div');
      const lead=[item.triggerGroup,item.trigger,item.action].filter(Boolean).join(' · ') || item.note || 'Ei tekstimerkintää.';
      const pp=document.createElement('p'); pp.textContent=lead;
      const tags=document.createElement('div'); tags.className='entry-tags';
      if (item.category) tags.append(tag(item.category));
      if (isFiniteValue(item.urge)) tags.append(tag(`Urge ${item.urge}/10`));
      if (isFiniteValue(item.mood)) tags.append(tag(`Mieliala ${item.mood}/10`));
      if (isFiniteValue(item.sleep)) tags.append(tag(`Uni ${formatNum(item.sleep,1)} h`));
      if (typeof item.acted === 'boolean') tags.append(tag(item.acted?'Toiminta toteutui':'Toiminta ei toteutunut'));
      if (isFiniteValue(item.rewardScore)) tags.append(tag(`Palkkio ${item.rewardScore}/10`));
      if (isFiniteValue(item.afterCost)) tags.append(tag(`Jälkikustannus ${item.afterCost}/10`));
      if (!item.schemaVersion || item.schemaVersion < 2) tags.append(tag('LEGACY 1.1'));
      body.append(pp,tags);
      const del=document.createElement('button'); del.type='button'; del.textContent='×'; del.setAttribute('aria-label',`Poista merkintä ${item.date}`); del.addEventListener('click',()=>{ state.journal=state.journal.filter(x=>x.id!==item.id); write(KEYS.journal,state.journal); renderJournal(); renderDependencyAnalysis(false); updateMetrics(); });
      el.append(time,body,del); list.append(el);
    });
    $('#journalSummaryTitle').textContent=`${state.journal.length} merkintää`;
    const threshold=$('#journalThreshold'); if(threshold){ const n=state.journal.length; threshold.innerHTML=n<14?`<b>Correlation Bench:</b> ${n}/14 · vielä ${14-n} havaintoa alustavaan analyysiin.`:n<30?`<b>Correlation Bench:</b> ${n} havaintoa · analyysi on ALUSTAVA alle 30 havainnolla.`:`<b>Correlation Bench:</b> ${n} havaintoa · kuvaileva 30+ aineisto. Ei kausaalipäätelmiä.`; }
    drawJournalChart();
  }
  function tag(text) { const sp=document.createElement('span'); sp.textContent=text; return sp; }
  function drawJournalChart() {
    const chartRows=state.journal.length<=600?state.journal:Array.from({length:600},(_,i)=>state.journal[Math.round(i*(state.journal.length-1)/599)]);
    const points=chartRows.map((item,i)=>({i,urge:isFiniteValue(item.urge)?Number(item.urge):null,mood:isFiniteValue(item.mood)?Number(item.mood):null}));
    const series=[];
    const urges=points.filter(p=>p.urge!=null).map(p=>({x:p.i,y:p.urge})); if(urges.length) series.push({color:'#58dcff',points:urges});
    const moods=points.filter(p=>p.mood!=null).map(p=>({x:p.i,y:p.mood})); if(moods.length) series.push({color:'#d9ae55',points:moods});
    drawLineChart($('#journalChart'),series);
  }
  $('#exportJournal').addEventListener('click',()=>{
    downloadJson(`BHC_XRAY_JOURNAL_${new Date().toISOString().slice(0,10)}.json`, {format:'bhc-xray-journal',version:2,exportedAt:new Date().toISOString(),entries:state.journal,fields:['date','category','urge','mood','sleep','triggerGroup','trigger','acted','action','rewardScore','reward','afterCost','afterEffect','note']});
    log('Journal v2 exported to local file');
  });
  $('#clearJournal').addEventListener('click',()=>{ if(!confirm('Poistetaanko kaikki Journal-merkinnät tästä selaimesta?')) return; state.journal=[]; write(KEYS.journal,[]); renderJournal(); renderDependencyAnalysis(false); updateMetrics(); toast('Journal tyhjennetty.'); });

  // Calm Room canvas
  const calmCanvas=$('#calmCanvas'); const calmCtx=calmCanvas.getContext('2d'); let particles=[]; let calmFrame=0; let breathStart=performance.now();
  function resizeCalmCanvas(){ const r=calmCanvas.getBoundingClientRect(); const d=Math.min(devicePixelRatio||1,2); calmCanvas.width=Math.max(1,Math.floor(r.width*d)); calmCanvas.height=Math.max(1,Math.floor(r.height*d)); calmCtx.setTransform(d,0,0,d,0,0); particles=Array.from({length:50},()=>({x:Math.random()*r.width,y:Math.random()*r.height,vx:(Math.random()-.5)*.12,vy:(Math.random()-.5)*.12,r:1+Math.random()*2,a:.15+Math.random()*.45})); }
  function calmLoop(now){ const r=calmCanvas.getBoundingClientRect(); if(state.calmRunning){ calmCtx.clearRect(0,0,r.width,r.height); const g=calmCtx.createRadialGradient(r.width*.5,r.height*.5,0,r.width*.5,r.height*.5,Math.max(r.width,r.height)*.7); g.addColorStop(0,'rgba(20,121,255,.09)');g.addColorStop(1,'rgba(2,7,13,0)');calmCtx.fillStyle=g;calmCtx.fillRect(0,0,r.width,r.height); particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0)p.x=r.width;if(p.x>r.width)p.x=0;if(p.y<0)p.y=r.height;if(p.y>r.height)p.y=0;calmCtx.beginPath();calmCtx.arc(p.x,p.y,p.r,0,Math.PI*2);calmCtx.fillStyle=`rgba(88,220,255,${p.a})`;calmCtx.fill();}); }
    const phase=((now-breathStart)%8000)/8000; $('#breathText').textContent=phase<.5?'Sisään':'Ulos'; calmFrame=requestAnimationFrame(calmLoop); }
  $('#toggleCalm').addEventListener('click',()=>{state.calmRunning=!state.calmRunning;$('#toggleCalm').textContent=state.calmRunning?'Pysäytä liike':'Käynnistä liike';});
  window.addEventListener('resize',()=>{ if(document.body.dataset.screen==='calm') resizeCalmCanvas(); if(document.body.dataset.screen==='patterns') drawPatternAtlas(); });

  // Settings + System Vault 1.8 + final data lifecycle
  const vaultCore = () => window.BHCVaultCore;
  $('#reduceMotion').checked=!!state.settings.reduceMotion; $('#skinDefault').checked=!!state.settings.skinDefault;
  document.body.classList.toggle('reduce-motion',!!state.settings.reduceMotion); document.body.dataset.skin=state.settings.skinDefault?'off':'on';
  $('#reduceMotion').addEventListener('change',e=>{state.settings.reduceMotion=e.target.checked;write(KEYS.settings,state.settings);document.body.classList.toggle('reduce-motion',e.target.checked);});
  $('#skinDefault').addEventListener('change',e=>{state.settings.skinDefault=e.target.checked;write(KEYS.settings,state.settings);document.body.dataset.skin=e.target.checked?'off':'on';});

  function renderVault() {
    if (!$('#vaultKeyGrid')) return;
    $('#vaultJournalCount').textContent=String(state.journal.length);
    $('#vaultFrictionCount').textContent=String(state.frictionRules.length);
    $('#vaultOutcomeCount').textContent=String(state.outcomes.length);
    $('#vaultLoopCount').textContent=String(state.loops.length);
    const test=vaultCore()?.selfTest?.();
    if ($('#vaultHealth') && test) $('#vaultHealth').textContent=test.ok?'PASS':'CHECK';
    const names={journal:'Journal',metrics:'Mittarit',settings:'Asetukset',loops:'Silmukat',lens:'X-Ray Lens',friction:'Friction Rules',outcomes:'Outcome Lab',pendingOutcome:'Odottava outcome'};
    const grid=$('#vaultKeyGrid'); grid.innerHTML='';
    Object.entries(KEYS).forEach(([name,key])=>{
      const el=document.createElement('div'); let raw=null; try{raw=localStorage.getItem(key);}catch{} let detail='ei tallennettua dataa';
      if(raw!=null){try{const v=JSON.parse(raw);detail=Array.isArray(v)?`${v.length} riviä`:(v&&typeof v==='object')?`${Object.keys(v).length} kenttää`:'tallennettu';}catch{detail='raakadata';}}
      el.innerHTML=`<span>${escapeHtmlText(names[name]||name)}</span><strong>${escapeHtmlText(detail)}</strong><small>${escapeHtmlText(key)}</small>`; grid.append(el);
    });
  }

  $('#exportSystemVault')?.addEventListener('click',()=>{
    const core=vaultCore(); if(!core)return toast('Vault Core ei ole käytettävissä.');
    const bundle=core.buildBundle({appVersion:VERSION,keys:KEYS});
    downloadJson(`BHC_UNIVERSAL_XRAY_${VERSION}_${new Date().toISOString().slice(0,10)}.bhcxray`,bundle);
    $('#vaultRestoreStatus').textContent=`Viety ${bundle.counts.journal} Journal-riviä, ${bundle.counts.frictionRules} kitkasääntöä ja ${bundle.counts.outcomes} outcomea.`;
    log(`System Vault exported · ${bundle.sizeBytes} bytes`);
  });

  $('#importSystemVault')?.addEventListener('change',async e=>{
    const file=e.target.files?.[0]; if(!file)return;
    try{
      if(file.size>25*1024*1024)throw new Error('Tiedosto ylittää 25 Mt turvarajan.');
      const payload=JSON.parse(await file.text()); const core=vaultCore(); const check=core.validateBundle(payload);
      if(!check.ok)throw new Error(check.problems.join(' '));
      const counts=payload.counts||{};
      const yes=confirm(`Palautetaanko tämä BHC X-Ray -varmuuskopio?\n\nJournal: ${counts.journal??'—'}\nFriction Rules: ${counts.frictionRules??'—'}\nOutcomes: ${counts.outcomes??'—'}\n\nNykyiset BHC X-Ray -avaimet korvataan. Selaimen muuta dataa ei kosketa.`);
      if(!yes)return;
      const report=core.restoreBundle(payload,{keys:KEYS,clear:true});
      $('#vaultRestoreStatus').textContent=`Palautus hyväksytty: ${report.count} data-aluetta. Ladataan käyttöliittymä uudelleen…`;
      log(`System Vault restored · ${report.count} areas`);
      setTimeout(()=>location.reload(),250);
    }catch(err){toast(`Palautus epäonnistui: ${err.message}`);$('#vaultRestoreStatus').textContent=`Palautus estetty: ${err.message}`;log(`Vault restore rejected · ${err.message}`);}
    finally{e.target.value='';}
  });

  $('#runVaultSelfTest')?.addEventListener('click',()=>{
    const test=vaultCore()?.selfTest?.(); if(!test)return toast('Vault Core ei ole käytettävissä.');
    $('#vaultRestoreStatus').textContent=test.ok?'Vault self-test PASS · roundtrip säilyttää vieraat localStorage-avaimet.':`Vault self-test CHECK · ${test.problems.join(' ')}`;
    toast(test.ok?'Vault Core PASS':'Vault Core CHECK'); renderModuleRegistry();
  });

  $('#clearAllData')?.addEventListener('click',()=>{
    if(!confirm('Poistetaanko kaikki BHC X-Ray -käyttäjädata tästä selaimesta? Tätä ei voi perua ilman varmuuskopiota.')) return;
    vaultCore()?.clearKnownData?.({keys:KEYS});
    state.journal=[]; state.loops=[]; state.frictionRules=[]; state.outcomes=[]; state.pendingOutcome=null;
    state.metrics={lastCasinoNet:null,lastScanCount:null}; state.settings={reduceMotion:false,skinDefault:false}; state.lens='all';
    state.frictionEval=null; state.lastLoop=null; state.lastXrayAnalysis=null;
    document.body.classList.remove('reduce-motion'); document.body.dataset.skin='on'; $('#reduceMotion').checked=false; $('#skinDefault').checked=false;
    applyEvidenceLens('all'); updateMetrics(); renderJournal(); renderDependencyAnalysis(false); renderFrictionLab(); renderOutcomeLab(); renderVault(); renderModuleRegistry();
    toast('Kaikki tunnettu BHC X-Ray -käyttäjädata poistettu. Offline-sovelluscache säilyi.'); log('All known BHC X-Ray user data cleared; app cache preserved');
  });

  // Service worker
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').then(()=>log('Service Worker registered')).catch(()=>log('Service Worker registration failed')));
  }
  window.addEventListener('online',updateMetrics); window.addEventListener('offline',updateMetrics);

  // Initial state
  renderJournal(); updateMetrics(); updateReality(); updateHouseEdgePreview(); updateSunkCost();
  renderOddsMargin(); renderAcca(); renderLottery(); renderRacing(); generateMarketCandles(); renderMarketCost(); renderMarketLeverage();
  applyEvidenceLens(state.lens); renderModuleRegistry(); renderDependencyAnalysis(false); renderPatternAtlas(); renderFrictionLab(); renderOutcomeLab(); renderVault();
  const universalBootTest = window.BHCUniversalCore?.selfTest?.();
  if (universalBootTest) log(`Universal Core self-test ${universalBootTest.ok ? 'PASS' : 'CHECK'}`);
  const frictionBootTest = window.BHCFrictionCore?.selfTest?.();
  if (frictionBootTest) log(`Friction Core self-test ${frictionBootTest.ok ? 'PASS' : 'CHECK'}`);
  const outcomeBootTest = window.BHCOutcomeCore?.selfTest?.();
  if (outcomeBootTest) log(`Outcome Core self-test ${outcomeBootTest.ok ? 'PASS' : 'CHECK'}`);
  const patternBootTest = window.BHCPatternLibrary?.selfTest?.();
  if (patternBootTest) log(`Pattern Library self-test ${patternBootTest.ok ? 'PASS' : 'CHECK'}`);
  const vaultBootTest = window.BHCVaultCore?.selfTest?.();
  if (vaultBootTest) log(`Vault Core self-test ${vaultBootTest.ok ? 'PASS' : 'CHECK'}`);
  const oddsBootTest = window.BHCOddsCore?.selfTest?.();
  if (oddsBootTest) log(`Odds Core self-test ${oddsBootTest.ok ? 'PASS' : 'CHECK'}`);
  const marketBootTest = window.BHCMarketCore?.selfTest?.();
  if (marketBootTest) log(`Market Core self-test ${marketBootTest.ok ? 'PASS' : 'CHECK'}`);
  log('BHC Universal X-Ray boot');
  log('APP EGRESS policy active');
  log('No OS-level interception in browser build');
  routeFromHash();
  resizeCalmCanvas(); calmFrame=requestAnimationFrame(calmLoop);
})();
