import { fetch, ProxyAgent } from "undici";

async function run() {
  try {
    const fetchOptions: any = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 123 }),
        dispatcher: new ProxyAgent("http://127.0.0.1:8080")
    };
    
    // We expect it to fail reaching the proxy, but not with "invalid onRequestStart method"
    await fetch("https://example.com", fetchOptions);
    console.log("Success");
  } catch (err: any) {
    console.log("Error:", err.message);
  }
}

run();
