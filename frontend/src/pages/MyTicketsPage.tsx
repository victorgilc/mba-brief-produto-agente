import { useEffect, useState } from 'react';
import { apiFetch, formatBRL, formatDateTime } from '../lib/api';

interface UserTicket {
  ticketId: string;
  code: string;
  eventId: string;
  eventName: string;
  eventStartsAt: string;
  eventLocation: string;
  status: 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'refunded';
  checkedIn: boolean;
  priceCents: number;
  createdAt: string;
}

const TICKET_STATUS_LABELS: Record<UserTicket['status'], string> = {
  pending: 'pendente',
  confirmed: 'confirmado',
  declined: 'recusado',
  cancelled: 'cancelado',
  refunded: 'estornado'
};

export function MyTicketsPage() {
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTickets() {
    setLoading(true);
    try {
      const data = await apiFetch<{ tickets: UserTicket[] }>('/api/me/tickets');
      setTickets(data.tickets);
      setError(null);
    } catch {
      setError('Não foi possível carregar seus ingressos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTickets();
  }, []);

  return (
    <section>
      <div className="actions-row" style={{ justifyContent: 'space-between', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Meus ingressos</h1>
        <button type="button" className="btn-secondary" onClick={loadTickets}>
          Atualizar
        </button>
      </div>

      {loading && <p>Carregando...</p>}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {!loading && !error && tickets.length === 0 && (
        <div className="card">
          <p>Você ainda não comprou nenhum ingresso.</p>
        </div>
      )}

      {!loading && tickets.length > 0 && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Evento</th>
                <th>Data</th>
                <th>Status</th>
                <th>Código</th>
                <th>Valor pago</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.ticketId}>
                  <td>{t.eventName}</td>
                  <td>{formatDateTime(t.eventStartsAt)}</td>
                  <td>
                    <span className={`badge badge-${t.status}`}>
                      {TICKET_STATUS_LABELS[t.status]}
                    </span>
                  </td>
                  <td>
                    <span className="code-chip">{t.code}</span>
                  </td>
                  <td>{formatBRL(t.priceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
