/**
 * src/api/subscriptionPayment.api.js
 *
 * Society PLAN payment via Razorpay — basic/premium subscription upgrades.
 *
 * Do not confuse this with src/api/razorpay.api.js, which is a DIFFERENT
 * flow: a resident paying their own maintenance bill, hitting
 * /maintenance/razorpay/*. This file is the SOCIETY ADMIN paying for the
 * society's PLAN (basic/premium, monthly/quarterly/halfyearly/annual),
 * hitting /payments/subscription/* — the endpoints added alongside the
 * custom per-society pricing feature on the backend.
 *
 * FLOW
 * ────
 *  1. getMyPricing()        → effective price for THIS society (custom rate
 *                              if a Super Admin set one, else standard rate)
 *  2. createOrder()         → backend creates a Razorpay Order, amount is
 *                              always computed server-side (never trust a
 *                              client-supplied amount)
 *  3. openCheckout()        → native Razorpay sheet opens with that order
 *  4. verifyPayment()       → backend verifies HMAC signature, extends the
 *                              society's Subscription, re-enables paid modules
 *  5. getHistory()          → past subscription payments, for a receipts list
 *
 * FEATURE FLAG
 * ────────────
 *  Same PAYMENTS_ENABLED flag as src/config/features.js / razorpay.api.js.
 *  Keep it false until the test-mode checklist passes for THIS flow too —
 *  it shares the Razorpay account but is a separate code path from bill payments.
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
   * POST /payments/subscription/verify
   * body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
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