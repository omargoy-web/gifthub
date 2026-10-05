/* Capa de datos: censo SICM-ELE (seed.js) + estado derivado del historial real
   + generadores de datos de arranque (tareas/eventos de ejemplo, marcados como tales). */
(function () {
  const S = window.APIE_SEED || { activos: { cols: [], rows: [], plantas: [] }, historial: {}, docs: [], actividades: [], kpi_sector: [], ranking: [] };
  const C = S.activos.cols;
  const ix = Object.fromEntries(C.map((c, i) => [c, i]));

  const FAMILIAS = {
    motor: "Motor", arrancador: "Arrancador", relevador: "Relevador", interruptor: "Interruptor", tablero: "Tablero",
    transformador: "Transformador aceite", transformador_seco: "Transformador seco", ccm: "CCM", alumbrado: "Alumbrado",
    baterias: "Baterías", circuito_potencia: "Circuito de potencia", pararrayos: "Pararrayos", sistema_tierra: "Sistema de tierras", subestacion: "Subestación",
  };
  const famLabel = (f) => FAMILIAS[f] || f;
  const SECTORES = [1, 2, 3, 4, 5, 6, 7, 8, "TALLERES"];
  const sectorLabel = (s) => (s == null || s === "" ? "Sin sector" : String(s).toUpperCase() === "TALLERES" ? "Talleres" : `Sector ${s}`);

  let assets = null, byTag = null;
  function all() {
    if (assets) return assets;
    assets = S.activos.rows.map((r) => {
      const o = {};
      C.forEach((c, i) => { o[c] = r[i]; });
      o.planta = S.activos.plantas[r[ix.planta]] || "";
      const h = S.historial[o.tag];
      o.estado = h && h.length ? h[0].estado : "sin_dx";
      o.ultima = h && h.length ? h[0].fecha : null;
      o._q = UI.norm(`${o.tag} ${o.denom} ${o.planta} ${o.sap || ""} ${famLabel(o.familia)}`);
      return o;
    });
    byTag = new Map(assets.map((a) => [a.tag, a]));
    return assets;
  }
  const get = (tag) => (all(), byTag.get(tag));
  const historial = (tag) => S.historial[tag] || [];

  // Fallas registradas desde la app también alimentan el estado del activo.
  function faultMap() {
    const m = new Map();
    for (const f of Store.get("faults", [])) { const p = m.get(f.tag); if (!p || f.ts > p.ts) m.set(f.tag, f); }
    return m;
  }
  function estadoActual(a, fm = faultMap()) {
    const f = fm.get(a.tag);
    if (f && (!a.ultima || f.ts > a.ultima)) return f.severidad === "Alta" ? "alarma" : "alerta";
    return a.estado;
  }

  const ESTADOS = { normal: ["Normal", "check"], alerta: ["Alerta", "alert"], alarma: ["Alarma", "alert"], sin_dx: ["Sin diagnóstico", "clock"] };
  const estadoPill = (e) => `<span class="pill st-${e}">${UI.icon(ESTADOS[e][1])}${ESTADOS[e][0]}</span>`;

  // Modos de falla por familia (alineados con la matriz FMEA / ISO 14224 Anexo B).
  const MODOS = {
    motor: ["Sobretemperatura devanado", "Vibración alta", "Falla de rodamiento", "Desbalance de corriente", "Bajo aislamiento (IR/IP)", "Barras de rotor rotas", "No arranca", "Disparo por protección"],
    transformador: ["Sobretemperatura aceite/devanado", "Fuga de aceite", "Gases disueltos anormales (DGA)", "Rigidez dieléctrica baja", "Falla en cambiador de derivaciones", "Disparo Buchholz/presión súbita"],
    transformador_seco: ["Punto caliente en devanado", "Ventilación forzada inoperante", "Contaminación/tracking superficial"],
    tablero: ["Punto caliente en conexión", "Efecto corona / tracking", "Humedad / corrosión", "Interlock dañado"],
    interruptor: ["Punto caliente en contactos", "Falla de mecanismo de operación", "No cierra / no abre", "Pérdida de SF6 / vacío"],
    arrancador: ["Punto caliente en contactor", "Bobina de contactor dañada", "Relevador de sobrecarga disparado", "Fusible fundido"],
    relevador: ["Pérdida de comunicación", "Ajustes fuera de estudio", "Autodiagnóstico en falla", "Disparo en falso"],
    ccm: ["Desbalance de tensión", "Punto caliente en bus", "Cubículo con daño mecánico"],
    baterias: ["Celda con baja tensión", "Alta impedancia interna", "Sulfatación / corrosión en bornes", "Cargador en falla"],
    sistema_tierra: ["Resistencia de red fuera de norma", "Conductor de tierra dañado/robado"],
    pararrayos: ["Bajante dañada", "Resistencia de electrodo alta"],
    alumbrado: ["Luminaria apagada", "Falla a tierra en circuito", "Tablero de alumbrado dañado"],
  };
  const modos = (f) => (MODOS[f] || []).concat(["Otro"]);

  // ── Tareas de arranque: se derivan del censo y del historial real, no inventan hallazgos ──
  function seedTasks() {
    const t0 = UI.today();
    const add = (d) => { const x = new Date(); x.setDate(x.getDate() + d); return UI.ymd(x); };
    const out = [];
    const alertas = Object.entries(S.historial).filter(([, h]) => h[0] && h[0].estado !== "normal").slice(0, 4);
    alertas.forEach(([tag, h], i) => {
      const a = get(tag);
      out.push(mkTask({
        title: `Seguimiento ${h[0].estado} · ${tag}`, tipo: "Predictivo", prio: h[0].estado === "alarma" ? "P1" : "P2", due: i < 2 ? t0 : add(i),
        tag, ubicacion: a ? `${sectorLabel(a.sector)} · ${a.planta}` : "", desc: `Hallazgo del recorrido ${h[0].folio || ""} (${h[0].act}). Confirmar con segunda técnica antes de generar aviso SAP.`,
        subtasks: ["Revisar oscilografía / lecturas previas", "Medición de confirmación", "Generar aviso IW21 si se confirma"],
      }));
    });
    S.ranking.slice(0, 3).forEach((r, i) => out.push(mkTask({
      title: `Termografía activo crítico #${r.rank} · ${r.tag}`, tipo: "Predictivo", prio: i === 0 ? "P1" : "P2", due: add(i + 1),
      tag: r.tag, ubicacion: `${sectorLabel(r.sector)}`, desc: `${r.denom}. Ruta IEA-TAB/IEA-INT, NFPA 70B. Registrar ΔT contra componente similar (NETA MTS Tabla 100.18).`,
      subtasks: ["ATS y permiso eléctrico firmados", "EPP categoría según estudio de arco (NFPA 70E)", "Captura termográfica y ΔT", "Cargar resultados"],
    })));
    out.push(mkTask({ title: "Revisión de ajustes relevadores SE-015", tipo: "Preventivo", prio: "P3", due: add(3), ubicacion: "Sector 2 · SE-015", desc: "Comparar ajustes instalados contra estudio de coordinación vigente (IEEE C37.90 / C37.2).", subtasks: ["Descargar settings vía AcSELerator/PCM600", "Comparar contra estudio", "Reporte de desviaciones"] }));
    out.push(mkTask({ title: "Cerrar avisos PM02 vencidos en SAP", tipo: "Administrativo", prio: "P3", due: t0, desc: "Depurar backlog de avisos eléctricos con fecha de vencimiento < hoy.", subtasks: [] }));
    out.push(mkTask({ title: "Prueba de rigidez dieléctrica · transformadores desaladora", tipo: "Predictivo", prio: "P4", due: add(6), desc: "ASTM D1816 (gap 1 mm / 2 mm). Coordinar toma de muestra con operación.", subtasks: ["Toma de muestra", "Envío a laboratorio"] }));
    out.forEach((t, i) => { t.order = i; t.demo = true; });
    return out;
  }

  function mkTask(p) {
    return {
      id: uid("t_"), title: p.title || "", desc: p.desc || "", due: p.due || UI.today(), prio: p.prio || "P3", tipo: p.tipo || "Preventivo",
      ubicacion: p.ubicacion || "", tag: p.tag || "", sap: p.sap || "", status: "pendiente",
      subtasks: (p.subtasks || []).map((t) => ({ t, done: false })), notes: "", timer: { since: null, total: 0 },
      attachments: [], history: [{ ts: new Date().toISOString(), msg: "Tarea creada" }], order: p.order ?? Date.now(), created: new Date().toISOString(),
    };
  }

  function seedEvents() {
    const at = (d, h, m = 0) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); return UI.localISO(x); };
    const E = (d, h, dur, title, tipo, extra = {}) => ({ id: uid("e_"), src: "local", demo: true, title, tipo, start: at(d, h), end: at(d, h + dur), desc: "", attendees: [], attachments: [], location: "", video: "", ...extra });
    return [
      E(0, 7, 1, "Pláticas de seguridad 5 min · Coordinación Eléctrica", "seguridad", { location: "Taller eléctrico", desc: "Tema: bloqueo y etiquetado (LOTO) en CCM 480 V." }),
      E(0, 11, 1, "Coordinación con operación Sector 2 · libranza SE-015", "operacion", { desc: "1. Ventana de libranza\n2. Cargas a transferir\n3. Permisos y responsables", video: "https://meet.google.com/" }),
      E(1, 9, 2, "Revisión de backlog SAP PM · SICM", "gerencial", { desc: "Avisos PM02 vencidos, cumplimiento del programa, recursos de contratista." }),
      E(2, 8, 4, "Paro programado bomba GA-1101 · mantenimiento motor 4.16 kV", "mantenimiento", { desc: "IR/IP IEEE 43, inspección de rodamientos, MCSA en arranque." }),
      E(4, 10, 2, "Capacitación: análisis de oscilografía SEL", "capacitacion", { video: "https://meet.google.com/" }),
    ];
  }

  // Clasificación por palabras clave para eventos de Google (que no traen "tipo").
  function tipoEvento(e) {
    if (e.tipo) return e.tipo;
    const t = UI.norm(e.title + " " + e.desc);
    if (/segur|ats|permiso|loto|epp|5 min|incidente/.test(t)) return "seguridad";
    if (/capacit|curso|taller|entrenamiento|webinar/.test(t)) return "capacitacion";
    if (/paro|libranza|mantenim|prueba|termograf|pm0/.test(t)) return "mantenimiento";
    if (/operaci|sector|coordinaci|turno/.test(t)) return "operacion";
    if (/gerenc|superintend|kpi|revisi|backlog|junta/.test(t)) return "gerencial";
    return "otro";
  }
  const TIPOS_EV = { seguridad: "Seguridad", operacion: "Operación", mantenimiento: "Mantenimiento", capacitacion: "Capacitación", gerencial: "Gerencial", otro: "Otro" };

  window.Data = { seed: S, all, get, historial, estadoActual, faultMap, estadoPill, ESTADOS, FAMILIAS, famLabel, SECTORES, sectorLabel, modos, seedTasks, mkTask, seedEvents, tipoEvento, TIPOS_EV };
})();
