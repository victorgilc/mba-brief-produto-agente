# Plano de Implementação — F03: Motor de Compras, Concorrência, Gateway Simulado, API de Parceiros e Meus Ingressos

## Etapas
1. Adicionar migration da tabela `tickets` (e índice por `(event_id, status)`) em `backend/src/db/migrate.ts`.
2. Atualizar cálculo de `occupiedSeats` / `availableSeats` em `backend/src/services/events.ts` para considerar `tickets` (`pending` + `confirmed`) e validar `R03` na edição de lotação.
3. Implementar `backend/src/services/gateway.ts` com as regras dos finais `0001`..`0004`/outros, suporte a `GATEWAY_DELAY_MODE` (`default` padrão e `fast` para testes), e callback transacional seguro (`event.status = 'published' AND ticket.status = 'pending'`).
4. Implementar `backend/src/services/purchases.ts` com `SELECT ... FOR UPDATE`, geração de `ticketId` e `code` único, validação de cartão (16 dígitos) e snapshot de `price_cents`.
5. Expor rotas:
   - `POST /api/partner/events/:eventId/purchases` (com ordem de erros `422` -> `404` -> `409`)
   - `GET /api/partner/tickets/:ticketId` (`200` ou `404 ticket_not_found`, ambos os canais)
   - `POST /api/events/:eventId/purchases` e `GET /api/me/tickets`
6. Atualizar `frontend/` (`StorefrontPage.tsx` com fluxo de compra + mensagem `Ingressos esgotados`, e `MyTicketsPage.tsx` com "Meus ingressos", rótulos em português e códigos).
7. Escrever testes em `backend/tests/f03-purchases.test.ts` incluindo:
   - Fluxo vitrine + API + gateway (`0001`, `0002`, `0003`, `0004`, outros)
   - Ordem de erros da API de parceiros e consulta de ingresso de ambos os canais
   - Redução de lotação abaixo de vagas ocupadas (`R03`) e snapshot de preço histórico (`R03`)
   - **Teste de concorrência (`R07`)**: 3 rodadas independentes de 30 compras simultâneas via `Promise.all` em eventos novos de lotação 5 -> exatamente 5 respostas `202` e 25 respostas `409` em todas as rodadas.
8. Rodar `npm run gates` e validar no Docker.
