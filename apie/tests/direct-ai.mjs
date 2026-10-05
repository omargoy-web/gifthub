// Verifica el modo DIRECTO del asistente en el HTML único abierto desde file:// (API de Claude simulada).
//   node apie/tests/direct-ai.mjs   (PLAYWRIGHT_MODULE / CHROMIUM como en e2e.mjs)
import path from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const file = "file://" + path.resolve(process.env.BUNDLE || "apie/dist/apie.html");
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await (await browser.newContext({ viewport: { width: 412, height: 860 }, hasTouch: true, isMobile: true })).newPage();
page.setDefaultTimeout(8000);
const errs = []; page.on("pageerror", (e) => errs.push(e.message));
let seen = null;
await page.route("https://api.anthropic.com/**", async (r) => {
  seen = { headers: r.request().headers(), body: JSON.parse(r.request().postData()) };
  await r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ stop_reason: "end_turn", content: [{ type: "text", text: "PI mínimo clase F: 2.0 (IEEE 43)." }] }) });
});
await page.goto(file);
await page.fill("[name=user]", "1"); await page.fill("[name=pass]", "x"); await page.click("#pemex-form button"); await page.waitForSelector(".kpis");
await page.click("#me"); await page.fill("#aikey", "sk-ant-api03-PRUEBA1234567890"); await page.click("#aisave");
await page.click("[data-go=saber] >> nth=0"); await page.click(".fab.ai"); await page.fill("#ci", "PI mínimo clase F?"); await page.press("#ci", "Enter");
await page.waitForFunction(() => /IEEE 43/.test(document.querySelector("#chat").textContent));
const checks = [
  ["x-api-key", seen.headers["x-api-key"] === "sk-ant-api03-PRUEBA1234567890"],
  ["browser-access", seen.headers["anthropic-dangerous-direct-browser-access"] === "true"],
  ["modelo", seen.body.model === "claude-opus-5-5"],
  ["thinking adaptativo", seen.body.thinking.type === "adaptive"],
  ["último mensaje usuario", seen.body.messages.at(-1).role === "user"],
  ["sin errores de página", errs.length === 0],
];
for (const [n, ok] of checks) console.log(ok ? "OK  " : "FAIL", n);
await browser.close();
process.exit(checks.every((c) => c[1]) ? 0 : 1);
