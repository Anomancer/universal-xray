import { loadNativeXRay } from './_native-xray-runtime.js';
import { verifyGovernedInvocation } from './_governed-invocation.js';

const MAX_TEXT = 100_000;
const ALLOWED_LENSES = new Set(['general','news','guru','shopping','work','relationship','ai','health','dating','productivity','investing','betting','trading']);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-bhc-node', 'bhc.universal-xray');
  res.end(JSON.stringify(body));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return json(res, 405, { ok:false, error:'METHOD_NOT_ALLOWED', message:'Use POST /api/inspect' });
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const governed=await verifyGovernedInvocation(req,body);
    if(!governed.ok) return json(res,governed.status,{ok:false,error:governed.error,maxSkewMs:governed.maxSkewMs??undefined});
    const text = String(body.text || '').trim();
    const lens = String(body.lens || 'general').trim();
    if (!text) return json(res, 400, { ok:false, error:'TEXT_REQUIRED' });
    if (text.length > MAX_TEXT) return json(res, 413, { ok:false, error:'TEXT_TOO_LARGE', maxChars:MAX_TEXT });
    if (!ALLOWED_LENSES.has(lens)) return json(res, 400, { ok:false, error:'UNKNOWN_LENS', lens, allowed:[...ALLOWED_LENSES] });

    const runtime = await loadNativeXRay(req);
    const result = runtime.core.analyze(text, lens);
    return json(res, 200, {
      ok:true,
      schema:'bhc.native-tool-result/v0.9',
      appId:'bhc.universal-xray',
      toolId:'xray.inspect',
      mode:'native',
      engine:{ universalCore:runtime.versions.universalCore, patternLibrary:runtime.versions.patternLibrary },
      privacyBoundary:'Browser UI remains APP EGRESS 0. This server API runs only for a valid governed invocation.',
      invocation:{schema:'bhc.invocation/v0.9',verified:true,request:governed.request,replayScope:governed.replayScope},
      result
    });
  } catch (error) {
    return json(res, 500, { ok:false, error:'XRAY_NATIVE_RUNTIME_FAILED', message:error?.message || String(error) });
  }
}
