import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError, apiFetch, formatBRL, formatDateTime } from '../lib/api';

export interface PublicEvent {
  id: string;
  name: string;
  startsAt: string;
  location: string;
  priceCents: number;
  capacity: number;
  availableSeats: number;
}

interface PurchaseFeedback {
  type: 'success' | 'error';
  message: string;
  code?: string;
}

export function StorefrontPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<Record<string, string>>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, PurchaseFeedback>>({});

  async function loadEvents() {
    try {
      const data = await apiFetch<{ events: PublicEvent[] }>('/api/events');
      setEvents(data.events);
      setError(null);
    } catch {
      setError('Não foi possível carregar os eventos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvents();
  }, []);

  async function handleBuy(e: React.FormEvent, eventId: string) {
    e.preventDefault();
    const cardNumber = (cards[eventId] ?? '').trim();
    setSubmittingId(eventId);
    setFeedback((prev) => {
      const next = { ...prev };
      delete next[eventId];
      return next;
    });

    try {
      const res = await apiFetch<{
        ticket: { ticketId: string; code: string; status: string };
      }>(`/api/events/${eventId}/purchases`, {
        method: 'POST',
        body: JSON.stringify({ cardNumber })
      });
      setCards((prev) => ({ ...prev, [eventId]: '' }));
      setFeedback((prev) => ({
        ...prev,
        [eventId]: {
          type: 'success',
          message: 'Compra registrada (pendente). Acompanhe em Meus ingressos.',
          code: res.ticket.code
        }
      }));
      await loadEvents();
    } catch (err) {
      const msg =
        err instanceof ApiError && err.code === 'sold_out'
          ? 'Ingressos esgotados'
          : err instanceof ApiError
            ? err.message
            : 'Erro ao realizar compra';
      setFeedback((prev) => ({
        ...prev,
        [eventId]: { type: 'error', message: msg }
      }));
      await loadEvents();
    } finally {
      setSubmittingId(null);
    }
  }

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
        {events.map((ev) => {
          const fb = feedback[ev.id];
          const isSoldOut = ev.availableSeats <= 0;
          return (
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

              {fb && (
                <div
                  className={`alert ${fb.type === 'success' ? 'alert-success' : 'alert-error'}`}
                  role={fb.type === 'error' ? 'alert' : 'status'}
                  aria-live="polite"
                >
                  <p style={{ margin: 0 }}>{fb.message}</p>
                  {fb.code && (
                    <p style={{ margin: '0.4rem 0 0' }}>
                      Código: <span className="code-chip">{fb.code}</span> ·{' '}
                      <Link to="/meus-ingressos">Ver em Meus ingressos</Link>
                    </p>
                  )}
                </div>
              )}

              {isSoldOut ? (
                <div className="alert alert-warning" role="status">
                  <strong>Ingressos esgotados</strong>
                </div>
              ) : user?.role === 'participant' ? (
                <form onSubmit={(e) => handleBuy(e, ev.id)}>
                  <div className="field">
                    <label htmlFor={`card-${ev.id}`}>
                      Número do cartão (16 dígitos)
                    </label>
                    <input
                      id={`card-${ev.id}`}
                      name="cardNumber"
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={16}
                      pattern="\d{16}"
                      required
                      value={cards[ev.id] ?? ''}
                      onChange={(e) =>
                        setCards((prev) => ({ ...prev, [ev.id]: e.target.value }))
                      }
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submittingId === ev.id}
                  >
                    {submittingId === ev.id
                      ? 'Processando...'
                      : `Comprar ingresso (${formatBRL(ev.priceCents)})`}
                  </button>
                </form>
              ) : !user ? (
                <p>
                  <Link to="/login">Entre</Link> ou{' '}
                  <Link to="/cadastro">crie uma conta</Link> para comprar.
                </p>
              ) : (
                <p className="nav-user">
                  Compras pela vitrine estão disponíveis para contas de participante.
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
