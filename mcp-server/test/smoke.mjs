// Pruebas de humo del servidor MCP (Fase 0). Ejecutar: node test/smoke.mjs
// Requiere Node 18+ (solo para pruebas; el servidor real corre en Cloudflare).
import assert from 'node:assert/strict';
import worker from '../worker.js';

const TOKEN = 'token-de-prueba-0123456789abcdef';
const HOST = 'https://ejemplo.workers.dev';
const H = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };

const open = { SILENT: '1' };
const secured = { SILENT: '1', AUTH_TOKEN: TOKEN };

const call = (env, path, body, headers = H, method = 'POST') =>
  worker.fetch(new Request(HOST + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
const rpc = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) });

let passed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  ok  ', name);
  } catch (e) {
    console.error('  FALLA', name, '\n       ', e.message);
    process.exitCode = 1;
  }
}

await test('GET /health responde JSON con fase 0', async () => {
  const r = await worker.fetch(new Request(HOST + '/health'), open);
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.fase, 0);
  assert.deepEqual(j.herramientas, ['ping', 'eco']);
});

await test('GET / devuelve HTML sin filtrar el token', async () => {
  const r = await worker.fetch(new Request(HOST + '/'), secured);
  const t = await r.text();
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.ok(!t.includes(TOKEN));
});

await test('GET /privacidad existe (requisito para apps personalizadas)', async () => {
  const r = await worker.fetch(new Request(HOST + '/privacidad'), open);
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Política de privacidad/);
});

await test('initialize negocia la versión pedida si es soportada', async () => {
  const r = await call(open, '/mcp', rpc(1, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'x', version: '1' } }));
  const j = await r.json();
  assert.equal(j.result.protocolVersion, '2025-03-26');
  assert.ok(j.result.capabilities.tools);
  assert.equal(j.result.serverInfo.name, 'asistente-ing-fase0');
});

await test('initialize con versión desconocida responde la más reciente soportada', async () => {
  const r = await call(open, '/mcp', rpc(1, 'initialize', { protocolVersion: '2099-01-01' }));
  assert.equal((await r.json()).result.protocolVersion, '2025-06-18');
});

await test('notifications/initialized devuelve 202 sin cuerpo', async () => {
  const r = await call(open, '/mcp', { jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(r.status, 202);
  assert.equal(await r.text(), '');
});

await test('tools/list expone ping y eco con anotaciones de solo lectura', async () => {
  const j = await (await call(open, '/mcp', rpc(2, 'tools/list'))).json();
  assert.deepEqual(j.result.tools.map((t) => t.name), ['ping', 'eco']);
  for (const t of j.result.tools) {
    assert.equal(t.annotations.readOnlyHint, true);
    assert.equal(t.annotations.destructiveHint, false);
    assert.equal(t.inputSchema.type, 'object');
  }
});

await test('tools/call ping devuelve pong y contenido estructurado', async () => {
  const j = await (await call(open, '/mcp', rpc(3, 'tools/call', { name: 'ping', arguments: {} }))).json();
  assert.equal(j.result.isError, false);
  assert.equal(j.result.structuredContent.mensaje, 'pong');
  assert.equal(j.result.structuredContent.autenticacion, 'abierto');
  assert.ok(!Number.isNaN(Date.parse(j.result.structuredContent.hora_utc)));
  assert.equal(JSON.parse(j.result.content[0].text).ok, true);
});

await test('tools/call eco devuelve texto, longitud y mayúsculas', async () => {
  const j = await (await call(open, '/mcp', rpc(4, 'tools/call', { name: 'eco', arguments: { texto: 'motor 15 HP' } }))).json();
  assert.deepEqual(j.result.structuredContent, { texto: 'motor 15 HP', longitud: 11, mayusculas: 'MOTOR 15 HP' });
});

await test('eco sin argumento → error de herramienta (isError), no de protocolo', async () => {
  const j = await (await call(open, '/mcp', rpc(5, 'tools/call', { name: 'eco', arguments: {} }))).json();
  assert.equal(j.result.isError, true);
  assert.equal(j.error, undefined);
});

await test('eco con más de 500 caracteres → isError', async () => {
  const j = await (await call(open, '/mcp', rpc(6, 'tools/call', { name: 'eco', arguments: { texto: 'a'.repeat(501) } }))).json();
  assert.equal(j.result.isError, true);
});

await test('herramienta desconocida → error JSON-RPC -32602', async () => {
  const j = await (await call(open, '/mcp', rpc(7, 'tools/call', { name: 'no_existe', arguments: {} }))).json();
  assert.equal(j.error.code, -32602);
});

await test('método desconocido → -32601', async () => {
  const j = await (await call(open, '/mcp', rpc(8, 'foo/bar'))).json();
  assert.equal(j.error.code, -32601);
});

await test('ping del protocolo devuelve {}', async () => {
  const j = await (await call(open, '/mcp', rpc(9, 'ping'))).json();
  assert.deepEqual(j.result, {});
});

await test('resources/list y prompts/list responden vacío (clientes laxos)', async () => {
  assert.deepEqual((await (await call(open, '/mcp', rpc(10, 'resources/list'))).json()).result, { resources: [] });
  assert.deepEqual((await (await call(open, '/mcp', rpc(11, 'prompts/list'))).json()).result, { prompts: [] });
});

await test('JSON inválido → 400 con -32700', async () => {
  const r = await worker.fetch(new Request(HOST + '/mcp', { method: 'POST', headers: H, body: '{no es json' }), open);
  assert.equal(r.status, 400);
  assert.equal((await r.json()).error.code, -32700);
});

await test('lote (batch): responde solo a las peticiones, no a las notificaciones', async () => {
  const r = await call(open, '/mcp', [rpc(20, 'tools/list'), { jsonrpc: '2.0', method: 'notifications/initialized' }, rpc(21, 'ping')]);
  const j = await r.json();
  assert.equal(j.length, 2);
  assert.deepEqual(j.map((x) => x.id), [20, 21]);
});

await test('GET /mcp → 405 (sin flujo SSE en Fase 0)', async () => {
  const r = await call(open, '/mcp', undefined, { accept: 'text/event-stream' }, 'GET');
  assert.equal(r.status, 405);
  assert.match(r.headers.get('allow'), /POST/);
});

await test('cuerpo mayor de 64 KB → 413', async () => {
  const r = await call(open, '/mcp', { jsonrpc: '2.0', id: 1, method: 'ping', params: { x: 'a'.repeat(70000) } });
  assert.equal(r.status, 413);
});

await test('con AUTH_TOKEN: sin token → 401 con WWW-Authenticate', async () => {
  const r = await call(secured, '/mcp', rpc(1, 'ping'));
  assert.equal(r.status, 401);
  assert.match(r.headers.get('www-authenticate'), /Bearer/);
});

await test('con AUTH_TOKEN: token incorrecto → 401', async () => {
  const r = await call(secured, '/mcp/otro-token', rpc(1, 'ping'));
  assert.equal(r.status, 401);
});

await test('con AUTH_TOKEN: token en la ruta → 200 y modo "token"', async () => {
  const r = await call(secured, `/mcp/${TOKEN}`, rpc(1, 'tools/call', { name: 'ping', arguments: {} }));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).result.structuredContent.autenticacion, 'token');
});

await test('con AUTH_TOKEN: Authorization Bearer → 200', async () => {
  const r = await call(secured, '/mcp', rpc(1, 'ping'), { ...H, authorization: `Bearer ${TOKEN}` });
  assert.equal(r.status, 200);
});

await test('ORIGIN_STRICT=1 rechaza Origin no listado y acepta el listado', async () => {
  const env = { SILENT: '1', ORIGIN_STRICT: '1', ALLOWED_ORIGINS: 'https://ok.example' };
  assert.equal((await call(env, '/mcp', rpc(1, 'ping'), { ...H, origin: 'https://malo.example' })).status, 403);
  assert.equal((await call(env, '/mcp', rpc(1, 'ping'), { ...H, origin: 'https://ok.example' })).status, 200);
  assert.equal((await call(env, '/mcp', rpc(1, 'ping'))).status, 200); // sin Origin (servidor a servidor)
});

await test('/.well-known/oauth-* → 404 (se registra: indica si Spark exige OAuth)', async () => {
  const r = await worker.fetch(new Request(HOST + '/.well-known/oauth-protected-resource'), open);
  assert.equal(r.status, 404);
});

await test('los registros no contienen el token', async () => {
  const lines = [];
  const orig = console.log;
  console.log = (s) => lines.push(String(s));
  try {
    await call({ AUTH_TOKEN: TOKEN }, `/mcp/${TOKEN}`, rpc(1, 'tools/call', { name: 'ping', arguments: {} }));
    await call({ AUTH_TOKEN: TOKEN }, '/mcp/incorrecto', rpc(1, 'ping'));
    await worker.fetch(new Request(`${HOST}/otra/${TOKEN}`), { AUTH_TOKEN: TOKEN });
    await worker.fetch(new Request(`${HOST}/.well-known/oauth-protected-resource/mcp/${TOKEN}`), { AUTH_TOKEN: TOKEN });
  } finally {
    console.log = orig;
  }
  assert.ok(lines.length > 0);
  assert.ok(lines.every((l) => !l.includes(TOKEN)), 'el token apareció en un registro');
  assert.ok(lines.some((l) => l.includes('/.well-known/oauth-protected-resource/mcp/***')), 'se perdió la señal de descubrimiento OAuth');
});

console.log(`\n${passed} pruebas correctas${process.exitCode ? ' (HAY FALLAS)' : ''}`);
