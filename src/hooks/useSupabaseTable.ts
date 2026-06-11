import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

// Own writes are echoed back via realtime; ignore them for this long.
const ECHO_WINDOW_MS = 5000;

function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === 'string' && ISO_DATE_RE.test(value) ? new Date(value) : value;
}

function parseData<T>(data: unknown): T {
  return JSON.parse(JSON.stringify(data), reviveDates) as T;
}

function diffById<T extends { id: string }>(prev: T[], next: T[]) {
  const prevById = new Map(prev.map(item => [item.id, item]));
  const nextIds = new Set(next.map(item => item.id));

  const upserts = next.filter(item => prevById.get(item.id) !== item);
  const deletes = prev.filter(item => !nextIds.has(item.id)).map(item => item.id);

  return { upserts, deletes };
}

export function useSupabaseTable<T extends { id: string }>(
  table: string,
  initialValue: T[],
  session: Session | null
): [T[], (value: T[] | ((prev: T[]) => T[])) => void, boolean] {
  const [items, setItemsState] = useState<T[]>(initialValue);
  const [loading, setLoading] = useState(true);
  const initialValueRef = useRef(initialValue);
  const recentWritesRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    supabase
      .from(table)
      .select('id,data,updated_at')
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error(`Error loading ${table}:`, error);
        } else if (data && data.length > 0) {
          setItemsState(data.map(row => parseData<T>(row.data)));
        } else {
          setItemsState(initialValueRef.current);
        }
        setLoading(false);
      });

    const channel = supabase
      .channel(`table-${table}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        payload => {
          const id = (payload.new as { id?: string })?.id ?? (payload.old as { id?: string })?.id;
          if (!id) return;

          const recentWrite = recentWritesRef.current.get(id);
          if (recentWrite && Date.now() - recentWrite < ECHO_WINDOW_MS) return;

          if (payload.eventType === 'DELETE') {
            setItemsState(prev => prev.filter(item => item.id !== id));
            return;
          }

          const item = parseData<T>((payload.new as { data: unknown }).data);
          setItemsState(prev => {
            const idx = prev.findIndex(p => p.id === id);
            if (idx === -1) return [...prev, item];
            const next = [...prev];
            next[idx] = item;
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [session, table]);

  const setItems = useCallback((value: T[] | ((prev: T[]) => T[])) => {
    setItemsState(prev => {
      const next = typeof value === 'function' ? (value as (prev: T[]) => T[])(prev) : value;
      if (!session) return next;

      const { upserts, deletes } = diffById(prev, next);
      const now = Date.now();

      if (upserts.length > 0) {
        upserts.forEach(item => recentWritesRef.current.set(item.id, now));
        const rows = upserts.map(item => ({ id: item.id, data: item, updated_at: new Date().toISOString() }));
        supabase.from(table).upsert(rows).then(({ error }) => {
          if (error) console.error(`Error upserting into ${table}:`, error);
        });
      }

      if (deletes.length > 0) {
        deletes.forEach(id => recentWritesRef.current.set(id, now));
        supabase.from(table).delete().in('id', deletes).then(({ error }) => {
          if (error) console.error(`Error deleting from ${table}:`, error);
        });
      }

      return next;
    });
  }, [session, table]);

  return [items, setItems, loading];
}

export function useSupabaseValue<T>(
  key: string,
  initialValue: T,
  session: Session | null
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [value, setValueState] = useState<T>(initialValue);
  const [loading, setLoading] = useState(true);
  const initialValueRef = useRef(initialValue);
  const recentWriteRef = useRef(0);

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    supabase
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error(`Error loading app_settings.${key}:`, error);
        } else if (data) {
          setValueState(data.value as T);
        } else {
          setValueState(initialValueRef.current);
        }
        setLoading(false);
      });

    const channel = supabase
      .channel(`app-settings-${key}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_settings', filter: `key=eq.${key}` },
        payload => {
          if (Date.now() - recentWriteRef.current < ECHO_WINDOW_MS) return;
          if (payload.eventType === 'DELETE') return;
          setValueState((payload.new as { value: T }).value);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [session, key]);

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    setValueState(prev => {
      const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
      if (session) {
        recentWriteRef.current = Date.now();
        supabase.from('app_settings').upsert({ key, value: next, updated_at: new Date().toISOString() }).then(({ error }) => {
          if (error) console.error(`Error updating app_settings.${key}:`, error);
        });
      }
      return next;
    });
  }, [session, key]);

  return [value, setValue, loading];
}
