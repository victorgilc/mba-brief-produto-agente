import { useState } from 'react';
import { ApiError, apiFetch } from '../lib/api';

interface CancelEventSectionProps {
  eventId: string;
  eventStatus: 'draft' | 'published' | 'cancelled';
  onCancelled: () => void | Promise<void>;
}

export function CancelEventSection({
  eventId,
  eventStatus,
  onCancelled
}: CancelEventSectionProps) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (eventStatus === 'draft') {
    return null;
  }

  if (eventStatus === 'cancelled') {
    return (
      <div className="alert alert-error" role="alert">
        Evento cancelado — este evento não pode mais ser editado, republicado ou vendido.
      </div>
    );
  }

  async function handleConfirmCancel() {
    setError(null);
    setCancelling(true);
    try {
      await apiFetch(`/api/organizer/events/${eventId}/cancel`, {
        method: 'POST'
      });
      setConfirming(false);
      await onCancelled();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Erro ao cancelar evento'
      );
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div
      className="card"
      style={{ borderColor: '#fecdca', background: 'var(--danger-bg)' }}
    >
      <h2 style={{ color: 'var(--danger)', marginTop: 0 }}>Cancelar evento</h2>
      <p>
        O cancelamento é irreversível. O evento sairá imediatamente da vitrine e da API de
        parceiros, os ingressos confirmados serão estornados e os pendentes serão cancelados.
      </p>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {!confirming ? (
        <div className="actions-row">
          <button
            type="button"
            className="btn-danger"
            onClick={() => {
              setError(null);
              setConfirming(true);
            }}
          >
            Cancelar evento
          </button>
        </div>
      ) : (
        <div>
          <div className="alert alert-warning" role="alert">
            Tem certeza? Esta ação não pode ser desfeita.
          </div>
          <div className="actions-row">
            <button
              type="button"
              className="btn-danger"
              disabled={cancelling}
              onClick={handleConfirmCancel}
            >
              {cancelling ? 'Cancelando...' : 'Confirmar cancelamento irreversível'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={cancelling}
              onClick={() => {
                setError(null);
                setConfirming(false);
              }}
            >
              Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
