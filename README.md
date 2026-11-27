# Catraca — MVP de Venda de Ingressos

Plataforma de venda de ingressos para eventos pequenos (shows em bar, workshops, meetups), construída com **Spec-Driven Development (SDD)**, entrega em waves (incluindo uma wave executada em paralelo com integração via PRs) e avaliação independente por contrato.

---

## Como rodar

### Pré-requisitos
- **Docker** (com Docker Compose v2)
- **Git**
- **Node.js LTS** (usado apenas pelos scripts de orquestração — não é necessário rodar `npm install` na máquina host)

### Comandos do Harness Mínimo

Execute a partir da raiz do repositório:

| Ação | Comando | Descrição |
| :--- | :--- | :--- |
| **Subir tudo** | `npm run up` | Constrói e sobe PostgreSQL 16 + aplicação via Docker Compose, aplica migrations idempotentes e carrega a seed até `http://localhost:3000/health` responder `200`. |
| **Derrubar tudo** | `npm run down` | Encerra e remove todos os containers e redes iniciados pelo projeto (`docker compose --profile test down --remove-orphans`). |
| **Rodar gates** | `npm run gates` | Executa checagem de tipos (backend + frontend), build de produção do frontend e toda a suíte automatizada Vitest (unitários, integração, E2E e concorrência) em banco isolado `catraca_test` dentro de Docker. |

> O produto sobe no modo padrão com o **gateway de pagamento simulado**, sem necessidade de nenhuma chave externa.

---

## Endereços

- **Produto (`$WEB`)**: `http://localhost:3000`
- **API de parceiros (`$API`)**: `http://localhost:3000`
  - `GET http://localhost:3000/api/partner/events`
  - `POST http://localhost:3000/api/partner/events/{eventId}/purchases`
  - `GET http://localhost:3000/api/partner/tickets/{ticketId}`

---

## Credenciais (Seed Idempotente e Chave de Parceiro)

| Perfil | E-mail | Senha |
| :--- | :--- | :--- |
| **Organizador A** | `org.a@catraca.local` | `OrgA1234!` |
| **Organizador B** | `org.b@catraca.local` | `OrgB1234!` |
| **Participante (seed)** | `participante@catraca.local` | `Part1234!` |

- **Chave de parceiro (`$KEY` / cabeçalho `X-Api-Key`)**: `catraca-partner-key-2026`

### Cartões de teste do gateway simulado (modo padrão)
Qualquer cartão com 16 dígitos é aceito na entrada (fora disso, rejeitado antes de criar ingresso):
- Final `0001` (ex.: `4000000000000001`): aprovado em 2–5 segundos
- Final `0002` (ex.: `4000000000000002`): recusado em 2–5 segundos
- Final `0003` (ex.: `4000000000000003`): aprovado em 30–40 segundos
- Final `0004` (ex.: `4000000000000004`): recusado em 30–40 segundos
- Qualquer outro final de 16 dígitos: recusado em 2–5 segundos

---

## Mapa dos Artefatos

- **Porta de entrada para agentes**: [AGENTS.md](AGENTS.md) (e ponteiro [CLAUDE.md](CLAUDE.md))
- **PRD (features, Consumes/Provides, grafo, waves, critérios cross-feature e rastreabilidade R01–R13)**: [docs/prd.md](docs/prd.md)
- **Estado do projeto**: [docs/state.json](docs/state.json)

### Features (Spec, Plano, Contrato e Relatórios Independentes)

| ID | Wave | Feature | Artefatos |
| :--- | :---: | :--- | :--- |
| `F01` | 1 | Fundação, Autenticação, RBAC e Chave de Parceiro | [spec](docs/features/F01-fundacao-auth-rbac/spec.md) · [plan](docs/features/F01-fundacao-auth-rbac/plan.md) · [contract](docs/features/F01-fundacao-auth-rbac/contract.md) · [eval-01](docs/features/F01-fundacao-auth-rbac/reports/eval-01.md) |
| `F02` | 2 | Gestão de Eventos, Vitrine Pública e Listagem de Parceiros | [spec](docs/features/F02-eventos-vitrine/spec.md) · [plan](docs/features/F02-eventos-vitrine/plan.md) · [contract](docs/features/F02-eventos-vitrine/contract.md) · [eval-01](docs/features/F02-eventos-vitrine/reports/eval-01.md) |
| `F03` | 3 | Compras, Concorrência (R07), Gateway Simulado e Meus Ingressos | [spec](docs/features/F03-compras-gateway-ingressos/spec.md) · [plan](docs/features/F03-compras-gateway-ingressos/plan.md) · [contract](docs/features/F03-compras-gateway-ingressos/contract.md) · [eval-01](docs/features/F03-compras-gateway-ingressos/reports/eval-01.md) |
| `F04` | 4 *(paralela)* | Check-in de Ingressos na Página de Gestão | [spec](docs/features/F04-checkin/spec.md) · [plan](docs/features/F04-checkin/plan.md) · [contract](docs/features/F04-checkin/contract.md) · [eval-01](docs/features/F04-checkin/reports/eval-01.md) |
| `F05` | 4 *(paralela)* | Cancelamento Irreversível e Reconciliação com Gateway | [spec](docs/features/F05-cancelamento-estorno/spec.md) · [plan](docs/features/F05-cancelamento-estorno/plan.md) · [contract](docs/features/F05-cancelamento-estorno/contract.md) · [eval-01](docs/features/F05-cancelamento-estorno/reports/eval-01.md) |
| `F06` | 5 | Painel Consolidado de Métricas e Receita do Evento | [spec](docs/features/F06-painel-metricas/spec.md) · [plan](docs/features/F06-painel-metricas/plan.md) · [contract](docs/features/F06-painel-metricas/contract.md) · [eval-01](docs/features/F06-painel-metricas/reports/eval-01.md) |

### Pull Requests da Wave Paralela (Wave 4)
As features `F04` e `F05` foram implementadas simultaneamente por agentes distintos em git worktrees e branches separadas (`feat/f04-checkin` e `feat/f05-cancelamento`), com timestamps de commits intercalados, resolução explícita de conflito de integração em `backend/src/app.ts` e `frontend/src/pages/EventManagePage.tsx`, e integradas à `main` via PRs:

- **PR #1 (`F04` — Check-in)**: https://github.com/victorgilc/mba-brief-produto-agente/pull/1
- **PR #2 (`F05` — Cancelamento e Estorno)**: https://github.com/victorgilc/mba-brief-produto-agente/pull/2

---

## Decisões Técnicas

### 1. Stack e por quê
- **TypeScript full-stack (Fastify + React/Vite + PostgreSQL 16)** em Docker Compose:
  - **PostgreSQL 16**: oferece transações ACID reais e trava pessimista em nível de linha (`SELECT ... FOR UPDATE`), essenciais para garantir lotação sob rajadas simultâneas e cancelamento atômico.
  - **Fastify servindo a API e a SPA React compilada na mesma porta (`3000`)**: elimina problemas de CORS, permite cookies HTTP-only (`SameSite=Lax`) sem atrito e simplifica o ambiente para apenas 2 containers (`catraca-db` e `catraca-app`).
  - **Scripts Node.js puros (`scripts/up.mjs`, `down.mjs`, `gates.mjs`) + Dockerfile multi-stage (`test` e `runtime`)**: funciona de forma idêntica em Linux, macOS e Windows a partir de um clone limpo sem exigir `npm install` na máquina host.

### 2. Como `R07` foi garantida sob concorrência
Toda compra (vitrine e API de parceiros) executa em `backend/src/services/purchases.ts` uma transação PostgreSQL explícita que adquire trava exclusiva na linha do evento alvo:
1. `BEGIN`
2. `SELECT ... FROM events WHERE id = $1 FOR UPDATE` — serializa todas as transações concorrentes para o mesmo evento (sem bloquear compras em eventos diferentes).
3. Valida `status === 'published'` (caso contrário, `404 event_not_available`).
4. Conta `SELECT COUNT(*) FROM tickets WHERE event_id = $1 AND status IN ('pending', 'confirmed')` sobre o estado recém-confirmado após aquisição do lock.
5. Se `occupied >= capacity`, realiza `ROLLBACK` e responde `409 {"error":"sold_out"}`; caso contrário, insere o ingresso `pending` (gravando o snapshot `price_cents` vigente) e faz `COMMIT`.
- O pool `pg` é configurado com `max: 50` conexões para atender confortavelmente rajadas de 30+ requisições simultâneas sem timeouts.

### 3. Como a resposta assíncrona do gateway foi implementada
Em `backend/src/services/gateway.ts`:
- A validação de 16 dígitos do cartão ocorre antes de abrir qualquer transação.
- Após o `COMMIT` que grava o ingresso em `pending` (ocupando vaga imediatamente), a rota responde `202` sem bloquear (`R06`) e agenda o callback simulado via `setTimeout` conforme o final do cartão (2–5s para `0001`/`0002`/outros e 30–40s para `0003`/`0004` no modo padrão `GATEWAY_DELAY_MODE=default`; configurável como `fast` apenas na suíte automatizada de testes).
- Quando o callback dispara, abre transação com `SELECT status FROM events WHERE id = $1 FOR UPDATE` (serializando com eventual cancelamento) e só executa `UPDATE tickets SET status = $outcome WHERE id = $ticketId AND status = 'pending'` se `event.status === 'published'`. Assim, respostas tardias (ex.: cartão `0003`/`0004` após 30–40s) jamais sobrescrevem ingressos `cancelled` ou `refunded` (`R11`).

### 4. Como a avaliação foi isolada do implementador
Cada feature (`F01` a `F06`) seguiu estritamente o ciclo de separação:
1. O agente implementador desenvolveu a feature na sua branch e commitou código + testes automatizados.
2. Um subagente avaliador independente (`feature-evaluator`), instanciado do zero com contexto limpo e proibido de modificar código de produto, leu apenas `AGENTS.md`, `docs/prd.md` e o `contract.md` da feature, executou cada item verificável contra a stack Docker ao vivo e `npm run gates`, e gravou o relatório imutável `docs/features/<ID>/reports/eval-01.md` com data/hora ISO, SHA do commit avaliado, ferramenta, modelo e evidências reais.
3. Cada relatório foi commitado uma única vez e nunca alterado posteriormente (verificável por `git log -- <relatorio>`).
