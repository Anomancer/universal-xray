(() => {
  'use strict';

  const API_VERSION = 1;
  const modules = new Map();
  const knownEvidence = new Set(['measured','calculated','simulated','user-reported','heuristic','interpretation']);

  const normalize = (def) => Object.freeze({
    id: String(def.id || '').trim(),
    version: String(def.version || '1.0.0'),
    label: String(def.label || def.id || 'Unnamed module'),
    route: def.route ? String(def.route) : null,
    icon: String(def.icon || '◌'),
    description: String(def.description || ''),
    nav: def.nav !== false,
    launcher: def.launcher !== false,
    capabilities: Object.freeze([...(def.capabilities || [])].map(String)),
    evidence: Object.freeze([...(def.evidence || [])].map(String)),
    inputs: Object.freeze([...(def.inputs || [])].map(String)),
    outputs: Object.freeze([...(def.outputs || [])].map(String)),
    provenance: Object.freeze({ ...(def.provenance || {}) }),
    dependencies: Object.freeze([...(def.dependencies || [])].map(String)),
    critical: !!def.critical
  });

  function register(def) {
    const module = normalize(def || {});
    if (!/^[a-z0-9][a-z0-9._-]*$/i.test(module.id)) throw new Error(`Invalid module id: ${module.id}`);
    if (modules.has(module.id)) throw new Error(`Duplicate module id: ${module.id}`);
    modules.set(module.id, module);
    return module;
  }

  function get(id) { return modules.get(id) || null; }
  function list() { return [...modules.values()]; }
  function byCapability(capability) { return list().filter(m => m.capabilities.includes(capability)); }

  function selfTest() {
    const problems = [];
    for (const m of list()) {
      if (!m.id || !m.label || !m.version) problems.push(`${m.id || '(missing id)'}: missing identity field`);
      for (const e of m.evidence) if (!knownEvidence.has(e)) problems.push(`${m.id}: unknown evidence type ${e}`);
      for (const dep of m.dependencies) if (!modules.has(dep)) problems.push(`${m.id}: missing dependency ${dep}`);
      if (m.route && !document.querySelector(`.screen[data-screen="${CSS.escape(m.route)}"]`)) problems.push(`${m.id}: route ${m.route} has no screen`);
    }
    return { ok: problems.length === 0, count: modules.size, problems };
  }

  function manifest() {
    return {
      apiVersion: API_VERSION,
      generatedAt: new Date().toISOString(),
      count: modules.size,
      evidenceTypes: [...knownEvidence],
      modules: list().map(m => ({ ...m }))
    };
  }

  window.BHCXrayCore = Object.freeze({ API_VERSION, register, get, list, byCapability, selfTest, manifest });

  [
    {
      id:'lab.casino', version:'2.0.0', label:'Casino X-Ray', route:'casino', icon:'777',
      description:'RTP, house edge, stochastic session simulation, LDIW and bankroll-risk laboratory.',
      capabilities:['simulation','sensitivity','harm-reduction'], evidence:['calculated','simulated'],
      inputs:['rtp','stake','spins','bankroll','volatility','runs','spinsPerMinute'],
      outputs:['houseEdge','theoreticalEV','sessionDistribution','profitableShare','ruinShare','ldiw','timeEstimate'],
      provenance:{ engine:'casino-worker.js', method:'synthetic payout distribution scaled to selected RTP' }, critical:true
    },
    {
      id:'lab.odds', version:'1.10.0', label:'Odds X-Ray', route:'odds', icon:'1/X',
      description:'Educational deconstruction of sportsbook overround, accumulator probability compounding, lottery jackpot salience and pari-mutuel takeout.',
      capabilities:['odds-math','overround','accumulator-demo','lottery-ev','pari-mutuel'], evidence:['calculated','interpretation'],
      inputs:['decimalOdds','legProbability','legs','ticketPrice','combinations','jackpot','otherPrizeEv','pool','takeout','winningPoolShare'],
      outputs:['impliedProbability','overround','normalizedProbabilities','jointProbability','jackpotEV','pariMutuelPayout'],
      provenance:{ engine:'odds-core.js + app.js', marketData:'none', picks:'none', purpose:'mechanism deconstruction' }
    },
    {
      id:'lab.market', version:'1.10.0', label:'Market X-Ray', route:'market', icon:'▥',
      description:'Synthetic candle/random-walk null lab plus transaction-cost and leverage-risk arithmetic for deconstructing short-horizon trading claims.',
      capabilities:['synthetic-candles','null-baseline','cost-drag','leverage-risk','hype-scan'], evidence:['calculated','simulated','heuristic','interpretation'],
      inputs:['steps','volatility','costAssumptions','leverage','adverseMove','hypeText'],
      outputs:['candles','patternNull','costDrag','leverageSensitivity','hypePatterns'],
      provenance:{ engine:'market-core.js + pattern-library.js + universal-core.js + app.js', marketFeed:'none', investmentAdvice:false }
    },
    {
      id:'lab.dependency', version:'1.9.0', label:'Dependency Engine', route:'dependency', icon:'◎',
      description:'User-authored loop hypothesis plus longitudinal descriptive analysis of structured Journal data.',
      capabilities:['self-observation','journal-link','longitudinal-analysis','null-check'], evidence:['user-reported','calculated','interpretation'],
      inputs:['category','trigger','urge','action','reward','cost','journalEntries'], outputs:['loopMap','sleepUrgeR','triggerEta2','actionCostRpb','rewardCostR','weekdayEta2','circularShiftNull'], provenance:{ engine:'dependency-core.js + app.js', storage:'localStorage', method:'descriptive effects + deterministic bounded circular shifts (max 49)' }
    },
    {
      id:'lab.impulse', version:'1.1.0', label:'Impulse Breaker', route:'impulse', icon:'ϟ',
      description:'Local decision-delay tool that inserts time between urge and action.',
      capabilities:['friction','timer'], evidence:['user-reported'], inputs:['intent','alternative','delay'], outputs:['countdown'], provenance:{ engine:'app.js' }
    },
    {
      id:'lab.friction', version:'1.5.0', label:'Friction Lab', route:'friction', icon:'⧖',
      description:'Voluntary local friction rules that insert pause, reflection, Journal context and a deliberate confirmation before a decision.',
      capabilities:['friction-rules','rule-builder','simulation','journal-link','extension-export'], evidence:['user-reported','calculated','interpretation'],
      inputs:['domain','patternId','manualTrigger','delayMinutes','reflectionPrompt','journalContext'], outputs:['matchedRules','mergedDelay','frictionSession','exportBundle'], provenance:{ engine:'friction-core.js + app.js', storage:'localStorage', extensionBridge:'explicit JSON import', automaticBrowsingMonitor:false }
    },
    {
      id:'lab.universal', version:'1.4.0', label:'Universal X-Ray', route:'universal', icon:'⌖',
      description:'Local claim-decomposition bench for claims, support cues, assumptions, framing, incentives, uncertainty checks and Claim Graph.',
      capabilities:['heuristic-scan','lens','claim-decomposition','side-by-side','claim-graph','export'], evidence:['measured','heuristic','interpretation'],
      inputs:['text','lens'], outputs:['claims','supportCues','assumptions','framing','hooks','incentives','uncertainties','countertests','claimGraph','strippedView'], provenance:{ engine:'pattern-library.js + universal-core.js + app.js', model:'none', factChecking:'none' }
    },
    {
      id:'lab.outcome', version:'1.7.0', label:'Outcome Lab', route:'outcomes', icon:'↺',
      description:'Local descriptive follow-up for voluntary friction sessions: urge change, decision outcome and rule/pattern cohorts.',
      capabilities:['outcome-tracking','friction-link','descriptive-analysis','export'], evidence:['user-reported','calculated','interpretation'],
      inputs:['frictionSession','urgeBefore','urgeAfter','decision','afterCost','note'], outputs:['outcomeLog','urgeDelta','decisionRates','delayGroups','ruleGroups','patternGroups'], provenance:{ engine:'outcome-core.js + app.js', storage:'localStorage', causalInference:false }
    },
    {
      id:'lab.journal', version:'1.2.0', label:'Journal', route:'journal', icon:'▤',
      description:'Local structured longitudinal self-report log for Dependency Lab.', capabilities:['storage','export','structured-loop-data'], evidence:['user-reported','measured'],
      inputs:['date','category','urge','mood','sleep','triggerGroup','trigger','acted','action','rewardScore','reward','afterCost','afterEffect','note'], outputs:['entries','trendPlot','correlationInput'], provenance:{ storage:'localStorage', schema:'v2 legacy-compatible' }
    },
    {
      id:'lab.calm', version:'1.1.0', label:'Calm Room', route:'calm', icon:'∿',
      description:'Non-scored local visual breathing space.', capabilities:['canvas','reduced-motion'], evidence:[], inputs:[], outputs:['visualBreathingCue'], provenance:{ engine:'Canvas 2D' }
    },
    {
      id:'bridge.intercept', version:'2.0.0', label:'X-Ray Intercept', route:'intercept', icon:'◎',
      description:'Opt-in Manifest V3 WebExtension bridge that scans only the currently active page after an explicit user action.',
      capabilities:['webextension','active-tab','dom-overlay','opt-in-injection'], evidence:['measured','heuristic','interpretation'],
      inputs:['activeTab','lens'], outputs:['pageSummary','domMarkers','claimDecomposition'], provenance:{ engine:'extension/manifest.json + intercept-content.js', permissions:['activeTab','scripting','storage'], persistentHostPermissions:false }
    },
    {
      id:'core.system-vault', version:'1.8.0', label:'System Vault', route:'vault', icon:'◇',
      description:'Portable local system backup, validated restore and scoped deletion of BHC X-Ray user state.',
      capabilities:['backup','restore','data-lifecycle','extension-bridge'], evidence:['measured'],
      inputs:['localState'], outputs:['bhcxrayBundle','restoreReport','portableExtensionBridge'], provenance:{ engine:'vault-core.js + app.js', storage:'localStorage', foreignKeysTouched:false }
    },
    {
      id:'core.pattern-library', version:'1.10.0', label:'Pattern Atlas', route:'patterns', icon:'⌘',
      description:'Shared local mechanism atlas with pattern passports, cross-context graph, epistemic limits and friction suggestions.',
      capabilities:['pattern-registry','pattern-atlas','cross-context','mechanism-graph','friction-suggestions'], evidence:['measured','heuristic'],
      inputs:['text','lens','domSignals'], outputs:['patternManifest','patternMatches','patternPassports','mechanismGraph'], provenance:{ engine:'pattern-library.js', network:'none' }, critical:true
    },
    {
      id:'core.engine-room', version:'2.0.0', label:'Engine Room', route:null, icon:'◐',
      description:'Runtime provenance, module registry and local-state inspection.', capabilities:['provenance','registry','self-test'],
      evidence:['measured'], inputs:[], outputs:['registryManifest','runtimeState'], provenance:{ engine:'module-core.js + app.js' }, critical:true, nav:false
    }
  ].forEach(register);
})();
