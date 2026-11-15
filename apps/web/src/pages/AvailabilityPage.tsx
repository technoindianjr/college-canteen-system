import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { get, patch, post } from '../api/client';
import type { Menu } from '../api/types';
import { rupees } from '../lib/format';

export function AvailabilityPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState('');
  const [error, setError] = useState('');
  const menu = useQuery({ queryKey: ['menu'], queryFn: () => get<Menu>('/menu') });

  const refresh = () => qc.invalidateQueries({ queryKey: ['menu'] });
  const fail = (e: Error) => setError(e.message);
  const toggle = useMutation({
    mutationFn: ({ kind, id, isAvailable }: { kind: 'items' | 'combos'; id: number; isAvailable: boolean }) =>
      patch(`/staff/${kind}/${id}`, { isAvailable }),
    onSuccess: refresh,
    onError: fail,
  });
  const pause = useMutation({ mutationFn: (paused: boolean) => post('/staff/pause', { paused }), onSuccess: refresh, onError: fail });

  if (menu.isLoading) return <p className="muted">Loading menu…</p>;
  if (menu.isError || !menu.data) return <div className="error">{(menu.error as Error)?.message}</div>;
  const m = menu.data;
  const match = (name: string) => name.toLowerCase().includes(q.trim().toLowerCase());
  const paused = m.ordering.paused;

  return (
    <div className="narrow">
      <div className={`card pause ${paused ? 'paused' : ''}`}>
        <div>
          <h2>{paused ? 'Ordering is paused' : 'Ordering is on'}</h2>
          <p className="muted">
            {paused ? 'Students cannot place new orders.' : `Open ${m.ordering.openTime}–${m.ordering.closeTime}. Pause during a rush.`}
          </p>
        </div>
        <button className={`btn big ${paused ? 'primary' : 'danger'}`} disabled={pause.isPending} onClick={() => pause.mutate(!paused)}>
          {paused ? 'Resume ordering' : 'Pause ordering'}
        </button>
      </div>

      {error && <div className="error" role="alert" onClick={() => setError('')}>{error}</div>}
      <input className="search" placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} />

      {m.categories.map((c) => {
        const items = c.items.filter((i) => match(i.name));
        if (!items.length) return null;
        return (
          <section key={c.id}>
            <h3>{c.name}</h3>
            {items.map((i) => (
              <Row key={i.id} name={i.name} price={rupees(i.pricePaise)} on={i.isAvailable} busy={toggle.isPending} onToggle={() => toggle.mutate({ kind: 'items', id: i.id, isAvailable: !i.isAvailable })} />
            ))}
          </section>
        );
      })}

      {m.combos.some((c) => match(c.name)) && <h3>Combos</h3>}
      {m.combos
        .filter((c) => match(c.name))
        .map((c) => (
          <Row key={c.id} name={c.name} price={rupees(c.pricePaise)} on={c.isAvailable} busy={toggle.isPending} onToggle={() => toggle.mutate({ kind: 'combos', id: c.id, isAvailable: !c.isAvailable })} />
        ))}
    </div>
  );
}

function Row({ name, price, on, busy, onToggle }: { name: string; price: string; on: boolean; busy: boolean; onToggle: () => void }) {
  return (
    <div className={`avail-row ${on ? '' : 'off'}`}>
      <div>
        <b>{name}</b> <span className="muted">{price}</span>
      </div>
      <button className={`btn ${on ? '' : 'primary'}`} disabled={busy} onClick={onToggle}>
        {on ? 'Mark sold out' : 'Back in stock'}
      </button>
    </div>
  );
}
