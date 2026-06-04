/**
 * hooks/useApi.js
 * Generic async API hook — identical logic to web version.
 * No DOM dependencies; works in React Native without changes.
 *
 * Usage:
 *   const { data, loading, error, execute } = useApi(issuesApi.getAll);
 *   useEffect(() => { execute({ status: "Open" }); }, []);
 *
 * Or fire immediately on mount:
 *   const { data, loading, error, refetch } = useFetch(issuesApi.getAll, [{ limit: 10 }]);
 */
import { useState, useCallback, useRef, useEffect } from "react";

/**
 * useApi
 * Wraps any async API function with loading / error / data state.
 *
 * @param {Function} apiFn         - The API method to call, e.g. issuesApi.getAll
 * @param {Object}   opts
 * @param {boolean}  opts.immediate   - Fire on mount with initialArgs
 * @param {any[]}    opts.initialArgs - Args passed on immediate call
 */
export const useApi = (apiFn, { immediate = false, initialArgs = [] } = {}) => {
  const [data,    setData]    = useState(null);
  const [meta,    setMeta]    = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error,   setError]   = useState(null);

  // Track mount status so we never call setState after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(async (...args) => {
    if (!mountedRef.current) return;
    setLoading(true);
    setError(null);
    try {
      const result = await apiFn(...args);
      if (!mountedRef.current) return;
      setData(result.data);
      setMeta(result.meta ?? null);
      return result;
    } catch (err) {
      if (!mountedRef.current) return;
      const message =
        err.response?.data?.message || err.message || "Something went wrong";
      setError(message);
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [apiFn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire immediately on mount if requested
  useEffect(() => {
    if (immediate) execute(...initialArgs);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, meta, loading, error, execute, setData };
};

/**
 * useFetch
 * Convenience wrapper: fires immediately on mount, re-fires when deps change.
 * Exposes `refetch` to manually re-trigger.
 *
 * @param {Function} apiFn  - API method
 * @param {any[]}    args   - Arguments passed to apiFn
 * @param {any[]}    deps   - Dependency array that re-triggers the call
 */
export const useFetch = (apiFn, args = [], deps = []) => {
  const { data, meta, loading, error, execute, setData } = useApi(apiFn);

  useEffect(() => {
    execute(...args);
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    data,
    meta,
    loading,
    error,
    refetch:  () => execute(...args),
    setData,
  };
};