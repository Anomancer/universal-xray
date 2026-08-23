(() => {
  'use strict';

  const VERSION = '1.0.0';
  const FORMAT = 'bhc-xray-outcomes';
  const SCHEMA_VERSION = 1;
  const DECISIONS = new Set(['continued','stopped','deferred','changed','unknown']);
  const clean = v => String(v ?? '').trim();
  const numOrNull = v => v === '' || v == null || !Number.isFinite(Number(v)) ? null : Number(v);
  const clampMaybe = (v,a,b) => { const n=numOrNull(v); return n == null ? null : Math.max(a,Math.min(b,n)); };
  const uid = () => globalThis.crypto?.randomUUID?.() || `outcome-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function normalize(input={}) {
    const decision = DECISIONS.has(input.decision) ? input.decision : 'unknown';
    const urgeBefore = clampMaybe(input.urgeBefore,0,10);
    const urgeAfter = clampMaybe(input.urgeAfter,0,10);
    return {
      id: clean(input.id) || uid(), schemaVersion:SCHEMA_VERSION,
      createdAt: clean(input.createdAt) || new Date().toISOString(),
      source: clean(input.source) || 'manual',
      frictionSessionId: clean(input.frictionSessionId),
      ruleIds:[...new Set((input.ruleIds||[]).map(clean).filter(Boolean))],
      ruleNames:[...new Set((input.ruleNames||[]).map(clean).filter(Boolean))],
      patternIds:[...new Set((input.patternIds||[]).map(clean).filter(Boolean))],
      domain:clean(input.domain).toLowerCase(),
      delayMinutes:Math.max(0,Math.min(120,Number(input.delayMinutes)||0)),
      urgeBefore, urgeAfter,
      urgeDelta: urgeBefore == null || urgeAfter == null ? null : urgeAfter - urgeBefore,
      decision,
      afterCost:clampMaybe(input.afterCost,0,10),
      note:clean(input.note),
      reflection:clean(input.reflection)
    };
  }

  const mean = xs => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
  const median = xs => { if(!xs.length)return null; const s=[...xs].sort((a,b)=>a-b),m=Math.floor(s.length/2); return s.length%2?s[m]:(s[m-1]+s[m])/2; };
  function summarize(rows=[]){
    const data=(Array.isArray(rows)?rows:[]).map(normalize);
    const deltas=data.map(x=>x.urgeDelta).filter(Number.isFinite);
    const withDecision=data.filter(x=>x.decision!=='unknown');
    const counts={continued:0,stopped:0,deferred:0,changed:0,unknown:0}; data.forEach(x=>counts[x.decision]++);
    const nonContinue=counts.stopped+counts.deferred+counts.changed;
    return {
      n:data.length,
      urgeN:deltas.length,
      medianUrgeDelta:median(deltas), meanUrgeDelta:mean(deltas),
      decisionN:withDecision.length,
      continuedRate:withDecision.length?counts.continued/withDecision.length:null,
      nonContinueRate:withDecision.length?nonContinue/withDecision.length:null,
      counts
    };
  }

  function group(rows,keyFn){
    const map=new Map();
    (Array.isArray(rows)?rows:[]).map(normalize).forEach(row=>{
      const keys=keyFn(row); (Array.isArray(keys)?keys:[keys]).filter(Boolean).forEach(key=>{ if(!map.has(key))map.set(key,[]); map.get(key).push(row); });
    });
    return [...map.entries()].map(([key,items])=>({key,...summarize(items)})).sort((a,b)=>b.n-a.n||String(a.key).localeCompare(String(b.key),'fi'));
  }

  function delayBand(minutes){ const m=Number(minutes)||0; if(m<=0)return '0 min'; if(m<5)return '1–4 min'; if(m<10)return '5–9 min'; if(m<20)return '10–19 min'; return '20+ min'; }
  function analyze(rows=[]){
    const data=(Array.isArray(rows)?rows:[]).map(normalize);
    const overall=summarize(data);
    const byDelay=group(data,x=>delayBand(x.delayMinutes));
    const byRule=group(data,x=>x.ruleNames.length?x.ruleNames:x.ruleIds);
    const byPattern=group(data,x=>x.patternIds);
    const sufficient=overall.n>=8;
    const maturity=overall.n<8?'INSUFFICIENT':overall.n<20?'PRELIMINARY':'DESCRIPTIVE';
    const stableGroups=byDelay.filter(x=>x.n>=4);
    let message='Tarvitset vähintään 8 kirjattua outcomea ennen kuvailevaa yhteenvetoa.';
    if(sufficient){
      const d=overall.medianUrgeDelta;
      const nc=overall.nonContinueRate;
      if((d==null||Math.abs(d)<0.75) && (nc==null || (nc>0.35&&nc<0.65))) message='Ei havaittavaa selvää outcome-rakennetta tässä aineistossa. Oe.';
      else message='Aineistossa näkyy kuvailevia eroja. Ne eivät osoita, että kitka aiheutti muutoksen.';
    }
    return {version:VERSION,maturity,overall,byDelay,byRule,byPattern,stableGroups,message};
  }

  function exportBundle(rows=[]){ return {format:FORMAT,version:SCHEMA_VERSION,exportedAt:new Date().toISOString(),outcomes:(Array.isArray(rows)?rows:[]).map(normalize),note:'Descriptive self-observation outcomes. No causal claim is implied.'}; }
  function importBundle(payload){ if(!payload||payload.format!==FORMAT||Number(payload.version)!==SCHEMA_VERSION||!Array.isArray(payload.outcomes))throw new Error('Tuntematon Outcome Lab -tiedostomuoto.'); return payload.outcomes.map(normalize); }

  function selfTest(){
    const problems=[];
    const rows=Array.from({length:20},(_,i)=>normalize({delayMinutes:i<10?2:10,urgeBefore:8,urgeAfter:i<10?7:4,decision:i<10?'continued':'stopped',ruleNames:[i<10?'2 min':'10 min'],patternIds:['scarcity']}));
    const a=analyze(rows); const low=analyze(rows.slice(0,5));
    if(a.overall.n!==20||a.byDelay.length!==2)problems.push('group summary failed');
    if(a.overall.medianUrgeDelta!==-2.5)problems.push('median delta failed');
    if(low.maturity!=='INSUFFICIENT')problems.push('minimum-N gate failed');
    const missing=normalize({urgeBefore:null,urgeAfter:'',afterCost:null}); if(missing.urgeDelta!==null||missing.afterCost!==null)problems.push('missing values coerced');
    return {ok:problems.length===0,problems,version:VERSION};
  }

  globalThis.BHCOutcomeCore=Object.freeze({VERSION,FORMAT,SCHEMA_VERSION,normalize,summarize,analyze,exportBundle,importBundle,selfTest,delayBand});
})();
