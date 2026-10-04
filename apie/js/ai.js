/* Cliente del asistente IA. Habla SOLO con el proxy propio (apie/server), que
   valida la sesión Google, aplica el prompt de sistema y guarda la API key.
   El navegador nunca ve credenciales de Anthropic. */
(function () {
  const CFG = window.APIE_CONFIG || {};
  let available = null;

  async function probe() {
    if (!CFG.aiEndpoint || location.protocol === "file:") return (available = false);
    try {
      const r = await fetch(CFG.aiEndpoint.replace(/\/chat$/, "/health"), { cache: "no-store" });
      available = r.ok && (await r.json()).ai === true;
    } catch (e) { available = false; }
    return available;
  }

  // messages: [{role:'user'|'assistant', content:string}], context: texto del documento/activo/reunión.
  async function chat(messages, { context = "", mode = "asistente" } = {}) {
    if (available === null) await probe();
    if (!available) throw new Error("Asistente IA no disponible: el proxy apie/server no está configurado o no hay red.");
    const headers = { "Content-Type": "application/json" };
    const t = G.token();
    if (t) headers.Authorization = "Bearer " + t;
    const r = await fetch(CFG.aiEndpoint, { method: "POST", headers, body: JSON.stringify({ messages, context, mode }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || `Proxy IA ${r.status}`);
    return d.text;
  }

  window.AI = { probe, chat, isAvailable: () => available === true };
})();
