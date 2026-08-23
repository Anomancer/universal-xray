const quantile = (sorted, q) => {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
};

function makeDistribution(volatility, target) {
  const tables = {
    low: [
      { p:0.55, m:0 }, { p:0.20, m:0.50 }, { p:0.15, m:1.00 },
      { p:0.07, m:2.00 }, { p:0.025, m:5.00 }, { p:0.005, m:20.00 }
    ],
    medium: [
      { p:0.72, m:0 }, { p:0.10, m:0.25 }, { p:0.08, m:0.50 }, { p:0.045, m:1.00 },
      { p:0.03, m:2.00 }, { p:0.018, m:5.00 }, { p:0.006, m:20.00 }, { p:0.001, m:100.00 }
    ],
    high: [
      { p:0.86, m:0 }, { p:0.06, m:0.25 }, { p:0.035, m:0.50 }, { p:0.02, m:1.00 },
      { p:0.015, m:2.00 }, { p:0.008, m:10.00 }, { p:0.0018, m:50.00 }, { p:0.0002, m:250.00 }
    ]
  };
  const base = tables[volatility] || tables.medium;
  const pSum = base.reduce((s,row)=>s+row.p,0);
  const baseEv = base.reduce((s,row)=>s+row.p*row.m,0) / pSum;
  const scale = target / baseEv;
  let cumulative = 0;
  return base.map(row => {
    cumulative += row.p / pSum;
    return { c:cumulative, m:row.m * scale };
  });
}

function sampleMultiplier(cdf) {
  const r = Math.random();
  for (let i=0;i<cdf.length;i++) if (r <= cdf[i].c) return cdf[i].m;
  return cdf[cdf.length-1].m;
}

function runCasino(data) {
  const target = Math.max(0.5, Math.min(1, Number(data.rtp) / 100));
  const wager = Math.max(0.01, Number(data.stake) || 1);
  const count = Math.max(1, Math.min(1000000, Math.floor(Number(data.spins) || 100000)));
  const start = Math.max(wager, Number(data.bankroll) || 1000);
  const requestedRuns = Math.max(1, Math.min(50, Math.floor(Number(data.runs) || 1)));
  const runs = Math.max(1, Math.min(requestedRuns, Math.floor(5000000 / count) || 1));
  const volatility = ['low','medium','high'].includes(data.volatility) ? data.volatility : 'medium';
  const cdf = makeDistribution(volatility, target);
  const sampleEvery = Math.max(1, Math.floor(count / 220));
  const results = [];
  let firstSamples = [];

  for (let run=0; run<runs; run++) {
    let balance = start;
    let totalReturn = 0;
    let ldiw = 0;
    let winning = 0;
    let minBalance = balance;
    let maxBalance = balance;
    const samples = [];

    for (let i=1; i<=count; i++) {
      const mult = sampleMultiplier(cdf);
      const payout = wager * mult;
      balance += payout - wager;
      totalReturn += payout;
      if (payout > 0 && payout < wager) ldiw++;
      if (payout > wager) winning++;
      if (balance < minBalance) minBalance = balance;
      if (balance > maxBalance) maxBalance = balance;
      if (run === 0 && (i % sampleEvery === 0 || i === count)) samples.push({spin:i,balance});
    }
    if (run === 0) firstSamples = samples;
    const totalWagered = wager * count;
    results.push({
      net:balance-start,
      simulatedRtp:totalReturn/totalWagered,
      ldiw,
      winning,
      minBalance,
      maxBalance,
      ruined:minBalance < wager
    });
  }

  const nets = results.map(r=>r.net).sort((a,b)=>a-b);
  const theoreticalNet = wager * count * (target - 1);
  const profitableRuns = results.filter(r=>r.net > 0).length;
  const ruinRuns = results.filter(r=>r.ruined).length;
  const mean = (arr, key) => arr.reduce((s,x)=>s+(key ? x[key] : x),0)/Math.max(1,arr.length);

  self.postMessage({
    mode:'casino', count, start, wager, runs, requestedRuns, volatility,
    targetRtp:target, houseEdge:1-target, theoreticalNet,
    medianNet:quantile(nets,.5), p10Net:quantile(nets,.1), p90Net:quantile(nets,.9),
    meanNet:mean(nets), profitableRuns, ruinRuns,
    meanLdiw:mean(results,'ldiw'), meanWinning:mean(results,'winning'),
    meanSimulatedRtp:mean(results,'simulatedRtp'),
    firstRunNet:results[0]?.net || 0,
    samples:firstSamples
  });
}

function runNearMiss(data) {
  const trials = Math.max(10000, Math.min(1000000, Math.floor(Number(data.trials) || 200000)));
  const jackpotP = 0.02;
  const nearP = 0.12;
  let afterNearTrials = 0;
  let afterNearHits = 0;
  let baselineHits = 0;

  for (let i=0; i<trials; i++) {
    const previousWasNear = Math.random() < nearP;
    const nextIsJackpot = Math.random() < jackpotP;
    if (nextIsJackpot) baselineHits++;
    if (previousWasNear) {
      afterNearTrials++;
      if (nextIsJackpot) afterNearHits++;
    }
  }

  self.postMessage({
    mode:'nearMiss', trials, jackpotP, nearP, afterNearTrials, afterNearHits,
    baselineRate:baselineHits/trials,
    afterNearRate:afterNearHits/Math.max(1,afterNearTrials)
  });
}

self.onmessage = (event) => {
  const data = event.data || {};
  if (data.mode === 'nearMiss') return runNearMiss(data);
  return runCasino(data);
};
