FROM node:20-bookworm-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @hcm/shared-kernel build \
  && pnpm --filter @hcm/command-contracts build \
  && pnpm --filter @hcm/event-schemas build \
  && pnpm --filter @hcm/database build \
  && pnpm --filter @hcm/access-control build \
  && pnpm --filter @hcm/platform-core build \
  && pnpm --filter @hcm/policy-engines build \
  && pnpm --filter @hcm/openapi-contracts build \
  && pnpm --filter @hcm/hr-api build
RUN CI=true pnpm prune --prod

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3001
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY --from=build /workspace/package.json ./package.json
COPY --from=build /workspace/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=build /workspace/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /workspace/turbo.json ./turbo.json
COPY --from=build /workspace/node_modules ./node_modules
COPY --from=build /workspace/apps/hr-api ./apps/hr-api
COPY --from=build /workspace/packages ./packages
COPY --from=build /workspace/infra/migrations ./infra/migrations

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "apps/hr-api/dist/main.js"]
