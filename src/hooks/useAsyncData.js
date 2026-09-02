import { useState, useEffect, useCallback, useRef } from 'react';

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
  // achado F21: guarda a função de cancelamento da chamada em voo mais
  // recente. O useEffect abaixo já recebe essa função de volta e a chama
  // sozinho quando `run` muda de identidade — mas reload() (chamado depois
  // de quase toda mutação, em toda tela) descartava esse retorno, então
  // duas chamadas em sequência rápida nunca se cancelavam: se a resposta
  // mais velha chegasse depois da mais nova, ela sobrescrevia o dado bom
  // sem erro nenhum. Agora toda chamada cancela a anterior antes de começar.
  const cancelPrevious = useRef(null);

  const run = useCallback(() => {
    if (cancelPrevious.current) cancelPrevious.current();
    let active = true;
    const cancel = () => { active = false; };
    cancelPrevious.current = cancel;
    setLoading(true);
    Promise.resolve(fn())
      .then((result) => active && setData(result))
      .catch((e) => active && setError(e))
      .finally(() => active && setLoading(false));
    return cancel;
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
