async function proxyRequestSim({ method, url, headers, body }) {
  const reqHeaders = { ...(headers || {}) };
  
  // 1. Host Header Sanitize
  try {
    const targetUrlObj = new URL(url);
    Object.keys(reqHeaders).forEach(k => {
      if (k.toLowerCase() === 'host') {
        delete reqHeaders[k];
      }
    });
  } catch (e) {}

  // 2. Manual Redirect Handling to preserve Authorization Header on redirects
  let currentUrl = url;
  let response;
  let redirectCount = 0;
  const maxRedirects = 5;

  while (redirectCount < maxRedirects) {
    const fetchOptions = {
      method,
      headers: reqHeaders,
      body: ['GET', 'HEAD'].includes(method) ? undefined : body,
      redirect: 'manual'
    };

    response = await fetch(currentUrl, fetchOptions);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) break;
      currentUrl = new URL(location, currentUrl).toString();
      redirectCount++;
      if ((response.status === 303 || response.status === 302) && method !== 'GET' && method !== 'HEAD') {
        method = 'GET';
        body = undefined;
      }
    } else {
      break;
    }
  }

  const responseHeaders = {};
  for (const [key, value] of response.headers.entries()) { responseHeaders[key] = value; }
  let data;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try { data = await response.json(); } catch { data = await response.text(); }
  } else {
    data = await response.text();
  }
  return { status: response.status, statusText: response.statusText, headers: responseHeaders, data };
}

async function testSim() {
  console.log('=== Test 1: Calling ACC with conflicting Host header ===');
  const res1 = await proxyRequestSim({
    method: 'GET',
    url: 'https://client.stacceptance.com/locations',
    headers: {
      'Host': 'client.smartthings.com',
      'Authorization': 'Bearer test_token'
    }
  });
  console.log('Res 1 Status:', res1.status, res1.statusText);

  console.log('\n=== Test 2: Calling PROD with proxyRequestSim ===');
  const res2 = await proxyRequestSim({
    method: 'GET',
    url: 'https://client.smartthings.com/locations',
    headers: {
      'Authorization': 'Bearer test_token'
    }
  });
  console.log('Res 2 Status:', res2.status, res2.statusText);
}

testSim();
