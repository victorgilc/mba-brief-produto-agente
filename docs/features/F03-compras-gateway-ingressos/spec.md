# Spec — F03: Motor de Compras, Concorrência, Gateway Simulado, API de Parceiros e Meus Ingressos

## 1. Objetivo
Implementar o domínio de ingressos (`tickets`), o motor transacional de compras com garantia estrita de lotação sob concorrência (`R07`), o gateway de pagamento simulado assíncrono (`R08`), as rotas fixas da API de parceiros (`POST /api/partner/events/:eventId/purchases` e `GET /api/partner/tickets/:ticketId`), a compra pela vitrine e a tela "Meus ingressos" (`R09`).

## 2. Decisões Técnicas
- **Schema (`tickets`)**:
  - `id TEXT PRIMARY KEY` (formato `tkt_<10hex>`)
  - `code TEXT UNIQUE NOT NULL` (8 caracteres alfanuméricos maiúsculos sem ambiguidade, ex.: `K7Q2M9XA`)
  - `event_id TEXT NOT NULL REFERENCES events(id)`
  - `user_id TEXT REFERENCES users(id)` (`NULL` para compras da API de parceiros; preenchido para compras da vitrine)
  - `buyer_email TEXT NOT NULL`
  - `channel TEXT NOT NULL CHECK (channel IN ('web', 'partner'))`
  - `price_cents INTEGER NOT NULL` (snapshot imutável do `events.price_cents` no momento da compra — `R03`, `R12`)
  - `status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled', 'refunded'))`
  - `checked_in BOOLEAN NOT NULL DEFAULT FALSE`
  - `checked_in_at TIMESTAMPTZ`
  - `card_last4 TEXT NOT NULL`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - Índice `idx_tickets_event_status ON tickets (event_id, status)` para contagem rápida.
- **Garantia de Concorrência (`R07`)**:
  - Toda compra executa uma transação PostgreSQL explícita:
    1. `BEGIN`
    2. `SELECT id, status, capacity, price_cents FROM events WHERE id = $1 FOR UPDATE` — trava exclusiva a linha do evento, serializando compras simultâneas para o mesmo evento sem bloquear eventos distintos.
    3. Se ausente ou `status !== 'published'` -> `ROLLBACK`, retorna erro `event_not_available` (`404`).
    4. `SELECT COUNT(*)::int AS occupied FROM tickets WHERE event_id = $1 AND status IN ('pending', 'confirmed')`.
    5. Se `occupied >= capacity` -> `ROLLBACK`, retorna erro `sold_out` (`409`).
    6. `INSERT INTO tickets (...) VALUES (..., event.price_cents, 'pending', FALSE, ...)`
    7. `COMMIT`
  - Pool `pg` configurado com `max: 50` conexões para atender 30+ requisições simultâneas sem timeouts.
- **Gateway Simulado Assíncrono (`R06`, `R08`, preparado para `R11`)**:
  - Validação prévia obrigatória: `cardNumber` deve casar exatamente `/^\d{16}$/`; fora disso rejeita ANTES de abrir transação ou criar ingresso (`422 {"error":"invalid_request"}`).
  - Após `COMMIT`, agenda resolução assíncrona (`setTimeout`) e responde imediatamente (`202` na API / `202` na vitrine):
    - Modo padrão (`GATEWAY_DELAY_MODE=default`):
      - Final `0001`: `confirmed`, atraso aleatório entre `2000` e `3500` ms (dentro de 2–5s).
      - Final `0002`: `declined`, atraso entre `2000` e `3500` ms (dentro de 2–5s).
      - Final `0003`: `confirmed`, atraso entre `31000` e `37000` ms (dentro de 30–40s).
      - Final `0004`: `declined`, atraso entre `31000` e `37000` ms (dentro de 30–40s).
      - Qualquer outro final: `declined`, atraso entre `2000` e `3500` ms (dentro de 2–5s).
    - Modo rápido opcional apenas para testes (`GATEWAY_DELAY_MODE=fast`): 50ms para finais rápidos e 400ms para finais lentos (`0003`/`0004`).
  - Na resolução assíncrona: abre transação com `SELECT status FROM events WHERE id = $eventId FOR UPDATE` e executa `UPDATE tickets SET status = $outcome, updated_at = NOW() WHERE id = $ticketId AND status = 'pending'` **somente se** `event.status === 'published'`. Isso garante que cancelamento posterior (`F05`) jamais seja sobrescrito.
- **Ordem de Erros na API de Parceiros (Contrato Fixo)**:
  - `POST /api/partner/events/:eventId/purchases`:
    1. `X-Api-Key` ausente/inválida -> `401 {"error":"unauthorized"}`
    2. Corpo inválido (JSON inválido, campo faltando, e-mail inválido, cartão != 16 dígitos) -> `422 {"error":"invalid_request"}`
    3. Evento inexistente, `draft` ou `cancelled` -> `404 {"error":"event_not_available"}`
    4. Sem vaga disponível -> `409 {"error":"sold_out"}`
    5. Sucesso -> `202 { "ticketId": "...", "code": "...", "status": "pending" }`
  - `GET /api/partner/tickets/:ticketId`:
    1. `X-Api-Key` ausente/inválida -> `401 {"error":"unauthorized"}`
    2. Ingresso inexistente -> `404 {"error":"ticket_not_found"}`
    3. Sucesso (vitrine OU API) -> `200 { "ticketId": "...", "code": "...", "eventId": "...", "status": "...", "checkedIn": false }`
- **Rotas da Vitrine e Meus Ingressos**:
  - `POST /api/events/:eventId/purchases` (`requireParticipant`): recebe `{ cardNumber }`, executa o mesmo motor transacional com `userId = req.user.id`, `buyerEmail = req.user.email`, `channel = 'web'`, retorna `202`.
  - `GET /api/me/tickets` (`requireParticipant`): lista ingressos do participante ordenados por `created_at DESC` com `ticketId`, `code`, `status`, `checkedIn`, `priceCents`, `eventName`, `eventStartsAt`, `eventLocation`.
- **Integração com F02**:
  - `getOccupiedSeats` e `GET /api/events` / `GET /api/partner/events` passam a contar ingressos `pending` + `confirmed` da tabela `tickets`.
  - Edição de lotação em `F02` passa a bloquear redução abaixo do número real de vagas ocupadas (`R03`).
- **Frontend**:
  - Na Vitrine (`/`): cada evento publicado mostra `availableSeats`; quando `availableSeats === 0` (ou em erro `sold_out`), exibe literalmente `Ingressos esgotados`. Para participante logado, formulário acessível para informar cartão (16 dígitos, `type="text" inputmode="numeric"`) e comprar; após compra redireciona ou oferece link direto para `/meus-ingressos`.
  - Em `/meus-ingressos` ("Meus ingressos"): exibe evento, rótulo de status em português (`pendente`, `confirmado`, `recusado`, `cancelado`, `estornado`) e código único de cada ingresso (`R09`).

## 3. Dependências
- **Consumes**: `F01` (sessão de participante, `requirePartnerApiKey`), `F02` (tabela `events`, vitrine, `GET /api/partner/events`, edição de eventos).
- **Provides**: Tabela `tickets`, motor concorrente de compras, gateway simulado, rotas de compra/consulta da API de parceiros e página "Meus ingressos".
