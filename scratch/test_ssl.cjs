const https = require('https');

async function testSSL() {
  console.log('--- Testing SSL for client.smartthings.com ---');
  try {
    const res = await fetch('https://client.smartthings.com/locations');
    console.log('Prod status:', res.status);
  } catch (err) {
    console.error('Prod error:', err);
  }

  console.log('\n--- Testing SSL for client.stacceptance.com ---');
  try {
    const res = await fetch('https://client.stacceptance.com/locations');
    console.log('ACC status:', res.status);
  } catch (err) {
    console.error('ACC error:', err);
  }

  console.log('\n--- Testing raw HTTPS request with native module for ACC ---');
  const req = https.request('https://client.stacceptance.com/locations', { method: 'GET' }, (res) => {
    console.log('ACC raw status:', res.statusCode);
  });
  req.on('error', (e) => {
    console.error('ACC raw error:', e);
  });
  req.end();
}

testSSL();
