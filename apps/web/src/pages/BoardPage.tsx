import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { get, patch, post } from '../api/client';
import type { Order } from '../api/types';
import { OrderCard } from '../components/OrderCard';

const COLUMNS = [
  { status: 'placed', title: 'New' },
  { status: 'preparing', title: 'Preparing' },
  { status: 'ready', title: 'Ready for pickup' },
] as const;

export function BoardPage() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [rejecting, setRejecting] = useState<Order | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Sockets push changes; the 30 s poll is a safety net.
  const orders = useQuery({
    queryKey: ['orders', 'open'],
    queryFn: () => get<Order[]>('/staff/orders?scope=open'),
    refetchInterval: 30_000,
  });

  const done = { onSuccess: () => qc.invalidateQueries({ queryKey: ['orders'] }), onError: (e: Error) => setError(e.message) };
  const advance = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'accept' | 'ready' }) => patch(`/staff/orders/${id}`, { action }),
    ...done,
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => post(`/staff/orders/${id}/reject`, { reason }),
    ...done,
    onSuccess: () => {
      setRejecting(null);
      setReason('');
      return qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  if (orders.isLoading) return <p className="muted">Loading orders…</p>;
  if (orders.isError) return <div className="error">{(orders.error as Error).message}</div>;
  const list = orders.data ?? [];

  return (
    <>
      {error && (
        <div className="error" role="alert" onClick={() => setError('')}>
          {error} (tap to dismiss)
        </div>
      )}
      <div className="board">
        {COLUMNS.map((col) => {
          const items = list.filter((o) => o.status === col.status);
          return (
            <section key={col.status} className="column">
              <h2>
                {col.title} <span className="count">{items.length}</span>
              </h2>
              {items.length === 0 && <p className="muted empty">Nothing here</p>}
              {items.map((o) => (
                <OrderCard
                  key={o.id}
                  order={o}
                  now={now}
                  actions={
                    <>
                      {o.status === 'placed' && (
                        <>
                          <button className="btn" onClick={() => setRejecting(o)}>Reject</button>
                          <button className="btn primary" disabled={advance.isPending} onClick={() => advance.mutate({ id: o.id, action: 'accept' })}>
                            Accept
                          </button>
                        </>
                      )}
                      {o.status === 'preparing' && (
                        <>
                          <button className="btn" onClick={() => setRejecting(o)}>Reject</button>
                          <button className="btn primary" disabled={advance.isPending} onClick={() => advance.mutate({ id: o.id, action: 'ready' })}>
                            Ready
                          </button>
                        </>
                      )}
                      {o.status === 'ready' && (
                        <button className="btn primary" onClick={() => nav(`/pickup?code=${o.pickupCode}`)}>Collect</button>
                      )}
                    </>
                  }
                />
              ))}
            </section>
          );
        })}
      </div>

      {rejecting && (
        <div className="modal-bg" onClick={() => setRejecting(null)}>
          <form
            className="card modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              reject.mutate({ id: rejecting.id, reason });
            }}
          >
            <h2>Reject #{rejecting.pickupCode}?</h2>
            <p className="muted">The student sees this reason.</p>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Item finished" minLength={3} required autoFocus />
            <div className="row">
              <button type="button" className="btn" onClick={() => setRejecting(null)}>Cancel</button>
              <button className="btn danger" disabled={reject.isPending}>Reject order</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
