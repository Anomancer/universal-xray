# BHC Universal X-Ray 2.2 · Governed Invocation native node

This additive patch upgrades the existing Universal X-Ray native node from callable-native to governed-native.

## Adds / changes

- `POST /api/inspect` now requires `bhc.invocation/v0.9` signed by the pinned BHC CORE invocation key.
- Request body SHA-256 is verified before execution.
- Timestamp freshness window is 90 seconds.
- Nonces are remembered in a bounded process-local cache for 120 seconds to reject warm-instance replays.
- `/.well-known/bhc-capabilities.json` advertises runtime tool requirements.
- `/.well-known/bhc-core-invocation-trust.json` publishes the pinned caller key used by this node.
- Browser UI remains `APP EGRESS 0`.

## Important replay boundary

The included replay guard is deliberately honest: it is scoped to a warm Vercel Function instance. A replay that lands on another cold instance or region inside the freshness window may not hit the same nonce cache. The signature, body digest and timestamp are still verified. Durable global replay protection is a future storage-backed upgrade.

## Install

Run `./apply-native-node.sh /path/to/universal-xray-source` and deploy the same `universal-xray` project.

The node will reject unsigned `/api/inspect` calls after this upgrade.
