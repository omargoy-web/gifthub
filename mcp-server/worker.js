/**
 * ASISTENTE-ING · Servidor MCP · FASE 0 (prueba de humo)
 *
 * Objetivo único: comprobar que Gemini Spark puede (1) alcanzar esta URL,
 * (2) negociar el protocolo MCP y (3) listar y llamar herramientas.
 *
 * - Un solo archivo, sin dependencias, sin build: se pega tal cual en el editor
 *   de Cloudflare Workers (o se despliega con wrangler).
 * - No almacena ni devuelve datos de ninguna clase. Las herramientas son inocuas.
 * - Transporte: MCP "Streamable HTTP", endpoint POST /mcp (respuesta JSON).
 *
 * Variables (Settings > Variables and Secrets en Cloudflare):
 *   AUTH_TOKEN      (secreto, recomendado) exige /mcp/<token> o "Authorization: Bearer <token>".
 *   ORIGIN_STRICT   ("1" = rechaza peticiones con cabecera Origin no listada).
 *   ALLOWED_ORIGINS (lista separada por comas, solo si ORIGIN_STRICT=1).
 *   SILENT          ("1" = sin registros; lo usan las pruebas).
 */

const SERVER_INFO = { name: 'asistente-ing-fase0', version: '0.1.0' };
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const MAX_BODY_BYTES = 64 * 1024;

const TOOLS = [
  {
    name: 'ping',
    title: 'Ping de verificación',
    description:
      'Prueba de conectividad del servidor ASISTENTE-ING. No recibe datos y no ' +
      'modifica nada. Devuelve "pong", la hora UTC del servidor y el modo de autenticación.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    outputSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        mensaje: { type: 'string' },
        hora_utc: { type: 'string' },
        servidor: { type: 'string' },
        version: { type: 'string' },
        autenticacion: { type: 'string' },
      },
      required: ['ok', 'mensaje', 'hora_utc'],
    },
    annotations: {
      title: 'Ping de verificación',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'eco',
    title: 'Eco de texto',
    description:
      'Devuelve el texto recibido, su longitud y la versión en mayúsculas. Sirve solo para ' +
      'comprobar que los argumentos viajan correctamente de Spark al servidor. No guarda nada.',
    inputSchema: {
      type: 'object',
      properties: {
        texto: { type: 'string', maxLength: 500, description: 'Texto de prueba (máx. 500 caracteres).' },
      },
      required: ['texto'],
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: {
        texto: { type: 'string' },
        longitud: { type: 'integer' },
        mayusculas: { type: 'string' },
      },
      required: ['texto', 'longitud', 'mayusculas'],
    },
    annotations: {
      title: 'Eco de texto',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];

const INSTRUCTIONS =
  'Servidor de pruebas (Fase 0). Herramientas: ping y eco. No contiene datos. ' +
  'Usa "ping" para confirmar la conexión.';

export default {
  async fetch(request, env) {
    try {
      return await route(request, env || {});
    } catch (err) {
      log(env, { evt: 'error', msg: String((err && err.message) || err) });
      return json({ error: 'internal_error' }, 500);
    }
  },
};

/* ------------------------------ enrutado ------------------------------ */

async function route(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (path === '/' && request.method === 'GET') return healthPage(request, env);
  if (path === '/health' && request.method === 'GET') return json(healthInfo(request, env));
  if (path === '/privacidad' && request.method === 'GET') return html(PRIVACY_HTML);

  if (path === '/mcp' || path.startsWith('/mcp/')) return handleMcp(request, env, path);

  // Spark o cualquier cliente puede pedir descubrimiento OAuth: lo registramos
  // porque es la señal clave de si exige OAuth (Fase 1).
  log(env, { evt: 'other', method: request.method, path: maskPath(path), ...meta(request) });
  return json({ error: 'not_found' }, 404);
}

async function handleMcp(request, env, path) {
  const origin = request.headers.get('origin');
  const pathToken = path.length > 5 ? safeDecode(path.slice(5)) : '';
  const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const expected = env.AUTH_TOKEN || '';
  const authMode = expected ? 'token' : 'abierto';

  if (env.ORIGIN_STRICT === '1' && origin) {
    const allowed = String(env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!allowed.includes(origin)) {
      log(env, { evt: 'origin_rechazado', origin, ...meta(request) });
      return json({ error: 'origin_not_allowed' }, 403);
    }
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } });
  }
  if (request.method !== 'POST') {
    log(env, { evt: 'metodo_no_permitido', method: request.method, ...meta(request) });
    return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST, OPTIONS' });
  }

  if (expected) {
    const ok = (await safeEqual(pathToken, expected)) || (await safeEqual(bearer, expected));
    if (!ok) {
      log(env, { evt: 'no_autorizado', tiene_bearer: Boolean(bearer), tiene_token_ruta: Boolean(pathToken), ...meta(request) });
      return json({ error: 'unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer realm="asistente-ing"' });
    }
  }

  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    log(env, { evt: 'json_invalido', ...meta(request) });
    return json(rpcError(null, -32700, 'Parse error'), 400);
  }

  const batch = Array.isArray(payload);
  const messages = batch ? payload : [payload];
  if (messages.length === 0) return json(rpcError(null, -32600, 'Invalid Request'), 400);

  const responses = [];
  for (const msg of messages) {
    const res = await handleMessage(msg, env, request, authMode);
    if (res) responses.push(res);
  }

  // Solo notificaciones o respuestas del cliente: sin contenido.
  if (responses.length === 0) return new Response(null, { status: 202 });
  return json(batch ? responses : responses[0]);
}

/* --------------------------- protocolo JSON-RPC --------------------------- */

async function handleMessage(msg, env, request, authMode) {
  if (!msg || typeof msg !== 'object' || msg.jsonrpc !== '2.0') {
    return rpcError(msg && msg.id !== undefined ? msg.id : null, -32600, 'Invalid Request');
  }
  const hasId = msg.id !== undefined && msg.id !== null;

  // Respuesta del cliente a una petición nuestra (no enviamos ninguna): se ignora.
  if (!('method' in msg)) return null;

  log(env, {
    evt: 'rpc',
    rpc: msg.method,
    id: hasId ? msg.id : undefined,
    cliente: msg.method === 'initialize' ? msg.params && msg.params.clientInfo : undefined,
    version_cliente: msg.method === 'initialize' ? msg.params && msg.params.protocolVersion : undefined,
    herramienta: msg.method === 'tools/call' ? msg.params && msg.params.name : undefined,
    auth: authMode,
    ...meta(request),
  });

  // Notificación (sin id): nunca se responde.
  if (!hasId) return null;

  switch (msg.method) {
    case 'initialize': {
      const asked = msg.params && msg.params.protocolVersion;
      const protocolVersion = SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0];
      return rpcResult(msg.id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case 'ping':
      return rpcResult(msg.id, {});
    case 'tools/list':
      return rpcResult(msg.id, { tools: TOOLS });
    case 'tools/call':
      return callTool(msg, authMode);
    case 'resources/list':
      return rpcResult(msg.id, { resources: [] });
    case 'resources/templates/list':
      return rpcResult(msg.id, { resourceTemplates: [] });
    case 'prompts/list':
      return rpcResult(msg.id, { prompts: [] });
    default:
      return rpcError(msg.id, -32601, `Method not found: ${String(msg.method)}`);
  }
}

function callTool(msg, authMode) {
  const params = msg.params || {};
  const args = params.arguments || {};

  if (params.name === 'ping') {
    const out = {
      ok: true,
      mensaje: 'pong',
      hora_utc: new Date().toISOString(),
      servidor: SERVER_INFO.name,
      version: SERVER_INFO.version,
      autenticacion: authMode,
    };
    return rpcResult(msg.id, toolResult(out));
  }

  if (params.name === 'eco') {
    if (typeof args.texto !== 'string') {
      return rpcResult(msg.id, toolError('El argumento "texto" es obligatorio y debe ser texto.'));
    }
    if (args.texto.length > 500) {
      return rpcResult(msg.id, toolError('El argumento "texto" excede 500 caracteres.'));
    }
    const out = { texto: args.texto, longitud: args.texto.length, mayusculas: args.texto.toUpperCase() };
    return rpcResult(msg.id, toolResult(out));
  }

  return rpcError(msg.id, -32602, `Unknown tool: ${String(params.name)}`);
}

function toolResult(obj) {
  return {
    content: [{ type: 'text', text: JSON.stringify(obj) }],
    structuredContent: obj,
    isError: false,
  };
}

function toolError(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}

const rpcResult = (id, result) => ({ jsonrpc: '2.0', id, result });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

/* ------------------------------- utilidades ------------------------------- */

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Comparación en tiempo constante (vía resúmenes SHA-256). */
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(String(a))),
    crypto.subtle.digest('SHA-256', enc.encode(String(b))),
  ]);
  const x = new Uint8Array(ha);
  const y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0 && String(a).length === String(b).length;
}

const KNOWN_SEGMENTS = new Set([
  '.well-known',
  'oauth-protected-resource',
  'oauth-authorization-server',
  'openid-configuration',
  'mcp',
]);

/** Enmascara todo segmento largo que no sea un nombre conocido (puede ser el token). */
function maskPath(path) {
  return path
    .split('/')
    .map((seg) => (KNOWN_SEGMENTS.has(seg) || seg.length <= 16 ? seg : '***'))
    .join('/');
}

/** Metadatos de diagnóstico: nunca incluye el token ni el cuerpo completo. */
function meta(request) {
  const h = request.headers;
  const cf = request.cf || {};
  return {
    ua: h.get('user-agent') || undefined,
    origin: h.get('origin') || undefined,
    accept: h.get('accept') || undefined,
    ctype: h.get('content-type') || undefined,
    mcp_version: h.get('mcp-protocol-version') || undefined,
    pais: cf.country || undefined,
    colo: cf.colo || undefined,
  };
}

function log(env, obj) {
  if (env && env.SILENT === '1') return;
  console.log(JSON.stringify({ t: new Date().toISOString(), ...obj }));
}

function healthInfo(request, env) {
  return {
    ok: true,
    servidor: SERVER_INFO.name,
    version: SERVER_INFO.version,
    fase: 0,
    autenticacion: env.AUTH_TOKEN ? 'token' : 'abierto (sin AUTH_TOKEN: solo para pruebas)',
    endpoint_mcp: env.AUTH_TOKEN ? '/mcp/<AUTH_TOKEN>' : '/mcp',
    versiones_protocolo: SUPPORTED_VERSIONS,
    herramientas: TOOLS.map((t) => t.name),
  };
}

/* --------------------------------- páginas --------------------------------- */

function healthPage(request, env) {
  const info = healthInfo(request, env);
  const modo = env.AUTH_TOKEN
    ? 'Protegido con token.'
    : '<strong>ADVERTENCIA:</strong> sin AUTH_TOKEN, cualquiera con la URL puede llamar al servidor. Configura el secreto.';
  return html(`<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ASISTENTE-ING · Fase 0</title>
<style>
  :root{color-scheme:light dark;--bg:#f6f7f9;--fg:#1b1f24;--card:#fff;--bd:#d8dde3;--ac:#0b57d0}
  @media(prefers-color-scheme:dark){:root{--bg:#14171a;--fg:#e8ebef;--card:#1d2126;--bd:#343a41;--ac:#8ab4f8}}
  body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 system-ui,sans-serif}
  main{max-width:720px;margin:0 auto;padding:24px 16px}
  .card{background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:16px;margin:16px 0}
  h1{font-size:1.4rem;margin:0 0 4px} h2{font-size:1.05rem;margin:0 0 8px}
  input{width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--bd);border-radius:8px;background:var(--bg);color:var(--fg)}
  button{margin-top:8px;padding:10px 16px;border:0;border-radius:8px;background:var(--ac);color:#fff;font-weight:600;cursor:pointer}
  pre{background:var(--bg);border:1px solid var(--bd);border-radius:8px;padding:12px;overflow:auto;white-space:pre-wrap;word-break:break-word}
  code{word-break:break-all}
</style></head><body><main>
<h1>ASISTENTE-ING · Servidor MCP</h1>
<p>Fase 0 (prueba de humo) · v${info.version} · ${modo}</p>
<div class="card"><h2>Estado</h2>
<pre>${escapeHtml(JSON.stringify(info, null, 2))}</pre></div>
<div class="card"><h2>Probar el servidor desde aquí</h2>
<p>Escribe tu AUTH_TOKEN (queda solo en esta página; no se guarda). Déjalo vacío si no configuraste uno.</p>
<input id="tok" type="password" autocomplete="off" placeholder="AUTH_TOKEN">
<button id="go" type="button">Probar ping</button>
<pre id="out">Resultado…</pre></div>
<p><a href="/privacidad">Política de privacidad</a></p>
<script>
document.getElementById('go').onclick = async () => {
  const out = document.getElementById('out');
  const tok = document.getElementById('tok').value.trim();
  const url = tok ? '/mcp/' + encodeURIComponent(tok) : '/mcp';
  out.textContent = 'Consultando…';
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {'content-type': 'application/json', 'accept': 'application/json, text/event-stream'},
      body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'tools/call', params: {name: 'ping', arguments: {}}})
    });
    out.textContent = 'HTTP ' + r.status + '\\n' + (await r.text());
  } catch (e) { out.textContent = 'Error de red: ' + e; }
};
</script></main></body></html>`);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const PRIVACY_HTML = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Política de privacidad · ASISTENTE-ING</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:680px;margin:0 auto;padding:24px 16px}
@media(prefers-color-scheme:dark){body{background:#14171a;color:#e8ebef}}</style></head><body>
<h1>Política de privacidad</h1>
<p><strong>Servicio:</strong> ASISTENTE-ING, servidor MCP de uso personal (Fase 0 de pruebas).</p>
<h2>Qué datos trata</h2>
<p>En esta fase el servidor no almacena datos del usuario ni contenido de conversaciones. Las herramientas
disponibles (ping y eco) solo devuelven lo que reciben o la hora del servidor.</p>
<h2>Registros técnicos</h2>
<p>La plataforma de alojamiento puede conservar registros de conexión (fecha, método, cabeceras técnicas y
país de origen) con fines de diagnóstico. Estos registros no incluyen el token de acceso ni el contenido de las herramientas.</p>
<h2>Terceros</h2>
<p>No se comparten datos con terceros. El servicio se aloja en Cloudflare.</p>
<h2>Contacto</h2>
<p>Servicio de uso personal; el contacto es el propietario de esta instancia.</p>
</body></html>`;
