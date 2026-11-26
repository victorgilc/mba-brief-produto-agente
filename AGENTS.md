# AGENTS.md — Catraca

Porta de entrada oficial para agentes de implementação e agentes avaliadores neste repositório.

## Visão geral

**Catraca** é um MVP de venda de ingressos para eventos pequenos construído com SDD (Spec-Driven Development), entrega em waves (incluindo wave paralela via PRs) e avaliação independente por contrato.

- **Stack**: TypeScript full-stack — Backend Fastify + PostgreSQL (`pg`) + Frontend React/Vite (servido pelo próprio Fastify), orquestrado com Docker Compose.
- **Endereços padrão**:
  - Produto (`$WEB`): `http://localhost:3000`
  - API de parceiros (`$API`): `http://localhost:3000`
- **Gateway padrão**: simulado (sem chaves externas), obedecendo aos finais de cartão `0001`..`0004` e demais finais.

## Comandos do Harness Mínimo

Todos os comandos são executados a partir da raiz do repositório usando apenas Node.js LTS + Docker (sem necessidade de `npm install` prévio na máquina host):

| Ação | Comando | O que faz |
| :--- | :--- | :--- |
| **Subir tudo** | `npm run up` | Constrói e sobe PostgreSQL + aplicação via Docker Compose, executa migrations e carrega a seed idempotente até `/health` responder 200. |
| **Derrubar tudo** | `npm run down` | Encerra e remove todos os containers e redes iniciados pelo projeto (`docker compose down --remove-orphans`). |
| **Rodar gates** | `npm run gates` | Executa checagem de tipos (backend + frontend), build do frontend e suíte de testes automatizados (unitários, integração e concorrência) em banco isolado `catraca_test` dentro de Docker. |

## Regras do Projeto

1. **Nunca commitar arquivos fora do repositório de produto** (o arquivo local de brief não deve ser versionado — mantido no `.gitignore`).
2. **Spec-Driven Development**: toda implementação segue `docs/prd.md` e a respectiva pasta `docs/features/<ID>/` (`spec.md`, `plan.md`, `contract.md`).
3. **Avaliação independente obrigatória**: quem implementou uma feature **não** pode avaliá-la. A avaliação é conduzida por um agente com contexto limpo e separado, exercitando todos os itens do `contract.md` da feature e gravando um novo arquivo em `docs/features/<ID>/reports/eval-XX.md`.
4. **Imutabilidade de relatórios**: um arquivo de relatório **nunca** é alterado após o commit que o criou. Se houver reprovação, o implementador corrige em novo commit e um novo agente avaliador cria `eval-02.md`, `eval-03.md`, etc.
5. **Estado do projeto sincronizado**: `docs/state.json` registra o status atual de cada feature e o caminho do relatório mais recente.
6. **R07 (Concorrência)**: toda reserva de vaga usa transação PostgreSQL com `SELECT ... FOR UPDATE` na linha do evento; nunca confiar em checagem de disponibilidade fora de transação.
7. **R11 (Cancelamento irreversível)**: transições tardias do gateway nunca sobrescrevem ingressos `cancelled`/`refunded` nem atuam sobre eventos `cancelled`.
8. **API de parceiros (contrato fixo)**: cabeçalho obrigatório `X-Api-Key`; sem chave ou chave inválida retorna `401 {"error":"unauthorized"}`. Em compras, erros seguem rigorosamente a ordem: `422 invalid_request` -> `404 event_not_available` -> `409 sold_out`.

## Mapa dos Artefatos

- **PRD**: [docs/prd.md](docs/prd.md)
- **Estado do projeto**: [docs/state.json](docs/state.json)
- **README**: [README.md](README.md)
- **Features (spec, plan, contract, reports)**:
  - `F01`: `docs/features/F01-fundacao-auth-rbac/`
  - `F02`: `docs/features/F02-eventos-vitrine/`
  - `F03`: `docs/features/F03-compras-gateway-ingressos/`
  - `F04`: `docs/features/F04-checkin/`
  - `F05`: `docs/features/F05-cancelamento-estorno/`
  - `F06`: `docs/features/F06-painel-metricas/`
- **Código**:
  - `backend/`: API Fastify, acesso ao PostgreSQL, migrations, seed, gateway simulado e testes Vitest.
  - `frontend/`: SPA React + Vite + TypeScript.
  - `scripts/`: scripts cross-platform do harness (`up.mjs`, `down.mjs`, `gates.mjs`).
  - `docker-compose.yml` e `Dockerfile`: empacotamento e orquestração.

## Guia para Agentes Avaliadores

Ao avaliar uma feature `<ID>`:
1. Leia apenas `AGENTS.md`, `docs/prd.md`, `docs/features/<ID>/contract.md` e o código necessário para executar as verificações.
2. Obtenha o hash do commit sob avaliação (`git rev-parse HEAD`).
3. Execute os pré-requisitos e **cada item verificável** do `contract.md` de forma real (comandos, chamadas HTTP, testes automatizados e/ou inspeção de saída).
4. Grave um novo relatório em `docs/features/<ID>/reports/eval-XX.md` contendo: data/hora ISO, commit avaliado, ferramenta e modelo utilizados, tabela resumo e veredito (`APROVADO` ou `REPROVADO`) por item com evidência real.
5. Nunca modifique relatórios anteriores.
