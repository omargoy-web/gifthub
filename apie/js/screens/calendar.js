/* Calendario de reuniones: vista mensual/semanal con color por tipo, detalle con
   agenda, asistentes, adjuntos, notas, RSVP, videollamada y minuta automática. */
(function () {
  const { icon, esc, $, $$, toast, sheet } = UI;
  const Screens = (window.Screens = window.Screens || {});
  const ui = { vista: "mes", cursor: new Date(), sel: UI.today() };
  const DOW = ["L", "M", "M", "J", "V", "S", "D"];

  const events = () => Store.get("events", []);
  const evOn = (day) => events().filter((e) => e.start.slice(0, 10) <= day && (e.end.slice(0, 10) >= day || e.start.slice(0, 10) === day))
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  const color = (e) => `var(--ev-${Data.tipoEvento(e)})`;
  const startOfWeek = (d) => { const x = new Date(d); const w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); x.setHours(0, 0, 0, 0); return x; };
  const RSVP = { accepted: "Asistiré", tentative: "Tal vez", declined: "No asistiré", needsAction: "Sin responder" };

  async function pull() {
    if (!G.connected()) return 0;
    const from = new Date(); from.setDate(from.getDate() - 31);
    const to = new Date(); to.setDate(to.getDate() + 62);
    const g = await G.listEvents(from.toISOString(), to.toISOString());
    // Con Google conectado los eventos de ejemplo sobran; los locales del usuario se conservan.
    Store.set("events", [...events().filter((e) => e.src === "local" && !e.demo), ...g]);
    return g.length;
  }

  Screens.agenda = {
    title: "Calendario de reuniones",
    search: "Buscar reunión, asistente, lugar…",
    pull,
    fabs: () => [{ icon: "plus", label: "Nueva reunión", run: newEvent }],
    render(v, q) {
      if (q) return renderSearch(v, q);
      const c = ui.cursor;
      const title = ui.vista === "mes" ? c.toLocaleDateString("es-MX", { month: "long", year: "numeric" })
        : (() => { const s = startOfWeek(c), e = new Date(s); e.setDate(e.getDate() + 6); return `${UI.fmtDate(UI.ymd(s))} – ${UI.fmtDate(UI.ymd(e))}`; })();
      v.innerHTML = `
        <div class="seg" style="margin:4px 0 8px" role="group" aria-label="Vista">${[["mes", "Mes"], ["semana", "Semana"], ["lista", "Lista"]].map(([k, l]) => `<button data-v="${k}" aria-pressed="${ui.vista === k}">${l}</button>`).join("")}</div>
        ${ui.vista !== "lista" ? `<div class="cal-head"><button class="icon-btn" id="prev" aria-label="Anterior">${icon("back")}</button><h3>${esc(title)}</h3><button class="btn ghost" id="hoy">Hoy</button><button class="icon-btn" id="next" aria-label="Siguiente">${icon("next")}</button></div>` : ""}
        <div id="calv"></div>
        <div class="legend">${Object.entries(Data.TIPOS_EV).map(([k, l]) => `<span><i style="background:var(--ev-${k})"></i>${l}</span>`).join("")}</div>
        ${!G.connected() ? `<p class="honest">${G.configured() ? "Google Calendar desconectado: mostrando eventos locales. Conecta en Ajustes o jala hacia abajo tras conectar." : "Modo local: eventos de ejemplo. Configura Google OAuth para sincronizar tu calendario."}</p>` : ""}
        <div id="dayl"></div>`;
      $$("[data-v]", v).forEach((b) => (b.onclick = () => { ui.vista = b.dataset.v; App.render(); }));
      const step = (n) => { if (ui.vista === "mes") ui.cursor = new Date(c.getFullYear(), c.getMonth() + n, 1); else { const x = new Date(c); x.setDate(x.getDate() + 7 * n); ui.cursor = x; } App.render(); };
      if (ui.vista !== "lista") {
        $("#prev", v).onclick = () => step(-1); $("#next", v).onclick = () => step(1);
        $("#hoy", v).onclick = () => { ui.cursor = new Date(); ui.sel = UI.today(); App.render(); };
      }
      const cv = $("#calv", v);
      if (ui.vista === "mes") renderMonth(cv); else if (ui.vista === "semana") renderWeek(cv); else renderList(cv);
      if (ui.vista === "mes") renderDay($("#dayl", v), ui.sel);
      // deslizar horizontal en el calendario cambia de periodo
      let x0 = null;
      cv.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
      cv.addEventListener("touchend", (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 70 && ui.vista !== "lista") step(dx < 0 ? 1 : -1); x0 = null; });
    },
    openDetail,
  };

  function renderMonth(el) {
    const c = ui.cursor, first = new Date(c.getFullYear(), c.getMonth(), 1), start = startOfWeek(first), hoy = UI.today();
    let h = DOW.map((d) => `<div class="dow">${d}</div>`).join("");
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const k = UI.ymd(d), evs = evOn(k);
      h += `<button data-day="${k}" class="${d.getMonth() !== c.getMonth() ? "out" : ""} ${k === hoy ? "today" : ""}" aria-selected="${k === ui.sel}" aria-label="${d.toLocaleDateString("es-MX", { day: "numeric", month: "long" })}, ${evs.length} eventos">
        ${d.getDate()}<span class="dots">${evs.slice(0, 3).map((e) => `<i style="background:${color(e)}"></i>`).join("")}</span></button>`;
      if (i === 34 && d.getMonth() !== c.getMonth()) break;
    }
    el.innerHTML = `<div class="month">${h}</div>`;
    $$("[data-day]", el).forEach((b) => (b.onclick = () => { ui.sel = b.dataset.day; App.render(); }));
  }

  function renderWeek(el) {
    const s = startOfWeek(ui.cursor), hoy = UI.today();
    let h = "";
    for (let i = 0; i < 7; i++) {
      const d = new Date(s); d.setDate(s.getDate() + i); const k = UI.ymd(d);
      h += `<div class="col ${k === hoy ? "today" : ""}"><header>${DOW[i]}<b>${d.getDate()}</b></header>
        ${evOn(k).map((e) => `<button class="ev" data-ev="${esc(e.id)}" style="background:${color(e)}" title="${esc(e.title)}">${e.allDay ? "" : UI.fmtTime(e.start) + " "}${esc(e.title)}</button>`).join("")}</div>`;
    }
    el.innerHTML = `<div class="week">${h}</div>`;
    $$("[data-ev]", el).forEach((b) => (b.onclick = () => openDetail(b.dataset.ev)));
  }

  function renderList(el) {
    const now = Date.now();
    const up = events().filter((e) => new Date(e.end) >= now).sort((a, b) => a.start.localeCompare(b.start));
    let last = "";
    el.innerHTML = up.length ? up.map((e) => {
      const d = e.start.slice(0, 10), hd = d !== last ? `<h2 class="section">${UI.relDay(d)} · ${UI.fmtDate(d)}</h2>` : ""; last = d;
      return hd + card(e);
    }).join("") : `<div class="empty">${icon("cal")}Sin reuniones próximas.</div>`;
    bindCards(el);
  }

  function renderDay(el, day) {
    const evs = evOn(day);
    el.innerHTML = `<h2 class="section">${UI.relDay(day)} · ${UI.fmtDate(day)}</h2>` + (evs.length ? evs.map(card).join("") : `<div class="meta">Sin eventos este día.</div>`);
    bindCards(el);
  }

  function renderSearch(v, q) {
    const n = UI.norm(q);
    const l = events().filter((e) => UI.norm(`${e.title} ${e.desc} ${e.location} ${(e.attendees || []).map((a) => a.name + a.email).join(" ")}`).includes(n)).sort((a, b) => b.start.localeCompare(a.start));
    v.innerHTML = `<h2 class="section">${l.length} resultado(s)</h2>` + l.map(card).join("");
    bindCards(v);
  }

  const card = (e) => `<div class="card ev-card"><span class="bar" style="background:${color(e)}"></span>
    <div style="flex:1;min-width:0;cursor:pointer" data-ev="${esc(e.id)}" role="button" tabindex="0"><h3>${esc(e.title)}</h3>
      <div class="meta">${icon("clock")} ${e.allDay ? "Todo el día" : `${UI.fmtTime(e.start)}–${UI.fmtTime(e.end)}`}${e.location ? ` · ${icon("pin")} ${esc(e.location)}` : ""}${e.attendees && e.attendees.length ? ` · ${icon("users")} ${e.attendees.length}` : ""}</div>
      <div class="meta"><span class="pill p-P4">${Data.TIPOS_EV[Data.tipoEvento(e)]}</span>${e.myRsvp ? ` <span class="pill ${e.myRsvp === "accepted" ? "st-normal" : e.myRsvp === "declined" ? "st-alarma" : "st-alerta"}">${RSVP[e.myRsvp]}</span>` : ""}${Store.get("eventNotes", {})[e.id] ? ` ${icon("note")} Notas` : ""}</div></div>
    ${e.video ? `<a class="btn primary" href="${esc(e.video)}" target="_blank" rel="noopener" aria-label="Unirse a ${esc(e.title)}">${icon("video")}</a>` : ""}</div>`;
  const bindCards = (el) => $$("[data-ev]", el).forEach((c) => { c.onclick = () => openDetail(c.dataset.ev); c.onkeydown = (k) => k.key === "Enter" && openDetail(c.dataset.ev); });

  const TEMPLATE = (e) => `Reunión: ${e.title}\nFecha: ${UI.fmtDT(e.start)}\n\nAsistentes presentes:\n- \n\nPuntos tratados:\n- \n\nAcuerdos:\n- Acuerdo: \n\nAcciones (responsable · fecha):\n- Acción: @responsable · AAAA-MM-DD\n\nRiesgos / seguridad:\n- `;

  function openDetail(id) {
    const e = events().find((x) => x.id === id); if (!e) return;
    const notes = () => Store.get("eventNotes", {})[id] || {};
    const setNotes = (p) => Store.update("eventNotes", {}, (n) => ({ ...n, [id]: { ...(n[id] || {}), ...p } }));
    const s = sheet({
      title: e.title, full: true,
      body: `<div class="meta"><span class="pill p-P4" style="border-left:4px solid ${color(e)}">${Data.TIPOS_EV[Data.tipoEvento(e)]}</span> ${icon("clock")} ${e.allDay ? UI.fmtDate(e.start) : `${UI.fmtDT(e.start)}–${UI.fmtTime(e.end)}`}</div>
        ${e.location ? `<div class="meta" style="margin-top:4px">${icon("pin")} ${esc(e.location)}</div>` : ""}
        <div class="btn-row">${e.video ? `<a class="btn primary" href="${esc(e.video)}" target="_blank" rel="noopener">${icon("video")} Unirse a videollamada</a>` : ""}${e.htmlLink ? `<a class="btn" href="${esc(e.htmlLink)}" target="_blank" rel="noopener">${icon("cal")} Abrir en Google</a>` : ""}</div>
        <h2 class="section">Mi asistencia</h2>
        <div class="seg" id="rsvp">${["accepted", "tentative", "declined"].map((k) => `<button data-r="${k}" aria-pressed="${e.myRsvp === k}">${RSVP[k]}</button>`).join("")}</div>
        <h2 class="section">Agenda</h2><div class="card" style="white-space:pre-wrap">${e.desc ? esc(e.desc.replace(/<[^>]+>/g, "\n")) : '<span class="meta">Sin agenda.</span>'}</div>
        <h2 class="section">Asistentes (${(e.attendees || []).length})</h2>
        ${(e.attendees || []).length ? `<div class="card">${e.attendees.map((a) => `<div class="meta" style="justify-content:space-between;min-height:36px"><span>${esc(a.name)}${a.organizer ? " · organiza" : ""}${a.self ? " (tú)" : ""}</span><span class="pill ${a.rsvp === "accepted" ? "st-normal" : a.rsvp === "declined" ? "st-alarma" : "st-sin_dx"}">${RSVP[a.rsvp] || "—"}</span></div>`).join("")}</div>` : `<p class="meta">Sin lista de asistentes.</p>`}
        ${(e.attachments || []).length ? `<h2 class="section">Archivos adjuntos</h2>${e.attachments.map((a) => `<a class="card meta" style="display:flex" href="${esc(a.url)}" target="_blank" rel="noopener">${icon("clip")} ${esc(a.title)}</a>`).join("")}` : ""}
        <h2 class="section">Notas de la reunión <button class="btn ghost" id="tpl">Usar plantilla</button></h2>
        <textarea id="en" class="field" style="width:100%;min-height:200px;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--surface-2)" placeholder="Escribe 'Acuerdo:' y 'Acción: @responsable · fecha' para que la minuta los extraiga.">${esc(notes().text || "")}</textarea>
        <div class="btn-row"><button class="btn primary" id="mn">${icon("note")} Generar minuta</button><button class="btn" id="mt">${icon("tasks")} Acciones → tareas</button></div>
        <div id="mout"></div>`,
      onClose: () => App.render(),
    });
    const ta = $("#en", s.el);
    ta.oninput = UI.debounce(() => setNotes({ text: ta.value }), 300);
    $("#tpl", s.el).onclick = () => { if (!ta.value.trim()) { ta.value = TEMPLATE(e); setNotes({ text: ta.value }); } else toast("Ya hay notas; la plantilla solo se aplica a notas vacías"); };
    $$("[data-r]", s.el).forEach((b) => (b.onclick = async () => {
      const st = b.dataset.r;
      try {
        if (e.src === "google") await G.rsvp(e, st);
        Store.set("events", events().map((x) => (x.id === id ? { ...x, myRsvp: st, attendees: (x.attendees || []).map((a) => (a.self ? { ...a, rsvp: st } : a)) } : x)));
        $$("[data-r]", s.el).forEach((x) => x.setAttribute("aria-pressed", x === b));
        toast(e.src === "google" ? `Respuesta enviada: ${RSVP[st]}` : `Guardado localmente: ${RSVP[st]}`);
      } catch (err) { toast(err.message); }
    }));
    if (notes().minuta) showMinuta(notes().minuta);
    $("#mn", s.el).onclick = async () => {
      const txt = ta.value.trim(); if (!txt) return toast("Escribe notas primero");
      $("#mn", s.el).disabled = true;
      let m;
      try {
        if (AI.isAvailable()) m = await AI.chat([{ role: "user", content: `Redacta la minuta formal de esta reunión a partir de las notas.\n\nREUNIÓN: ${e.title}\nFECHA: ${UI.fmtDT(e.start)}\nASISTENTES: ${(e.attendees || []).map((a) => a.name).join(", ") || "no registrados"}\n\nNOTAS:\n${txt}` }], { mode: "minuta" });
        else m = localMinuta(e, txt);
      } catch (err) { toast("IA no disponible, usando plantilla local"); m = localMinuta(e, txt); }
      $("#mn", s.el).disabled = false;
      setNotes({ minuta: m });
      showMinuta(m);
    };
    $("#mt", s.el).onclick = () => {
      const acc = parseActions(ta.value);
      if (!acc.length) return toast("No encontré líneas 'Acción:' en las notas");
      const list = Store.get("tasks", []);
      const nuevas = acc.map((a, i) => Data.mkTask({ title: a.text, due: a.due || UI.today(), tipo: "Administrativo", prio: "P3", desc: `Acción de la reunión "${e.title}" (${UI.fmtDate(e.start)})${a.who ? ` · responsable: ${a.who}` : ""}`, order: Math.min(0, ...list.map((t) => t.order)) - acc.length + i }));
      Store.set("tasks", [...nuevas, ...list]);
      toast(`${nuevas.length} tarea(s) creadas`);
    };
    function showMinuta(m) {
      const o = $("#mout", s.el);
      o.innerHTML = `<h2 class="section">Minuta</h2><div class="card" style="white-space:pre-wrap;font-size:.92rem">${esc(m)}</div>
        <div class="btn-row"><button class="btn" id="mc">${icon("copy")} Copiar</button>${G.connected() ? `<button class="btn" id="md">${icon("drive")} Guardar en Drive</button>` : ""}<button class="btn" id="ms">${icon("share")} Compartir</button></div>`;
      $("#mc", o).onclick = () => navigator.clipboard.writeText(m).then(() => toast("Minuta copiada"));
      $("#ms", o).onclick = () => (navigator.share ? navigator.share({ title: `Minuta · ${e.title}`, text: m }).catch(() => {}) : navigator.clipboard.writeText(m).then(() => toast("Copiada (compartir no soportado)")));
      const md = $("#md", o); if (md) md.onclick = async () => {
        try { const f = await G.createDoc(`Minuta ${UI.ymd(new Date(e.start))} · ${e.title}`, m); toast("Minuta guardada en Drive"); window.open(f.webViewLink, "_blank", "noopener"); } catch (err) { toast(err.message); }
      };
    }
  }

  function parseActions(text) {
    return text.split("\n").map((l) => l.trim()).filter((l) => /^[-*•]?\s*acci[oó]n\s*:/i.test(l)).map((l) => {
      const body = l.replace(/^[-*•]?\s*acci[oó]n\s*:\s*/i, "");
      const who = (body.match(/@([\wÁÉÍÓÚÑáéíóúñ.]+)/) || [])[1] || "";
      const due = (body.match(/\d{4}-\d{2}-\d{2}/) || [])[0] || "";
      return { text: body.replace(/@[\wÁÉÍÓÚÑáéíóúñ.]+/, "").replace(/·?\s*\d{4}-\d{2}-\d{2}/, "").replace(/\s*·\s*$/, "").trim(), who, due };
    }).filter((a) => a.text);
  }

  // Minuta sin IA: estructura las notas por palabras clave. Determinista y auditable.
  function localMinuta(e, txt) {
    const lines = txt.split("\n").map((l) => l.trim()).filter(Boolean);
    const acuerdos = lines.filter((l) => /^[-*•]?\s*acuerdo\s*:/i.test(l)).map((l) => l.replace(/^[-*•]?\s*acuerdo\s*:\s*/i, ""));
    const acciones = parseActions(txt);
    const otros = lines.filter((l) => !/^[-*•]?\s*(acuerdo|acci[oó]n)\s*:/i.test(l) && !/^(reuni[oó]n|fecha)\s*:/i.test(l) && !/:$/.test(l) && l !== "-");
    return [
      `MINUTA DE REUNIÓN`, `Asunto: ${e.title}`, `Fecha: ${UI.fmtDT(e.start)}${e.location ? ` · Lugar: ${e.location}` : ""}`,
      `Asistentes: ${(e.attendees || []).filter((a) => a.rsvp !== "declined").map((a) => a.name).join(", ") || "(registrar)"}`, ``,
      `1. PUNTOS TRATADOS`, ...(otros.length ? otros.map((l) => `   • ${l.replace(/^[-*•]\s*/, "")}`) : ["   • (sin registro)"]), ``,
      `2. ACUERDOS`, ...(acuerdos.length ? acuerdos.map((a, i) => `   ${i + 1}. ${a}`) : ["   (sin acuerdos registrados)"]), ``,
      `3. ACCIONES`, ...(acciones.length ? acciones.map((a, i) => `   ${i + 1}. ${a.text} — Resp.: ${a.who || "por asignar"} — Fecha: ${a.due || "por definir"}`) : ["   (sin acciones registradas)"]), ``,
      `Elaboró: ${(Store.get("session") || {}).name || ""} · Generado por APIE (plantilla local, revisar antes de circular)`,
    ].join("\n");
  }

  function newEvent() {
    const s = sheet({
      title: "Nueva reunión",
      body: `<form id="ef"><label class="field"><span>Título *</span><input name="title" required></label>
        <div class="two"><label class="field"><span>Fecha</span><input type="date" name="d" value="${ui.sel}"></label><label class="field"><span>Hora</span><input type="time" name="h" value="09:00"></label></div>
        <div class="two"><label class="field"><span>Duración (min)</span><input type="number" name="dur" value="60" min="15" step="15"></label>
          <label class="field"><span>Tipo</span><select name="tipo">${Object.entries(Data.TIPOS_EV).map(([k, l]) => `<option value="${k}">${l}</option>`).join("")}</select></label></div>
        <label class="field"><span>Lugar</span><input name="location"></label>
        <label class="field"><span>Agenda</span><textarea name="desc"></textarea></label></form>`,
      footer: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="es">Guardar</button>`,
      onClose: () => App.render(),
    });
    $("#es", s.el).onclick = () => {
      const f = Object.fromEntries(new FormData($("#ef", s.el)));
      if (!f.title.trim()) return toast("El título es obligatorio");
      const st = new Date(`${f.d}T${f.h}`), en = new Date(st.getTime() + (+f.dur || 60) * 60e3);
      Store.set("events", [...events(), { id: uid("e_"), src: "local", title: f.title.trim(), tipo: f.tipo, start: UI.localISO(st), end: UI.localISO(en), desc: f.desc, location: f.location, attendees: [], attachments: [], video: "" }]);
      s.close(); toast(G.connected() ? "Guardada en APIE (no se publica en Google Calendar)" : "Reunión guardada");
    };
  }
})();
