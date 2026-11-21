# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN npm ci -w @byke-os/api -w @byke-os/shared --include-workspace-root --ignore-scripts
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @byke-os/shared && npm run build -w @byke-os/api \
  && npm prune --omit=dev -w @byke-os/api -w @byke-os/shared

# ---- runtime stage ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/packages/shared/package.json packages/shared/
COPY --from=build /repo/packages/shared/dist packages/shared/dist
COPY --from=build /repo/apps/api/package.json apps/api/
COPY --from=build /repo/apps/api/dist apps/api/dist
WORKDIR /repo/apps/api
# Task proof photos (UPLOAD_DIR defaults to ./uploads); the node user must be able to write here.
RUN mkdir -p uploads && chown node:node uploads
USER node
EXPOSE 4000
# Apply pending migrations, then start the API
CMD ["sh", "-c", "node dist/db/migrate.js up && node dist/server.js"]
