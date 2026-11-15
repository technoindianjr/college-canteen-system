import type { ReactNode } from 'react';
import type { Order } from '../api/types';
import { ago, minutesSince, rupees } from '../lib/format';

export function OrderCard({ order, now, actions }: { order: Order; now: number; actions?: ReactNode }) {
  const waited = minutesSince(order.createdAt, now);
  return (
    <article className={`order ${waited >= 15 && order.status !== 'ready' ? 'late' : ''}`}>
      <div className="order-head">
        <span className="code">#{order.pickupCode}</span>
        <span className="muted">{ago(order.createdAt, now)}</span>
      </div>
      <div className="who-line">
        {order.customer?.name ?? 'Student'}
        {order.customer?.rollNo ? <span className="muted"> · {order.customer.rollNo}</span> : null}
      </div>
      <ul className="lines">
        {order.items.map((i, idx) => (
          <li key={idx}>
            <b>{i.qty}×</b> {i.name}
            {i.note ? <em> — {i.note}</em> : null}
          </li>
        ))}
      </ul>
      {order.note && <div className="note">“{order.note}”</div>}
      <div className="order-foot">
        <span className="total">{rupees(order.totalPaise)}</span>
        <span className="actions">{actions}</span>
      </div>
    </article>
  );
}
