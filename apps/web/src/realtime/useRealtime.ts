import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { tokenStore } from '../api/client';
import { chime } from '../lib/sound';

/** One socket for the whole console. Server events just invalidate cached queries, so the UI refetches. */
export function useRealtime(enabled: boolean) {
  const qc = useQueryClient();
  const [connected, setConnected] = useState(true);
  const [newOrderAt, setNewOrderAt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const socket = io({ auth: { token: tokenStore.get() }, transports: ['websocket', 'polling'] });
    let everConnected = false;

    socket.on('connect', () => {
      setConnected(true);
      // After a drop we may have missed events: refetch everything.
      if (everConnected) void qc.invalidateQueries();
      everConnected = true;
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', () => setConnected(false));
    socket.on('order:new', () => {
      chime();
      setNewOrderAt(Date.now());
      void qc.invalidateQueries({ queryKey: ['orders'] });
    });
    socket.on('order:updated', () => void qc.invalidateQueries({ queryKey: ['orders'] }));
    socket.on('menu:changed', () => void qc.invalidateQueries({ queryKey: ['menu'] }));
    socket.on('settings:changed', () => void qc.invalidateQueries({ queryKey: ['menu'] }));

    return () => {
      socket.close();
    };
  }, [enabled, qc]);

  return { connected, newOrderAt };
}
