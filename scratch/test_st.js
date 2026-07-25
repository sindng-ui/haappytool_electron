const fetch = globalThis.fetch || require('node-fetch');

async function test() {
  console.log('--- Test 1: No Auth ---');
  try {
    const r = await fetch('https://client.stacceptance.com/locations');
    console.log('ACC Status:', r.status, r.statusText);
  } catch(e) {
    console.error('ACC Error:', e.message);
  }

  console.log('--- Test 2: Prod vs ACC with dummy token ---');
  try {
    const r1 = await fetch('https://client.smartthings.com/locations', {
      headers: { 'Authorization': 'Bearer test_prod_token' }
    });
    console.log('PROD Status:', r1.status, r1.statusText, await r1.text());

    const r2 = await fetch('https://client.stacceptance.com/locations', {
      headers: { 'Authorization': 'Bearer test_acc_token' }
    });
    console.log('ACC Status:', r2.status, r2.statusText, await r2.text());
  } catch(e) {
    console.error('Error:', e.message);
  }
}

test();
