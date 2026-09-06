const express = require('express');
const cors = require('cors');
const axios = require('axios');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 8787;

// Development/test destination only.
// Do NOT use this as a production campaign configuration.
const TEST_LIGHTNING_ADDRESS =
  process.env.TEST_LIGHTNING_ADDRESS || 'fittingstretch95@walletofsatoshi.com';

// Development payment registry.
// In production this must be replaced by persistent storage.
const payments = new Map();

// Development campaign accounting.
// In production this must be replaced by persistent storage.
const campaignTotals = new Map([
  ['fatima', 650],
  ['abdul', 559],
  ['shirin', 2750]
]);

// Provider-to-server authentication boundary.
// Set this in the environment for any real provider integration.
const PAYMENT_WEBHOOK_SECRET =
  process.env.PAYMENT_WEBHOOK_SECRET || '';

app.use(cors());
app.use(express.json());

function parseLightningAddress(address) {
  if (typeof address !== 'string' || !address.includes('@')) {
    throw new Error('Invalid Lightning Address');
  }

  const [username, domain] = address.split('@');

  if (!username || !domain || address.split('@').length !== 2) {
    throw new Error('Invalid Lightning Address');
  }

  return { username, domain };
}

async function resolveLightningAddress(address) {
  const { username, domain } = parseLightningAddress(address);

  const url =
    `https://${domain}/.well-known/lnurlp/` +
    encodeURIComponent(username);

  const response = await axios.get(url, {
    timeout: 10000,
    validateStatus: () => true
  });

  if (response.status !== 200) {
    throw new Error(`Lightning Address lookup failed (${response.status})`);
  }

  const data = response.data;

  if (!data || data.tag !== 'payRequest' || !data.callback) {
    throw new Error('Invalid LNURL-pay response');
  }

  if (
    typeof data.minSendable !== 'number' ||
    typeof data.maxSendable !== 'number'
  ) {
    throw new Error('Lightning provider did not supply payment limits');
  }

  return data;
}

async function createLightningInvoice(address, amountSats) {
  const metadata = await resolveLightningAddress(address);

  const amountMsat = Math.round(Number(amountSats) * 1000);

  if (!Number.isSafeInteger(amountMsat) || amountMsat <= 0) {
    throw new Error('Invalid payment amount');
  }

  if (
    amountMsat < metadata.minSendable ||
    amountMsat > metadata.maxSendable
  ) {
    throw new Error(
      `Amount outside Lightning Address limits (${metadata.minSendable}–${metadata.maxSendable} msat)`
    );
  }

  const response = await axios.get(metadata.callback, {
    params: { amount: amountMsat },
    timeout: 10000,
    validateStatus: () => true
  });

  if (response.status !== 200) {
    throw new Error(`Lightning invoice request failed (${response.status})`);
  }

  const data = response.data;

  if (!data || typeof data.pr !== 'string' || !data.pr.startsWith('ln')) {
    throw new Error('Lightning provider did not return a valid invoice');
  }

  return {
    invoice: data.pr,
    metadata
  };
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'mannaah-payment-service',
    custody: 'non-custodial',
    lightning: 'lnurl-pay',
    bitcoin: 'not-configured'
  });
});

app.post('/api/payment/create', async (req, res) => {
  const { campaignId, amount, method } = req.body || {};

  if (!campaignId) {
    return res.status(400).json({
      error: 'campaignId is required'
    });
  }

  const amountSats = Number(amount);

  if (!Number.isFinite(amountSats) || amountSats <= 0) {
    return res.status(400).json({
      error: 'amount must be greater than zero'
    });
  }

  if (method !== 'Lightning') {
    return res.status(400).json({
      error: 'Only Lightning payments are currently enabled'
    });
  }

  // Development mapping.
  // Only Fatima is connected to the test destination.
  const destinations = {
    fatima: TEST_LIGHTNING_ADDRESS
  };

  const lightningAddress = destinations[campaignId];

  if (!lightningAddress) {
    return res.status(409).json({
      status: 'unconfigured',
      message: 'This campaign is not yet connected to a Lightning destination.'
    });
  }

  try {
    const result = await createLightningInvoice(
      lightningAddress,
      amountSats
    );

    const paymentId =
      'pay_' + Date.now().toString(36) + '_' +
      Math.random().toString(36).slice(2, 10);

    const qrDataUrl = await QRCode.toDataURL(result.invoice, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 320
    });

    payments.set(paymentId, {
      paymentId,
      campaignId,
      amount: amountSats,
      method: 'Lightning',
      lightningAddress,
      invoice: result.invoice,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    return res.json({
      status: 'ready',
      method: 'Lightning',
      paymentId,
      campaignId,
      amount: amountSats,
      lightningAddress,
      invoice: result.invoice,
      qrDataUrl,
      verification: {
        status: 'pending',
        automatic: false
      }
    });
  } catch (error) {
    console.error('Lightning payment creation failed:', error.message);

    return res.status(502).json({
      status: 'error',
      message: error.message || 'Unable to create Lightning invoice'
    });
  }
});


app.get('/api/payment/status/:paymentId', (req, res) => {
  const payment = payments.get(req.params.paymentId);

  if (!payment) {
    return res.status(404).json({
      status: 'not_found',
      message: 'Payment not found'
    });
  }

  return res.json({
    status: payment.status,
    paymentId: payment.paymentId,
    campaignId: payment.campaignId,
    amount: payment.amount,
    method: payment.method,
    invoice: payment.invoice,
    createdAt: payment.createdAt,
    verifiedAt: payment.verifiedAt || null,
    providerReference: payment.providerReference || null
  });
});

app.get('/api/campaign/:campaignId', (req, res) => {
  const campaignId = req.params.campaignId;

  if (!campaignTotals.has(campaignId)) {
    return res.status(404).json({
      status: 'not_found',
      message: 'Campaign not found'
    });
  }

  return res.json({
    campaignId,
    raised: campaignTotals.get(campaignId)
  });
});

// Provider/webhook boundary.
//
// IMPORTANT:
// This endpoint is NOT a browser-facing "mark as paid" endpoint.
// A real Lightning provider/node must authenticate the request and
// independently verify settlement before calling this endpoint.
//
// The provider must also return the exact invoice and amount that
// settled. Mannaah verifies those values against its payment registry
// before updating campaign accounting.
app.post('/api/payment/webhook', (req, res) => {
  if (!PAYMENT_WEBHOOK_SECRET) {
    return res.status(503).json({
      error: 'Payment webhook is not configured'
    });
  }

  const suppliedSecret = req.get('X-Mannaah-Webhook-Secret');

  if (
    typeof suppliedSecret !== 'string' ||
    suppliedSecret !== PAYMENT_WEBHOOK_SECRET
  ) {
    return res.status(401).json({
      error: 'Unauthorized payment webhook'
    });
  }

  const {
    paymentId,
    status,
    invoice,
    amount,
    providerReference,
    verifiedAt
  } = req.body || {};

  if (!paymentId || !invoice || !providerReference) {
    return res.status(400).json({
      error: 'paymentId, invoice and providerReference are required'
    });
  }

  if (status !== 'paid') {
    return res.status(400).json({
      error: 'Only an independently verified paid status is accepted'
    });
  }

  const payment = payments.get(paymentId);

  if (!payment) {
    return res.status(404).json({
      error: 'Payment not found'
    });
  }

  // Idempotency: never credit the same payment twice.
  if (payment.status === 'paid') {
    return res.json({
      status: 'paid',
      paymentId: payment.paymentId,
      campaignId: payment.campaignId,
      amount: payment.amount,
      verifiedAt: payment.verifiedAt,
      providerReference: payment.providerReference
    });
  }

  // The provider must prove that the settled invoice is the invoice
  // Mannaah originally created.
  if (invoice !== payment.invoice) {
    return res.status(409).json({
      error: 'Settled invoice does not match payment record'
    });
  }

  const settledAmount = Number(amount);

  if (
    !Number.isSafeInteger(settledAmount) ||
    settledAmount !== payment.amount
  ) {
    return res.status(409).json({
      error: 'Settled amount does not match payment record'
    });
  }

  payment.status = 'paid';
  payment.verifiedAt = verifiedAt || new Date().toISOString();
  payment.providerReference = String(providerReference);

  const previousTotal = campaignTotals.get(payment.campaignId) || 0;
  const newTotal = previousTotal + payment.amount;

  campaignTotals.set(payment.campaignId, newTotal);

  return res.json({
    status: 'paid',
    paymentId: payment.paymentId,
    campaignId: payment.campaignId,
    amount: payment.amount,
    campaignRaised: newTotal,
    verifiedAt: payment.verifiedAt,
    providerReference: payment.providerReference
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Mannaah payment service listening on http://0.0.0.0:${PORT}`
  );
});
