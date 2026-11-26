# Spec — F05: Cancelamento Irreversível de Eventos e Reconciliação com Gateway

## 1. Objetivo
Permitir que o organizador cancele irreversivelmente um evento publicado (`R11`), removendo-o da vitrine e da API de parceiros (`R02`), zerando vagas disponíveis (`R05`), bloqueando edição/republicação/novas compras, convertendo em até 10 segundos todos os ingressos `confirmed` para `refunded` e `pending` para `cancelled`, e garantindo que respostas tardias do gateway não alterem nenhum ingresso após o cancelamento.

## 2. Decisões Técnicas
- **Endpoint Backend**:
  - `POST /api/organizer/events/:eventId/cancel` (`requireOrganizer`)
  - Executa transação PostgreSQL atômica:
    1. `BEGIN`
    2. `SELECT id, organizer_id, status FROM events WHERE id = $1 FOR UPDATE` — trava a linha do evento, serializando com compras concorrentes e com callbacks do gateway!
    3. Se ausente ou `organizer_id !== req.user.id` -> `ROLLBACK`, `404 {"error":"event_not_found"}`.
    4. Se `status !== 'published'` -> `ROLLBACK`, `409 {"error":"event_cannot_be_cancelled"}` (rascunho não está publicado; já cancelado é irreversível).
    5. `UPDATE events SET status = 'cancelled', updated_at = NOW() WHERE id = $1`
    6. `UPDATE tickets SET status = 'refunded', updated_at = NOW() WHERE event_id = $1 AND status = 'confirmed'`
    7. `UPDATE tickets SET status = 'cancelled', updated_at = NOW() WHERE event_id = $1 AND status = 'pending'`
    8. `COMMIT`
  - Retorna `200` com o evento atualizado (`status: "cancelled"`, `availableSeats: 0`) e contagens `{ refundedCount, cancelledCount }`.
- **Blindagem contra Resposta Tardia do Gateway (`R11`)**:
  - O callback assíncrono do gateway em `backend/src/services/gateway.ts` adquire `SELECT status FROM events WHERE id = $1 FOR UPDATE` e só executa `UPDATE tickets SET status = $outcome WHERE id = $ticketId AND status = 'pending'` quando `event.status === 'published'`.
  - Adicionalmente, `cancelEvent` registra/sinaliza cancelamento e qualquer timer pendente que dispare 30–40s depois encontra `event.status === 'cancelled'` e `ticket.status === 'cancelled'`, tornando-se estritamente no-op.
- **Irreversibilidade em F02 e F03**:
  - `PUT /api/organizer/events/:eventId` rejeita eventos `cancelled` com `409 {"error":"event_cancelled"}`.
  - `POST /api/organizer/events/:eventId/publish` rejeita eventos `cancelled` com `409 {"error":"event_cancelled"}`.
  - `GET /api/events` e `GET /api/partner/events` filtram `WHERE status = 'published'`, excluindo cancelados imediatamente.
  - `POST /api/partner/events/:eventId/purchases` e `POST /api/events/:eventId/purchases` retornam `404 {"error":"event_not_available"}`.
  - Em `R05`, `availableSeats` de evento cancelado é sempre `0`.
- **Frontend**:
  - Componente `CancelEventSection.tsx` integrado em `EventManagePage.tsx` (`/organizador/eventos/:eventId`).
  - Quando `event.status === 'published'`, exibe ação "Cancelar evento" com confirmação explícita (alertando que a ação é irreversível).
  - Quando `event.status === 'cancelled'`, oculta/desabilita completamente o formulário de edição e o botão de publicar, exibindo banner claro `Evento cancelado`.

## 3. Dependências
- **Consumes**: `F02` (eventos, edição/publicação, vitrine, `GET /api/partner/events`, página de gestão), `F03` (ingressos, compras e gateway assíncrono).
- **Provides**: Serviço e endpoint de cancelamento irreversível (`R11`), transição em lote `confirmed -> refunded` e `pending -> cancelled`, bloqueio de edição/republicação/venda e seção de cancelamento na gestão.
