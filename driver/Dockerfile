FROM node:24.22.3-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --chown=node:node extension/protocol.js ./extension/protocol.js
COPY --chown=node:node driver/ ./driver/
COPY --chown=node:node docs/openapi.json ./docs/openapi.json
USER node
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:8080/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "driver/server.js"]
