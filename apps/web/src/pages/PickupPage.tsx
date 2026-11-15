import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { get, patch } from '../api/client';
import type { Order, PaymentMethod } from '../api/types';
import { OrderCard } from '../components/OrderCard';

export function PickupPage() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [found, setFound] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const lookup = useMutation({
    mutationFn: (c: string) => get<Order[]>(`/staff/lookup?code=${c}`),
    onSuccess: (list) => {
      setFound(list);
      setError('');
    },
    onError: (e: Error) => {
      setFound(null);
      setError(e.message);
    },
  });

  const collect = useMutation({
    mutationFn: ({ id, paymentMethod }: { id: number; paymentMethod: PaymentMethod }) =>
      patch(`/staff/orders/${id}`, { action: 'pickup', pickupCode: code, paymentMethod }),
    onSuccess: () => {
      setMessage(`Order #${code} collected.`);
      setFound(null);
      setCode('');
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  // Arriving from the board's "Collect" button: look the code up straight away.
  const initial = params.get('code');
  useEffect(() => {
    if (initial && /^\d{4}$/.test(initial)) lookup.mutate(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setMessage('');
    lookup.mutate(code);
  }

  return (
    <div className="narrow">
      <h1>Pickup</h1>
      <form className="row" onSubmit={submit}>
        <input
          className="code-input"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          placeholder="4-digit code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          autoFocus
        />
        <button className="btn primary big" disabled={code.length !== 4 || lookup.isPending}>Find order</button>
      </form>
      {message && <div className="success">{message}</div>}
      {error && <div className="error" role="alert">{error}</div>}
      {found?.map((o) => (
        <div key={o.id}>
          <OrderCard order={o} now={Date.now()} />
          {o.status === 'ready' ? (
            <>
              <p className="muted">Take payment, then confirm:</p>
              <div className="row">
                <button className="btn primary big" disabled={collect.isPending} onClick={() => collect.mutate({ id: o.id, paymentMethod: 'cash' })}>
                  Paid cash
                </button>
                <button className="btn primary big" disabled={collect.isPending} onClick={() => collect.mutate({ id: o.id, paymentMethod: 'upi_counter' })}>
                  Paid UPI
                </button>
              </div>
            </>
          ) : (
            <div className="banner warn">This order is “{o.status}”, not ready yet.</div>
          )}
        </div>
      ))}
    </div>
  );
}
