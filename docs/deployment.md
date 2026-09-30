# Deployment

The explorer is a static bundle plus one runtime file, `/config.json`, that names the deployment to
show. This page covers the Docker image, Docker Compose, static hosts and serving the bundle
yourself. The environment variables are listed in the README's
[Configuration](../README.md#configuration) table.

## Docker image

The image is published as `ghcr.io/vocdoni/davinci-explorer` and `vocdoni/davinci-explorer`:

| Tag        | What it is                                                               |
| ---------- | ------------------------------------------------------------------------ |
| `latest`   | The newest release                                                       |
| `vX.Y.Z`   | A release                                                                |
| `<branch>` | The tip of a branch (`main`, `dev`, `stage`, `release*`), as CI built it |

The Dockerfile builds the bundle with Node and serves it with nginx. At start,
`docker/render.sh` (an nginx entrypoint script) writes `/config.json` and the nginx site from the
environment:

- an unset variable keeps the default from `public/config.json`;
- `BEACON_URL`, `SEQUENCER_URLS`, `BLOCK_EXPLORER_URL` and `DKG_EXPLORER_URL` set to the empty
  string clear the setting;
- a malformed chain id, block number, address or URL stops the container with an error naming the
  variable.

`GET /healthz` answers `ok` and the image's `HEALTHCHECK` polls it. `/config.json` is served with
`Cache-Control: no-store`, the hashed assets as immutable.

### Proxies

Sequencer nodes send no CORS headers, so by default (`SEQUENCER_PROXY=true`) nginx serves sequencer
_n_ at `/proxy/sequencer/<n>/` and the app calls it on its own origin. `BEACON_PROXY=true` does the
same for the beacon at `/proxy/beacon/`. The proxies accept `GET` and `HEAD` only. The RPC is
always called from the browser.

## Docker Compose

`docker-compose.yml` runs the image on `EXPLORER_PORT` (default 8080) and passes the variables
through when they are set in the shell or in `.env`:

```sh
docker compose pull explorer                  # fetch the published image
docker compose up -d                          # run it (built from this checkout if missing)
docker compose up -d --build                  # build from this checkout
docker compose --profile watchtower up -d     # also follow new releases
```

The service names both the published image and `build: .`, so `up` builds locally when the image
is not there yet; pull first to run the release.

With the `watchtower` profile, Watchtower pulls each new release of `:latest` and restarts the
explorer. Unset variables follow the release's defaults, so a release that changes the default
deployment moves the explorer with it; set the variables to stay on one deployment.
`EXPLORER_IMAGE` selects another image or tag.

## Static hosts

A static host serves files and runs no nginx, so the config has to be in the files. The Dockerfile
renders it at build time from build args with the same names as the runtime variables:

```sh
docker build \
  --build-arg REGISTRY_ADDRESS=0x... --build-arg START_BLOCK=123 \
  --build-arg SEQUENCER_URLS=https://sequencer.example.org --build-arg SEQUENCER_PROXY=false \
  -t davinci-explorer .
```

The site is `/usr/share/nginx/html` in the image. Without a proxy, sequencers must send CORS
headers, and the host must answer unknown paths with `index.html` (the routes are client-side).
Runtime variables still override the build args when the image does run.

`.do/davinci-explorer.yaml` deploys the explorer this way as a DigitalOcean App Platform static
site, rebuilt on every push to `main`. Add variables to its `envs` with `scope: BUILD_TIME`:

```sh
doctl apps spec validate - < .do/davinci-explorer.yaml
doctl apps create --spec - < .do/davinci-explorer.yaml
```

## Serving the bundle yourself

`pnpm build` writes `dist/`. Serve it from any web server that answers unknown paths with
`index.html`, and put a `config.json` next to `index.html`. Start from a copy of
`public/config.json` and edit it; the shape is:

```json
{
  "networkName": "My network",
  "chainId": 100,
  "rpcUrls": ["https://rpc.example.org"],
  "beaconUrl": "https://beacon.example.org",
  "registryAddress": "0x...",
  "startBlock": 12345678,
  "sequencers": ["https://sequencer.example.org"],
  "blockExplorerUrl": "https://explorer.example.org",
  "dkgExplorerUrl": ""
}
```

| Field              | Required | Meaning                                                               |
| ------------------ | -------- | --------------------------------------------------------------------- |
| `networkName`      | no       | Display name; `Chain <id>` when missing                               |
| `chainId`          | yes      | Expected chain id, checked against the RPC at boot                    |
| `rpcUrls`          | yes      | JSON-RPC endpoints in failover order (a comma-separated string works) |
| `beaconUrl`        | no       | Beacon API for blob data                                              |
| `registryAddress`  | yes      | `ProcessRegistry` address                                             |
| `startBlock`       | no       | Registry deployment block, where the event scan starts; default 0     |
| `sequencers`       | no       | Sequencer node APIs, as URLs or `{ "url": "..." }` objects            |
| `blockExplorerUrl` | no       | Etherscan-compatible block explorer                                   |
| `dkgExplorerUrl`   | no       | davinci-dkg explorer                                                  |

The app reports a missing or invalid `config.json` on its start screen, naming the field.

Two build-time variables change the bundle itself: `VITE_DEMO=1` builds one that always runs the
demo network, and `VITE_BUILD_VERSION` is the version shown in the footer.
