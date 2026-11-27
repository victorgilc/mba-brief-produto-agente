import React, { useState } from 'react';
import { ApiError, apiFetch } from '../lib/api';

export interface CheckinResponse {
  ok: boolean;
  reason:
    | 'invalid_ticket'
    | 'event_cancelled'
    | 'ticket_not_confirmed'
    | 'already_checked_in'
    | 'checked_in';
  message: string;
}

export interface CheckinSectionProps {
  eventId: string;
  eventStatus: 'draft' | 'published' | 'cancelled';
  onCheckedIn?: () => void;
}

export function CheckinSection({
  eventId,
  eventStatus,
  onCheckedIn
}: CheckinSectionProps) {
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckinResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setResult(null);
      setErrorMessage('Informe o código do ingresso.');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const data = await apiFetch<CheckinResponse>(
        `/api/organizer/events/${eventId}/checkin`,
        {
          method: 'POST',
          body: JSON.stringify({ code: trimmed })
        }
      );
      setResult(data);
      if (data.ok) {
        setCode('');
        onCheckedIn?.();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof ApiError ? err.message : 'Erro ao validar check-in'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="card" aria-labelledby="checkin-heading">
      <h2 id="checkin-heading">Check-in de ingressos</h2>

      {eventStatus === 'cancelled' && (
        <div className="alert alert-warning" role="status">
          Evento cancelado — novos check-ins não serão liberados para este evento.
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="checkin-code">Código do ingresso</label>
          <input
            id="checkin-code"
            name="code"
            type="text"
            required
            placeholder="Ex.: K7Q2M9XA"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Validando...' : 'Validar check-in'}
        </button>
      </form>

      <div role="status" aria-live="polite">
        {result && (
          <div
            className={`alert ${result.ok ? 'alert-success' : 'alert-error'}`}
          >
            {result.message}
          </div>
        )}
        {errorMessage && (
          <div className="alert alert-error">{errorMessage}</div>
        )}
      </div>
    </section>
  );
}
