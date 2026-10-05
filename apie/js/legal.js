/* Avisos legales embebidos para que el archivo HTML único no dependa de legal.html.
   Mantener sincronizado con legal.html (borrador pendiente de revisión jurídica). */
window.LEGAL = {
 "privacidad": "<h2>Aviso de privacidad (borrador)</h2>\n<p><b>Datos que trata la app:</b> nombre, correo y foto de la cuenta con la que inicias sesión; tareas, notas, anotaciones, fallas registradas y avance de aprendizaje que tú capturas.</p>\n<p><b>Dónde se guardan:</b> en el almacenamiento local de tu dispositivo (IndexedDB). Solo salen del dispositivo cuando tú sincronizas: las fallas se escriben en la hoja de Google Sheets configurada por la Coordinación; las minutas, en tu Google Drive; las respuestas de asistencia (RSVP), en tu Google Calendar.</p>\n<p><b>Asistente IA:</b> el texto que escribes y el contexto del documento o reunión abierta se envían al servidor APIE y de ahí a la API de Anthropic para generar la respuesta. No captures información clasificada, datos personales de terceros ni credenciales en el asistente.</p>\n<p><b>Tokens de acceso:</b> el token de Google se guarda solo durante la sesión del navegador y se revoca al cerrar sesión.</p>\n<p><b>Derechos ARCO:</b> puedes exportar o borrar todos tus datos locales desde Ajustes. Para datos ya sincronizados, solicita la baja a la Coordinación Eléctrica SICM.</p>",
 "terminos": "<h2>Términos de uso (borrador)</h2>\n<p>APIE es una herramienta de apoyo. <b>No sustituye</b> el procedimiento controlado, el Análisis de Trabajo Seguro, el permiso de trabajo, el estudio de coordinación de protecciones vigente ni el registro oficial en SAP PM.</p>\n<p>Las respuestas del asistente IA pueden contener errores; el usuario es responsable de verificarlas contra la norma y el procedimiento antes de ejecutar cualquier actividad en campo.</p>\n<p>El uso está restringido a personal autorizado y a información de su ámbito de trabajo, conforme a las políticas de seguridad de la información de la empresa.</p>"
};
document.addEventListener("click", (e) => {
  const a = e.target.closest && e.target.closest('a[href^="legal.html"]');
  if (!a) return;
  e.preventDefault();
  const id = (a.getAttribute("href").split("#")[1] || "privacidad");
  UI.sheet({ title: id === "terminos" ? "Términos de uso" : "Aviso de privacidad", body: `<div style="line-height:1.55">${LEGAL[id].replace(/^<h2[^>]*>.*?<\/h2>/s, "")}</div><p class="honest">Borrador técnico pendiente de revisión de la Gerencia Jurídica y de TI.</p>` });
});
