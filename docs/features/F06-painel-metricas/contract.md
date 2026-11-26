# Contrato de Avaliação — F06: Painel Consolidado de Métricas e Receita do Evento

## Pré-requisitos de Ambiente
- Stack levantado via `npm run up` com F01–F06 aplicadas na `main`.
- Organizador A, Organizador B, Participante e `X-Api-Key: catraca-partner-key-2026`.

## Itens Verificáveis

### IT-F06-01 — Painel soma vitrine + API e calcula receita com preço histórico (R03, R12, CF-08, CF-09)
- **Como verificar**:
  1. Como Organizador A, criar e publicar evento E1 (lotação 2, `R$ 100,00`).
  2. Comprar 1 ingresso pela vitrine (cartão `0001`, confirmado) e 1 pela API (cartão `0001`, confirmado).
  3. Editar E1 alterando preço para `R$ 150,00` e lotação para `3`; comprar 1 ingresso pela API (cartão `0001`, confirmado).
  4. Consultar `GET /api/organizer/events/:E1/panel`: deve retornar `confirmed: 3`, `pending: 0`, `checkedIn: 0`, `availableSeats: 0`, `revenueCents: 35000` (`R$ 350,00`) e `refunded: 0`.
- **Critério de aprovação**: Todos os 6 números conferem exatamente, usando o preço vigente de cada compra.

### IT-F06-02 — Check-in atualiza painel preservando Confirmados (R12, CF-10)
- **Como verificar**:
  1. No evento E1 acima, fazer check-in de 1 ingresso confirmado (`C1`).
  2. Consultar `GET /api/organizer/events/:E1/panel`: deve retornar `confirmed: 3` e `checkedIn: 1` (demais números inalterados).
- **Critério de aprovação**: `Check-ins` passa a `1` e `Confirmados` permanece `3`.

### IT-F06-03 — Painel após cancelamento e resposta tardia do gateway (R05, R11, R12, CF-11)
- **Como verificar**:
  1. Criar e publicar evento E3 (lotação 5, `R$ 50,00`), comprar 1 ingresso com cartão `0003` (`$T5`) e 1 com `0001` (`$T6`).
  2. Esperar `$T6` confirmar e, antes de 30s, cancelar E3.
  3. Após cancelamento (e novamente passados 45s da compra de `$T5`), consultar `GET /api/organizer/events/:E3/panel`: deve retornar `confirmed: 0`, `pending: 0`, `checkedIn: 0`, `availableSeats: 0`, `revenueCents: 0` (`R$ 0,00`) e `refunded: 1`.
- **Critério de aprovação**: Estorno nunca é somado como receita; `Vagas disponíveis` = `0`; `Estornados` = `1`.

### IT-F06-04 — Isolamento do painel por organizador e perfis (R13, CF-08)
- **Como verificar**:
  1. Como Organizador B, consultar `GET /api/organizer/events/:E1/panel` -> `404`/`403` sem nenhum dado do evento de A.
  2. Como Participante ou visitante -> `403`/`401`.
- **Critério de aprovação**: Nenhum dado do painel vaza para outro organizador, participante ou visitante.

### IT-F06-05 — UI do painel na página de gestão e gates automatizados (R04, R12)
- **Como verificar**:
  1. Verificar que `EventPanel.tsx` exibe os rótulos `Confirmados`, `Pendentes`, `Check-ins`, `Vagas disponíveis`, `Receita` e `Estornados` na página `/organizador/eventos/:eventId`.
  2. Executar `npm run gates`.
- **Critério de aprovação**: UI apresenta os 6 rótulos literais e `npm run gates` encerra com código `0`.

## Mapeamento de Critérios do PRD

| Critério no PRD | Regra(s) | Item(ns) do Contrato |
| :--- | :--- | :--- |
| `AC-F06-1` | R04, R12 | `IT-F06-01`, `IT-F06-05` |
| `AC-F06-2` | R03, R12 | `IT-F06-01`, `IT-F06-03` |
| `AC-F06-3` | R05, R12, R13 | `IT-F06-03`, `IT-F06-04` |
| `CF-08` (`F02 -> F06`) | R03, R04, R12, R13 | `IT-F06-01`, `IT-F06-04` |
| `CF-09` (`F03 -> F06`) | R03, R05, R12 | `IT-F06-01` |
| `CF-10` (`F04 -> F06`) | R10, R12 | `IT-F06-02` |
| `CF-11` (`F05 -> F06`) | R05, R11, R12 | `IT-F06-03`, `IT-F06-05` |
