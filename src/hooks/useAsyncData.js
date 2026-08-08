import { useState, useEffect, useCallback } from 'react';

/**
 * Loads asynchronous data from the data client.
 * Returns { data, loading, error, reload }.
 *
 * Usage: const { data: clients, loading, reload } = useAsyncData(() => db.Client.list(), []);
 * With polling: useAsyncData(() => db.Sale.list(), [], { refreshInterval: 30000 });
 */
export default function useAsyncData(fn, deps = [], { refreshInterval } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const run = useCallback(() => {
    let active = true;
    setLoading(true);
    Promise.resolve(fn())
      .then((result) => active && setData(result))
      .catch((e) => active && setError(e))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);

  // Silent polling — re-fetches without showing a spinner
  useEffect(() => {
    if (!refreshInterval) return;
    const id = setInterval(() => {
      Promise.resolve(fn()).then((result) => setData(result)).catch(() => {});
    }, refreshInterval);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshInterval, ...deps]);

  const reload = useCallback(() => run(), [run]);

  return { data, loading, error, reload };
}
