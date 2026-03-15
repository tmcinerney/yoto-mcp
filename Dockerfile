FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS runtime

RUN addgroup -S yoto && adduser -S yoto -G yoto

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN mkdir -p /config && chown yoto:yoto /config

USER yoto

ENV NODE_ENV=production
ENV YOTO_MCP_PORT=3100
ENV YOTO_CONFIG_DIR=/config

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3100/health || exit 1

ENTRYPOINT ["node", "dist/index.js"]
