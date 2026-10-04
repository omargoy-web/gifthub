import { test } from "node:test";
import assert from "node:assert/strict";
import { validateChat, buildRequest, server } from "../server.js";

test("validateChat acepta conversación alternada", () => {
  assert.equal(validateChat({ messages: [{ role: "user", content: "hola" }, { role: "assistant", content: "ok" }, { role: "user", content: "IP mínimo clase F?" }] }), null);
});
test("validateChat rechaza roles fuera de orden y modo inválido", () => {
  assert.match(validateChat({ messages: [{ role: "assistant", content: "x" }] }), /rol inválido/);
  assert.match(validateChat({ messages: [{ role: "user", content: "x" }], mode: "root" }), /mode/);
  assert.match(validateChat({ messages: [{ role: "user", content: "x".repeat(20001) }] }), /20,000/);
});
test("buildRequest usa modelo, thinking adaptativo, fallbacks y contexto como datos", () => {
  const r = buildRequest({ messages: [{ role: "user", content: "x" }], context: "TAG M-1", mode: "minuta" });
  assert.equal(r.model, "claude-opus-5-5");
  assert.deepEqual(r.thinking, { type: "adaptive" });
  assert.equal(r.fallbacks, "default");
  assert.deepEqual(r.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(r.output_config.effort, "medium");
  assert.equal(r.system.length, 3);
  assert.match(r.system[2].text, /<contexto>/);
});
test("HTTP: health, chat sin sesión, pemex 501, traversal bloqueado", async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const h = await (await fetch(base + "/api/health")).json();
    assert.equal(typeof h.ai, "boolean");
    const c = await fetch(base + "/api/chat", { method: "POST", body: "{}" });
    assert.ok([401, 503].includes(c.status));
    assert.equal((await fetch(base + "/api/auth/pemex", { method: "POST" })).status, 501);
    assert.equal((await fetch(base + "/server/server.js")).status, 404);
    assert.equal((await fetch(base + "/%2e%2e/README.md")).status, 404);
    assert.equal((await fetch(base + "/")).status, 200);
  } finally { server.close(); }
});
