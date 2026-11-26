# Plano de Implementação — F04: Check-in de Ingressos na Página de Gestão

## Etapas
1. Implementar `backend/src/services/checkin.ts` com a lógica transacional na ordem exata de `R10` (`SELECT ... FOR UPDATE` em evento e ingresso).
2. Registrar `POST /api/organizer/events/:eventId/checkin` em `backend/src/routes/checkin.ts` e montá-la em `backend/src/app.ts`.
3. Criar componente `frontend/src/components/CheckinSection.tsx` e integrá-lo em `frontend/src/pages/EventManagePage.tsx`.
4. Escrever testes automatizados em `backend/tests/f04-checkin.test.ts` cobrindo todas as 5 situações de `R10`, código de outro evento/outro organizador, isolamento `R13`, reflexo de `checkedIn: true` em `GET /api/partner/tickets/:ticketId`, e ambos os canais (vitrine e API).
5. Validar `npm run gates` e testar na UI/API.
