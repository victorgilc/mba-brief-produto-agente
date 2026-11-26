# Relatório de Avaliação Independente — F02 (eval-01)

- **Feature**: `F02-eventos-vitrine` — Gestão de Eventos, Vitrine Pública e Listagem da API de Parceiros
- **Data/Hora**: `2026-11-26T18:54:33-03:00`
- **Commit avaliado**: `7e688de08827582cf4951501ad227f92da90ba1c` (`7e688de`)
- **Branch avaliada**: `feat/f02-eventos-vitrine`
- **Ferramenta**: Antigravity
- **Modelo**: Gemini 4 Neon (High)
- **Contrato de referência**: `docs/features/F02-eventos-vitrine/contract.md`
- **Veredito Geral**: **APROVADO**

---

## Tabela Resumo

| Item | Critérios PRD | Regras | Veredito |
| :--- | :--- | :--- | :--- |
| `IT-F02-01` — Validação de campos e rejeição de data no passado | `AC-F02-1` | R01 | **APROVADO** |
| `IT-F02-02` — Ciclo rascunho -> publicado na vitrine e API de parceiros | `AC-F02-2` | R02 | **APROVADO** |
| `IT-F02-03` — Regras de edição de lotação e preço | `AC-F02-3` | R03 | **APROVADO** |
| `IT-F02-04` — Página de gestão própria e isolamento entre organizadores e perfis | `AC-F02-4`, `CF-01` | R04, R13 | **APROVADO** |
| `IT-F02-05` — Gates automatizados passando | `CF-01` | Harness/Testes | **APROVADO** |

---

## Pré-requisitos Verificados

- Stack ativo via Docker Compose (`catraca-app` e `catraca-db` com status `healthy`).
- `curl.exe -s -i http://localhost:3000/health` retornou:
  ```text
  HTTP/1.1 200 OK
  content-type: application/json; charset=utf-8
  {"status":"ok"}
  ```
- Autenticação das contas da seed (`POST /api/auth/login`):
  - `org.a@catraca.local` -> `200` (`id: "usr_org_a"`, `role: "organizer"`)
  - `org.b@catraca.local` -> `200` (`id: "usr_org_b"`, `role: "organizer"`)
  - `participante@catraca.local` -> `200` (`id: "usr_part_seed"`, `role: "participant"`)

---

## Evidências Detalhadas por Item

### IT-F02-01 — Validação de campos e rejeição de data no passado (R01)
- **Veredito**: **APROVADO**
- **Ações executadas (chamadas HTTP reais em `http://localhost:3000` como Organizador A) e evidências**:
  1. **Criação com `startsAt` no passado (-1 dia)** (`POST /api/organizer/events`):
     ```json
     HTTP 422
     {"error":"invalid_starts_at","message":"A data de início deve estar no futuro"}
     ```
  2. **Criação com `capacity: 0`**, **`capacity: 1.5` (não inteiro)**, **`priceCents: 0`** e **`name` em branco**:
     ```text
     capacity: 0      -> HTTP 422 {"error":"invalid_request","message":"Lotação mínima é 1"}
     capacity: 1.5    -> HTTP 422 {"error":"invalid_request","message":"Lotação deve ser um número inteiro"}
     priceCents: 0    -> HTTP 422 {"error":"invalid_request","message":"Preço deve ser maior que zero"}
     name: "   "      -> HTTP 422 {"error":"invalid_request","message":"Nome do evento é obrigatório"}
     ```
  3. **Criação válida com data futura (+30 dias), `capacity: 2`, `priceCents: 10000`**:
     ```json
     HTTP 201
     {
       "event": {
         "id": "evt_36b3b8b8",
         "organizerId": "usr_org_a",
         "name": "Show QA F02 Eval",
         "startsAt": "2026-12-26T21:53:44.008Z",
         "location": "Porao QA",
         "capacity": 2,
         "priceCents": 10000,
         "status": "draft",
         "occupiedSeats": 0,
         "availableSeats": 2
       }
     }
     ```
  4. **Edição alterando `startsAt` para o passado (-2 dias)** (`PUT /api/organizer/events/evt_36b3b8b8`):
     ```json
     HTTP 422
     {"error":"invalid_starts_at","message":"A data de início deve estar no futuro"}
     ```

---

### IT-F02-02 — Ciclo rascunho -> publicado na vitrine e API de parceiros (R02)
- **Veredito**: **APROVADO**
- **Ações executadas e evidências reais**:
  1. **Enquanto em `draft` (`evt_36b3b8b8`)**:
     - `GET /api/events` (sem login): `events` não contém `evt_36b3b8b8` (`inPublicBefore: false`, `publicBeforeCount: 0`).
     - `GET /api/partner/events` (com `X-Api-Key: catraca-partner-key-2026`): `HTTP 200`, não contém `evt_36b3b8b8` (`inPartnerBefore: false`).
  2. **Publicação** (`POST /api/organizer/events/evt_36b3b8b8/publish` como Organizador A):
     ```json
     HTTP 200
     {
       "event": {
         "id": "evt_36b3b8b8",
         "organizerId": "usr_org_a",
         "name": "Show QA F02 Eval",
         "startsAt": "2026-12-26T21:53:44.008Z",
         "location": "Porao QA",
         "capacity": 2,
         "priceCents": 10000,
         "status": "published",
         "occupiedSeats": 0,
         "availableSeats": 2
       }
     }
     ```
  3. **Reconsulta após publicação**:
     - `GET /api/events` (sem login) retornou o evento:
       ```json
       {
         "id": "evt_36b3b8b8",
         "name": "Show QA F02 Eval",
         "startsAt": "2026-12-26T21:53:44.008Z",
         "location": "Porao QA",
         "priceCents": 10000,
         "capacity": 2,
         "availableSeats": 2
       }
       ```
     - `GET /api/partner/events` (com `X-Api-Key: catraca-partner-key-2026`) retornou `HTTP 200` com **exatamente** as 5 chaves do contrato fixo (`["id","name","startsAt","priceCents","availableSeats"]`):
       ```json
       {
         "id": "evt_36b3b8b8",
         "name": "Show QA F02 Eval",
         "startsAt": "2026-12-26T21:53:44.008Z",
         "priceCents": 10000,
         "availableSeats": 2
       }
       ```

---

### IT-F02-03 — Regras de edição de lotação e preço (R03)
- **Veredito**: **APROVADO**
- **Ações executadas e evidências reais**:
  1. **Aumento de lotação (`2 -> 4`) e alteração de preço (`10000 -> 15000`)** via `PUT /api/organizer/events/evt_36b3b8b8` (como Organizador A):
     ```json
     HTTP 200
     {
       "event": {
         "id": "evt_36b3b8b8",
         "organizerId": "usr_org_a",
         "name": "Show QA F02 Eval Editado",
         "startsAt": "2026-12-31T21:53:44.112Z",
         "location": "Porao QA Sala 2",
         "capacity": 4,
         "priceCents": 15000,
         "status": "published",
         "occupiedSeats": 0,
         "availableSeats": 4
       }
     }
     ```
     Refletido imediatamente em `GET /api/partner/events` e `GET /api/events`:
     ```json
     {
       "id": "evt_36b3b8b8",
       "name": "Show QA F02 Eval Editado",
       "startsAt": "2026-12-31T21:53:44.112Z",
       "priceCents": 15000,
       "availableSeats": 4
     }
     ```
  2. **Rejeição de redução de lotação abaixo de vagas ocupadas (`409 capacity_below_occupied`)**:
     - Validado na execução real de `npm run gates` (`backend/tests/f02-events.test.ts` — caso `R03: aceita aumento de lotação e alteração de preço; rejeita edição abaixo de vagas ocupadas`), que cria 3 ingressos ocupando vaga (`2 confirmed` + `1 pending`), tenta reduzir `capacity` para `2` via `PUT /api/organizer/events/:eventId` e comprova `HTTP 409` com `error: "capacity_below_occupied"` dentro de transação com `SELECT ... FOR UPDATE` (`backend/src/services/events.ts`, linhas 211–235).

---

### IT-F02-04 — Página de gestão própria e isolamento entre organizadores e perfis (R04, R13, CF-01)
- **Veredito**: **APROVADO**
- **Ações executadas e evidências reais**:
  1. **Página de gestão própria `/organizador/eventos/:id` e leitura pelo Organizador A**:
     - `GET /organizador/eventos/evt_36b3b8b8` -> `HTTP 200`, `content-type: text/html; charset=utf-8`, contendo `<div id="root">` (SPA React com rota `EventManagePage` protegida por `ProtectedRoute role="organizer"`).
     - `GET /api/organizer/events/evt_36b3b8b8` (Organizador A) -> `HTTP 200` com os dados completos do evento `evt_36b3b8b8`.
     - `GET /api/organizer/events` (Organizador A) -> inclui `evt_36b3b8b8`.
  2. **Isolamento do Organizador B (`org.b@catraca.local`)**:
     - `GET /api/organizer/events` -> `HTTP 200`, `count: 0`, `containsEventA: false`.
     - `GET /api/organizer/events/evt_36b3b8b8` -> `HTTP 404`, `{"error":"event_not_found","message":"Evento não encontrado"}` (zero vazamento de nome, lotação ou preço).
     - `PUT /api/organizer/events/evt_36b3b8b8` -> `HTTP 404`, `{"error":"event_not_found","message":"Evento não encontrado"}`.
     - `POST /api/organizer/events/evt_36b3b8b8/publish` -> `HTTP 404`, `{"error":"event_not_found","message":"Evento não encontrado"}`.
  3. **Bloqueio de Participante (`participante@catraca.local`) e Visitante (deslogado)**:
     - Participante `GET /api/organizer/events/evt_36b3b8b8` -> `HTTP 403`, `{"error":"forbidden"}`.
     - Participante `GET /api/organizer/events` -> `HTTP 403`, `{"error":"forbidden"}`.
     - Visitante `GET /api/organizer/events/evt_36b3b8b8` -> `HTTP 401`, `{"error":"unauthorized"}`.
     - Visitante `GET /api/organizer/events` -> `HTTP 401`, `{"error":"unauthorized"}`.
  4. **Proteção de `GET /api/partner/events` por `X-Api-Key`**:
     - Sem cabeçalho `X-Api-Key` -> `HTTP 401`, `{"error":"unauthorized"}`.
     - Com `X-Api-Key: invalid-key-xyz` -> `HTTP 401`, `{"error":"unauthorized"}`.

---

### IT-F02-05 — Gates automatizados passando
- **Veredito**: **APROVADO**
- **Comando executado**: `npm run gates`
- **Código de saída**: `0`
- **Evidência real da execução**:
  ```text
  ==> [1/3] Backend typecheck
  > catraca-backend@1.0.0 typecheck
  > tsc --noEmit

  ==> [2/3] Frontend typecheck and build
  > catraca-frontend@1.0.0 typecheck
  > tsc --noEmit

  > catraca-frontend@1.0.0 build
  > vite build
  ✓ 50 modules transformed.
  dist/index.html                   0.43 kB │ gzip:   0.30 kB
  dist/assets/index-LFhT8Ob_.css    3.51 kB │ gzip:   1.23 kB
  dist/assets/index-DCqIJu-E.js   504.69 kB │ gzip: 148.79 kB
  ✓ built in 4.26s

  ==> [3/3] Backend automated tests
  > catraca-backend@1.0.0 test
  > vitest run

   RUN  v3.2.7 /app/backend

   ✓ tests/f02-events.test.ts (4 tests) 3665ms
     ✓ F02 - Gestão de Eventos, Vitrine Pública e API de Parceiros > R01: rejeita data no passado, lotação < 1 e preço <= 0 ao criar e ao editar  743ms
     ✓ F02 - Gestão de Eventos, Vitrine Pública e API de Parceiros > R02: rascunho não aparece na vitrine nem na API; publicado aparece com contrato exato  664ms
     ✓ F02 - Gestão de Eventos, Vitrine Pública e API de Parceiros > R03: aceita aumento de lotação e alteração de preço; rejeita edição abaixo de vagas ocupadas  1024ms
     ✓ F02 - Gestão de Eventos, Vitrine Pública e API de Parceiros > R04, R13, CF-01: isolamento estrito entre Organizador A, Organizador B, Participante, Visitante e X-Api-Key  970ms
   ✓ tests/f01-auth.test.ts (5 tests) 4060ms
     ✓ F01 - Fundação, Autenticação, RBAC e X-Api-Key > GET /health retorna 200 ok  555ms
     ✓ F01 - Fundação, Autenticação, RBAC e X-Api-Key > seed cria 2 organizadores e 1 participante e é idempotente ao rodar novamente  1627ms
     ✓ F01 - Fundação, Autenticação, RBAC e X-Api-Key > participante cria conta, autentica e faz logout; nunca eleva para organizer  572ms
     ✓ F01 - Fundação, Autenticação, RBAC e X-Api-Key > R13: visitante recebe 401, participante recebe 403 e organizador acessa área de organizador  622ms
     ✓ F01 - Fundação, Autenticação, RBAC e X-Api-Key > API de parceiros rejeita ausência ou chave inválida com 401 unauthorized  404ms

   Test Files  2 passed (2)
        Tests  9 passed (9)
     Duration  9.88s
  ```
