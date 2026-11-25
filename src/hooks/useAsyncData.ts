import { useCallback, useEffect, useState } from 'react';
import { SupabaseNotConfiguredError } from '../lib/supabase';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
  reload: () => Promise<void>;
}

export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
  enabled = true
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState<boolean>(false);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setNotConfigured(false);
    try {
      const result = await fetcher();
      setData(result);
    } catch (err) {
      if (err instanceof SupabaseNotConfiguredError) {
        setNotConfigured(true);
      } else {
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, notConfigured, reload: load };
}
