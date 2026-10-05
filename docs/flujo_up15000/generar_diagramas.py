"""Genera los diagramas swimlane del PEO-006 (SVG; PNG/PDF se renderizan con render.sh).

  python generar_diagramas.py
    -> diagrama_up15000.svg / diagrama_up15000_dinamico.svg        (pantalla, una sola hoja)
    -> doc/diagrama_*_hoja1.svg / _hoja2.svg                       (documento Word, dos hojas por diagrama)
"""
import os
import textwrap
from xml.sax.saxutils import escape

DARK = "#2c3e50"
FONT = "DejaVu Sans, Liberation Sans, Arial, sans-serif"
STY = {
    "term_ini": ("#27ae60", "#1e8449"), "term_fin": ("#e74c3c", "#b03a2e"),
    "proc": ("#d6eaf8", "#2e86c1"), "proc2": ("#eaf2f8", "#2e86c1"),
    "crit": ("#fadbd8", "#e74c3c"), "field": ("#fcf3cf", "#f5b041"),
    "ok": ("#e8f8f0", "#27ae60"), "dec": ("#fef9e7", "#f5a623"),
    "doc": ("#fcf3cf", "#f5b041"),
}
# "full": pantalla (1920 px, una hoja). "doc": para el documento (1400 px, fuentes mayores respecto al
# ancho y dos hojas por diagrama) para que el texto sea legible a 6.5 in de ancho.
CFG = {
    "full": dict(W=1920, LANES=[(20, 360), (360, 700), (700, 1200), (1200, 1900)], CX=[190, 530, 860], NCX=1100,
                 BW=270, OPW=250, OPW2=300, NW=170, DEC=(260, 92), PITCH=128, TFS=15.5, SFS=13.5, LBL=15,
                 DX=1215, DW=670, DM=14.5, DC=13.5, DN=12.5, DLH=21, WR=(70, 62, 80, 70), LEG=(1215, 670)),
    "doc": dict(W=1400, LANES=[(20, 265), (265, 510), (510, 910), (910, 1380)], CX=[142, 387, 650], NCX=845,
                BW=225, OPW=250, OPW2=262, NW=122, DEC=(236, 96), PITCH=150, TFS=12.8, SFS=11.5, LBL=14,
                DX=922, DW=446, DM=13.5, DC=12.5, DN=11.5, DLH=19, WR=(50, 44, 62, 52), LEG=(922, 446)),
}
NAMES = ["ING. ESPECIALISTA", "CABO ELECTRICISTA", "OPERARIO ESPEC.", "DESCRIPCIÓN"]
HDR_Y, HDR_H = 96, 44
TOP = HDR_Y + HDR_H
C = CFG["full"]
NROWS = 16


def configure(mode, nrows):
    global C, NROWS
    C, NROWS = CFG[mode], nrows


def cy(r):
    return TOP + C["PITCH"] * r + C["PITCH"] // 2


class Svg:
    """Acumula los elementos del cuerpo en coordenadas lógicas; luego se ensambla completo o por hoja."""

    def __init__(self):
        self.body = []
        self.pos = {}

    def add(self, s):
        self.body.append(s)

    def txt(self, x, y, s, size=15, weight="normal", fill=DARK, anchor="middle", style="normal"):
        self.add(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{fill}" '
                 f'text-anchor="{anchor}" font-style="{style}">{escape(s)}</text>')

    def box(self, key, r, lane, kind, title, sub=(), w=None, h=72, cx=None, shape="rect"):
        cx = C["CX"][lane] if cx is None else cx
        w = C["BW"] if w is None else w
        y = cy(r)
        f, s = STY[kind]
        if shape == "term":
            w, h = 190, 46
            self.add(f'<rect x="{cx-w/2}" y="{y-h/2}" width="{w}" height="{h}" rx="23" fill="{f}" stroke="{s}" stroke-width="2.5"/>')
            self.txt(cx, y + 6, title, 17, "bold", "#fff")
        else:
            if shape == "dec":
                w, h = C["DEC"]
                self.add(f'<polygon points="{cx},{y-h/2} {cx+w/2},{y} {cx},{y+h/2} {cx-w/2},{y}" fill="{f}" stroke="{s}" stroke-width="2.5"/>')
            else:
                self.add(f'<rect x="{cx-w/2}" y="{y-h/2}" width="{w}" height="{h}" rx="10" fill="{f}" stroke="{s}" stroke-width="2.5"/>')
            lines = [title] + list(sub)
            y0 = y - (len(lines) - 1) * 10 + 5
            for i, l in enumerate(lines):
                self.txt(cx, y0 + i * 19, l, C["TFS"] if i == 0 else C["SFS"], "bold" if i == 0 else "normal")
        self.pos[key] = (cx, y - h / 2, y + h / 2, cx - w / 2, cx + w / 2, y)

    def path(self, d, label=None, lx=0, ly=0, lc="#555", arrow=True):
        m = ' marker-end="url(#ah)"' if arrow else ""
        self.add(f'<path d="{d}" fill="none" stroke="{DARK}" stroke-width="2.4"{m} stroke-linejoin="round"/>')
        if label:
            self.txt(lx, ly, label, C["LBL"], "bold", lc)

    def down(self, a, b, label=None, lx=0, ly=0, lc="#555"):
        A, B = self.pos[a], self.pos[b]
        x1, y1, x2, y2 = A[0], A[2], B[0], B[1]
        if abs(x1 - x2) < 1:
            self.path(f"M{x1},{y1} V{y2}", label, lx, ly, lc)
        else:
            m = (y1 + y2) / 2
            self.path(f"M{x1},{y1} V{m} H{x2} V{y2}", label, lx, ly, lc)

    def desc(self, r, tag, main, note=None, crit=None, extra=None):
        x0, wcard, lh = C["DX"], C["DW"], C["DLH"]
        wm, wc, wn, we = C["WR"]
        first_text = (tag + "  " + main) if tag else main
        blocks = [(k, textwrap.wrap(t, n)) for k, t, n in
                  [("main", first_text, wm), ("crit", crit, wc), ("note", note, wn), ("extra", extra, we)] if t]
        hh = sum(len(l) for _, l in blocks) * lh + 22
        y = cy(r) - hh / 2
        accent = "#e74c3c" if crit else "#2e86c1"
        self.add(f'<rect x="{x0}" y="{y}" width="{wcard}" height="{hh}" rx="8" fill="#ffffff" stroke="#d5dbe0" stroke-width="1.2"/>')
        self.add(f'<rect x="{x0}" y="{y}" width="7" height="{hh}" rx="3" fill="{accent}"/>')
        ty, first = y + 8 + lh * 0.75, True
        tx = x0 + 18
        for kind, lines in blocks:
            for l in lines:
                if kind == "main" and first and tag:
                    rest = l[len(tag):].lstrip()
                    self.add(f'<text x="{tx}" y="{ty}" font-size="{C["DM"]}" fill="#1b2631"><tspan font-weight="bold">{escape(tag)}  </tspan>{escape(rest)}</text>')
                elif kind == "main":
                    self.txt(tx, ty, l, C["DM"], "normal", "#1b2631", "start")
                elif kind == "crit":
                    self.txt(tx, ty, l, C["DC"], "bold", "#b03a2e", "start")
                elif kind == "note":
                    self.txt(tx, ty, l, C["DN"], "normal", "#566573", "start", "italic")
                else:
                    self.txt(tx, ty, l, C["DC"], "normal", "#1e8449", "start")
                first = False
                ty += lh

    # ------------------------------------------------------------------ ensamblado
    def legend_svg(self, ly):
        lx, lw = C["LEG"]
        o = [f'<rect x="{lx}" y="{ly}" width="{lw}" height="118" rx="10" fill="#f8f9f9" stroke="#aeb6bf" stroke-width="1.4"/>']
        o.append(f'<text x="{lx+lw/2}" y="{ly+24}" font-size="{C["LBL"]-0.5}" font-weight="bold" fill="{DARK}" text-anchor="middle">SIMBOLOGÍA (PSIG-002 Anexo 9.5)</text>')
        items = [("term_ini", "Inicio / Fin", "t"), ("proc", "Proceso / Actividad", "r"), ("dec", "Decisión", "d"),
                 ("doc", "Documento / Registro", "r"), ("crit", "Actividad crítica SSPA", "r")]
        if lw > 600:
            pos = [(lx + 25, ly + 48), (lx + 25, ly + 78), (lx + 245, ly + 48), (lx + 245, ly + 78), (lx + 450, ly + 48)]
        else:  # dos columnas, tres filas
            pos = [(lx + 25, ly + 46), (lx + 25, ly + 70), (lx + 25, ly + 94), (lx + 215, ly + 46), (lx + 215, ly + 70)]
            items = [items[0], items[1], items[2], items[3], items[4]]
        fs = C["SFS"]
        for (k, lab, shp), (x, y) in zip(items, pos):
            f, s = STY[k]
            if shp == "t":
                o.append(f'<rect x="{x}" y="{y-9}" width="30" height="18" rx="9" fill="{f}" stroke="{s}" stroke-width="2"/>')
            elif shp == "d":
                o.append(f'<polygon points="{x+15},{y-11} {x+30},{y} {x+15},{y+11} {x},{y}" fill="{f}" stroke="{s}" stroke-width="2"/>')
            else:
                o.append(f'<rect x="{x}" y="{y-9}" width="30" height="18" rx="4" fill="{f}" stroke="{s}" stroke-width="2"/>')
            o.append(f'<text x="{x+40}" y="{y+5}" font-size="{fs}" fill="{DARK}">{escape(lab)}</text>')
        return "\n".join(o)

    def assemble(self, name, title, subtitle, r0=0, r1=None, legend=True, cont_next=None, cont_prev=None):
        """Escribe un SVG con las filas [r0, r1). r1=None -> hasta el final."""
        W = C["W"]
        r1 = NROWS if r1 is None else r1
        P = C["PITCH"]
        body_h = (r1 - r0) * P
        leg_h = 30
        Ht = TOP + body_h + leg_h
        off = P * r0
        o = [f'<svg xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" width="{W}" height="{Ht}" viewBox="0 0 {W} {Ht}" font-family="{FONT}">',
             '<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">'
             f'<path d="M0,0 L10,5 L0,10 z" fill="{DARK}"/></marker>'
             f'<clipPath id="cl"><rect x="0" y="{TOP}" width="{W}" height="{body_h}"/></clipPath></defs>',
             f'<rect width="{W}" height="{Ht}" fill="#ffffff"/>',
             f'<text x="{W/2}" y="40" font-size="{24 if W>1500 else 20}" font-weight="bold" fill="{DARK}" text-anchor="middle">{escape(title)}</text>',
             f'<text x="{W/2}" y="68" font-size="{15 if W>1500 else 13}" fill="#566573" text-anchor="middle">{escape(subtitle)}</text>']
        for i, ((x0, x1), nm) in enumerate(zip(C["LANES"], NAMES)):
            fill = "#f7f9fb" if i % 2 == 0 else "#ffffff"
            if i == 3:
                fill = "#fbfcfd"
            o.append(f'<rect x="{x0}" y="{TOP}" width="{x1-x0}" height="{Ht-TOP-4}" fill="{fill}" stroke="#d5dbe0" stroke-width="1.2"/>')
            o.append(f'<rect x="{x0}" y="{HDR_Y}" width="{x1-x0}" height="{HDR_H}" fill="{DARK}"/>')
            o.append(f'<text x="{(x0+x1)/2}" y="{HDR_Y+28}" font-size="{C["LBL"]+1}" font-weight="bold" fill="#fff" text-anchor="middle">{nm}</text>')
        for r in range(1, r1 - r0):
            y = TOP + P * r
            o.append(f'<line x1="20" y1="{y}" x2="{C["LANES"][-1][1]}" y2="{y}" stroke="#e5e9ed" stroke-width="1" stroke-dasharray="4 5"/>')
        o.append(f'<g clip-path="url(#cl)"><g transform="translate(0,{-off})">')
        o.extend(self.body)
        o.append("</g></g>")
        if cont_next:
            o.append(f'<text x="{C["CX"][2]}" y="{TOP+body_h+22}" font-size="{C["LBL"]}" font-weight="bold" fill="#b03a2e" text-anchor="middle">{escape(cont_next)}</text>')
        if cont_prev:
            o.append(f'<text x="{C["CX"][2]+16}" y="{TOP+22}" font-size="{C["LBL"]}" font-weight="bold" fill="#b03a2e" text-anchor="start">{escape(cont_prev)}</text>')
        if legend:
            o.append(self.legend_svg(TOP + (NROWS - 1 - r0) * P + P // 2 - 59))
        o.append("</svg>")
        open(name, "w", encoding="utf-8").write("\n".join(o))
        return W, Ht


def electrico(mode):
    configure(mode, 17)
    d = Svg()
    b = d.box
    op, nx, nw = C["OPW"], C["NCX"], C["NW"]
    b("ini", 0, 0, "term_ini", "INICIO", shape="term")
    b("s1", 1, 0, "proc", "7.1 Emitir Orden SAP", ["PM01 + Ruta DMS"])
    b("s2", 2, 0, "proc", "7.2 Configurar UP15000", ["SCM + Electrical + 40kHz"])
    b("s3", 3, 1, "crit", "7.3.1 PTP + AST", ["NFPA 70E / NOM-029"])
    b("s4", 4, 1, "crit", "7.3.3 Verificar gabinetes", ["CERRADOS y energizados"])
    b("s5", 5, 2, "proc2", "7.4 ESCANEO GROSS", ["Sensibilidad alta (S=70)", "Barrido general del equipo"], w=op)
    b("dec", 6, 2, "dec", "¿Señal", ["detectada?"], shape="dec")
    b("s6", 7, 2, "field", "7.5 ESCANEO FINE", ["Reducir S, localizar fuente"], w=op)
    b("norm", 7, 2, "ok", "SAVE “Normal”", [], w=nw, h=56, cx=nx)
    b("s7", 8, 2, "field", "7.6 ESCUCHAR", ["Identificar firma acústica"], w=op)
    b("s8", 9, 2, "crit", "7.7.1 Grabar WAV + Foto", ["FFT → Record → Save"], w=op)
    b("s9", 10, 2, "proc2", "7.7.4 Registrar Temp IR", ["+ datos complementarios"], w=op)
    b("dec3", 11, 2, "dec", "¿Más puntos", ["en la ruta?"], shape="dec")
    b("s10", 12, 1, "proc2", "7.8 Cierre campo", ["Remover SD, levantar área"])
    b("s11", 13, 0, "proc", "7.9.1 Análisis DMS", ["+ Spectralyzer (FFT)", "Clasificar firma acústica"], h=82)
    b("dec2", 14, 0, "dec", "¿Arcing", ["detectado?"], shape="dec")
    b("alert", 14, 1, "crit", "ALERTA INMEDIATA", ["Notificar operación"], w=C["BW"] - (40 if C["W"] < 1500 else 0))
    b("s12", 15, 0, "doc", "7.9.5 Reporte", ["Anexo 9.3 + SAP PM01", "→ TECO / IW21"], h=82)
    b("fin", 16, 0, "term_fin", "FIN", shape="term")
    P = d.pos
    dh = C["DEC"][0] / 2
    for a, c in [("ini", "s1"), ("s1", "s2"), ("s2", "s3"), ("s3", "s4"), ("s4", "s5"), ("s5", "dec")]:
        d.down(a, c)
    d.down("dec", "s6", "Sí", P["dec"][0] - 22, P["dec"][2] + 22, "#b03a2e")
    d.path(f"M{P['dec'][0]+dh},{P['dec'][5]} H{P['norm'][0]} V{P['norm'][1]}", "No", P["dec"][0] + dh + 24, P["dec"][5] - 10, "#1e8449")
    for a, c in [("s6", "s7"), ("s7", "s8"), ("s8", "s9")]:
        d.down(a, c)
    d.down("s9", "dec3")
    m = (P["s9"][2] + P["dec3"][1]) / 2
    d.path(f"M{P['norm'][0]},{P['norm'][2]} V{m} H{P['s9'][0]}", arrow=False)
    xl = C["LANES"][2][0] - 30  # lazo de regreso al siguiente punto de la ruta
    yd = P["dec3"][5]
    d.path(f"M{P['dec3'][0]-dh},{yd} H{xl} V{P['s5'][5]} H{P['s5'][3]}", "Sí", (xl + P['dec3'][0] - dh) / 2, yd - 10, "#b03a2e")
    d.down("dec3", "s10", "No", P["dec3"][0] + 24, P["dec3"][2] + 18, "#1e8449")
    d.down("s10", "s11"); d.down("s11", "dec2")
    y13 = P["dec2"][5]
    d.path(f"M{P['dec2'][0]+dh},{y13} H{P['alert'][3]}", "Sí", P["dec2"][0] + dh + (14 if C["W"] < 1500 else 22), y13 - 14, "#b03a2e")
    d.down("dec2", "s12", "No", P["dec2"][0] - 22, P["dec2"][2] + 16, "#1e8449")
    m2 = (P["dec2"][2] + P["s12"][1]) / 2
    d.path(f"M{P['alert'][0]},{P['alert'][2]} V{m2} H{P['dec2'][0]}", arrow=False)
    d.down("s12", "fin")
    D = d.desc
    D(1, "7.1", "Emitir orden SAP PM01. Crear o verificar la ruta Electrical en Ultratrend DMS y cargarla a la SD card.")
    D(2, "7.2", "SD card → Encender → Setup: Application=Electrical, SCM, 40 kHz, S=70.",
      note="NOTA: Fig. 2 — Seleccionar “Electrical” en menú Applications")
    D(3, "7.3.1", "Elaborar PTP y AST (100% de firmas). Verificar etiqueta de arco (IEEE 1584), PPE Category y distancias de aproximación.",
      crit="ACTIVIDAD CRÍTICA — Distancias NFPA 70E Table 130.4(E)(a)")
    D(4, "7.3.3", "Verificar que TODOS los gabinetes estén CERRADOS y asegurados. Colocar EPP y conectar audífonos.",
      crit="NUNCA insertar el UP15000 en aberturas de equipo eléctrico")
    D(5, "7.4", "Técnica Gross-to-Fine: escanear en todas direcciones a distancia segura.",
      note="NOTA: Fig. 3 — Ajustar S=70, codos pegados al cuerpo, distancia segura")
    D(6, "", "Decisión: ¿hay emisión acústica anormal? Sí → 7.5 Escaneo Fine.",
      extra="No → guardar “Normal” y pasar al siguiente punto / 7.8 Cierre en campo.")
    D(7, "7.5", "Reducir sensibilidad progresivamente. Usar rubber focusing probe. Aislar la fuente exacta del sonido. Mantener distancia segura.",
      extra="Rama No: SAVE “Normal” (sin hallazgo) y continuar en 7.8.")
    D(8, "7.6", "Corona = zumbido estable | Tracking = crepitar | Arcing = estallidos | PD = pulsos rítmicos | Conexión floja = zumbido a 120 Hz.")
    D(9, "7.7", "Tocar FFT → Record → Confirmar WAV. Tomar foto con cámara integrada.",
      note="NOTA: Fig. 4 — Grabar WAV desde pantalla FFT del analizador espectral")
    D(10, "7.7.4", "Registrar temperatura IR del punto (emisividad según superficie) y datos complementarios.")
    D(11, "", "Decisión: ¿quedan puntos de la ruta por inspeccionar? Sí → regresar a 7.4 con el siguiente punto.",
      extra="No → 7.8 Cierre en campo (7.8.1: verificar registros guardados).")
    D(12, "7.8", "HOME → Remove SD y levantar el área de trabajo.")
    D(13, "7.9", "Descargar datos. Analizar FFT y Time Waveform para clasificar: Corona / Tracking / Arcing / PD / Conexión floja.",
      note="NOTA: Fig. 6 — Espectro FFT en DMS. Fig. 7 — Tendencia dB en Chart tab.")
    D(14, "", "ARCING = FALLA ACTIVA. Notificar operación, evaluar desenergización y permanecer en el área hasta que se decida (7.8.3).",
      crit="Sí → ALERTA INMEDIATA y luego 7.9.5  |  No → 7.9.5 directo")
    D(15, "7.9.5", "Reporte conforme Anexo 9.3. Registrar en SAP PM01 → TECO; abrir IW21 si hay arcing o PD (7.9.6).")
    return d


def dinamico(mode):
    configure(mode, 16)
    d = Svg()
    b = d.box
    op, op2, nx, nw = C["OPW"], C["OPW2"], C["NCX"], C["NW"]
    b("ini", 0, 0, "term_ini", "INICIO", shape="term")
    b("s1", 1, 0, "proc", "7.10.1 Orden SAP + Ruta", ["PM01 + ruta Mechanical (DMS)"])
    b("s2", 2, 0, "proc", "7.10.2 Configurar UP15000", ["STM + Bearing + 38 kHz"])
    b("s3", 3, 1, "crit", "7.10.3 PTP + AST", ["Partes giratorias / Tipo A"])
    b("s4", 4, 1, "crit", "7.10.3 Verificar equipo", ["En operación, guardas instaladas"])
    b("s5", 5, 2, "proc2", "7.10.4 MEDIR POR CONTACTO", ["STM en LA / LOA", "Presión y punto constantes"], w=op2)
    b("dec", 6, 2, "dec", "¿Δ dB ≥ +8 o", ["sonido anormal?"], shape="dec")
    b("s6", 7, 2, "field", "7.10.5 ESCUCHAR", ["Clasificar nivel y sonido"], w=op)
    b("norm", 7, 2, "ok", "SAVE “Normal”", [], w=nw, h=56, cx=nx)
    b("s7", 8, 2, "crit", "7.10.6 Grabar WAV + Foto", ["+ Temp IR + corriente/carga"], w=op)
    b("s8", 9, 2, "field", "7.10.7 Lubricar (si aplica)", ["Dosis pequeñas, vigilar dB"], w=op)
    b("dec3", 10, 2, "dec", "¿Más puntos", ["en la ruta?"], shape="dec")
    b("s9", 11, 1, "proc2", "7.10.8 Cierre campo", ["Remove SD, levantar área"])
    b("s10", 12, 0, "proc", "7.10.9 Análisis DMS", ["+ Spectralyzer (FFT / onda)", "Correlación vibración / IR"], h=82)
    b("dec2", 13, 0, "dec", "¿Alarma o", ["Crítico (≥ +12 dB)?"], shape="dec")
    b("alert", 13, 1, "crit", "AVISO A OPERACIÓN", ["Evaluar paro / intervención"], w=C["BW"] - (20 if C["W"] < 1500 else 0))
    b("s11", 14, 0, "doc", "7.10.10 Reporte", ["Anexo 9.8 + SAP PM01", "→ TECO / IW21"], h=82)
    b("fin", 15, 0, "term_fin", "FIN", shape="term")
    P = d.pos
    dh = C["DEC"][0] / 2
    for a, c in [("ini", "s1"), ("s1", "s2"), ("s2", "s3"), ("s3", "s4"), ("s4", "s5"), ("s5", "dec")]:
        d.down(a, c)
    d.down("dec", "s6", "Sí", P["dec"][0] - 22, P["dec"][2] + 22, "#b03a2e")
    d.path(f"M{P['dec'][0]+dh},{P['dec'][5]} H{P['norm'][0]} V{P['norm'][1]}", "No", P["dec"][0] + dh + 24, P["dec"][5] - 10, "#1e8449")
    for a, c in [("s6", "s7"), ("s7", "s8")]:
        d.down(a, c)
    d.down("s8", "dec3")
    m = (P["s8"][2] + P["dec3"][1]) / 2
    d.path(f"M{P['norm'][0]},{P['norm'][2]} V{m} H{P['s8'][0]}", arrow=False)
    xl = C["LANES"][2][0] - 30  # lazo de regreso al siguiente punto de la ruta
    yd = P["dec3"][5]
    d.path(f"M{P['dec3'][0]-dh},{yd} H{xl} V{P['s5'][5]} H{P['s5'][3]}", "Sí", (xl + P['dec3'][0] - dh) / 2, yd - 10, "#b03a2e")
    d.down("dec3", "s9", "No", P["dec3"][0] + 24, P["dec3"][2] + 18, "#1e8449")
    d.down("s9", "s10"); d.down("s10", "dec2")
    y = P["dec2"][5]
    d.path(f"M{P['dec2'][0]+dh},{y} H{P['alert'][3]}", "Sí", P["dec2"][0] + dh + (14 if C["W"] < 1500 else 22), y - 14, "#b03a2e")
    d.down("dec2", "s11", "No", P["dec2"][0] - 22, P["dec2"][2] + 16, "#1e8449")
    m2 = (P["dec2"][2] + P["s11"][1]) / 2
    d.path(f"M{P['alert'][0]},{P['alert'][2]} V{m2} H{P['dec2'][0]}", arrow=False)
    d.down("s11", "fin")
    D = d.desc
    D(1, "7.10.1", "Emitir orden SAP PM01 con TAG, RPM y potencia. Preparar ruta Mechanical en DMS: puntos por rodamiento/chumacera, geometría, línea base y alarmas (+8 / +12 / +16 dB).")
    D(2, "7.10.2", "SD card → Encender → Instalar módulo STM (contacto) → Setup: Application=Bearing, 38 kHz, Instrument Setup=Auto → audífonos.",
      note="NOTA: usar SIEMPRE el mismo ajuste de sensibilidad para comparar contra la línea base")
    D(3, "7.10.3", "Elaborar PTP y AST (100% de firmas) incluyendo partes giratorias, superficies calientes, ruido y trabajo en altura [TIPO A].",
      crit="ACTIVIDAD CRÍTICA — Prevención de caídas DPI-SSIPA-PCS-0105 en Tipo A")
    D(4, "7.10.3", "Confirmar equipo EN OPERACIÓN estable (carga y velocidad como la línea base), guardas instaladas y puntos de contacto limpios.",
      crit="NUNCA retirar guardas ni tocar flechas, acoplamientos o partes giratorias")
    D(5, "7.10.4", "Apoyar el STM perpendicular, cerca de la zona de carga del rodamiento, con presión constante. Esperar ≥5 s, leer dB y escuchar ≥15 s en cada punto.",
      note="NOTA: medir LA y LOA del motor y los rodamientos/chumaceras del equipo acoplado; punto de referencia en estructura")
    D(6, "", "Decisión: ¿Δ dB ≥ +8 sobre la línea base o sonido anormal? Sí → 7.10.5.",
      extra="No → guardar “Normal” y pasar al siguiente punto / 7.10.8.")
    D(7, "7.10.5", "Clasificar por Δ dB y por sonido: Normal (<+8) | Alerta (+8) | Alarma (+12) | Crítico (+16). Distinguir lubricación, falla de pista/elemento rodante, chumacera y daño mecánico.",
      note="NOTA: la calidad del sonido es la herramienta PRIMARIA; el dB solo no clasifica la falla (Anexo 9.9)")
    D(8, "7.10.6", "FFT → Record (≥30 s) → Confirmar WAV. Foto del punto y de la placa. Temperatura IR, RPM, corriente y carga del motor para correlación.")
    D(9, "7.10.7", "Solo si el programa de lubricación lo autoriza: engrasar en dosis pequeñas vigilando dB; detener al volver cerca de la línea base. NO sobrelubricar.",
      extra="Si el dB no baja o aparecen clics/crepitar: no es falta de grasa → Alarma/Crítico.")
    D(10, "", "Decisión: ¿quedan puntos de la ruta por medir? Sí → regresar a 7.10.4 con el siguiente punto.",
      extra="No → 7.10.8 Cierre en campo.")
    D(11, "7.10.8", "Verificar registros, HOME → Remove SD, limpiar STM y levantar el área. Informar de inmediato hallazgos Alarma o Crítico.")
    D(12, "7.10.9", "Descargar datos. Tendencia dB vs línea base. Time Waveform (impactos, factor de cresta) y FFT (BPFO, BPFI, BSF, FTF y múltiplos de 1× RPM). Correlacionar con vibración, IR, MCSA y aceite.",
      note="NOTA: comparar LA vs LOA y contra equipos idénticos")
    D(13, "", "Alarma (+12 dB) o Crítico (+16 dB): notificar operación y evaluar intervención / paro. Aviso SAP IW21 prioridad 2 (Alarma) o 1 (Crítico).",
      crit="Sí → AVISO A OPERACIÓN y luego 7.10.10  |  No → 7.10.10 directo")
    D(14, "7.10.10", "Reporte conforme Anexo 9.8. Registrar en SAP PM01 → TECO. Actualizar línea base si hubo cambio de rodamiento o intervención.")
    return d


E_TITLE = "PROCEDIMIENTO DE ULTRASONIDO PASIVO — EQUIPO ELÉCTRICO (UP15000 + SCM)"
D_TITLE = "PROCEDIMIENTO DE ULTRASONIDO DE CONTACTO — EQUIPO DINÁMICO (UP15000 + STM)"
E_SUB = "Diagrama de flujo 8.1 · Actividades 7.1 a 7.9 · PEO-006 · Refinería Olmeca · SICM"
D_SUB = "Diagrama de flujo 8.2 · Actividad 7.10 · Rodamientos, chumaceras y daño mecánico en motores · PEO-006"


if __name__ == "__main__":
    os.makedirs("doc", exist_ok=True)
    # --- pantalla: una sola hoja
    e = electrico("full"); e.assemble("diagrama_up15000.svg", E_TITLE, E_SUB)
    d = dinamico("full"); d.assemble("diagrama_up15000_dinamico.svg", D_TITLE, D_SUB)
    # --- documento: dos hojas por diagrama
    sizes = {}
    e = electrico("doc")
    sizes["e1"] = e.assemble("doc/diagrama_8_1_hoja1.svg", E_TITLE, E_SUB + " (hoja 1 de 2)", 0, 8, legend=False,
                             cont_next="▼ continúa en hoja 2")
    sizes["e2"] = e.assemble("doc/diagrama_8_1_hoja2.svg", E_TITLE, E_SUB + " (hoja 2 de 2)", 8, 17, legend=True,
                             cont_prev="▲ viene de hoja 1")
    d = dinamico("doc")
    sizes["d1"] = d.assemble("doc/diagrama_8_2_hoja1.svg", D_TITLE, D_SUB + " (hoja 1 de 2)", 0, 8, legend=False,
                             cont_next="▼ continúa en hoja 2")
    sizes["d2"] = d.assemble("doc/diagrama_8_2_hoja2.svg", D_TITLE, D_SUB + " (hoja 2 de 2)", 8, 16, legend=True,
                             cont_prev="▲ viene de hoja 1")
    print("SVG OK", sizes)
