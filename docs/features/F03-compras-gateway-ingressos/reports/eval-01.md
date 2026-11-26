# Relatório de Avaliação Independente — F03 (eval-01)

- **Feature**: `F03-compras-gateway-ingressos` — Motor de Compras, Concorrência, Gateway Simulado, API de Parceiros e Meus Ingressos
- **Data/Hora**: `2026-11-26T19:03:08-03:00`
- **Commit avaliado**: `8ae18304b17073fd51ad78d0997b04614260daac` (`8ae1830`)
- **Branch avaliada**: `feat/f03-compras-gateway-ingressos`
- **Ferramenta**: Antigravity
- **Modelo**: Gemini 4 Neon (High)
- **Contrato de referência**: `docs/features/F03-compras-gateway-ingressos/contract.md`
- **Veredito Geral**: **APROVADO**

---

## Tabela Resumo

| Item | Critérios PRD | Regras | Veredito |
| :--- | :--- | :--- | :--- |
| `IT-F03-01` — Compra na vitrine, gateway 0001 e "Meus ingressos" | `AC-F03-1`, `AC-F03-3`, `AC-F03-4`, `CF-02` | R06, R08, R09 | **APROVADO** |
| `IT-F03-02` — Ocupação de vaga pendente, recusa com cartão lento 0004 e esgotamento | `AC-F03-1`, `AC-F03-2`, `CF-03` | R05, R06, R07, R08 | **APROVADO** |
| `IT-F03-03` — Concorrência sob carga: 30 compras simultâneas em lotação 5 | `AC-F03-2` | R07 | **APROVADO** |
| `IT-F03-04` — Contrato fixo e ordem de erros da API de parceiros | `AC-F03-4`, `CF-02`, `CF-03` | API Parceiros | **APROVADO** |
| `IT-F03-05` — Integração com edição de lotação e snapshot de preço | `CF-03` | R03 | **APROVADO** |
| `IT-F03-06` — Gates automatizados passando | `CF-03` | Harness/Testes | **APROVADO** |

---

## Pré-requisitos Verificados

- Stack ativo via Docker Compose (`catraca-app` e `catraca-db` com status `healthy`).
- `curl.exe -s -i http://localhost:3000/health` retornou:
  ```text
  HTTP/1.1 200 OK
  content-type: application/json; charset=utf-8
  {"status":"ok"}
  ```
- Variáveis de ambiente confirmadas dentro do container `catraca-app` (`docker compose exec -T app printenv GATEWAY_DELAY_MODE PARTNER_API_KEY`):
  ```text
  default
  catraca-partner-key-2026
  ```
- SPA servida em `/` e `/meus-ingressos` com HTTP `200` e bundle publicado contendo os rótulos literais da interface (`Ingressos esgotados`, `Meus ingressos`, `pendente`, `confirmado`, `recusado`, `cancelado`, `estornado`):
  ```text
  GET /: 200 hasRoot: true
  GET /meus-ingressos: 200 hasRoot: true
  BUNDLE_URL: http://localhost:3000/assets/index-BnqvxTtE.js
  BUNDLE_HAS_Ingressos esgotados: true
  BUNDLE_HAS_Meus ingressos: true
  BUNDLE_HAS_pendente: true
  BUNDLE_HAS_confirmado: true
  BUNDLE_HAS_recusado: true
  BUNDLE_HAS_cancelado: true
  BUNDLE_HAS_estornado: true
  ```

---

## Evidências Detalhadas por Item

### IT-F03-01 — Compra na vitrine, gateway 0001 e "Meus ingressos" (R06, R08, R09, CF-02)
- **Veredito**: **APROVADO**
- **Ação executada**:
  1. Autenticação como Organizador A (`org.a@catraca.local`) e Participante (`participante@catraca.local`) via `POST /api/auth/login`.
  2. Criação (`POST /api/organizer/events`) e publicação (`POST /api/organizer/events/:id/publish`) do evento `Eval F03 Show 01` com `capacity: 2` e `priceCents: 10000`.
  3. Compra pela vitrine (`POST /api/events/:id/purchases`) com cartão `4000000000000001`, medição de latência, checagem imediata em `GET /api/me/tickets`, `GET /api/events` e `GET /api/partner/events`.
  4. Polling em `GET /api/me/tickets` até confirmação (janela <= 5s) e consulta cruzada via `GET /api/partner/tickets/:ticketId` com `X-Api-Key: catraca-partner-key-2026`.
- **Evidência real**:
  ```text
  CREATE_EVENT: 201 {"event":{"id":"evt_06477dd5","organizerId":"usr_org_a","name":"Eval F03 Show 01","startsAt":"2026-12-03T22:00:39.970Z","location":"Bar Catraca QA","capacity":2,"priceCents":10000,"status":"draft","occupiedSeats":0,"availableSeats":2}}
  PUBLISH_EVENT: 200 {"event":{"id":"evt_06477dd5","organizerId":"usr_org_a","name":"Eval F03 Show 01","startsAt":"2026-12-03T22:00:39.970Z","location":"Bar Catraca QA","capacity":2,"priceCents":10000,"status":"published","occupiedSeats":0,"availableSeats":2}}
  WEB_PURCHASE_0001: 202 latencyMs=27 {"ticket":{"ticketId":"tkt_b2b8e1653f","code":"WX9FLBMR","status":"pending"}}
  ME_TICKETS_IMMEDIATE: 200 {"ticketId":"tkt_b2b8e1653f","code":"WX9FLBMR","eventId":"evt_06477dd5","eventName":"Eval F03 Show 01","eventStartsAt":"2026-12-03T22:00:39.970Z","eventLocation":"Bar Catraca QA","status":"pending","checkedIn":false,"priceCents":10000,"createdAt":"2026-11-26T22:00:40.048Z"}
  AVAIL_IMMEDIATE_WEB: {"id":"evt_06477dd5","name":"Eval F03 Show 01","startsAt":"2026-12-03T22:00:39.970Z","location":"Bar Catraca QA","priceCents":10000,"capacity":2,"availableSeats":1}
  AVAIL_IMMEDIATE_PARTNER: {"id":"evt_06477dd5","name":"Eval F03 Show 01","startsAt":"2026-12-03T22:00:39.970Z","priceCents":10000,"availableSeats":1}
  ME_TICKETS_AFTER_WAIT: confirmedAtMs=2708 {"ticketId":"tkt_b2b8e1653f","code":"WX9FLBMR","eventId":"evt_06477dd5","eventName":"Eval F03 Show 01","eventStartsAt":"2026-12-03T22:00:39.970Z","eventLocation":"Bar Catraca QA","status":"confirmed","checkedIn":false,"priceCents":10000,"createdAt":"2026-11-26T22:00:40.048Z"}
  PARTNER_GET_TICKET_1: 200 {"ticketId":"tkt_b2b8e1653f","code":"WX9FLBMR","eventId":"evt_06477dd5","status":"confirmed","checkedIn":false}
  CODE_MATCH: true
  ```
- **Análise**: Compra respondeu `202` em `27ms` sem aguardar o gateway, criou ingresso `pending` com código único `WX9FLBMR`, reduziu `availableSeats` de `2` para `1` imediatamente, confirmou em `2708ms` (<= 5s) e retornou `200` com `status: "confirmed"`, `checkedIn: false` e mesmo `code` na API de parceiros. A tela `MyTicketsPage.tsx` mapeia `pending` -> `pendente` e `confirmed` -> `confirmado` exibindo evento, status e código.

---

### IT-F03-02 — Ocupação de vaga pendente, recusa com cartão lento 0004 e esgotamento (R05, R06, R07, R08, CF-03)
- **Veredito**: **APROVADO**
- **Ação executada**:
  1. Com `availableSeats: 1` no evento `evt_06477dd5`, disparada compra via `POST /api/partner/events/evt_06477dd5/purchases` com cartão lento `4000000000000004` em modo real (`GATEWAY_DELAY_MODE=default`).
  2. Verificação imediata de `availableSeats: 0` em `GET /api/partner/events`.
  3. Tentativa de novas compras antes de 30s (aos ~2s) tanto na API de parceiros quanto na vitrine, além de nova verificação aos ~25s (< 30s) confirmando permanência em `pending` e `availableSeats: 0`.
  4. Espera real de 45 segundos e verificação final via `GET /api/partner/tickets/:ticketId`, `GET /api/partner/events` e `GET /api/events`.
- **Evidência real**:
  ```text
  PARTNER_PURCHASE_0004: 202 latencyMs=26 {"ticketId":"tkt_2759d20e04","code":"5C234TRY","status":"pending"}
  PARTNER_EVENTS_IMMEDIATE_0004: {"id":"evt_06477dd5","name":"Eval F03 Show 01","startsAt":"2026-12-03T22:00:39.970Z","priceCents":10000,"availableSeats":0}
  TICKET_0004_AT_2S: elapsedMs=2073 {"ticketId":"tkt_2759d20e04","code":"5C234TRY","eventId":"evt_06477dd5","status":"pending","checkedIn":false}
  SOLD_OUT_PARTNER: 409 {"error":"sold_out"}
  SOLD_OUT_WEB: 409 {"error":"sold_out","message":"Ingressos esgotados"}
  TICKET_0004_AT_25S: elapsedMs=25041 {"ticketId":"tkt_2759d20e04","code":"5C234TRY","eventId":"evt_06477dd5","status":"pending","checkedIn":false} availableSeats= 0
  TICKET_0004_AT_45S: elapsedMs=45059 200 {"ticketId":"tkt_2759d20e04","code":"5C234TRY","eventId":"evt_06477dd5","status":"declined","checkedIn":false}
  PARTNER_EVENTS_AT_45S: {"id":"evt_06477dd5","name":"Eval F03 Show 01","startsAt":"2026-12-03T22:00:39.970Z","priceCents":10000,"availableSeats":1}
  WEB_EVENTS_AT_45S: {"id":"evt_06477dd5","name":"Eval F03 Show 01","startsAt":"2026-12-03T22:00:39.970Z","location":"Bar Catraca QA","priceCents":10000,"capacity":2,"availableSeats":1}
  ```
- **Análise**: A vaga foi ocupada imediatamente (`availableSeats: 0`), permaneceu ocupada e `pending` aos `2073ms` e `25041ms` (< 30s), bloqueou novas compras com `409 {"error":"sold_out"}` na API e `409` (`Ingressos esgotados`, também renderizado pela `StorefrontPage.tsx` quando `availableSeats <= 0`) na vitrine. Aos `45059ms` (após janela 30–40s), o ingresso mudou para `declined` e `availableSeats` voltou para `1`.

---

### IT-F03-03 — Concorrência sob carga: 30 compras simultâneas em lotação 5 (R07)
- **Veredito**: **APROVADO**
- **Ação executada**:
  1. Criação e publicação de dois novos eventos (`Eval F03 E_conc1` e `Eval F03 E_conc2`), cada um com `capacity: 5`.
  2. Disparo de 30 requisições HTTP reais simultâneas (`Promise.all` + `fetch`) para `POST /api/partner/events/:id/purchases` com cartão `4000000000000001` em cada um dos dois eventos.
  3. Contagem dos códigos HTTP retornados, unicidade dos códigos de ingresso, checagem de `availableSeats` em `GET /api/partner/events` e auditoria direta na tabela `tickets` no PostgreSQL.
- **Evidência real**:
  ```text
  CONCURRENCY_Eval F03 E_conc1: eventId=evt_4b651196 statusCounts={"202":5,"409":25} uniqueCodes=5 bodies409=["{\"error\":\"sold_out\"}"] availableSeats=0
  CONCURRENCY_Eval F03 E_conc2: eventId=evt_bd1a9f74 statusCounts={"202":5,"409":25} uniqueCodes=5 bodies409=["{\"error\":\"sold_out\"}"] availableSeats=0
  ```
  Auditoria PostgreSQL (`SELECT event_id, COUNT(*) AS total, COUNT(*) FILTER (WHERE status IN ('pending','confirmed')) AS occupied FROM tickets WHERE event_id IN ('evt_4b651196','evt_bd1a9f74') GROUP BY event_id ORDER BY event_id;`):
  ```text
     event_id   | total | occupied 
  --------------+-------+----------
   evt_4b651196 |     5 |        5
   evt_bd1a9f74 |     5 |        5
  (2 rows)
  ```
- **Análise**: Em ambas as rodadas reais sobre HTTP, houve exatamente `5` respostas `202` (com 5 códigos únicos) e `25` respostas `409 {"error":"sold_out"}`, `availableSeats: 0` e exatamente `5` registros no banco por evento, confirmando o bloqueio pessimista `SELECT ... FOR UPDATE` (R07).

---

### IT-F03-04 — Contrato fixo e ordem de erros da API de parceiros (CF-02, CF-03)
- **Veredito**: **APROVADO**
- **Ação executada**:
  1. Requisições sem `X-Api-Key` e com chave inválida em `POST /api/partner/events/:id/purchases` e `GET /api/partner/tickets/:ticketId`.
  2. Requisições com corpo inválido (`cardNumber: "123"`, e-mail inválido, campo ausente) contra evento inexistente, evento esgotado (`evt_4b651196`) e evento aberto (`evt_6042e71d`), verificando precedência de `422` sobre `404`/`409` e ausência de criação de ingresso.
  3. Requisições com corpo válido contra evento inexistente e contra evento em rascunho (`draft`).
  4. Consulta `GET /api/partner/tickets/tkt_nao_existe` com chave válida.
- **Evidência real**:
  ```text
  PURCHASE_NO_API_KEY: 401 {"error":"unauthorized"}
  PURCHASE_WRONG_API_KEY: 401 {"error":"unauthorized"}
  TICKET_NO_API_KEY: 401 {"error":"unauthorized"}
  TICKET_WRONG_API_KEY: 401 {"error":"unauthorized"}
  INVALID_CARD_ON_NONEXISTENT_EVENT: 422 {"error":"invalid_request"}
  INVALID_EMAIL_ON_NONEXISTENT_EVENT: 422 {"error":"invalid_request"}
  MISSING_FIELD_ON_NONEXISTENT_EVENT: 422 {"error":"invalid_request"}
  INVALID_CARD_ON_SOLDOUT_EVENT: 422 {"error":"invalid_request"}
  INVALID_CARD_ON_OPEN_EVENT: 422 {"error":"invalid_request"}
  VALID_BODY_NONEXISTENT_EVENT: 404 {"error":"event_not_available"}
  VALID_BODY_DRAFT_EVENT: 404 {"error":"event_not_available"}
  GET_TICKET_NOT_FOUND: 404 {"error":"ticket_not_found"}
  OPEN_EVENT_AVAIL_AFTER_INVALID_CARD: {"id":"evt_6042e71d","name":"Eval F03 Open Validation","startsAt":"2026-12-06T22:01:46.096Z","priceCents":5000,"availableSeats":5}
  ```
- **Análise**: Todos os status HTTP e corpos JSON obedecem rigorosamente o contrato fixo e a precedência `401 unauthorized` -> `422 invalid_request` -> `404 event_not_available` -> `409 sold_out` (e `404 ticket_not_found` na consulta de ingresso), sem criar ingresso em caso de cartão inválido (`availableSeats` permaneceu `5`).

---

### IT-F03-05 — Integração com edição de lotação e snapshot de preço (R03, CF-03)
- **Veredito**: **APROVADO**
- **Ação executada**:
  1. Criação e publicação de evento `Eval F03 R03 PriceCap` (`evt_2e2af211`) com `capacity: 2` e `priceCents: 10000`.
  2. Compra de 2 ingressos pelo Participante com cartão `4000000000000001`.
  3. Tentativa de reduzir lotação para `1` via `PUT /api/organizer/events/evt_2e2af211` enquanto ambos os ingressos estavam `pending` e novamente após ambos confirmarem (`confirmed`).
  4. Atualização de preço para `15000` (`R$ 150,00`) e lotação para `3` (`PUT /api/organizer/events/evt_2e2af211`).
  5. Compra de um terceiro ingresso e verificação de `priceCents` em `GET /api/me/tickets` e diretamente na tabela `tickets` do PostgreSQL.
- **Evidência real**:
  ```text
  R03_BUY_1: {"ticket":{"ticketId":"tkt_5142b7d6a3","code":"X2RBLNSC","status":"pending"}}
  R03_BUY_2: {"ticket":{"ticketId":"tkt_ebda3b7892","code":"TB6BZZ3R","status":"pending"}}
  R03_REDUCE_WHILE_PENDING: 409 {"error":"capacity_below_occupied","message":"A lotação não pode ser menor que as vagas ocupadas (2)"}
  R03_REDUCE_WHILE_CONFIRMED: 409 {"error":"capacity_below_occupied","message":"A lotação não pode ser menor que as vagas ocupadas (2)"}
  R03_UPDATE_PRICE_150_CAP_3: 200 {"event":{"id":"evt_2e2af211","organizerId":"usr_org_a","name":"Eval F03 R03 PriceCap","startsAt":"2026-12-06T22:01:46.183Z","location":"Sala QA","capacity":3,"priceCents":15000,"status":"published","occupiedSeats":2,"availableSeats":1}}
  R03_BUY_3: 202 {"ticket":{"ticketId":"tkt_fab6b4a2d3","code":"NQ8AS79M","status":"pending"}}
  R03_TICKETS_PRICE_SNAPSHOT: [{"ticketId":"tkt_fab6b4a2d3","status":"pending","priceCents":15000},{"ticketId":"tkt_ebda3b7892","status":"confirmed","priceCents":10000},{"ticketId":"tkt_5142b7d6a3","status":"confirmed","priceCents":10000}]
  ```
  Auditoria PostgreSQL (`SELECT id, status, price_cents FROM tickets WHERE event_id = 'evt_2e2af211' ORDER BY created_at ASC;`):
  ```text
         id       |  status   | price_cents 
  ----------------+-----------+-------------
   tkt_5142b7d6a3 | confirmed |       10000
   tkt_ebda3b7892 | confirmed |       10000
   tkt_fab6b4a2d3 | confirmed |       15000
  (3 rows)
  ```
- **Análise**: A redução da lotação abaixo de `occupiedSeats` foi rejeitada com `409 capacity_below_occupied` tanto com ingressos `pending` quanto `confirmed`. A alteração de preço para `15000` e lotação para `3` foi aceita (`200`), preservando `priceCents: 10000` nos dois primeiros ingressos e gravando `priceCents: 15000` no terceiro.

---

### IT-F03-06 — Gates automatizados passando
- **Veredito**: **APROVADO**
- **Comando executado**: `npm run gates`
- **Evidência real**:
  ```text
  ==> [1/3] Backend typecheck
  > catraca-backend@1.0.0 typecheck
  > tsc --noEmit

  ==> [2/3] Frontend typecheck and build
  > catraca-frontend@1.0.0 typecheck
  > tsc --noEmit
  > catraca-frontend@1.0.0 build
  > vite build
  ✓ built in 4.00s

  ==> [3/3] Backend automated tests
  > catraca-backend@1.0.0 test
  > vitest run

   ✓ tests/f03-purchases.test.ts (6 tests) 6045ms
   ✓ tests/f02-events.test.ts (4 tests) 3256ms
   ✓ tests/f01-auth.test.ts (5 tests) 4607ms

   Test Files  3 passed (3)
        Tests  15 passed (15)
     Duration  16.77s

  Command exited with code 0.
  ```
- **Análise**: Typecheck do backend, typecheck + build do frontend e todos os 15 testes automatizados (incluindo os 6 novos testes de F03 com concorrência) executaram em ambiente isolado Docker e encerraram com código de saída `0`.
