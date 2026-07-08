import puppeteer from 'puppeteer';

(async () => {
  try {
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    console.log("Launched successfully!");
    await browser.close();
  } catch (err) {
    console.error("Failed:", err);
  }
})();
