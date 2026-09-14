FROM ghcr.io/openai/tunnel-client:v0.0.14@sha256:41d7c85dab37797a3eaa17c41b94a7206dd0bc186fd361034c9ec3863596ff6c AS tunnel

FROM node:24-bookworm AS build
WORKDIR /app

# npm's GitHub lockfile URLs may use SSH; public installs need no SSH keys.
RUN git config --global url."https://github.com/".insteadOf "ssh://git@github.com/"
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY scripts/stdio-smoke.mjs ./scripts/stdio-smoke.mjs
RUN npm run build && npm run test:stdio && npm prune --omit=dev

FROM node:24-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=tunnel /usr/bin/tunnel-client /usr/local/bin/tunnel-client
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts/stdio-smoke.mjs ./scripts/stdio-smoke.mjs
USER node
ENTRYPOINT ["tunnel-client"]
CMD ["run"]
