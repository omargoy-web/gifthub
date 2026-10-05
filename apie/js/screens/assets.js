/* Visor de activos: censo SICM-ELE consultable, detalle con nameplate, historial
   real, manuales relacionados y ubicación por sector; registro de falla (cola
   offline → Google Sheets) y borrador de aviso SAP IW21. */
(function () {
  const { icon, esc, $, $$, toast, sheet } = UI;
  const Screens = (window.Screens = window.Screens || {});
  const ui = { familia: "", sector: "", estado: "", crit: "", vista: "lista", limit: 60 };
  const PAGE = 60;

  function filtered(q) {
    const n = UI.norm(q).trim(), fm = Data.faultMap();
    const l = Data.all().filter((a) =>
      (!ui.familia || a.familia === ui.familia) && (ui.sector === "" || String(a.sector) === ui.sector) &&
      (!ui.crit || a.crit_abc === ui.crit) && (!ui.estado || Data.estadoActual(a, fm) === ui.estado) && (!n || a._q.includes(n)));
    if (!n) return l;
    // TAG exacto → TAG con prefijo → TAG contiene → solo denominación/planta
    const rank = (a) => { const t = UI.norm(a.tag); return t === n ? 0 : t.startsWith(n) ? 1 : t.includes(n) ? 2 : 3; };
    return l.map((a, i) => [rank(a), i, a]).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map((x) => x[2]);
  }

  const plate = (a) => [["Tensión", a.V != null ? `${a.V.toLocaleString("es-MX")} V` : null], ["Corriente", a.I != null ? `${a.I.toLocaleString("es-MX")} A` : null], ["Potencia", a.HP != null ? `${a.HP.toLocaleString("es-MX")} HP` : null],
    ["Capacidad", a.kVA != null ? `${a.kVA.toLocaleString("es-MX")} kVA` : null], ["Velocidad", a.rpm != null ? `${a.rpm} RPM` : null], ["Clase aisl.", a.clase], ["Nivel tensión", a.NT]].filter(([, v]) => v != null);

  Screens.activos = {
    title: "Visor de activos",
    search: "TAG, denominación, planta, equipo SAP…",
    presetEstado: null,
    render(v, q, { fromSearch } = {}) {
      if (this.presetEstado) { ui.estado = this.presetEstado; this.presetEstado = null; }
      if (fromSearch) ui.limit = PAGE;
      const l = filtered(q), fm = Data.faultMap();
      const fams = Object.keys(Data.FAMILIAS);
      v.innerHTML = `
        <div class="chip-row">
          <select class="chip" id="ff" aria-label="Tipo de equipo"><option value="">Tipo: todos</option>${fams.map((f) => `<option value="${f}" ${ui.familia === f ? "selected" : ""}>${Data.famLabel(f)}</option>`).join("")}</select>
          <select class="chip" id="fs" aria-label="Ubicación"><option value="">Ubicación: todas</option>${Data.SECTORES.map((s) => `<option value="${s}" ${ui.sector === String(s) ? "selected" : ""}>${Data.sectorLabel(s)}</option>`).join("")}</select>
          <select class="chip" id="fe" aria-label="Estado"><option value="">Estado: todos</option>${Object.entries(Data.ESTADOS).map(([k, [lb]]) => `<option value="${k}" ${ui.estado === k ? "selected" : ""}>${lb}</option>`).join("")}</select>
          <select class="chip" id="fc" aria-label="Criticidad"><option value="">Criticidad: todas</option>${["A", "B", "C"].map((c) => `<option ${ui.crit === c ? "selected" : ""}>${c}</option>`).join("")}</select>
          <button class="chip" id="vw">${icon(ui.vista === "lista" ? "grid" : "list")} ${ui.vista === "lista" ? "Cuadrícula" : "Lista"}</button>
        </div>
        <div class="meta" style="margin-bottom:8px">${l.length.toLocaleString("es-MX")} activo(s)${ui.familia || ui.sector || ui.estado || ui.crit ? ` · <button class="btn ghost" id="clr" style="min-height:32px;padding:0 6px">Limpiar filtros</button>` : ""}</div>
        <ul class="list ${ui.vista === "grid" ? "grid-view" : ""}">
          ${l.slice(0, ui.limit).map((a) => `<li class="swipe"><div class="row" data-tag="${esc(a.tag)}" tabindex="0" role="button">
            <div class="grow"><h3>${esc(a.tag)}</h3><div class="meta" style="margin-bottom:4px">${esc(a.denom)}</div>
            <div class="meta">${Data.estadoPill(Data.estadoActual(a, fm))}<span class="pill p-P4">${Data.famLabel(a.familia)}</span><span>${icon("pin")}${Data.sectorLabel(a.sector)}</span>${a.crit_abc ? `<span>Crit. ${a.crit_abc}</span>` : ""}</div></div></div></li>`).join("")}
        </ul>
        ${l.length > ui.limit ? `<button class="btn" id="more" style="width:100%">Mostrar ${Math.min(PAGE, l.length - ui.limit)} más</button>` : ""}
        ${!l.length ? `<div class="empty">${icon("asset")}Sin activos con esos filtros.</div>` : ""}`;
      const on = (id, k) => ($(id, v).onchange = (e) => { ui[k] = e.target.value; ui.limit = PAGE; App.render(); });
      on("#ff", "familia"); on("#fs", "sector"); on("#fe", "estado"); on("#fc", "crit");
      $("#vw", v).onclick = () => { ui.vista = ui.vista === "lista" ? "grid" : "lista"; App.render(); };
      const clr = $("#clr", v); if (clr) clr.onclick = () => { Object.assign(ui, { familia: "", sector: "", estado: "", crit: "" }); App.render(); };
      const more = $("#more", v); if (more) more.onclick = () => { ui.limit += PAGE; App.render(); };
      $$("[data-tag]", v).forEach((r) => { r.onclick = () => this.openDetail(r.dataset.tag); r.onkeydown = (e) => e.key === "Enter" && this.openDetail(r.dataset.tag); });
    },

    openDetail(tag) {
      const a = Data.get(tag);
      if (!a) return toast(`${tag} no está en el censo`);
      const h = Data.historial(tag);
      const faults = Store.get("faults", []).filter((f) => f.tag === tag).sort((x, y) => y.ts.localeCompare(x.ts));
      const docs = Data.seed.docs.filter((d) => (d.familias || []).includes(a.familia) || (d.tags || []).some((t) => UI.norm(a.familia).includes(t) || t.includes(UI.norm(a.familia).slice(0, 5)))).slice(0, 8);
      let tab = "placa";
      const s = sheet({
        title: a.tag, full: true,
        body: `<div class="meta">${Data.estadoPill(Data.estadoActual(a))}<span class="pill p-P4">${Data.famLabel(a.familia)}</span>${a.crit_abc ? `<span>Criticidad ${a.crit_abc}</span>` : ""}</div>
          <p style="margin:6px 0 12px">${esc(a.denom)}</p>
          <div class="tabs" role="tablist">${[["placa", "Placa"], ["historial", `Historial (${h.length + faults.length})`], ["manuales", `Manuales (${docs.length})`], ["ubicacion", "Ubicación"]].map(([k, l]) => `<button role="tab" data-tab="${k}">${l}</button>`).join("")}</div>
          <div id="ab"></div>`,
        footer: `<button class="btn" id="ot">${icon("tasks")} Solicitud de trabajo</button><button class="btn danger" id="rf">${icon("flag")} Registrar falla</button>`,
        onClose: () => App.render(),
      });
      const draw = () => {
        $$("[data-tab]", s.el).forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab));
        const ab = $("#ab", s.el);
        if (tab === "placa") {
          const p = plate(a);
          ab.innerHTML = `<dl class="kv">${[["TAG", a.tag], ["Equipo SAP", a.sap || "—"], ["Planta", a.planta || "—"], ["Ubicación", Data.sectorLabel(a.sector)], ...p].map(([k, x]) => `<div><dt>${k}</dt><dd>${esc(x)}</dd></div>`).join("")}</dl>
            ${p.length < 2 ? `<p class="honest">Datos de placa incompletos en el maestro SAP para este activo. Validar en campo y actualizar el maestro (IE02).</p>` : ""}`;
        } else if (tab === "historial") {
          const items = [
            ...faults.map((f) => ({ fecha: f.ts, html: `<span class="pill st-${f.severidad === "Alta" ? "alarma" : "alerta"}">${icon("flag")}Falla ${esc(f.severidad)}</span> ${esc(f.modo)}<div class="meta">${esc(f.sintoma || "")} · ${f.synced ? "sincronizada" : "pendiente de sync"}</div>` })),
            ...h.map((m) => ({ fecha: m.fecha, html: `${Data.estadoPill(m.estado)} ${esc(m.act)} · ${esc(m.ing || "")}<div class="meta">${Object.entries(m.lect).slice(0, 8).map(([k, x]) => `${esc(k)}=${esc(x)}`).join(" · ")}</div>${m.hallazgos.length ? `<div class="meta">Hallazgos: ${esc(m.hallazgos.join(", "))}</div>` : ""}${m.folio ? `<div class="meta">Folio ${esc(m.folio)}</div>` : ""}` })),
          ].sort((x, y) => y.fecha.localeCompare(x.fecha));
          ab.innerHTML = items.length ? `<ol class="timeline">${items.map((i) => `<li><time>${UI.fmtDT(i.fecha)}</time>${i.html}</li>`).join("")}</ol>`
            : `<div class="empty">${icon("clock")}Sin mediciones reales cargadas para este activo.</div><p class="honest">El historial de órdenes SAP PM no se consulta desde APIE (sin interfaz a SAP). Solo se muestran recorridos SICM ingestados y fallas registradas aquí.</p>`;
        } else if (tab === "manuales") {
          ab.innerHTML = docs.length ? docs.map((d) => `<div class="card" data-doc="${esc(d.id)}" role="button" tabindex="0" style="cursor:pointer"><h3>${esc(d.titulo)}</h3><div class="meta">${esc(d.categoria)}${d.norma ? " · " + esc(d.norma) : ""}</div></div>`).join("")
            : `<div class="empty">${icon("book")}Sin documentos asociados a esta familia.</div>`;
          $$("[data-doc]", ab).forEach((c) => (c.onclick = () => Screens.saber.openDoc(c.dataset.doc)));
        } else {
          ab.innerHTML = `<p class="meta">${icon("pin")} ${esc(a.planta || "Planta sin registrar")} · ${Data.sectorLabel(a.sector)}</p>
            <div class="plant" role="img" aria-label="Plano esquemático de sectores, resaltado ${Data.sectorLabel(a.sector)}">${Data.SECTORES.map((x) => `<div class="${String(x) === String(a.sector) ? "on" : ""}">${Data.sectorLabel(x)}</div>`).join("")}</div>
            <p class="honest">Plano esquemático por sector. Para ubicación geográfica precisa se requiere cargar coordenadas o el plano de arreglo general de la refinería (no incluido en el censo SAP).</p>`;
        }
      };
      $$("[data-tab]", s.el).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
      $("#rf", s.el).onclick = () => faultForm(a, () => { s.close(); this.openDetail(tag); });
      $("#ot", s.el).onclick = () => workRequest(a);
      draw();
    },

    // Fila para la pestaña "Fallas" de Google Sheets (orden fijo, ver README).
    faultRow: (f) => [f.id, f.ts, f.tag, f.sap || "", f.familia, f.sector, f.planta, f.modo, f.severidad, f.condicion, f.sintoma, f.accion, f.autor, f.fotoNombre || ""],
  };

  function faultForm(a, done) {
    let sev = "Media", foto = null;
    const s = sheet({
      title: `Registrar falla · ${a.tag}`,
      body: `<form id="ff2">
        <label class="field"><span>Modo de falla *</span><select name="modo" required>${Data.modos(a.familia).map((m) => `<option>${esc(m)}</option>`).join("")}</select></label>
        <span class="field"><span>Severidad</span><div class="seg" id="sv">${["Baja", "Media", "Alta"].map((x) => `<button type="button" data-s="${x}" aria-pressed="${x === sev}">${x}</button>`).join("")}</div></span>
        <label class="field"><span>Condición operativa</span><select name="condicion"><option>En operación</option><option>Fuera de servicio</option><option>En libranza</option><option>Disparado por protección</option></select></label>
        <label class="field"><span>Síntoma / evidencia</span><textarea name="sintoma" placeholder="Ej. ΔT 18 °C fase B contra A/C, carga 70 %"></textarea></label>
        <label class="field"><span>Acción inmediata tomada</span><input name="accion" placeholder="Ej. Se notificó a operación, se redujo carga"></label>
        <label class="btn" style="width:100%">${icon("camera")} Foto de evidencia<input type="file" id="fp" accept="image/*" capture="environment" hidden></label><div class="meta" id="fpn"></div>
      </form>
      <p class="honest">Se guarda en este equipo y se envía a Google Sheets al sincronizar. ${G.connected() && G.sheetConfigured() ? "Conectado: se intentará enviar de inmediato." : "Sin conexión a Sheets: queda en bandeja de salida."}</p>`,
      footer: `<button class="btn ghost" data-close>Cancelar</button><button class="btn danger" id="fsv">Registrar</button>`,
    });
    $$("[data-s]", s.el).forEach((b) => (b.onclick = () => { sev = b.dataset.s; $$("[data-s]", s.el).forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
    $("#fp", s.el).onchange = (e) => { foto = e.target.files[0]; $("#fpn", s.el).textContent = foto ? `${foto.name} (${Math.round(foto.size / 1024)} KB · queda local)` : ""; };
    $("#fsv", s.el).onclick = async () => {
      const f = Object.fromEntries(new FormData($("#ff2", s.el)));
      const sess = Store.get("session") || {};
      const rec = { id: uid("F-"), ts: UI.localISO(new Date()), tag: a.tag, sap: a.sap, familia: a.familia, sector: a.sector, planta: a.planta, modo: f.modo, severidad: sev, condicion: f.condicion, sintoma: f.sintoma.trim(), accion: f.accion.trim(), autor: sess.email || sess.name, fotoNombre: foto ? foto.name : "", synced: null };
      Store.set("faults", [...Store.get("faults", []), rec]);
      s.close();
      if (G.connected() && G.sheetConfigured()) {
        try { await G.appendRows("Fallas", [Screens.activos.faultRow(rec)]); Store.update("faults", [], (l) => l.map((x) => (x.id === rec.id ? { ...x, synced: new Date().toISOString() } : x))); toast("Falla registrada y enviada a Sheets"); }
        catch (e) { toast("Guardada local; Sheets falló: " + e.message); }
      } else toast("Falla registrada (pendiente de sincronizar)");
      if (sev === "Alta") Screens.tareas.create({ title: `Atender falla ${f.modo} · ${a.tag}`, prio: "P1", tipo: "Correctivo", tag: a.tag, ubicacion: `${Data.sectorLabel(a.sector)} · ${a.planta}`, due: UI.today(), desc: `${f.sintoma}\nCondición: ${f.condicion}\nFalla ${rec.id}`, subtasks: ["Aviso IW21 generado", "Análisis causa raíz", "Cierre con evidencia"] });
      App.updateOutboxDot();
      done && sev !== "Alta" && done();
    };
  }

  // APIE no escribe en SAP: genera el texto del aviso para capturarlo en IW21.
  function workRequest(a) {
    const txt = `AVISO DE MANTENIMIENTO (borrador para IW21)\nClase de aviso: M2 (avería) / M1 (solicitud) — validar\nEquipo: ${a.sap || "(sin núm. SAP)"} · TAG ${a.tag}\nDenominación: ${a.denom}\nUbicación: ${a.planta} · ${Data.sectorLabel(a.sector)}\nTexto breve (40 car.): \nDescripción: \nPrioridad sugerida: \nSolicitante: ${(Store.get("session") || {}).name || ""}\nFecha: ${UI.fmtDT(new Date().toISOString())}`;
    const s = sheet({
      title: "Solicitud de trabajo",
      body: `<label class="field"><span>Texto para el aviso SAP</span><textarea id="wr" style="min-height:260px">${esc(txt)}</textarea></label>
        <p class="honest">APIE no tiene interfaz a SAP PM. Copia el texto y captúralo en IW21; registra el número de aviso en la tarea para trazabilidad.</p>`,
      footer: `<button class="btn" id="wt">${icon("tasks")} Crear tarea</button><button class="btn primary" id="wc">${icon("copy")} Copiar</button>`,
    });
    $("#wc", s.el).onclick = () => navigator.clipboard.writeText($("#wr", s.el).value).then(() => toast("Copiado: pégalo en IW21"));
    $("#wt", s.el).onclick = () => { s.close(); Screens.tareas.create({ title: `Generar aviso IW21 · ${a.tag}`, tipo: "Administrativo", prio: "P2", tag: a.tag, ubicacion: `${Data.sectorLabel(a.sector)} · ${a.planta}`, desc: $("#wr", s.el).value, subtasks: ["Capturar aviso en IW21", "Registrar núm. de aviso en la tarea"] }); };
  }
})();
