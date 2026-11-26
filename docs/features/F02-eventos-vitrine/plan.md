# Plano de Implementação — F02: Gestão de Eventos, Vitrine Pública e Listagem da API de Parceiros

## Etapas
1. Adicionar migration da tabela `events` em `backend/src/db/migrate.ts`.
2. Criar `backend/src/services/events.ts` com validações de `R01`, `R02`, `R03`, cálculo de `availableSeats` (`R05`) e checagem estrita de ownership (`R13`).
3. Criar rotas `backend/src/routes/events.ts` (vitrine `GET /api/events` e gestão `/api/organizer/events*`) e `backend/src/routes/partner.ts` (`GET /api/partner/events` usando `requirePartnerApiKey`).
4. Implementar frontend:
   - `StorefrontPage.tsx` (`/`): listagem de eventos publicados com formatação BRL e data.
   - `OrganizerDashboardPage.tsx` (`/organizador`): lista de eventos próprios e formulário acessível de criação de evento.
   - `EventManagePage.tsx` (`/organizador/eventos/:eventId`): página de gestão com edição, publicação, proteção contra vazamento de dados de outro organizador e containers para extensão pelas Waves 4 e 5.
5. Escrever testes automatizados em `backend/tests/f02-events.test.ts` cobrindo `R01`, `R02`, `R03`, `R04`, `R13` e `CF-01`.
6. Rodar `npm run gates` e validar em ambiente Docker.
