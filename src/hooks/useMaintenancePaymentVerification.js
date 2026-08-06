/**
 * hooks/useMaintenancePaymentVerification.js
 *
 * Reads the society's `paymentVerificationEnabled` flag from the backend
 * and exposes it alongside a loading state and a refresh function.
 *
 * The flag is stored on the Society document and toggled via:
 *   PATCH /maintenance/verification-status  { enabled: boolean }
 *
 * Used by:
 *   PaymentSettingsScreen  — renders the on/off switch
 *   MaintenanceScreen      — gates the queue shortcut + submit-proof CTA
 *
 * The actual write (toggle) is done directly in the screen via
 * maintenanceApi.setVerificationStatus(). This hook only handles reading.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { maintenanceApi } from "../api/resources.api";

export const useMaintenancePaymentVerification = () => {
  const [paymentVerificationEnabled, setPaymentVerificationEnabled] = useState(true);
  const [loading,                    setLoading]                    = useState(true);
  const [error,                      setError]                      = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await maintenanceApi.getPaymentSettings();
      if (!mountedRef.current) return;

      // unwrap returns { data, meta, message }
      // data = { paymentSettings, paymentVerificationEnabled }
      const enabled = result?.data?.paymentVerificationEnabled;
      setPaymentVerificationEnabled(enabled !== false);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e?.message || "Could not load verification status.");
      // Keep previous value on error rather than flipping to false
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => { fetch(); }, [fetch]);

  return {
    paymentVerificationEnabled,
    loading,
    error,
    refresh: fetch,
  };
};