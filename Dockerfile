FROM node:22-alpine AS base
WORKDIR /app

FROM base AS test
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
RUN npm --prefix backend install && npm --prefix frontend install
COPY backend ./backend
COPY frontend ./frontend

FROM test AS builder
RUN npm --prefix backend run build && npm --prefix frontend run build

FROM base AS runtime
ENV NODE_ENV=production
COPY backend/package*.json ./backend/
RUN npm --prefix backend install --omit=dev
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/frontend/dist ./frontend/dist
EXPOSE 3000
CMD ["node", "backend/dist/server.js"]
