# Standalone collaboration room server. The image only needs Node 22's
# type-stripping support and the shared core room modules; no desktop runtime.
FROM node:22-slim

WORKDIR /app
COPY package.json ./
COPY scripts/collaborationServer.mjs ./scripts/collaborationServer.mjs
COPY src/core/collaboration ./src/core/collaboration

EXPOSE 47830
VOLUME ["/data"]
ENTRYPOINT ["node", "scripts/collaborationServer.mjs"]
CMD ["--host", "0.0.0.0", "--port", "47830", "--data", "/data"]
