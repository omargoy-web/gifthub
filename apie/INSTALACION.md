# Instructivo: arrancar APIE en el celular y dar de alta las cuentas de IA

> **Antes de empezar:** APIE hoy solo habla con **Claude**. Gemini **no está integrado**: si das de alta una clave de Gemini, la app no la usa. La sección 5 explica cómo obtenerla por si se agrega como segundo proveedor.

El celular **no corre el servidor**. El servidor corre en una PC (o en la nube) y el celular lo abre en el navegador. La API key de Claude vive solo en esa PC, nunca en el teléfono.

```
[Celular: Chrome/Safari] ──HTTPS──▶ [PC o nube: apie/server]  ──▶ API de Claude
                                         └─ sirve la app (apie/)
```

---

## 1. Preparar la PC (una sola vez, ~10 min)

Requisitos: Windows 10/11, macOS o Linux; **Node.js 20 o superior**; Git.

1. Instala Node.js LTS desde nodejs.org. Verifica en una terminal:
   ```bash
   node --version     # debe decir v20.x o mayor
   ```
2. Descarga el repositorio y cámbiate a la rama de APIE:
   ```bash
   git clone https://github.com/omargoy-web/gifthub.git
   cd gifthub
   git checkout claude/apie-electrical-engineers-app-qnwzi0
   ```
3. Instala las dependencias del servidor:
   ```bash
   cd apie/server
   npm install
   npm test           # debe decir: pass 4, fail 0
   ```

---

## 2. Opción A — Prueba rápida en la misma red Wi-Fi (5 min)

Para ver la app en el teléfono hoy mismo. **No sirve para instalarla como app, ni para el modo sin red, ni para entrar con Google**: los navegadores exigen HTTPS para eso.

1. En la PC, dentro de `apie/server`:
   ```bash
   node server.js
   ```
   Debe aparecer: `APIE en http://localhost:8080 · IA deshabilitada …`
2. Obtén la IP de la PC en la red local:
   - Windows: `ipconfig` → "Dirección IPv4" (ej. `192.168.1.50`)
   - macOS/Linux: `ipconfig getifaddr en0` o `hostname -I`
3. Si Windows pregunta por el Firewall, permite **redes privadas** para Node.js.
4. En el celular, conectado **al mismo Wi-Fi**, abre en Chrome o Safari:
   `http://192.168.1.50:8080`
5. Entra con tu ficha y cualquier contraseña. Sin backend corporativo, la app entra en **modo local** (los datos se quedan en el teléfono).

> En la red corporativa es probable que el aislamiento entre clientes bloquee esto. Usa un hotspot propio o la Opción B.

---

## 3. Opción B — HTTPS para instalarla como app (recomendada para piloto)

### B1. Túnel HTTPS temporal desde tu PC (pruebas, 10 min)

1. Instala `cloudflared` (Cloudflare → "Install cloudflared", gratuito, sin cuenta para túneles rápidos).
2. Terminal 1, en `apie/server`: `node server.js`
3. Terminal 2:
   ```bash
   cloudflared tunnel --url http://localhost:8080
   ```
   Copia la URL que entrega, del tipo `https://palabras-al-azar.trycloudflare.com`.
4. Abre esa URL en el celular.

⚠ **Mientras el túnel está abierto, la app queda expuesta a Internet.** No actives `ALLOW_ANON=1` con túnel público (ver sección 4.3): cualquiera con la URL gastaría tus créditos de Claude. La URL cambia cada vez que reinicias el túnel.

### B2. Despliegue permanente (cuando TI lo autorice)

Cualquier servicio que ejecute Node 20 con HTTPS sirve (Google Cloud Run, Render, Azure App Service, un servidor interno con certificado). Comando de arranque: `node apie/server/server.js`. Las variables de la sección 4 se cargan como variables de entorno del servicio, **no** en un archivo dentro del repositorio.

### B3. Instalar en el teléfono

**Android (Chrome):**
1. Abre la URL HTTPS.
2. Menú ⋮ → **Instalar app** (o "Agregar a la pantalla principal").
3. Aparece el ícono del rayo amarillo. Ábrela desde ahí: corre a pantalla completa.

**iPhone (Safari; no funciona desde Chrome en iOS):**
1. Abre la URL HTTPS en Safari.
2. Botón **Compartir** (cuadro con flecha) → **Agregar a inicio** → Agregar.

**Primer arranque:**
1. Entra con ficha y contraseña (modo local) o con Google (si ya configuraste la sección 6).
2. Ajustes → **Modo campo**: activa tema oscuro, botones grandes para guantes o alto contraste, según el área.
3. Abre una vez cada pestaña con red: así quedan en caché para trabajar sin señal en planta.

---

## 4. Dar de alta Claude (asistente IA y minutas)

### 4.1 Crear la cuenta de API (no es la suscripción Pro)

> **Una suscripción Claude Pro o Max no da acceso a la API.** Son productos separados con facturación separada. La app necesita una **API key**.

1. Entra a **console.anthropic.com** (Claude Console). Regístrate con correo, Google o SSO.
2. En el onboarding indica si es cuenta individual u organización. Para uso institucional, crea una **organización** a nombre del área, no una cuenta personal.
3. **Settings → Billing**:
   - Agrega un método de pago y compra créditos. Es **prepago**: sin saldo, la clave no responde. El mínimo inicial es de 5 USD.
   - Configura un **límite de gasto mensual** y **alertas de uso**. Hazlo antes de crear la clave.
4. **Settings → API Keys → Create Key**:
   - Nombre: `APIE-piloto-SICM`.
   - Copia la clave (`sk-ant-…`). **Solo se muestra una vez.**
   - No la mandes por correo, WhatsApp ni la pegues en el código.

### 4.2 Ponerla en el servidor

En la PC, dentro de `apie/server`, copia la plantilla y edítala:

```bash
cp .env.example .env          # Windows: copy .env.example .env
```

Contenido mínimo de `.env`:

```ini
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
PORT=8080
RATE_MAX=30
```

`.env` ya está excluido de Git, así que no se sube al repositorio.

### 4.3 ¿Quién puede usar el asistente?

El servidor exige por defecto **sesión de Google** para responder. Tienes dos modos:

| Modo | Variables en `.env` | Cuándo usarlo |
|---|---|---|
| Con Google (recomendado) | `GOOGLE_CLIENT_ID=…` y `ALLOWED_DOMAIN=…` | Piloto real; requiere la sección 6 |
| Anónimo | `ALLOW_ANON=1` | **Solo** en la Opción A (Wi-Fi local), para demostrar sin Google |

### 4.4 Verificar

1. Reinicia el servidor: `node server.js`. Debe decir `IA claude-opus-5-5`.
2. En el navegador de la PC abre `http://localhost:8080/api/health`. Debe responder `"ai":true`.
3. En el celular: Ajustes → "Asistente IA" debe marcar **Disponible**. Prueba en Saber → botón amarillo → "¿PI mínimo para aislamiento clase F según IEEE 43?"
4. El consumo se ve en Claude Console → **Usage**. La terminal del servidor registra cada consulta con tokens de entrada/salida.

---

## 5. Gemini: cómo obtener la clave (APIE aún no la usa)

1. Entra a **aistudio.google.com** con una cuenta Google → **Get API key** → **Create API key**. Se crea dentro de un proyecto de Google Cloud.
2. La clave empieza con `AIza…`. Guárdala con el mismo cuidado que la de Claude.
3. **Gemini Advanced / Google One AI Premium tampoco da acceso a la API.**

⚠ **Punto crítico para datos de PEMEX:** en el **nivel gratuito** de la API de Gemini (y en AI Studio), Google puede usar lo que envías para mejorar sus productos, y **revisores humanos pueden leer entradas y salidas**. Solo el **nivel de pago** (facturación activa en el proyecto de Cloud) excluye tus datos del entrenamiento. No envíes fallas, nombres ni datos de placa por una clave gratuita.

Para que APIE use Gemini hace falta agregar un segundo proveedor en `apie/server/server.js`: es un cambio de código, no de configuración.

---

## 6. Google (Calendar, Drive, Sheets e inicio de sesión)

Esto **no** es Gemini: es otra credencial, un **ID de cliente OAuth** que permite a cada usuario autorizar su propio calendario y Drive. El detalle completo está en `apie/README.md`; resumen:

1. **console.cloud.google.com** → crea un proyecto `APIE-SICM`.
2. **APIs y servicios → Biblioteca**: habilita Google Calendar API, Google Drive API y Google Sheets API.
3. **Pantalla de consentimiento OAuth**:
   - Con Google Workspace corporativo: tipo **Interno** (solo cuentas del dominio).
   - Con Gmail personal: tipo **Externo**, en modo *Prueba*, y agrega a cada ingeniero en **Usuarios de prueba** (máximo 100).
4. **Credenciales → Crear credenciales → ID de cliente OAuth → Aplicación web**:
   - *Orígenes de JavaScript autorizados*: la URL **HTTPS** exacta de la app (ej. `https://palabras-al-azar.trycloudflare.com`). Con el túnel temporal hay que actualizarla cada vez que cambie la URL.
   - Copia el **ID de cliente** (`…apps.googleusercontent.com`).
5. Edita `apie/js/config.js`:
   ```js
   googleClientId: "1234-abc.apps.googleusercontent.com",
   allowedDomain: "",          // ej. "pemex.com" si hay Workspace corporativo
   sheetId: "ID-de-la-hoja",   // lo que va entre /d/ y /edit en la URL de la hoja
   ```
6. En `apie/server/.env`: `GOOGLE_CLIENT_ID=` con el mismo ID y, si aplica, `ALLOWED_DOMAIN=`.
7. Crea la hoja de cálculo con una pestaña llamada **`Fallas`** y los encabezados de `apie/README.md`. Compártela como editor con cada ingeniero.
8. En el celular: Ajustes → **Conectar Google** → acepta los permisos. Luego jala hacia abajo en la Agenda para sincronizar.

---

## 7. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| El celular no abre `http://192.168…` | Otro Wi-Fi, firewall o aislamiento de clientes | Misma red, permitir Node en el firewall, o usar la Opción B |
| No aparece "Instalar app" | La página no está en HTTPS | Opción B |
| Asistente "No disponible" | Falta `ANTHROPIC_API_KEY` o el servidor no se reinició | Revisa `.env` y `/api/health` |
| "Sesión Google requerida…" | No entraste con Google y `ALLOW_ANON` no está activo | Conecta Google o usa `ALLOW_ANON=1` solo en Wi-Fi local |
| "Límite de la API de IA alcanzado" | Sin créditos o límite de gasto alcanzado | Claude Console → Billing |
| `redirect_uri_mismatch` / `origin_mismatch` al entrar con Google | La URL actual no está en *Orígenes autorizados* | Agrega la URL HTTPS exacta, sin `/` final |
| "Solo se permiten cuentas @…" | `allowedDomain` no coincide con tu cuenta | Ajusta `allowedDomain` o usa la cuenta del dominio |
| Las fallas no llegan a Sheets | Falta `sheetId`, la pestaña no se llama `Fallas` o no hay permiso de edición | Revisa la configuración; las fallas siguen en la bandeja de salida (punto amarillo en ⟳) |
| Datos "desaparecen" en iPhone | iOS borra datos de sitios no instalados tras semanas sin uso | Instálala con "Agregar a inicio" y exporta respaldo en Ajustes |

---

## 8. Antes de usar datos reales

- [ ] Visto bueno de TI / Seguridad de la Información para enviar datos a Google y a la API de Claude.
- [ ] Límite de gasto mensual configurado en Claude Console.
- [ ] `ALLOW_ANON=0` en cualquier despliegue accesible desde fuera de tu Wi-Fi.
- [ ] Bloqueo de pantalla activo en los teléfonos (los datos locales no tienen cifrado propio).
- [ ] Claves guardadas en un gestor de contraseñas o en las variables del servicio, nunca en el repositorio.
