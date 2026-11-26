# Contrato de Avaliação — F05: Cancelamento Irreversível de Eventos e Reconciliação com Gateway

## Pré-requisitos de Ambiente
- Stack levantado via `npm run up` com F01, F02, F03 e F05 aplicadas (no modo padrão do gateway).
- Organizador A, Organizador B e `X-Api-Key: catraca-partner-key-2026`.

## Itens Verificáveis

### IT-F05-01 — Irreversibilidade, remoção de canais e bloqueio de compras/edição (R02, R05, R11, CF-06)
- **Como verificar**:
  1. Como Organizador A, criar e publicar evento E3 (lotação 5, R$ 50,00).
  2. Cancelar E3 via `POST /api/organizer/events/:E3/cancel` -> `200`, `status: "cancelled"`, `availableSeats: 0`.
  3. Verificar `GET /api/events` e `GET /api/partner/events` -> E3 não aparece em nenhum dos dois.
  4. Tentar comprar E3 via `POST /api/partner/events/:E3/purchases` -> `404 {"error":"event_not_available"}`.
  5. Tentar editar (`PUT /api/organizer/events/:E3`) e republicar (`POST /api/organizer/events/:E3/publish`) -> ambos rejeitados (`409`).
- **Critério de aprovação**: Evento cancelado sai imediatamente de todos os canais e não pode ser vendido, editado nem republicado.

### IT-F05-02 — Estorno de confirmados, cancelamento de pendentes e proteção contra gateway tardio (R11, CF-07)
- **Como verificar**:
  1. Como Organizador A, criar e publicar evento E3b (lotação 5, R$ 50,00).
  2. Comprar via API com cartão `4000000000000003` (`$T5`, lento 30–40s) e logo em seguida com cartão `4000000000000001` (`$T6`, rápido 2–5s).
  3. Aguardar `$T6` ficar `confirmed` e, antes de 30 segundos da compra de `$T5`, cancelar E3b.
  4. Em até 10 segundos após cancelar, consultar `GET /api/partner/tickets/$T6` -> `status: "refunded"` e `GET /api/partner/tickets/$T5` -> `status: "cancelled"`.
  5. Passados 45 segundos da compra de `$T5`, reconsultar `GET /api/partner/tickets/$T5` -> continua `status: "cancelled"` (não virou `confirmed`).
- **Critério de aprovação**: `$T6` estornado e `$T5` cancelado em <= 10s, e resposta tardia do gateway não sobrescreve `$T5`.

### IT-F05-03 — Isolamento por organizador no cancelamento (R13)
- **Como verificar**:
  1. Como Organizador B, tentar chamar `POST /api/organizer/events/:idDeA/cancel` -> rejeitado (`404`/`403`) e evento de A permanece `published`.
  2. Como Participante ou visitante, tentar cancelar -> `403`/`401`.
- **Critério de aprovação**: Somente o organizador dono consegue cancelar o evento.

### IT-F05-04 — UI desabilita edição em evento cancelado (R04, R11, CF-06)
- **Como verificar**: Verificar que `EventManagePage.tsx` integra `CancelEventSection` e impede edição quando `event.status === 'cancelled'`, exibindo `Evento cancelado`.
- **Critério de aprovação**: Build frontend compila limpo e comportamento refletido no código/UI.

### IT-F05-05 — Gates automatizados passando
- **Como verificar**: Executar `npm run gates`.
- **Critério de aprovação**: Sai com código `0` com todos os testes passando.

## Mapeamento de Critérios do PRD

| Critério no PRD | Regra(s) | Item(ns) do Contrato |
| :--- | :--- | :--- |
| `AC-F05-1` | R02, R05, R11 | `IT-F05-01`, `IT-F05-04` |
| `AC-F05-2` | R11 | `IT-F05-02` |
| `AC-F05-3` | R11 | `IT-F05-02` |
| `AC-F05-4` | R13 | `IT-F05-03` |
| `CF-06` (`F02 -> F05`) | R02, R04, R05, R11 | `IT-F05-01`, `IT-F05-04` |
| `CF-07` (`F03 -> F05`) | R06, R08, R11 | `IT-F05-02`, `IT-F05-05` |
