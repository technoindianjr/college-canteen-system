import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { del, get, patch, post, uploadImage } from '../../api/client';
import type { AdminCategory, AdminCombo, AdminItem, Special } from '../../api/types';
import { Check, ErrorBox, Field, Modal, paiseToText, toPaise, todayStr } from '../../components/ui';
import { rupees } from '../../lib/format';

type Tab = 'items' | 'combos' | 'categories' | 'specials';
const ICONS = ['snack', 'meal', 'drink', 'combo', 'healthy', 'dessert'];

const useAdminList = <T,>(key: string, path: string) => useQuery({ queryKey: ['admin', key], queryFn: () => get<T[]>(path) });

export function MenuPage() {
  const [tab, setTab] = useState<Tab>('items');
  return (
    <div>
      <h1>Menu</h1>
      <div className="seg">
        {(['items', 'combos', 'categories', 'specials'] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {tab === 'items' && <ItemsTab />}
      {tab === 'combos' && <CombosTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'specials' && <SpecialsTab />}
    </div>
  );
}

/** Refresh admin lists and the public menu (staff availability page uses ['menu']). */
function useRefresh() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: ['admin'] }), qc.invalidateQueries({ queryKey: ['menu'] })]);
}

// ---------------------------------------------------------------- items
function ItemsTab() {
  const items = useAdminList<AdminItem>('items', '/admin/items');
  const cats = useAdminList<AdminCategory>('categories', '/admin/categories');
  const [editing, setEditing] = useState<AdminItem | 'new' | null>(null);
  if (items.isLoading || cats.isLoading) return <p className="muted">Loading…</p>;
  if (items.isError || !items.data || !cats.data) return <ErrorBox message={(items.error as Error)?.message ?? 'Failed to load'} />;

  return (
    <>
      <div className="row end"><button className="btn primary" onClick={() => setEditing('new')}>+ Add item</button></div>
      {cats.data.map((c) => {
        const list = items.data.filter((i) => i.categoryId === c.id);
        if (!list.length) return null;
        return (
          <section key={c.id}>
            <h3>{c.name}{!c.isActive && <span className="muted"> (hidden)</span>}</h3>
            {list.map((i) => (
              <div key={i.id} className={`avail-row ${i.isActive ? '' : 'off'}`}>
                <div className="item-line">
                  {i.imageUrl ? <img className="thumb" src={i.imageUrl} alt="" /> : <div className="thumb empty-thumb" />}
                  <div>
                    <b>{i.name}</b> {i.isVeg ? '🟢' : '🔴'} <span className="muted">{rupees(i.pricePaise)} · {i.prepMinutes} min</span>
                    {!i.isActive && <span className="pill rejected"> hidden</span>}
                    {i.isPopular && <span className="pill"> popular</span>}
                  </div>
                </div>
                <button className="btn small" onClick={() => setEditing(i)}>Edit</button>
              </div>
            ))}
          </section>
        );
      })}
      {editing && <ItemForm item={editing === 'new' ? null : editing} cats={cats.data} onClose={() => setEditing(null)} />}
    </>
  );
}

function ItemForm({ item, cats, onClose }: { item: AdminItem | null; cats: AdminCategory[]; onClose: () => void }) {
  const refresh = useRefresh();
  const [name, setName] = useState(item?.name ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? cats[0]?.id ?? 0);
  const [price, setPrice] = useState(item ? paiseToText(item.pricePaise) : '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [prep, setPrep] = useState(String(item?.prepMinutes ?? 5));
  const [isVeg, setIsVeg] = useState(item?.isVeg ?? true);
  const [isPopular, setIsPopular] = useState(item?.isPopular ?? false);
  const [isActive, setIsActive] = useState(item?.isActive ?? true);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      const pricePaise = toPaise(price);
      if (pricePaise === null) throw new Error('Enter a valid price in rupees');
      const body = { name, categoryId, pricePaise, description: description.trim() || null, prepMinutes: Number(prep), isVeg, isPopular, isActive };
      const saved = item ? await patch<AdminItem>(`/admin/items/${item.id}`, body) : await post<AdminItem>('/admin/items', body);
      if (file) await uploadImage(`/admin/items/${saved.id}/image`, file);
    },
    onSuccess: async () => {
      await refresh();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Modal title={item ? `Edit ${item.name}` : 'Add item'} onClose={onClose}>
      <form onSubmit={(e: FormEvent) => (e.preventDefault(), setError(''), save.mutate())}>
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={80} required autoFocus /></Field>
        <div className="row">
          <Field label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Price (₹)"><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required /></Field>
          <Field label="Prep (min)"><input type="number" min={1} max={60} value={prep} onChange={(e) => setPrep(e.target.value)} required /></Field>
        </div>
        <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} /></Field>
        <div className="row">
          <Check label="Vegetarian" checked={isVeg} onChange={setIsVeg} />
          <Check label="Popular" checked={isPopular} onChange={setIsPopular} />
          <Check label="Visible in app" checked={isActive} onChange={setIsActive} />
        </div>
        <Field label="Photo" hint="JPEG, PNG or WebP, up to 5 MB.">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <ErrorBox message={error} />
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- combos
function CombosTab() {
  const combos = useAdminList<AdminCombo>('combos', '/admin/combos');
  const items = useAdminList<AdminItem>('items', '/admin/items');
  const [editing, setEditing] = useState<AdminCombo | 'new' | null>(null);
  if (combos.isLoading || items.isLoading) return <p className="muted">Loading…</p>;
  if (combos.isError || !combos.data || !items.data) return <ErrorBox message={(combos.error as Error)?.message ?? 'Failed to load'} />;

  return (
    <>
      <div className="row end"><button className="btn primary" onClick={() => setEditing('new')}>+ Add combo</button></div>
      {combos.data.length === 0 && <p className="muted">No combos yet.</p>}
      {combos.data.map((c) => (
        <div key={c.id} className={`avail-row ${c.isActive ? '' : 'off'}`}>
          <div>
            <b>{c.name}</b> <span className="muted">{rupees(c.pricePaise)}</span>
            {!c.isActive && <span className="pill rejected"> hidden</span>}
            <div className="muted">{c.items.map((p) => `${p.qty}× ${p.name}`).join(' + ')}</div>
          </div>
          <button className="btn small" onClick={() => setEditing(c)}>Edit</button>
        </div>
      ))}
      {editing && <ComboForm combo={editing === 'new' ? null : editing} items={items.data} onClose={() => setEditing(null)} />}
    </>
  );
}

function ComboForm({ combo, items, onClose }: { combo: AdminCombo | null; items: AdminItem[]; onClose: () => void }) {
  const refresh = useRefresh();
  const [name, setName] = useState(combo?.name ?? '');
  const [price, setPrice] = useState(combo ? paiseToText(combo.pricePaise) : '');
  const [description, setDescription] = useState(combo?.description ?? '');
  const [isActive, setIsActive] = useState(combo?.isActive ?? true);
  const [parts, setParts] = useState<{ menuItemId: number; qty: number }[]>(
    combo?.items.map((p) => ({ menuItemId: p.menuItemId, qty: p.qty })) ?? [{ menuItemId: items[0]?.id ?? 0, qty: 1 }, { menuItemId: items[1]?.id ?? 0, qty: 1 }],
  );
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      const pricePaise = toPaise(price);
      if (pricePaise === null) throw new Error('Enter a valid price in rupees');
      if (parts.length < 2) throw new Error('A combo needs at least two items');
      const body = { name, pricePaise, description: description.trim() || null, isActive, items: parts };
      const saved = combo ? await patch<AdminCombo>(`/admin/combos/${combo.id}`, body) : await post<AdminCombo>('/admin/combos', body);
      if (file) await uploadImage(`/admin/combos/${saved.id}/image`, file);
    },
    onSuccess: async () => {
      await refresh();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const setPart = (i: number, p: Partial<{ menuItemId: number; qty: number }>) => setParts(parts.map((x, idx) => (idx === i ? { ...x, ...p } : x)));

  return (
    <Modal title={combo ? `Edit ${combo.name}` : 'Add combo'} onClose={onClose}>
      <form onSubmit={(e: FormEvent) => (e.preventDefault(), setError(''), save.mutate())}>
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} minLength={2} required autoFocus /></Field>
        <div className="row">
          <Field label="Combo price (₹)"><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} required /></Field>
          <Check label="Visible in app" checked={isActive} onChange={setIsActive} />
        </div>
        <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={255} /></Field>
        <h3>Items in this combo</h3>
        {parts.map((p, i) => (
          <div key={i} className="row">
            <select className="grow" value={p.menuItemId} onChange={(e) => setPart(i, { menuItemId: Number(e.target.value) })}>
              {items.map((it) => <option key={it.id} value={it.id}>{it.name} ({rupees(it.pricePaise)})</option>)}
            </select>
            <input className="qty" type="number" min={1} max={10} value={p.qty} onChange={(e) => setPart(i, { qty: Number(e.target.value) })} />
            <button type="button" className="btn small" disabled={parts.length <= 2} onClick={() => setParts(parts.filter((_, idx) => idx !== i))}>✕</button>
          </div>
        ))}
        <button type="button" className="btn small" onClick={() => setParts([...parts, { menuItemId: items[0]?.id ?? 0, qty: 1 }])}>+ Add item</button>
        <Field label="Photo"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        <ErrorBox message={error} />
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- categories
function CategoriesTab() {
  const cats = useAdminList<AdminCategory>('categories', '/admin/categories');
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null);
  if (cats.isLoading) return <p className="muted">Loading…</p>;
  if (cats.isError || !cats.data) return <ErrorBox message={(cats.error as Error)?.message ?? 'Failed to load'} />;
  return (
    <>
      <div className="row end"><button className="btn primary" onClick={() => setEditing('new')}>+ Add category</button></div>
      {cats.data.map((c) => (
        <div key={c.id} className={`avail-row ${c.isActive ? '' : 'off'}`}>
          <div><b>{c.name}</b> <span className="muted">order {c.sortOrder}{c.icon ? ` · ${c.icon}` : ''}</span>{!c.isActive && <span className="pill rejected"> hidden</span>}</div>
          <button className="btn small" onClick={() => setEditing(c)}>Edit</button>
        </div>
      ))}
      {editing && <CategoryForm cat={editing === 'new' ? null : editing} nextOrder={cats.data.length + 1} onClose={() => setEditing(null)} />}
    </>
  );
}

function CategoryForm({ cat, nextOrder, onClose }: { cat: AdminCategory | null; nextOrder: number; onClose: () => void }) {
  const refresh = useRefresh();
  const [name, setName] = useState(cat?.name ?? '');
  const [icon, setIcon] = useState(cat?.icon ?? '');
  const [sortOrder, setSortOrder] = useState(String(cat?.sortOrder ?? nextOrder));
  const [isActive, setIsActive] = useState(cat?.isActive ?? true);
  const [error, setError] = useState('');
  const save = useMutation({
    mutationFn: () => {
      const body = { name, icon: icon || null, sortOrder: Number(sortOrder), isActive };
      return cat ? patch(`/admin/categories/${cat.id}`, body) : post('/admin/categories', body);
    },
    onSuccess: async () => {
      await refresh();
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });
  return (
    <Modal title={cat ? `Edit ${cat.name}` : 'Add category'} onClose={onClose}>
      <form onSubmit={(e: FormEvent) => (e.preventDefault(), setError(''), save.mutate())}>
        <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={40} required autoFocus /></Field>
        <div className="row">
          <Field label="Icon">
            <select value={icon} onChange={(e) => setIcon(e.target.value)}>
              <option value="">Default</option>
              {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Sort order"><input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} required /></Field>
        </div>
        <Check label="Visible in app" checked={isActive} onChange={setIsActive} />
        <ErrorBox message={error} />
        <div className="row end">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={save.isPending}>Save</button>
        </div>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- specials
function SpecialsTab() {
  const refresh = useRefresh();
  const specials = useAdminList<Special>('specials', '/admin/specials');
  const items = useAdminList<AdminItem>('items', '/admin/items');
  const combos = useAdminList<AdminCombo>('combos', '/admin/combos');
  const [date, setDate] = useState(todayStr());
  const [target, setTarget] = useState(''); // "i:12" or "c:3"
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');

  const add = useMutation({
    mutationFn: () => {
      const [kind, id] = target.split(':');
      return post('/admin/specials', { date, title: title.trim() || undefined, ...(kind === 'i' ? { menuItemId: Number(id) } : { comboId: Number(id) }) });
    },
    onSuccess: async () => {
      setTitle('');
      await refresh();
    },
    onError: (e: Error) => setError(e.message),
  });
  const remove = useMutation({ mutationFn: (id: number) => del(`/admin/specials/${id}`), onSuccess: refresh, onError: (e: Error) => setError(e.message) });

  const nameOf = (s: Special) =>
    s.menuItemId ? items.data?.find((i) => i.id === s.menuItemId)?.name : combos.data?.find((c) => c.id === s.comboId)?.name;

  return (
    <>
      <form className="card" onSubmit={(e: FormEvent) => (e.preventDefault(), setError(''), add.mutate())}>
        <h2>Add a special</h2>
        <div className="row">
          <input type="date" className="auto" value={date} min={todayStr()} onChange={(e) => setDate(e.target.value)} required />
          <select className="grow" value={target} onChange={(e) => setTarget(e.target.value)} required>
            <option value="">Choose item or combo…</option>
            <optgroup label="Items">{items.data?.map((i) => <option key={i.id} value={`i:${i.id}`}>{i.name}</option>)}</optgroup>
            <optgroup label="Combos">{combos.data?.map((c) => <option key={c.id} value={`c:${c.id}`}>{c.name}</option>)}</optgroup>
          </select>
          <input className="grow" placeholder="Label (optional), e.g. Chef's pick" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          <button className="btn primary" disabled={add.isPending}>Add</button>
        </div>
        <ErrorBox message={error} onClear={() => setError('')} />
      </form>
      <h3>Upcoming</h3>
      {specials.data?.length === 0 && <p className="muted">No specials scheduled.</p>}
      {specials.data?.map((s) => (
        <div key={s.id} className="avail-row">
          <div><b>{s.date}</b> · {nameOf(s) ?? 'Unknown'} {s.title && <span className="muted">— {s.title}</span>}</div>
          <button className="btn small" disabled={remove.isPending} onClick={() => remove.mutate(s.id)}>Remove</button>
        </div>
      ))}
    </>
  );
}
