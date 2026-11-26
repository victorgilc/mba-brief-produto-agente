# Plano de Implementação — F06: Painel Consolidado de Métricas e Receita do Evento

## Etapas
1. Implementar `backend/src/services/panel.ts` com agregação SQL consistente para `confirmed`, `pending`, `checkedIn`, `availableSeats`, `revenueCents` e `refunded`.
2. Expor `GET /api/organizer/events/:eventId/panel` e incluir `panel` no retorno de `GET /api/organizer/events/:eventId` (mantendo ownership `R13`).
3. Criar componente `frontend/src/components/EventPanel.tsx` com os 6 rótulos literais de `R12` e formatação BRL (`R$ 350,00` / `R$ 0,00`), integrando-o em `EventManagePage.tsx` com atualização imediata após edição, check-in e cancelamento.
4. Escrever testes automatizados em `backend/tests/f06-panel-e2e.test.ts` cobrindo:
   - Receita histórica com mudança de preço (`R$ 100` x 2 + `R$ 150` x 1 = `R$ 350,00`) somando vitrine e API (`CF-09`)
   - Incremento de `Check-ins` mantendo `Confirmados` inalterado (`CF-10`)
   - Evento cancelado com `Confirmados: 0`, `Pendentes: 0`, `Check-ins: 0`, `Vagas disponíveis: 0`, `Receita: R$ 0,00`, `Estornados: 1`, inclusive após gateway tardio (`CF-11`)
   - Isolamento por organizador `R13` (`CF-08`).
5. Validar `npm run gates` e executar verificação completa do fluxo do avaliador na `main`.
