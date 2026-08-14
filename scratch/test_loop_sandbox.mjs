import dotenv from 'dotenv';
import crypto from 'crypto';
dotenv.config();

const key = process.env.LOOP_CONSUMER_KEY;
const secret = process.env.LOOP_CONSUMER_SECRET;
const till = process.env.LOOP_MERCHANT_TILL || '133239';
const secretKey = process.env.LOOP_SECRET_KEY;
const baseUrl = process.env.LOOP_BASE_URL || 'https://sandbox.loop.co.ke';

const authHeader = 'Basic ' + Buffer.from(key + ':' + secret).toString('base64');

function generateLoopSignature({ merchantTill, timestamp, nonce, secretKey }) {
  const canonicalString = `${merchantTill}|${timestamp}|${nonce}`;
  return crypto
    .createHmac('sha256', secretKey)
    .update(canonicalString, 'utf-8')
    .digest('hex')
    .toLowerCase();
}

async function testPayment() {
  const tokenRes = await fetch(baseUrl + '/gateway/auth/1.0/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const tokenData = await tokenRes.json();
  const token = tokenData.access_token;
  console.log('Got token:', token.slice(0, 20) + '...');

  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const nonce = crypto.randomUUID().toLowerCase();
  const signature = generateLoopSignature({
    merchantTill: till,
    timestamp,
    nonce,
    secretKey
  });

  const payload = {
    serviceCode: 'NEO_MRCHNT_RTP',
    txnReference: 'TEST_IDEMP_' + Date.now(),
    requestParameters: {
      merchantTill: till,
      mobileNo: '254704540384',
      amount: '10.00',
      reason: 'Sandbox Test',
      callBackUrl: 'https://sandbox.unipay.co.ke/api/v1/webhooks/loop',
      timestamp,
      nonce,
      signature,
    },
  };

  const url = baseUrl + '/gateway/loop-prompt/2/services/process-request';
  console.log('Sending to URL:', url);
  console.log('Payload:', JSON.stringify(payload, null, 2));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Type': 'application/json',
        'X-Loop-Version': '2024-01',
      },
      body: JSON.stringify(payload),
    });

    console.log('Response Status:', res.status);
    const body = await res.text();
    console.log('Response Body:', body);
  } catch (err) {
    console.error('Request Error:', err);
  }
}
testPayment();
