import { fetch as undiciFetch, ProxyAgent } from 'undici';

async function testApiChat2() {
  try {
    const res = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "gemini_server",
        messages: [{ role: "user", content: "hello" }],
        apiKey: "fake_key",
        proxy: "http://127.0.0.1:4000" // some random proxy
      })
    });
    console.log("Status:", res.status);
    console.log("Body:", await res.text());
  } catch (err) {
    console.error("Fetch err:", err);
  }
}
testApiChat2();
