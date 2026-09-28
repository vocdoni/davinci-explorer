# DAVINCI explorer: the Vite build served by nginx. The entrypoint renders
# /config.json and the nginx site from environment variables at start, so one
# image serves any deployment (see README.md, "Docker").
#
#   docker build -t davinci-explorer .
#   docker run -p 8080:8080 davinci-explorer
#   docker build --build-arg REGISTRY_ADDRESS=0x... -t davinci-explorer .

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.0.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY . .
ARG VITE_BUILD_VERSION=dev
ENV VITE_BUILD_VERSION=${VITE_BUILD_VERSION}
RUN pnpm build

FROM nginx:1.27-alpine
RUN apk add --no-cache jq
COPY --from=build /app/dist /usr/share/nginx/html
# The committed public/config.json: the defaults every unset variable keeps.
COPY --from=build /app/public/config.json /etc/davinci-explorer/config.defaults.json
COPY --chmod=0755 docker/render.sh /docker-entrypoint.d/40-davinci-explorer.sh

# Static hosts (DigitalOcean App Platform static sites and the like) read the
# files out of this stage and never run nginx, so the config is also rendered
# here from build args (the same names as the runtime variables). An empty arg
# keeps the committed default. The result becomes the defaults the entrypoint
# starts from, so runtime variables still override it.
ARG NETWORK_NAME=
ARG CHAIN_ID=
ARG RPC_URL=
ARG BEACON_URL=
ARG REGISTRY_ADDRESS=
ARG START_BLOCK=
ARG SEQUENCER_URLS=
ARG BLOCK_EXPLORER_URL=
ARG DKG_EXPLORER_URL=
# A static host has no proxy: set SEQUENCER_PROXY=false there.
ARG BEACON_PROXY=
ARG SEQUENCER_PROXY=
RUN for v in NETWORK_NAME CHAIN_ID RPC_URL BEACON_URL REGISTRY_ADDRESS START_BLOCK \
      SEQUENCER_URLS BLOCK_EXPLORER_URL DKG_EXPLORER_URL BEACON_PROXY SEQUENCER_PROXY; do \
      eval "[ -n \"\${$v}\" ]" || unset "$v"; \
    done; \
    NGINX_CONF=/tmp/build.conf sh /docker-entrypoint.d/40-davinci-explorer.sh && \
    cp /usr/share/nginx/html/config.json /etc/davinci-explorer/config.defaults.json && \
    rm -f /tmp/build.conf
ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1
