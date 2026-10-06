"""Genera los diagramas de flujo swimlane del PEO-006 conforme al Anexo 9.14 del PSGI-02.

  python generar_diagramas.py
    -> diagrama_up15000.svg / diagrama_up15000_dinamico.svg   (pantalla, una sola hoja)
    -> doc/diagrama_8_1_hojaN.svg / doc/diagrama_8_2_hojaN.svg (documento Word, 3 hojas por diagrama)

Reglas del Anexo 9.14 aplicadas: una columna por puesto y descripción a la derecha a la misma altura del símbolo;
símbolos de actividad, decisión, documento, inicio/terminación, conector de actividades (círculo) y conector de hoja;
toda opción de una decisión genera al menos una acción del mismo puesto antes de pasar a otro puesto.
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
    "doc": ("#fcf3cf", "#f5b041"), "conn": ("#ffffff", "#2c3e50"),
}
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
NROWS = 19


def configure(mode, nrows):
    global C, NROWS
    C, NROWS = CFG[mode], nrows


def cy(r):
    return TOP + C["PITCH"] * r + C["PITCH"] // 2


class Svg:
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
            elif kind == "doc":  # símbolo de documento (base ondulada)
                x0, x1, y0, y1 = cx - w / 2, cx + w / 2, y - h / 2, y + h / 2
                self.add(f'<path d="M{x0},{y0} H{x1} V{y1-8} Q{x1-(w/4)},{y1+8} {cx},{y1-4} T{x0},{y1-4} Z" '
                         f'fill="{f}" stroke="{s}" stroke-width="2.5" stroke-linejoin="round"/>')
            else:
                self.add(f'<rect x="{cx-w/2}" y="{y-h/2}" width="{w}" height="{h}" rx="10" fill="{f}" stroke="{s}" stroke-width="2.5"/>')
            lines = [title] + list(sub)
            y0 = y - (len(lines) - 1) * 10 + 5
            for i, l in enumerate(lines):
                self.txt(cx, y0 + i * 19, l, C["TFS"] if i == 0 else C["SFS"], "bold" if i == 0 else "normal")
        self.pos[key] = (cx, y - h / 2, y + h / 2, cx - w / 2, cx + w / 2, y)

    def conn(self, key, cx, r, text):
        """Conector de actividades: círculo con el número de la actividad a la que conecta."""
        y = cy(r)
        rad = 22 if len(text) <= 5 else 29
        self.add(f'<circle cx="{cx}" cy="{y}" r="{rad}" fill="#fff" stroke="{DARK}" stroke-width="2.2"/>')
        self.txt(cx, y + 4, text, 11 if len(text) <= 5 else 9.5, "bold")
        self.pos[key] = (cx, y - rad, y + rad, cx - rad, cx + rad, y)

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
        items = [("term_ini", "Inicio / Terminación", "t"), ("proc", "Actividad", "r"), ("dec", "Decisión", "d"),
                 ("doc", "Documento / Registro", "r"), ("conn", "Conector de actividades", "c"),
                 ("conn", "Conector de hoja", "s"), ("crit", "Actividad crítica SSPA", "r")]
        wide = lw > 600
        rows = 3 if wide else 4
        o = [f'<rect x="{lx}" y="{ly}" width="{lw}" height="{44+rows*26}" rx="10" fill="#f8f9f9" stroke="#aeb6bf" stroke-width="1.4"/>',
             f'<text x="{lx+lw/2}" y="{ly+24}" font-size="{C["LBL"]-0.5}" font-weight="bold" fill="{DARK}" text-anchor="middle">SIMBOLOGÍA (PSGI-02, Anexo 9.14)</text>']
        colw = lw / (3 if wide else 2)
        fs = C["SFS"]
        for i, (k, lab, shp) in enumerate(items):
            col, row = divmod(i, rows)
            x = lx + 22 + col * colw
            y = ly + 50 + row * 26
            f, s = STY[k]
            if shp == "t":
                o.append(f'<rect x="{x}" y="{y-9}" width="30" height="18" rx="9" fill="{f}" stroke="{s}" stroke-width="2"/>')
            elif shp == "d":
                o.append(f'<polygon points="{x+15},{y-11} {x+30},{y} {x+15},{y+11} {x},{y}" fill="{f}" stroke="{s}" stroke-width="2"/>')
            elif shp == "c":
                o.append(f'<circle cx="{x+15}" cy="{y}" r="10" fill="#fff" stroke="{DARK}" stroke-width="2"/>')
            elif shp == "s":
                o.append(f'<path d="M{x+4},{y-10} H{x+26} V{y+4} L{x+15},{y+11} L{x+4},{y+4} Z" fill="#fff" stroke="{DARK}" stroke-width="2"/>')
            elif k == "doc":
                o.append(f'<path d="M{x},{y-9} H{x+30} V{y+5} Q{x+22},{y+13} {x+15},{y+5} T{x},{y+5} Z" fill="{f}" stroke="{s}" stroke-width="2"/>')
            else:
                o.append(f'<rect x="{x}" y="{y-9}" width="30" height="18" rx="4" fill="{f}" stroke="{s}" stroke-width="2"/>')
            o.append(f'<text x="{x+40}" y="{y+5}" font-size="{fs}" fill="{DARK}">{escape(lab)}</text>')
        return "\n".join(o)

    def sheet_conn(self, x, y, n):
        return (f'<path d="M{x-14},{y-14} H{x+14} V{y+4} L{x},{y+16} L{x-14},{y+4} Z" fill="#fff" stroke="{DARK}" stroke-width="2.2"/>'
                f'<text x="{x}" y="{y+5}" font-size="14" font-weight="bold" fill="{DARK}" text-anchor="middle">{n}</text>')

    def assemble(self, name, title, subtitle, r0=0, r1=None, legend=True, cont_next=None, cont_prev=None):
        """Escribe un SVG con las filas [r0, r1). cont_next / cont_prev: lista de (x, n) con los conectores de hoja."""
        W = C["W"]
        r1 = NROWS if r1 is None else r1
        P = C["PITCH"]
        body_h = (r1 - r0) * P
        Ht = TOP + body_h + 40
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
        for x, n in (cont_next or []):
            o.append(self.sheet_conn(x, TOP + body_h - 16, n))
        for x, n in (cont_prev or []):
            o.append(self.sheet_conn(x, TOP + 18, n))
        if legend:
            ly = TOP + (NROWS - 1 - r0) * P + P // 2 - 60
            o.append(self.legend_svg(ly))
        o.append("</svg>")
        open(name, "w", encoding="utf-8").write("\n".join(o))
        return W, Ht


def _cierre(d, dh, dec2, iw, alert, rep):
    """Cierre: decisión del Ing. con acción propia en ambas opciones (Anexo 9.14, f)."""
    P = d.pos
    d.down(dec2, iw, "Sí", P[dec2][0] - 22, P[dec2][2] + 18, "#b03a2e")
    d.path(f"M{P[iw][4]},{P[iw][5]} H{P[alert][3]}")
    m2 = (P[alert][2] + P[rep][1]) / 2
    d.path(f"M{P[alert][0]},{P[alert][2]} V{m2} H{P[rep][0]} V{P[rep][1]}")
    y = P[dec2][5]
    d.path(f"M{P[dec2][0]+dh},{y} H{P['ca'][3]}", "No", P[dec2][0] + dh + 16, y - 10, "#1e8449")
    d.path(f"M{P['cb'][3]},{P['cb'][5]} H{P[rep][4]}")


def electrico(mode):
    configure(mode, 20)
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
    b("s10a", 12, 2, "proc2", "7.8.1 Verificar registros", ["Guardados en la ruta"], w=op)
    b("s10", 13, 1, "proc2", "7.8.2 Cierre campo", ["Remover SD, levantar área"])
    b("s11", 14, 0, "proc", "7.9.1 Análisis DMS", ["+ Spectralyzer (FFT)", "Clasificar firma acústica"], h=82)
    b("s12", 15, 0, "doc", "7.9.5 Reporte", ["Anexo 9.3"], h=72)
    b("dec2", 16, 0, "dec", "¿Arcing, PD o", ["fuga de SF₆?"], shape="dec")
    b("iw", 17, 0, "proc", "7.9.6 Abrir aviso IW21", ["Arcing P1 / PD, SF₆ P2"])
    b("alert", 17, 1, "crit", "ALERTA INMEDIATA", ["Notificar operación"], w=C["BW"] - (40 if C["W"] < 1500 else 0))
    b("s13", 18, 0, "proc", "7.9.6 Registrar TECO", ["SAP PM01"])
    b("fin", 19, 0, "term_fin", "FIN", shape="term")
    d.conn("ca", C["CX"][0] + C["DEC"][0] / 2 + 52, 16, "7.9.6")
    d.conn("cb", C["CX"][0] + C["BW"] / 2 + 34, 18, "7.9.6")
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
    xl = C["LANES"][2][0] - 30  # lazo de regreso al siguiente punto de la ruta (Operario)
    yd = P["dec3"][5]
    d.path(f"M{P['dec3'][0]-dh},{yd} H{xl} V{P['s5'][5]} H{P['s5'][3]}", "Sí", (xl + P['dec3'][0] - dh) / 2, yd - 10, "#b03a2e")
    d.down("dec3", "s10a", "No", P["dec3"][0] + 24, P["dec3"][2] + 18, "#1e8449")
    d.down("s10a", "s10"); d.down("s10", "s11"); d.down("s11", "s12"); d.down("s12", "dec2")
    _cierre(d, dh, "dec2", "iw", "alert", "s13")
    d.down("s13", "fin")
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
      extra="No → guardar “Normal” y pasar a la decisión de más puntos.")
    D(7, "7.5", "Reducir sensibilidad progresivamente. Usar rubber focusing probe. Aislar la fuente exacta del sonido. Mantener distancia segura.",
      extra="Rama No: SAVE “Normal” (sin hallazgo) y continuar en la decisión de más puntos.")
    D(8, "7.6", "Corona = zumbido estable | Tracking = crepitar | Arcing = estallidos | PD = pulsos rítmicos | Conexión floja = zumbido a 120 Hz | Fuga de SF₆ = siseo continuo localizado (confirmar con detector, 7.6.2 a 7.6.4).",
      crit="ARCING: reportarlo de inmediato a operación; NO abrir el gabinete")
    D(9, "7.7", "Tocar FFT → Record → Confirmar WAV. Tomar foto con cámara integrada.",
      note="NOTA: Fig. 4 — Grabar WAV desde pantalla FFT del analizador espectral")
    D(10, "7.7.4", "Registrar temperatura IR del punto (emisividad según superficie) y datos complementarios.")
    D(11, "", "Decisión: ¿quedan puntos de la ruta por inspeccionar? Sí → regresar a 7.4 con el siguiente punto.",
      extra="No → 7.8.1 Verificar registros guardados.")
    D(12, "7.8.1", "Verificar los registros guardados al concluir todos los puntos de la ruta.")
    D(13, "7.8.2", "HOME → Remove SD y levantar el área de trabajo. Si hubo ARCING: permanecer y coordinar con operación hasta que se decida (7.8.3).")
    D(14, "7.9", "Descargar datos. Analizar FFT y Time Waveform para clasificar: Corona / Tracking / Arcing / PD / Conexión floja.",
      note="NOTA: Fig. 6 — Espectro FFT en DMS. Fig. 7 — Tendencia dB en Chart tab.")
    D(15, "7.9.5", "Emitir el reporte de inspección conforme al Anexo 9.3.")
    D(16, "", "Decisión: ¿se detectó arcing, descarga parcial o fuga de SF₆? Sí → 7.9.6 Abrir aviso IW21; No → 7.9.6 Registrar TECO.",
      crit="ARCING = FALLA ACTIVA. Evaluar desenergización con operación")
    D(17, "7.9.6", "Abrir aviso IW21 (arcing = prioridad 1; PD y fuga de SF₆ = prioridad 2). El Cabo da la ALERTA INMEDIATA a operación.")
    D(18, "7.9.6", "Registrar en SAP PM01 → TECO.")
    return d


def dinamico(mode):
    configure(mode, 19)
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
    b("s9a", 11, 2, "proc2", "7.10.8.1 Verificar registros", ["Guardados en la ruta"], w=op)
    b("s9", 12, 1, "proc2", "7.10.8 Cierre campo", ["Remove SD, levantar área"])
    b("s10", 13, 0, "proc", "7.10.9 Análisis DMS", ["+ Spectralyzer (FFT / onda)", "Correlación vibración / IR"], h=82)
    b("s11", 14, 0, "doc", "7.10.10.1 Reporte", ["Anexo 9.8"], h=72)
    b("dec2", 15, 0, "dec", "¿Alarma o", ["Crítico (≥ +12 dB)?"], shape="dec")
    b("iw", 16, 0, "proc", "7.10.10.2 Abrir aviso IW21", ["Alarma P2 / Crítico P1"])
    b("alert", 16, 1, "crit", "AVISO A OPERACIÓN", ["Evaluar paro / intervención"], w=C["BW"] - (20 if C["W"] < 1500 else 0))
    b("s12", 17, 0, "proc", "7.10.10.2 Registrar TECO", ["SAP PM01"])
    b("fin", 18, 0, "term_fin", "FIN", shape="term")
    d.conn("ca", C["CX"][0] + C["DEC"][0] / 2 + 60, 15, "7.10.10.2")
    d.conn("cb", C["CX"][0] + C["BW"] / 2 + 46, 17, "7.10.10.2")
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
    xl = C["LANES"][2][0] - 30
    yd = P["dec3"][5]
    d.path(f"M{P['dec3'][0]-dh},{yd} H{xl} V{P['s5'][5]} H{P['s5'][3]}", "Sí", (xl + P['dec3'][0] - dh) / 2, yd - 10, "#b03a2e")
    d.down("dec3", "s9a", "No", P["dec3"][0] + 24, P["dec3"][2] + 18, "#1e8449")
    d.down("s9a", "s9"); d.down("s9", "s10"); d.down("s10", "s11"); d.down("s11", "dec2")
    _cierre(d, dh, "dec2", "iw", "alert", "s12")
    d.down("s12", "fin")
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
      extra="No → guardar “Normal” y pasar a la decisión de más puntos.")
    D(7, "7.10.5", "Clasificar por Δ dB y por sonido: Normal (<+8) | Alerta (+8) | Alarma (+12) | Crítico (+16). Distinguir lubricación, falla de pista/elemento rodante, chumacera y daño mecánico.",
      note="NOTA: la calidad del sonido es la herramienta PRIMARIA; el dB solo no clasifica la falla (Anexo 9.9)")
    D(8, "7.10.6", "FFT → Record (≥30 s) → Confirmar WAV. Foto del punto y de la placa. Temperatura IR, RPM, corriente y carga del motor para correlación.")
    D(9, "7.10.7", "Solo si el programa de lubricación lo autoriza: engrasar en dosis pequeñas vigilando dB; detener al volver cerca de la línea base. NO sobrelubricar.",
      extra="Si el dB no baja o aparecen clics/crepitar: no es falta de grasa → Alarma/Crítico.")
    D(10, "", "Decisión: ¿quedan puntos de la ruta por medir? Sí → regresar a 7.10.4 con el siguiente punto.",
      extra="No → 7.10.8.1 Verificar registros guardados.")
    D(11, "7.10.8.1", "Verificar los registros guardados al concluir todos los puntos de la ruta.")
    D(12, "7.10.8", "HOME → Remove SD, limpiar STM y levantar el área. Informar de inmediato hallazgos Alarma o Crítico (7.10.8.3).")
    D(13, "7.10.9", "Descargar datos. Tendencia dB vs línea base. Time Waveform (impactos, factor de cresta) y FFT (BPFO, BPFI, BSF, FTF y múltiplos de 1× RPM). Correlacionar con vibración, IR, MCSA y aceite.",
      note="NOTA: comparar LA vs LOA y contra equipos idénticos")
    D(14, "7.10.10.1", "Emitir el reporte de inspección conforme al Anexo 9.8.")
    D(15, "", "Decisión: ¿nivel Alarma (+12 dB) o Crítico (+16 dB)? Sí → 7.10.10.2 Abrir aviso IW21; No → 7.10.10.2 Registrar TECO.",
      crit="Crítico: notificar a operación y evaluar paro")
    D(16, "7.10.10.2", "Abrir aviso IW21 (Alarma = prioridad 2; Crítico = prioridad 1). El Cabo notifica a operación y se evalúa paro o intervención.")
    D(17, "7.10.10.2", "Registrar en SAP PM01 → TECO. Actualizar la línea base si hubo cambio de rodamiento o intervención.")
    return d


E_TITLE = "PROCEDIMIENTO DE ULTRASONIDO PASIVO — EQUIPO ELÉCTRICO (UP15000 + SCM)"
D_TITLE = "PROCEDIMIENTO DE ULTRASONIDO DE CONTACTO — EQUIPO DINÁMICO (UP15000 + STM)"
E_SUB = "Diagrama de flujo 8.1 · Actividades 7.1 a 7.9 · PEO-006 · Refinería Olmeca · SICM"
D_SUB = "Diagrama de flujo 8.2 · Actividad 7.10 · Rodamientos, chumaceras y daño mecánico en motores · PEO-006"

# Hojas para el documento: (fila inicial, fila final, conectores de hoja siguientes, conectores de hoja previos)
HOJAS_E = [(0, 5, [(650, 2)], []), (5, 13, [(387, 3)], [(650, 1)]), (13, 20, [], [(387, 2)])]
HOJAS_D = [(0, 5, [(650, 2)], []), (5, 12, [(387, 3)], [(650, 1)]), (12, 19, [], [(387, 2)])]


def _hojas(d, prefijo, titulo, sub, hojas):
    n = len(hojas)
    return [d.assemble(f"doc/{prefijo}_hoja{i}.svg", titulo, f"{sub} (hoja {i} de {n})", r0, r1,
                       legend=(i == n), cont_next=nxt, cont_prev=prv)
            for i, (r0, r1, nxt, prv) in enumerate(hojas, 1)]


if __name__ == "__main__":
    os.makedirs("doc", exist_ok=True)
    electrico("full").assemble("diagrama_up15000.svg", E_TITLE, E_SUB)
    dinamico("full").assemble("diagrama_up15000_dinamico.svg", D_TITLE, D_SUB)
    sizes = {"8_1": _hojas(electrico("doc"), "diagrama_8_1", E_TITLE, E_SUB, HOJAS_E),
             "8_2": _hojas(dinamico("doc"), "diagrama_8_2", D_TITLE, D_SUB, HOJAS_D)}
    print("SVG OK", sizes)
