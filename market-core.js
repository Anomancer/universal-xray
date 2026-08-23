(() => {
  'use strict';

  const VERSION='1.10.0';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

  function mulberry32(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function normal(rng){let u=0,v=0;while(!u)u=rng();while(!v)v=rng();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);}

  function simulateCandles({steps=240,start=100,volatilityPct=1,driftPct=0,seed=12345}={}){
    const n=clamp(Math.floor(Number(steps)||240),20,5000);
    const vol=clamp((Number(volatilityPct)||1)/100,0.00001,0.5);
    const drift=clamp((Number(driftPct)||0)/100,-0.1,0.1);
    const rng=mulberry32(Number(seed)||12345);
    let prev=Math.max(0.0001,Number(start)||100);
    const candles=[];
    for(let i=0;i<n;i++){
      const open=prev;
      const ret=drift+normal(rng)*vol;
      const close=Math.max(0.000001,open*Math.exp(ret));
      const wick=Math.abs(normal(rng))*vol*.55;
      const high=Math.max(open,close)*(1+wick*rng());
      const low=Math.max(0.000001,Math.min(open,close)*(1-wick*rng()));
      candles.push({i,open,high,low,close,green:close>=open});
      prev=close;
    }
    return candles;
  }

  function maxDrawdown(candles){
    let peak=candles[0]?.close||0,max=0;
    for(const c of candles){peak=Math.max(peak,c.close);if(peak>0)max=Math.max(max,(peak-c.close)/peak);}return max;
  }

  function candleStats(candles){
    const arr=Array.isArray(candles)?candles:[];
    if(arr.length<2)return {n:arr.length,baselineGreenRate:null,threeGreenN:0,afterThreeGreenRate:null,totalReturn:null,maxDrawdown:null,longestGreenRun:0};
    let greens=0,longest=0,run=0,patternN=0,patternNextGreen=0;
    arr.forEach(c=>{if(c.green){greens++;run++;longest=Math.max(longest,run);}else run=0;});
    for(let i=3;i<arr.length;i++){
      if(arr[i-1].green&&arr[i-2].green&&arr[i-3].green){patternN++;if(arr[i].green)patternNextGreen++;}
    }
    return {
      n:arr.length,baselineGreenRate:greens/arr.length,threeGreenN:patternN,
      afterThreeGreenRate:patternN?patternNextGreen/patternN:null,
      totalReturn:(arr[arr.length-1].close/arr[0].open)-1,maxDrawdown:maxDrawdown(arr),longestGreenRun:longest
    };
  }

  function patternNullExperiment({paths=200,steps=320,volatilityPct=1,seed=424242}={}){
    const p=clamp(Math.floor(Number(paths)||200),10,1000);
    const s=clamp(Math.floor(Number(steps)||320),40,2000);
    let baselineN=0,baselineGreen=0,patternN=0,patternGreen=0;
    for(let path=0;path<p;path++){
      const candles=simulateCandles({steps:s,volatilityPct,seed:(Number(seed)||424242)+path*7919});
      for(let i=0;i<candles.length;i++){baselineN++;if(candles[i].green)baselineGreen++;if(i>=3&&candles[i-1].green&&candles[i-2].green&&candles[i-3].green){patternN++;if(candles[i].green)patternGreen++;}}
    }
    const baseline=baselineN?baselineGreen/baselineN:null;
    const after=patternN?patternGreen/patternN:null;
    return {paths:p,steps:s,baselineN,baselineGreenRate:baseline,threeGreenN:patternN,afterThreeGreenRate:after,difference:(after!=null&&baseline!=null)?after-baseline:null};
  }

  function costDrag({capital=10000,tradesPerDay=5,days=20,turnoverPct=100,spreadBps=5,feeBps=2,slippageBps=3}={}){
    const cap=Math.max(0,Number(capital)||0);
    const trades=clamp(Number(tradesPerDay)||0,0,10000);
    const d=clamp(Number(days)||0,0,3650);
    const turnover=clamp((Number(turnoverPct)||0)/100,0,100);
    const bps=Math.max(0,Number(spreadBps)||0)+Math.max(0,Number(feeBps)||0)+Math.max(0,Number(slippageBps)||0);
    const perTradeNotional=cap*turnover;
    const totalTrades=trades*d;
    const totalNotional=perTradeNotional*totalTrades;
    const drag=totalNotional*(bps/10000);
    return {capital:cap,totalTrades,perTradeNotional,totalNotional,totalBpsPerRoundTrip:bps,cost:drag,costPctOfCapital:cap?drag/cap:null};
  }

  function leverageRisk({capital=1000,leverage=10,adverseMovePct=5}={}){
    const cap=Math.max(0,Number(capital)||0);
    const lev=clamp(Number(leverage)||1,1,500);
    const move=clamp((Number(adverseMovePct)||0)/100,0,1);
    const notional=cap*lev;
    const pnl=-notional*move;
    const equity=cap+pnl;
    return {capital:cap,leverage:lev,notional,adverseMovePct:move*100,pnl,equityAfter:equity,equityChangePct:cap?pnl/cap:null,approxWipeMovePct:100/lev};
  }

  function selfTest(){
    const problems=[];
    const c=simulateCandles({steps:100,seed:1});if(c.length!==100||c.some(x=>!(x.high>=Math.max(x.open,x.close)&&x.low<=Math.min(x.open,x.close))))problems.push('candle generation failed');
    const n=patternNullExperiment({paths:300,steps:300,seed:7});if(n.difference==null||Math.abs(n.difference)>.08)problems.push('null experiment drift too large');
    const cost=costDrag({capital:10000,tradesPerDay:1,days:1,turnoverPct:100,spreadBps:10,feeBps:0,slippageBps:0});if(Math.abs(cost.cost-10)>1e-9)problems.push('cost drag failed');
    const lev=leverageRisk({capital:1000,leverage:10,adverseMovePct:5});if(Math.abs(lev.pnl+500)>1e-9||Math.abs(lev.approxWipeMovePct-10)>1e-9)problems.push('leverage failed');
    return {ok:problems.length===0,problems,version:VERSION,nullDifference:n.difference};
  }

  globalThis.BHCMarketCore=Object.freeze({VERSION,simulateCandles,candleStats,patternNullExperiment,costDrag,leverageRisk,selfTest});
})();
