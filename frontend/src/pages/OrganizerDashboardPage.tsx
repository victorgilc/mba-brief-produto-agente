import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, apiFetch, formatBRL, formatDateTime } from '../lib/api';

export interface OrganizerEvent {
  id: string;
  name: string;
  startsAt: string;
  location: string;
  capacity: number;
  priceCents: number;
  status: 'draft' | 'published' | 'cancelled';
  occupiedSeats: number;
  availableSeats: number;
}

const STATUS_LABEL: Record<OrganizerEvent['status'], string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  cancelled: 'Cancelado'
};

function parsePriceToCents(raw: string): number {
  const normalized = raw.trim().replace(/\./g, '').replace(',', '.');
  const num = Number(normalized);
  if (!Number.isFinite(num) || num <= 0) {
    return 0;
  }
  return Math.round(num * 100);
}

function parsePriceFlexible(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed.includes(',')) {
    return parsePriceToCents(trimmed);
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num <= 0) {
    return 0;
  }
  return Math.round(num * 100);
}

export function OrganizerDashboardPage() {
  const [events, setEvents] = useState<OrganizerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('10');
  const [price, setPrice] = useState('50.00');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadEvents() {
    setLoading(true);
    try {
      const data = await apiFetch<{ events: OrganizerEvent[] }>('/api/organizer/events');
      setEvents(data.events);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const priceCents = parsePriceFlexible(price);
      const isoStartsAt = startsAt ? new Date(startsAt).toISOString() : '';
      await apiFetch('/api/organizer/events', {
        method: 'POST',
        body: JSON.stringify({
          name,
          startsAt: isoStartsAt,
          location,
          capacity: Number(capacity),
          priceCents
        })
      });
      setName('');
      setStartsAt('');
      setLocation('');
      setCapacity('10');
      setPrice('50.00');
      setSuccess('Evento criado como rascunho.');
      await loadEvents();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar evento');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section>
      <h1>Área do organizador</h1>

      <div className="card">
        <h2>Novo evento</h2>
        {error && (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        )}
        {success && (
          <div className="alert alert-success" role="status" aria-live="polite">
            {success}
          </div>
        )}
        <form onSubmit={handleCreate}>
          <div className="field">
            <label htmlFor="ev-name">Nome do evento</label>
            <input
              id="ev-name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ev-starts-at">Data e hora de início</label>
            <input
              id="ev-starts-at"
              name="startsAt"
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ev-location">Local</label>
            <input
              id="ev-location"
              name="location"
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ev-capacity">Lotação</label>
            <input
              id="ev-capacity"
              name="capacity"
              type="number"
              min={1}
              step={1}
              required
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="ev-price">Preço (R$)</label>
            <input
              id="ev-price"
              name="price"
              type="text"
              inputMode="decimal"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Criando...' : 'Criar evento'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2>Meus eventos</h2>
        {loading && <p>Carregando...</p>}
        {!loading && events.length === 0 && <p>Você ainda não criou nenhum evento.</p>}
        {!loading && events.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>Evento</th>
                <th>Início</th>
                <th>Preço</th>
                <th>Lotação</th>
                <th>Status</th>
                <th>Gestão</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{ev.name}</td>
                  <td>{formatDateTime(ev.startsAt)}</td>
                  <td>{formatBRL(ev.priceCents)}</td>
                  <td>{ev.capacity}</td>
                  <td>
                    <span className={`badge badge-${ev.status}`}>
                      {STATUS_LABEL[ev.status]}
                    </span>
                  </td>
                  <td>
                    <Link to={`/organizador/eventos/${ev.id}`}>Gerenciar</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
