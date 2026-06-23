/**
 * src/api/razorpay.api.js
 *
 * Razorpay payment flow — frontend side only.
 * Matches the existing pattern of auth.api.js / resources.api.js.
 *
 * FLOW
 * ────
 *  1. Your backend creates a Razorpay order  →  returns { orderId, amount, currency, key }
 *  2. This file opens the native Razorpay checkout sheet with that order
 *  3. On success, the three Razorpay IDs are sent to your backend for signature verification
 *  4. Backend verifies HMAC-SHA256 signature, marks bill paid, issues receipt
 *
 * FEATURE FLAG
 * ────────────
 *  Hidden behind PAYMENTS_ENABLED = false in src/config/features.js.
 *  Flip it to true via OTA push once test-mode is fully verified.
 *  No store rebuild needed to enable payments.
 *
 * TEST CREDENTIALS (use in your backend .env)
 * ────────────────────────────────────────────
 *  RAZORPAY_KEY_ID     = rzp_test_XXXXXXXXXXXXXXXX
 *  RAZORPAY_KEY_SECRET = XXXXXXXXXXXXXXXXXXXXXXXX
 *
 *  Test card : 4111 1111 1111 1111  /  any future expiry  /  any CVV
 *  Test UPI  : success@razorpay
 *  Test wallet: any wallet option — always succeeds in test mode
 *
 * BACKEND ENDPOINTS NEEDED
 * ────────────────────────
 *  POST /api/v1/maintenance/razorpay/create-order
 *    body:    { billId, amount }          ← amount in paise  (₹500 → 50000)
 *    returns: { orderId, amount, currency, key }
 *
 *  POST /api/v1/maintenance/razorpay/verify-payment
 *    body:    { billId, razorpay_payment_id, razorpay_order_id, razorpay_signature }
 *    returns: { success, receipt }
 *
 * VERIFY THESE SCENARIOS BEFORE GOING LIVE
 * ─────────────────────────────────────────
 *  ✅ Order creation returns correct orderId + amount
 *  ✅ Checkout opens with correct prefilled user details
 *  ✅ Payment success → bill marked paid in DB → receipt generated
 *  ✅ Payment failure → no DB change → user sees error message
 *  ✅ User cancellation → dismissed cleanly → no DB change
 *  ✅ Razorpay webhook fires → backend processes it independently
 *  ✅ HMAC signature verification passes with test keys
 *  ✅ Repeat all above with live keys before releasing to users
 */

import RazorpayCheckout from "react-native-razorpay";
import client, { unwrap } from "./client";
import { isEnabled }      from "../config/features";

/**
 * Open the Razorpay checkout and handle the full payment lifecycle.
 *
 * @param {object} params
 * @param {string} params.billId       Your maintenance bill _id
 * @param {number} params.amount       Amount in paise (₹500 = 50000)
 * @param {object} params.user         { name, email, phone } — pre-fills checkout
 * @param {string} params.description  Shown on checkout sheet (e.g. "Jan 2025 Maintenance")
 *
 * @returns {{ success: boolean, paymentId?: string, receipt?: object,
 *             cancelled?: boolean, error?: string }}
 */
export async function openRazorpayCheckout({ billId, amount, user, description }) {
  if (!isEnabled("PAYMENTS_ENABLED")) {
    return { success: false, error: "Payments are not enabled yet." };
  }

  // ── Step 1: Create Razorpay order on backend ────────────────────────────────
  let orderData;
  try {
    const res = await client.post("/maintenance/razorpay/create-order", {
      billId,
      amount, // in paise
    });
    orderData = unwrap(res).data;
  } catch (err) {
    return {
      success: false,
      error: err?.response?.data?.message || "Failed to create payment order.",
    };
  }

  // ── Step 2: Open native Razorpay checkout ──────────────────────────────────
  const options = {
    key:         orderData.key,            // rzp_test_... or rzp_live_...
    amount:      orderData.amount,         // paise, comes from backend
    currency:    orderData.currency || "INR",
    order_id:    orderData.orderId,
    name:        "Society Management",
    description,
    prefill: {
      name:      user?.name  || "",
      email:     user?.email || "",
      contact:   user?.phone || "",
    },
    theme: { color: "#0D7377" },
  };

  try {
    const paymentData = await RazorpayCheckout.open(options);
    // paymentData = { razorpay_payment_id, razorpay_order_id, razorpay_signature }

    // ── Step 3: Verify signature on backend ──────────────────────────────────
    const verifyRes = await client.post("/maintenance/razorpay/verify-payment", {
      billId,
      razorpay_payment_id: paymentData.razorpay_payment_id,
      razorpay_order_id:   paymentData.razorpay_order_id,
      razorpay_signature:  paymentData.razorpay_signature,
    });
    const verified = unwrap(verifyRes).data;

    return {
      success:   true,
      paymentId: paymentData.razorpay_payment_id,
      receipt:   verified?.receipt,
    };

  } catch (err) {
    // code === 0  → user dismissed / cancelled the sheet
    // code === 1  → payment failed (bank declined, timeout, etc.)
    const cancelled =
      err?.code === 0 ||
      err?.description === "User cancelled";

    return {
      success:   false,
      cancelled,
      error: cancelled
        ? "Payment cancelled."
        : (err?.description || "Payment failed. Please try again."),
    };
  }
}