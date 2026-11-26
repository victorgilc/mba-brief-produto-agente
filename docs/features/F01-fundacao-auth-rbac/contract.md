# Contrato de Avaliação — F01: Fundação, Autenticação, RBAC e Chave de Parceiro

## Pré-requisitos de Ambiente
- Docker daemon ativo e Node.js LTS disponível.
- Executar a partir da raiz do repositório: `npm run up` (deve concluir sem erro e responder `200` em `http://localhost:3000/health`).

## Itens Verificáveis

### IT-F01-01 — Subida limpa, seed idempotente e ciclo down/up
- **Como verificar**:
  1. Executar `npm run up` e checar `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health` -> `200`.
  2. Testar login com `org.a@catraca.local` (`OrgA1234!`), `org.b@catraca.local` (`OrgB1234!`) e `participante@catraca.local` (`Part1234!`) via `POST /api/auth/login` -> todos retornam `200` com `role` correspondente.
  3. Executar `npm run down`, verificar que `docker ps` não lista containers do projeto e que a porta `3000` não responde.
  4. Executar `npm run up` novamente -> sobe sem erro e as três contas da seed seguem autenticando com `200`.
- **Critério de aprovação**: Todas as etapas passam sem erro.

### IT-F01-02 — Cadastro, login e logout de participante (sem autocadastro de organizador)
- **Como verificar**:
  1. `POST /api/auth/register` com `{ name, email, password }` cria usuário com `role: "participant"` (`201`) e seta cookie de sessão.
  2. `GET /api/auth/me` com o cookie retorna o participante criado; `POST /api/auth/logout` limpa sessão (`204`); novo `GET /api/auth/me` retorna `user: null`.
  3. Mesmo enviando `role: "organizer"` no payload de registro, o usuário criado continua sendo `participant` (autocadastro de organizador impossível).
- **Critério de aprovação**: Fluxo completo funciona e nenhum cadastro público eleva privilégio para `organizer`.

### IT-F01-03 — RBAC na área de organizador (R13)
- **Como verificar**:
  1. Sem cookie, acessar rota `/api/organizer/*` -> retorna `401 {"error":"unauthorized"}`.
  2. Autenticado como participante, acessar `/api/organizer/*` -> retorna `403 {"error":"forbidden"}`.
  3. Autenticado como Organizador A, acessar `/api/organizer/*` -> autorizado (`200`).
- **Critério de aprovação**: Visitante recebe `401`, participante recebe `403`, organizador acessa normalmente.

### IT-F01-04 — Validação de X-Api-Key na API de parceiros
- **Como verificar**:
  1. Chamar rota `/api/partner/*` sem cabeçalho `X-Api-Key` -> `401` com corpo `{"error":"unauthorized"}`.
  2. Chamar com `X-Api-Key: chave-errada` -> `401` com corpo `{"error":"unauthorized"}`.
  3. Chamar com `X-Api-Key: catraca-partner-key-2026` -> passa pela autenticação (não retorna `401`).
- **Critério de aprovação**: Ausência ou chave incorreta sempre retorna `401 {"error":"unauthorized"}`.

### IT-F01-05 — Gates automatizados passando
- **Como verificar**: Executar `npm run gates`.
- **Critério de aprovação**: Comando finaliza com código de saída `0`, executando typecheck, build e testes automatizados.

## Mapeamento de Critérios do PRD

| Critério no PRD | Regra(s) | Item(ns) do Contrato |
| :--- | :--- | :--- |
| `AC-F01-1` | Harness/Seed | `IT-F01-01`, `IT-F01-05` |
| `AC-F01-2` | Perfis | `IT-F01-02` |
| `AC-F01-3` | R13 | `IT-F01-03` |
| `AC-F01-4` | API Parceiros | `IT-F01-04` |
