import { useEffect, useState } from 'react';
import { apiFetch, formatBRL, formatDateTime } from '../lib/api';

export interface PublicEvent {
  id: string;
  name: string;
  startsAt: string;
  location: string;
  priceCents: number;
  capacity: number;
  availableSeats: number;
}

export function StorefrontPage() {
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ events: PublicEvent[] }>('/api/events')
      .then((data) => setEvents(data.events))
      .catch(() => setError('Não foi possível carregar os eventos.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section>
      <h1>Vitrine de eventos</h1>
      {loading && <p>Carregando eventos...</p>}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      {!loading && !error && events.length === 0 && (
        <div className="card">
          <p>Nenhum evento publicado disponível no momento.</p>
        </div>
      )}
      <div className="grid">
        {events.map((ev) => (
          <article key={ev.id} className="card">
            <h2>{ev.name}</h2>
            <p>
              <strong>Data e hora:</strong> {formatDateTime(ev.startsAt)}
            </p>
            <p>
              <strong>Local:</strong> {ev.location}
            </p>
            <p>
              <strong>Preço:</strong> {formatBRL(ev.priceCents)}
            </p>
            <p>
              <strong>Vagas disponíveis:</strong> {ev.availableSeats}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
