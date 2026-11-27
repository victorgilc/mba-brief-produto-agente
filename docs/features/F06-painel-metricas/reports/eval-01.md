# Relatório de Avaliação Independente — F06 (Painel Consolidado de Métricas e Receita do Evento)

- **Data/Hora (ISO 8601)**: `2026-11-27T17:40:36-03:00` (`2026-11-27T20:40:36Z`)
- **Commit avaliado**: `08593c22770c2e73308247d4a52dba59d2472f65` (`08593c2`)
- **Branch avaliada**: `feat/f06-painel-metricas`
- **Ferramenta**: Antigravity
- **Modelo**: Gemini 4 Neon (High)
- **Contrato avaliado**: `docs/features/F06-painel-metricas/contract.md`
- **Veredito Geral**: **APROVADO**

---

## Pré-requisitos de Ambiente Verificados

- `git rev-parse HEAD` -> `08593c22770c2e73308247d4a52dba59d2472f65`
- `git branch --show-current` -> `feat/f06-painel-metricas`
- `curl.exe -s -i http://localhost:3000/health`:

```http
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-length: 15

{"status":"ok"}
```

- Contas autenticadas com sucesso no ambiente em execução:
  - Organizador A (`org.a@catraca.local`)
  - Organizador B (`org.b@catraca.local`)
  - Participante (`participante@catraca.local`)
  - Chave de parceiro `X-Api-Key: catraca-partner-key-2026`

---

## Tabela Resumo

| Item | Critérios PRD | Regras | Veredito |
| :--- | :--- | :--- | :--- |
| `IT-F06-01` | `AC-F06-1`, `AC-F06-2`, `CF-08`, `CF-09` | R03, R05, R12 | **APROVADO** |
| `IT-F06-02` | `CF-10` | R10, R12 | **APROVADO** |
| `IT-F06-03` | `AC-F06-2`, `AC-F06-3`, `CF-11` | R05, R11, R12 | **APROVADO** |
| `IT-F06-04` | `AC-F06-3`, `CF-08` | R13 | **APROVADO** |
| `IT-F06-05` | `AC-F06-1`, `CF-11` | R04, R12 | **APROVADO** |

---

## Evidências Detalhadas por Item

### `IT-F06-01` — Painel soma vitrine + API e calcula receita com preço histórico (R03, R12, CF-08, CF-09)

- **Veredito**: **APROVADO**
- **Ações executadas contra `http://localhost:3000`**:
  1. Como Organizador A, criado evento `E1` (`evt_f994f877`) com `capacity: 2`, `priceCents: 10000` (`R$ 100,00`) e publicado via `POST /api/organizer/events/evt_f994f877/publish`.
  2. Comprado 1 ingresso pela vitrine (`POST /api/events/evt_f994f877/purchases`, cartão `4111111111110001`) -> `tkt_9b16036056` (`QXMTJ2VJ`) e 1 ingresso pela API de parceiros (`POST /api/partner/events/evt_f994f877/purchases`, cartão `4111111111110001`) -> `tkt_e2cd370ef9` (`WCGJAX2P`).
  3. Verificado painel durante fase `pending` (ambos pendentes, `availableSeats: 0`, `revenueCents: 0`) e aguardada confirmação assíncrona de ambos pelo gateway simulado.
  4. Editado `E1` via `PUT /api/organizer/events/evt_f994f877` alterando `capacity: 3` e `priceCents: 15000` (`R$ 150,00`).
  5. Comprado 1 novo ingresso pela API de parceiros (`POST /api/partner/events/evt_f994f877/purchases`, cartão `4111111111110001`) -> `tkt_0fbe77d239` (`XTZCDKRW`) e aguardada confirmação.
  6. Consultado `GET /api/organizer/events/evt_f994f877/panel` e `GET /api/organizer/events/evt_f994f877`.
- **Evidência real**:

```text
Create E1: 201 {"event":{"id":"evt_f994f877","organizerId":"usr_org_a","name":"Eval F06 E1 1795811905361","startsAt":"2026-12-07T20:38:25.361Z","location":"Auditório Central","capacity":2,"priceCents":10000,"status":"draft","occupiedSeats":0,"availableSeats":2}}
Publish E1: 200 {"event":{"id":"evt_f994f877","organizerId":"usr_org_a","name":"Eval F06 E1 1795811905361","startsAt":"2026-12-07T20:38:25.361Z","location":"Auditório Central","capacity":2,"priceCents":10000,"status":"published","occupiedSeats":0,"availableSeats":2}}
Web purchase on E1: 202 {"ticket":{"ticketId":"tkt_9b16036056","code":"QXMTJ2VJ","status":"pending"}}
Partner purchase 1 on E1: 202 {"ticketId":"tkt_e2cd370ef9","code":"WCGJAX2P","status":"pending"}
Panel right after 2 purchases (pending phase): 200 {"eventId":"evt_f994f877","confirmed":0,"pending":2,"checkedIn":0,"availableSeats":0,"revenueCents":0,"refunded":0}
Web ticket confirmed: {"elapsedMs":3696,"ticket":{"ticketId":"tkt_9b16036056","code":"QXMTJ2VJ","eventId":"evt_f994f877","status":"confirmed","checkedIn":false}}
Partner ticket 1 confirmed: {"elapsedMs":16,"ticket":{"ticketId":"tkt_e2cd370ef9","code":"WCGJAX2P","eventId":"evt_f994f877","status":"confirmed","checkedIn":false}}
Edit E1 (cap=3, price=15000): 200 {"event":{"id":"evt_f994f877","organizerId":"usr_org_a","name":"Eval F06 E1 1795811905361","startsAt":"2026-12-07T20:38:25.361Z","location":"Auditório Central","capacity":3,"priceCents":15000,"status":"published","occupiedSeats":2,"availableSeats":1}}
Partner purchase 2 on E1 (at R$ 150): 202 {"ticketId":"tkt_0fbe77d239","code":"XTZCDKRW","status":"pending"}
Partner ticket 2 confirmed: {"elapsedMs":2656,"ticket":{"ticketId":"tkt_0fbe77d239","code":"XTZCDKRW","eventId":"evt_f994f877","status":"confirmed","checkedIn":false}}
GET /api/organizer/events/:E1/panel: 200 {"eventId":"evt_f994f877","confirmed":3,"pending":0,"checkedIn":0,"availableSeats":0,"revenueCents":35000,"refunded":0}
GET /api/organizer/events/:E1 (embedded panel): 200 {"eventId":"evt_f994f877","confirmed":3,"pending":0,"checkedIn":0,"availableSeats":0,"revenueCents":35000,"refunded":0}
```

- **Análise**: Todos os 6 números conferem exatamente (`confirmed: 3`, `pending: 0`, `checkedIn: 0`, `availableSeats: 0`, `revenueCents: 35000` = `2 x 10000 + 1 x 15000`, `refunded: 0`), consolidando vitrine + API e respeitando o preço histórico de cada compra.

---

### `IT-F06-02` — Check-in atualiza painel preservando Confirmados (R12, CF-10)

- **Veredito**: **APROVADO**
- **Ações executadas contra `http://localhost:3000`**:
  1. Realizado check-in do ingresso confirmado `QXMTJ2VJ` (`tkt_9b16036056`) no evento `evt_f994f877` via `POST /api/organizer/events/evt_f994f877/checkin`.
  2. Consultado `GET /api/organizer/events/evt_f994f877/panel`.
- **Evidência real**:

```text
POST /api/organizer/events/evt_f994f877/checkin (code=QXMTJ2VJ): 200 {"ok":true,"reason":"checked_in","message":"Entrada liberada"}
GET /api/organizer/events/:E1/panel after check-in: 200 {"eventId":"evt_f994f877","confirmed":3,"pending":0,"checkedIn":1,"availableSeats":0,"revenueCents":35000,"refunded":0}
```

- **Análise**: `checkedIn` passou a `1`, `confirmed` permaneceu `3` e todos os demais números (`pending: 0`, `availableSeats: 0`, `revenueCents: 35000`, `refunded: 0`) permaneceram inalterados.

---

### `IT-F06-03` — Painel após cancelamento e resposta tardia do gateway (R05, R11, R12, CF-11)

- **Veredito**: **APROVADO**
- **Ações executadas contra `http://localhost:3000`**:
  1. Como Organizador A, criado e publicado evento `E3` (`evt_e0d4dcfb`, lotação `5`, `priceCents: 5000` = `R$ 50,00`).
  2. Comprado `$T5` (`tkt_5b7de74ac2`) com cartão `4111111111110003` (aprovação tardia em 30–40s) e `$T6` (`tkt_cc9fdeba46`) com cartão `4111111111110001` (aprovação rápida em 2–5s).
  3. Aguardada confirmação de `$T6` (2.115 ms), verificado que `$T5` ainda estava `pending` e cancelado `E3` aos 2.160 ms (< 30s) via `POST /api/organizer/events/evt_e0d4dcfb/cancel`.
  4. Consultado `GET /api/organizer/events/evt_e0d4dcfb/panel` e os status de `$T5` e `$T6` imediatamente após o cancelamento.
  5. Aguardado tempo total de 46.008 ms (>= 45s desde a compra de `$T5`, após janela de 30–40s do gateway simulado) e consultado novamente `GET /api/organizer/events/evt_e0d4dcfb/panel` e os status de `$T5` e `$T6`.
- **Evidência real**:

```text
Create E3: 201 {"event":{"id":"evt_e0d4dcfb","organizerId":"usr_org_a","name":"Eval F06 E3 1795811905361","startsAt":"2026-12-07T20:38:25.361Z","location":"Sala 3","capacity":5,"priceCents":5000,"status":"draft","occupiedSeats":0,"availableSeats":5}}
Publish E3: 200 {"event":{"id":"evt_e0d4dcfb","organizerId":"usr_org_a","name":"Eval F06 E3 1795811905361","startsAt":"2026-12-07T20:38:25.361Z","location":"Sala 3","capacity":5,"priceCents":5000,"status":"published","occupiedSeats":0,"availableSeats":5}}
Buy $T5 (0003 slow): 202 {"ticketId":"tkt_5b7de74ac2","code":"Y255MA4D","status":"pending"}
Buy $T6 (0001 fast): 202 {"ticketId":"tkt_cc9fdeba46","code":"DPZ7J896","status":"pending"}
$T6 confirmed: {"elapsedMs":2115,"ticket":{"ticketId":"tkt_cc9fdeba46","code":"DPZ7J896","eventId":"evt_e0d4dcfb","status":"confirmed","checkedIn":false}}
$T5 before cancel: 200 {"ticketId":"tkt_5b7de74ac2","code":"Y255MA4D","eventId":"evt_e0d4dcfb","status":"pending","checkedIn":false}
Elapsed since $T5 purchase before cancel: 2160ms (must be < 30000ms)
Cancel E3: 200 {"event":{"id":"evt_e0d4dcfb","organizerId":"usr_org_a","name":"Eval F06 E3 1795811905361","startsAt":"2026-12-07T20:38:25.361Z","location":"Sala 3","capacity":5,"priceCents":5000,"status":"cancelled","occupiedSeats":0,"availableSeats":0},"refundedCount":1,"cancelledCount":1}
GET /api/organizer/events/:E3/panel (immediate after cancel): 200 {"eventId":"evt_e0d4dcfb","confirmed":0,"pending":0,"checkedIn":0,"availableSeats":0,"revenueCents":0,"refunded":1}
$T5 immediate after cancel: 200 {"ticketId":"tkt_5b7de74ac2","code":"Y255MA4D","eventId":"evt_e0d4dcfb","status":"cancelled","checkedIn":false}
$T6 immediate after cancel: 200 {"ticketId":"tkt_cc9fdeba46","code":"DPZ7J896","eventId":"evt_e0d4dcfb","status":"refunded","checkedIn":false}
Waiting 43787ms so total elapsed since $T5 purchase >= 46s...
Elapsed since $T5 purchase now: 46008ms (>= 45000ms)
GET /api/organizer/events/:E3/panel (after 45s): 200 {"eventId":"evt_e0d4dcfb","confirmed":0,"pending":0,"checkedIn":0,"availableSeats":0,"revenueCents":0,"refunded":1}
$T5 after 45s: 200 {"ticketId":"tkt_5b7de74ac2","code":"Y255MA4D","eventId":"evt_e0d4dcfb","status":"cancelled","checkedIn":false}
$T6 after 45s: 200 {"ticketId":"tkt_cc9fdeba46","code":"DPZ7J896","eventId":"evt_e0d4dcfb","status":"refunded","checkedIn":false}
```

- **Análise**: Tanto imediatamente após o cancelamento quanto após 46s (depois do callback tardio do cartão `0003`), o painel retornou exatamente `confirmed: 0`, `pending: 0`, `checkedIn: 0`, `availableSeats: 0`, `revenueCents: 0` e `refunded: 1`, sem somar estorno como receita e mantendo `$T5` como `cancelled` e `$T6` como `refunded`.

---

### `IT-F06-04` — Isolamento do painel por organizador e perfis (R13, CF-08)

- **Veredito**: **APROVADO**
- **Ações executadas contra `http://localhost:3000`**:
  1. Como Organizador B (`org.b@catraca.local`), consultados `GET /api/organizer/events/evt_f994f877/panel` e `GET /api/organizer/events/evt_f994f877`.
  2. Como Participante (`participante@catraca.local`), consultado `GET /api/organizer/events/evt_f994f877/panel`.
  3. Como Visitante (sem cookie de sessão), consultado `GET /api/organizer/events/evt_f994f877/panel`.
- **Evidência real**:

```text
Org B GET panel: 404 {"error":"event_not_found","message":"Evento não encontrado"}
Org B GET event detail: 404 {"error":"event_not_found","message":"Evento não encontrado"}
Participant GET panel: 403 {"error":"forbidden"}
Visitor GET panel: 401 {"error":"unauthorized"}
```

- **Análise**: Nenhum dado do evento ou do painel de Organizador A vazou para Organizador B (`404`), Participante (`403`) ou Visitante (`401`).

---

### `IT-F06-05` — UI do painel na página de gestão e gates automatizados (R04, R12)

- **Veredito**: **APROVADO**
- **Ações executadas**:
  1. Inspeção de código em `frontend/src/App.tsx` (rota `/organizador/eventos/:eventId` montando `EventManagePage` sob `<ProtectedRoute role="organizer">`), `frontend/src/pages/EventManagePage.tsx` (carregando `panel` de `/api/organizer/events/${eventId}` e renderizando `<EventPanel panel={panel} onRefresh={loadEvent} />`), `frontend/src/components/EventPanel.tsx` e `frontend/src/lib/api.ts` (`formatBRL` formatando `revenueCents` em `BRL`/`R$`).
  2. Verificação HTTP real na aplicação servida em `http://localhost:3000/organizador/eventos/evt_f994f877` e no bundle JS servido em `/assets/index-D8DmrA9_.js`.
  3. Execução real de `npm run gates` na raiz do repositório.
- **Evidência real — Código-fonte (`EventPanel.tsx`, linhas 36–73)**:
  - Renderiza os 6 rótulos literais exatos exigidos por R12: `Confirmados`, `Pendentes`, `Check-ins`, `Vagas disponíveis`, `Receita` (via `formatBRL(panel.revenueCents)`) e `Estornados`.
- **Evidência real — Bundle frontend servido ao vivo em `http://localhost:3000`**:

```text
GET /organizador/eventos/evt_f994f877 status: 200
Referenced JS bundles: [ '/assets/index-D8DmrA9_.js' ]
GET /assets/index-D8DmrA9_.js: status=200, length=287973

Painel do evento true
Atualizar painel true
metric-confirmed true
metric-pending true
metric-checked-in true
metric-available-seats true
metric-revenue true
metric-refunded true
Confirmados true
Pendentes true
Check-ins true
Vagas disponíveis true
Receita true
Estornados true
```

- **Evidência real — Execução de `npm run gates`**:

```text
> catraca@1.0.0 gates
> node scripts/gates.mjs

==> [1/3] Backend typecheck
> tsc --noEmit (OK)

==> [2/3] Frontend typecheck and build
> tsc --noEmit (OK)
> vite build
✓ 54 modules transformed.
✓ built in 4.01s

==> [3/3] Backend automated tests
> vitest run

 ✓ tests/f04-checkin.test.ts (5 tests) 5517ms
 ✓ tests/f05-cancellation.test.ts (4 tests) 4670ms
 ✓ tests/f03-purchases.test.ts (6 tests) 6149ms
 ✓ tests/f02-events.test.ts (4 tests) 3332ms
 ✓ tests/f06-panel-e2e.test.ts (3 tests) 4092ms
 ✓ tests/f01-auth.test.ts (5 tests) 4644ms

 Test Files  6 passed (6)
      Tests  27 passed (27)
   Duration  33.94s
Command exited with code 0.
```

---

## Conclusão

Todos os 5 itens verificáveis do contrato da feature **F06** (`IT-F06-01` a `IT-F06-05`) foram executados e validados com evidência real contra a aplicação em execução (`http://localhost:3000`) e via `npm run gates` no commit `08593c22770c2e73308247d4a52dba59d2472f65` (`feat/f06-painel-metricas`). Não foram encontradas divergências nem regressões.

**Veredito final: APROVADO.**
