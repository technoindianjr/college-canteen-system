import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { get } from '../api/client';
import type { Menu } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { enableSound, soundEnabled } from '../lib/sound';
import { useRealtime } from '../realtime/useRealtime';

export function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { connected } = useRealtime(true);
  const [sound, setSound] = useState(soundEnabled());
  const menu = useQuery({ queryKey: ['menu'], queryFn: () => get<Menu>('/menu') });
  const paused = menu.data?.ordering.paused;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Campus Canteen <span>Console</span>
        </div>
        <nav>
          <NavLink to="/" end>Orders</NavLink>
          <NavLink to="/pickup">Pickup</NavLink>
          <NavLink to="/availability">Availability</NavLink>
          <NavLink to="/today">Today</NavLink>
          {user?.role === 'admin' && (
            <>
              <span className="nav-sep" />
              <NavLink to="/admin/menu">Menu</NavLink>
              <NavLink to="/admin/users">Users</NavLink>
              <NavLink to="/admin/reports">Reports</NavLink>
              <NavLink to="/admin/orders">All orders</NavLink>
              <NavLink to="/admin/settings">Settings</NavLink>
            </>
          )}
        </nav>
        <div className="spacer" />
        {!sound && (
          <button
            className="btn small"
            onClick={() => {
              enableSound();
              setSound(true);
            }}
          >
            🔔 Enable sound
          </button>
        )}
        <span className="muted who">{user?.name ?? user?.email}</span>
        <button className="btn small ghost" onClick={logout}>Log out</button>
      </header>
      {!connected && <div className="banner danger">Reconnecting to the server… orders may be out of date.</div>}
      {paused && <div className="banner warn">App ordering is paused. Students cannot place new orders.</div>}
      <main className={location.pathname.startsWith('/admin') ? 'wide' : undefined}>
        <Outlet />
      </main>
    </div>
  );
}
