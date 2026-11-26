# Contrato de Avaliação — F04: Check-in de Ingressos na Página de Gestão

## Pré-requisitos de Ambiente
- Stack levantado via `npm run up` com F01, F02, F03 e F04 aplicadas.
- Organizador A, Organizador B, Participante e `X-Api-Key: catraca-partner-key-2026`.

## Itens Verificáveis

### IT-F04-01 — Ordem completa de precedência de R10 (vitrine e API) (R04, R10, CF-05)
- **Como verificar**:
  1. No evento E1 de Organizador A, gerar um ingresso confirmado pela vitrine (`C1`) e um ingresso recusado pela API (`C2`, cartão `0002` ou `0004`).
  2. Enviar `POST /api/organizer/events/:E1/checkin` com `C1` -> retorna `"Entrada liberada"`.
  3. Verificar `GET /api/partner/tickets/:T1` -> `status: "confirmed"`, `checkedIn: true`.
  4. Enviar `C1` novamente -> retorna `"Ingresso já utilizado"`.
  5. Enviar `C2` (não confirmado) -> retorna `"Ingresso não confirmado"`.
  6. Enviar `ZZZZZZZZ` (inexistente) -> retorna `"Ingresso inválido para este evento"`.
  7. Verificar também via teste/cenário com evento `status = 'cancelled'` que um ingresso pertencente ao evento retorna `"Evento cancelado"` (antes de checar status do ingresso ou reuso).
- **Critério de aprovação**: Todas as 5 mensagens exatas de R10 aparecem na precedência correta e `checkedIn` é atualizado sem alterar `status`.

### IT-F04-02 — Código de outro evento e isolamento entre organizadores (R10, R13, CF-04)
- **Como verificar**:
  1. Como Organizador B, criar e publicar evento E2 e comprar ingresso confirmado (`C3`).
  2. Como Organizador A, tentar fazer check-in de `C3` no evento E1 -> retorna `"Ingresso inválido para este evento"`.
  3. Como Organizador B, tentar chamar `POST /api/organizer/events/:E1/checkin` -> retorna `404`/`403` sem realizar check-in.
  4. Como Participante ou visitante, tentar chamar `POST /api/organizer/events/:E1/checkin` -> retorna `403`/`401`.
- **Critério de aprovação**: Códigos não cruzam eventos e nenhum usuário sem permissão opera check-in.

### IT-F04-03 — Integração UI na página de gestão `/organizador/eventos/:eventId` (R04, CF-04)
- **Como verificar**: Verificar que o build do frontend inclui `CheckinSection` integrado em `EventManagePage.tsx` e que o formulário renderiza na página de gestão do evento exibindo a mensagem literal recebida da API.
- **Critério de aprovação**: Página compila e apresenta seção de check-in funcional.

### IT-F04-04 — Gates automatizados passando
- **Como verificar**: Executar `npm run gates`.
- **Critério de aprovação**: Sai com código `0` com testes de F01–F04 aprovados.

## Mapeamento de Critérios do PRD

| Critério no PRD | Regra(s) | Item(ns) do Contrato |
| :--- | :--- | :--- |
| `AC-F04-1` | R04, R10 | `IT-F04-01`, `IT-F04-03` |
| `AC-F04-2` | R10 | `IT-F04-01` |
| `AC-F04-3` | R13 | `IT-F04-02` |
| `CF-04` (`F02 -> F04`) | R04, R10, R13 | `IT-F04-02`, `IT-F04-03` |
| `CF-05` (`F03 -> F04`) | R09, R10 | `IT-F04-01`, `IT-F04-04` |
