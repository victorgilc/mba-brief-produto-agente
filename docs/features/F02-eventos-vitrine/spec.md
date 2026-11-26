# Spec — F02: Gestão de Eventos, Vitrine Pública e Listagem da API de Parceiros

## 1. Objetivo
Implementar o ciclo de vida inicial de eventos (criação em rascunho, validação de regras `R01`–`R04`, edição segura com regra de lotação/preço, publicação), a área de gestão com URL própria (`/organizador/eventos/:eventId`) isolada por organizador (`R13`), a vitrine pública e a rota fixa `GET /api/partner/events`.

## 2. Decisões Técnicas
- **Schema (`events`)**:
  - `id TEXT PRIMARY KEY` (formato `evt_<8hex>`)
  - `organizer_id TEXT NOT NULL REFERENCES users(id)`
  - `name TEXT NOT NULL`
  - `starts_at TIMESTAMPTZ NOT NULL`
  - `location TEXT NOT NULL`
  - `capacity INTEGER NOT NULL CHECK (capacity >= 1)`
  - `price_cents INTEGER NOT NULL CHECK (price_cents > 0)`
  - `status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled'))`
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Cálculo de vagas (`R05`)**:
  - Função utilitária `getOccupiedSeats(client, eventId)`: quando a tabela `tickets` existe (a partir de F03) conta `status IN ('pending', 'confirmed')`; antes da criação de ingressos retorna `0`. (F02 já cria a estrutura compatível ou consulta `tickets` se criada na migration compartilhada; para máxima clareza entre waves, F02 define o helper de ocupação que consulta `tickets` após F03 ou retorna `0` se tabela ainda não existir — melhor: a tabela `tickets` só é criada em F03, e F02 expõe `eventService` com consulta extensível para `occupiedSeats`.)
  - Em evento `cancelled`, `availableSeats = 0`; caso contrário `Math.max(0, capacity - occupiedSeats)`.
- **Validações (`R01`, `R03`)**:
  - `name`: string não vazia (trim >= 1).
  - `location`: string não vazia (trim >= 1).
  - `startsAt`: data ISO válida estritamente maior que `Date.now()` tanto na criação quanto na edição.
  - `capacity`: inteiro `>= 1`; na edição, verificado dentro de transação `SELECT ... FOR UPDATE`: se `capacity < occupiedSeats`, retorna `409 {"error":"capacity_below_occupied"}`.
  - `priceCents`: inteiro `> 0` (na UI informado em reais e convertido para centavos).
  - Se `event.status === 'cancelled'`, edição e publicação são rejeitadas com `409 {"error":"event_cancelled"}`.
- **Rotas Backend**:
  - `GET /api/events` (pública): lista eventos com `status = 'published'` ordenados por `starts_at ASC`, incluindo `availableSeats`.
  - `GET /api/partner/events` (protegida por `requirePartnerApiKey`): retorna array JSON no contrato fixo:
    `[{ id, name, startsAt, priceCents, availableSeats }]` contendo apenas `status = 'published'`.
  - `GET /api/organizer/events` (`requireOrganizer`): lista apenas eventos onde `organizer_id = req.user.id`.
  - `POST /api/organizer/events` (`requireOrganizer`): cria evento com `status = 'draft'`, retorna `201`.
  - `GET /api/organizer/events/:eventId` (`requireOrganizer`): retorna evento somente se `organizer_id = req.user.id`; caso contrário `404 {"error":"event_not_found"}` (nunca vaza dados de outro organizador).
  - `PUT /api/organizer/events/:eventId` (`requireOrganizer`): edita evento do organizador validando `R01` e `R03`.
  - `POST /api/organizer/events/:eventId/publish` (`requireOrganizer`): muda `draft` -> `published`.
- **Frontend**:
  - `/` (Vitrine): lista eventos publicados com nome, data/hora, local, preço formatado (`R$ XX,XX`) e vagas disponíveis.
  - `/organizador`: lista eventos do organizador logado (status, link para página de gestão) + formulário de criação de novo evento.
  - `/organizador/eventos/:eventId`: página de gestão com URL própria (`R04`) contendo cabeçalho de status, botão "Publicar evento" (se rascunho), formulário de edição (`R01`, `R03`) e áreas estruturadas para Check-in (F04), Cancelamento (F05) e Painel (F06). Se API retornar 403/404, exibe mensagem genérica de acesso negado/não encontrado sem nenhum dado do evento.

## 3. Dependências
- **Consumes**: `F01` (banco, auth, `requireOrganizer`, `requirePartnerApiKey`, shell web).
- **Provides**: Tabela/serviço `events`, endpoints do organizador, vitrine pública, página de gestão `/organizador/eventos/:eventId` e `GET /api/partner/events`.
