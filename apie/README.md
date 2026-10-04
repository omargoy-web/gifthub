# APIE · Asistente de Productividad para Ingenieros Eléctricos

PWA móvil (instalable en Android/iOS desde el navegador) para la Coordinación Eléctrica SICM. Es un cliente: consume el censo SICM-ELE de este repositorio, Google Workspace y un proxy de IA propio. **No reemplaza a SAP PM.**

## Qué hay y en qué estado

| Pantalla | Funciona hoy | Depende de configuración |
|---|---|---|
| Inicio de sesión | Formulario PEMEX (modo local), Google OAuth, avisos legales | El login PEMEX real requiere un conector LDAP/AD en `/api/auth/pemex`; hoy responde 501 y la app entra en modo local |
| Panel de control | KPIs (abiertas/vencidas, cumplimiento 30 d, activos en alarma/alerta, fallas), críticas de hoy, reuniones con "Unirse", metas de desarrollo | — |
| Programador de tareas | CRUD, filtros por estado/tipo, orden (manual/fecha/prioridad/ubicación/tipo), lista/cuadrícula, deslizar → completar, ← reprogramar, mantener para reordenar, checklist, temporizador, notas, adjuntos (≤1.5 MB), historial | — |
| Calendario | Mes/semana/lista, color por tipo, detalle (agenda, asistentes, adjuntos), notas con plantilla, **minuta automática**, acciones → tareas, RSVP, unirse a videollamada | Google Calendar para eventos reales y RSVP; proxy IA para minuta redactada (sin IA usa una plantilla determinista) |
| Visor de activos | 10,930 activos del censo, filtros tipo/ubicación/estado/criticidad, placa, historial real (194 mediciones de recorridos SICM), manuales relacionados, plano esquemático por sector, **registro de falla** con foto, borrador de aviso IW21 | Google Sheets para persistir fallas fuera del equipo |
| Base de conocimientos | 48 documentos: 21 formatos/ventanas de Drive, 17 SOP, 10 lecciones FMEA (top RPN); búsqueda con resaltado, visor, anotaciones, marcadores, búsqueda en Drive, FAB del asistente IA con contexto del documento | Google Drive para la vista previa y la búsqueda; proxy IA |
| Centro de aprendizaje | Perfil de 9 competencias (actual vs meta), plan ordenado por brecha, feed curado con progreso, 18 preguntas verificadas contra norma, certificados compartibles | — |

Interacciones de la especificación implementadas: búsqueda superior por pantalla, FAB inferior derecho, pestañas + menú hamburguesa, jalar para sincronizar, confirmación modal en acciones destructivas, "Deshacer" tras completar. Modo campo en Ajustes: tema oscuro (baja luz), botones de 60 px (guantes), alto contraste (sol).

## Arquitectura

```
apie/
├── index.html · legal.html · manifest.webmanifest · sw.js (offline)
├── css/apie.css                 tokens de marca, claro/oscuro, modo guantes
├── js/
│   ├── config.js                ← ÚNICO archivo a editar para desplegar
│   ├── store.js                 IndexedDB (todo el estado del usuario es local)
│   ├── ui.js                    hojas modales, confirmaciones, gestos
│   ├── data.js                  censo + estado derivado + datos de arranque
│   ├── google.js                OAuth (GIS) + Calendar/Drive/Sheets REST
│   ├── ai.js                    cliente del proxy IA
│   ├── app.js                   shell, login, navegación, ajustes, chat
│   └── screens/*.js             una pantalla por archivo
├── data/seed.js                 generado por scripts/build_apie_seed.py
├── server/                      Node ≥20: estático + /api/chat + /api/auth/pemex
└── tests/e2e.mjs                15 flujos en Chromium móvil
```

Sin framework ni build: JavaScript plano, así se audita en una tarde y abre en cualquier navegador de la flotilla. El censo se embebe como JS (`window.APIE_SEED`) para que funcione incluso desde `file://`.

> Paso a paso para celular y alta de cuentas de IA: [`INSTALACION.md`](INSTALACION.md).

## Ejecutar

```bash
python3 scripts/build_apie_seed.py           # regenera apie/data/seed.js si cambia data/normalized
cd apie/server && npm install && npm test   # 4 pruebas del proxy
PORT=8080 node server.js                    # http://localhost:8080
```

Sin variables de entorno arranca en modo local: todo funciona salvo Google e IA.

## Configuración de Google (una vez, por TI)

1. Google Cloud Console → proyecto nuevo → habilitar **Calendar API**, **Drive API**, **Sheets API**.
2. Pantalla de consentimiento OAuth tipo **Interno** (solo cuentas del Workspace corporativo).
3. Credenciales → ID de cliente OAuth → *Aplicación web* → orígenes autorizados: la URL HTTPS donde se sirve APIE.
4. En `js/config.js`: `googleClientId`, `allowedDomain`, `sheetId`, `driveFolderId`.
5. En el servidor: `GOOGLE_CLIENT_ID` (el mismo) y `ALLOWED_DOMAIN`.

Alcances solicitados (mínimos para la función): `calendar.events`, `drive.readonly`, `drive.file`, `spreadsheets`.

### Plantilla de Google Sheets

Pestaña **`Fallas`**, fila 1 con estos encabezados (la app agrega filas en este orden):

`id · fecha · tag · equipo_sap · familia · sector · planta · modo_falla · severidad · condicion · sintoma · accion · autor · foto`

Las fotos **no** se suben: quedan en el teléfono y se registra solo el nombre. Subirlas a Drive es la siguiente iteración.

## Asistente IA (proxy)

- El navegador nunca ve la API key. El proxy valida el access token de Google contra `tokeninfo` (audiencia = tu client ID, correo verificado, dominio permitido), limita a 30 consultas/10 min por usuario y rechaza conversaciones mal formadas.
- Modelo `claude-opus-5-5` con pensamiento adaptativo; esfuerzo `low` en chat (latencia en campo) y `medium` en minutas. Tiene activado el respaldo automático del servidor (`fallbacks: "default"`): si el modelo principal rechaza una consulta, la API la reintenta con un modelo alterno. Se puede quitar en `server.js → buildRequest`.
- El contexto (documento, anotaciones, notas de reunión) viaja marcado como datos, no como instrucciones.
- El prompt de sistema prohíbe sugerir omitir ATS, LOTO, verificación de ausencia de tensión o EPP, y obliga a declarar supuestos.

## Seguridad y datos: lo que debes resolver antes del piloto

1. **Clasificación de la información.** Fallas, nombres de ingenieros y datos de placa terminan en Google Sheets/Drive y, vía el asistente, en la API de Anthropic. Necesitas visto bueno de TI y de Seguridad de la Información (y validar el alcance ASEA) **antes** de conectar cuentas reales. Si la empresa no tiene Google Workspace corporativo, el diseño de integraciones cambia (Microsoft 365 / Graph API) y conviene saberlo ya.
2. **Modo local ≠ autenticación.** El formulario PEMEX sin backend no valida nada: protege la UI, no los datos. Los datos locales quedan en el dispositivo sin cifrado adicional al del sistema operativo. Exige bloqueo de pantalla en equipos con datos reales.
3. **Tokens.** El access token de Google vive solo en `sessionStorage` y se revoca al cerrar sesión.
4. **CSP** restringe scripts a origen propio + Google Identity Services.

## Limitaciones declaradas

- Sin interfaz a SAP PM: avisos y órdenes se copian a IW21 manualmente. Mientras sea así, APIE **no puede** ser "fuente única de la verdad" de asignaciones; SAP lo es.
- El historial del activo solo contiene recorridos SICM ingestados (67 de 10,930 activos) y fallas capturadas en APIE.
- "Mapa de planta" es un esquema por sector: el censo no trae coordenadas.
- Eventos creados en APIE no se publican en Google Calendar (solo lectura + RSVP).
- Reordenar con long-press solo aplica en vista lista con orden manual.
- No se probó contra cuentas Google reales ni contra la API de IA (sin credenciales en el entorno de desarrollo); el flujo OAuth/REST está escrito contra la documentación pública y debe validarse en piloto.
