/* Primitivas de UI: iconos, escape, hojas modales, confirmaciones, toasts y gestos
   (deslizar para completar, mantener para reordenar, jalar para sincronizar). */
(function () {
  const P = {
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
    tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    cal: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    asset: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4zM20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
    learn: '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    next: '<path d="M9 18l6-6-6-6"/>',
    sync: '<path d="M21 12a9 9 0 0 1-15.5 6.3L3 16M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5M3 21v-5h5"/>',
    down: '<path d="M12 5v14M5 12l7 7 7-7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    alert: '<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 18h.01"/>',
    flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
    video: '<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M22 20c0-2.6-1.7-4.7-4-5.6"/>',
    clip: '<path d="M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>',
    note: '<path d="M4 4h12l4 4v12H4z"/><path d="M8 10h8M8 14h8M8 18h5"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    pause: '<path d="M7 4v16M17 4v16"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    star: '<path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z"/>',
    bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 4v4M9 14h.01M15 14h.01M9 17h6"/>',
    send: '<path d="M4 12l16-8-6 16-3-7z"/>',
    share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    out: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    drive: '<path d="M8 3h8l6 11-4 7H6l-4-7z"/><path d="M8 3l6 11H2M16 3L10 14l-4 7M14 14h8"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    camera: '<path d="M4 7h3l2-3h6l2 3h3v13H4z"/><circle cx="12" cy="13" r="4"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    hand: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V3.5a1.5 1.5 0 0 1 3 0V11M14 11V5a1.5 1.5 0 0 1 3 0v7M17 9a1.5 1.5 0 0 1 3 0v4a8 8 0 0 1-8 8h-1a7 7 0 0 1-5.6-2.8L3 15.5a1.6 1.6 0 0 1 2.4-2l2.6 2.2"/>',
  };
  const icon = (n, cls = "ico") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ""}</svg>`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // ── Fechas ──
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  // ISO con desfase local (no UTC): slice(0,10) da la fecha local correcta.
  const localISO = (d) => { const o = -d.getTimezoneOffset(), sg = o >= 0 ? "+" : "-", a = Math.abs(o); return `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${sg}${pad(Math.floor(a / 60))}:${pad(a % 60)}`; };
  const fmtDate = (s) => { if (!s) return "—"; const d = new Date(s.length <= 10 ? s + "T00:00" : s); return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" }); };
  const fmtTime = (s) => new Date(s).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const fmtDT = (s) => `${fmtDate(s)} ${fmtTime(s)}`;
  const fmtDur = (ms) => { const t = Math.floor(ms / 1000); return `${pad(Math.floor(t / 3600))}:${pad(Math.floor(t / 60) % 60)}:${pad(t % 60)}`; };
  const relDay = (s) => {
    const d = Math.round((new Date(s + "T00:00") - new Date(today() + "T00:00")) / 864e5);
    return d === 0 ? "Hoy" : d === 1 ? "Mañana" : d === -1 ? "Ayer" : d < 0 ? `Hace ${-d} d` : `En ${d} d`;
  };

  // ── Toast ──
  function toast(msg, action) {
    let wrap = $(".toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; wrap.setAttribute("role", "status"); document.body.append(wrap); }
    const t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ""}`;
    if (action) t.querySelector("button").onclick = () => { action.run(); t.remove(); };
    wrap.append(t);
    while (wrap.children.length > 2) wrap.firstElementChild.remove();
    setTimeout(() => t.remove(), action ? 6000 : 3200);
  }

  // ── Hoja modal (bottom sheet) ──
  function sheet({ title, body, footer, full = false, onClose, headerExtra = "" }) {
    const scrim = document.createElement("div");
    scrim.className = "sheet-scrim";
    scrim.innerHTML = `<section class="sheet ${full ? "full" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header><button class="icon-btn" data-close aria-label="Cerrar">${icon("x")}</button><h2>${esc(title)}</h2>${headerExtra}</header>
      <div class="body"></div>${footer ? `<footer></footer>` : ""}</section>`;
    const $body = $(".body", scrim);
    if (typeof body === "string") $body.innerHTML = body; else if (body) $body.append(body);
    if (footer) { const f = $("footer", scrim); if (typeof footer === "string") f.innerHTML = footer; else f.append(footer); }
    const close = () => { scrim.remove(); document.removeEventListener("keydown", onKey); onClose && onClose(); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    scrim.addEventListener("click", (e) => { if (e.target === scrim || e.target.closest("[data-close]")) close(); });
    document.addEventListener("keydown", onKey);
    document.body.append(scrim);
    setTimeout(() => ($("input,textarea,select", $body) || $("[data-close]", scrim)).focus({ preventScroll: true }), 50);
    return { el: scrim, body: $body, close };
  }

  // ── Confirmación para acciones destructivas ──
  function confirm({ title, text, ok = "Confirmar", danger = true }) {
    return new Promise((res) => {
      const scrim = document.createElement("div");
      scrim.className = "sheet-scrim";
      scrim.style.alignItems = "flex-start";
      scrim.innerHTML = `<div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t"><h2 id="dlg-t">${esc(title)}</h2><p>${esc(text)}</p>
        <div class="actions"><button class="btn ghost" data-r="0">Cancelar</button><button class="btn ${danger ? "danger" : "primary"}" data-r="1">${esc(ok)}</button></div></div>`;
      scrim.addEventListener("click", (e) => {
        const b = e.target.closest("[data-r]");
        if (b || e.target === scrim) { scrim.remove(); res(b ? b.dataset.r === "1" : false); }
      });
      document.body.append(scrim);
      $("[data-r='0']", scrim).focus();
    });
  }

  // ── Deslizar: derecha = completar, izquierda = posponer ──
  function swipeable(li, { onRight, onLeft, onTap }) {
    const row = $(".row", li);
    let x0 = 0, y0 = 0, dx = 0, active = false, horizontal = null, pid = null;
    const TH = 96;
    row.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || e.target.closest("button,input,a")) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; active = true; horizontal = null; pid = e.pointerId;
    });
    row.addEventListener("pointermove", (e) => {
      if (!active || e.pointerId !== pid || li.classList.contains("lifted")) return;
      const mx = e.clientX - x0, my = e.clientY - y0;
      if (horizontal === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
        horizontal = Math.abs(mx) > Math.abs(my);
        if (horizontal) { row.setPointerCapture(pid); li.classList.add("dragging"); }
      }
      if (!horizontal) return;
      dx = mx;
      const under = $(".under", li);
      under.className = "under " + (dx > 0 ? "done" : "later");
      row.style.transform = `translateX(${dx}px)`;
    });
    const end = () => {
      if (!active) return;
      active = false; li.classList.remove("dragging");
      if (horizontal && dx > TH && onRight) { row.style.transform = `translateX(110%)`; setTimeout(onRight, 160); return; }
      if (horizontal && dx < -TH && onLeft) { row.style.transform = `translateX(-110%)`; setTimeout(onLeft, 160); return; }
      row.style.transform = "";
      if (horizontal === null && onTap && !li.dataset.justLifted) onTap();
      delete li.dataset.justLifted;
    };
    row.addEventListener("pointerup", end);
    row.addEventListener("pointercancel", () => { active = false; li.classList.remove("dragging"); row.style.transform = ""; });
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target === row) onTap && onTap(); });
  }

  // ── Mantener presionado para reordenar ──
  function reorderable(ul, onDrop) {
    let timer = null, item = null, startX = 0, startY = 0, placeholderIdx = -1;
    ul.addEventListener("pointerdown", (e) => {
      const li = e.target.closest(".swipe");
      if (!li || e.target.closest("button,input")) return;
      startX = e.clientX; startY = e.clientY;
      timer = setTimeout(() => {
        item = li; li.classList.add("lifted"); li.dataset.justLifted = "1";
        navigator.vibrate && navigator.vibrate(25);
        li.querySelector(".row").setPointerCapture(e.pointerId);
      }, 450);
    });
    ul.addEventListener("pointermove", (e) => {
      // Cualquier desplazamiento antes del long-press es scroll o swipe: cancela el reordenamiento.
      if (timer && !item && Math.hypot(e.clientX - startX, e.clientY - startY) > 10) { clearTimeout(timer); timer = null; }
      if (!item) return;
      e.preventDefault();
      const dy = e.clientY - startY;
      item.style.transform = `translateY(${dy}px)`;
      const sibs = $$(".swipe", ul).filter((s) => s !== item);
      const mid = e.clientY;
      placeholderIdx = sibs.findIndex((s) => { const r = s.getBoundingClientRect(); return mid < r.top + r.height / 2; });
      if (placeholderIdx === -1) placeholderIdx = sibs.length;
    });
    const finish = () => {
      clearTimeout(timer); timer = null;
      if (!item) return;
      const sibs = $$(".swipe", ul).filter((s) => s !== item);
      const ids = sibs.map((s) => s.dataset.id);
      if (placeholderIdx >= 0) ids.splice(placeholderIdx, 0, item.dataset.id); else ids.splice($$(".swipe", ul).indexOf(item), 0, item.dataset.id);
      item.classList.remove("lifted"); item.style.transform = "";
      item = null; placeholderIdx = -1;
      onDrop(ids);
    };
    ul.addEventListener("pointerup", finish);
    ul.addEventListener("pointercancel", finish);
  }

  // ── Jalar para sincronizar ──
  function pullToRefresh(scroller, indicator, onRefresh) {
    let y0 = null, dist = 0, busy = false;
    const TH = 70;
    scroller.addEventListener("touchstart", (e) => { if (window.scrollY <= 0 && !busy && !document.querySelector(".sheet-scrim") && !document.body.classList.contains("drawer-open")) y0 = e.touches[0].clientY; }, { passive: true });
    scroller.addEventListener("touchmove", (e) => {
      if (y0 === null) return;
      dist = Math.max(0, e.touches[0].clientY - y0);
      if (dist <= 0) return;
      indicator.classList.add("pulling");
      indicator.style.height = Math.min(dist * 0.5, 80) + "px";
      indicator.classList.toggle("ready", dist * 0.5 > TH * 0.7);
      indicator.innerHTML = `${icon("down")}&nbsp;${dist * 0.5 > TH * 0.7 ? "Suelta para sincronizar" : "Jala para sincronizar"}`;
    }, { passive: true });
    scroller.addEventListener("touchend", async () => {
      if (y0 === null) return;
      y0 = null; indicator.classList.remove("pulling");
      if (dist * 0.5 > TH * 0.7) {
        busy = true; indicator.style.height = "44px";
        indicator.innerHTML = `${icon("sync", "ico spin")}&nbsp;Sincronizando…`;
        try { await onRefresh(); } finally { busy = false; indicator.style.height = "0"; }
      } else indicator.style.height = "0";
      dist = 0;
    });
  }

  function debounce(fn, ms = 180) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
  const norm = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  window.UI = { icon, esc, $, $$, ymd, today, localISO, fmtDate, fmtTime, fmtDT, fmtDur, relDay, toast, sheet, confirm, swipeable, reorderable, pullToRefresh, debounce, norm };
})();
