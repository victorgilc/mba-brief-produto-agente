# Contrato de Avaliação — F02: Gestão de Eventos, Vitrine Pública e Listagem da API de Parceiros

## Pré-requisitos de Ambiente
- Stack levantado via `npm run up` com F01 e F02 aplicadas.
- Credenciais da seed (`org.a@catraca.local`, `org.b@catraca.local`, `participante@catraca.local`) e `X-Api-Key: catraca-partner-key-2026`.

## Itens Verificáveis

### IT-F02-01 — Validação de campos e rejeição de data no passado (R01)
- **Como verificar**:
  1. Como Organizador A, enviar `POST /api/organizer/events` com `startsAt` no passado (ex.: ontem) -> rejeitado (`422` ou `400`).
  2. Tentar criar com `capacity: 0` ou `priceCents: 0` -> rejeitado (`422` ou `400`).
  3. Criar evento válido com data futura, `capacity: 2`, `priceCents: 10000` -> `201`, status `draft`.
  4. Tentar editar o evento alterando `startsAt` para o passado -> rejeitado (`422` ou `400`).
- **Critério de aprovação**: Todas as entradas inválidas são rejeitadas; entrada válida cria rascunho.

### IT-F02-02 — Ciclo rascunho -> publicado na vitrine e API de parceiros (R02)
- **Como verificar**:
  1. Após criar evento em rascunho, verificar `GET /api/events` (sem login) e `GET /api/partner/events` (com `X-Api-Key`) -> evento **não** aparece em nenhum dos dois.
  2. Chamar `POST /api/organizer/events/:id/publish` -> `200`, status `published`.
  3. Reconsultar `GET /api/events` e `GET /api/partner/events` -> evento aparece em ambos; na API de parceiros contém exatamente `id`, `name`, `startsAt`, `priceCents: 10000`, `availableSeats: 2`.
- **Critério de aprovação**: Rascunho oculto; publicado visível com schema exato do contrato fixo.

### IT-F02-03 — Regras de edição de lotação e preço (R03)
- **Como verificar**:
  1. Aumentar lotação (ex.: 2 -> 4) e alterar preço (10000 -> 15000) em `PUT /api/organizer/events/:id` -> `200`, refletido em `GET /api/partner/events`.
  2. Validar via teste automatizado/serviço que tentar reduzir `capacity` abaixo de vagas ocupadas é rejeitado (`409`).
- **Critério de aprovação**: Aumento de lotação e alteração de preço aceitos; redução abaixo de vagas ocupadas rejeitada.

### IT-F02-04 — Página de gestão própria e isolamento entre organizadores e perfis (R04, R13, CF-01)
- **Como verificar**:
  1. Verificar que `/organizador/eventos/:id` responde e carrega dados do evento para Organizador A.
  2. Autenticado como Organizador B: `GET /api/organizer/events` não lista evento de A; `GET /api/organizer/events/:idDeA` retorna `404`/`403` sem nenhum campo do evento de A (nem nome, nem lotação, nem preço).
  3. Autenticado como Participante ou deslogado: `GET /api/organizer/events/:idDeA` retorna `403` ou `401` sem dados do evento.
  4. `GET /api/partner/events` sem `X-Api-Key` ou com chave inválida retorna `401 {"error":"unauthorized"}`.
- **Critério de aprovação**: Isolamento total por organizador e por perfil, além de proteção por `X-Api-Key`.

### IT-F02-05 — Gates automatizados passando
- **Como verificar**: Executar `npm run gates`.
- **Critério de aprovação**: Sai com código `0` e testes de F01 + F02 aprovados.

## Mapeamento de Critérios do PRD

| Critério no PRD | Regra(s) | Item(ns) do Contrato |
| :--- | :--- | :--- |
| `AC-F02-1` | R01 | `IT-F02-01` |
| `AC-F02-2` | R02 | `IT-F02-02` |
| `AC-F02-3` | R03 | `IT-F02-03` |
| `AC-F02-4` | R04, R13 | `IT-F02-04` |
| `CF-01` (`F01 -> F02`) | R04, R13 | `IT-F02-04`, `IT-F02-05` |
