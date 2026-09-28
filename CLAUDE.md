# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

The DAVINCI explorer: a read-only web app (Vite, React 18, TypeScript, viem) that
indexes a DAVINCI `ProcessRegistry` in the browser and shows processes,
transitions, blobs, votes, results and the deployment's pins, with the checks
behind each. No backend, no wallet. `README.md` covers the dev loop, the
configuration and Docker. `EXPLORER.md` is the architecture and the page API
(data flow, store entities, hooks, selectors and decoders, the kit, the design
rules); read it before adding or changing a page.

The protocol lives in the other DAVINCI repositories: the node and its HTTP API
in davinci-sequencer, the guests and the Rust SDK the decoders are ported from
in davinci-zkvm, the contracts in davinci-contracts (branch `zkvm`), the DKG
committee in davinci-dkg.

## Commands

```bash
pnpm install --frozen-lockfile   # pnpm 10 through corepack (packageManager)
pnpm dev                         # http://127.0.0.1:5173; ?demo=1 for the synthetic network
pnpm typecheck                   # tsc --noEmit
pnpm lint                        # tsc --noEmit + eslint
pnpm format                      # prettier --write; CI runs pnpm format:check
pnpm test                        # vitest
pnpm test:e2e:install            # Chromium for Playwright, once
pnpm test:e2e                    # Playwright on demo mode: builds, serves vite preview on 4173
pnpm build                       # -> dist/
sh docker/render.test.sh         # the config renderer (needs jq)
docker build -t davinci-explorer .
docker compose up --build        # the image on :8080
```

`E2E_BASE_URL=<url> pnpm test:e2e` runs the suite against a server that is
already up. `EXPLORER_LIVE=1 pnpm test src/indexer/live.test.ts` indexes the
deployment in `public/config.json` over its public RPCs (needs the network, off
by default).

CI (`.github/workflows/explorer.yml`) runs the renderer test, typecheck, lint,
format, unit tests, build and Playwright, then the nginx image. Branch pushes
publish `ghcr.io/vocdoni/davinci-explorer` and `vocdoni/davinci-explorer` under
the branch name; a `vX.Y.Z` tag also moves `:latest`, prereleases don't.
`.do/davinci-explorer.yaml` builds the DigitalOcean static site from `main`
(`doctl apps spec validate - < .do/davinci-explorer.yaml`).

## Conventions

- Stage by explicit filename. Never read or print secrets (`.env` values).
- Plain, human voice in comments, docs and UI copy. Terse; one short line above
  a function is usually enough. Sparing em-dashes.
- Build every link with `paths` from `~routes/paths`, never a string literal.
- Theme tokens only (`obsidian`, `carbon`, `emerald`, ... from
  `src/styles/index.css`), never raw hex in a component: both themes set them.
- Link to a section of the page with `HashLink`, never a plain `href="#id"`: the
  router's scroll restoration sends a plain fragment link to the top.
- Memoise on the store snapshot or on anything in it: every publish copies the
  collections and entities, so their identities change with the data.
- No page branches on demo mode; `useRuntimeConfig().demo` only explains things.
- Page roots carry `data-testid="page-<name>"` and the Playwright suite relies on
  them; keep them or update the suite in the same change.

## Where things live

- The Gnosis defaults (chain, RPCs, beacon, registry, start block, block
  explorer) live only in `public/config.json`. The image, the DigitalOcean site
  and the dev server all start from it. `src/config/runtime-config.test.ts` pins
  its values, so a redeploy updates both.
- The release pins (both program vks, `rootCVadcopFinal`, the verifier code
  hash, the ballot VK hash) live in `src/protocol/releases.ts`
  (`KNOWN_RELEASES`, newest first), copied from davinci-zkvm
  `rust-sdk/src/release.rs`. Add a row with every davinci-zkvm release.
- `src/contracts/abi/*.json` are copies of davinci-sequencer `sequencer/abi/`.
- `tests/vectors/` holds files copied from davinci-zkvm `rust-sdk/testdata/` and
  one recorded Gnosis transition (see its README).
