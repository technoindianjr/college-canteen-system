import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { get, put } from '../../api/client';
import type { AppSettings } from '../../api/types';
import { ErrorBox, Field } from '../../components/ui';

export function SettingsPage() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => get<AppSettings>('/admin/settings') });
  const [form, setForm] = useState<AppSettings | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  const save = useMutation({
    // orders_paused is owned by the staff Pause switch; don't overwrite it with a stale value.
    mutationFn: ({ orders_paused: _paused, ...rest }: AppSettings) => put<AppSettings>('/admin/settings', rest),
    onSuccess: () => {
      setSaved(true);
      setError('');
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void qc.invalidateQueries({ queryKey: ['menu'] });
    },
    onError: (e: Error) => setError(e.message),
  });

  if (settings.isLoading || !form) return <p className="muted">Loading…</p>;
  const set = (k: keyof AppSettings) => (e: { target: { value: string } }) => {
    setSaved(false);
    setForm({ ...form, [k]: e.target.value });
  };
  const sameTime = form.open_time === form.close_time;

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate(form!);
  }

  return (
    <form className="narrow" onSubmit={submit}>
      <h1>Settings</h1>
      <section className="card">
        <h2>Opening hours</h2>
        <div className="row">
          <Field label="Opens"><input type="time" value={form.open_time} onChange={set('open_time')} required /></Field>
          <Field label="Closes"><input type="time" value={form.close_time} onChange={set('close_time')} required /></Field>
        </div>
        <p className="muted">
          {sameTime ? 'Same open and close time means ordering is open all day.' : 'Students can only order between these times (canteen local time).'}
        </p>
      </section>

      <section className="card">
        <h2>Order limits</h2>
        <div className="row">
          <Field label="Max open orders per student"><input type="number" min={1} value={form.max_open_orders_per_student} onChange={set('max_open_orders_per_student')} required /></Field>
          <Field label="Max orders per 10 minutes (all students)"><input type="number" min={1} value={form.max_orders_per_10_min} onChange={set('max_orders_per_10_min')} required /></Field>
        </div>
      </section>

      <section className="card">
        <h2>No-shows</h2>
        <div className="row">
          <Field label="Minutes before a ready order counts as no-show"><input type="number" min={1} value={form.no_show_minutes} onChange={set('no_show_minutes')} required /></Field>
          <Field label="Block a student after this many no-shows"><input type="number" min={1} value={form.no_show_block_after} onChange={set('no_show_block_after')} required /></Field>
        </div>
      </section>

      <ErrorBox message={error} />
      {saved && <div className="success">Settings saved.</div>}
      <button className="btn primary big" disabled={save.isPending}>Save settings</button>
    </form>
  );
}
