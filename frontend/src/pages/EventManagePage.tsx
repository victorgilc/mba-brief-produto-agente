import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CancelEventSection } from '../components/CancelEventSection';
import { CheckinSection } from '../components/CheckinSection';
import { EventPanel, EventPanelData } from '../components/EventPanel';
import { ApiError, apiFetch, formatBRL, formatDateTime } from '../lib/api';
import { OrganizerEvent } from './OrganizerDashboardPage';

const STATUS_LABEL: Record<OrganizerEvent['status'], string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  cancelled: 'Evento cancelado'
};

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parsePriceFlexible(raw: string): number {
  const trimmed = raw.trim();
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num <= 0) {
    return 0;
  }
  return Math.round(num * 100);
}

export function EventManagePage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<OrganizerEvent | null>(null);
  const [panel, setPanel] = useState<EventPanelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [location, setLocation] = useState('');
  const [capacity, setCapacity] = useState('');
  const [price, setPrice] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadEvent() {
    if (!eventId) return;
    if (!event || event.id !== eventId) {
      setLoading(true);
    }
    setAccessError(null);
    try {
      const data = await apiFetch<{ event: OrganizerEvent; panel: EventPanelData }>(
        `/api/organizer/events/${eventId}`
      );
      setEvent(data.event);
      setPanel(data.panel);
      setName(data.event.name);
      setStartsAt(toDateTimeLocal(data.event.startsAt));
      setLocation(data.event.location);
      setCapacity(String(data.event.capacity));
      setPrice((data.event.priceCents / 100).toFixed(2));
    } catch {
      setEvent(null);
      setPanel(null);
      setAccessError('Evento não encontrado ou acesso negado.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadEvent();
  }, [eventId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!eventId) return;
    setFormError(null);
    setFormSuccess(null);
    setSaving(true);
    try {
      const data = await apiFetch<{ event: OrganizerEvent }>(
        `/api/organizer/events/${eventId}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            name,
            startsAt: new Date(startsAt).toISOString(),
            location,
            capacity: Number(capacity),
            priceCents: parsePriceFlexible(price)
          })
        }
      );
      setEvent(data.event);
      setFormSuccess('Evento atualizado com sucesso.');
      await loadEvent();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao atualizar evento');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!eventId) return;
    setFormError(null);
    setFormSuccess(null);
    try {
      const data = await apiFetch<{ event: OrganizerEvent }>(
        `/api/organizer/events/${eventId}/publish`,
        { method: 'POST' }
      );
      setEvent(data.event);
      setFormSuccess('Evento publicado com sucesso.');
      await loadEvent();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao publicar evento');
    }
  }

  if (loading) {
    return <p>Carregando...</p>;
  }

  if (accessError || !event) {
    return (
      <section className="card" role="alert">
        <h1>Acesso indisponível</h1>
        <p>{accessError ?? 'Evento não encontrado ou acesso negado.'}</p>
        <Link to="/organizador">Voltar para meus eventos</Link>
      </section>
    );
  }

  const isCancelled = event.status === 'cancelled';

  return (
    <section>
      <p>
        <Link to="/organizador">← Voltar para meus eventos</Link>
      </p>

      <div className="card">
        <div className="actions-row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h1>{event.name}</h1>
            <p>
              <strong>ID:</strong> <span className="code-chip">{event.id}</span> ·{' '}
              <strong>Início:</strong> {formatDateTime(event.startsAt)} ·{' '}
              <strong>Local:</strong> {event.location} ·{' '}
              <strong>Preço atual:</strong> {formatBRL(event.priceCents)}
            </p>
          </div>
          <span className={`badge badge-${event.status}`}>
            {STATUS_LABEL[event.status]}
          </span>
        </div>

        <div className="actions-row" style={{ marginTop: '0.75rem' }}>
          {event.status === 'draft' && (
            <button type="button" className="btn-primary" onClick={handlePublish}>
              Publicar evento
            </button>
          )}
        </div>
      </div>

      {panel && <EventPanel panel={panel} onRefresh={loadEvent} />}

      <CheckinSection
        eventId={event.id}
        eventStatus={event.status}
        onCheckedIn={loadEvent}
      />

      {/* Slot: Cancelamento do evento (F05) */}
      <CancelEventSection
        eventId={event.id}
        eventStatus={event.status}
        onCancelled={loadEvent}
      />

      {!isCancelled && (
        <div className="card">
          <h2>Editar evento</h2>
          {formError && (
            <div className="alert alert-error" role="alert">
              {formError}
            </div>
          )}
          {formSuccess && (
            <div className="alert alert-success" role="status" aria-live="polite">
              {formSuccess}
            </div>
          )}
          <form onSubmit={handleSave}>
            <div className="field">
              <label htmlFor="edit-name">Nome do evento</label>
              <input
                id="edit-name"
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="edit-starts-at">Data e hora de início</label>
              <input
                id="edit-starts-at"
                name="startsAt"
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="edit-location">Local</label>
              <input
                id="edit-location"
                name="location"
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="edit-capacity">Lotação</label>
              <input
                id="edit-capacity"
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
              <label htmlFor="edit-price">Preço (R$)</label>
              <input
                id="edit-price"
                name="price"
                type="text"
                inputMode="decimal"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
