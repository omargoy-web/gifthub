/* Configuración de despliegue. Sin valores aquí la app corre en MODO LOCAL:
   todo funciona offline con datos del censo SICM-ELE, sin Google ni IA.
   Ningún secreto va en este archivo: el cliente OAuth de Google es público por
   diseño y la API key de Claude vive solo en el servidor (apie/server). */
window.APIE_CONFIG = {
  // Google Cloud Console → Credenciales → ID de cliente OAuth 2.0 (tipo "Aplicación web").
  // Agregar el origen donde se sirve APIE en "Orígenes de JavaScript autorizados".
  googleClientId: "",

  // Si se define, solo cuentas de ese dominio Workspace pueden iniciar sesión con Google.
  // Ej.: "pemex.com". Vacío = cualquier cuenta (solo aceptable en piloto).
  allowedDomain: "",

  // Hoja de cálculo que actúa como BD ligera. Pestañas esperadas: Fallas, KPIs, Tareas.
  // Ver apie/README.md → "Plantilla de Google Sheets".
  sheetId: "",

  // Carpeta de Drive del repositorio documental (opcional: acota la búsqueda).
  driveFolderId: "",

  // Endpoint del proxy de IA (apie/server). Mismo origen por defecto.
  // Vacío = asistente IA deshabilitado (la minuta usa la plantilla local).
  aiEndpoint: "/api/chat",

  // Endpoint de autenticación corporativa (LDAP/AD de PEMEX vía backend).
  // Vacío = el formulario de credenciales PEMEX opera en modo local de demostración.
  pemexAuthEndpoint: "/api/auth/pemex",
};
