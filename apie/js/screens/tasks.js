/* Programador de tareas: CRUD, filtros/orden, vista lista/cuadrícula, deslizar para
   completar/reprogramar, mantener para reordenar, detalle con checklist, temporizador,
   notas, adjuntos e historial de actividad. */
(function () {
  const { icon, esc, $, $$, toast, sheet, confirm } = UI;
  const Screens = (window.Screens = window.Screens || {});
  const PRIO = { P1: "Crítica", P2: "Alta", P3: "Media", P4: "Baja" };
  const TIPOS = ["Preventivo", "Predictivo", "Correctivo", "Inspección", "Administrativo", "Seguridad"];
  const MAX_ATT = 1.5 * 1024 * 1024;
  const ui = { filtro: "abiertas", orden: "manual", tipo: "", vista: "lista" };

  const tasks = () => Store.get("tasks", []);
  const save = (list) => Store.set("tasks", list);
  const find = (id) => tasks().find((t) => t.id === id);
  function patch(id, fn, msg) {
    save(tasks().map((t) => {
      if (t.id !== id) return t;
      const c = structuredClone(t);
      const n = fn(c) || c;
      if (msg) n.history = [...(n.history || []), { ts: new Date().toISOString(), msg }];
      return n;
    }));
  }

  const prioPill = (p) => `<span class="pill p-${p}">${p === "P1" ? icon("alert") : p === "P2" ? icon("flag") : ""}${PRIO[p]}</span>`;
  function statusOf(t) { return t.status === "completada" ? "completada" : t.due < UI.today() ? "vencida" : t.status; }
  const ST = { completada: ["Completada", "check"], vencida: ["Vencida", "alert"], en_proceso: ["En proceso", "play"], pendiente: ["Pendiente", "clock"] };
  const statusPill = (t) => { const s = statusOf(t); return `<span class="pill st-${s}">${icon(ST[s][1])}${ST[s][0]}</span>`; };

  function filtered(q) {
    const hoy = UI.today(), n = UI.norm(q);
    let l = tasks().filter((t) => {
      if (ui.filtro === "abiertas" && t.status === "completada") return false;
      if (ui.filtro === "hoy" && (t.status === "completada" || t.due > hoy)) return false;
      if (ui.filtro === "vencidas" && (t.status === "completada" || t.due >= hoy)) return false;
      if (ui.filtro === "completadas" && t.status !== "completada") return false;
      if (ui.tipo && t.tipo !== ui.tipo) return false;
      return !n || UI.norm(`${t.title} ${t.desc} ${t.tag} ${t.ubicacion} ${t.sap}`).includes(n);
    });
    const by = {
      manual: (a, b) => a.order - b.order,
      fecha: (a, b) => a.due.localeCompare(b.due) || a.prio.localeCompare(b.prio),
      prioridad: (a, b) => a.prio.localeCompare(b.prio) || a.due.localeCompare(b.due),
      ubicacion: (a, b) => (a.ubicacion || "~").localeCompare(b.ubicacion || "~"),
      tipo: (a, b) => a.tipo.localeCompare(b.tipo),
    };
    return l.sort(by[ui.orden]);
  }

  function complete(id, done = true) {
    patch(id, (t) => {
      t.status = done ? "completada" : "pendiente";
      t.doneAt = done ? new Date().toISOString() : null;
      if (done && t.timer.since) { t.timer.total += Date.now() - t.timer.since; t.timer.since = null; }
    }, done ? "Completada" : "Reabierta");
  }
  function reschedule(id, date) { patch(id, (t) => { t.history.push({ ts: new Date().toISOString(), msg: `Reprogramada ${t.due} → ${date}` }); t.due = date; }); }

  function rescheduleSheet(id, after) {
    const t = find(id);
    const plus = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return UI.ymd(x); };
    const opts = [["Mañana", plus(1)], ["En 3 días", plus(3)], ["Próx. semana", plus(7)]];
    const s = sheet({
      title: "Reprogramar",
      body: `<p class="meta">${esc(t.title)} · actual: ${UI.fmtDate(t.due)}</p>
        <div class="btn-row">${opts.map(([l, d]) => `<button class="btn" data-d="${d}">${l}<small style="color:var(--text-2)">${UI.fmtDate(d)}</small></button>`).join("")}</div>
        <label class="field"><span>Otra fecha</span><input type="date" id="rd" value="${t.due}" min="${UI.today()}"></label>
        <button class="btn primary" id="rok" style="width:100%">Aplicar</button>`,
      onClose: after,
    });
    const apply = (d) => { reschedule(id, d); s.close(); toast(`Reprogramada para ${UI.fmtDate(d)}`); };
    $$("[data-d]", s.el).forEach((b) => (b.onclick = () => apply(b.dataset.d)));
    $("#rok", s.el).onclick = () => apply($("#rd", s.el).value);
  }

  Screens.tareas = {
    title: "Programador de tareas",
    search: "Buscar tarea, TAG, aviso SAP…",
    prioPill, statusPill, find,
    fabs: () => [{ icon: "plus", label: "Nueva tarea", run: () => openForm() }],
    render(v, q) {
      const l = filtered(q);
      const counts = { abiertas: 0, hoy: 0, vencidas: 0 };
      const hoy = UI.today();
      tasks().forEach((t) => { if (t.status !== "completada") { counts.abiertas++; if (t.due <= hoy) counts.hoy++; if (t.due < hoy) counts.vencidas++; } });
      v.innerHTML = `
        <div class="chip-row" role="group" aria-label="Filtro de estado">
          ${[["abiertas", `Abiertas ${counts.abiertas}`], ["hoy", `Hoy ${counts.hoy}`], ["vencidas", `Vencidas ${counts.vencidas}`], ["completadas", "Completadas"], ["todas", "Todas"]]
            .map(([k, lb]) => `<button class="chip" data-f="${k}" aria-pressed="${ui.filtro === k}">${lb}</button>`).join("")}
        </div>
        <div class="chip-row">
          <select class="chip" id="ord" aria-label="Ordenar por">${[["manual", "Orden: manual"], ["fecha", "Orden: fecha"], ["prioridad", "Orden: prioridad"], ["ubicacion", "Orden: ubicación"], ["tipo", "Orden: tipo"]].map(([k, lb]) => `<option value="${k}" ${ui.orden === k ? "selected" : ""}>${lb}</option>`).join("")}</select>
          <select class="chip" id="tip" aria-label="Tipo"><option value="">Tipo: todos</option>${TIPOS.map((x) => `<option ${ui.tipo === x ? "selected" : ""}>${x}</option>`).join("")}</select>
          <button class="chip" id="vw" aria-label="Cambiar vista">${icon(ui.vista === "lista" ? "grid" : "list")} ${ui.vista === "lista" ? "Cuadrícula" : "Lista"}</button>
        </div>
        ${ui.orden === "manual" && ui.vista === "lista" && l.length > 1 ? `<p class="drag-hint">Desliza → completar · ← reprogramar · mantén presionado para reordenar</p>` : ""}
        <ul class="list ${ui.vista === "grid" ? "grid-view" : ""}" id="tl">
          ${l.map((t) => `<li class="swipe" data-id="${t.id}"><div class="under"><span>${icon("check")} Completar</span><span>Reprogramar ${icon("clock")}</span></div>
            <div class="row ${t.status === "completada" ? "is-done" : ""}" tabindex="0">
              <button class="check" role="checkbox" aria-checked="${t.status === "completada"}" aria-label="Completar ${esc(t.title)}"><span>${icon("check")}</span></button>
              <div class="grow"><h3>${esc(t.title)}</h3>
                <div class="meta">${prioPill(t.prio)} ${statusPill(t)} <span>${icon("clock")}${UI.relDay(t.due)}</span></div>
                <div class="meta" style="margin-top:4px">${t.ubicacion ? `<span>${icon("pin")}${esc(t.ubicacion)}</span>` : ""}<span>${esc(t.tipo)}</span>${t.subtasks.length ? `<span>${icon("tasks")}${t.subtasks.filter((s) => s.done).length}/${t.subtasks.length}</span>` : ""}${t.timer.since ? `<span style="color:var(--ok-ink)">${icon("play")}En curso</span>` : ""}</div>
              </div></div></li>`).join("")}
        </ul>
        ${l.length ? "" : `<div class="empty">${icon("tasks")}${q ? "Sin coincidencias." : "No hay tareas en este filtro."}</div>`}`;

      $$("[data-f]", v).forEach((b) => (b.onclick = () => { ui.filtro = b.dataset.f; App.render(); }));
      $("#ord", v).onchange = (e) => { ui.orden = e.target.value; App.render(); };
      $("#tip", v).onchange = (e) => { ui.tipo = e.target.value; App.render(); };
      $("#vw", v).onclick = () => { ui.vista = ui.vista === "lista" ? "grid" : "lista"; App.render(); };
      $$(".swipe", v).forEach((li) => {
        const id = li.dataset.id, t = find(id);
        $(".check", li).onclick = () => { const was = t.status === "completada"; complete(id, !was); App.render(); if (!was) toast("Tarea completada", { label: "Deshacer", run: () => { complete(id, false); App.render(); } }); };
        UI.swipeable(li, {
          onTap: () => Screens.tareas.openDetail(id),
          onRight: () => { const was = t.status === "completada"; complete(id, !was); App.render(); if (!was) toast("Tarea completada", { label: "Deshacer", run: () => { complete(id, false); App.render(); } }); },
          onLeft: () => rescheduleSheet(id, () => App.render()),
        });
      });
      if (ui.orden === "manual" && ui.vista === "lista") UI.reorderable($("#tl", v), (ids) => {
        const pos = new Map(ids.map((x, i) => [x, i]));
        const visible = tasks().filter((t) => pos.has(t.id)).map((t) => t.order).sort((a, b) => a - b);
        save(tasks().map((t) => (pos.has(t.id) ? { ...t, order: visible[pos.get(t.id)] } : t)));
        App.render();
      });
    },

    openDetail(id) {
      const t = find(id); if (!t) return;
      let tab = "detalle", tick = null;
      const s = sheet({
        title: t.title, full: true,
        headerExtra: `<button class="icon-btn" id="ed" aria-label="Editar">${icon("edit")}</button><button class="icon-btn" id="del" aria-label="Eliminar">${icon("trash")}</button>`,
        body: `<div class="tabs" role="tablist">${[["detalle", "Detalle"], ["checklist", "Checklist"], ["notas", "Notas"], ["historial", "Historial"]].map(([k, l]) => `<button role="tab" data-tab="${k}">${l}</button>`).join("")}</div><div id="tb"></div>`,
        footer: `<button class="btn" id="rs">${icon("clock")} Reprogramar</button><button class="btn ok" id="cp"></button>`,
        onClose: () => { clearInterval(tick); App.render(); },
      });
      const draw = () => {
        const t = find(id);
        $$("[data-tab]", s.el).forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === tab));
        $("#cp", s.el).innerHTML = t.status === "completada" ? `${icon("sync")} Reabrir` : `${icon("check")} Completar`;
        const tb = $("#tb", s.el);
        clearInterval(tick);
        if (tab === "detalle") {
          const a = t.tag ? Data.get(t.tag) : null;
          const elapsed = () => t.timer.total + (t.timer.since ? Date.now() - t.timer.since : 0);
          tb.innerHTML = `<div class="meta">${prioPill(t.prio)} ${statusPill(t)} <span>${esc(t.tipo)}</span></div>
            <dl class="kv" style="margin-top:12px"><div><dt>Vence</dt><dd>${UI.fmtDate(t.due)} · ${UI.relDay(t.due)}</dd></div><div><dt>Ubicación</dt><dd>${esc(t.ubicacion || "—")}</dd></div>
              <div><dt>Activo</dt><dd>${t.tag ? `<a href="#" id="tag">${esc(t.tag)}</a>` : "—"}</dd></div><div><dt>Aviso / orden SAP</dt><dd>${esc(t.sap || "—")}</dd></div></dl>
            ${t.desc ? `<p style="white-space:pre-wrap">${esc(t.desc)}</p>` : ""}
            ${a ? `<div class="meta">${icon("asset")} ${esc(a.denom)} · ${Data.estadoPill(Data.estadoActual(a))}</div>` : ""}
            <h2 class="section">Temporizador</h2>
            <div class="card timer"><output id="tm">${UI.fmtDur(elapsed())}</output>
              <button class="btn ${t.timer.since ? "" : "primary"}" id="tgl">${t.timer.since ? icon("pause") + " Pausar" : icon("play") + " Iniciar"}</button></div>
            <h2 class="section">Adjuntos (${t.attachments.length})</h2>
            ${t.attachments.map((x, i) => `<div class="card meta" style="justify-content:space-between"><a href="${esc(x.data)}" download="${esc(x.name)}">${icon("clip")} ${esc(x.name)}</a><span>${Math.round(x.size / 1024)} KB <button class="icon-btn" data-rm="${i}" aria-label="Quitar adjunto">${icon("x")}</button></span></div>`).join("")}
            <label class="btn" style="width:100%">${icon("camera")} Agregar foto o archivo<input type="file" id="att" accept="image/*,application/pdf,.xlsx,.docx" capture="environment" hidden></label>`;
          const tm = $("#tm", tb);
          if (t.timer.since) tick = setInterval(() => (tm.textContent = UI.fmtDur(elapsed())), 1000);
          $("#tgl", tb).onclick = () => {
            patch(id, (x) => {
              if (x.timer.since) { x.timer.total += Date.now() - x.timer.since; x.timer.since = null; }
              else { x.timer.since = Date.now(); if (x.status === "pendiente") x.status = "en_proceso"; }
            }, find(id).timer.since ? "Temporizador pausado" : "Temporizador iniciado");
            draw();
          };
          const tg = $("#tag", tb); if (tg) tg.onclick = (e) => { e.preventDefault(); Screens.activos.openDetail(t.tag); };
          $$("[data-rm]", tb).forEach((b) => (b.onclick = async () => {
            if (!(await confirm({ title: "¿Quitar adjunto?", text: t.attachments[+b.dataset.rm].name, ok: "Quitar" }))) return;
            patch(id, (x) => { x.attachments.splice(+b.dataset.rm, 1); }, "Adjunto eliminado"); draw();
          }));
          $("#att", tb).onchange = (e) => readAttachment(e.target.files[0], (att) => { patch(id, (x) => { x.attachments.push(att); }, `Adjunto: ${att.name}`); draw(); });
        } else if (tab === "checklist") {
          tb.innerHTML = `<ul class="list checklist">${t.subtasks.map((st, i) => `<li class="${st.done ? "done" : ""}"><button class="check" role="checkbox" aria-checked="${st.done}" data-i="${i}" aria-label="Marcar"><span>${icon("check")}</span></button><input type="text" value="${esc(st.t)}" data-e="${i}" aria-label="Subtarea"><button class="icon-btn" data-x="${i}" aria-label="Eliminar subtarea">${icon("x")}</button></li>`).join("")}</ul>
            <form id="addst" class="chat-input" style="margin-top:10px"><input class="field" style="flex:1;min-height:var(--tap);border:1px solid var(--line);border-radius:10px;padding:0 12px;background:var(--surface-2)" placeholder="Nueva subtarea" id="nst"><button class="btn primary" aria-label="Agregar">${icon("plus")}</button></form>
            ${t.subtasks.length ? `<p class="meta">${t.subtasks.filter((x) => x.done).length} de ${t.subtasks.length} completadas</p>` : ""}`;
          $$("[data-i]", tb).forEach((b) => (b.onclick = () => { const i = +b.dataset.i; patch(id, (x) => { x.subtasks[i].done = !x.subtasks[i].done; }, `Subtarea ${find(id).subtasks[i].done ? "desmarcada" : "completada"}: ${find(id).subtasks[i].t}`); draw(); }));
          $$("[data-e]", tb).forEach((inp) => (inp.onchange = () => patch(id, (x) => { x.subtasks[+inp.dataset.e].t = inp.value; })));
          $$("[data-x]", tb).forEach((b) => (b.onclick = () => { patch(id, (x) => { x.subtasks.splice(+b.dataset.x, 1); }, "Subtarea eliminada"); draw(); }));
          $("#addst", tb).onsubmit = (e) => { e.preventDefault(); const v = $("#nst", tb).value.trim(); if (!v) return; patch(id, (x) => { x.subtasks.push({ t: v, done: false }); }, `Subtarea agregada: ${v}`); draw(); $("#nst", s.el).focus(); };
        } else if (tab === "notas") {
          tb.innerHTML = `<label class="field"><span>Notas de campo</span><textarea id="nt" style="min-height:40vh" placeholder="Lecturas, condiciones, observaciones…">${esc(t.notes)}</textarea></label><p class="meta">Se guarda automáticamente.</p>`;
          $("#nt", tb).oninput = UI.debounce((e) => patch(id, (x) => { x.notes = e.target.value; }), 400);
          $("#nt", tb).onblur = () => patch(id, (x) => x, "Notas actualizadas");
        } else {
          tb.innerHTML = `<ol class="timeline">${[...t.history].reverse().map((h) => `<li><time>${UI.fmtDT(h.ts)}</time>${esc(h.msg)}</li>`).join("")}</ol>`;
        }
      };
      $$("[data-tab]", s.el).forEach((b) => (b.onclick = () => { tab = b.dataset.tab; draw(); }));
      $("#cp", s.el).onclick = () => { const was = find(id).status === "completada"; complete(id, !was); if (!was) { s.close(); toast("Tarea completada", { label: "Deshacer", run: () => { complete(id, false); App.render(); } }); } else draw(); };
      $("#rs", s.el).onclick = () => rescheduleSheet(id, draw);
      $("#ed", s.el).onclick = () => { s.close(); openForm(find(id)); };
      $("#del", s.el).onclick = async () => {
        if (!(await confirm({ title: "¿Eliminar tarea?", text: `"${t.title}" y su historial se eliminarán de este equipo.`, ok: "Eliminar" }))) return;
        save(tasks().filter((x) => x.id !== id)); s.close(); toast("Tarea eliminada");
      };
      draw();
    },
    create: (p) => openForm(p, true),
  };

  function readAttachment(file, cb) {
    if (!file) return;
    if (file.size > MAX_ATT) return toast(`Archivo > ${MAX_ATT / 1048576} MB: súbelo a Drive y pega el enlace en notas`);
    const r = new FileReader();
    r.onload = () => cb({ name: file.name, type: file.type, size: file.size, data: r.result });
    r.readAsDataURL(file);
  }

  function openForm(t, prefill = false) {
    const editing = t && !prefill && t.id;
    const v = t || {};
    let prio = v.prio || "P3";
    const pending = [];
    const s = sheet({
      title: editing ? "Editar tarea" : "Nueva tarea",
      body: `<form id="tf" novalidate>
        <label class="field"><span>Título *</span><input name="title" required maxlength="140" value="${esc(v.title || "")}" placeholder="Ej. Termografía CCM-2A"></label>
        <span class="field"><span>Prioridad</span><div class="seg" id="pr">${Object.entries(PRIO).map(([k, l]) => `<button type="button" data-p="${k}" aria-pressed="${prio === k}">${l}</button>`).join("")}</div></span>
        <div class="two"><label class="field"><span>Vence</span><input type="date" name="due" value="${v.due || UI.today()}"></label>
          <label class="field"><span>Tipo</span><select name="tipo">${TIPOS.map((x) => `<option ${v.tipo === x ? "selected" : ""}>${x}</option>`).join("")}</select></label></div>
        <label class="field"><span>Ubicación (sector / planta / subestación)</span><input name="ubicacion" value="${esc(v.ubicacion || "")}" placeholder="Sector 2 · SE-015"></label>
        <div class="two"><label class="field"><span>TAG del activo</span><input name="tag" value="${esc(v.tag || "")}" autocapitalize="characters" placeholder="TR-SEP01-01A"></label>
          <label class="field"><span>Aviso / orden SAP</span><input name="sap" value="${esc(v.sap || "")}" inputmode="numeric" placeholder="10xxxxxxxx"></label></div>
        <label class="field"><span>Descripción</span><textarea name="desc">${esc(v.desc || "")}</textarea></label>
        ${editing ? "" : `<label class="btn" style="width:100%">${icon("clip")} Adjuntar foto o archivo<input type="file" id="fatt" accept="image/*,application/pdf" capture="environment" hidden></label><div id="fl" class="meta" style="margin-top:6px"></div>`}
      </form>`,
      footer: `<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="sv">${editing ? "Guardar" : "Crear tarea"}</button>`,
      onClose: () => App.render(),
    });
    $$("[data-p]", s.el).forEach((b) => (b.onclick = () => { prio = b.dataset.p; $$("[data-p]", s.el).forEach((x) => x.setAttribute("aria-pressed", x === b)); }));
    const fa = $("#fatt", s.el);
    if (fa) fa.onchange = (e) => readAttachment(e.target.files[0], (att) => { pending.push(att); $("#fl", s.el).textContent = pending.map((p) => p.name).join(", "); });
    const ubi = $("[name=ubicacion]", s.el), tagIn = $("[name=tag]", s.el);
    tagIn.onchange = () => { const a = Data.get(tagIn.value.trim().toUpperCase()); if (a && !ubi.value) ubi.value = `${Data.sectorLabel(a.sector)} · ${a.planta}`; };
    $("#sv", s.el).onclick = () => {
      const f = Object.fromEntries(new FormData($("#tf", s.el)));
      f.title = f.title.trim();
      if (!f.title) { $("[name=title]", s.el).focus(); return toast("El título es obligatorio"); }
      f.tag = f.tag.trim().toUpperCase();
      if (f.tag && !Data.get(f.tag)) toast(`Aviso: ${f.tag} no está en el censo SICM`);
      if (editing) patch(editing, (x) => Object.assign(x, f, { prio }), "Tarea editada");
      else {
        const minOrder = Math.min(0, ...tasks().map((x) => x.order));
        const n = Data.mkTask({ ...f, prio, subtasks: v.subtasks || [], order: minOrder - 1 });
        n.attachments = pending;
        save([n, ...tasks()]);
      }
      s.close(); toast(editing ? "Cambios guardados" : "Tarea creada");
    };
  }
})();
