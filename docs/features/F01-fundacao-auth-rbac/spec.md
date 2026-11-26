# Spec — F01: Fundação, Autenticação, RBAC e Chave de Parceiro

## 1. Objetivo
Estabelecer a fundação executável do produto Catraca (Docker Compose, PostgreSQL 16, backend Fastify + TypeScript, frontend React + Vite + TypeScript, harness mínimo `up`/`down`/`gates`), o sistema de autenticação por cookie HTTP-only, controle de acesso baseado em papel (`R13`), seed idempotente e autenticação de parceiros por `X-Api-Key`.

## 2. Decisões Técnicas
- **Orquestração**: `docker-compose.yml` com dois serviços: `db` (`postgres:16-alpine` com healthcheck `pg_isready`) e `app` (Node 22 LTS multi-stage servindo API Fastify + assets compilados do Vite na porta `3000`).
- **Harness cross-platform**: `scripts/up.mjs`, `scripts/down.mjs` e `scripts/gates.mjs` usando apenas módulos nativos do Node.js LTS, permitindo execução direta em clone limpo sem `npm install` prévio na máquina host.
- **Banco de dados**: PostgreSQL via `pg` (pool com `max: 50`). Migrations SQL idempotentes executadas automaticamente na inicialização do backend antes de abrir o servidor HTTP.
- **Schema inicial (F01)**:
  - `users`: `id TEXT PRIMARY KEY`, `name TEXT NOT NULL`, `email TEXT UNIQUE NOT NULL`, `password_hash TEXT NOT NULL`, `role TEXT NOT NULL CHECK (role IN ('participant', 'organizer'))`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
  - `sessions`: `token TEXT PRIMARY KEY`, `user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE`, `expires_at TIMESTAMPTZ NOT NULL`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
- **Seed idempotente**: `backend/src/db/seed.ts` cria via `INSERT ... ON CONFLICT (email) DO UPDATE`:
  - `org.a@catraca.local` / `OrgA1234!` (`role = 'organizer'`, nome `Organizador A`)
  - `org.b@catraca.local` / `OrgB1234!` (`role = 'organizer'`, nome `Organizador B`)
  - `participante@catraca.local` / `Part1234!` (`role = 'participant'`, nome `Participante Seed`)
- **Senhas e Sessões**: Hash com `bcryptjs` (custo 10). Sessão persistida na tabela `sessions` com token randômico de 32 bytes em cookie `catraca_session` (`HttpOnly`, `SameSite=Lax`, `Path=/`).
- **Rotas de Auth**:
  - `GET /health`: verifica conectividade com PostgreSQL (`SELECT 1`) e retorna `200 {"status":"ok"}`.
  - `POST /api/auth/register`: cria apenas `participant` (`name`, `email`, `password` >= 6 chars), inicia sessão e retorna `201`. E-mail duplicado retorna `409`.
  - `POST /api/auth/login`: autentica `participant` ou `organizer`, cria sessão e retorna `200`. Credenciais inválidas retornam `401`.
  - `POST /api/auth/logout`: remove sessão no banco, limpa cookie e retorna `204`.
  - `GET /api/auth/me`: retorna `{ user }` se autenticado ou `{ user: null }` (`200`).
- **Middlewares**:
  - `requireAuth`: exige sessão válida (`401 {"error":"unauthorized"}`).
  - `requireOrganizer`: exige `role === 'organizer'` (`401` se sem sessão, `403 {"error":"forbidden"}` se participante).
  - `requireParticipant`: exige `role === 'participant'` (`401` / `403`).
  - `requirePartnerApiKey`: compara cabeçalho `X-Api-Key` com `process.env.PARTNER_API_KEY` (padrão `catraca-partner-key-2026`); se ausente ou diferente retorna `401 {"error":"unauthorized"}`.
- **Frontend Shell**:
  - Rotas: `/` (Vitrine), `/login`, `/cadastro`, `/meus-ingressos`, `/organizador`, `/organizador/eventos/:eventId`.
  - Guarda de rota no cliente impede renderização da área `/organizador/*` para visitantes (redireciona para `/login`) e participantes (exibe tela de acesso negado sem chamar endpoints privados).

## 3. Dependências
- **Consumes**: Nenhuma.
- **Provides**: Banco + migrations, seed idempotente, harness `up`/`down`/`gates`, auth/RBAC, middleware `X-Api-Key`, shell web.
