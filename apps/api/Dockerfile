FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json schema.sql ./
COPY src ./src
RUN npm run build && npm prune --omit=dev
FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY schema.sql cloud-start.cjs ./
ENV NODE_ENV=production
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
