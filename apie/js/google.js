/* Integración Google: OAuth (Google Identity Services, flujo de token en navegador),
   Calendar, Drive y Sheets por REST. El access token vive solo en sessionStorage
   (expira en ~1 h); nunca se persiste en IndexedDB. */
(function () {
  const CFG = window.APIE_CONFIG || {};
  const SCOPES = [
    "openid", "email", "profile",
    "https://www.googleapis.com/auth/calendar.events",   // leer eventos + RSVP
    "https://www.googleapis.com/auth/drive.readonly",    // buscar en el repositorio documental
    "https://www.googleapis.com/auth/drive.file",        // guardar minutas creadas por APIE
    "https://www.googleapis.com/auth/spreadsheets",      // BD ligera de fallas/KPIs
  ].join(" ");

  let tokenClient = null;
  let tok = null;
  try { tok = JSON.parse(sessionStorage.getItem("apie_gtok") || "null"); } catch (e) {}

  const configured = () => !!CFG.googleClientId;
  const connected = () => !!(tok && tok.exp > Date.now() + 60e3);

  function loadGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true; s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar Google Identity Services (¿sin red?)"));
      document.head.append(s);
    });
  }

  async function signIn(prompt = "consent") {
    if (!configured()) throw new Error("Falta googleClientId en js/config.js");
    await loadGis();
    return new Promise((res, rej) => {
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CFG.googleClientId,
        scope: SCOPES,
        hd: CFG.allowedDomain || undefined,
        callback: async (r) => {
          if (r.error) return rej(new Error(r.error_description || r.error));
          tok = { access: r.access_token, exp: Date.now() + (r.expires_in || 3600) * 1000 };
          sessionStorage.setItem("apie_gtok", JSON.stringify(tok));
          try {
            const u = await api("https://www.googleapis.com/oauth2/v3/userinfo");
            // hd en initTokenClient es solo una pista de UI: el dominio se valida aquí y en el servidor.
            if (CFG.allowedDomain && u.hd !== CFG.allowedDomain) {
              signOut();
              return rej(new Error(`Solo se permiten cuentas @${CFG.allowedDomain}`));
            }
            res({ name: u.name, email: u.email, picture: u.picture, hd: u.hd, provider: "google" });
          } catch (e) { rej(e); }
        },
        error_callback: (e) => rej(new Error(e.message || e.type || "Inicio de sesión cancelado")),
      });
      tokenClient.requestAccessToken({ prompt });
    });
  }

  function signOut() {
    if (tok && window.google && google.accounts) { try { google.accounts.oauth2.revoke(tok.access); } catch (e) {} }
    tok = null; sessionStorage.removeItem("apie_gtok");
  }

  async function api(url, opt = {}) {
    if (!connected()) throw new Error("Sesión de Google expirada. Reconecta desde Ajustes.");
    const r = await fetch(url, { ...opt, headers: { Authorization: "Bearer " + tok.access, ...(opt.body && typeof opt.body === "string" ? { "Content-Type": "application/json" } : {}), ...(opt.headers || {}) } });
    if (r.status === 401) { tok = null; sessionStorage.removeItem("apie_gtok"); throw new Error("Token de Google inválido o expirado"); }
    if (!r.ok) { let m = r.statusText; try { m = (await r.json()).error.message; } catch (e) {} throw new Error(`Google API ${r.status}: ${m}`); }
    return r.status === 204 ? null : r.json();
  }

  // ── Calendar ──
  const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
  async function listEvents(fromISO, toISO) {
    const q = new URLSearchParams({ timeMin: fromISO, timeMax: toISO, singleEvents: "true", orderBy: "startTime", maxResults: "250", conferenceDataVersion: "1" });
    const d = await api(`${CAL}?${q}`);
    return (d.items || []).filter((e) => e.status !== "cancelled").map(fromGoogleEvent);
  }
  function fromGoogleEvent(e) {
    const me = (e.attendees || []).find((a) => a.self);
    const video = e.hangoutLink || ((e.conferenceData || {}).entryPoints || []).find((p) => p.entryPointType === "video")?.uri
      || ((e.location || "").match(/https?:\/\/\S*(teams\.microsoft|zoom\.us|meet\.google|webex)\S*/) || [])[0] || "";
    return {
      id: e.id, src: "google", title: e.summary || "(sin título)", desc: e.description || "",
      start: e.start.dateTime || e.start.date + "T00:00", end: e.end.dateTime || e.end.date + "T00:00",
      allDay: !e.start.dateTime, location: e.location || "", video, htmlLink: e.htmlLink,
      attendees: (e.attendees || []).map((a) => ({ email: a.email, name: a.displayName || a.email, rsvp: a.responseStatus, self: !!a.self, organizer: !!a.organizer })),
      myRsvp: me ? me.responseStatus : null,
      attachments: (e.attachments || []).map((a) => ({ title: a.title, url: a.fileUrl, mime: a.mimeType })),
      organizer: (e.organizer || {}).email || "",
    };
  }
  async function rsvp(ev, status) {
    const attendees = ev.attendees.map((a) => ({ email: a.email, responseStatus: a.self ? status : a.rsvp }));
    return api(`${CAL}/${encodeURIComponent(ev.id)}?sendUpdates=all`, { method: "PATCH", body: JSON.stringify({ attendees }) });
  }

  // ── Drive ──
  async function searchDrive(text) {
    const parts = ["trashed = false"];
    if (text) parts.push(`fullText contains '${text.replace(/['\\]/g, "\\$&")}'`);
    if (CFG.driveFolderId) parts.push(`'${CFG.driveFolderId}' in parents`);
    const q = new URLSearchParams({ q: parts.join(" and "), pageSize: "30", fields: "files(id,name,mimeType,modifiedTime,webViewLink,iconLink)", orderBy: text ? "" : "modifiedTime desc", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
    if (text) q.delete("orderBy");
    return (await api(`https://www.googleapis.com/drive/v3/files?${q}`)).files || [];
  }
  // Crea un Google Doc a partir de texto plano (la conversión la hace Drive).
  async function createDoc(name, text) {
    const boundary = "apie" + Math.random().toString(36).slice(2);
    const meta = { name, mimeType: "application/vnd.google-apps.document", ...(CFG.driveFolderId ? { parents: [CFG.driveFolderId] } : {}) };
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--`;
    return api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink", { method: "POST", headers: { "Content-Type": `multipart/related; boundary=${boundary}` }, body });
  }

  // ── Sheets (BD ligera) ──
  async function appendRows(tab, rows) {
    if (!CFG.sheetId) throw new Error("Falta sheetId en js/config.js");
    const range = encodeURIComponent(`${tab}!A1`);
    return api(`https://sheets.googleapis.com/v4/spreadsheets/${CFG.sheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, { method: "POST", body: JSON.stringify({ values: rows }) });
  }
  async function readRange(range) {
    if (!CFG.sheetId) throw new Error("Falta sheetId en js/config.js");
    return (await api(`https://sheets.googleapis.com/v4/spreadsheets/${CFG.sheetId}/values/${encodeURIComponent(range)}`)).values || [];
  }

  window.G = { configured, connected, signIn, signOut, listEvents, rsvp, searchDrive, createDoc, appendRows, readRange, token: () => (connected() ? tok.access : null), sheetConfigured: () => !!CFG.sheetId };
})();
