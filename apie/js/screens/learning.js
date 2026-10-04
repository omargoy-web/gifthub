/* Centro de aprendizaje: perfil de competencias (actual vs meta), plan priorizado por
   brecha, feed curado con progreso, cuestionarios y certificados compartibles.
   Contenido curado manualmente (MVE): sin URLs externas para no publicar enlaces rotos. */
(function () {
  const { icon, esc, $, $$, toast, sheet, confirm } = UI;
  const Screens = (window.Screens = window.Screens || {});

  const COMPETENCIAS = [
    { id: "prot", nombre: "Relevadores y coordinación de protecciones", actual: 3, meta: 5 },
    { id: "mcsa", nombre: "MCSA / diagnóstico de motores", actual: 2, meta: 4 },
    { id: "aisl", nombre: "Pruebas de aislamiento (IEEE 43)", actual: 4, meta: 5 },
    { id: "termo", nombre: "Termografía (NFPA 70B / NETA)", actual: 3, meta: 4 },
    { id: "trafo", nombre: "Transformadores: aceite y DGA", actual: 3, meta: 4 },
    { id: "arco", nombre: "Seguridad eléctrica y arco (NFPA 70E)", actual: 4, meta: 5 },
    { id: "rcm", nombre: "RCM / FMECA / ISO 14224", actual: 3, meta: 5 },
    { id: "pq", nombre: "Calidad de energía (IEEE 519)", actual: 2, meta: 3 },
    { id: "datos", nombre: "Python y analítica de activos", actual: 3, meta: 4 },
  ];

  const FEED = [
    { id: "c1", comp: "prot", tipo: "Curso", titulo: "Análisis de oscilografía y registros de eventos en relevadores multifunción", fuente: "Fabricante de relevadores (programa de capacitación)", min: 480 },
    { id: "c2", comp: "prot", tipo: "Artículo", titulo: "Coordinación 50/51 en alimentadores radiales de MT: márgenes de tiempo de coordinación", fuente: "IEEE Std 242 (Buff Book)", min: 45 },
    { id: "c3", comp: "mcsa", tipo: "Video", titulo: "Bandas laterales f(1±2s) para barras rotas: lectura del espectro de corriente", fuente: "Sesión interna SICM", min: 30 },
    { id: "c4", comp: "mcsa", tipo: "Artículo", titulo: "Excentricidad estática vs dinámica en MCSA y correlación con vibración", fuente: "Revisión técnica", min: 40 },
    { id: "c5", comp: "aisl", tipo: "Norma", titulo: "IEEE 43-2013: IR, índice de polarización y corrección por temperatura", fuente: "IEEE", min: 90 },
    { id: "c6", comp: "termo", tipo: "Curso", titulo: "Termografía Nivel I (ISO 18436-7) — refresco de criterios ΔT", fuente: "Organismo certificador", min: 1920 },
    { id: "c7", comp: "trafo", tipo: "Norma", titulo: "IEEE C57.104-2019: interpretación de gases disueltos por niveles y tasas", fuente: "IEEE", min: 120 },
    { id: "c8", comp: "arco", tipo: "Norma", titulo: "NFPA 70E: fronteras de aproximación, EPP y condición eléctricamente segura", fuente: "NFPA", min: 180 },
    { id: "c9", comp: "rcm", tipo: "Curso", titulo: "RCM II: intervalo P-F y selección de tareas a condición", fuente: "Programa de confiabilidad", min: 960 },
    { id: "c10", comp: "rcm", tipo: "Norma", titulo: "ISO 14224: taxonomía y códigos de modo de falla para equipo eléctrico", fuente: "ISO", min: 120 },
    { id: "c11", comp: "pq", tipo: "Norma", titulo: "IEEE 519-2022: límites de THD de tensión y TDD de corriente en el PCC", fuente: "IEEE", min: 60 },
    { id: "c12", comp: "datos", tipo: "Taller", titulo: "Detección de anomalías en series de condición con Python (pandas + scikit-learn)", fuente: "Autoaprendizaje", min: 240 },
  ];

  // Preguntas verificadas contra la norma citada en cada explicación.
  const QUIZ = {
    aisl: [
      { q: "Según IEEE 43, el índice de polarización (PI) se calcula como:", o: ["IR a 10 min / IR a 1 min", "IR a 1 min / IR a 30 s", "IR a 60 s × 10", "IR a 10 min − IR a 1 min"], a: 0, x: "PI = IR10min / IR1min (IEEE 43 §5.4)." },
      { q: "PI mínimo recomendado por IEEE 43 para aislamiento clase F:", o: ["1.5", "2.0", "1.0", "4.0"], a: 1, x: "Clases B, F y H: PI mínimo 2.0; clase A: 1.5 (IEEE 43 Tabla 3)." },
      { q: "IEEE 43 corrige las lecturas de IR a una temperatura base de:", o: ["20 °C", "25 °C", "40 °C", "75 °C"], a: 2, x: "Se refiere a 40 °C para comparar tendencias." },
    ],
    prot: [
      { q: "En IEEE C37.2, el dispositivo 51 corresponde a:", o: ["Sobrecorriente instantánea", "Sobrecorriente de tiempo CA", "Diferencial", "Bajo voltaje"], a: 1, x: "50 = instantáneo, 51 = tiempo inverso CA, 87 = diferencial, 27 = bajo voltaje." },
      { q: "El dispositivo 86 en IEEE C37.2 es:", o: ["Relevador de bloqueo (lockout)", "Relevador de recierre", "Relevador de frecuencia", "Relevador direccional"], a: 0, x: "86 = relevador auxiliar de bloqueo sostenido; 79 = recierre." },
      { q: "La protección de diferencial de transformador se designa:", o: ["87T", "50N", "67", "81"], a: 0, x: "87 = diferencial; el sufijo T identifica transformador." },
    ],
    mcsa: [
      { q: "Las bandas laterales de barras rotas del rotor aparecen en:", o: ["f(1 ± 2s)", "f(1 ± s)", "2f", "f × número de polos"], a: 0, x: "Componentes en (1±2s)·f alrededor de la fundamental, s = deslizamiento." },
      { q: "Un motor 4 polos, 60 Hz, 1764 RPM tiene un deslizamiento de:", o: ["1 %", "2 %", "3 %", "4 %"], a: 1, x: "ns = 120·60/4 = 1800 RPM; s = (1800−1764)/1800 = 2 %." },
    ],
    termo: [
      { q: "NETA MTS: ΔT >15 °C entre componentes similares con carga similar indica:", o: ["Posible deficiencia", "Probable deficiencia", "Discrepancia mayor: reparar de inmediato", "Normal"], a: 2, x: "1–3 °C posible, 4–15 °C probable, >15 °C discrepancia mayor (NETA MTS Tabla 100.18)." },
      { q: "Desde la edición 2023, NFPA 70B pasó a ser:", o: ["Práctica recomendada", "Norma (estándar obligatorio en su alcance)", "Guía informativa", "Apéndice de NFPA 70E"], a: 1, x: "NFPA 70B-2023 se convirtió en estándar con requisitos obligatorios." },
    ],
    trafo: [
      { q: "En DGA, la presencia relevante de acetileno (C2H2) se asocia principalmente a:", o: ["Arqueo / descargas de alta energía", "Envejecimiento normal de papel", "Humedad en aceite", "Sobrecarga leve"], a: 0, x: "C2H2 es el gas clave de arcos de alta energía." },
      { q: "ASTM D1816 mide rigidez dieléctrica con electrodos VDE y separación de:", o: ["2.5 mm", "1 mm o 2 mm", "5 mm", "0.5 mm"], a: 1, x: "D1816: electrodos VDE, 1 mm o 2 mm. D877 usa discos a 2.5 mm." },
    ],
    arco: [
      { q: "La frontera de arco eléctrico (NFPA 70E) es la distancia donde la energía incidente es:", o: ["1.2 cal/cm²", "4 cal/cm²", "8 cal/cm²", "40 cal/cm²"], a: 0, x: "1.2 cal/cm² ≈ umbral de quemadura de segundo grado." },
    ],
    rcm: [
      { q: "En RCM, el intervalo de una tarea a condición debe ser:", o: ["Mayor que el intervalo P-F", "Menor que el intervalo P-F (típicamente la mitad)", "Igual al MTBF", "Independiente del P-F"], a: 1, x: "Se inspecciona a una fracción del P-F (comúnmente ½) para detectar antes de la falla funcional." },
    ],
    pq: [
      { q: "IEEE 519 limita el THD de tensión en el PCC para buses ≤1 kV a:", o: ["3 %", "5 %", "8 %", "12 %"], a: 2, x: "≤1 kV: 8 %; >1 kV a 69 kV: 5 % (IEEE 519 Tabla 1)." },
    ],
    datos: [
      { q: "Para detectar anomalías multivariables sin etiquetas de falla, un enfoque adecuado es:", o: ["Regresión lineal simple", "Isolation Forest", "Clasificador supervisado sin etiquetas", "Media móvil de una variable"], a: 1, x: "Isolation Forest es no supervisado y aísla puntos atípicos en espacios multivariables." },
    ],
  };

  const L = () => Store.get("learning", { comp: {}, prog: {}, quiz: {}, certs: [] });
  const setL = (fn) => Store.update("learning", { comp: {}, prog: {}, quiz: {}, certs: [] }, fn);
  function metas() { const l = L(); return COMPETENCIAS.map((c) => ({ ...c, ...(l.comp[c.id] || {}) })).sort((a, b) => (b.meta - b.actual) - (a.meta - a.actual)); }

  Screens.aprender = {
    title: "Centro de aprendizaje",
    search: "Buscar curso, norma, competencia…",
    metas,
    render(v, q) {
      const l = L(), m = metas(), n = UI.norm(q);
      const plan = m.filter((c) => c.meta > c.actual);
      const feed = FEED.filter((f) => !n || UI.norm(f.titulo + " " + f.fuente + " " + f.tipo).includes(n))
        .sort((a, b) => plan.findIndex((c) => c.id === a.comp) - plan.findIndex((c) => c.id === b.comp));
      v.innerHTML = `
        <h2 class="section">Perfil de competencias <button class="btn ghost" id="edc">${icon("edit")} Editar</button></h2>
        <div class="card" role="img" aria-label="Nivel actual contra meta">${m.map((c) => `<div class="meter"><div class="top"><b>${esc(c.nombre)}</b><span>${c.actual}/${c.meta}</span></div><div class="track"><div class="fill" style="width:${c.actual * 20}%"></div><div class="goal" style="left:calc(${c.meta * 20}% - 1px)"></div></div></div>`).join("")}
          <div class="legend"><span><i style="background:var(--primary)"></i>Actual</span><span><i style="background:var(--text);width:2px"></i>Meta</span></div></div>
        <h2 class="section">Plan personalizado (por brecha)</h2>
        ${plan.slice(0, 4).map((c, i) => { const items = FEED.filter((f) => f.comp === c.id); const qz = (l.quiz[c.id] || {}); return `<div class="card">
          <div class="meta" style="justify-content:space-between"><span class="pill ${i === 0 ? "p-P1" : "p-P3"}">Brecha ${c.meta - c.actual}</span><span>${items.filter((f) => (l.prog[f.id] || 0) >= 100).length}/${items.length} recursos</span></div>
          <h3 style="margin-top:6px">${esc(c.nombre)}</h3>
          ${QUIZ[c.id] ? `<button class="btn" data-qz="${c.id}" style="margin-top:6px">${icon("check")} Cuestionario${qz.best != null ? ` · mejor ${qz.best}%` : ""}</button>` : ""}</div>`; }).join("") || `<div class="card empty">${icon("check")}Metas alcanzadas. Ajusta tu perfil.</div>`}
        <h2 class="section">Feed curado</h2>
        ${feed.map((f) => { const p = l.prog[f.id] || 0; return `<div class="card" data-f="${f.id}" role="button" tabindex="0" style="cursor:pointer"><div class="meta" style="justify-content:space-between"><span class="pill p-P4">${esc(f.tipo)}</span><span>${Math.round(f.min / 60 * 10) / 10} h</span></div>
          <h3 style="margin-top:6px">${esc(f.titulo)}</h3><div class="meta">${esc(f.fuente)}</div>
          <div class="meter" style="margin-bottom:0"><div class="track" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><div class="fill" style="width:${p}%;background:${p >= 100 ? "var(--ok)" : "var(--primary)"}"></div></div><div class="meta">${p >= 100 ? icon("check") + " Completado" : p + " %"}</div></div></div>`; }).join("")}
        <h2 class="section">Certificados y logros <button class="btn ghost" id="adc">${icon("plus")} Agregar</button></h2>
        ${l.certs.length ? l.certs.map((c, i) => `<div class="card"><div class="meta" style="justify-content:space-between"><span>${icon("shield")} ${esc(c.emisor)} · ${UI.fmtDate(c.fecha)}</span><span><button class="icon-btn" data-sh="${i}" aria-label="Compartir">${icon("share")}</button><button class="icon-btn" data-dc="${i}" aria-label="Eliminar">${icon("trash")}</button></span></div><h3>${esc(c.nombre)}</h3></div>`).join("")
          : `<div class="card empty">${icon("shield")}Registra certificaciones (MLA I, termografía, NFPA 70E…) para compartirlas.</div>`}
        <p class="honest">Catálogo curado manualmente para el MVE. Los recursos externos se consultan por su nombre en el portal del emisor.</p>`;
      $("#edc", v).onclick = editProfile;
      $$("[data-qz]", v).forEach((b) => (b.onclick = () => runQuiz(b.dataset.qz)));
      $$("[data-f]", v).forEach((c) => (c.onclick = () => progressSheet(c.dataset.f)));
      $("#adc", v).onclick = addCert;
      $$("[data-sh]", v).forEach((b) => (b.onclick = () => shareCert(L().certs[+b.dataset.sh])));
      $$("[data-dc]", v).forEach((b) => (b.onclick = async () => {
        const c = L().certs[+b.dataset.dc];
        if (!(await confirm({ title: "¿Eliminar certificado?", text: c.nombre, ok: "Eliminar" }))) return;
        setL((x) => { x.certs.splice(+b.dataset.dc, 1); return x; }); App.render();
      }));
    },
  };

  function editProfile() {
    const m = metas();
    const s = sheet({
      title: "Perfil de competencias",
      body: m.map((c) => `<div class="card"><h3>${esc(c.nombre)}</h3><div class="two">
        <label class="field"><span>Actual (0–5)</span><input type="number" min="0" max="5" data-a="${c.id}" value="${c.actual}"></label>
        <label class="field"><span>Meta (0–5)</span><input type="number" min="0" max="5" data-m="${c.id}" value="${c.meta}"></label></div></div>`).join(""),
      footer: `<button class="btn primary" id="sp">Guardar</button>`,
      onClose: () => App.render(),
    });
    $("#sp", s.el).onclick = () => {
      const clamp = (x) => Math.max(0, Math.min(5, Math.round(+x || 0)));
      setL((l) => { m.forEach((c) => { l.comp[c.id] = { actual: clamp($(`[data-a=${c.id}]`, s.el).value), meta: clamp($(`[data-m=${c.id}]`, s.el).value) }; }); return l; });
      s.close(); toast("Perfil actualizado");
    };
  }

  function progressSheet(id) {
    const f = FEED.find((x) => x.id === id);
    const s = sheet({
      title: f.tipo,
      body: `<h3>${esc(f.titulo)}</h3><p class="meta">${esc(f.fuente)} · ${Math.round(f.min / 6) / 10} h</p>
        <span class="field"><span>Progreso</span><div class="seg">${[0, 25, 50, 75, 100].map((p) => `<button data-p="${p}" aria-pressed="${(L().prog[id] || 0) === p}">${p}%</button>`).join("")}</div></span>`,
      onClose: () => App.render(),
    });
    $$("[data-p]", s.el).forEach((b) => (b.onclick = () => { setL((l) => { l.prog[id] = +b.dataset.p; return l; }); s.close(); if (+b.dataset.p === 100) toast("Recurso completado"); }));
  }

  function runQuiz(comp) {
    const qs = QUIZ[comp]; let i = 0, ok = 0;
    const s = sheet({ title: "Cuestionario", body: `<div id="qb"></div>`, onClose: () => App.render() });
    const draw = () => {
      const qb = $("#qb", s.el);
      if (i >= qs.length) {
        const pct = Math.round((100 * ok) / qs.length);
        setL((l) => { const p = l.quiz[comp] || {}; l.quiz[comp] = { best: Math.max(p.best || 0, pct), last: pct, ts: new Date().toISOString() }; return l; });
        qb.innerHTML = `<div class="empty">${icon(pct >= 80 ? "check" : "learn")}<h3>${ok}/${qs.length} correctas · ${pct}%</h3><p>${pct >= 80 ? "Dominio confirmado." : "Repasa la norma citada y repite."}</p></div><button class="btn primary" data-close style="width:100%">Cerrar</button>`;
        return;
      }
      const q = qs[i];
      qb.innerHTML = `<p class="meta">Pregunta ${i + 1} de ${qs.length}</p><h3 style="margin:6px 0 12px">${esc(q.q)}</h3>
        ${q.o.map((o, k) => `<button class="btn" data-k="${k}" style="width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left">${esc(o)}</button>`).join("")}<div id="qx"></div>`;
      $$("[data-k]", qb).forEach((b) => (b.onclick = () => {
        const k = +b.dataset.k, right = k === q.a; if (right) ok++;
        $$("[data-k]", qb).forEach((x) => { x.disabled = true; if (+x.dataset.k === q.a) x.classList.add("ok"); });
        if (!right) b.classList.add("danger");
        $("#qx", qb).innerHTML = `<p class="honest">${right ? "Correcto. " : "Incorrecto. "}${esc(q.x)}</p><button class="btn primary" id="qn" style="width:100%">${i + 1 < qs.length ? "Siguiente" : "Ver resultado"}</button>`;
        $("#qn", qb).onclick = () => { i++; draw(); };
      }));
    };
    draw();
  }

  function addCert() {
    const s = sheet({
      title: "Agregar certificado",
      body: `<form id="cf"><label class="field"><span>Nombre *</span><input name="nombre" required placeholder="Machine Lubrication Analyst I (MLA I)"></label>
        <label class="field"><span>Emisor</span><input name="emisor" placeholder="ICML"></label>
        <label class="field"><span>Fecha</span><input type="date" name="fecha" value="${UI.today()}"></label>
        <label class="field"><span>Destacado (para compartir)</span><textarea name="nota" placeholder="Aplicado en correlación aceite–vibración–MCSA en motores de baja velocidad."></textarea></label></form>`,
      footer: `<button class="btn primary" id="cs">Guardar</button>`,
      onClose: () => App.render(),
    });
    $("#cs", s.el).onclick = () => {
      const c = Object.fromEntries(new FormData($("#cf", s.el)));
      if (!c.nombre.trim()) return toast("El nombre es obligatorio");
      setL((l) => { l.certs.push(c); return l; }); s.close(); toast("Certificado agregado");
    };
  }

  function shareCert(c) {
    const sess = Store.get("session") || {};
    const text = `${sess.name || ""} — ${c.nombre}${c.emisor ? " (" + c.emisor + ")" : ""}, ${UI.fmtDate(c.fecha)}.${c.nota ? "\n" + c.nota : ""}`;
    if (navigator.share) navigator.share({ title: c.nombre, text }).catch(() => {});
    else navigator.clipboard.writeText(text).then(() => toast("Copiado para compartir"));
  }
})();
