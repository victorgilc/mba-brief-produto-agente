# Spec — F04: Check-in de Ingressos na Página de Gestão

## 1. Objetivo
Permitir que o organizador valide ingressos por código na página de gestão do evento (`/organizador/eventos/:eventId`), aplicando rigorosamente a ordem de precedência definida em `R10`, marcando `checked_in = true` sem alterar o status do ingresso e respeitando o isolamento entre organizadores (`R13`).

## 2. Decisões Técnicas
- **Endpoint Backend**:
  - `POST /api/organizer/events/:eventId/checkin` (`requireOrganizer`)
  - Body: `{ "code": "K7Q2M9XA" }` (normalizado com `.trim().toUpperCase()`).
  - Verifica ownership: `SELECT id, organizer_id, status FROM events WHERE id = $1 FOR UPDATE`. Se não existir ou `organizer_id !== req.user.id`, retorna `404 {"error":"event_not_found"}`.
  - Consulta o ingresso: `SELECT id, event_id, status, checked_in FROM tickets WHERE UPPER(code) = $1 FOR UPDATE`.
  - Avalia condições na **ordem estrita de R10**:
    1. `!ticket || ticket.event_id !== event.id` -> `200 { "ok": false, "reason": "invalid_ticket", "message": "Ingresso inválido para este evento" }`
    2. `event.status === 'cancelled'` -> `200 { "ok": false, "reason": "event_cancelled", "message": "Evento cancelado" }`
    3. `ticket.status !== 'confirmed'` -> `200 { "ok": false, "reason": "ticket_not_confirmed", "message": "Ingresso não confirmado" }`
    4. `ticket.checked_in === true` -> `200 { "ok": false, "reason": "already_checked_in", "message": "Ingresso já utilizado" }`
    5. Caso contrário: `UPDATE tickets SET checked_in = TRUE, checked_in_at = NOW(), updated_at = NOW() WHERE id = $1` -> `200 { "ok": true, "reason": "checked_in", "message": "Entrada liberada" }`
  - Transação garante atomicidade mesmo se o organizador enviar o mesmo código duas vezes rapidamente.
- **Compatibilidade com API de Parceiros**:
  - Como `GET /api/partner/tickets/:ticketId` já lê `tickets.checked_in`, após um check-in bem-sucedido o campo `checkedIn` passa imediatamente a `true`, enquanto `status` continua `confirmed`.
- **Frontend**:
  - Componente `CheckinSection.tsx` embutido na página de gestão `/organizador/eventos/:eventId` (`EventManagePage.tsx`).
  - Formulário acessível com `<label htmlFor="checkin-code">Código do ingresso</label>`, input com `autocorrect="off"`, `autocapitalize="characters"`, `spellcheck="false"`, botão `<button type="submit">Validar check-in</button>`.
  - Exibe o resultado exato retornado pelo servidor em região `role="status" aria-live="polite"` (sempre a mensagem literal de `R10`).
  - Em evento cancelado, o campo continua funcional obedecendo a ordem exata de `R10` (ou seja, ingresso do próprio evento cancelado retorna `Evento cancelado`, e código inexistente retorna `Ingresso inválido para este evento`), além de exibir o aviso visual de evento cancelado.

## 3. Dependências
- **Consumes**: `F02` (página de gestão `/organizador/eventos/:eventId`, eventos e ownership `R13`), `F03` (tabela `tickets`, códigos únicos, status e campo `checked_in`).
- **Provides**: Serviço e endpoint de check-in (`R10`), atualização de `checked_in`, componente `CheckinSection` integrado à gestão.
