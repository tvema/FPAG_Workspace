async function check() {
  try {
    const res = await fetch("http://localhost:3000/api/projects");
    console.log("Status:", res.status);
    const data = await res.json();
    console.log("Data:", data);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}
check();
