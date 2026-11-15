import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get } from '../../api/client';
import type { Order } from '../../api/types';
import { ErrorBox, todayStr } from '../../components/ui';
import { rupees } from '../../lib/format';

export function AllOrdersPage() {
  const [date, setDate] = useState(todayStr());
  const [status, setStatus] = useState('');
  const orders = useQuery({ queryKey: ['orders', 'admin', date], queryFn: () => get<Order[]>(`/admin/orders?date=${date}`) });
  const list = (orders.data ?? []).filter((o) => !status || o.status === status);
  const collected = list.filter((o) => o.paymentStatus === 'paid').reduce((s, o) => s + o.totalPaise, 0);

  return (
    <div>
      <h1>All orders</h1>
      <div className="row">
        <input type="date" className="auto" value={date} max={todayStr()} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['placed', 'preparing', 'ready', 'picked_up', 'cancelled', 'rejected', 'no_show'].map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <span className="muted">{list.length} orders · {rupees(collected)} collected</span>
      </div>
      {orders.isLoading && <p className="muted">Loading…</p>}
      {orders.isError && <ErrorBox message={(orders.error as Error).message} />}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Time</th><th>Code</th><th>Customer</th><th>Items</th><th>Status</th><th>Payment</th><th>Total</th></tr>
          </thead>
          <tbody>
            {list.map((o) => (
              <tr key={o.id}>
                <td>{new Date(o.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>#{o.pickupCode}</td>
                <td>{o.customer?.name ?? '—'}{o.customer?.rollNo ? <div className="muted">{o.customer.rollNo}</div> : null}</td>
                <td>{o.items.map((i) => `${i.qty}× ${i.name}`).join(', ')}{o.rejectReason ? <div className="muted">Rejected: {o.rejectReason}</div> : null}</td>
                <td><span className={`pill ${o.status}`}>{o.status.replace('_', ' ')}</span></td>
                <td>{o.paymentStatus === 'paid' ? (o.paymentMethod === 'upi_counter' ? 'UPI' : 'Cash') : '—'}</td>
                <td>{rupees(o.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {orders.data && list.length === 0 && <p className="muted">No orders.</p>}
    </div>
  );
}
