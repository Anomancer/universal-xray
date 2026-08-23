# BHC Universal X-Ray

A local-first browser laboratory for inspecting mechanisms behind text, gambling, markets, behavioural loops and interface pressure.

**Live:** https://universal-xray.vercel.app/

Universal X-Ray is built around one idea:

> Make the mechanism visible before interpreting it.

The application runs primarily in the browser and separates measured, calculated, simulated, user-reported, heuristic and interpretive outputs instead of collapsing everything into one score.

## What it contains

- Text X-Ray for claims, assumptions, framing and uncertainty
- Pattern Atlas for structural mechanism mapping
- Casino mathematics and RTP / EV simulation
- Betting and lottery mathematics
- Synthetic market experiments and null baselines
- Behavioural loop mapping
- Impulse delay tools
- Voluntary friction rules
- Local journal and descriptive longitudinal analysis
- Outcome tracking
- Calm Room
- Browser-extension bridge
- Local backup / restore
- Technical Engine Room

## Architecture

The application is intentionally modular.

    index.html
    app.js
    i18n.js

    universal-core.js
    pattern-library.js
    dependency-core.js
    friction-core.js
    outcome-core.js
    odds-core.js
    market-core.js
    vault-core.js
    module-core.js

    casino-worker.js
    service-worker.js

The UI acts as a shell around independent browser-side cores.

Internal identifiers remain language-independent while the interface can switch between Finnish and English.

## Local-first design

User-facing analysis and local tools are designed to run without sending user content to external analytics or AI services.

Application state is stored locally in browser storage.

The application also includes:

- Content Security Policy
- same-origin network policy
- local backup format
- offline support
- PWA service worker
- explicit evidence-type labels

## Evidence model

Outputs are classified as:

- MEASURED
- CALCULATED
- SIMULATED
- USER-REPORTED
- HEURISTIC
- INTERPRETATION

These categories are deliberately kept separate.

A heuristic observation is not presented as a measurement, and a structural pattern match is not treated as proof of intent or truth.

## Universal Text X-Ray

The text analysis layer decomposes text into structures such as:

- claims
- visible support
- assumptions and logic bridges
- framing
- emotional hooks
- incentives
- uncertainty
- counter-tests

It does not perform external fact checking and does not infer the author's real intent.

## Pattern Atlas

Pattern Atlas provides a structural map of recurring mechanisms.

Relationships can represent shared domains, families or explicit related-pattern links.

Edges are not causal claims.

## Casino X-Ray

Casino X-Ray uses a Web Worker for synthetic simulations so larger runs do not block the main interface.

It exposes:

- RTP
- house edge
- theoretical expected value
- simulated result distributions
- profitable-run frequency
- bankroll failure
- loss-disguised-as-win counts
- near-miss independence experiments

The simulations are educational models, not predictions of a specific casino game.

## Market X-Ray

Market experiments include:

- synthetic random-walk candles
- pattern null baselines
- transaction-cost drag
- leverage sensitivity
- trading-hype text analysis

The module intentionally avoids buy/sell predictions.

## Behaviour and friction tools

The behavioural side includes:

    trigger
      ↓
    urge
      ↓
    action
      ↓
    immediate reward
      ↓
    later cost

Users can record observations locally and later inspect descriptive relationships.

Friction rules can introduce voluntary delay and reflection before a decision.

These tools are descriptive and do not make diagnostic or causal claims.

## Internationalization

Version 2.1 introduced a Finnish-first interface with an English mode.

Language selection is stored locally.

The translation layer affects presentation while canonical application values and routes remain stable.

## Privacy boundary

The browser build does not secretly monitor other applications or websites.

The optional X-Ray Intercept browser extension uses explicit active-tab access rather than permanent access to all websites.

## Run locally

No framework build step is required for the browser application.

For example:

    npx serve .

or:

    npx vercel dev

Then open the local URL in a browser.

## Development notes

The project began as a broad experimental interface and was later consolidated into a clearer navigation architecture.

Version 2.1 also introduced a runtime translation layer. An early MutationObserver implementation caused a self-triggering DOM update loop, which was fixed by only writing translated values when the output actually changes.

This repository intentionally keeps those engineering decisions visible rather than presenting the project as frictionless magic.

## Status

Experimental but functional.

The project is designed as a browser laboratory, not as medical, financial or gambling advice.

## Black Hole Core

Part of the Black Hole Core experimental software ecosystem.

https://bhc-observatory.vercel.app/
