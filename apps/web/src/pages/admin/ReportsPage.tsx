import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { get } from '../../api/client';
import type { Report } from '../../api/types';
import { ErrorBox, todayStr } from '../../components/ui';
import { rupees } from '../../lib/format';

const PRESETS = [
  { label: 'Today', from: () => todayStr(), to: () => todayStr() },
  { label: 'Last 7 days', from: () => todayStr(-6), to: () => todayStr() },
  { label: 'Last 30 days', from: () => todayStr(-29), to: () => todayStr() },
];

export function ReportsPage() {
  const [from, setFrom] = useState(todayStr(-6));
  const [to, setTo] = useState(todayStr());
  const valid = from <= to;
  const report = useQuery({
    queryKey: ['admin', 'report', from, to],
    queryFn: () => get<Report>(`/admin/reports/summary?from=${from}&to=${to}`),
    enabled: valid,
  });
  const r = report.data;

  return (
    <div>
      <h1>Reports</h1>
      <div className="row">
        {PRESETS.map((p) => (
          <button key={p.label} className="btn small" onClick={() => (setFrom(p.from()), setTo(p.to()))}>{p.label}</button>
        ))}
        <input type="date" className="auto" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        <span className="muted">to</span>
        <input type="date" className="auto" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
      </div>
      {!valid && <ErrorBox message="The start date must be before the end date." />}
      {report.isLoading && <p className="muted">Loading…</p>}
      {report.isError && <ErrorBox message={(report.error as Error).message} />}

      {r && (
        <>
          <div className="tiles">
            <Tile label="Revenue (collected)" value={rupees(r.totals.revenuePaise)} sub={`Cash ${rupees(r.totals.cashPaise)} · UPI ${rupees(r.totals.upiPaise)}`} />
            <Tile label="Orders" value={String(r.totals.orders)} sub={`${r.totals.collected} collected`} />
            <Tile label="Lost orders" value={String(r.totals.cancelled + r.totals.rejected + r.totals.noShows)} sub={`${r.totals.cancelled} cancelled · ${r.totals.rejected} rejected · ${r.totals.noShows} no-show`} />
            <Tile label="Avg time to ready" value={r.totals.avgMinutesToReady === null ? '—' : `${r.totals.avgMinutesToReady} min`} sub={r.totals.avgMinutesReadyToPickup === null ? undefined : `${r.totals.avgMinutesReadyToPickup} min until pickup`} />
            <Tile label="Rating" value={r.feedback.avgRating === null ? '—' : `${r.feedback.avgRating} ★`} sub={`${r.feedback.ratings} ratings`} />
          </div>

          <div className="two">
            <section className="card">
              <h2>Top items</h2>
              {r.topItems.length === 0 && <p className="muted">No collected orders in this range.</p>}
              <Bars rows={r.topItems.map((i) => ({ label: i.name, value: i.qty, text: `${i.qty} sold · ${rupees(i.revenuePaise)}` }))} />
            </section>
            <section className="card">
              <h2>Orders by hour</h2>
              {r.byHour.length === 0 && <p className="muted">No orders.</p>}
              <Bars rows={r.byHour.map((h) => ({ label: `${String(h.hour).padStart(2, '0')}:00`, value: h.orders, text: String(h.orders) }))} />
            </section>
          </div>

          <section className="card">
            <h2>By day</h2>
            {r.byDay.length === 0 && <p className="muted">No orders.</p>}
            <Bars rows={r.byDay.map((d) => ({ label: d.day, value: d.orders, text: `${d.orders} orders · ${rupees(d.revenuePaise)}` }))} />
          </section>
        </>
      )}
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card tile">
      <div className="muted">{label}</div>
      <div className="big-num">{value}</div>
      {sub && <div className="muted small-text">{sub}</div>}
    </div>
  );
}

/** Plain CSS horizontal bars (no chart library needed for six simple charts). */
function Bars({ rows }: { rows: { label: string; value: number; text: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="bars">
      {rows.map((r) => (
        <div key={r.label} className="bar-row">
          <span className="bar-label">{r.label}</span>
          <span className="bar-track"><span className="bar-fill" style={{ width: `${(r.value / max) * 100}%` }} /></span>
          <span className="bar-text">{r.text}</span>
        </div>
      ))}
    </div>
  );
}
