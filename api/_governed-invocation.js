import { webcrypto } from 'node:crypto';
const cryptoImpl=globalThis.crypto?.subtle?globalThis.crypto:webcrypto;
const enc=new TextEncoder();
const EXPECTED_CALLER='bhc.core';
const EXPECTED_KEY_ID='bhc-core-invocation-0.9';
const EXPECTED_FINGERPRINT="sha256:1dl3LpgiSFd1a177Jk_qik9Ti1-1vpInnLhp4SneuOA";
const EXPECTED_PUBLIC_JWK={"key_ops":["verify"],"ext":true,"kty":"EC","x":"qGndOeMaBCJ6QWNLcDBx6CknHwxRCwZTJDp9d5s8wr8","y":"NwxbHGbI1mhl9U8Wrgeg9Hk5TszRBs1mMbTQI-wOVRY","crv":"P-256"};
const MAX_SKEW_MS=90_000;
const replayCache=new Map();
function canonicalize(v){if(v===null||typeof v!=='object')return JSON.stringify(v);if(Array.isArray(v))return `[${v.map(canonicalize).join(',')}]`;return `{${Object.keys(v).sort().map(k=>`${JSON.stringify(k)}:${canonicalize(v[k])}`).join(',')}}`;}
function b64url(bytes){return Buffer.from(new Uint8Array(bytes)).toString('base64url');}
function unb64url(v){return Uint8Array.from(Buffer.from(String(v||''),'base64url'));}
async function sha256Text(value){return `sha256:${b64url(await cryptoImpl.subtle.digest('SHA-256',enc.encode(String(value??''))))}`;}
function getHeader(headers,name){if(typeof headers?.get==='function')return headers.get(name);const lower=name.toLowerCase();for(const [k,v] of Object.entries(headers||{}))if(k.toLowerCase()===lower)return Array.isArray(v)?v[0]:v;return null;}
function contractFromHeaders(headers){return{schema:getHeader(headers,'x-bhc-invocation-schema'),callerId:getHeader(headers,'x-bhc-caller'),targetNodeId:getHeader(headers,'x-bhc-target'),toolId:getHeader(headers,'x-bhc-tool-id'),method:getHeader(headers,'x-bhc-method'),path:getHeader(headers,'x-bhc-path'),timestamp:getHeader(headers,'x-bhc-timestamp'),nonce:getHeader(headers,'x-bhc-nonce'),bodySha256:getHeader(headers,'x-bhc-body-sha256'),permission:getHeader(headers,'x-bhc-permission'),requestId:getHeader(headers,'x-bhc-request-id')};}
export function clearReplayCache(){replayCache.clear();}
export async function verifyGovernedInvocation(req,body,{target='bhc.universal-xray',toolId='xray.inspect',permission='node:invoke',path='/api/inspect',now=Date.now()}={}){
  try{
    const contract=contractFromHeaders(req.headers||{});
    const signature=getHeader(req.headers,'x-bhc-signature');
    const keyId=getHeader(req.headers,'x-bhc-key-id');
    const fingerprint=getHeader(req.headers,'x-bhc-key-fingerprint');
    if(contract.schema!=='bhc.invocation/v0.9')return{ok:false,status:401,error:'SIGNED_INVOCATION_REQUIRED'};
    if(contract.callerId!==EXPECTED_CALLER||contract.targetNodeId!==target||contract.toolId!==toolId||contract.permission!==permission)return{ok:false,status:403,error:'INVOCATION_SCOPE_MISMATCH'};
    if(String(contract.method||'').toUpperCase()!==String(req.method||'POST').toUpperCase()||contract.path!==path)return{ok:false,status:403,error:'INVOCATION_ROUTE_MISMATCH'};
    if(keyId!==EXPECTED_KEY_ID||fingerprint!==EXPECTED_FINGERPRINT)return{ok:false,status:403,error:'INVOCATION_KEY_NOT_TRUSTED'};
    const computedFingerprint=await sha256Text(canonicalize(EXPECTED_PUBLIC_JWK));
    if(computedFingerprint!==EXPECTED_FINGERPRINT)return{ok:false,status:503,error:'PINNED_KEY_FINGERPRINT_INVALID'};
    const ts=Date.parse(contract.timestamp);
    if(!Number.isFinite(ts)||Math.abs(now-ts)>MAX_SKEW_MS)return{ok:false,status:401,error:'INVOCATION_TIMESTAMP_INVALID',maxSkewMs:MAX_SKEW_MS};
    if(!contract.nonce||String(contract.nonce).length<12)return{ok:false,status:401,error:'INVOCATION_NONCE_REQUIRED'};
    for(const [nonce,expires] of replayCache)if(expires<=now)replayCache.delete(nonce);
    if(replayCache.has(contract.nonce))return{ok:false,status:409,error:'INVOCATION_REPLAY_DETECTED'};
    const bodyDigest=await sha256Text(canonicalize(body??{}));
    if(bodyDigest!==contract.bodySha256)return{ok:false,status:401,error:'INVOCATION_BODY_DIGEST_MISMATCH'};
    const key=await cryptoImpl.subtle.importKey('jwk',EXPECTED_PUBLIC_JWK,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
    const valid=await cryptoImpl.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,unb64url(signature),enc.encode(canonicalize(contract)));
    if(!valid)return{ok:false,status:401,error:'INVOCATION_SIGNATURE_INVALID'};
    replayCache.set(contract.nonce,now+MAX_SKEW_MS);
    return{ok:true,status:200,request:{caller:contract.callerId,target:contract.targetNodeId,toolId:contract.toolId,permission:contract.permission,timestamp:contract.timestamp,nonce:contract.nonce,bodySha256:contract.bodySha256,keyId,fingerprint,requestId:contract.requestId},replayScope:'process-local-warm-instance',maxSkewMs:MAX_SKEW_MS};
  }catch(error){return{ok:false,status:401,error:'INVOCATION_VERIFY_ERROR',message:error?.message||String(error)};}
}
