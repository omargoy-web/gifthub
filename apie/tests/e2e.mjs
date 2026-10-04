// Prueba de humo E2E en Chromium móvil (412×860, táctil). Uso:
//   (cd apie/server && PORT=8091 node server.js &)  ;  node apie/tests/e2e.mjs
// Requiere el paquete "playwright" disponible (global o local) y Chromium.
import fs from "node:fs";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const SP = process.env.OUT || "apie-e2e-out", B = process.env.BASE || "http://localhost:8091";
fs.mkdirSync(SP + "/shots", { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: "es-MX", timezoneId: "America/Mexico_City" });
await ctx.route(/fonts\.(googleapis|gstatic)|accounts\.google|drive\.google/, (r) => r.abort());
const page = await ctx.newPage();
page.setDefaultTimeout(8000);
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errs.push("console: " + m.text()));
const shot = (n) => page.screenshot({ path: `${SP}/shots/${n}.png` });
const step = async (name, fn) => { try { await fn(); console.log("OK  ", name); } catch (e) { console.log("FAIL", name, e.message.split("\n")[0]); errs.push(name); } };

await page.goto(B + "/index.html");
await shot("01-login");
await step("login PEMEX (modo local)", async () => {
  await page.fill("[name=user]", "539555"); await page.fill("[name=pass]", "x");
  await page.click("#pemex-form button"); await page.waitForSelector(".kpis");
});
await page.waitForTimeout(400); await shot("02-dashboard");
await page.evaluate(() => window.scrollTo(0, 900)); await page.waitForTimeout(200); await shot("02b-dashboard-metas");

await step("tareas: lista", async () => { await page.click("[data-go=tareas] >> nth=0"); await page.waitForSelector("#tl .swipe"); });
await shot("03-tareas");
const n0 = await page.locator("#tl .swipe").count();
await step("tareas: swipe derecha completa", async () => {
  const row = page.locator("#tl .swipe .row").first();
  const b = await row.boundingBox();
  await page.mouse.move(b.x + 60, b.y + b.height / 2); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + 60 + i * 20, b.y + b.height / 2);
  await page.mouse.up(); await page.waitForTimeout(500);
  const n1 = await page.locator("#tl .swipe").count();
  if (n1 !== n0 - 1) throw new Error(`esperaba ${n0 - 1}, hay ${n1}`);
});
await step("tareas: crear con FAB", async () => {
  await page.click(".fab"); await page.fill("[name=title]", "Prueba IR/IP motor GA-1101");
  await page.click("[data-p=P1]"); await page.fill("[name=tag]", "TR-SEP01-01A"); await page.dispatchEvent("[name=tag]", "change");
  await page.click("#sv"); await page.waitForTimeout(300);
  if (!(await page.locator("#tl h3", { hasText: "Prueba IR/IP" }).count())) throw new Error("no aparece");
});
await step("tareas: detalle, timer, checklist, historial", async () => {
  await page.locator("#tl .row", { hasText: "Prueba IR/IP" }).click();
  await page.waitForSelector("#tgl"); await page.click("#tgl"); await page.waitForTimeout(1100);
  await shot("04-tarea-detalle");
  await page.click("[data-tab=checklist]"); await page.fill("#nst", "Megger 5 kV 10 min"); await page.press("#nst", "Enter");
  await page.click("[data-i='0']"); await page.click("[data-tab=historial]");
  const h = await page.locator(".timeline li").count(); if (h < 4) throw new Error("historial " + h);
  await shot("05-tarea-historial");
  await page.click("[data-close]");
});
await step("tareas: vista cuadrícula + orden prioridad", async () => { await page.selectOption("#ord", "prioridad"); await page.click("#vw"); await page.waitForSelector(".grid-view"); await shot("06-tareas-grid"); await page.click("#vw"); await page.selectOption("#ord", "manual"); });

await step("agenda: mes + detalle + minuta local", async () => {
  await page.click("[data-go=agenda] >> nth=0"); await page.waitForSelector(".month");
  await shot("07-agenda-mes");
  await page.locator("#dayl [data-ev], #calv [data-ev]").first().click().catch(async () => { await page.click("[data-v=lista]"); await page.locator("[data-ev]").first().click(); });
  await page.waitForSelector("#en");
  await page.click("#tpl"); await page.fill("#en", "Se revisó ventana de libranza\nAcuerdo: libranza SE-015 el sábado 06:00\nAcción: elaborar ATS @Sergio · 2026-10-09\nAcción: confirmar transferencia de cargas @Operación");
  await page.click("[data-r=accepted]"); await page.click("#mn"); await page.waitForSelector("#mout .card");
  const m = await page.textContent("#mout .card"); if (!/ACUERDOS[\s\S]*libranza SE-015[\s\S]*ACCIONES[\s\S]*elaborar ATS — Resp\.: Sergio — Fecha: 2026-10-09/.test(m)) throw new Error("minuta mal: " + m);
  await page.locator(".sheet .body").evaluate((b) => (b.scrollTop = b.scrollHeight)); await shot("08-minuta");
  await page.click("#mt"); await page.click("[data-close]");
});
await step("agenda: semana", async () => { await page.click("[data-v=semana]"); await page.waitForSelector(".week"); await shot("09-agenda-semana"); });

await step("activos: filtro + detalle + falla", async () => {

  await page.click("[data-go=activos] >> nth=0"); await page.waitForSelector("[data-tag]");
  await page.selectOption("#ff", "motor"); await page.fill("#q", "GA"); await page.waitForTimeout(400); console.log("A3");
  await shot("10-activos");
  await page.locator("[data-tag]").first().click(); await page.waitForSelector("#ab .kv");
  await shot("11-activo-placa");
  await page.click("[data-tab=ubicacion]"); await page.click("#rf"); await page.click("[data-s=Media]");
  await page.fill("[name=sintoma]", "Vibración 7.1 mm/s RMS lado acople"); await page.click("#fsv"); await page.waitForTimeout(300);
  const f = await page.evaluate(() => Store.get("faults").length); if (f !== 1) throw new Error("faults " + f);
  await page.click("[data-tab=historial]"); await shot("12-activo-historial"); await page.click("[data-close]");
});
await step("activos: activo con historial real", async () => {
  await page.fill("#q", "PU-11701 A"); await page.selectOption("#ff", ""); await page.waitForTimeout(400);
  await page.locator("[data-tag]").first().click(); await page.click("[data-tab=historial]");
  if (!(await page.locator(".timeline li").count())) throw new Error("sin historial");
  await shot("13-historial-real"); await page.click("[data-close]"); await page.fill("#q", "");
});

await step("saber: búsqueda + doc + anotación + marcador", async () => {
  await page.click("[data-go=saber] >> nth=0"); await page.waitForSelector("[data-doc]");
  await page.fill("#q", "aislamiento"); await page.waitForTimeout(300); await shot("14-saber-busqueda");
  await page.fill("#q", ""); await page.waitForTimeout(250);
  await page.click("[data-c=SOP]"); await page.locator("[data-doc]").first().click(); await page.waitForSelector("#dv");
  await page.click("#bk"); await page.fill("#ar", "4"); await page.fill("#at", "Verificar categoría EPP 2 en CCM-2A"); await page.click("#af button");
  if (!(await page.locator("#an .card").count())) throw new Error("sin anotación");
  await shot("15-sop"); await page.click("[data-close]");
  await page.click("[data-c=Marcadores]"); if ((await page.locator("[data-doc]").count()) !== 1) throw new Error("marcador");
  await page.click(".fab.ai"); await page.waitForSelector("#chat"); await shot("16-chat"); await page.click("[data-close]");
});

await step("aprender: plan + quiz", async () => {
  await page.click("#hamb"); await page.click(".drawer [data-go=aprender]"); await page.waitForSelector(".meter");
  await shot("17-aprender");
  await page.locator("[data-qz]").first().click();
  for (let i = 0; i < 5; i++) { if (!(await page.locator("[data-k]").count())) break; await page.locator("[data-k]").first().click(); await page.click("#qn"); }
  await page.waitForSelector(".empty h3"); await shot("18-quiz-resultado"); await page.click(".sheet [data-close] >> nth=-1");
});
await step("ajustes: modo oscuro + guantes", async () => {
  await page.click("#me"); await page.click("[data-v=dark]"); await page.check("#gloves");
  await shot("19-ajustes-oscuro");
  await page.click("[data-go=inicio] >> nth=0"); await page.waitForTimeout(200); await shot("20-dashboard-oscuro");
});
await step("persistencia tras recarga", async () => {
  await page.evaluate(() => Store.flush()); await page.reload(); await page.waitForSelector(".kpis");
  const t = await page.evaluate(() => Store.get("tasks").some((x) => x.title.startsWith("Prueba IR/IP")));
  if (!t) throw new Error("tarea perdida");
});
await step("búsqueda global", async () => { await page.fill("#q", "SE-015"); await page.waitForTimeout(300); await shot("21-busqueda-global"); });

console.log(errs.length ? "ERRORES:\n" + errs.join("\n") : "Sin errores de consola");
await browser.close();
process.exit(errs.length ? 1 : 0);
