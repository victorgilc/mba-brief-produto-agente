# Contrato de Avaliação — F03: Motor de Compras, Concorrência, Gateway Simulado, API de Parceiros e Meus Ingressos

## Pré-requisitos de Ambiente
- Stack levantado via `npm run up` no modo padrão do gateway (`GATEWAY_DELAY_MODE=default`).
- Organizador A, participante e `X-Api-Key: catraca-partner-key-2026`.

## Itens Verificáveis

### IT-F03-01 — Compra na vitrine, gateway 0001 e "Meus ingressos" (R06, R08, R09, CF-02)
- **Como verificar**:
  1. Como Organizador A, criar e publicar evento com lotação 2 e preço `R$ 100,00`.
  2. Como Participante autenticado, realizar compra com cartão `4000000000000001`.
  3. Imediatamente após a compra, `GET /api/me/tickets` (e tela "Meus ingressos") mostra o ingresso com status `pending` (`pendente`), nome do evento e código único; `availableSeats` cai de `2` para `1`.
  4. Em até 5 segundos, o ingresso passa para `confirmed` (`confirmado`).
  5. Consultar o `ticketId` via `GET /api/partner/tickets/:ticketId` -> `200` com `status: "confirmed"`, `checkedIn: false` e o mesmo `code`.
- **Critério de aprovação**: Compra nasce `pending` sem bloquear, confirma em <= 5s, aparece em "Meus ingressos" e é consultável pela API de parceiros.

### IT-F03-02 — Ocupação de vaga pendente, recusa com cartão lento 0004 e esgotamento (R05, R06, R07, R08, CF-03)
- **Como verificar**:
  1. Com 1 vaga restante no evento acima, comprar via `POST /api/partner/events/:id/purchases` com cartão `4000000000000004` -> `202` com `status: "pending"`.
  2. `GET /api/partner/events` imediatamente mostra `availableSeats: 0`.
  3. Antes de 30s, nova compra pela API retorna `409 {"error":"sold_out"}` e a vitrine exibe `Ingressos esgotados`.
  4. Passados 45s (ou após o período 30–40s), `GET /api/partner/tickets/:ticketId` retorna `status: "declined"` e `GET /api/partner/events` volta a mostrar `availableSeats: 1`.
- **Critério de aprovação**: Vaga ocupada enquanto `pending`, `sold_out` / `Ingressos esgotados` enquanto lotado, e vaga liberada após `declined`.

### IT-F03-03 — Concorrência sob carga: 30 compras simultâneas em lotação 5 (R07)
- **Como verificar**:
  1. Criar e publicar dois eventos novos (`E_conc1` e `E_conc2`), cada um com lotação 5.
  2. Para cada evento, disparar 30 requisições simultâneas `POST /api/partner/events/:id/purchases` com cartão `4000000000000001`.
  3. Contar códigos HTTP retornados em cada rodada.
- **Critério de aprovação**: Em ambas as rodadas, exatamente 5 respostas `202` e 25 respostas `409`, com `availableSeats: 0` ao final.

### IT-F03-04 — Contrato fixo e ordem de erros da API de parceiros (CF-02, CF-03)
- **Como verificar**:
  1. Sem `X-Api-Key` ou com chave errada nas rotas de compra e consulta -> `401 {"error":"unauthorized"}`.
  2. Compra com `cardNumber: "123"` (ou e-mail inválido, ou campo ausente) mesmo em evento inexistente -> `422 {"error":"invalid_request"}` (nenhum ingresso criado).
  3. Compra com corpo válido em evento inexistente ou em rascunho -> `404 {"error":"event_not_available"}`.
  4. Consulta `GET /api/partner/tickets/tkt_nao_existe` -> `404 {"error":"ticket_not_found"}`.
- **Critério de aprovação**: Todos os status HTTP e corpos JSON batem exatamente com o contrato fixo e sua precedência.

### IT-F03-05 — Integração com edição de lotação e snapshot de preço (R03, CF-03)
- **Como verificar**:
  1. Em evento com 2 ingressos ocupados (`confirmed`/`pending`), tentar reduzir lotação para `1` em `PUT /api/organizer/events/:id` -> rejeitado (`409`).
  2. Alterar preço de `R$ 100,00` para `R$ 150,00` e lotação para `3` -> `200`; comprar um terceiro ingresso e verificar que os dois primeiros preservam `priceCents: 10000` e o terceiro grava `priceCents: 15000`.
- **Critério de aprovação**: Lotação protegida contra redução abaixo da ocupação e preço preservado por ingresso.

### IT-F03-06 — Gates automatizados passando
- **Como verificar**: Executar `npm run gates`.
- **Critério de aprovação**: Código de saída `0` com todos os testes (incluindo concorrência) passando.

## Mapeamento de Critérios do PRD

| Critério no PRD | Regra(s) | Item(ns) do Contrato |
| :--- | :--- | :--- |
| `AC-F03-1` | R05, R06, R08 | `IT-F03-01`, `IT-F03-02` |
| `AC-F03-2` | R07 | `IT-F03-02`, `IT-F03-03` |
| `AC-F03-3` | R09 | `IT-F03-01` |
| `AC-F03-4` | API Parceiros | `IT-F03-01`, `IT-F03-04` |
| `CF-02` (`F01 -> F03`) | R06, R09, R13 | `IT-F03-01`, `IT-F03-04` |
| `CF-03` (`F02 -> F03`) | R02, R03, R05, R07 | `IT-F03-02`, `IT-F03-04`, `IT-F03-05`, `IT-F03-06` |
