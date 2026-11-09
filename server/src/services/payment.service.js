const crypto = require('crypto');

/**
 * Chapa Payment Service
 * Handles server-side communication with the Chapa payment gateway (test mode).
 * Official API: https://api.chapa.co/v1 or https://api.chapa.global/v1
 */

const getChapaBaseUrl = () => {
  let url = (process.env.CHAPA_BASE_URL || 'https://api.chapa.co/v1').trim().replace(/\/+$/, '');
  if (!url.endsWith('/v1')) {
    url += '/v1';
  }
  return url;
};

/**
 * Generate a unique transaction reference for an order.
 * Chapa requires tx_ref to be at most 20 characters long.
 * Format: tx-<13-digit timestamp>-<3 hex chars> = exactly 20 chars.
 *
 * @returns {string} Unique transaction reference (<= 20 characters)
 */
const generateTxRef = () => {
  const rand = crypto.randomBytes(2).toString('hex').slice(0, 3);
  return `tx-${Date.now()}-${rand}`;
};

/**
 * Initialize a Chapa hosted checkout session.
 * @param {object} params
 * @param {number} params.amount - Authoritative price in ETB
 * @param {string} [params.currency='ETB'] - Currency, default ETB
 * @param {string} params.email - Customer email
 * @param {string} [params.firstName='Customer'] - Customer first name
 * @param {string} [params.lastName=''] - Customer last name
 * @param {string} params.txRef - Unique transaction reference
 * @param {string} [params.callbackUrl] - Server-to-server webhook callback URL
 * @param {string} [params.returnUrl] - Browser return URL
 * @param {object} [params.customization] - Title/description for checkout page
 * @returns {Promise<{ checkoutUrl: string, status: string, raw: object }>}
 */
const initializeTransaction = async ({
  amount,
  currency = 'ETB',
  email,
  firstName = 'Customer',
  lastName = '',
  txRef,
  callbackUrl,
  returnUrl,
  customization,
}) => {
  const secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CHAPA_SECRET_KEY is not configured in environment variables');
  }

  const payload = {
    amount: amount.toString(),
    currency: currency.toUpperCase(),
    email: email.trim(),
    first_name: (firstName || 'Customer').trim(),
    last_name: (lastName || '').trim(),
    tx_ref: txRef,
    customization: customization || {
      title: 'Dough & Co. Pizza',
      description: 'Handcrafted Artisan Pizza Order',
    },
  };

  // Chapa API validator rejects any callback_url or return_url that does not start with https://
  if (callbackUrl && typeof callbackUrl === 'string' && callbackUrl.startsWith('https://')) {
    payload.callback_url = callbackUrl;
  }
  if (returnUrl && typeof returnUrl === 'string' && returnUrl.startsWith('https://')) {
    payload.return_url = returnUrl;
  }

  const baseUrl = getChapaBaseUrl();
  const response = await fetch(`${baseUrl}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.status !== 'success') {
    const errorMsg = data.message || `Chapa initialization failed with HTTP ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.details = data;
    throw err;
  }

  return {
    checkoutUrl: data.data?.checkout_url,
    status: data.status,
    raw: data,
  };
};

/**
 * Authoritatively verify a transaction directly with Chapa's API.
 * @param {string} txRef - The unique transaction reference
 * @returns {Promise<object>} Verified transaction details
 */
const verifyTransaction = async (txRef) => {
  const secretKey = process.env.CHAPA_SECRET_KEY;
  if (!secretKey) {
    throw new Error('CHAPA_SECRET_KEY is not configured in environment variables');
  }

  if (!txRef) {
    throw new Error('Transaction reference (txRef) is required for Chapa verification');
  }

  const baseUrl = getChapaBaseUrl();
  const url = `${baseUrl}/transaction/verify/${encodeURIComponent(txRef)}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.status !== 'success') {
    const errorMsg = data.message || `Chapa verification failed with HTTP ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.details = data;
    throw err;
  }

  const txData = data.data || {};
  return {
    status: (txData.status || '').toLowerCase(), // 'success', 'pending', 'failed'
    amount: Number(txData.amount),
    currency: (txData.currency || 'ETB').toUpperCase(),
    reference: txData.reference || txData.chapa_reference || null,
    txRef: txData.tx_ref || txRef,
    raw: txData,
  };
};

/**
 * Verify optional HMAC signature on incoming webhooks from Chapa.
 * @param {string|Buffer} rawBody - Raw body of the request
 * @param {string} signature - Value of x-chapa-signature header
 * @returns {boolean} True if signature is valid
 */
const verifyWebhookSignature = (rawBody, signature) => {
  if (!signature) return false;
  const secret = process.env.CHAPA_WEBHOOK_SECRET || process.env.CHAPA_SECRET_KEY;
  if (!secret) return false;

  const hash = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(signature));
};

module.exports = {
  generateTxRef,
  initializeTransaction,
  verifyTransaction,
  verifyWebhookSignature,
};
