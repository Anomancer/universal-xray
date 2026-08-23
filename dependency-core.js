(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BHCDependencyLab = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const finite = (v) => (v === null || v === undefined || v === '' || typeof v === 'boolean') ? null : (Number.isFinite(Number(v)) ? Number(v) : null);
  const mean = (xs) => xs.length ? xs.reduce((a,b)=>a+b,0) / xs.length : null;
  const variance = (xs, m = mean(xs)) => xs.length > 1 ? xs.reduce((s,x)=>s+(x-m)**2,0)/(xs.length-1) : null;

  function pearson(x, y) {
    const pairs = x.map((v,i)=>[finite(v), finite(y[i])]).filter(([a,b])=>a != null && b != null);
    if (pairs.length < 3) return { n:pairs.length, r:null };
    const xs = pairs.map(p=>p[0]), ys = pairs.map(p=>p[1]);
    const mx = mean(xs), my = mean(ys);
    const sx = Math.sqrt(xs.reduce((s,v)=>s+(v-mx)**2,0));
    const sy = Math.sqrt(ys.reduce((s,v)=>s+(v-my)**2,0));
    if (!sx || !sy) return { n:pairs.length, r:0 };
    const num = pairs.reduce((s,[a,b])=>s+(a-mx)*(b-my),0);
    return { n:pairs.length, r:num/(sx*sy) };
  }

  function etaSquared(groups, values) {
    const rows = groups.map((g,i)=>[String(g || '').trim(), finite(values[i])]).filter(([g,v])=>g && v != null);
    if (rows.length < 4) return { n:rows.length, groups:0, eta2:null, means:{} };
    const buckets = new Map();
    rows.forEach(([g,v])=>{ if(!buckets.has(g)) buckets.set(g,[]); buckets.get(g).push(v); });
    const usable = [...buckets.entries()].filter(([,vs])=>vs.length >= 2);
    if (usable.length < 2) return { n:rows.length, groups:usable.length, eta2:null, means:Object.fromEntries(usable.map(([g,vs])=>[g,mean(vs)])) };
    const filtered = usable.flatMap(([g,vs])=>vs.map(v=>[g,v]));
    const grand = mean(filtered.map(([,v])=>v));
    const ssTotal = filtered.reduce((s,[,v])=>s+(v-grand)**2,0);
    const ssBetween = usable.reduce((s,[,vs])=>s + vs.length*(mean(vs)-grand)**2, 0);
    return { n:filtered.length, groups:usable.length, eta2:ssTotal ? ssBetween/ssTotal : 0, means:Object.fromEntries(usable.map(([g,vs])=>[g,mean(vs)])) };
  }

  function circularShiftP(x, y, effectFn, observedAbs, minShift = 1, maxShifts = 49) {
    const n = Math.min(x.length, y.length);
    if (n < 6 || observedAbs == null) return null;
    const available = Math.max(0, n - minShift);
    const count = Math.min(available, Math.max(1, maxShifts));
    const shifts = new Set();
    if (count === 1) shifts.add(minShift);
    else for (let i=0;i<count;i++) shifts.add(Math.round(minShift + i * ((n - 1) - minShift) / (count - 1)));
    let extreme = 0, tested = 0;
    for (const shift of shifts) {
      if (shift <= 0 || shift >= n) continue;
      const shifted = y.map((_,i)=>y[(i+shift)%n]);
      const effect = effectFn(x, shifted);
      const val = typeof effect === 'number' ? effect : effect?.r ?? effect?.eta2;
      if (val == null || !Number.isFinite(val)) continue;
      tested++;
      if (Math.abs(val) >= Math.abs(observedAbs) - 1e-12) extreme++;
    }
    return tested ? (extreme + 1) / (tested + 1) : null;
  }

  const magnitudeR = (r) => {
    const a = Math.abs(r || 0);
    if (a < .1) return 'none';
    if (a < .3) return 'small';
    if (a < .5) return 'moderate';
    return 'large';
  };
  const magnitudeEta = (e) => {
    const a = Math.abs(e || 0);
    if (a < .01) return 'none';
    if (a < .06) return 'small';
    if (a < .14) return 'moderate';
    return 'large';
  };

  function classification(effectMagnitude, shiftP, n) {
    if (n < 14) return 'insufficient';
    if (effectMagnitude === 'none') return 'none';
    if (shiftP != null && shiftP > .20 && (effectMagnitude === 'small' || effectMagnitude === 'moderate')) return 'unstable';
    return n < 30 ? 'preliminary' : 'descriptive';
  }

  function triggerSummary(entries) {
    const rows = entries.filter(e => String(e.triggerGroup || '').trim() && finite(e.urge) != null);
    const groups = rows.map(e=>e.triggerGroup), urges=rows.map(e=>finite(e.urge));
    const stat = etaSquared(groups, urges);
    const shiftP = stat.eta2 == null ? null : circularShiftP(groups, urges, (g,u)=>etaSquared(g,u), stat.eta2);
    const ranked = Object.entries(stat.means || {}).sort((a,b)=>b[1]-a[1]);
    return { kind:'trigger', n:stat.n, effect:stat.eta2, effectLabel:'η²', magnitude:magnitudeEta(stat.eta2), shiftP, classification:classification(magnitudeEta(stat.eta2),shiftP,stat.n), top:ranked[0] || null, groups:stat.groups, means:stat.means };
  }

  function sleepSummary(entries) {
    const rows = entries.filter(e=>finite(e.sleep)!=null && finite(e.urge)!=null);
    const xs=rows.map(e=>finite(e.sleep)), ys=rows.map(e=>finite(e.urge));
    const stat=pearson(xs,ys);
    const shiftP=stat.r==null?null:circularShiftP(xs,ys,(a,b)=>pearson(a,b),stat.r);
    const mag=magnitudeR(stat.r);
    return { kind:'sleep', n:stat.n, effect:stat.r, effectLabel:'r', magnitude:mag, shiftP, classification:classification(mag,shiftP,stat.n) };
  }

  function actionCostSummary(entries) {
    const rows = entries.filter(e=>typeof e.acted === 'boolean' && finite(e.afterCost)!=null);
    const xs=rows.map(e=>e.acted?1:0), ys=rows.map(e=>finite(e.afterCost));
    const stat=pearson(xs,ys);
    const shiftP=stat.r==null?null:circularShiftP(xs,ys,(a,b)=>pearson(a,b),stat.r);
    const acted=rows.filter(e=>e.acted).map(e=>finite(e.afterCost));
    const not=rows.filter(e=>!e.acted).map(e=>finite(e.afterCost));
    const mag=magnitudeR(stat.r);
    return { kind:'action-cost', n:stat.n, effect:stat.r, effectLabel:'rpb', magnitude:mag, shiftP, classification:classification(mag,shiftP,stat.n), actedMean:mean(acted), notActedMean:mean(not), actedN:acted.length, notActedN:not.length };
  }

  function rewardCostSummary(entries) {
    const rows=entries.filter(e=>finite(e.rewardScore)!=null && finite(e.afterCost)!=null);
    const xs=rows.map(e=>finite(e.rewardScore)), ys=rows.map(e=>finite(e.afterCost));
    const stat=pearson(xs,ys);
    const shiftP=stat.r==null?null:circularShiftP(xs,ys,(a,b)=>pearson(a,b),stat.r);
    const mag=magnitudeR(stat.r);
    return { kind:'reward-cost', n:stat.n, effect:stat.r, effectLabel:'r', magnitude:mag, shiftP, classification:classification(mag,shiftP,stat.n) };
  }

  function weekdaySummary(entries) {
    const rows=entries.filter(e=>/^\d{4}-\d{2}-\d{2}$/.test(String(e.date||'')) && finite(e.urge)!=null);
    const groups=rows.map(e=>String(new Date(`${e.date}T12:00:00`).getDay())), urges=rows.map(e=>finite(e.urge));
    const stat=etaSquared(groups,urges);
    const shiftP=stat.eta2==null?null:circularShiftP(groups,urges,(g,u)=>etaSquared(g,u),stat.eta2);
    const mag=magnitudeEta(stat.eta2);
    return { kind:'weekday', n:stat.n, effect:stat.eta2, effectLabel:'η²', magnitude:mag, shiftP, classification:classification(mag,shiftP,stat.n), groups:stat.groups };
  }

  function analyze(entries) {
    const sorted=[...(entries||[])].filter(Boolean).sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
    const tests=[sleepSummary(sorted), triggerSummary(sorted), actionCostSummary(sorted), rewardCostSummary(sorted), weekdaySummary(sorted)];
    const eligible=tests.filter(t=>t.classification!=='insufficient');
    const detectable=eligible.filter(t=>!['none','unstable'].includes(t.classification));
    return {
      version:'1.0.0',
      n:sorted.length,
      threshold:{ minimum:14, descriptive:30 },
      status: sorted.length < 14 ? 'insufficient' : sorted.length < 30 ? 'preliminary' : 'descriptive',
      tests,
      detectableCount:detectable.length,
      noDetectablePattern:eligible.length>0 && detectable.length===0
    };
  }

  return { mean, variance, pearson, etaSquared, circularShiftP, analyze };
});
