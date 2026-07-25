const https = require('https');

async function testCombinations() {
  const headersList = [
    { name: 'Standard Json', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } },
    { name: 'With User-Agent', headers: { 'User-Agent': 'SmartThings/1.7.0', 'Accept': 'application/json' } },
    { name: 'With X-ST-Client', headers: { 'X-ST-Client': 'android', 'Accept': 'application/json' } },
    { name: 'With Origin prod', headers: { 'Origin': 'https://client.smartthings.com', 'Accept': 'application/json' } },
    { name: 'With Origin acc', headers: { 'Origin': 'https://client.stacceptance.com', 'Accept': 'application/json' } },
    { name: 'With Host prod', headers: { 'Host': 'client.smartthings.com', 'Accept': 'application/json' } },
    { name: 'With Host acc', headers: { 'Host': 'client.stacceptance.com', 'Accept': 'application/json' } },
  ];

  for (const item of headersList) {
    console.log(`\n=== Testing: ${item.name} ===`);
    try {
      const res1 = await fetch('https://client.smartthings.com/locations', { headers: item.headers });
      console.log(`[PROD] Status: ${res1.status} ${res1.statusText}`);
    } catch(e) {
      console.log(`[PROD] Error: ${e.message}`);
    }

    try {
      const res2 = await fetch('https://client.stacceptance.com/locations', { headers: item.headers });
      console.log(`[ACC ] Status: ${res2.status} ${res2.statusText}`);
    } catch(e) {
      console.log(`[ACC ] Error: ${e.message}`);
    }
  }
}

testCombinations();
