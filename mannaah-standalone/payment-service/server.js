require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const QRCode = require('qrcode');
const { finalizeEvent, nip19 } = require('nostr-tools');

const app = express();
const PORT = process.env.PORT || 8787;

// Development/test destination only.
// Do NOT use this as a production campaign configuration.
const TEST_LIGHTNING_ADDRESS =
  process.env.TEST_LIGHTNING_ADDRESS || 'fittingstretch95@walletofsatoshi.com';

// Development payment registry.
// In production this must be replaced by persistent storage.
const payments = new Map();

// Blockchain outputs already credited during this service lifetime.
// Production should persist this registry.
const settledBitcoinOutputs = new Set();

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

const BTCPAY_URL = (process.env.BTCPAY_URL || '').replace(/\/$/, '');
const BTCPAY_STORE_ID = process.env.BTCPAY_STORE_ID || '';
const BTCPAY_API_KEY = process.env.BTCPAY_API_KEY || '';

// Bitcoin on-chain verification.
// The blockchain is the source of truth for Bitcoin settlement.
const BITCOIN_EXPLORER_URL =
  (process.env.BITCOIN_EXPLORER_URL || 'https://blockstream.info/api').replace(/\/$/, '');

const BITCOIN_CONFIRMATIONS_REQUIRED =
  Math.max(1, Number.parseInt(
    process.env.BITCOIN_CONFIRMATIONS_REQUIRED || '1',
    10
  ) || 1);

// Campaign receiving addresses.
// These are public addresses only; no private keys belong in this service.
const bitcoinDestinations = {
  fatima: process.env.FATIMA_BTC_ADDRESS || '',
  abdul: process.env.ABDUL_BTC_ADDRESS || '',
  shirin: process.env.SHIRIN_BTC_ADDRESS || ''
};


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

function getBitcoinAddress(campaignId) {
  const address = bitcoinDestinations[campaignId];

  if (!address) {
    throw new Error(
      'This campaign is not yet connected to a Bitcoin destination.'
    );
  }

  return address;
}

async function getBitcoinAddressTransactions(address) {
  const response = await axios.get(
    `${BITCOIN_EXPLORER_URL}/address/${encodeURIComponent(address)}/txs`,
    {
      timeout: 10000,
      validateStatus: () => true
    }
  );

  if (response.status !== 200) {
    throw new Error(
      `Bitcoin explorer transaction lookup failed (${response.status})`
    );
  }

  if (!Array.isArray(response.data)) {
    throw new Error('Bitcoin explorer returned an invalid transaction list');
  }

  return response.data;
}

async function getBitcoinTransaction(txid) {
  const response = await axios.get(
    `${BITCOIN_EXPLORER_URL}/tx/${encodeURIComponent(txid)}`,
    {
      timeout: 10000,
      validateStatus: () => true
    }
  );

  if (response.status !== 200) {
    throw new Error(
      `Bitcoin transaction lookup failed (${response.status})`
    );
  }

  return response.data;
}

function getTransactionConfirmations(transaction, tipHeight) {
  if (!transaction || !transaction.status) {
    return 0;
  }

  if (!transaction.status.confirmed) {
    return 0;
  }

  if (
    !Number.isSafeInteger(transaction.status.block_height) ||
    !Number.isSafeInteger(tipHeight)
  ) {
    return 0;
  }

  return Math.max(
    0,
    tipHeight - transaction.status.block_height + 1
  );
}

async function getBitcoinTipHeight() {
  const response = await axios.get(
    `${BITCOIN_EXPLORER_URL}/blocks/tip/height`,
    {
      timeout: 10000,
      validateStatus: () => true
    }
  );

  if (response.status !== 200) {
    throw new Error(
      `Bitcoin explorer tip lookup failed (${response.status})`
    );
  }

  const height = Number(response.data);

  if (!Number.isSafeInteger(height) || height <= 0) {
    throw new Error('Bitcoin explorer returned an invalid tip height');
  }

  return height;
}

/*
 * Verify Bitcoin settlement from the blockchain.
 *
 * We deliberately do NOT trust:
 * - the browser
 * - a client-supplied "paid" flag
 * - a client-supplied txid
 *
 * We discover transactions from the configured campaign address,
 * verify the destination output, then track confirmations.
 */
async function verifyBitcoinPayment(payment) {
  const transactions =
    await getBitcoinAddressTransactions(payment.bitcoinAddress);

  const tipHeight = await getBitcoinTipHeight();

  for (const transactionSummary of transactions) {
    if (!transactionSummary || typeof transactionSummary.txid !== 'string') {
      continue;
    }

    const transaction = await getBitcoinTransaction(
      transactionSummary.txid
    );

    if (!transaction || !Array.isArray(transaction.vout)) {
      continue;
    }

    // Do not associate an already-confirmed transaction from before
    // this payment intent was created.
    if (
      transaction.status &&
      transaction.status.confirmed &&
      Number.isSafeInteger(transaction.status.block_time)
    ) {
      const transactionTime = transaction.status.block_time * 1000;
      const paymentCreatedAt = Date.parse(payment.createdAt);

      if (
        Number.isFinite(paymentCreatedAt) &&
        transactionTime < paymentCreatedAt
      ) {
        continue;
      }
    }

    let matchingOutput = null;

    for (let vout = 0; vout < transaction.vout.length; vout += 1) {
      const output = transaction.vout[vout];

      if (!output || !output.scriptpubkey_address) {
        continue;
      }

      if (output.scriptpubkey_address !== payment.bitcoinAddress) {
        continue;
      }

      const valueSats = Number(output.value);

      if (!Number.isSafeInteger(valueSats) || valueSats <= 0) {
        continue;
      }

      matchingOutput = {
        vout,
        valueSats
      };

      break;
    }

    if (!matchingOutput) {
      continue;
    }

    const confirmations =
      getTransactionConfirmations(transaction, tipHeight);

    const providerReference =
      `${transaction.txid}:${matchingOutput.vout}`;

    if (settledBitcoinOutputs.has(providerReference)) {
      continue;
    }

    return {
      found: true,
      txid: transaction.txid,
      vout: matchingOutput.vout,
      amount: matchingOutput.valueSats,
      confirmations,
      providerReference,
      confirmed: confirmations >= BITCOIN_CONFIRMATIONS_REQUIRED,
      blockHeight:
        transaction.status && transaction.status.confirmed
          ? transaction.status.block_height
          : null
    };
  }

  return {
    found: false
  };
}

async function checkBitcoinPayment(payment) {
  try {
    const result = await verifyBitcoinPayment(payment);

    if (!result.found) {
      return;
    }

    payment.confirmations = result.confirmations;
    payment.txid = result.txid;
    payment.vout = result.vout;
    payment.blockHeight = result.blockHeight;
    payment.providerReference = result.providerReference;
    payment.detectedAt =
      payment.detectedAt || new Date().toISOString();

    if (!result.confirmed) {
      payment.status = 'detected';
      return;
    }

    // Idempotency: blockchain polling may discover the same output
    // repeatedly. Only the first settled observation credits it.
    if (payment.status === 'settled' || payment.credited) {
      return;
    }

    payment.status = 'settled';
    payment.verifiedAt = new Date().toISOString();
    payment.amountReceived = result.amount;

    // Claim the exact blockchain output before updating accounting.
    settledBitcoinOutputs.add(result.providerReference);

    const previousTotal =
      campaignTotals.get(payment.campaignId) || 0;

    const newTotal =
      previousTotal + result.amount;

    campaignTotals.set(payment.campaignId, newTotal);

    payment.credited = true;
    payment.campaignRaised = newTotal;

    console.log(
      `Bitcoin payment settled: ${payment.paymentId} ` +
      `${payment.amount} sats ` +
      `${payment.txid}:${payment.vout} ` +
      `campaign=${payment.campaignId}`
    );
  } catch (error) {
    console.error(
      `Bitcoin verification failed for ${payment.paymentId}:`,
      error.message
    );
  }
}

async function pollBitcoinPayments() {
  const bitcoinPayments = Array.from(payments.values())
    .filter(
      payment =>
        payment.method === 'Bitcoin' &&
        payment.status !== 'settled' &&
        !payment.credited
    );

  for (const payment of bitcoinPayments) {
    await checkBitcoinPayment(payment);
  }
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'mannaah-payment-service',
    custody: 'non-custodial',
    lightning: 'lnurl-pay',
    bitcoin: Object.values(bitcoinDestinations).some(Boolean)
      ? 'configured'
      : 'not-configured',
    bitcoinConfirmationsRequired: BITCOIN_CONFIRMATIONS_REQUIRED
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

  if (method !== 'Lightning' && method !== 'Bitcoin') {
    return res.status(400).json({
      error: 'Unsupported payment method'
    });
  }

  // Bitcoin on-chain payment path.
  // The server selects the campaign destination; the browser cannot
  // substitute another address.
  if (method === 'Bitcoin') {
    try {
      const bitcoinAddress = getBitcoinAddress(campaignId);

      const paymentId =
        'pay_' + Date.now().toString(36) + '_' +
        Math.random().toString(36).slice(2, 10);

      payments.set(paymentId, {
        paymentId,
        campaignId,
        amount: amountSats,
        method: 'Bitcoin',
        bitcoinAddress,
        status: 'pending',
        confirmations: 0,
        credited: false,
        createdAt: new Date().toISOString()
      });

      return res.json({
        status: 'ready',
        method: 'Bitcoin',
        paymentId,
        campaignId,
        amount: amountSats,
        bitcoinAddress,
        verification: {
          status: 'pending',
          automatic: true,
          confirmationsRequired: BITCOIN_CONFIRMATIONS_REQUIRED
        }
      });
    } catch (error) {
      return res.status(409).json({
        status: 'unconfigured',
        message: error.message
      });
    }
  }

  // Temporary launch configuration.
  // Fatima uses a real Lightning Address.
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
    amountReceived:
      Number.isSafeInteger(payment.amountReceived)
        ? payment.amountReceived
        : null,
    method: payment.method,
    invoice: payment.invoice || null,
    bitcoinAddress: payment.bitcoinAddress || null,
    txid: payment.txid || null,
    vout: Number.isInteger(payment.vout) ? payment.vout : null,
    confirmations: payment.confirmations || 0,
    blockHeight: payment.blockHeight || null,
    createdAt: payment.createdAt,
    verifiedAt: payment.verifiedAt || null,
    providerReference: payment.providerReference || null,
    campaignRaised: payment.campaignRaised || null
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

// Bitcoin settlement observer.
// Polling is intentionally simple for the MVP. It can later be replaced
// or supplemented with a persistent indexer/webhook architecture.
const BITCOIN_POLL_INTERVAL_MS = 15000;

setInterval(() => {
  pollBitcoinPayments().catch(error => {
    console.error('Bitcoin payment polling failed:', error.message);
  });
}, BITCOIN_POLL_INTERVAL_MS);

app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Mannaah payment service listening on http://0.0.0.0:${PORT}`
  );
});
