#!/usr/bin/env python3
"""Genera el dataset semilla del dashboard térmico (sicm-termico/v1).

Anclaje REAL: la última lectura de cada activo es la captura de los PDF de
termografía de Drive (folios ROLM-SCM-SICM-...). El histórico previo es
SIMULADO (origen="simulado") para demostrar tendencias, derivadas y Weibull.
"""
import json, math, random, datetime as dt, os, sys
random.seed(20261009)
MX = dt.timezone(dt.timedelta(hours=-6))
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'termico')
DRIVE = 'https://drive.google.com/file/d/%s/view?usp=drivesdk'

def iso(d): return d.astimezone(MX).strftime('%Y-%m-%dT%H:%M:%S-06:00')
def mxdt(y, mo, d, h, mi): return dt.datetime(y, mo, d, h, mi, tzinfo=MX)

TH_TRAFO = dict(diseno=100, alarma=120, disparo=130, ref='NMX-J-351-ANCE-2016: operación 100 °C; 13.8/4.16 kV alarma 120 / disparo 130 °C')
TH_NUCLEO = dict(diseno=140, alarma=155, disparo=165, ref='NMX-J-351-ANCE-2016: núcleo 165 °C (disparo); 140/155 °C criterio institucional editable')
TH_TAB = dict(diseno=70, alarma=85, disparo=105, ref='ANSI C37.20: conexiones 70 °C (Δ30 K); 105 °C con materiales especiales (Δ65 K); alarma 85 °C criterio institucional editable')

def make(tag, tipo, planta, sector, ubic, sap, meta, thr, thr_pp, groups, t_end, amb_end, load_end,
         folio, fid, insp_real, drift=None, spike=None, nota=None, gps=None, pob=None, extra=None):
    """groups: lista de (punto, valor_real)"""
    N, STEP = 121, 6
    drift = drift or {}
    ts = [t_end - dt.timedelta(hours=STEP * (N - 1 - i)) for i in range(N)]
    # ambiente y carga simulados con ciclo diario + AR(1)
    amb, load, a_n, l_n = [], [], 0.0, 0.0
    for t in ts:
        h = t.hour + t.minute / 60
        a_n = 0.8 * a_n + random.gauss(0, 0.5); l_n = 0.85 * l_n + random.gauss(0, 0.03)
        amb.append(amb_end + 3.2 * math.cos(2 * math.pi * (h - 15) / 24) + a_n)
        wk = 0.05 * math.sin(2 * math.pi * t.timetuple().tm_yday / 7)
        load.append(load_end * (1 + 0.10 * math.cos(2 * math.pi * (h - 14) / 24) + l_n + wk))
    da, dl = amb_end - amb[-1], load_end / max(load[-1], 1e-6)
    amb = [round(a + da, 1) for a in amb]
    load = [round(min(105, max(3, l * dl)), 1) for l in load]
    f = lambda L: (L / 100) ** 1.6
    regs = []
    for punto, treal in groups:
        kl = min(120, max(3, 0.6 * (treal - amb_end) / max(f(load_end), 0.05)))
        for i, t in enumerate(ts):
            last = i == N - 1
            days = (N - 1 - i) * STEP / 24
            v = treal + 0.55 * (amb[i] - amb_end) + kl * (f(load[i]) - f(load_end))
            v -= drift.get(punto, 0) * days
            if spike and not last and spike[0] <= i < spike[0] + 2 and punto.startswith(spike[1]):
                v += spike[2] * (1.0 if i == spike[0] else 0.45)
            v += 0 if last else random.gauss(0, 0.3)
            r = dict(ts=iso(t), punto=punto, temp_c=treal if last else round(v, 1),
                     t_amb_c=amb_end if last else amb[i], carga_pct=round(load_end, 1) if last else load[i],
                     origen='real' if last else 'simulado')
            regs.append(r)
    insp = [insp_real]
    for k, (days, tipo_i, sev, txt) in enumerate(extra or []):
        insp.append(dict(id=f'{tag}-SIM-{k+1}'.replace(' ', '_'), fecha=iso(t_end - dt.timedelta(days=days)),
                         inspector='Registro de ejemplo', tipo=tipo_i, hallazgos=txt, severidad=sev, origen='simulado'))
    a = dict(tag=tag, tipo=tipo, planta=planta, sector=sector, ubicacion=ubic, sap=sap, gps=gps,
             estado_operativo='En servicio', metadatos=meta, umbrales=thr, poblacion=pob or tipo,
             nota_calidad_dato=nota, registros=regs, inspecciones=insp)
    if thr_pp: a['umbrales_por_punto'] = thr_pp
    return a

def real_insp(tag, folio, fid, t, insp, hall, sev=0, extra=None):
    d = dict(id=folio + '#' + tag.replace(' ', '_'), folio=folio, fecha=iso(t), inspector='Omar González Berroeta (ficha 494821)',
             tipo='Termografía', hallazgos=hall, severidad=sev, origen='real', fuente_url=DRIVE % fid)
    d.update(insp or {})
    return d

SE12 = 'SE-12 · U-DE DESTILACIÓN COMBINADA (UDC2) TREN 2'
NOTA_TR = ('Fuente: PDF de termografía (NMX-J-351-ANCE). La extracción de texto no conserva la columna: se interpretó '
           'el valor único de la fila "Devanado lado alta" como NÚCLEO (criterio 165 °C). Verificar contra la hoja original. '
           'Fecha de puesta en marcha estimada (no consta en SAP). Histórico previo simulado.')
tr1 = make('TR-12-01', 'Transformador', 'U-DE DESTILACIÓN COMBINADA (UDC2) TREN 2', 1, SE12 + ' · Transformador seco', '20939850',
    dict(potencia='17.25 MVA', potencia_kva=17250, tension_kv='13.8 / 4.16', clase_termica='H', fabricante='Sin dato en SAP',
         puesta_en_marcha='2009-06-01', puesta_en_marcha_origen='estimada', corriente_nominal_a=2394.1, impedancia_pct=None),
    TH_TRAFO, {'Núcleo': TH_NUCLEO},
    [('Devanado BT X1', 84), ('Devanado BT X2', 89), ('Devanado BT X3', 82), ('Núcleo', 134)],
    mxdt(2026, 8, 31, 12, 41), 33, 484 / 2394.1 * 100, 'ROLM-SCM-SICM-S01-ELE-TRAN-ELE4-0007-310826', '1FoBdj37SmeJMZ3kc47Fz3VWOQpBgReD2',
    real_insp('TR-12-01', 'ROLM-SCM-SICM-S01-ELE-TRAN-ELE4-0007-310826', '1FoBdj37SmeJMZ3kc47Fz3VWOQpBgReD2', mxdt(2026, 8, 31, 12, 41), {},
              'Sin hallazgos reportados en el recorrido (10 transformadores, veredicto Satisfactoria). Equipo de prueba Fotric, Tamb 33 °C.'),
    nota=NOTA_TR, gps=[18.41714, -93.18722], extra=[
        (150, 'Termografía', 0, 'Ejemplo simulado: sin anomalías térmicas.'),
        (300, 'Resistencia de aislamiento', 0, 'Ejemplo simulado: IP/DAR dentro de criterio IEEE 43 (valores demo).')])
tr2 = make('TR-12-02', 'Transformador', 'U-DE DESTILACIÓN COMBINADA (UDC2) TREN 2', 1, SE12 + ' · Transformador seco', '20939855',
    dict(potencia='17.25 MVA', potencia_kva=17250, tension_kv='13.8 / 4.16', clase_termica='H', fabricante='Sin dato en SAP',
         puesta_en_marcha='2009-06-01', puesta_en_marcha_origen='estimada', corriente_nominal_a=2394.1),
    TH_TRAFO, {'Núcleo': TH_NUCLEO},
    [('Devanado BT X1', 69), ('Devanado BT X2', 76), ('Devanado BT X3', 70), ('Núcleo', 147)],
    mxdt(2026, 8, 31, 12, 42), 33, 682 / 2394.1 * 100, 'ROLM-SCM-SICM-S01-ELE-TRAN-ELE4-0007-310826', '1FoBdj37SmeJMZ3kc47Fz3VWOQpBgReD2',
    real_insp('TR-12-02', 'ROLM-SCM-SICM-S01-ELE-TRAN-ELE4-0007-310826', '1FoBdj37SmeJMZ3kc47Fz3VWOQpBgReD2', mxdt(2026, 8, 31, 12, 42), {},
              'Sin hallazgos reportados en el recorrido (veredicto Satisfactoria). Núcleo 147 °C con carga ≈28 %.'),
    drift={'Núcleo': 0.12}, nota=NOTA_TR, gps=[18.41714, -93.18722], extra=[
        (150, 'Termografía', 0, 'Ejemplo simulado: núcleo ligeramente por debajo del valor actual.'),
        (300, 'Ultrasonido pasivo', 0, 'Ejemplo simulado: sin descargas parciales audibles.')])
tb1 = make('IP-121-01A', 'Tablero', 'U-DE DESTILACIÓN COMBINADA (UDC1) TREN 1', 1, 'S.E. UDC1 TREN 1 · Interruptor 13.8 kV IP-121-01A', None,
    dict(potencia='—', tension_kv='13.8', clase_termica='n/a (conexiones)', fabricante='Sin dato (relevador ABB REF615)',
         puesta_en_marcha='2008-11-01', puesta_en_marcha_origen='estimada', corriente_nominal_a=1200, corriente_nominal_origen='supuesta'),
    TH_TAB, None,
    [('Conexiones lado línea F1', 26.0), ('Conexiones lado línea F2', 24.9), ('Conexiones lado línea F3', 24.7),
     ('Conexiones lado carga F1', 31.2), ('Conexiones lado carga F2', 32.2), ('Conexiones lado carga F3', 35.1)],
    mxdt(2026, 7, 27, 11, 0), 25, 127.3 / 1200 * 100, 'ROLM-SCM-SICM-S01-ELE-TBL-ELE4-0003-270726', '1Xk_YpfGK6lCna4TJKnrxDzECePXqHCNk',
    real_insp('IP-121-01A', 'ROLM-SCM-SICM-S01-ELE-TBL-ELE4-0003-270726', '1Xk_YpfGK6lCna4TJKnrxDzECePXqHCNk', mxdt(2026, 7, 27, 11, 0), {},
              'Alarma "ALTA TEMP BARRAS" en relevador REF615: revisar y ajustar umbral de temperatura en REM (lecturas de temperatura normales, sin deltas). V=13.44 kV, I=127/127/128 A.'),
    nota='Corriente nominal supuesta (1200 A) para calcular % de carga; confirmar con placa. Histórico previo simulado.',
    gps=[18.41566, -93.18691], extra=[(120, 'Termografía', 0, 'Ejemplo simulado: sin anomalías.'), (240, 'Ultrasonido pasivo', 0, 'Ejemplo simulado: sin tracking ni corona.')])
tb2 = make('CCM-121-02 BUS A', 'Tablero', 'U-DE DESTILACIÓN COMBINADA (UDC1) TREN 1', 1, 'S.E. UDC1 TREN 1 · CCM-121-02 Bus A', None,
    dict(potencia='—', tension_kv='0.48', clase_termica='n/a (conexiones)', fabricante='Sin dato',
         puesta_en_marcha='2011-03-01', puesta_en_marcha_origen='estimada', corriente_nominal_a=1600, corriente_nominal_origen='supuesta'),
    TH_TAB, None,
    [('Conexiones lado línea F1', 38.2), ('Conexiones lado línea F2', 38.5), ('Conexiones lado línea F3', 38.2),
     ('Conexiones lado carga F1', 35.5), ('Conexiones lado carga F2', 36.0), ('Conexiones lado carga F3', 35.6)],
    mxdt(2026, 7, 27, 10, 32), 25, 526.3 / 1600 * 100, 'ROLM-SCM-SICM-S01-ELE-TBL-ELE4-0003-270726', '1Xk_YpfGK6lCna4TJKnrxDzECePXqHCNk',
    real_insp('CCM-121-02 BUS A', 'ROLM-SCM-SICM-S01-ELE-TBL-ELE4-0003-270726', '1Xk_YpfGK6lCna4TJKnrxDzECePXqHCNk', mxdt(2026, 7, 27, 10, 32), {},
              'Sin hallazgos (10 interruptores satisfactorios). V=468/466/460 V, I=525/531/523 A.'),
    spike=(84, 'Conexiones lado carga', 9.0), nota='Corriente nominal supuesta (1600 A). Incluye un transitorio térmico SIMULADO (≈día 21) para demostrar la derivada dT/dt.',
    gps=[18.41566, -93.18691], extra=[(120, 'Termografía', 0, 'Ejemplo simulado: sin anomalías.')])

def motor(tag, hp, fla, sap, planta, gps, ts_, i_real, pts, drift=None, start='2012-01-01', n_sec=''):
    folio = 'ROLM-SCM-SICM-S06-ELE-TMO-ELE4-0030-081026'
    grp = []
    for g, vals in pts:
        for ph, v in zip(('F1', 'F2', 'F3'), vals): grp.append((f'{g} {ph}', v))
    return make(tag, 'Motor', planta, 6, f'CCM · circuito {tag} (arrancador EATON)', sap,
        dict(potencia=f'{hp} HP ({round(hp*0.7457,1)} kW)', potencia_kw=round(hp * 0.7457, 1), tension_kv='0.48', clase_termica='F (supuesta)',
             fabricante='EATON (arrancador)', puesta_en_marcha=start, puesta_en_marcha_origen='estimada',
             corriente_nominal_a=fla, corriente_nominal_origen='NEC 430.250 (supuesta)', nema=n_sec),
        TH_TAB, None, grp, ts_, 27, i_real / fla * 100, folio, '1SYghV0wQq_LGkWSmI9iLe46QQ9cLQXVf',
        real_insp(tag, folio, '1SYghV0wQq_LGkWSmI9iLe46QQ9cLQXVf', ts_, {},
                  f'Sin hallazgos reportados (9 arrancadores, veredicto Satisfactoria). I={i_real} A por fase, Tamb 27 °C, ε=0.95, cámara Fotric 348 A.'),
        drift=drift, nota='Termografía de circuito de motor/arrancador (POE-009 Anexo 2). Sin sensores de chumacera en la fuente. FLA supuesta por tabla NEC. Histórico previo simulado.',
        gps=gps, extra=[(90, 'Termografía', 0, 'Ejemplo simulado: sin anomalías.'), (210, 'Resistencia de aislamiento', 0, 'Ejemplo simulado: IP dentro de criterio IEEE 43 (valores demo).')])

m1 = motor('GAM-81004 A', 60, 77, '20984244', 'U-RECUPERADORA DE AZUFRE (PRA1) TREN 1', [18.42102, -93.19884], mxdt(2026, 10, 8, 10, 48), 39.4,
    [('Interruptor — entrada', (41, 43, 45)), ('Interruptor — salida', (42.1, 48.5, 45.0)), ('Arrancador — entrada', (43, 43, 40)), ('Arrancador — salida', (37, 36, 36))],
    drift={'Interruptor — salida F2': 0.07}, start='2012-05-01', n_sec='4')
m2 = motor('GAM-82003 A', 75, 96, '20984251', 'U-RECUPERADORA DE AZUFRE (PRA2) TREN 2', [18.42101, -93.19915], mxdt(2026, 10, 8, 10, 50), 78.2,
    [('Interruptor — entrada', (41, 42, 42)), ('Interruptor — salida', (44, 45, 45)), ('Arrancador — entrada', (41, 42, 41)), ('Arrancador — salida', (34, 33, 33))],
    start='2014-02-01', n_sec='4')

def poblacion(tipo, beta, eta, n, desc):
    datos = []
    for _ in range(n):
        life = eta * (-math.log(1 - random.random())) ** (1 / beta)
        cens = random.uniform(0.25, 1.15) * eta
        datos.append(dict(horas=round(min(life, cens)), evento='falla' if life <= cens else 'suspension'))
    datos.sort(key=lambda d: d['horas'])
    return dict(id=tipo, tipo=tipo, descripcion=desc, origen='simulado', datos=datos)

pobs = [poblacion('Transformador', 3.4, 215000, 48, 'Flota de transformadores secos clase H (aislamiento): falla = pérdida de función por envejecimiento térmico'),
        poblacion('Tablero', 1.7, 260000, 48, 'Flota de tableros MT/BT: falla = falla de aislamiento / conexión por calentamiento'),
        poblacion('Motor', 2.3, 140000, 48, 'Flota de motores/arrancadores: falla = devanado o contacto fuera de servicio')]

def write(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
    print(name, os.path.getsize(os.path.join(OUT, name)) // 1024, 'KB')

hdr = lambda: dict(schema='sicm-termico/v1', generado=iso(mxdt(2026, 10, 9, 9, 0)),
                   fuente='PDF de termografía SICM (Drive: json de temperatura 08102026). Última lectura de cada activo = REAL; histórico previo = SIMULADO.')
write('demo_simulado_transformadores.json', dict(hdr(), activos=[tr1, tr2], poblaciones=[pobs[0]]))
write('demo_simulado_tableros.json', dict(hdr(), activos=[tb1, tb2], poblaciones=[pobs[1]]))
write('demo_simulado_motores.json', dict(hdr(), activos=[m1, m2], poblaciones=[pobs[2]]))
write('demo_simulado_completo.json', dict(hdr(), activos=[tr1, tr2, tb1, tb2, m1, m2], poblaciones=pobs))
