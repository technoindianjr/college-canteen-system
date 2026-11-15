import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { get, patch, post } from '../../api/client';
import type { Role, User } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { ErrorBox, Field, Modal } from '../../components/ui';

export function UsersPage() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);

  const params = new URLSearchParams();
  if (q.trim()) params.set('q', q.trim());
  if (role) params.set('role', role);
  if (blocked) params.set('blocked', 'true');
  const users = useQuery({ queryKey: ['admin', 'users', params.toString()], queryFn: () => get<User[]>(`/admin/users?${params}`) });

  const change = useMutation({
    mutationFn: ({ id, ...body }: { id: number; role?: Role; isBlocked?: boolean; resetNoShows?: boolean }) => patch(`/admin/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div>
      <div className="row between">
        <h1>Users</h1>
        <button className="btn primary" onClick={() => setAdding(true)}>+ Add staff</button>
      </div>
      <div className="row">
        <input className="grow" placeholder="Search name, email, phone, roll no…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={role} onChange={(e) => setRole(e.target.value as '' | Role)}>
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="staff">Staff</option>
          <option value="admin">Admins</option>
        </select>
        <label className="check inline">
          <input type="checkbox" checked={blocked} onChange={(e) => setBlocked(e.target.checked)} /> Blocked only
        </label>
      </div>
      <ErrorBox message={error} onClear={() => setError('')} />
      {users.isLoading && <p className="muted">Loading…</p>}
      {users.isError && <ErrorBox message={(users.error as Error).message} />}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Login</th><th>Role</th><th>No-shows</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {users.data?.map((u) => {
              const self = u.id === me?.id;
              return (
                <tr key={u.id}>
                  <td>{u.name ?? <span className="muted">—</span>}{u.rollNo ? <div className="muted">{u.rollNo}</div> : null}</td>
                  <td>{u.email ?? u.phone}</td>
                  <td>
                    <select value={u.role} disabled={self || change.isPending} onChange={(e) => change.mutate({ id: u.id, role: e.target.value as Role })}>
                      <option value="student">student</option>
                      <option value="staff">staff</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td>
                    {u.noShowCount}{' '}
                    {u.noShowCount > 0 && <button className="link" onClick={() => change.mutate({ id: u.id, resetNoShows: true })}>reset</button>}
                  </td>
                  <td>{u.isBlocked ? <span className="pill rejected">blocked</span> : <span className="pill picked_up">active</span>}</td>
                  <td className="nowrap">
                    {u.email && <button className="btn small" onClick={() => setResetting(u)}>Reset password</button>}{' '}
                    {!self && (
                      <button className="btn small" disabled={change.isPending} onClick={() => change.mutate({ id: u.id, isBlocked: !u.isBlocked })}>
                        {u.isBlocked ? 'Unblock' : 'Block'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {users.data?.length === 0 && <p className="muted">No users match.</p>}
      {adding && <AddStaff onClose={() => setAdding(false)} onDone={() => qc.invalidateQueries({ queryKey: ['admin', 'users'] })} />}
      {resetting && <ResetPassword user={resetting} onClose={() => setResetting(null)} />}
    </div>
  );
}

function AddStaff({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+91');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'staff' | 'admin'>('staff');
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: () =>
      mode === 'email'
        ? post('/admin/users/staff', { email, password, name, role })
        : post('/admin/users', { phone, name: name || undefined, role }),
    onSuccess: () => {
      onDone();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    create.mutate();
  }

  return (
    <Modal title="Add staff" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="seg">
          <button type="button" className={mode === 'email' ? 'on' : ''} onClick={() => setMode('email')}>Email + password</button>
          <button type="button" className={mode === 'phone' ? 'on' : ''} onClick={() => setMode('phone')}>Phone OTP (app)</button>
        </div>
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} required={mode === 'email'} minLength={2} /></Field>
        {mode === 'email' ? (
          <>
            <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="Initial password" hint="At least 8 characters. Share it privately.">
              <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="off" />
            </Field>
          </>
        ) : (
          <Field label="Phone" hint="International format, e.g. +919876543210. They log in with OTP in the app.">
            <input value={phone} onChange={(e) => setPhone(e.target.value)} pattern="\+[1-9]\d{7,14}" required />
          </Field>
        )}
        <Field label="Role">
          <select value={role} onChange={(e) => setRole(e.target.value as 'staff' | 'admin')}>
            <option value="staff">Staff (order board, pickup, availability)</option>
            <option value="admin">Admin (everything)</option>
          </select>
        </Field>
        <ErrorBox message={error} />
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={create.isPending}>Create</button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPassword({ user, onClose }: { user: User; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => patch(`/admin/users/${user.id}`, { password }),
    onSuccess: onClose,
    onError: (e: Error) => setError(e.message),
  });
  return (
    <Modal title={`Reset password for ${user.name ?? user.email}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="New password" hint="At least 8 characters. Existing sessions stay signed in until they expire.">
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoFocus autoComplete="off" />
        </Field>
        <ErrorBox message={error} />
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={save.isPending}>Save password</button>
        </div>
      </form>
    </Modal>
  );
}
