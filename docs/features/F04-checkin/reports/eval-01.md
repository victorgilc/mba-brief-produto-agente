# Relatório de Avaliação — F04: Check-in de Ingressos na Página de Gestão

- **Data/Hora**: `2026-11-26T19:15:28-03:00`
- **Commit avaliado**: `49b67848ac6fcc67af70e23d22d6345e5e4f12b9` (`49b6784`)
- **Branch avaliada**: `feat/f04-checkin`
- **Worktree**: `e:\mba\mba-brief-produto-agente\.worktrees\f04-checkin`
- **Ferramenta**: Antigravity
- **Modelo**: Gemini 4 Neon (High)
- **Veredito Geral**: **APROVADO**

## Pré-requisitos Verificados

- Containers ativos do worktree:
  - `catraca-app` (`f04-checkin-app`, `healthy`, porta `0.0.0.0:3000->3000/tcp`)
  - `catraca-db` (`postgres:16-alpine`, `healthy`)
- Healthcheck (`curl.exe -s -i http://localhost:3000/health`):
  ```http
  HTTP/1.1 200 OK
  content-type: application/json; charset=utf-8

  {"status":"ok"}
  ```
- Credenciais da seed autenticadas com HTTP `200`: `org.a@catraca.local`, `org.b@catraca.local`, `participante@catraca.local`; chave de parceiro `X-Api-Key: catraca-partner-key-2026` operacional.

## Tabela Resumo

| Item | Critérios PRD | Regras | Veredito |
| :--- | :--- | :--- | :--- |
| `IT-F04-01` | `AC-F04-1`, `AC-F04-2`, `CF-05` | `R04`, `R09`, `R10` | **APROVADO** |
| `IT-F04-02` | `AC-F04-3`, `CF-04` | `R10`, `R13` | **APROVADO** |
| `IT-F04-03` | `AC-F04-1`, `CF-04` | `R04`, `R10`, `R13` | **APROVADO** |
| `IT-F04-04` | `CF-05` (e regressão F01–F04) | `R01`–`R10`, `R13` | **APROVADO** |

---

## Evidências Detalhadas por Item

### IT-F04-01 — Ordem completa de precedência de R10 (vitrine e API) (`R04`, `R10`, `CF-05`)

- **Veredito**: **APROVADO**
- **Ações executadas**:
  1. Via chamadas HTTP reais em `http://localhost:3000`, autenticado como Organizador A (`org.a@catraca.local`), foi criado (`201`) e publicado (`200`) o evento `E1 = evt_bb816c35` (`QA F04 Evento E1`).
  2. Foram gerados ingressos em `E1`:
     - Vitrine (`POST /api/events/evt_bb816c35/purchases`, cartão `...0001`): `T1 = tkt_00fac4bb41`, código `WBXZFXYN` -> liquidado como `confirmed`, `checkedIn: false`.
     - API de Parceiros (`POST /api/partner/events/evt_bb816c35/purchases`, cartão `...0001`): `T1P = tkt_0e16dadc4a`, código `4VKKPK9K` -> liquidado como `confirmed`, `checkedIn: false`.
     - API de Parceiros (`POST /api/partner/events/evt_bb816c35/purchases`, cartão `...0002`): `T2 = tkt_9b953b4107`, código `35WBDG96` -> liquidado como `declined`, `checkedIn: false`.
     - API de Parceiros (`POST /api/partner/events/evt_bb816c35/purchases`, cartão lento `...0003`): `T_PEND = tkt_c61c46e09a`, código `JYWF29XZ` -> testado imediatamente enquanto `status: "pending"`.
  3. Exercitadas todas as condições de `POST /api/organizer/events/evt_bb816c35/checkin` e consultas `GET /api/partner/tickets/:ticketId`.
  4. Validada precedência com `events.status = 'cancelled'` via inspeção de `backend/src/services/checkin.ts` (linhas 73–124, ordem estrita dentro de transação `FOR UPDATE`: `invalid_ticket` -> `event_cancelled` -> `ticket_not_confirmed` -> `already_checked_in` -> `checked_in`) e execução real do teste de integração em `backend/tests/f04-checkin.test.ts` durante `npm run gates`.

- **Evidência real (HTTP/JSON em `http://localhost:3000`)**:
  - **Check-in de `C1` (vitrine, confirmado, enviado com espaços e minúsculas `"  wbxzfxyn  "`)**:
    - HTTP `200`: `{"ok":true,"reason":"checked_in","message":"Entrada liberada"}`
  - **Consulta `GET /api/partner/tickets/tkt_00fac4bb41` após check-in**:
    - HTTP `200`: `{"ticketId":"tkt_00fac4bb41","code":"WBXZFXYN","eventId":"evt_bb816c35","status":"confirmed","checkedIn":true}` (`checkedIn: true` sem alterar `status`)
  - **Segunda tentativa com `C1` (`WBXZFXYN`)**:
    - HTTP `200`: `{"ok":false,"reason":"already_checked_in","message":"Ingresso já utilizado"}`
  - **Check-in de `C1P` (API de parceiros, confirmado, `4VKKPK9K`)**:
    - 1ª tentativa — HTTP `200`: `{"ok":true,"reason":"checked_in","message":"Entrada liberada"}`
    - `GET /api/partner/tickets/tkt_0e16dadc4a` — HTTP `200`: `{"ticketId":"tkt_0e16dadc4a","code":"4VKKPK9K","eventId":"evt_bb816c35","status":"confirmed","checkedIn":true}`
    - 2ª tentativa — HTTP `200`: `{"ok":false,"reason":"already_checked_in","message":"Ingresso já utilizado"}`
  - **Check-in de `C_PEND` (`JYWF29XZ`, `status: "pending"`)**:
    - HTTP `200`: `{"ok":false,"reason":"ticket_not_confirmed","message":"Ingresso não confirmado"}`
  - **Check-in de `C2` (`35WBDG96`, `status: "declined"`)**:
    - HTTP `200`: `{"ok":false,"reason":"ticket_not_confirmed","message":"Ingresso não confirmado"}`
  - **Check-in de código inexistente (`ZZZZZZZZ`)**:
    - HTTP `200`: `{"ok":false,"reason":"invalid_ticket","message":"Ingresso inválido para este evento"}`
  - **Check-in com código em branco (`"   "`)**:
    - HTTP `422`: `{"error":"invalid_request","message":"Código do ingresso é obrigatório"}`
  - **Precedência em evento `status = 'cancelled'` (Vitest em `npm run gates`)**:
    - `✓ F04 - Check-in de Ingressos na Página de Gestão (R10, R13) > R10 precedência estrita em evento cancelado: regra 1 (inválido) > regra 2 (Evento cancelado) > regras 3 e 4 (941ms)` — comprova que `ZZZZZZZZ` retorna `"Ingresso inválido para este evento"` (regra 1 > regra 2), enquanto ingressos pertencentes ao evento (mesmo `declined` ou `refunded` com `checked_in = true`) retornam `"Evento cancelado"` (regra 2 > regras 3 e 4).

---

### IT-F04-02 — Código de outro evento e isolamento entre organizadores (`R10`, `R13`, `CF-04`)

- **Veredito**: **APROVADO**
- **Ações executadas**:
  1. Como Organizador B (`org.b@catraca.local`), criado (`201`) e publicado (`200`) o evento `E2 = evt_5c421314` (`QA F04 Evento E2`).
  2. Comprado ingresso confirmado `T3 = tkt_d0b51a77d2` (`C3 = YTJ9GS48`) em `E2` pela API de parceiros (cartão `...0001`).
  3. Comprado ingresso confirmado ainda não utilizado `T_FRESH = tkt_8c8ba0d4e1` (`C_FRESH = LWYC9DJW`) em `E1` para comprovar ausência de efeito colateral nas tentativas sem permissão.
  4. Executadas tentativas cruzadas e sem permissão contra `POST /api/organizer/events/evt_bb816c35/checkin`.

- **Evidência real (HTTP/JSON em `http://localhost:3000`)**:
  - **Organizador A tentando check-in de `C3` (do evento `E2` de Org B) no evento `E1`**:
    - HTTP `200`: `{"ok":false,"reason":"invalid_ticket","message":"Ingresso inválido para este evento"}`
    - `GET /api/partner/tickets/tkt_d0b51a77d2`: `{"ticketId":"tkt_d0b51a77d2","code":"YTJ9GS48","eventId":"evt_5c421314","status":"confirmed","checkedIn":false}` (intacto)
  - **Organizador B tentando chamar `POST /api/organizer/events/evt_bb816c35/checkin` com `C_FRESH`**:
    - HTTP `404`: `{"error":"event_not_found","message":"Evento não encontrado"}`
  - **Participante tentando chamar `POST /api/organizer/events/evt_bb816c35/checkin` com `C_FRESH`**:
    - HTTP `403`: `{"error":"forbidden"}`
  - **Visitante (sem cookie de sessão) tentando chamar `POST /api/organizer/events/evt_bb816c35/checkin` com `C_FRESH`**:
    - HTTP `401`: `{"error":"unauthorized"}`
  - **Verificação pós-tentativas (`GET /api/partner/tickets/tkt_8c8ba0d4e1`)**:
    - HTTP `200`: `{"ticketId":"tkt_8c8ba0d4e1","code":"LWYC9DJW","eventId":"evt_bb816c35","status":"confirmed","checkedIn":false}` (nenhum check-in indevido realizado).

---

### IT-F04-03 — Integração UI na página de gestão `/organizador/eventos/:eventId` (`R04`, `CF-04`)

- **Veredito**: **APROVADO**
- **Ações executadas**:
  1. Inspeção de código-fonte:
     - `frontend/src/App.tsx` (linhas 37–44): rota `/organizador/eventos/:eventId` protegida por `<ProtectedRoute role="organizer">` renderizando `<EventManagePage />`.
     - `frontend/src/pages/EventManagePage.tsx` (linhas 3, 48–50, 168–172): importa e renderiza `<CheckinSection eventId={event.id} eventStatus={event.status} onCheckedIn={loadEvent} />` fora do bloco `{!isCancelled && ...}` (disponível também para eventos cancelados) e preserva o estado montado do componente ao recarregar os dados do evento.
     - `frontend/src/components/CheckinSection.tsx` (linhas 21–112): envia `POST /api/organizer/events/${eventId}/checkin` com `{ code: trimmed }` e renderiza literalmente `{result.message}` em `<div role="status" aria-live="polite">`.
  2. Inspeção da aplicação servida ao vivo em `http://localhost:3000`:
     - `GET http://localhost:3000/organizador/eventos/evt_bb816c35` e `GET http://localhost:3000/assets/index-dE37DCJd.js`.
  3. Compilação verificada via `tsc --noEmit` + `vite build` dentro de `npm run gates`.

- **Evidência real**:
  ```json
  {
    "pageStatus": 200,
    "contentType": "text/html; charset=utf-8",
    "hasRootDiv": true,
    "bundleChecks": {
      "assetPath": "/assets/index-dE37DCJd.js",
      "assetStatus": 200,
      "assetBytes": 284490,
      "hasCheckinHeading": true,
      "hasCodeLabel": true,
      "hasSubmitButton": true,
      "hasCheckinEndpoint": true,
      "hasCancelledAlert": true,
      "hasAlertLiveRegion": true
    }
  }
  ```

---

### IT-F04-04 — Gates automatizados passando

- **Veredito**: **APROVADO**
- **Comando executado**:
  ```powershell
  Set-Location "e:\mba\mba-brief-produto-agente\.worktrees\f04-checkin"; npm run gates
  ```
- **Evidência real**:
  - **Exit code**: `0`
  - `[1/3] Backend typecheck`: `tsc --noEmit` concluído sem erros.
  - `[2/3] Frontend typecheck and build`: `tsc --noEmit` e `vite build` concluídos sem erros (`✓ 52 modules transformed`, `✓ built in 4.15s`).
  - `[3/3] Backend automated tests` (`vitest run`):
    ```text
     ✓ tests/f04-checkin.test.ts (5 tests) 5398ms
     ✓ tests/f03-purchases.test.ts (6 tests) 5917ms
     ✓ tests/f02-events.test.ts (4 tests) 3292ms
     ✓ tests/f01-auth.test.ts (5 tests) 4728ms

     Test Files  4 passed (4)
          Tests  20 passed (20)
       Duration  22.98s
    ```
  - Inclui ainda teste de concorrência em `f04-checkin.test.ts` comprovando que duas submissões simultâneas do mesmo código liberam entrada exatamente uma vez (`['already_checked_in', 'checked_in']`).
