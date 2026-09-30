# Guía paso a paso (sin programar) · ASISTENTE-ING Fase 0

Tiempo estimado: 30 a 45 minutos. No necesitas instalar nada.

**Antes de empezar**
- Usa un equipo **personal** (no el de la refinería) para crear la cuenta de Cloudflare.
- No escribas tu contraseña ni tu token en chats, correos ni en GitHub.
- Los nombres de botones pueden variar un poco: Cloudflare y Claude cambian sus pantallas. Si no ves un nombre exacto, busca uno parecido.

**Palabras que vas a ver**
- **Worker:** un mini programa que vive en Cloudflare. Es tu servidor.
- **Token:** una contraseña larga que solo tú conoces. Protege tu servidor.
- **Conector:** el enlace que le dice a Claude (o a Spark) dónde está tu servidor.

---

## PARTE A · Publicar tu servidor en Cloudflare

### A1. Copiar el código

1. Abre este enlace en tu navegador (debes haber iniciado sesión en GitHub):
   `https://github.com/omargoy-web/gifthub/blob/claude/eloquent-curie-uxdr3b/mcp-server/worker.js`
2. Arriba a la derecha del cuadro de código hay un icono de **dos cuadritos** (Copy raw file / Copiar archivo). Púlsalo.
3. Listo: el código quedó copiado. **No copies nada más** hasta pegarlo en el paso A4, o perderás lo copiado.

> Si no ves el icono: pulsa el botón **Raw**, luego **Ctrl + A** (seleccionar todo) y **Ctrl + C** (copiar).

### A2. Crear el Worker

1. Entra a `https://dash.cloudflare.com` e inicia sesión.
2. En el menú de la izquierda pulsa **Workers & Pages** (a veces aparece como **Compute** → **Workers & Pages**).
3. Pulsa **Create** (o **Create application**) y elige **Create Worker** (o **Start with Hello World!**).
4. En el nombre escribe: `asistente-ing` (todo en minúsculas, con guion).
5. Pulsa **Deploy**.
6. Si te pide registrar un **subdominio de workers.dev**, escribe un nombre neutral (por ejemplo tus iniciales y un número) y acepta. **No uses "pemex" ni el nombre de la refinería**: va a ser público en la dirección.

**Debes ver:** un mensaje de "Success" / "Your Worker is deployed" y una dirección parecida a `https://asistente-ing.tunombre.workers.dev`. **Anótala en un bloc de notas.**

### A3. Abrir el editor

1. Pulsa el botón **Edit code** (Editar código).
2. Se abre una pantalla con un editor y un texto de ejemplo (`Hello World`).

### A4. Pegar el código

1. Haz clic dentro del cuadro grande donde está el texto de ejemplo.
2. Pulsa **Ctrl + A** (selecciona todo el texto de ejemplo).
3. Pulsa **Supr** o **Delete** (lo borra; el cuadro queda vacío).
4. Pulsa **Ctrl + V** (pega el código que copiaste en A1).
5. Arriba a la derecha pulsa **Deploy** (o **Save and deploy**) y confirma.

**Debes ver:** un aviso verde de que se desplegó. Si ves una línea roja o un error, repite A1 y A4 (casi siempre es que faltó copiar todo el código).

### A5. Comprobar que el servidor vive

1. Abre en una pestaña nueva tu dirección: `https://asistente-ing.tunombre.workers.dev/`
2. **Debes ver** una página con el título **"ASISTENTE-ING · Servidor MCP"**.
3. Es normal que diga **ADVERTENCIA: sin AUTH_TOKEN**. Eso lo arreglamos en la Parte B.

---

## PARTE B · Ponerle contraseña (token)

### B1. Crear el token

Elige **una** de estas dos formas:

**Forma 1 (recomendada, al azar):**
1. En el navegador pulsa **F12** y abre la pestaña **Consola**.
2. Si aparece una advertencia de pegado, escribe `allow pasting` y pulsa Enter.
3. Pega esto y pulsa Enter:

   ```js
   Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('')
   ```
4. Aparece un texto de 48 letras y números. **Cópialo.**

**Forma 2 (manual):** escribe tú mismo 40 caracteres entre letras y números, mezclados, sin espacios ni símbolos (`/ ? # % &`). Evita palabras o fechas.

### B2. Guardar el token

Pégalo en un lugar seguro: el bloc de notas de tu **celular personal** o un administrador de contraseñas. **No lo pegues en este chat ni en GitHub.**

### B3. Darle el token al servidor

1. En Cloudflare abre tu Worker `asistente-ing`.
2. Pulsa la pestaña **Settings** (Configuración).
3. Busca **Variables and Secrets** (Variables y secretos) y pulsa **Add** (Agregar).
4. En **Type** elige **Secret**.
5. En **Variable name** escribe exactamente: `AUTH_TOKEN` (mayúsculas y guion bajo).
6. En **Value** pega tu token.
7. Pulsa **Deploy** (o **Save and deploy**).

### B4. Activar los registros (para diagnosticar si algo falla)

En **Settings**, busca **Observability** (o **Logs**) y pulsa **Enable** (Activar) en **Workers Logs**.

### B5. Probar con el token

1. Recarga tu dirección `https://asistente-ing.tunombre.workers.dev/`
2. **Debes ver:** "Protegido con token" (ya sin advertencia).
3. En el cuadro **AUTH_TOKEN** pega tu token y pulsa **Probar ping**.
4. **Debes ver:** `HTTP 200` y un texto que incluye `"mensaje":"pong"` y `"autenticacion":"token"`.

Si dice `HTTP 401`: el token no coincide. Vuelve a B3 y pégalo de nuevo (sin espacios ni saltos de línea al final).

---

## PARTE C · Conectarlo con Claude

### C1. Armar tu enlace

Tu enlace es tu dirección, más `/mcp/`, más tu token, todo pegado, sin espacios:

```
https://asistente-ing.tunombre.workers.dev/mcp/ABCDEF0123...tutoken
```

### C2. Agregar el conector

1. Entra a `https://claude.ai` (con tu cuenta personal).
2. Abajo a la izquierda pulsa tu nombre → **Settings** (Configuración).
3. Abre **Connectors** (Conectores).
4. Baja hasta el final y pulsa **Add custom connector** (Agregar conector personalizado).
5. **Name:** `ASISTENTE-ING`
6. **URL:** pega tu enlace completo de C1.
7. Deja vacíos los campos avanzados (OAuth Client ID y Secret).
8. Pulsa **Add** (Agregar).

### C3. Probarlo

1. Abre un chat nuevo.
2. Pulsa el botón **+** o el icono de ajustes junto al cuadro de texto y activa el conector **ASISTENTE-ING**.
3. Escribe: `Usa la herramienta ping del conector ASISTENTE-ING.`
4. Si Claude pide permiso para usar la herramienta, pulsa **Allow** (Permitir).
5. **Debes ver:** una respuesta con "pong" y la hora.
6. Segunda prueba: `Usa la herramienta eco con el texto: motor 15 HP.` Debe devolver el texto, la longitud (11) y las mayúsculas.

**Celular:** la app de Claude para iOS y Android usa los conectores que ya agregaste en la web. No se configuran desde el teléfono.

---

## PARTE D · (Opcional) Conectarlo con Spark

1. Abre `https://gemini.google.com/apps` → **Apps personalizadas para Spark**.
2. Pega el mismo enlace de C1 y pulsa **Siguiente**.
3. Pide en un chat: `Usa la herramienta ping del servidor ASISTENTE-ING.`

Si Spark lo rechaza pero Claude sí funcionó, tu servidor está bien y el obstáculo es de Spark (probablemente exige otro tipo de autenticación).

---

## Si algo no funciona

| Qué pasa | Causa probable | Qué hacer |
|---|---|---|
| La página de A5 no abre | El Worker no se desplegó | Repite A4 y pulsa Deploy |
| Dice "ADVERTENCIA" después de B3 | El secreto no se guardó o se llamó distinto | Revisa que se llame exactamente `AUTH_TOKEN` y vuelve a desplegar |
| `HTTP 401` al probar | El token no coincide | Pega el token otra vez, sin espacios |
| Claude dice que no puede conectar | Enlace mal armado | Revisa que termine en `/mcp/` + token, sin espacios ni saltos de línea |
| Claude no muestra la herramienta | El conector está apagado en el chat | Actívalo con el botón **+** del chat |
| No te deja agregar el conector | Límite del plan | El plan gratuito permite un solo conector personalizado |
| Nada funciona | Red o política del equipo | Prueba desde tu celular personal con datos móviles |

**Para pedir ayuda:** en Cloudflare abre tu Worker → **Observability** → **Logs**. Copia las últimas 10 líneas y pégalas en el chat. **Antes de pegarlas, revisa que no contengan tu token** (el servidor no lo registra, pero compruébalo).

---

## PARTE E · Al terminar la prueba

1. **Rota el token:** Worker → Settings → Variables and Secrets → edita `AUTH_TOKEN` y pon uno nuevo. El enlace viejo deja de servir.
2. Actualiza el conector en Claude con el enlace nuevo.
3. Si la prueba ya no te sirve: Worker → Settings → **Delete** (Eliminar).

## Reglas que no debes romper

- Este servidor **no debe recibir datos de PEMEX** (equipos, informes, datos de SAP). Claude y Spark corren en la nube y con cuenta personal.
- Nunca compartas tu enlace con el token: equivale a una contraseña.
- Nunca compartas tu API Key global de Cloudflare. Este proyecto no la necesita.
