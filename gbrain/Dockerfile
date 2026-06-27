# GBrain — CLI + remote MCP server (no agent platform / skillpack scaffolding)
# Runs from source with Bun, per the deterministic install path in
# docs/INSTALL.md (clone + bun install; avoids the `bun install -g`
# postinstall issue, github.com/garrytan/gbrain/issues/218).
FROM oven/bun:1

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ARG GBRAIN_REF=master
RUN git clone --depth 1 --branch ${GBRAIN_REF} https://github.com/garrytan/gbrain.git /opt/gbrain

WORKDIR /opt/gbrain
RUN bun install --frozen-lockfile --production

# Put `gbrain` on PATH (equivalent of bun link, without global-bin PATH juggling)
RUN printf '#!/bin/sh\nexec bun /opt/gbrain/src/cli.ts "$@"\n' > /usr/local/bin/gbrain \
    && chmod +x /usr/local/bin/gbrain

# Brain data dir — mounted as a PVC in k8s
VOLUME /root/.gbrain

EXPOSE 3131
CMD ["gbrain", "serve", "--http", "--port", "3131", "--bind", "0.0.0.0"]
