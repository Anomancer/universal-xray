(() => {
  'use strict';

  const VERSION = '1.10.0';
  const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const clamp = (n,a,b) => Math.max(a,Math.min(b,n));

  function decimalOddsList(input) {
    const values = Array.isArray(input) ? input : String(input || '').split(/[\n;]+/);
    return values.map(v => Number(String(v).trim().replace(',', '.'))).filter(v => Number.isFinite(v) && v > 1);
  }

  function marketMargin(input) {
    const odds = decimalOddsList(input);
    if (odds.length < 2) return { ok:false, error:'Syötä vähintään kaksi toisensa poissulkevan lopputuloksen desimaalikerrointa.' };
    const implied = odds.map(o => 1/o);
    const sum = implied.reduce((a,b)=>a+b,0);
    const overround = sum - 1;
    const normalized = implied.map(p => p/sum);
    return {
      ok:true, odds, implied, impliedSum:sum, overround, overroundPct:overround*100,
      quotedPayoutProxy:1/sum,
      normalized,
      rows:odds.map((o,i)=>({ odds:o, rawImplied:implied[i], normalized:normalized[i] }))
    };
  }

  function accumulator({ legProbability=0.6, legs=4 }={}) {
    const p = clamp(Number(legProbability) || 0, 0.000001, 0.999999);
    const n = clamp(Math.round(Number(legs) || 1), 1, 30);
    const joint = Math.pow(p,n);
    return {
      ok:true, legProbability:p, legs:n, jointProbability:joint,
      atLeastOneMiss:1-joint,
      fairJointDecimalOdds:1/joint
    };
  }

  function lottery({ ticketPrice=1, combinations=10000000, jackpot=1000000, otherPrizeEv=0 }={}) {
    const price=Math.max(0.000001,Number(ticketPrice)||0);
    const combos=Math.max(1,Math.floor(Number(combinations)||1));
    const top=Math.max(0,Number(jackpot)||0);
    const other=Math.max(0,Number(otherPrizeEv)||0);
    const p=1/combos;
    const jackpotEv=top*p;
    const grossEv=jackpotEv+other;
    return {
      ok:true,ticketPrice:price,combinations:combos,jackpot:top,otherPrizeEv:other,
      jackpotProbability:p, jackpotEv, grossEv, netEv:grossEv-price,
      returnRate:grossEv/price, lossRate:1-(grossEv/price)
    };
  }

  function pariMutuel({ pool=100000, takeoutPct=15, winningPoolSharePct=20, stake=10 }={}) {
    const grossPool=Math.max(0,Number(pool)||0);
    const takeout=clamp((Number(takeoutPct)||0)/100,0,0.95);
    const share=clamp((Number(winningPoolSharePct)||0)/100,0.000001,1);
    const s=Math.max(0,Number(stake)||0);
    const netPool=grossPool*(1-takeout);
    const winningMoney=grossPool*share;
    const payoutPerEuro=winningMoney>0?netPool/winningMoney:0;
    return {
      ok:true,pool:grossPool,takeoutPct:takeout*100,takeoutAmount:grossPool*takeout,
      netPool,winningPoolSharePct:share*100,winningMoney,payoutPerEuro,
      exampleStake:s,exampleGrossReturn:s*payoutPerEuro
    };
  }

  function selfTest() {
    const problems=[];
    const m=marketMargin([2.0,2.0]);
    if(!m.ok || Math.abs(m.overroundPct)>1e-10) problems.push('fair market margin failed');
    const m2=marketMargin([1.91,1.91]);
    if(!m2.ok || !(m2.overroundPct>4 && m2.overroundPct<5)) problems.push('overround example failed');
    const a=accumulator({legProbability:.5,legs:4});
    if(Math.abs(a.jointProbability-.0625)>1e-12) problems.push('accumulator probability failed');
    const l=lottery({ticketPrice:1,combinations:1000000,jackpot:1000000,otherPrizeEv:0});
    if(Math.abs(l.jackpotEv-1)>1e-12) problems.push('lottery EV failed');
    const p=pariMutuel({pool:100,takeoutPct:20,winningPoolSharePct:25,stake:1});
    if(Math.abs(p.payoutPerEuro-3.2)>1e-12) problems.push('pari-mutuel payout failed');
    return {ok:problems.length===0,problems,version:VERSION};
  }

  globalThis.BHCOddsCore = Object.freeze({ VERSION, decimalOddsList, marketMargin, accumulator, lottery, pariMutuel, selfTest });
})();
