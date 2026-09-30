# ASISTENTE-ING · Servidor MCP · Fase 0 (prueba de humo)

**Objetivo único:** comprobar que Gemini Spark puede alcanzar tu URL, negociar MCP y llamar una herramienta.
Si esto falla, se sabe en una hora y no después de semanas de desarrollo.

- Un solo archivo (`worker.js`), sin dependencias y sin instalar nada en tu equipo.
- No guarda ni devuelve datos. Herramientas: `ping` y `eco`, ambas inocuas.
- **No subas a este servidor datos de PEMEX.** Spark corre con cuenta personal en la nube de Google.

## Qué necesitas

1. Cuenta gratuita de Cloudflare (crea y usa todo desde un equipo o celular **personal**).
2. Cuenta de Google personal con acceso a Spark (la que muestra *Apps personalizadas para Spark*).

## Paso 1 · Publicar el servidor (sin instalar nada)

1. Entra a <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Create Worker**.
2. Nombre: `asistente-ing` → **Deploy** (despliega un "Hello World").
3. **Edit code** → borra todo el contenido → pega el contenido completo de `worker.js` → **Deploy**.
4. Anota tu URL, del tipo `https://asistente-ing.<tu-subdominio>.workers.dev`.

## Paso 2 · Proteger con un token

1. Genera un token aleatorio: abre cualquier pestaña del navegador, pulsa **F12** → **Consola** y pega:

   ```js
   Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('')
   ```

   Copia el resultado (48 caracteres). No lo publiques ni lo subas a GitHub.
2. En Cloudflare: Worker `asistente-ing` → **Settings** → **Variables and Secrets** → **Add**.
   Tipo **Secret**, nombre `AUTH_TOKEN`, valor = tu token → **Deploy**.
3. Activa los registros: **Settings** → **Observability** → activar **Workers Logs**.

## Paso 3 · Verificar antes de usar Spark

1. Abre `https://asistente-ing.<tu-subdominio>.workers.dev/` en el navegador.
   Debe decir **"Protegido con token"**. Si dice ADVERTENCIA, falta el secreto (Paso 2).
2. En esa misma página escribe tu token y pulsa **Probar ping**. Debe responder:
   `HTTP 200` y un JSON con `"mensaje":"pong"` y `"autenticacion":"token"`.

## Paso 4 · Conectar con Spark

1. Ve a **gemini.google.com/apps** → **Apps personalizadas para Spark**.
2. Pega la URL completa con el token en la ruta y pulsa **Siguiente**:

   ```
   https://asistente-ing.<tu-subdominio>.workers.dev/mcp/<TU_TOKEN>
   ```

3. En un chat con Spark escribe:
   - *"Usa la herramienta ping del servidor ASISTENTE-ING."*
   - *"Usa eco con el texto: motor 15 HP."*

## Criterio de aceptación de la Fase 0

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Página de estado (Paso 3) | Protegido con token; ping HTTP 200 |
| 2 | Spark acepta la URL | Sin error al pulsar Siguiente |
| 3 | Spark lista las herramientas | Aparecen `ping` y `eco` |
| 4 | Spark llama a `ping` | Responde "pong" con hora UTC |
| 5 | Spark llama a `eco` | Devuelve el texto, la longitud y las mayúsculas |

## Si algo falla: cómo leer los registros

Cloudflare → Worker → **Observability** → **Logs** (en vivo). Cada línea es un JSON con `evt`, `rpc`, `ua`, `pais`, etc.
El token nunca se registra.

| Lo que ves en los registros | Significado | Qué hacer |
|---|---|---|
| **Ninguna línea** al pulsar Siguiente | Spark no llegó al servidor: URL mal escrita, cuenta/región/idioma sin elegibilidad, o Spark valida la URL antes de conectar | Revisa la URL; prueba en inglés y con la cuenta personal; confirma que la página de estado abre desde otra red |
| `evt: other` con ruta `/.well-known/oauth-...` y luego nada | **Spark exige OAuth.** Un token en la ruta no le basta | Pasar a la Fase 1 (OAuth) antes de seguir; no insistir con el token |
| `evt: no_autorizado` | El token llegó incorrecto o no llegó | Revisa que la URL lleve `/mcp/<token>` exacto, sin espacios ni saltos de línea |
| `rpc: initialize` y luego `tools/list` correctos pero Spark falla | Problema de esquema o de versión | Copia las líneas `rpc` y `version_cliente` para ajustar |
| `evt: metodo_no_permitido` con `GET` | Spark intenta abrir un canal SSE (no soportado en Fase 0) | Informar; se agrega en Fase 1 si hace falta |
| `evt: origin_rechazado` | Solo si activaste `ORIGIN_STRICT=1` | Agregar el origen a `ALLOWED_ORIGINS` o desactivar |
| `rpc: tools/call` y la respuesta llegó, pero Spark no la muestra | El servidor funciona; el problema está del lado de Spark | Reintentar en un chat nuevo; revisar el Centro de privacidad de Gemini |

Copia los registros (sin el token) y pásalos a la siguiente sesión para diagnosticar.

## Seguridad de esta fase

- El token viaja en la URL porque el formulario de Spark solo pide un vínculo. Puede quedar en historiales de terceros: **rótalo al terminar la prueba** (cambia el valor del secreto `AUTH_TOKEN`).
- Sin `AUTH_TOKEN` el servidor queda abierto. Sirve para probar, pero es inocuo solo porque no tiene datos.
- Si la Fase 0 sirve solo para descartar, borra el Worker al terminar.
- Los datos reales (finanzas, conocimiento técnico) **no** se cargan hasta la Fase 1 (OAuth, lista blanca de correos, auditoría).

## Pruebas locales (opcional, para el repositorio)

```bash
node test/smoke.mjs      # 26 pruebas del protocolo y la autenticación (requiere Node 18+)
```

## Variables

| Variable | Tipo | Efecto |
|---|---|---|
| `AUTH_TOKEN` | Secreto | Exige `/mcp/<token>` o `Authorization: Bearer <token>` |
| `ORIGIN_STRICT` | Texto | `1` = rechaza peticiones con `Origin` no listado |
| `ALLOWED_ORIGINS` | Texto | Lista separada por comas, solo si `ORIGIN_STRICT=1` |
| `SILENT` | Texto | `1` = sin registros (pruebas) |
