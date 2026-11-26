# Relatório de Avaliação Independente — F01 (eval-01)

- **Feature**: `F01-fundacao-auth-rbac` — Fundação, Autenticação, RBAC e Chave de Parceiro
- **Data/Hora**: `2026-11-26T18:47:18-03:00`
- **Commit avaliado**: `453954ff454878d3283d94a7fce1cceb4309f28e` (`453954f`)
- **Branch avaliada**: `feat/f01-fundacao-auth-rbac`
- **Ferramenta**: Antigravity
- **Modelo**: Gemini 4 Neon (High)
- **Contrato de referência**: `docs/features/F01-fundacao-auth-rbac/contract.md`
- **Veredito Geral**: **APROVADO**

---

## Tabela Resumo

| Item | Critérios PRD | Regras | Veredito |
| :--- | :--- | :--- | :--- |
| `IT-F01-01` — Subida limpa, seed idempotente e ciclo down/up | `AC-F01-1` | Harness/Seed | **APROVADO** |
| `IT-F01-02` — Cadastro, login e logout de participante (sem autocadastro de organizador) | `AC-F01-2` | Perfis | **APROVADO** |
| `IT-F01-03` — RBAC na área de organizador (R13) | `AC-F01-3` | R13 | **APROVADO** |
| `IT-F01-04` — Validação de `X-Api-Key` na API de parceiros | `AC-F01-4` | API Parceiros | **APROVADO** |
| `IT-F01-05` — Gates automatizados passando | `AC-F01-1` | Harness/Seed | **APROVADO** |

---

## Evidências Detalhadas por Item

### IT-F01-01 — Subida limpa, seed idempotente e ciclo down/up
- **Veredito**: **APROVADO**
- **Ações executadas e evidências reais**:
  1. **Primeiro `npm run up` e checagem de `/health`**:
     - Comando: `npm run up` -> Exit code `0`, saída final:
       ```text
       Container catraca-db Healthy
       Container catraca-app Healthy
       Catraca pronto em http://localhost:3000
       ```
     - Comando: `curl.exe -s -i http://localhost:3000/health` e `curl.exe -s -o NUL -w "HTTP_CODE=%{http_code}" http://localhost:3000/health`:
       ```text
       HTTP/1.1 200 OK
       content-type: application/json; charset=utf-8
       {"status":"ok"}
       HTTP_CODE=200
       ```
  2. **Login das três contas da seed via `POST /api/auth/login` (antes do `down`)**:
     ```text
     org.a@catraca.local -> HTTP 200 | body={"user":{"id":"usr_org_a","name":"Organizador A","email":"org.a@catraca.local","role":"organizer"}} | set-cookie=catraca_session=...; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
     org.b@catraca.local -> HTTP 200 | body={"user":{"id":"usr_org_b","name":"Organizador B","email":"org.b@catraca.local","role":"organizer"}} | set-cookie=catraca_session=...; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
     participante@catraca.local -> HTTP 200 | body={"user":{"id":"usr_part_seed","name":"Participante Seed","email":"participante@catraca.local","role":"participant"}} | set-cookie=catraca_session=...; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
     ```
  3. **Execução de `npm run down`, checagem de `docker ps` e porta `3000`**:
     - Comando: `npm run down` -> Exit code `0`, containers `catraca-app` e `catraca-db` e rede `mba-brief-produto-agente_default` encerrados e removidos.
     - Comando: `docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"` -> nenhum container listado:
       ```text
       NAMES     STATUS    PORTS
       ```
     - Comando: `curl.exe -s --max-time 3 http://localhost:3000/health` -> `curl_exit=7` (porta `3000` indisponível).
  4. **Segundo `npm run up` e validação pós-restart**:
     - Comando: `npm run up` -> Exit code `0`, saída final: `Catraca pronto em http://localhost:3000`.
     - `GET /health` -> `HTTP 200`.
     - Reautenticação das três contas da seed:
       ```text
       [IT-F01-01] POST /api/auth/login (org.a@catraca.local) -> 200 {"user":{"id":"usr_org_a","name":"Organizador A","email":"org.a@catraca.local","role":"organizer"}}
       [IT-F01-01] POST /api/auth/login (org.b@catraca.local) -> 200 {"user":{"id":"usr_org_b","name":"Organizador B","email":"org.b@catraca.local","role":"organizer"}}
       [IT-F01-01] POST /api/auth/login (participante@catraca.local) -> 200 {"user":{"id":"usr_part_seed","name":"Participante Seed","email":"participante@catraca.local","role":"participant"}}
       ```

---

### IT-F01-02 — Cadastro, login e logout de participante (sem autocadastro de organizador)
- **Veredito**: **APROVADO**
- **Ações executadas e evidências reais**:
  1. **Cadastro de participante (`POST /api/auth/register`)**:
     ```text
     [IT-F01-02.1] POST /api/auth/register -> 201 {"user":{"id":"usr_b640f1a77d8d","name":"QA Participante","email":"qa.part.1795729565227@catraca.local","role":"participant"}} | Set-Cookie: catraca_session=c8a0db6beb84e77a348b299449fdf1b47cca5149ea715b4c3b40be63d0e6ea08; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax
     ```
  2. **Consulta de sessão (`GET /api/auth/me`) e logout (`POST /api/auth/logout`)**:
     ```text
     [IT-F01-02.2a] GET /api/auth/me (with cookie) -> 200 {"user":{"id":"usr_b640f1a77d8d","name":"QA Participante","email":"qa.part.1795729565227@catraca.local","role":"participant"}}
     [IT-F01-02.2b] POST /api/auth/logout -> 204 body="" | Set-Cookie: catraca_session=; Max-Age=0; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax
     [IT-F01-02.2c] GET /api/auth/me (old cookie after logout) -> 200 {"user":null}
     [IT-F01-02.2d] GET /api/auth/me (no cookie) -> 200 {"user":null}
     ```
     Observação: a sessão também é removida no banco (mesmo reutilizando o cookie antigo após logout, `/api/auth/me` retorna `{"user":null}`).
  3. **Tentativa de elevação de privilégio enviando `role: "organizer"` no registro**:
     ```text
     [IT-F01-02.3] POST /api/auth/register (with role:"organizer") -> 201 {"user":{"id":"usr_957f62eb3a04","name":"QA Escalation","email":"qa.escalate.1795729565438@catraca.local","role":"participant"}}
     [IT-F01-02.3b] GET /api/organizer/me (escalated user) -> 403 {"error":"forbidden"}
     ```
  4. **Verificação complementar do shell web**:
     - `GET /`, `GET /cadastro`, `GET /organizador` retornam `200 text/html; charset=utf-8` com a SPA React (`id="root"`), e `frontend/src/pages/RegisterPage.tsx` expõe somente cadastro de participante (sem campo de `role`).

---

### IT-F01-03 — RBAC na área de organizador (R13)
- **Veredito**: **APROVADO**
- **Ações executadas e evidências reais**:
  1. **Visitante (sem cookie) em `GET /api/organizer/me`**:
     ```text
     [IT-F01-03.1] GET /api/organizer/me (no cookie) -> 401 {"error":"unauthorized"}
     ```
  2. **Participante autenticado em `GET /api/organizer/me`**:
     ```text
     [IT-F01-03.2] GET /api/organizer/me (participant cookie) -> 403 {"error":"forbidden"}
     ```
  3. **Organizador A autenticado em `GET /api/organizer/me`**:
     ```text
     [IT-F01-03.3] GET /api/organizer/me (org.a cookie) -> 200 {"user":{"id":"usr_org_a","name":"Organizador A","email":"org.a@catraca.local","role":"organizer"}}
     ```
  4. **Proteção de rotas web `/organizador/*`**:
     - Inspecionado `frontend/src/App.tsx` e `frontend/src/components/ProtectedRoute.tsx`: rotas `/organizador` e `/organizador/eventos/:eventId` exigem `role="organizer"`, redirecionando visitante para `/login` e bloqueando participante com tela de acesso negado.

---

### IT-F01-04 — Validação de `X-Api-Key` na API de parceiros
- **Veredito**: **APROVADO**
- **Ações executadas e evidências reais**:
  1. **Sem cabeçalho `X-Api-Key` em `GET /api/partner/ping`**:
     ```text
     [IT-F01-04.1] GET /api/partner/ping (no header) -> 401 {"error":"unauthorized"}
     ```
  2. **Cabeçalho inválido `X-Api-Key: chave-errada` em `GET /api/partner/ping`**:
     ```text
     [IT-F01-04.2] GET /api/partner/ping (wrong key) -> 401 {"error":"unauthorized"}
     ```
  3. **Cabeçalho válido `X-Api-Key: catraca-partner-key-2026` em `GET /api/partner/ping`**:
     ```text
     [IT-F01-04.3] GET /api/partner/ping (valid key) -> 200 {"ok":true}
     ```

---

### IT-F01-05 — Gates automatizados passando
- **Veredito**: **APROVADO**
- **Comando executado**: `npm run gates`
- **Código de saída**: `0`
- **Evidência real da execução**:
  ```text
  ==> [1/3] Backend typecheck
  > catraca-backend@1.0.0 typecheck
  > tsc --noEmit

  ==> [2/3] Frontend typecheck and build
  > catraca-frontend@1.0.0 typecheck
  > tsc --noEmit

  > catraca-frontend@1.0.0 build
  > vite build
  ✓ 49 modules transformed.
  dist/index.html                   0.42 kB │ gzip:   0.29 kB
  dist/assets/index-LFhT8Ob_.css    3.51 kB │ gzip:   1.23 kB
  dist/assets/index-4-LcSfBs.js   484.95 kB │ gzip: 146.12 kB
  ✓ built in 4.10s

  ==> [3/3] Backend automated tests
  > catraca-backend@1.0.0 test
  > vitest run

   ✓ tests/f01-auth.test.ts (5 tests) 4264ms
     ✓ F01 - Fundação, Autenticação, RBAC e X-Api-Key > GET /health retorna 200 ok  533ms
     ✓ F01 - Fundação, Autenticação, RBAC e X-Api-Key > seed cria 2 organizadores e 1 participante e é idempotente ao rodar novamente  1712ms
     ✓ F01 - Fundação, Autenticação, RBAC e X-Api-Key > participante cria conta, autentica e faz logout; nunca eleva para organizer  651ms
     ✓ F01 - Fundação, Autenticação, RBAC e X-Api-Key > R13: visitante recebe 401, participante recebe 403 e organizador acessa área de organizador  708ms
     ✓ F01 - Fundação, Autenticação, RBAC e X-Api-Key > API de parceiros rejeita ausência ou chave inválida com 401 unauthorized  442ms

   Test Files  1 passed (1)
        Tests  5 passed (5)
  ```
