# Relatório de Avaliação Independente — F05 (`eval-01`)

- **Feature**: F05 — Cancelamento Irreversível de Eventos e Reconciliação com Gateway
- **Data/Hora (ISO 8601)**: `2026-11-26T19:22:17-03:00` (`2026-11-26T22:22:17Z`)
- **Commit avaliado**: `c55607f5ddad37cd5f61f0cc3ddf86ce8442966f` (`c55607f`)
- **Branch avaliada**: `feat/f05-cancelamento`
- **Worktree**: `e:\mba\mba-brief-produto-agente\.worktrees\f05-cancelamento`
- **Ferramenta**: Antigravity
- **Modelo**: Gemini 4 Neon (High)
- **Veredito Geral**: **APROVADO**

---

## Tabela Resumo

| Item | Critérios PRD | Regras | Veredito |
| :--- | :--- | :--- | :--- |
| `IT-F05-01` | `AC-F05-1`, `CF-06` | `R02`, `R05`, `R11` | **APROVADO** |
| `IT-F05-02` | `AC-F05-2`, `AC-F05-3`, `CF-07` | `R06`, `R08`, `R11` | **APROVADO** |
| `IT-F05-03` | `AC-F05-4` | `R13` | **APROVADO** |
| `IT-F05-04` | `AC-F05-1`, `CF-06` | `R04`, `R11` | **APROVADO** |
| `IT-F05-05` | `CF-07` | `R01`–`R13` (regressão + F05) | **APROVADO** |

---

## Pré-requisitos e Metadados de Ambiente

**Comandos executados**:
```powershell
Set-Location "e:\mba\mba-brief-produto-agente\.worktrees\f05-cancelamento"
git rev-parse HEAD
git rev-parse --short HEAD
git branch --show-current
git status --short
curl.exe -s -i http://localhost:3000/health
```

**Evidência real**:
```text
c55607f5ddad37cd5f61f0cc3ddf86ce8442966f
c55607f
feat/f05-cancelamento
HTTP/1.1 200 OK
content-type: application/json; charset=utf-8
content-length: 15
Date: Thu, 26 Nov 2026 22:18:02 GMT

{"status":"ok"}
```

Autenticação das contas seed confirmada via `POST /api/auth/login`:
```text
OrgA: 200 org.a@catraca.local organizer
OrgB: 200 org.b@catraca.local organizer
Part: 200 participante@catraca.local participant
```

---

## Detalhamento por Item do Contrato

### `IT-F05-01` — Irreversibilidade, remoção de canais e bloqueio de compras/edição (`R02`, `R05`, `R11`, `CF-06`)

- **Veredito**: **APROVADO**
- **Ação executada**:
  1. Como Organizador A, criado evento `E3` (`capacity: 5`, `priceCents: 5000`) via `POST /api/organizer/events` e publicado via `POST /api/organizer/events/evt_347ed2b6/publish`.
  2. Verificada presença inicial em `GET /api/events` e `GET /api/partner/events` (com `X-Api-Key: catraca-partner-key-2026`).
  3. Cancelado via `POST /api/organizer/events/evt_347ed2b6/cancel`.
  4. Verificada ausência em `GET /api/events` e `GET /api/partner/events`.
  5. Testadas compras após cancelamento na API de parceiros (`POST /api/partner/events/evt_347ed2b6/purchases`) e na vitrine (`POST /api/events/evt_347ed2b6/purchases`).
  6. Testadas edição (`PUT /api/organizer/events/evt_347ed2b6`), republicação (`POST /api/organizer/events/evt_347ed2b6/publish`) e novo cancelamento (`POST /api/organizer/events/evt_347ed2b6/cancel`).
- **Evidência real**:
```text
Create E3: 201 {"event":{"id":"evt_347ed2b6","organizerId":"usr_org_a","name":"Eval F05 E3 Cancel Test","startsAt":"2026-12-11T22:19:57.863Z","location":"Bar Catraca E3","capacity":5,"priceCents":5000,"status":"draft","occupiedSeats":0,"availableSeats":5}}
Publish E3: 200 {"event":{"id":"evt_347ed2b6","organizerId":"usr_org_a","name":"Eval F05 E3 Cancel Test","startsAt":"2026-12-11T22:19:57.863Z","location":"Bar Catraca E3","capacity":5,"priceCents":5000,"status":"published","occupiedSeats":0,"availableSeats":5}}
E3 in GET /api/events before cancel: true
E3 in GET /api/partner/events before cancel: true
Cancel E3: 200 {"event":{"id":"evt_347ed2b6","organizerId":"usr_org_a","name":"Eval F05 E3 Cancel Test","startsAt":"2026-12-11T22:19:57.863Z","location":"Bar Catraca E3","capacity":5,"priceCents":5000,"status":"cancelled","occupiedSeats":0,"availableSeats":0},"refundedCount":0,"cancelledCount":0}
E3 in GET /api/events after cancel: false
E3 in GET /api/partner/events after cancel: false
Partner purchase E3 after cancel: 404 {"error":"event_not_available"}
Web purchase E3 after cancel: 404 {"error":"event_not_available","message":"Evento não disponível para compra"}
Edit E3 after cancel: 409 {"error":"event_cancelled","message":"Evento cancelado não pode ser editado"}
Republish E3 after cancel: 409 {"error":"event_cancelled","message":"Evento cancelado não pode ser republicado"}
Re-cancel E3 after cancel: 409 {"error":"event_cannot_be_cancelled","message":"Apenas eventos publicados podem ser cancelados"}
```

---

### `IT-F05-02` — Estorno de confirmados, cancelamento de pendentes e proteção contra gateway tardio (`R11`, `CF-07`)

- **Veredito**: **APROVADO**
- **Ação executada**:
  1. Como Organizador A, criado e publicado evento `E3b` (`evt_56f7881f`, lotação 5, R$ 50,00).
  2. Realizadas compras na API de parceiros (e também na vitrine web para validação integral de `CF-07` em ambos os canais):
     - `$T5` (`tkt_ed6e40da6e`): API parceiro, cartão lento `4000000000000003` (30–40s) em `2026-11-26T22:19:58.135Z`.
     - `$T6` (`tkt_5060ea031c`): API parceiro, cartão rápido `4000000000000001` (2–5s).
     - `webFast` (`tkt_8fc7623adb`): vitrine (Participante), cartão rápido `4000000000000001`.
     - `webSlow0004` (`tkt_0d7a5bcc1f`): vitrine (Participante), cartão lento `4000000000000004` (30–40s).
  3. Aguardado `$T6` (e `webFast`) transitar para `confirmed` (em `+3.19s`), confirmado que `$T5` (e `webSlow0004`) ainda estavam `pending`, e cancelado `E3b` em `+3.21s` (< 30s da compra de `$T5`).
  4. Consultados todos os ingressos imediatamente após o cancelamento (`+53ms` <= 10s).
  5. Aguardada a passagem real de > 45s desde a compra de `$T5` (`+57.18s`, em `2026-11-26T22:20:55.317Z`, após a janela de 30–40s do gateway simulado padrão) e reconsultados `GET /api/partner/tickets/:ticketId`, `GET /api/me/tickets` e `GET /api/organizer/events/evt_56f7881f`.
- **Evidência real**:
```text
Created & published E3b: evt_56f7881f
T5 purchase (2026-11-26T22:19:58.135Z): 202 {"ticketId":"tkt_ed6e40da6e","code":"UGHCL2F5","status":"pending"}
T6 purchase: 202 {"ticketId":"tkt_5060ea031c","code":"GZ6JS9YC","status":"pending"}
Web fast purchase: 202 {"ticket":{"ticketId":"tkt_8fc7623adb","code":"CN65EQ6Q","status":"pending"}}
Web slow 0004 purchase: 202 {"ticket":{"ticketId":"tkt_0d7a5bcc1f","code":"UYSRTHCK","status":"pending"}}
[+1.11s] Poll: T6=pending, webFast=pending
[+2.14s] Poll: T6=pending, webFast=pending
[+3.19s] Poll: T6=confirmed, webFast=confirmed
Right before cancel -> T5: {"ticketId":"tkt_ed6e40da6e","code":"UGHCL2F5","eventId":"evt_56f7881f","status":"pending","checkedIn":false} webSlow0004: {"ticketId":"tkt_0d7a5bcc1f","code":"UYSRTHCK","eventId":"evt_56f7881f","status":"pending","checkedIn":false}
Cancel E3b at +3.21s from T5 purchase: 200 {"event":{"id":"evt_56f7881f","organizerId":"usr_org_a","name":"Eval F05 E3b Gateway Reconciliation","startsAt":"2026-12-12T22:19:58.102Z","location":"Bar Catraca E3b","capacity":5,"priceCents":5000,"status":"cancelled","occupiedSeats":0,"availableSeats":0},"refundedCount":2,"cancelledCount":2}
After cancel (+53ms <= 10000ms):
  T6 (was confirmed): 200 {"ticketId":"tkt_5060ea031c","code":"GZ6JS9YC","eventId":"evt_56f7881f","status":"refunded","checkedIn":false}
  T5 (was pending 0003): 200 {"ticketId":"tkt_ed6e40da6e","code":"UGHCL2F5","eventId":"evt_56f7881f","status":"cancelled","checkedIn":false}
  webFast (was confirmed): 200 {"ticketId":"tkt_8fc7623adb","code":"CN65EQ6Q","eventId":"evt_56f7881f","status":"refunded","checkedIn":false}
  webSlow0004 (was pending 0004): 200 {"ticketId":"tkt_0d7a5bcc1f","code":"UYSRTHCK","eventId":"evt_56f7881f","status":"cancelled","checkedIn":false}
```

Reconsulta real após > 45 segundos da compra de `$T5`:
```text
Now: 2026-11-26T22:20:55.317Z Elapsed from T5 purchase: 57.18s
T5 (0003) 200 {"ticketId":"tkt_ed6e40da6e","code":"UGHCL2F5","eventId":"evt_56f7881f","status":"cancelled","checkedIn":false}
T6 (0001) 200 {"ticketId":"tkt_5060ea031c","code":"GZ6JS9YC","eventId":"evt_56f7881f","status":"refunded","checkedIn":false}
webFast (0001) 200 {"ticketId":"tkt_8fc7623adb","code":"CN65EQ6Q","eventId":"evt_56f7881f","status":"refunded","checkedIn":false}
webSlow0004 (0004) 200 {"ticketId":"tkt_0d7a5bcc1f","code":"UYSRTHCK","eventId":"evt_56f7881f","status":"cancelled","checkedIn":false}
My tickets for evt_56f7881f: [{"ticketId":"tkt_0d7a5bcc1f","code":"UYSRTHCK","eventId":"evt_56f7881f","eventName":"Eval F05 E3b Gateway Reconciliation","eventStartsAt":"2026-12-12T22:19:58.102Z","eventLocation":"Bar Catraca E3b","status":"cancelled","checkedIn":false,"priceCents":5000,"createdAt":"2026-11-26T22:19:58.196Z"},{"ticketId":"tkt_8fc7623adb","code":"CN65EQ6Q","eventId":"evt_56f7881f","eventName":"Eval F05 E3b Gateway Reconciliation","eventStartsAt":"2026-12-12T22:19:58.102Z","eventLocation":"Bar Catraca E3b","status":"refunded","checkedIn":false,"priceCents":5000,"createdAt":"2026-11-26T22:19:58.177Z"}]
OrgA detail evt_56f7881f: {"event":{"id":"evt_56f7881f","organizerId":"usr_org_a","name":"Eval F05 E3b Gateway Reconciliation","startsAt":"2026-12-12T22:19:58.102Z","location":"Bar Catraca E3b","capacity":5,"priceCents":5000,"status":"cancelled","occupiedSeats":0,"availableSeats":0}}
```

---

### `IT-F05-03` — Isolamento por organizador no cancelamento (`R13`)

- **Veredito**: **APROVADO**
- **Ação executada**:
  1. Como Organizador A, criado e publicado evento `evt_924750f5`.
  2. Tentativa de cancelamento via `POST /api/organizer/events/evt_924750f5/cancel` autenticada como Organizador B (`org.b@catraca.local`).
  3. Tentativa de cancelamento autenticada como Participante (`participante@catraca.local`).
  4. Tentativa de cancelamento sem autenticação (Visitante).
  5. Reconsulta do evento como Organizador A para confirmar permanência em `published`.
- **Evidência real**:
```text
Created and published OrgA event: evt_924750f5
Cancel by OrgB: 404 {"error":"event_not_found","message":"Evento não encontrado"}
Cancel by Participant: 403 {"error":"forbidden"}
Cancel by Visitor (no auth): 401 {"error":"unauthorized"}
OrgA event status after unauthorized cancel attempts: 200 {"id":"evt_924750f5","status":"published","availableSeats":10}
```

---

### `IT-F05-04` — UI desabilita edição em evento cancelado (`R04`, `R11`, `CF-06`)

- **Veredito**: **APROVADO**
- **Ação executada**:
  1. Inspeção de `frontend/src/pages/EventManagePage.tsx` e `frontend/src/components/CancelEventSection.tsx`.
  2. Verificação HTTP do frontend servido em `http://localhost:3000/` e inspeção do bundle servido `/assets/index-DKYOMn8e.js`.
  3. Verificação do typecheck e build do frontend durante `npm run gates` (`tsc --noEmit` + `vite build`).
- **Evidência real**:
  - `frontend/src/pages/EventManagePage.tsx`:
    - Importa `CancelEventSection` (linha 3) e renderiza `<CancelEventSection eventId={event.id} eventStatus={event.status} onCancelled={loadEvent} />` (linhas 169–173).
    - Define `STATUS_LABEL.cancelled = 'Evento cancelado'` (linha 10), exibido no badge de status (linhas 150–152).
    - Define `const isCancelled = event.status === 'cancelled'` (linha 131) e oculta integralmente o formulário `Editar evento` via `{!isCancelled && (...)}` (linhas 175–252), além de restringir o botão `Publicar evento` apenas a `event.status === 'draft'` (linhas 156–160).
  - `frontend/src/components/CancelEventSection.tsx`:
    - Quando `eventStatus === 'cancelled'` (linhas 23–29), exibe `<div className="alert alert-error" role="alert">Evento cancelado — este evento não pode mais ser editado, republicado ou vendido.</div>`.
    - Quando `eventStatus === 'published'`, exige confirmação explícita (`Confirmar cancelamento irreversível`) e chama `POST /api/organizer/events/${eventId}/cancel`.
  - Verificação do bundle em runtime (`http://localhost:3000/` -> `200 OK`, `/assets/index-DKYOMn8e.js`):
```text
{
  len: 284550,
  HasEventoCancelado: true,
  HasIrreversivelMsg: true,
  HasCancelEndpoint: true,
  HasEditHeading: true
}
```
  - Typecheck + build em `npm run gates`: `tsc --noEmit` e `vite build` concluídos sem erros (`52 modules transformed`, built in `4.26s`).

---

### `IT-F05-05` — Gates automatizados passando

- **Veredito**: **APROVADO**
- **Comando executado**:
```powershell
Set-Location "e:\mba\mba-brief-produto-agente\.worktrees\f05-cancelamento"; npm run gates
```
- **Evidência real**:
```text
Command exited with code 0.

==> [1/3] Backend typecheck
> catraca-backend@1.0.0 typecheck
> tsc --noEmit

==> [2/3] Frontend typecheck and build
> catraca-frontend@1.0.0 typecheck
> tsc --noEmit

> catraca-frontend@1.0.0 build
> vite build
✓ 52 modules transformed.
✓ built in 4.26s

==> [3/3] Backend automated tests
> catraca-backend@1.0.0 test
> vitest run

 RUN  v3.2.7 /app/backend

 ✓ tests/f05-cancellation.test.ts (4 tests) 4686ms
   ✓ F05 - Cancelamento Irreversível de Eventos e Reconciliação com Gateway (R11) > R02, R05, R11, CF-06: cancelar evento publicado remove da vitrine e API, zera vagas e bloqueia compras, edição e republicação  925ms
   ✓ F05 - Cancelamento Irreversível de Eventos e Reconciliação com Gateway (R11) > R11, CF-07: ingressos confirmados (vitrine + API) viram refunded, pendentes (0003/0004) viram cancelled e callback tardio do gateway não altera status final  1816ms
   ✓ F05 - Cancelamento Irreversível de Eventos e Reconciliação com Gateway (R11) > R13: isolamento por organizador e RBAC no cancelamento (Org B -> 404, Participante -> 403, Visitante -> 401)  983ms
   ✓ F05 - Cancelamento Irreversível de Eventos e Reconciliação com Gateway (R11) > R11: evento em rascunho ou já cancelado não pode ser cancelado (409)  710ms
 ✓ tests/f03-purchases.test.ts (6 tests) 5991ms
 ✓ tests/f02-events.test.ts (4 tests) 3385ms
 ✓ tests/f01-auth.test.ts (5 tests) 4625ms

 Test Files  4 passed (4)
      Tests  19 passed (19)
   Duration  22.35s
```

---

## Conclusão

Todos os 5 itens verificáveis do contrato de **F05** (`IT-F05-01` a `IT-F05-05`), cobrindo `AC-F05-1`..`AC-F05-4`, `CF-06`, `CF-07` e as regras `R02`, `R04`, `R05`, `R06`, `R08`, `R11` e `R13`, foram executados de forma independente contra o commit `c55607f5ddad37cd5f61f0cc3ddf86ce8442966f` e **aprovados sem ressalvas**.
