/**
 * src/api/subscriptionPayment.api.js
 *
 * Society PLAN payment AND "pick your own modules" payment, both via Razorpay.
 *
 * Do not confuse this with src/api/razorpay.api.js, which is a DIFFERENT
 * flow: a resident paying their own maintenance bill, hitting
 * /maintenance/razorpay/*. This file is the SOCIETY ADMIN paying for either
 * the society's whole PLAN (basic/premium) or a hand-picked set of
 * individual locked modules, hitting /payments/subscription/* and
 * /payments/modules/* respectively.
 *
 * TWO FLOWS, ONE FILE
 * ────────────────────
 *  A) paySubscription({ plan, billingCycle, user })
 *     Buys a whole basic/premium plan — unchanged from before.
 *
 *  B) payForModules({ modules, user })
 *     Buys only the specific locked module(s) the admin checked on the
 *     Upgrade screen. REPLACES the old "Request Upgrade → wait for SA to
 *     manually enable it" flow — payment success enables the module(s)
 *     immediately, no human review needed.
 *
 * Both share the same verify endpoint server-side and the same
 * success/cancelled/error return shape here, so callers handle them
 * identically.
 *
 * FEATURE FLAG
 * ────────────
 *  Same PAYMENTS_ENABLED flag as src/config/features.js / razorpay.api.js.
 *  Keep it false until the test-mode checklist passes — both flows share
 *  the Razorpay account but are separate code paths from bill payments.
 */

import RazorpayCheckout from "react-native-razorpay";
import client, { unwrap } from "./client";
import { isEnabled } from "../config/features";

export const subscriptionPaymentApi = {
  /** GET /payments/pricing — standard price table for all plans × billing cycles */
  getStandardPricing: () => client.get("/payments/pricing").then(unwrap),

  /**
   * GET /payments/my-pricing — the EFFECTIVE price for the logged-in society.
   * Returns { isCustomPricing, plan?, customMonthlyRupees?, note?, pricing }.
   * Use this instead of getStandardPricing() so a society with a negotiated
   * rate (e.g. ₹10 pilot) sees their actual price, not the generic table.
   */
  getMyPricing: () => client.get("/payments/my-pricing").then(unwrap),

  /** GET /payments/subscription/history — past payments, for a receipts list */
  getHistory: (params) => client.get("/payments/subscription/history", { params }).then(unwrap),

  /**
   * POST /payments/subscription/create-order
   * body: { plan: "basic"|"premium", billingCycle: "monthly"|"quarterly"|"halfyearly"|"annual" }
   * returns: { paymentId, orderId, amount (paise), amountRupees, currency, keyId,
   *            societyName, plan, billingCycle, isCustomPricing }
   */
  createOrder: (plan, billingCycle) =>
    client.post("/payments/subscription/create-order", { plan, billingCycle }).then(unwrap),

  /**
   * POST /payments/modules/create-order
   * body: { modules: ["visitors", "maintenance", ...] }
   * returns: { paymentId, orderId, amount (paise), amountRupees, currency, keyId,
   *            societyName, modules, breakdown: [{module, amountRupees}], isCustomPricing }
   */
  createModulesOrder: (modules) =>
    client.post("/payments/modules/create-order", { modules }).then(unwrap),

  /**
   * POST /payments/subscription/verify
   * body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
   * Same endpoint serves both plan and modules purchases — the backend's
   * Payment record already knows which one it is.
   */
  verifyPayment: (payload) =>
    client.post("/payments/subscription/verify", payload).then(unwrap),
};

/**
 * Full end-to-end flow: create order → open Razorpay checkout → verify.
 * Mirrors the shape of openRazorpayCheckout() in razorpay.api.js so callers
 * use the same success/cancelled/error pattern across both payment flows.
 *
 * @param {object} params
 * @param {"basic"|"premium"} params.plan
 * @param {"monthly"|"quarterly"|"halfyearly"|"annual"} params.billingCycle
 * @param {object} params.user   { name, email, phone } — pre-fills checkout
 *
 * @returns {{ success: boolean, paymentId?: string, amountRupees?: number,
 *             isCustomPricing?: boolean, cancelled?: boolean, error?: string }}
 */
export async function paySubscription({ plan, billingCycle, user }) {
  if (!isEnabled("PAYMENTS_ENABLED")) {
    return { success: false, error: "Online plan payments are not enabled yet. Contact support to upgrade." };
  }

  // ── Step 1: Create order — amount is computed server-side, applying this
  // society's custom rate automatically if one is set. ───────────────────────
  let orderData;
  try {
    const res = await subscriptionPaymentApi.createOrder(plan, billingCycle);
    orderData = res.data;
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to create payment order.",
    };
  }

  // ── Step 2: Open native Razorpay checkout ──────────────────────────────────
  const options = {
    key:      orderData.keyId,
    amount:   orderData.amount,        // paise, from backend — never computed client-side
    currency: orderData.currency || "INR",
    order_id: orderData.orderId,
    name:     orderData.societyName || "Society Management",
    description: orderData.isCustomPricing
      ? `${plan} plan — special pricing`
      : `${plan} plan — ${billingCycle}`,
    prefill: {
      name:    user?.name  || "",
      email:   user?.email || "",
      contact: user?.phone || "",
    },
    theme: { color: "#0D7377" },
  };

  try {
    const paymentData = await RazorpayCheckout.open(options);
    // paymentData = { razorpay_payment_id, razorpay_order_id, razorpay_signature }

    // ── Step 3: Verify signature on backend — this is what actually extends
    // the subscription. Idempotent: safe to retry if the app is killed here,
    // since the webhook is a server-to-server safety net for the same event. ──
    const verifyRes = await subscriptionPaymentApi.verifyPayment({
      razorpay_order_id:   paymentData.razorpay_order_id,
      razorpay_payment_id: paymentData.razorpay_payment_id,
      razorpay_signature:  paymentData.razorpay_signature,
    });

    return {
      success:          true,
      paymentId:        verifyRes.data?.paymentId,
      amountRupees:     orderData.amountRupees,
      isCustomPricing:  orderData.isCustomPricing,
      alreadyProcessed: verifyRes.data?.status === "paid" && verifyRes.message?.includes("already"),
    };
  } catch (err) {
    // code === 0 → user dismissed/cancelled the sheet (same convention as razorpay.api.js)
    const cancelled = err?.code === 0 || err?.description === "User cancelled";

    return {
      success:   false,
      cancelled,
      error: cancelled
        ? "Payment cancelled."
        : (err?.response?.data?.message || err?.description || "Payment failed. Please try again."),
    };
  }
}

/**
 * Full end-to-end flow for the "pick your own modules" purchase: create
 * order → open Razorpay checkout → verify. Mirrors paySubscription() above
 * exactly — same success/cancelled/error shape — except it buys a specific
 * set of locked modules instead of a whole plan, and there's no
 * billingCycle since module unlocks don't expire.
 *
 * This is what replaces the old "Request Upgrade" button entirely: instead
 * of notifying the admin's sales team and waiting, the admin pays right now
 * and the module(s) activate immediately on successful payment.
 *
 * @param {object} params
 * @param {string[]} params.modules  - e.g. ["visitors", "maintenance"]
 * @param {object}   params.user     - { name, email, phone } — pre-fills checkout
 *
 * @returns {{ success: boolean, paymentId?: string, amountRupees?: number,
 *             modules?: string[], isCustomPricing?: boolean,
 *             cancelled?: boolean, error?: string }}
 */
export async function payForModules({ modules, user }) {
  if (!isEnabled("PAYMENTS_ENABLED")) {
    return { success: false, error: "Online module payments are not enabled yet. Contact support to upgrade." };
  }

  if (!modules || modules.length === 0) {
    return { success: false, error: "Select at least one module to purchase." };
  }

  // ── Step 1: Create order — amount is computed server-side, applying this
  // society's negotiated per-module rates automatically where set. ──────────
  let orderData;
  try {
    const res = await subscriptionPaymentApi.createModulesOrder(modules);
    orderData = res.data;
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to create payment order.",
    };
  }

  // ── Step 2: Open native Razorpay checkout ──────────────────────────────────
  const moduleCount = orderData.modules?.length || modules.length;
  const options = {
    key:      orderData.keyId,
    amount:   orderData.amount,        // paise, from backend — never computed client-side
    currency: orderData.currency || "INR",
    order_id: orderData.orderId,
    name:     orderData.societyName || "Society Management",
    description: moduleCount === 1
      ? `Unlock ${orderData.modules[0]}`
      : `Unlock ${moduleCount} modules`,
    prefill: {
      name:    user?.name  || "",
      email:   user?.email || "",
      contact: user?.phone || "",
    },
    theme: { color: "#0D7377" },
  };

  try {
    const paymentData = await RazorpayCheckout.open(options);
    // paymentData = { razorpay_payment_id, razorpay_order_id, razorpay_signature }

    // ── Step 3: Verify signature on backend — this is what actually enables
    // the modules. Idempotent: safe to retry if the app is killed here,
    // since the webhook is a server-to-server safety net for the same event. ──
    const verifyRes = await subscriptionPaymentApi.verifyPayment({
      razorpay_order_id:   paymentData.razorpay_order_id,
      razorpay_payment_id: paymentData.razorpay_payment_id,
      razorpay_signature:  paymentData.razorpay_signature,
    });

    return {
      success:          true,
      paymentId:        verifyRes.data?.paymentId,
      amountRupees:     orderData.amountRupees,
      modules:          orderData.modules,
      isCustomPricing:  orderData.isCustomPricing,
      alreadyProcessed: verifyRes.data?.status === "paid" && verifyRes.message?.includes("already"),
    };
  } catch (err) {
    const cancelled = err?.code === 0 || err?.description === "User cancelled";

    return {
      success:   false,
      cancelled,
      error: cancelled
        ? "Payment cancelled."
        : (err?.response?.data?.message || err?.description || "Payment failed. Please try again."),
    };
  }
}