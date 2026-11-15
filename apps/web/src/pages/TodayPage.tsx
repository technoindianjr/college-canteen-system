import { useQuery } from '@tanstack/react-query';
import { get } from '../api/client';
import type { Order } from '../api/types';
import { rupees } from '../lib/format';

export function TodayPage() {
  const orders = useQuery({ queryKey: ['orders', 'today'], queryFn: () => get<Order[]>('/staff/orders?scope=today') });
  if (orders.isLoading) return <p className="muted">Loading…</p>;
  if (orders.isError) return <div className="error">{(orders.error as Error).message}</div>;
  const list = [...(orders.data ?? [])].reverse();
  const paid = list.filter((o) => o.status === 'picked_up');
  const total = paid.reduce((s, o) => s + o.totalPaise, 0);

  return (
    <div className="narrow">
      <h1>Today</h1>
      <p className="muted">
        {list.length} orders · {paid.length} collected · {rupees(total)} taken
      </p>
      <table className="table">
        <thead>
          <tr><th>Time</th><th>Code</th><th>Customer</th><th>Items</th><th>Status</th><th>Total</th></tr>
        </thead>
        <tbody>
          {list.map((o) => (
            <tr key={o.id}>
              <td>{new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
              <td>#{o.pickupCode}</td>
              <td>{o.customer?.name ?? '—'}</td>
              <td>{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}</td>
              <td><span className={`pill ${o.status}`}>{o.status.replace('_', ' ')}</span></td>
              <td>{rupees(o.totalPaise)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
