/* Panel de control: KPIs, tareas críticas de hoy, próximas reuniones, metas de desarrollo. */
(function () {
  const { icon, esc, $, $$ } = UI;
  const Screens = (window.Screens = window.Screens || {});

  function kpis() {
    const t = Store.get("tasks", []), hoy = UI.today();
    const abiertas = t.filter((x) => x.status !== "completada");
    const vencidas = abiertas.filter((x) => x.due < hoy);
    // Cumplimiento: completadas en o antes de su fecha / total con fecha ≤ hoy (últimos 30 días)
    const lim = new Date(); lim.setDate(lim.getDate() - 30); const l = UI.ymd(lim);
    // Las que vencen hoy solo cuentan si ya se cerraron: el día no ha terminado.
    const universo = t.filter((x) => x.due >= l && (x.due < hoy || (x.due === hoy && x.status === "completada")));
    const enPlazo = universo.filter((x) => x.status === "completada" && (x.doneAt || "").slice(0, 10) <= x.due);
    const cumpl = universo.length ? Math.round((100 * enPlazo.length) / universo.length) : null;
    const act = Data.all();
    let alarma = 0, alerta = 0;
    const fm = Data.faultMap();
    for (const a of act) { const e = Data.estadoActual(a, fm); if (e === "alarma") alarma++; else if (e === "alerta") alerta++; }
    const conDx = new Set(Object.keys(Data.seed.historial)).size;
    const fallas = Store.get("faults", []);
    return { abiertas: abiertas.length, vencidas: vencidas.length, cumpl, universo: universo.length, alarma, alerta, conDx, fallasPend: fallas.filter((f) => !f.synced).length, fallas: fallas.length };
  }

  Screens.inicio = {
    title: "Panel de control",
    search: "Buscar tareas, activos, documentos…",
    render(v, q) {
      if (q) return renderGlobalSearch(v, q);
      const k = kpis(), s = Store.get("session");
      const hoy = UI.today();
      const criticas = Store.get("tasks", []).filter((t) => t.status !== "completada" && (t.due <= hoy || t.prio === "P1"))
        .sort((a, b) => a.prio.localeCompare(b.prio) || a.due.localeCompare(b.due)).slice(0, 5);
      const now = Date.now();
      const evs = Store.get("events", []).filter((e) => new Date(e.end) > now).sort((a, b) => new Date(a.start) - new Date(b.start)).slice(0, 3);
      const metas = Screens.aprender.metas().slice(0, 5);
      const hr = new Date().getHours();
      v.innerHTML = `
        <p style="margin:6px 0 2px;font-size:1.15rem">${hr < 12 ? "Buenos días" : hr < 19 ? "Buenas tardes" : "Buenas noches"}, ${esc(s.provider === "local" ? s.name : (s.name || "").split(" ")[0])}</p>
        <div class="meta">${new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</div>
        <h2 class="section">Indicadores</h2>
        <div class="kpis">
          <button class="kpi" data-go="tareas"><span class="lbl">${icon("tasks")}Tareas abiertas</span><span class="val">${k.abiertas}</span><span class="sub" style="color:${k.vencidas ? "var(--alert-ink)" : ""}">${k.vencidas ? `${icon("alert", "ico")} ${k.vencidas} vencida(s)` : "Sin vencidas"}</span></button>
          <button class="kpi" data-go="tareas"><span class="lbl">${icon("check")}Cumplimiento 30 d</span><span class="val">${k.cumpl == null ? "—" : k.cumpl}<small>${k.cumpl == null ? "" : " %"}</small></span><span class="sub">${k.universo ? `${k.universo} tareas con fecha cumplida` : "Sin tareas vencidas aún"}</span></button>
          <button class="kpi" data-go="activos" data-f="alarma"><span class="lbl">${icon("alert")}Activos en alarma/alerta</span><span class="val">${k.alarma}<small> / ${k.alerta}</small></span><span class="sub">${k.conDx} activos con diagnóstico real</span></button>
          <button class="kpi" data-go="activos"><span class="lbl">${icon("flag")}Fallas registradas</span><span class="val">${k.fallas}</span><span class="sub">${k.fallasPend ? `${k.fallasPend} pendiente(s) de sync` : "Todo sincronizado"}</span></button>
        </div>
        <p class="honest">Cobertura diagnóstica: ${k.conDx} de ${Data.all().length.toLocaleString("es-MX")} activos tienen medición real cargada. Los KPI de condición solo reflejan ese universo.</p>

        <h2 class="section">Críticas para hoy <button class="btn ghost" data-go="tareas">Ver todas</button></h2>
        ${criticas.length ? criticas.map((t) => `<div class="card" data-task="${t.id}" role="button" tabindex="0" style="cursor:pointer">
            <div class="meta" style="justify-content:space-between"><span>${Screens.tareas.prioPill(t.prio)} ${Screens.tareas.statusPill(t)}</span><span>${icon("clock")} ${UI.relDay(t.due)}</span></div>
            <h3 style="margin-top:6px">${esc(t.title)}</h3><div class="meta">${t.ubicacion ? `<span>${icon("pin")} ${esc(t.ubicacion)}</span>` : ""}<span>${esc(t.tipo)}</span></div></div>`).join("")
          : `<div class="card empty">${icon("check")}Sin tareas críticas para hoy.</div>`}

        <h2 class="section">Próximas reuniones <button class="btn ghost" data-go="agenda">Agenda</button></h2>
        ${evs.length ? evs.map((e) => `<div class="card ev-card"><span class="bar" style="background:var(--ev-${Data.tipoEvento(e)})"></span>
            <div class="grow" style="flex:1;min-width:0" data-ev="${esc(e.id)}" role="button" tabindex="0"><h3>${esc(e.title)}</h3><div class="meta">${icon("clock")} ${UI.relDay(e.start.slice(0, 10))} ${e.allDay ? "" : UI.fmtTime(e.start)}${e.location ? ` · ${esc(e.location)}` : ""}</div></div>
            ${e.video ? `<a class="btn primary" href="${esc(e.video)}" target="_blank" rel="noopener" aria-label="Unirse a la videollamada">${icon("video")} Unirse</a>` : ""}</div>`).join("")
          : `<div class="card empty">${icon("cal")}No hay reuniones próximas.</div>`}

        <h2 class="section">Metas de desarrollo <button class="btn ghost" data-go="aprender">Plan</button></h2>
        <div class="card" role="img" aria-label="Nivel actual contra meta por competencia">
          ${metas.map((m) => `<div class="meter"><div class="top"><b>${esc(m.nombre)}</b><span>Nivel ${m.actual} / meta ${m.meta}</span></div>
            <div class="track"><div class="fill" style="width:${(m.actual / 5) * 100}%"></div><div class="goal" style="left:calc(${(m.meta / 5) * 100}% - 1px)" title="Meta"></div></div></div>`).join("")}
          <div class="legend"><span><i style="background:var(--primary)"></i>Nivel actual (0–5)</span><span><i style="background:var(--text);width:2px"></i>Meta</span></div>
        </div>`;
      $$("[data-go]", v).forEach((b) => (b.onclick = () => { if (b.dataset.f) Screens.activos.presetEstado = "alarma"; App.go(b.dataset.go); }));
      $$("[data-task]", v).forEach((c) => (c.onclick = () => Screens.tareas.openDetail(c.dataset.task)));
      $$("[data-ev]", v).forEach((c) => (c.onclick = () => Screens.agenda.openDetail(c.dataset.ev)));
    },
  };

  function renderGlobalSearch(v, q) {
    const n = UI.norm(q);
    const tasks = Store.get("tasks", []).filter((t) => UI.norm(t.title + " " + t.desc + " " + t.tag).includes(n)).slice(0, 5);
    const assets = Data.all().filter((a) => a._q.includes(n)).slice(0, 5);
    const docs = Data.seed.docs.filter((d) => UI.norm(d.titulo + " " + (d.tags || []).join(" ") + " " + (d.norma || "")).includes(n)).slice(0, 5);
    const sec = (t, items) => `<h2 class="section">${t} (${items.length})</h2>` + (items.length ? items.join("") : `<div class="meta">Sin coincidencias</div>`);
    v.innerHTML = sec("Tareas", tasks.map((t) => `<div class="card" data-task="${t.id}"><h3>${esc(t.title)}</h3><div class="meta">${UI.relDay(t.due)} · ${esc(t.tipo)}</div></div>`))
      + sec("Activos", assets.map((a) => `<div class="card" data-tag="${esc(a.tag)}"><h3>${esc(a.tag)}</h3><div class="meta">${esc(a.denom)}</div></div>`))
      + sec("Documentos", docs.map((d) => `<div class="card" data-doc="${esc(d.id)}"><h3>${esc(d.titulo)}</h3><div class="meta">${esc(d.categoria)}</div></div>`));
    $$("[data-task]", v).forEach((c) => (c.onclick = () => Screens.tareas.openDetail(c.dataset.task)));
    $$("[data-tag]", v).forEach((c) => (c.onclick = () => Screens.activos.openDetail(c.dataset.tag)));
    $$("[data-doc]", v).forEach((c) => (c.onclick = () => Screens.saber.openDoc(c.dataset.doc)));
  }
})();
