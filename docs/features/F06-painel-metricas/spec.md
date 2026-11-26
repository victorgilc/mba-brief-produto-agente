# Spec — F06: Painel Consolidado de Métricas e Receita do Evento

## 1. Objetivo
Fornecer o painel consolidado de métricas na página de gestão do evento (`/organizador/eventos/:eventId`), somando vendas da vitrine e da API de parceiros conforme `R12`, preservando receita histórica por compra (`R03`), contabilizando check-ins (`F04`), refletindo cancelamentos e estornos corretamente (`F05`, sem nunca somar estorno como receita) e respeitando o isolamento `R13`.

## 2. Decisões Técnicas
- **Consulta SQL Consolidada (`backend/src/services/panel.ts`)**:
  - Verifica ownership do evento (`SELECT id, organizer_id, capacity, status FROM events WHERE id = $1`). Se ausente ou de outro organizador, retorna `404 {"error":"event_not_found"}`.
  - Agrega sobre todos os ingressos do evento (ambos os canais `web` e `partner`):
    ```sql
    SELECT
      COUNT(*) FILTER (WHERE status = 'confirmed')::int AS confirmed_count,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
      COUNT(*) FILTER (WHERE status = 'confirmed' AND checked_in = TRUE)::int AS checked_in_count,
      COALESCE(SUM(price_cents) FILTER (WHERE status = 'confirmed'), 0)::int AS revenue_cents,
      COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded_count
    FROM tickets
    WHERE event_id = $1
    ```
  - `availableSeats`: `event.status === 'cancelled' ? 0 : Math.max(0, event.capacity - (confirmedCount + pendingCount))` (`R05`).
- **Endpoint Backend**:
  - `GET /api/organizer/events/:eventId/panel` (`requireOrganizer`, com ownership `R13`) retorna:
    ```json
    {
      "eventId": "evt_...",
      "confirmed": 3,
      "pending": 0,
      "checkedIn": 1,
      "availableSeats": 0,
      "revenueCents": 35000,
      "refunded": 0
    }
    ```
  - Adicionalmente, `GET /api/organizer/events/:eventId` inclui `panel` no payload para carregamento único da página de gestão (e `EventManagePage.tsx` recarrega os dados após editar, publicar, cancelar ou fazer check-in).
- **Frontend (`EventPanel.tsx`)**:
  - Renderizado na página de gestão `/organizador/eventos/:eventId` com os 6 indicadores e rótulos exatos de `R12`:
    - `Confirmados`
    - `Pendentes`
    - `Check-ins`
    - `Vagas disponíveis`
    - `Receita` (formatada em reais brasileiros `R$ X,XX`, ex.: `R$ 350,00`, `R$ 0,00`)
    - `Estornados`

## 3. Dependências
- **Consumes**: `F02` (página de gestão, lotação, ownership), `F03` (ingressos de vitrine/API, status, `price_cents` histórico), `F04` (`checked_in`), `F05` (`cancelled` no evento e `refunded`/`cancelled` nos ingressos).
- **Provides**: Serviço e endpoint `/api/organizer/events/:eventId/panel` e componente `EventPanel` na página de gestão, além da suíte de testes E2E cross-feature integrando todas as regras R01–R13.
