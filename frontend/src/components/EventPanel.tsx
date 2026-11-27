import { formatBRL } from '../lib/api';

export interface EventPanelData {
  eventId: string;
  confirmed: number;
  pending: number;
  checkedIn: number;
  availableSeats: number;
  revenueCents: number;
  refunded: number;
}

export function EventPanel({
  panel,
  onRefresh
}: {
  panel: EventPanelData;
  onRefresh?: () => void;
}) {
  return (
    <div className="card" aria-labelledby="panel-heading">
      <div
        className="actions-row"
        style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}
      >
        <h2 id="panel-heading" style={{ margin: 0 }}>
          Painel do evento
        </h2>
        {onRefresh && (
          <button type="button" className="btn-secondary" onClick={onRefresh}>
            Atualizar painel
          </button>
        )}
      </div>

      <div className="metrics-grid">
        <div className="metric-box">
          <span className="metric-label">Confirmados</span>
          <span className="metric-value" data-testid="metric-confirmed">
            {panel.confirmed}
          </span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Pendentes</span>
          <span className="metric-value" data-testid="metric-pending">
            {panel.pending}
          </span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Check-ins</span>
          <span className="metric-value" data-testid="metric-checked-in">
            {panel.checkedIn}
          </span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Vagas disponíveis</span>
          <span className="metric-value" data-testid="metric-available-seats">
            {panel.availableSeats}
          </span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Receita</span>
          <span className="metric-value" data-testid="metric-revenue">
            {formatBRL(panel.revenueCents)}
          </span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Estornados</span>
          <span className="metric-value" data-testid="metric-refunded">
            {panel.refunded}
          </span>
        </div>
      </div>
    </div>
  );
}
