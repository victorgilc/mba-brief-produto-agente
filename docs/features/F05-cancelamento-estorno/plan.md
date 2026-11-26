# Plano de Implementação — F05: Cancelamento Irreversível de Eventos e Reconciliação com Gateway

## Etapas
1. Implementar `backend/src/services/cancellation.ts` com transação atômica (`SELECT ... FOR UPDATE` no evento + atualização de `events.status = 'cancelled'` + `confirmed -> refunded` + `pending -> cancelled`).
2. Registrar `POST /api/organizer/events/:eventId/cancel` em `backend/src/routes/cancellation.ts` e montá-la em `backend/src/app.ts`.
3. Verificar/reforçar bloqueios em `events.ts` (edição e publicação em evento `cancelled` retornam `409`) e em `gateway.ts` (callback tardio ignora eventos `cancelled` ou ingressos não `pending`).
4. Criar componente `frontend/src/components/CancelEventSection.tsx` e integrá-lo em `frontend/src/pages/EventManagePage.tsx`, ocultando edição quando `status === 'cancelled'`.
5. Escrever testes automatizados em `backend/tests/f05-cancellation.test.ts` cobrindo:
   - Cancelamento de evento publicado com ingressos `confirmed` (vitrine + API) e `pending` (cartão lento `0003` e `0004`)
   - Transição imediata (`<= 10s`) para `refunded` e `cancelled`
   - Persistência de `cancelled` mesmo após o callback tardio do gateway disparar
   - Remoção da vitrine e `GET /api/partner/events`, erro `404 event_not_available` em nova compra, bloqueio de edição/republicação e isolamento `R13`.
6. Validar `npm run gates` e testar fluxo real com cartão lento `0003`.
