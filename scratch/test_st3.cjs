async function testHostHeader() {
  console.log('--- Test 1: Invalid Host header ---');
  try {
    const res = await fetch('https://client.stacceptance.com/locations', {
      headers: {
        'Host': 'client.smartthings.com'
      }
    });
    console.log('Status with wrong Host header:', res.status);
  } catch (err) {
    console.error('Error with wrong Host header:', err);
  }

  console.log('\n--- Test 2: Invalid Header names/values ---');
  try {
    const res = await fetch('https://client.stacceptance.com/locations', {
      headers: {
        'Authorization': 'Bearer test',
        'X-Forward-To': 'https://api.stacceptance.com'
      }
    });
    console.log('Status with X-Forward-To header:', res.status, await res.text());
  } catch (err) {
    console.error('Error with X-Forward-To:', err);
  }
}

testHostHeader();
