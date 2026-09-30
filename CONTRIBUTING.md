# Contributing

This file covers the development loop, the checks CI runs and the conventions the code follows.
Read [docs/architecture.md](docs/architecture.md) before adding or changing a page,
[docs/writing.md](docs/writing.md) before writing page text, and
[docs/translations.md](docs/translations.md) before touching a string.

## Setup

Node 22 and pnpm 10 (through corepack; `package.json` pins the version).

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev                          # http://127.0.0.1:5173
```

Append `?demo=1` to any URL for the deterministic synthetic network (`src/fixtures/synthetic.ts`),
which needs no chain. The unit tests and the Playwright suite run on it.

The dev server serves the committed `public/config.json`. To point it at another deployment, write
`public/config.local.json` (gitignored) with the same shape; the dev server serves it as
`/config.json` when it exists. For sequencer nodes or a beacon without CORS headers, the dev server
offers the same proxies as the image:

```sh
SEQUENCER_URLS=https://seq1.example,https://seq2.example BEACON_URL=https://beacon.example pnpm dev
```

and `config.local.json` then lists `"sequencers": ["/proxy/sequencer/0", "/proxy/sequencer/1"]`
and `"beaconUrl": "/proxy/beacon"`.

## Checks

CI (`.github/workflows/explorer.yml`) runs all of these on every pull request:

```sh
pnpm typecheck                    # tsc --noEmit
pnpm lint                         # tsc --noEmit + eslint
pnpm format:check                 # prettier; `pnpm format` rewrites
pnpm test                         # vitest
pnpm i18n:check                   # catalogs extracted, Spanish and Catalan complete
pnpm build                        # -> dist/
pnpm test:e2e                     # Playwright on demo mode: builds, serves vite preview on :4173
sh docker/render.test.sh          # the image's config renderer (needs jq)
```

Playwright needs Chromium once: `pnpm test:e2e:install`. `E2E_BASE_URL=http://127.0.0.1:5173
pnpm test:e2e` runs the suite against a server that is already up.

`EXPLORER_LIVE=1 pnpm test src/indexer/live.test.ts` indexes the deployment in
`public/config.json` over its public RPCs and checks every transition the way the transition page
does. It needs the network, so it is off by default.

## Conventions

- Page text follows [docs/writing.md](docs/writing.md): the meaning first in everyday words, the
  mechanism one layer down, `<Term id='…'>` on the first use of a protocol word, and
  `<Formula expr='…' />` for every expression.
- Every string a user can see or hear goes through a Lingui macro. Run `pnpm i18n:extract` and
  translate the new Spanish and Catalan entries in the same change, or `pnpm i18n:check` fails.
  [docs/translations.md](docs/translations.md) has the patterns, and
  [src/locales/GLOSSARY.md](src/locales/GLOSSARY.md) the words.
- Build every link with `paths` from `~routes/paths`, never from a string literal.
- Link to a section of the same page with `HashLink`: the router's scroll restoration sends a plain
  `href="#id"` to the top of the page.
- Use the theme tokens (`obsidian`, `carbon`, `emerald`, … from `src/styles/index.css`), never raw
  hex in a component: both themes set them.
- Memoise on the store snapshot or on anything in it: every publish copies the collections and
  entities, so their identities change with the data.
- No page branches on demo mode; `useRuntimeConfig().demo` only explains things.
- Page roots carry `data-testid="page-<name>"` and the Playwright suite relies on them. Keep them,
  or update the suite in the same change.
- Comments are short and explain why. Commit messages follow
  [Conventional Commits](https://www.conventionalcommits.org/) (`fix(process): …`).

## Data from other repositories

Some files mirror the sibling DAVINCI repositories. Refresh them when the source changes:

| File                                                        | Source                                                                            |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `src/protocol/releases.ts` (`KNOWN_RELEASES`, newest first) | davinci-zkvm `rust-sdk/src/release.rs`; add a row with every davinci-zkvm release |
| `src/contracts/abi/*.json`                                  | davinci-sequencer `sequencer/abi/`, the forge output of davinci-contracts         |
| `tests/vectors/`                                            | davinci-zkvm `rust-sdk/testdata/`, plus one recorded transition (see its README)  |
| `src/protocol/publics.ts`, `blob.ts`, `babyjubjub.ts`       | ports of davinci-zkvm `rust-sdk/src/`                                             |
| `src/protocol/tracker.ts`                                   | port of davinci-sequencer `client/src/api.rs` (`verify_tracker`)                  |

The default deployment (chain, RPCs, beacon, registry, start block, block explorer) lives only in
`public/config.json`. The image, the DigitalOcean site and the dev server all start from it, and
`src/config/runtime-config.test.ts` pins its values, so a change updates both.

## Releases

CI builds and publishes the image after the checks pass (see
[docs/deployment.md](docs/deployment.md#docker-image) for the tags). Pushing a `vX.Y.Z` tag
publishes that release and moves `:latest`; prerelease tags don't move it.
