# Plano de Implementação — F01: Fundação, Autenticação, RBAC e Chave de Parceiro

## Etapas
1. Criar `package.json` raiz (com scripts `up`, `down`, `gates`), `docker-compose.yml`, `Dockerfile` (stages `test` e `runtime`) e scripts `scripts/up.mjs`, `scripts/down.mjs`, `scripts/gates.mjs`.
2. Configurar projeto `backend/` (TypeScript, Fastify, `@fastify/cookie`, `@fastify/static`, `pg`, `bcryptjs`, `zod`, Vitest).
3. Implementar `backend/src/db/pool.ts`, `backend/src/db/migrate.ts` (tabelas `users` e `sessions`) e `backend/src/db/seed.ts` (idempotente para Organizador A, Organizador B e Participante Seed).
4. Implementar middlewares `auth.ts` (`requireAuth`, `requireOrganizer`, `requireParticipant`, `requirePartnerApiKey`) e rotas `/health`, `/api/auth/*`, além de rota ping protegida `/api/organizer/ping` e `/api/partner/ping` (ou rotas base) para verificação de RBAC/API key.
5. Configurar projeto `frontend/` (React, TypeScript, Vite, React Router DOM) com contexto de autenticação (`AuthContext`), barra de navegação, páginas `/login`, `/cadastro`, placeholder da vitrine `/` e guarda de rota para `/organizador/*`.
6. Escrever testes automatizados em `backend/tests/f01-auth.test.ts` cobrindo cadastro, login/logout, seed idempotente, RBAC (`R13`) e `X-Api-Key`.
7. Validar `npm run up`, `npm run gates`, `npm run down` e novo `npm run up`.
