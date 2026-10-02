"""Genera el diagrama swimlane del procedimiento UP15000 (SVG -> PNG/PDF)."""
import textwrap
from xml.sax.saxutils import escape

W = 1920
LANES = [(20, 360, "ING. ESPECIALISTA"), (360, 700, "CABO ELECTRICISTA"),
         (700, 1200, "OPERARIO ESPEC."), (1200, 1900, "DESCRIPCIÓN")]
CX = [190, 530, 860]
HDR_Y, HDR_H = 96, 44
TOP = HDR_Y + HDR_H
PITCH = 120
NROWS = 16
BOTTOM = TOP + NROWS * PITCH + 150
H = BOTTOM
FONT = "DejaVu Sans, Liberation Sans, Arial, sans-serif"

STY = {  # fill, stroke
    "term_ini": ("#27ae60", "#1e8449"), "term_fin": ("#e74c3c", "#b03a2e"),
    "proc": ("#d6eaf8", "#2e86c1"), "proc2": ("#eaf2f8", "#2e86c1"),
    "crit": ("#fadbd8", "#e74c3c"), "field": ("#fcf3cf", "#f5b041"),
    "ok": ("#e8f8f0", "#27ae60"), "dec": ("#fef9e7", "#f5a623"),
    "doc": ("#fcf3cf", "#f5b041"),
}
DARK = "#2c3e50"

def cy(r): return TOP + PITCH * r + PITCH // 2

out = []
def add(s): out.append(s)

def txt(x, y, s, size=15, weight="normal", fill=DARK, anchor="middle", style="normal"):
    add(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{fill}" '
        f'text-anchor="{anchor}" font-style="{style}">{escape(s)}</text>')

def box(r, lane, kind, title, sub=(), w=270, h=72, cx=None, shape="rect"):
    cx = CX[lane] if cx is None else cx
    y = cy(r)
    f, s = STY[kind]
    if shape == "term":
        w, h = 190, 46
        add(f'<rect x="{cx-w/2}" y="{y-h/2}" width="{w}" height="{h}" rx="23" fill="{f}" stroke="{s}" stroke-width="2.5"/>')
        txt(cx, y+6, title, 17, "bold", "#fff")
        return (cx, y - h/2, y + h/2, cx - w/2, cx + w/2)
    if shape == "dec":
        w, h = 260, 92
        add(f'<polygon points="{cx},{y-h/2} {cx+w/2},{y} {cx},{y+h/2} {cx-w/2},{y}" fill="{f}" stroke="{s}" stroke-width="2.5"/>')
        lines = [title] + list(sub)
    else:
        add(f'<rect x="{cx-w/2}" y="{y-h/2}" width="{w}" height="{h}" rx="10" fill="{f}" stroke="{s}" stroke-width="2.5"/>')
        lines = [title] + list(sub)
    n = len(lines)
    y0 = y - (n - 1) * 10 + 5
    for i, l in enumerate(lines):
        if i == 0:
            txt(cx, y0, l, 15.5, "bold")
        else:
            txt(cx, y0 + i * 20, l, 13.5)
    return (cx, y - h/2, y + h/2, cx - w/2, cx + w/2)

def path(d, label=None, lx=0, ly=0, lc="#555"):
    add(f'<path d="{d}" fill="none" stroke="{DARK}" stroke-width="2.4" marker-end="url(#ah)" stroke-linejoin="round"/>')
    if label:
        txt(lx, ly, label, 15, "bold", lc)

def line(d):
    add(f'<path d="{d}" fill="none" stroke="{DARK}" stroke-width="2.4" stroke-linejoin="round"/>')

def down(a, b, label=None, lx=0, ly=0, lc="#555"):
    """Conector vertical-horizontal-vertical de a(bottom) a b(top)."""
    x1, y1 = a[0], a[2]; x2, y2 = b[0], b[1]
    if abs(x1 - x2) < 1:
        path(f"M{x1},{y1} V{y2}", label, lx, ly, lc)
    else:
        m = (y1 + y2) / 2
        path(f"M{x1},{y1} V{m} H{x2} V{y2}", label, lx, ly, lc)

# ---------- fondo ----------
add(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="{FONT}">')
add('<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">'
    f'<path d="M0,0 L10,5 L0,10 z" fill="{DARK}"/></marker></defs>')
add(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
txt(W/2, 40, "PROCEDIMIENTO DE ULTRASONIDO PASIVO — UP15000 + ULTRATREND DMS", 24, "bold")
txt(W/2, 68, "Diagrama de flujo por responsabilidad (Sección 7)  ·  Refinería Olmeca · SICM", 15, "normal", "#566573")

for i, (x0, x1, name) in enumerate(LANES):
    fill = "#f7f9fb" if i % 2 == 0 else "#ffffff"
    if i == 3: fill = "#fbfcfd"
    add(f'<rect x="{x0}" y="{TOP}" width="{x1-x0}" height="{BOTTOM-TOP-4}" fill="{fill}" stroke="#d5dbe0" stroke-width="1.2"/>')
    add(f'<rect x="{x0}" y="{HDR_Y}" width="{x1-x0}" height="{HDR_H}" fill="{DARK}"/>')
    txt((x0+x1)/2, HDR_Y+28, name, 16, "bold", "#fff")
# separadores de fila (sutiles)
for r in range(1, NROWS):
    y = TOP + PITCH * r
    add(f'<line x1="20" y1="{y}" x2="1900" y2="{y}" stroke="#e5e9ed" stroke-width="1" stroke-dasharray="4 5"/>')

# ---------- bloques ----------
B = {}
B[0]  = box(0, 0, "term_ini", "INICIO", shape="term")
B[1]  = box(1, 0, "proc", "7.1 Emitir Orden SAP", ["PM01 + Ruta DMS"])
B[2]  = box(2, 0, "proc", "7.2 Configurar UP15000", ["SCM + Electrical + 40kHz"])
B[3]  = box(3, 1, "crit", "7.3 PTP + AST", ["NFPA 70E / NOM-029"])
B[4]  = box(4, 1, "crit", "7.4 Verificar gabinetes", ["CERRADOS y energizados"])
B[5]  = box(5, 2, "proc2", "7.5 ESCANEO GROSS", ["Sensibilidad alta (S=70)", "Barrido general del equipo"], w=250)
B[6]  = box(6, 2, "dec", "¿Señal", ["detectada?"], shape="dec")
B[7]  = box(7, 2, "field", "7.6 ESCANEO FINE", ["Reducir S, localizar fuente"], w=250)
BN    = box(7, 2, "ok", "SAVE “Normal”", [], w=170, h=56, cx=1100)
B[8]  = box(8, 2, "field", "7.7 ESCUCHAR", ["Identificar firma acústica"], w=250)
B[9]  = box(9, 2, "crit", "7.8 Grabar WAV + Foto", ["FFT → Record → Save"], w=250)
B[10] = box(10, 2, "proc2", "7.9 Registrar Temp IR", ["+ datos complementarios"], w=250)
B[11] = box(11, 1, "proc2", "7.10 Cierre campo", ["Remover SD, levantar área"])
B[12] = box(12, 0, "proc", "7.11 Análisis DMS", ["+ Spectralyzer (FFT)", "Clasificar firma acústica"], h=82)
B[13] = box(13, 0, "dec", "¿Arcing", ["detectado?"], shape="dec")
BA    = box(13, 1, "crit", "ALERTA INMEDIATA", ["Notificar operación"])
B[14] = box(14, 0, "doc", "7.12 Reporte", ["Anexo 9.3 + SAP PM01", "→ TECO / IW21"], h=82)
B[15] = box(15, 0, "term_fin", "FIN", shape="term")

# ---------- conectores ----------
down(B[0], B[1]); down(B[1], B[2]); down(B[2], B[3]); down(B[3], B[4]); down(B[4], B[5])
down(B[5], B[6])
down(B[6], B[7], "Sí", B[6][0]-22, B[6][2]+22, "#b03a2e")
# No -> SAVE Normal
y6 = cy(6)
path(f"M{B[6][0]+130},{y6} H{BN[0]} V{BN[1]}", "No", B[6][0]+160, y6-10, "#1e8449")
down(B[7], B[8]); down(B[8], B[9]); down(B[9], B[10])
# 7.9 -> 7.10 y SAVE Normal -> 7.10 (confluencia)
m = (B[10][2] + B[11][1]) / 2
path(f"M{B[10][0]},{B[10][2]} V{m} H{B[11][0]} V{B[11][1]}")
line(f"M{BN[0]},{BN[2]} V{m} H{B[10][0]}")
down(B[11], B[12]); down(B[12], B[13])
# Arcing: Sí -> alerta ; No -> reporte
y13 = cy(13)
path(f"M{B[13][0]+130},{y13} H{BA[3]}", "Sí", B[13][0]+162, y13-10, "#b03a2e")
down(B[13], B[14], "No", B[13][0]-22, B[13][2]+16, "#1e8449")
m2 = (B[13][2] + B[14][1]) / 2
line(f"M{BA[0]},{BA[2]} V{m2} H{B[13][0]}")
down(B[14], B[15])

# ---------- descripciones ----------
def desc(r, tag, main, note=None, crit=None, extra=None):
    x0, wcard = 1215, 670
    blocks = []
    for kind, s, n in [("main", main, 84), ("crit", crit, 70), ("note", note, 86), ("extra", extra, 78)]:
        if s: blocks.append((kind, textwrap.wrap(s, n)))
    nlines = sum(len(l) for _, l in blocks)
    hh = nlines * 21 + 22
    y = cy(r) - hh / 2
    accent = "#e74c3c" if crit else "#2e86c1"
    add(f'<rect x="{x0}" y="{y}" width="{wcard}" height="{hh}" rx="8" fill="#ffffff" stroke="#d5dbe0" stroke-width="1.2"/>')
    add(f'<rect x="{x0}" y="{y}" width="7" height="{hh}" rx="3" fill="{accent}"/>')
    ty = y + 28
    first = True
    for kind, lines in blocks:
        for l in lines:
            prefix = ""
            if kind == "main" and first and tag:
                add(f'<text x="{x0+20}" y="{ty}" font-size="14.5" fill="#1b2631"><tspan font-weight="bold">{escape(tag)}  </tspan>{escape(l)}</text>')
                first = False
            elif kind == "main":
                txt(x0+20, ty, l, 14.5, "normal", "#1b2631", "start")
            elif kind == "crit":
                txt(x0+20, ty, l, 13.5, "bold", "#b03a2e", "start")
            elif kind == "note":
                txt(x0+20, ty, l, 12.5, "normal", "#566573", "start", "italic")
            else:
                txt(x0+20, ty, l, 13.5, "normal", "#1e8449", "start")
            ty += 21

desc(1, "7.1", "Emitir orden SAP. Preparar ruta Electrical en Ultratrend DMS.")
desc(2, "7.2", "SD card → Encender → Setup: Application=Electrical, SCM, 40 kHz, S=70.",
     note="NOTA: Fig. 2 — Seleccionar “Electrical” en menú Applications")
desc(3, "7.3", "Verificar etiqueta de arco (IEEE 1584). PPE Category. PTP + AST 100%.",
     crit="ACTIVIDAD CRÍTICA — Distancias NFPA 70E Table 130.4(E)(a)")
desc(4, "7.4", "Verificar que TODOS los gabinetes estén CERRADOS y asegurados.",
     crit="NUNCA insertar el UP15000 en aberturas de equipo eléctrico")
desc(5, "7.5", "Técnica Gross-to-Fine: escanear en todas direcciones a distancia segura.",
     note="NOTA: Fig. 3 — Ajustar S=70, codos pegados al cuerpo, distancia segura")
desc(6, "", "Decisión: ¿hay emisión acústica anormal? Sí → 7.6 Escaneo Fine.",
     extra="No → guardar “Normal” y pasar a 7.10 Cierre de campo.")
desc(7, "7.6", "Reducir sensibilidad progresivamente. Usar rubber focusing probe. Aislar la fuente exacta del sonido. Mantener distancia segura.",
     extra="Rama No: SAVE “Normal” (sin hallazgo) y continuar en 7.10.")
desc(8, "7.7", "Corona = zumbido estable | Tracking = crepitar | Arcing = estallidos | PD = pulsos.")
desc(9, "7.8", "Tocar FFT → Record → Confirmar WAV. Tomar foto con cámara integrada.",
     note="NOTA: Fig. 3 — Grabar WAV desde pantalla FFT del analizador espectral")
desc(10, "7.9", "Registrar temperatura IR y datos complementarios del equipo.")
desc(11, "7.10", "Remover SD y levantar el área de trabajo.")
desc(12, "7.11", "Descargar datos. Analizar FFT para clasificar: Corona / Tracking / Arcing / PD.",
     note="NOTA: Fig. 9 — Espectro FFT en DMS. Fig. 10 — Tendencia dB en Chart tab.")
desc(13, "", "ARCING = FALLA ACTIVA. Notificar operación. Evaluar desenergización.",
     crit="Sí → ALERTA INMEDIATA y luego 7.12  |  No → 7.12 directo")
desc(14, "7.12", "Reporte: Anexo 9.3 + SAP PM01 → TECO / IW21.")

# ---------- simbología ----------
ly = BOTTOM - 150 + 20
lx = 1215
add(f'<rect x="{lx}" y="{ly}" width="670" height="118" rx="10" fill="#f8f9f9" stroke="#aeb6bf" stroke-width="1.4"/>')
txt(lx+335, ly+24, "SIMBOLOGÍA (PSIG-002 Anexo 9.5)", 14.5, "bold")
items = [("term_ini", "Inicio / Fin", "t"), ("proc", "Proceso / Actividad", "r"), ("dec", "Decisión", "d"),
         ("doc", "Documento / Registro", "r"), ("crit", "Actividad crítica SSPA", "r")]
pos = [(lx+25, ly+48), (lx+25, ly+78), (lx+245, ly+48), (lx+245, ly+78), (lx+450, ly+48)]
for (k, lab, shp), (x, y) in zip(items, pos):
    f, s = STY[k]
    if shp == "t": add(f'<rect x="{x}" y="{y-9}" width="34" height="18" rx="9" fill="{f}" stroke="{s}" stroke-width="2"/>')
    elif shp == "d": add(f'<polygon points="{x+17},{y-11} {x+34},{y} {x+17},{y+11} {x},{y}" fill="{f}" stroke="{s}" stroke-width="2"/>')
    else: add(f'<rect x="{x}" y="{y-9}" width="34" height="18" rx="4" fill="{f}" stroke="{s}" stroke-width="2"/>')
    txt(x+46, y+5, lab, 13.5, "normal", DARK, "start")
add('</svg>')

open("diagrama_up15000.svg", "w", encoding="utf-8").write("\n".join(out))
print("SVG", W, H)
