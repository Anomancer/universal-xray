import { loadNativeXRay } from './_native-xray-runtime.js';

export default async function handler(req, res) {
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','no-store');
  res.setHeader('x-bhc-node','bhc.universal-xray');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode=405; res.setHeader('allow','GET, HEAD'); return res.end(JSON.stringify({ok:false,error:'METHOD_NOT_ALLOWED'}));
  }
  try {
    const runtime = await loadNativeXRay(req);
    const body={
      ok:true,
      schema:'bhc.node-health/v0.9',
      id:'bhc.universal-xray',
      name:'BHC Universal X-Ray',
      mode:'native',
      callable:true,
      engine:runtime.versions,
      selfTest:runtime.selfTest,
      privacy:{browserEgress:0,networkApi:'explicit-only'},
      invocation:{required:true,schema:'bhc.invocation/v0.9',caller:'bhc.core',keyId:'bhc-core-invocation-0.9',fingerprint:'sha256:1dl3LpgiSFd1a177Jk_qik9Ti1-1vpInnLhp4SneuOA',replayGuard:'process-local-warm-instance',maxTimestampSkewMs:90000},
      checkedAt:new Date().toISOString()
    };
    res.statusCode=200; return req.method==='HEAD'?res.end():res.end(JSON.stringify(body));
  } catch(error) {
    res.statusCode=503; return req.method==='HEAD'?res.end():res.end(JSON.stringify({ok:false,id:'bhc.universal-xray',mode:'native',callable:false,error:error?.message||String(error),checkedAt:new Date().toISOString()}));
  }
}
