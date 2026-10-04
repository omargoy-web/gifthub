/* Base de conocimientos: SOP, formatos/ventanas (Drive), lecciones aprendidas;
   búsqueda, visor integrado con anotaciones y marcadores, y FAB del asistente IA. */
(function () {
  const { icon, esc, $, $$, toast, sheet, confirm } = UI;
  const Screens = (window.Screens = window.Screens || {});
  const CATS = ["Todos", "Marcadores", "SOP", "Formato / Ventana operativa", "Criterio de aceptación", "Formato de prueba", "Lección aprendida"];
  const ui = { cat: "Todos", drive: [] };
  const docs = () => Data.seed.docs;
  const bm = () => Store.get("bookmarks", []);
  let current = null;

  const text = (d) => [d.titulo, d.categoria, d.norma, d.tecnica, d.periodicidad, d.causa, d.efecto, d.controles, d.deteccion, (d.familias || []).join(" "), (d.tags || []).join(" ")].filter(Boolean).join(" ");
  function score(d, terms) { const t = UI.norm(text(d)), ti = UI.norm(d.titulo); let s = 0; for (const w of terms) { if (!t.includes(w)) return 0; s += ti.includes(w) ? 3 : 1; } return s; }
  const highlight = (s, terms) => { let h = esc(s); terms.forEach((w) => { if (w.length > 2) h = h.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"), '<mark class="mark">$1</mark>'); }); return h; };

  Screens.saber = {
    title: "Base de conocimientos",
    search: "Buscar SOP, norma, formato, modo de falla…",
    fabs: () => [{ icon: "bot", label: "Preguntar al asistente IA", ai: true, run: () => App.openChat({ title: "Asistente técnico", context: current ? docContext(current) : "" }) }],
    render(v, q) {
      current = null;
      const terms = UI.norm(q).split(/\s+/).filter(Boolean);
      let l = docs().map((d) => ({ d, s: terms.length ? score(d, terms) : 1 })).filter((x) => x.s > 0);
      if (ui.cat === "Marcadores") l = l.filter((x) => bm().includes(x.d.id));
      else if (ui.cat !== "Todos") l = l.filter((x) => x.d.categoria === ui.cat);
      l.sort((a, b) => b.s - a.s || a.d.titulo.localeCompare(b.d.titulo));
      const notes = Store.get("annotations", {});
      v.innerHTML = `
        <div class="chip-row" role="group" aria-label="Categoría">${CATS.map((c) => `<button class="chip" data-c="${esc(c)}" aria-pressed="${ui.cat === c}">${c === "Marcadores" ? icon("star") : ""}${esc(c)}${c === "Marcadores" ? ` ${bm().length}` : ""}</button>`).join("")}</div>
        ${G.connected() && q ? `<button class="btn" id="dq" style="width:100%;margin-bottom:10px">${icon("drive")} Buscar "${esc(q)}" en Google Drive</button>` : ""}
        ${ui.drive.length && q ? `<h2 class="section">Drive (${ui.drive.length})</h2>${ui.drive.map((f) => `<a class="card meta" style="display:flex" href="${esc(f.webViewLink)}" target="_blank" rel="noopener"><img src="${esc(f.iconLink)}" alt="" width="16" height="16"> ${esc(f.name)}</a>`).join("")}` : ""}
        <h2 class="section">${l.length} documento(s)</h2>
        ${l.map(({ d }) => `<div class="card" data-doc="${esc(d.id)}" role="button" tabindex="0" style="cursor:pointer">
          <div class="meta" style="justify-content:space-between"><span class="pill p-P4">${esc(d.categoria)}</span><span>${bm().includes(d.id) ? icon("star") : ""}${(notes[d.id] || []).length ? ` ${icon("note")} ${(notes[d.id] || []).length}` : ""}</span></div>
          <h3 style="margin-top:6px">${highlight(d.titulo, terms)}</h3>
          <div class="meta">${d.norma ? highlight(d.norma, terms) : esc(d.fuente || "")}${d.rpn ? ` · RPN ${d.rpn}` : ""}</div></div>`).join("")}
        ${l.length ? "" : `<div class="empty">${icon("search")}Sin documentos. Prueba otra palabra o busca en Drive.</div>`}`;
      $$("[data-c]", v).forEach((b) => (b.onclick = () => { ui.cat = b.dataset.c; App.render(); }));
      $$("[data-doc]", v).forEach((c) => { c.onclick = () => this.openDoc(c.dataset.doc); c.onkeydown = (e) => e.key === "Enter" && this.openDoc(c.dataset.doc); });
      const dq = $("#dq", v);
      if (dq) dq.onclick = async () => { dq.disabled = true; try { ui.drive = await G.searchDrive(q); if (!ui.drive.length) toast("Sin resultados en Drive"); App.render(); } catch (e) { toast(e.message); dq.disabled = false; } };
    },

    openDoc(id) {
      const d = docs().find((x) => x.id === id); if (!d) return;
      current = d;
      const isBm = () => bm().includes(id);
      const s = sheet({
        title: d.titulo, full: true,
        headerExtra: `<button class="icon-btn" id="bk" aria-label="Marcador" aria-pressed="${isBm()}">${icon("star")}</button>`,
        body: `<div class="meta"><span class="pill p-P4">${esc(d.categoria)}</span> ${esc(d.fuente || "")}</div><div id="dv" style="margin-top:12px"></div>
          <h2 class="section">Anotaciones</h2><div id="an"></div>
          <form id="af" class="chat-input"><input id="ar" style="width:90px;min-height:var(--tap);border:1px solid var(--line);border-radius:10px;padding:0 10px;background:var(--surface-2)" placeholder="Pág./§"><textarea id="at" rows="1" placeholder="Agregar nota al documento…"></textarea><button class="btn primary" aria-label="Guardar nota">${icon("plus")}</button></form>`,
        footer: `<button class="btn" id="ai">${icon("bot")} Preguntar sobre este documento</button>`,
        onClose: () => { current = null; App.render(); },
      });
      const paint = () => {
        $("#bk", s.el).style.color = isBm() ? "var(--safety)" : "";
        $("#bk", s.el).setAttribute("aria-pressed", isBm());
        const list = (Store.get("annotations", {})[id] || []);
        $("#an", s.el).innerHTML = list.length ? list.map((n, i) => `<div class="card"><div class="meta" style="justify-content:space-between"><span>${n.ref ? `§ ${esc(n.ref)} · ` : ""}${UI.fmtDT(n.ts)}</span><button class="icon-btn" data-x="${i}" aria-label="Eliminar nota">${icon("trash")}</button></div><div style="white-space:pre-wrap">${esc(n.t)}</div></div>`).join("") : `<p class="meta">Sin anotaciones.</p>`;
        $$("[data-x]", s.el).forEach((b) => (b.onclick = async () => {
          if (!(await confirm({ title: "¿Eliminar anotación?", text: list[+b.dataset.x].t.slice(0, 80), ok: "Eliminar" }))) return;
          Store.update("annotations", {}, (a) => { a[id].splice(+b.dataset.x, 1); return a; }); paint();
        }));
      };
      $("#dv", s.el).innerHTML = viewer(d);
      $("#bk", s.el).onclick = () => { Store.set("bookmarks", isBm() ? bm().filter((x) => x !== id) : [...bm(), id]); paint(); toast(isBm() ? "Marcador agregado" : "Marcador quitado"); };
      $("#af", s.el).onsubmit = (e) => {
        e.preventDefault();
        const t = $("#at", s.el).value.trim(); if (!t) return;
        Store.update("annotations", {}, (a) => ({ ...a, [id]: [...(a[id] || []), { t, ref: $("#ar", s.el).value.trim(), ts: new Date().toISOString() }] }));
        $("#at", s.el).value = ""; $("#ar", s.el).value = ""; paint();
      };
      $("#ai", s.el).onclick = () => App.openChat({ title: "Asistente · " + d.titulo.slice(0, 40), context: docContext(d) });
      paint();
    },
  };

  function viewer(d) {
    if (d.drive_id) {
      return `<iframe class="doc-frame" src="https://drive.google.com/file/d/${encodeURIComponent(d.drive_id)}/preview" title="${esc(d.titulo)}" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>
        <div class="btn-row"><a class="btn" href="https://drive.google.com/file/d/${encodeURIComponent(d.drive_id)}/view" target="_blank" rel="noopener">${icon("drive")} Abrir en Drive</a></div>
        <p class="honest">La vista previa requiere sesión de Google con permiso sobre el archivo y red. Sin conexión, usa las anotaciones locales.</p>`;
    }
    const kv = (k, v) => (v ? `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>` : "");
    if (d.categoria === "SOP") {
      return `<dl class="kv">${kv("Técnica", d.tecnica)}${kv("Norma", d.norma)}${kv("Periodicidad", d.periodicidad)}${kv("Familias", (d.familias || []).map(Data.famLabel).join(", "))}</dl>
        <h2 class="section">Secuencia mínima de ejecución</h2>
        <ol style="padding-left:20px;line-height:1.7">
          <li>Análisis de Trabajo Seguro (ATS) y permiso de trabajo eléctrico vigentes.</li>
          <li>Verificar categoría de EPP contra el estudio de energía incidente del equipo (NFPA 70E / IEEE 1584).</li>
          <li>Coordinar con operación del sector: condición operativa y carga mínima requerida para la técnica.</li>
          <li>Ejecutar la técnica (${esc(d.tecnica || "")}) y registrar lecturas en el formato oficial.</li>
          <li>Comparar contra la ventana operativa / criterio de aceptación (${esc(d.norma || "")}).</li>
          <li>Si hay desviación: registrar falla en APIE y generar aviso SAP (IW21).</li>
        </ol>
        <p class="honest">Resumen operativo derivado del catálogo SICM-ELE. El procedimiento controlado vigente prevalece.</p>`;
    }
    return `<dl class="kv">${kv("Familia", (d.familias || []).map(Data.famLabel).join(", "))}${kv("RPN", d.rpn)}${kv("Norma base", d.norma)}</dl>
      <h2 class="section">Causa</h2><p>${esc(d.causa || "—")}</p><h2 class="section">Efecto</h2><p>${esc(d.efecto || "—")}</p>
      <h2 class="section">Detección</h2><p>${esc(d.deteccion || "—")}</p><h2 class="section">Control preventivo</h2><p>${esc(d.controles || "—")}</p>`;
  }

  function docContext(d) {
    const notes = (Store.get("annotations", {})[d.id] || []).map((n) => `- ${n.ref ? "§" + n.ref + ": " : ""}${n.t}`).join("\n");
    return `Documento: ${d.titulo}\nCategoría: ${d.categoria}\n${text(d)}${notes ? `\nAnotaciones del usuario:\n${notes}` : ""}`;
  }
})();
