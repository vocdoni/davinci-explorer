# DAVINCI explorer

A read-only web explorer for a [DAVINCI](https://davinci.vote) voting deployment. It shows every
election on a `ProcessRegistry`, each batch of votes and the data it published, the votes and the
results, with the checks behind each, so voters, organizers and auditors can verify the results
themselves.

[![CI](https://github.com/vocdoni/davinci-explorer/actions/workflows/explorer.yml/badge.svg)](https://github.com/vocdoni/davinci-explorer/actions/workflows/explorer.yml)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)

## Overview

The explorer is a static single-page app with no backend and no wallet. The browser reads the
chain directly: it indexes the registry's events over JSON-RPC (cached in IndexedDB), fetches each
batch's EIP-4844 blobs from a beacon API, and can ask sequencer nodes for a vote's status and
receipt. Every page says in plain words what a value means and keeps the exact values, formulas
and the shell commands to recheck them one step below. A guide (Learn) and a glossary explain the
protocol. The interface is in English, Spanish and Catalan.

The deployment it shows is runtime configuration (`/config.json`), so one build serves any chain.
The committed defaults in [`public/config.json`](public/config.json) point at the Gnosis Chain
deployment.

The explorer is one part of the DAVINCI stack:

| Repository                                                                  | What it is                                                                                                 |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| [davinci-sequencer](https://github.com/vocdoni/davinci-sequencer)           | The sequencer node: collects ballots, proves each batch and settles it on the registry                     |
| [davinci-zkvm](https://github.com/vocdoni/davinci-zkvm)                     | The zkVM programs that prove a batch and a tally, the prover service and the SDKs                          |
| [davinci-contracts](https://github.com/vocdoni/davinci-contracts)           | `ProcessRegistry`, the PLONK verifier and the DKG adapter                                                  |
| [davinci-dkg](https://github.com/vocdoni/davinci-dkg)                       | Distributed key generation: the committee that holds the key of a DKG-mode election and decrypts its tally |

## Quick start

Run the published image with the default deployment:

```sh
docker run --rm -p 8080:8080 ghcr.io/vocdoni/davinci-explorer:latest
```

Then open <http://127.0.0.1:8080>. Append `?demo=1` to any URL to browse a synthetic network
instead.

To keep it running and follow new releases, use Docker Compose from a clone. Pull the published
image first; without it, Compose builds the image from the checkout:

```sh
git clone https://github.com/vocdoni/davinci-explorer.git
cd davinci-explorer
docker compose pull explorer
docker compose --profile watchtower up -d
```

## Usage

### Configuration

The container writes `/config.json` from environment variables at start. An unset variable keeps
the default from `public/config.json`; an optional one set to the empty string is removed. Invalid
values stop the container with an error.

| Variable             | Description                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `NETWORK_NAME`       | Display name of the network                                                                              |
| `CHAIN_ID`           | Expected chain id. The explorer compares it with the RPC's at boot and stops with a banner on a mismatch |
| `RPC_URL`            | JSON-RPC endpoints, comma-separated, in failover order                                                   |
| `REGISTRY_ADDRESS`   | `ProcessRegistry` address                                                                                |
| `START_BLOCK`        | Block the registry was deployed in; the event scan starts here                                           |
| `BEACON_URL`         | Beacon API for blob data. Optional: without it, blobs come from the sequencers only                      |
| `SEQUENCER_URLS`     | Sequencer node APIs, comma-separated, for vote status, receipts and archived blobs. Optional             |
| `BLOCK_EXPLORER_URL` | Etherscan-compatible block explorer for transaction and address links. Optional                          |
| `DKG_EXPLORER_URL`   | davinci-dkg explorer, for links to DKG epochs and applications. Optional                                 |
| `SEQUENCER_PROXY`    | `true` (default) serves sequencer _n_ at `/proxy/sequencer/<n>/`: sequencer nodes send no CORS headers   |
| `BEACON_PROXY`       | `true` serves the beacon at `/proxy/beacon/`, for a beacon without CORS headers. Default `false`         |
| `PORT`               | Port nginx listens on inside the container. Default `8080`                                               |

For example, against a local Anvil chain:

```sh
docker run --rm -p 8080:8080 \
  -e NETWORK_NAME=anvil -e CHAIN_ID=31337 -e RPC_URL=http://127.0.0.1:8545 \
  -e REGISTRY_ADDRESS=0x... -e START_BLOCK=0 -e BEACON_URL= -e BLOCK_EXPLORER_URL= \
  ghcr.io/vocdoni/davinci-explorer:latest
```

The browser calls the RPC and the beacon itself, so both must be reachable from the visitor's
machine and send CORS headers. A sequencer behind the proxy is called from the container, so give
it an address the container can reach.

With Docker Compose, put the variables in a `.env` file next to `docker-compose.yml`;
`EXPLORER_PORT` moves the published port.

### Static hosting

The same variables are Docker build args. A build with them carries the config in its files, for
static hosts that serve `/usr/share/nginx/html` from the image without running nginx:

```sh
docker build --build-arg REGISTRY_ADDRESS=0x... --build-arg START_BLOCK=123 \
  --build-arg SEQUENCER_PROXY=false -t davinci-explorer .
```

A static host has no proxy, so use sequencers that send CORS headers. `.do/davinci-explorer.yaml`
deploys the explorer this way on DigitalOcean App Platform. [docs/deployment.md](docs/deployment.md)
covers static hosts, the `config.json` format for serving `dist/` yourself, and the image tags.

### Demo mode

`?demo=1` in the URL (kept for the browser tab until `?demo=0`), or a bundle built with
`VITE_DEMO=1 pnpm build`, runs the whole app on a deterministic synthetic network: elections in
every status, key mode and census origin, multi-blob batches, results from the zkVM and from a DKG
committee, and two fake sequencers. It makes no network request and needs no `config.json`.

## Documentation

- [docs/deployment.md](docs/deployment.md): the Docker image, Docker Compose, static hosts and the
  `config.json` format.
- [docs/architecture.md](docs/architecture.md): how the app is built: data flow, the in-browser
  indexer, store, hooks, decoders, pages and the design kit.
- [docs/writing.md](docs/writing.md): how the pages speak, and the reading aids they use.
- [docs/translations.md](docs/translations.md): adding and translating text, and adding a language.
- [src/locales/GLOSSARY.md](src/locales/GLOSSARY.md): the Spanish and Catalan terms.

## Development

Requires Node 22 and pnpm 10 (through corepack).

```sh
corepack enable
pnpm install
pnpm dev            # http://127.0.0.1:5173
pnpm lint           # tsc + eslint
pnpm test           # vitest
pnpm build          # -> dist/
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full set of checks, the end-to-end suite, pointing
the dev server at another deployment, and the code and translation conventions.

## License

[GNU Affero General Public License v3.0 or later](LICENSE).
