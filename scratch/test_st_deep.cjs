const https = require('https');

async function testDeep() {
  const token = 'dummy_token_test'; // test token

  const endpoints = [
    '/locations',
    '/v1/locations',
    '/locations/',
    '/v1/locations/'
  ];

  const headersVariants = [
    { name: 'Default Bearer', headers: { 'Authorization': `Bearer ${token}` } },
    { name: 'Bearer + Accept', headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } },
    { name: 'Bearer + UserAgent', headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': 'PostmanRuntime/7.29.2' } },
    { name: 'Bearer + Content-Type', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } },
    { name: 'Bearer + X-ST-Client', headers: { 'Authorization': `Bearer ${token}`, 'X-ST-Client': 'android' } },
  ];

  console.log('==== Testing Endpoint Variations ====');
  for (const ep of endpoints) {
    try {
      const resProd = await fetch(`https://client.smartthings.com${ep}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const resAcc = await fetch(`https://client.stacceptance.com${ep}`, { headers: { 'Authorization': `Bearer ${token}` } });
      console.log(`[EP: ${ep.padEnd(15)}] PROD: ${resProd.status} | ACC: ${resAcc.status}`);
    } catch (e) {
      console.error(`[EP: ${ep}] Error:`, e.message);
    }
  }

  console.log('\n==== Testing Header Variations on /locations ====');
  for (const hv of headersVariants) {
    try {
      const resProd = await fetch(`https://client.smartthings.com/locations`, { headers: hv.headers });
      const resAcc = await fetch(`https://client.stacceptance.com/locations`, { headers: hv.headers });
      console.log(`[Header: ${hv.name.padEnd(20)}] PROD: ${resProd.status} | ACC: ${resAcc.status}`);
    } catch (e) {
      console.error(`[Header: ${hv.name}] Error:`, e.message);
    }
  }
}

testDeep();
