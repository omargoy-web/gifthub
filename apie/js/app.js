/* Shell: arranque, inicio de sesión, navegación (pestañas + menú hamburguesa),
   barra de búsqueda por pantalla, FAB, jalar-para-sincronizar, ajustes y chat IA. */
(function () {
  const { icon, esc, $, $$, toast, sheet, confirm } = UI;
  const CFG = window.APIE_CONFIG || {};
  const Screens = (window.Screens = window.Screens || {});

  const TABS = [
    ["inicio", "Inicio", "home"], ["tareas", "Tareas", "tasks"], ["agenda", "Agenda", "cal"],
    ["activos", "Activos", "asset"], ["saber", "Saber", "book"],
  ];
  const DRAWER = [...TABS, ["aprender", "Centro de aprendizaje", "learn"], ["ajustes", "Ajustes", "gear"]];
  const state = { route: "inicio", q: {} };

  // ── Preferencias visuales (modo campo) ──
  function applyPrefs() {
    const p = Store.get("prefs", {});
    const r = document.documentElement;
    p.theme && p.theme !== "auto" ? r.setAttribute("data-theme", p.theme) : r.removeAttribute("data-theme");
    r.toggleAttribute("data-gloves", !!p.gloves); if (p.gloves) r.setAttribute("data-gloves", "1");
    r.toggleAttribute("data-contrast", !!p.contrast); if (p.contrast) r.setAttribute("data-contrast", "1");
  }

  // ── Login ──
  function renderLogin() {
    document.body.classList.remove("drawer-open");
    $("#app").innerHTML = `
    <div class="login">
      <div class="brand"><div class="logo"><svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg></div>
        <div><h1>APIE</h1><p>Asistente de Productividad para Ingenieros Eléctricos<br>SICM · Refinería Olmeca</p></div></div>
      <form id="pemex-form" autocomplete="on" novalidate>
        <label class="field"><span>Ficha o usuario PEMEX</span><input name="user" required autocomplete="username" inputmode="text" placeholder="Ej. 539555"></label>
        <label class="field"><span>Contraseña de red</span><input name="pass" type="password" required autocomplete="current-password"></label>
        <button class="btn primary" style="width:100%">${icon("shield")} Entrar con credenciales PEMEX</button>
        <p class="honest" id="pemex-note" ${CFG.pemexAuthEndpoint ? 'hidden' : ''}>Sin backend corporativo configurado: entra en modo local (los datos solo viven en este equipo).</p>
      </form>
      <div class="or">o</div>
      <button class="btn gbtn" id="gbtn" type="button">
        <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.9 6.1C12.4 13.7 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.5 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-10l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>
        Iniciar sesión con Google</button>
      <p class="legal">Al continuar aceptas el <a href="legal.html#terminos">Aviso de términos de uso</a> y el <a href="legal.html#privacidad">Aviso de privacidad</a>.<br>Uso exclusivo para personal autorizado.</p>
    </div>`;

    $("#pemex-form").onsubmit = async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const user = String(f.get("user") || "").trim();
      if (!user || !f.get("pass")) return toast("Captura usuario y contraseña");
      const btn = e.target.querySelector("button"); btn.disabled = true;
      try {
        let profile = null;
        if (CFG.pemexAuthEndpoint && location.protocol !== "file:") {
          const r = await fetch(CFG.pemexAuthEndpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user, pass: f.get("pass") }) }).catch(() => null);
          if (r && r.ok) profile = await r.json();
          else if (r && r.status !== 501 && r.status !== 404) throw new Error((await r.json().catch(() => ({}))).error || "Credenciales inválidas");
        }
        // 501/404/sin red = backend corporativo no implementado → modo local explícito.
        if (!profile) profile = { name: `Ficha ${user}`, email: "", provider: "local", ficha: user };
        startSession(profile);
      } catch (err) { toast(err.message); } finally { btn.disabled = false; }
    };
    $("#gbtn").onclick = async () => {
      if (!G.configured()) return toast("Google OAuth no configurado (js/config.js → googleClientId)");
      try { startSession(await G.signIn()); } catch (err) { toast(err.message); }
    };
  }

  function startSession(profile) {
    Store.set("session", { ...profile, since: new Date().toISOString() });
    if (!Store.get("tasks")) Store.set("tasks", Data.seedTasks());
    if (!Store.get("events")) Store.set("events", Data.seedEvents());
    renderShell();
    toast(`Bienvenido, ${profile.provider === "local" ? profile.name : profile.name.split(" ")[0]}`);
  }

  async function logout() {
    if (!(await confirm({ title: "¿Cerrar sesión?", text: "Tus datos locales se conservan en este equipo. Para borrarlos usa Ajustes → Borrar datos locales.", ok: "Cerrar sesión", danger: false }))) return;
    G.signOut();
    Store.set("session", null);
    await Store.flush();
    location.hash = "";
    renderLogin();
  }

  // ── Shell ──
  function renderShell() {
    const s = Store.get("session");
    const initials = (s.name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
    $("#app").innerHTML = `
      <header class="topbar">
        <button class="icon-btn" id="hamb" aria-label="Abrir menú">${icon("menu")}</button>
        <h1 id="title">APIE</h1>
        <button class="icon-btn" id="syncb" aria-label="Sincronizar">${icon("sync")}<i class="badge-dot hidden" id="outbox-dot"></i></button>
        <button class="icon-btn" id="me" aria-label="Perfil y ajustes"><span class="avatar">${s.picture ? `<img src="${esc(s.picture)}" alt="" referrerpolicy="no-referrer">` : esc(initials)}</span></button>
      </header>
      <div class="searchbar" id="sb"><label>${icon("search")}<span class="sr">Buscar</span><input id="q" type="search" enterkeyhint="search" autocomplete="off"></label></div>
      <div class="ptr" id="ptr"></div>
      <main id="view" tabindex="-1"></main>
      <nav class="tabbar" aria-label="Secciones principales">${TABS.map(([id, l, ic]) => `<button data-go="${id}">${icon(ic)}<span>${l}</span></button>`).join("")}</nav>
      <div class="drawer-scrim" id="scrim"></div>
      <aside class="drawer" aria-label="Menú">
        <header><strong>${esc(s.name)}</strong><small>${esc(s.email || (s.ficha ? "Ficha " + s.ficha : ""))} · ${s.provider === "google" ? "Google" : s.provider === "pemex" ? "PEMEX" : "Modo local"}</small></header>
        <nav>${DRAWER.map(([id, l, ic]) => `<button data-go="${id}">${icon(ic)}${l}</button>`).join("")}<hr>
          <button id="chatb">${icon("bot")}Asistente IA</button><button id="outb">${icon("out")}Cerrar sesión</button></nav>
      </aside>
      <div id="fabs"></div>`;
    $("#hamb").onclick = () => document.body.classList.add("drawer-open");
    $("#scrim").onclick = () => document.body.classList.remove("drawer-open");
    $("#me").onclick = () => go("ajustes");
    $("#outb").onclick = () => { document.body.classList.remove("drawer-open"); logout(); };
    $("#chatb").onclick = () => { document.body.classList.remove("drawer-open"); openChat({}); };
    $$("[data-go]").forEach((b) => (b.onclick = () => { document.body.classList.remove("drawer-open"); go(b.dataset.go); }));
    $("#syncb").onclick = () => syncAll(true);
    $("#q").addEventListener("input", UI.debounce(() => { state.q[state.route] = $("#q").value; render(true); }, 160));
    UI.pullToRefresh(document.body, $("#ptr"), () => syncAll(false));
    route();
  }

  function go(r) { if (location.hash !== "#/" + r) location.hash = "#/" + r; else route(); }
  function route() {
    const r = (location.hash.match(/^#\/(\w+)/) || [])[1];
    state.route = Screens[r] ? r : "inicio";
    const scr = Screens[state.route];
    $("#title").textContent = scr.title;
    $$("[data-go]").forEach((b) => b.setAttribute("aria-current", b.dataset.go === state.route ? "page" : "false"));
    const sb = $("#sb");
    sb.classList.toggle("hidden", !scr.search);
    $("#q").placeholder = scr.search || "";
    $("#q").value = state.q[state.route] || "";
    window.scrollTo(0, 0);
    render();
  }

  function render(fromSearch) {
    const scr = Screens[state.route];
    const view = $("#view");
    scr.render(view, state.q[state.route] || "", { fromSearch });
    const fabs = $("#fabs");
    fabs.innerHTML = "";
    (scr.fabs ? scr.fabs() : []).forEach((f, i) => {
      const b = document.createElement("button");
      b.className = "fab" + (f.ai ? " ai" : "") + (i > 0 ? " second" : "");
      b.setAttribute("aria-label", f.label); b.title = f.label;
      b.innerHTML = icon(f.icon);
      b.onclick = f.run;
      fabs.append(b);
    });
    updateOutboxDot();
  }

  function updateOutboxDot() {
    const pend = Store.get("faults", []).some((f) => !f.synced);
    const d = $("#outbox-dot"); if (d) d.classList.toggle("hidden", !pend);
  }

  // ── Sincronización (pull-to-refresh / botón) ──
  async function syncAll(verbose) {
    const msgs = [];
    if (!G.connected()) {
      if (verbose) toast(G.configured() ? "Conecta Google en Ajustes para sincronizar" : "Modo local: nada que sincronizar");
      render(); return;
    }
    try {
      const pend = Store.get("faults", []).filter((f) => !f.synced);
      if (pend.length && G.sheetConfigured()) {
        await G.appendRows("Fallas", pend.map(Screens.activos.faultRow));
        Store.update("faults", [], (fs) => fs.map((f) => (f.synced ? f : { ...f, synced: new Date().toISOString() })));
        msgs.push(`${pend.length} falla(s) → Sheets`);
      }
      const n = await Screens.agenda.pull();
      msgs.push(`${n} evento(s) de Calendar`);
    } catch (e) { msgs.push("Error: " + e.message); }
    toast(msgs.join(" · "));
    render();
  }

  // ── Ajustes ──
  Screens.ajustes = {
    title: "Ajustes",
    render(v) {
      const s = Store.get("session"), p = Store.get("prefs", {});
      const outbox = Store.get("faults", []).filter((f) => !f.synced).length;
      v.innerHTML = `
        <h2 class="section">Cuenta</h2>
        <div class="card"><h3>${esc(s.name)}</h3><div class="meta">${esc(s.email || "")} · ${s.provider === "google" ? "Google" : s.provider === "pemex" ? "Directorio PEMEX" : "Modo local"}</div></div>
        <h2 class="section">Integraciones</h2>
        <div class="card">
          <div class="meta" style="justify-content:space-between"><span>${icon("drive")} Google (Calendar · Drive · Sheets)</span>
            <span class="pill ${G.connected() ? "st-normal" : "st-sin_dx"}">${G.connected() ? icon("check") + "Conectado" : !G.configured() ? "No configurado" : "Desconectado"}</span></div>
          ${G.configured() ? `<div class="btn-row"><button class="btn ${G.connected() ? "" : "primary"}" id="gconn">${G.connected() ? "Reconectar" : "Conectar Google"}</button>${G.connected() ? `<button class="btn ghost" id="gdis">Desconectar</button>` : ""}</div>`
            : `<p class="honest">Define <code>googleClientId</code> y <code>sheetId</code> en <code>js/config.js</code>. Ver README.</p>`}
          <div class="meta" style="justify-content:space-between;margin-top:8px"><span>${icon("bot")} Asistente IA (proxy APIE)</span><span class="pill ${AI.isAvailable() ? "st-normal" : "st-sin_dx"}">${AI.isAvailable() ? icon("check") + "Disponible" : "No disponible"}</span></div>
          <div class="meta" style="margin-top:8px">${icon("flag")} Bandeja de salida: ${outbox} falla(s) pendientes de enviar a Sheets</div>
        </div>
        <h2 class="section">Modo campo</h2>
        <div class="card">
          <label class="field"><span>Tema</span><div class="seg" id="theme">${[["auto", "Automático"], ["light", "Claro"], ["dark", "Oscuro (baja luz)"]].map(([k, l]) => `<button type="button" data-v="${k}" aria-pressed="${(p.theme || "auto") === k}">${l}</button>`).join("")}</div></label>
          <label class="meta" style="min-height:var(--tap)"><input type="checkbox" id="gloves" ${p.gloves ? "checked" : ""} style="width:24px;height:24px"> ${icon("hand")} Botones grandes para uso con guantes</label>
          <label class="meta" style="min-height:var(--tap)"><input type="checkbox" id="contrast" ${p.contrast ? "checked" : ""} style="width:24px;height:24px"> ${icon("sun")} Alto contraste (luz solar directa)</label>
        </div>
        <h2 class="section">Datos</h2>
        <div class="card">
          <div class="meta">Censo embebido: ${Data.all().length.toLocaleString("es-MX")} activos · seed ${esc(Data.seed.generado || "")}</div>
          <div class="btn-row"><button class="btn" id="exp">${icon("down")} Exportar respaldo JSON</button><button class="btn danger" id="wipe">${icon("trash")} Borrar datos locales</button></div>
        </div>
        <p class="legal"><a href="legal.html#privacidad">Aviso de privacidad</a> · <a href="legal.html#terminos">Términos</a> · APIE v0.1</p>`;
      $$("#theme button", v).forEach((b) => (b.onclick = () => { Store.update("prefs", {}, (x) => ({ ...x, theme: b.dataset.v })); applyPrefs(); render(); }));
      $("#gloves", v).onchange = (e) => { Store.update("prefs", {}, (x) => ({ ...x, gloves: e.target.checked })); applyPrefs(); };
      $("#contrast", v).onchange = (e) => { Store.update("prefs", {}, (x) => ({ ...x, contrast: e.target.checked })); applyPrefs(); };
      const gc = $("#gconn", v); if (gc) gc.onclick = async () => {
        try { const prof = await G.signIn(G.connected() ? "" : "consent"); if (s.provider === "local") Store.set("session", { ...s, ...prof }); toast("Google conectado"); renderShell(); go("ajustes"); } catch (e) { toast(e.message); }
      };
      const gd = $("#gdis", v); if (gd) gd.onclick = () => { G.signOut(); render(); };
      $("#exp", v).onclick = () => {
        const dump = {}; ["tasks", "events", "eventNotes", "faults", "annotations", "bookmarks", "learning"].forEach((k) => (dump[k] = Store.get(k)));
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 1)], { type: "application/json" }));
        a.download = `apie-respaldo-${UI.today()}.json`; a.click();
      };
      $("#wipe", v).onclick = async () => {
        if (!(await confirm({ title: "¿Borrar todos los datos locales?", text: `Se eliminarán tareas, notas, anotaciones y ${outbox} falla(s) sin sincronizar. No se puede deshacer.`, ok: "Borrar todo" }))) return;
        G.signOut(); await Store.wipe(); location.hash = ""; renderLogin();
      };
    },
  };

  // ── Chat IA (FAB en Base de Conocimientos y desde el menú) ──
  function openChat({ context = "", title = "Asistente IA", seed = "" }) {
    const hist = [];
    const s = sheet({
      title, full: true,
      body: `<div class="chat" id="chat"><div class="msg ai">${esc(context ? "Tengo el contexto de: " + context.split("\n")[0].slice(0, 120) + "\n¿Qué necesitas?" : "Pregunta sobre diagnóstico, normas, ajustes de protección o procedimientos. Verifica siempre contra la norma y el procedimiento vigente antes de ejecutar en campo.")}</div></div>
        ${AI.isAvailable() ? "" : `<p class="honest">El proxy de IA no responde. Las preguntas no se enviarán hasta configurar <code>apie/server</code>.</p>`}`,
      footer: `<form class="chat-input" id="cf" style="width:100%"><textarea id="ci" rows="1" placeholder="Escribe tu consulta…" enterkeyhint="send"></textarea><button class="btn primary" aria-label="Enviar">${icon("send")}</button></form>`,
    });
    const chat = $("#chat", s.el), ci = $("#ci", s.el);
    ci.value = seed;
    const push = (role, text) => { const d = document.createElement("div"); d.className = "msg " + (role === "user" ? "user" : "ai"); d.textContent = text; chat.append(d); d.scrollIntoView({ block: "end" }); return d; };
    $("#cf", s.el).onsubmit = async (e) => {
      e.preventDefault();
      const q = ci.value.trim(); if (!q) return;
      ci.value = ""; push("user", q); hist.push({ role: "user", content: q });
      const wait = push("ai", "…");
      try { const a = await AI.chat(hist, { context }); wait.textContent = a; hist.push({ role: "assistant", content: a }); }
      catch (err) { wait.textContent = "⚠ " + err.message; hist.pop(); }
    };
    ci.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("#cf", s.el).requestSubmit(); } });
  }

  window.App = { go, render, route, openChat, syncAll, updateOutboxDot };

  // ── Arranque ──
  async function boot() {
    await Store.init();
    applyPrefs();
    AI.probe().then(() => state.route === "ajustes" && render());
    window.addEventListener("hashchange", () => Store.get("session") && route());
    Store.get("session") ? renderShell() : renderLogin();
    if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
    window.addEventListener("pagehide", () => Store.flush());
  }
  document.addEventListener("DOMContentLoaded", boot);
})();
