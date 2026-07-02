/**
 * src/api/subscriptionPayment.api.js
 *
 * Society PLAN payment, MID-CYCLE UPGRADE, and "pick your own modules"
 * payment — all via Razorpay.
 *
 * THREE FLOWS, ONE FILE
 * ─────────────────────
 *  A) paySubscription({ plan, billingCycle, user })
 *     Buys a whole starter/professional/enterprise plan (new or renewal).
 *
 *  B) payUpgrade({ plan, billingCycle, user })
 *     Mid-cycle upgrade: credits unused days of current plan, charges delta.
 *     Call subscriptionPaymentApi.getUpgradePreview() first to show the
 *     breakdown ("Unused Starter: ₹200, You pay: ₹133") before checkout.
 *
 *  C) payForModules({ modules, user })
 *     Buys only the specific locked module(s) the admin checked.
 *     Replaces the old "Request Upgrade → wait for SA" flow entirely.
 *     Call subscriptionPaymentApi.getModulesPreview() first to show prorated price.
 *
 * All three share the same verify endpoint server-side and the same
 * success / cancelled / error return shape, so callers handle them identically.
 */

import RazorpayCheckout from "react-native-razorpay";
import client, { unwrap } from "./client";
import { isEnabled } from "../config/features";

// ─── API layer (raw HTTP calls) ───────────────────────────────────────────────

export const subscriptionPaymentApi = {
  /** GET /payments/pricing — standard price table, all plans × billing cycles */
  getStandardPricing: () => client.get("/payments/pricing").then(unwrap),

  /**
   * GET /payments/my-pricing
   * Effective prices for the logged-in society. Returns custom negotiated
   * rate when a Super Admin has set one, otherwise the standard table.
   * Use this on the Upgrade screen so societies with a pilot rate see their
   * actual price, not the public price list.
   */
  getMyPricing: () => client.get("/payments/my-pricing").then(unwrap),

  /**
   * GET /payments/upgrade/preview?plan=professional&billingCycle=monthly
   * Returns upgrade cost breakdown before the admin commits to checkout:
   *   { fromPlan, toPlan, daysLeft, totalDays,
   *     newPlanProrated, creditRupees, discountRupees,
   *     chargeRupees, renewalDate, couponCode? }
   */
  getUpgradePreview: (plan, billingCycle) =>
    client.get("/payments/upgrade/preview", { params: { plan, billingCycle } }).then(unwrap),

  /**
   * GET /payments/modules/preview?modules=visitors,maintenance
   * Returns prorated price breakdown per module before checkout:
   *   { modules, breakdown: [{module, monthlyRupees, chargedRupees}],
   *     amountRupees, isProrated, renewalDate }
   */
  getModulesPreview: (modules) =>
    client.get("/payments/modules/preview", {
      params: { modules: modules.join(",") },
    }).then(unwrap),

  /** GET /payments/subscription/history — paginated past payments */
  getHistory: (params) =>
    client.get("/payments/subscription/history", { params }).then(unwrap),

  /**
   * POST /payments/subscription/create-order
   * body: { plan: "starter"|"professional"|"enterprise",
   *         billingCycle: "monthly"|"quarterly"|"halfyearly"|"annual" }
   */
  createOrder: (plan, billingCycle) =>
    client.post("/payments/subscription/create-order", { plan, billingCycle }).then(unwrap),

  /**
   * POST /payments/upgrade/create-order
   * body: { plan: "professional"|"enterprise", billingCycle: "..." }
   * Amount = prorated new-plan cost minus unused credit from current plan.
   */
  createUpgradeOrder: (plan, billingCycle) =>
    client.post("/payments/upgrade/create-order", { plan, billingCycle }).then(unwrap),

  /**
   * POST /payments/modules/create-order
   * body: { modules: ["visitors", "maintenance", ...] }
   */
  createModulesOrder: (modules) =>
    client.post("/payments/modules/create-order", { modules }).then(unwrap),

  /**
   * POST /payments/subscription/verify
   * body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
   * Single endpoint for all three purchase types — backend branches on
   * Payment.purchaseType automatically.
   */
  verifyPayment: (payload) =>
    client.post("/payments/subscription/verify", payload).then(unwrap),
};

// ─── Shared helpers ───────────────────────────────────────────────────────────

const PLAN_LABELS = {
  starter:      "Starter",
  professional: "Professional",
  enterprise:   "Enterprise",
};

async function _openCheckout(orderData, { description, user }) {
  const options = {
    key:         orderData.keyId,
    amount:      orderData.amount,      // paise — always from backend, never computed client-side
    currency:    orderData.currency || "INR",
    order_id:    orderData.orderId,
    name:        orderData.societyName || "Society Management",
    description,
    prefill: {
      name:    user?.name  || "",
      email:   user?.email || "",
      contact: user?.phone || "",
    },
    theme: { color: "#0D7377" },
  };
  return RazorpayCheckout.open(options);
}

async function _verify(paymentData) {
  return subscriptionPaymentApi.verifyPayment({
    razorpay_order_id:   paymentData.razorpay_order_id,
    razorpay_payment_id: paymentData.razorpay_payment_id,
    razorpay_signature:  paymentData.razorpay_signature,
  });
}

function _handleError(err) {
  const cancelled = err?.code === 0 || err?.description === "User cancelled";
  return {
    success: false,
    cancelled,
    error: cancelled
      ? "Payment cancelled."
      : (err?.response?.data?.message || err?.description || "Payment failed. Please try again."),
  };
}

// ─── Flow A: Plan purchase / renewal ─────────────────────────────────────────

/**
 * Full end-to-end plan payment flow: create order → Razorpay checkout → verify.
 *
 * @param {{ plan, billingCycle, user: {name, email, phone} }} params
 * @returns {{ success, paymentId?, amountRupees?, isCustomPricing?,
 *             alreadyProcessed?, cancelled?, error? }}
 */
export async function paySubscription({ plan, billingCycle, user }) {
  if (!isEnabled("PAYMENTS_ENABLED")) {
    return { success: false, error: "Online plan payments are not enabled yet. Contact support to upgrade." };
  }

  let orderData;
  try {
    const res = await subscriptionPaymentApi.createOrder(plan, billingCycle);
    orderData = res.data;
  } catch (err) {
    return { success: false, error: err?.response?.data?.message || "Failed to create payment order." };
  }

  const planLabel = PLAN_LABELS[plan] || plan;

  try {
    const paymentData = await _openCheckout(orderData, {
      description: orderData.isCustomPricing
        ? `${planLabel} plan — special pricing`
        : `${planLabel} plan — ${billingCycle}`,
      user,
    });
    const verifyRes = await _verify(paymentData);
    return {
      success:          true,
      paymentId:        verifyRes.data?.paymentId,
      amountRupees:     orderData.amountRupees,
      isCustomPricing:  orderData.isCustomPricing,
      alreadyProcessed: verifyRes.data?.status === "paid" && verifyRes.message?.includes("already"),
    };
  } catch (err) {
    return _handleError(err);
  }
}

// ─── Flow B: Mid-cycle plan upgrade ──────────────────────────────────────────

/**
 * Mid-cycle upgrade flow. Call subscriptionPaymentApi.getUpgradePreview()
 * first to show the credit breakdown to the admin, then call this on confirm.
 *
 * @param {{ plan, billingCycle, user: {name, email, phone} }} params
 * @returns {{ success, paymentId?, amountRupees?, creditApplied?,
 *             alreadyProcessed?, cancelled?, error? }}
 */
export async function payUpgrade({ plan, billingCycle, user }) {
  if (!isEnabled("PAYMENTS_ENABLED")) {
    return { success: false, error: "Online plan payments are not enabled yet. Contact support to upgrade." };
  }

  let orderData;
  try {
    const res = await subscriptionPaymentApi.createUpgradeOrder(plan, billingCycle);
    orderData = res.data;
  } catch (err) {
    return { success: false, error: err?.response?.data?.message || "Failed to create upgrade order." };
  }

  const planLabel = PLAN_LABELS[plan] || plan;

  try {
    const paymentData = await _openCheckout(orderData, {
      description: `Upgrade to ${planLabel} — ${orderData.daysLeft ?? ""} days prorated`,
      user,
    });
    const verifyRes = await _verify(paymentData);
    return {
      success:          true,
      paymentId:        verifyRes.data?.paymentId,
      amountRupees:     orderData.amountRupees,
      creditApplied:    orderData.creditApplied,
      alreadyProcessed: verifyRes.data?.status === "paid" && verifyRes.message?.includes("already"),
    };
  } catch (err) {
    return _handleError(err);
  }
}

// ─── Flow C: Module purchase (à la carte) ────────────────────────────────────

/**
 * Full end-to-end module purchase flow. Call subscriptionPaymentApi.getModulesPreview()
 * first to show the prorated price breakdown, then call this on confirm.
 *
 * @param {{ modules: string[], user: {name, email, phone} }} params
 * @returns {{ success, paymentId?, amountRupees?, modules?,
 *             isCustomPricing?, alreadyProcessed?, cancelled?, error? }}
 */
export async function payForModules({ modules, user }) {
  if (!isEnabled("PAYMENTS_ENABLED")) {
    return { success: false, error: "Online module payments are not enabled yet. Contact support to upgrade." };
  }
  if (!modules || modules.length === 0) {
    return { success: false, error: "Select at least one module to purchase." };
  }

  let orderData;
  try {
    const res = await subscriptionPaymentApi.createModulesOrder(modules);
    orderData = res.data;
  } catch (err) {
    return { success: false, error: err?.response?.data?.message || "Failed to create payment order." };
  }

  const moduleCount = orderData.modules?.length || modules.length;

  try {
    const paymentData = await _openCheckout(orderData, {
      description: moduleCount === 1
        ? `Unlock ${orderData.modules?.[0] || modules[0]}`
        : `Unlock ${moduleCount} modules`,
      user,
    });
    const verifyRes = await _verify(paymentData);
    return {
      success:          true,
      paymentId:        verifyRes.data?.paymentId,
      amountRupees:     orderData.amountRupees,
      modules:          orderData.modules,
      isCustomPricing:  orderData.isCustomPricing,
      alreadyProcessed: verifyRes.data?.status === "paid" && verifyRes.message?.includes("already"),
    };
  } catch (err) {
    return _handleError(err);
  }
}
