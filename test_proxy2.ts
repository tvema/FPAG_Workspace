import { fetch as undiciFetch, ProxyAgent } from 'undici';

async function test() {
  const proxyUrl = "http://127.0.0.1:8080";
  const apiUrl = "https://example.com";
  
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hello: 'world' }),
    dispatcher: new ProxyAgent(proxyUrl)
  };
  
  try {
    console.log("Fetching with undici via proxy...");
    const response = await undiciFetch(apiUrl, options as any);
    console.log("Success?", response.status);
  } catch (err: any) {
    console.error("Caught error:", err);
  }
}
test();
