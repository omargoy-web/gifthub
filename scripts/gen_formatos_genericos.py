#!/usr/bin/env python3
"""Agrega a data/relevadores/formatos.json los formatos genéricos A-GEN / B-GEN para relevadores del censo sin anexo propio en el PEO-003
(SEL, Basler, ABB REA, etc.). Se arman con los conceptos comunes a los anexos 9.1–9.8; quedan marcados «validar» hasta contar con el manual del fabricante."""
import json, os, re
p = os.path.join(os.path.dirname(__file__), '..', 'data', 'relevadores', 'formatos.json')
d = json.load(open(p, encoding='utf-8'))
d['formatos'] = [f for f in d['formatos'] if not f['id'].endswith('-GEN')]
byid = {f['id']: f for f in d['formatos']}
def item(n, sec, txt, crit, critico=False): return {'n': n, 'sec': sec, 'txt': txt, 'crit': crit, 'critico': critico, 'validar': True}
a = byid['A-ABB']
vis = [i for i in a['items'] if i['sec'] == 'A']
A = [dict(i, validar=False) for i in vis]
n = len(A)
hmi = [('LED de servicio / Ready / Healthy fijo; sin LED de disparo ni alarma enclavados', 'Servicio fijo', True), ('Mensajes / targets activos en pantalla', 'Sin mensajes activos', True), ('Autodiagnóstico / estado del equipo (self-check, IRF)', 'Sin falla interna', True),
       ('Información del equipo: modelo, serie y firmware', 'Coincide con hoja de ajustes', False), ('Entradas binarias (52a/52b, resorte, carro) y salidas', 'Coincide con campo', False), ('Mediciones: corrientes, tensiones, frecuencia', 'Ver 7.5.2', False),
       ('Últimos 30 eventos / registros de falta', 'Sin eventos inexplicables', False), ('Fecha, hora y fuente de sincronía', 'Desviación < 1 s (< 1 ms GOOSE)', False), ('Comunicaciones: estado de enlaces y contadores', 'Sin pérdidas ni avisos', False),
       ('Sin operar teclas de control, reset, borrado ni menú de pruebas', 'Cumplido', False)]
for t, c, k in hmi:
    n += 1; A.append(item(n, 'B', t, c, k))
for i in [i for i in a['items'] if i['sec'] == 'C']:
    n += 1; A.append(dict(i, n=n, validar=False))
b = byid['B-SIE']
B = []; n = 0
bi = [('Software del fabricante instalado y cable de comunicación disponible (versión registrada)', 'Instalado', False), ('Conexión en modo de solo lectura (puerto frontal o red IEC 61850); IP / puerto registrados', 'Conexión establecida', False),
      ('Información del equipo: modelo, serie, firmware y versión de configuración', 'Coincide con hoja de ajustes', False), ('Estado de autodiagnóstico / errores internos', 'Sin errores', True), ('Registro de eventos: descarga y revisión (últimos 30)', 'Sin eventos inexplicables', False),
      ('Registro de faltas: descarga', 'Coherente', False), ('Oscilografías: guardado COMTRADE (.cfg + .dat)', 'Pareja de archivos', False), ('Configuración del equipo: archivo guardado', 'Archivo en servidor SICM', False),
      ('Fecha / hora / sincronía', 'Desviación < 1 s (< 1 ms GOOSE)', False), ('Comunicaciones: contadores, IEC 61850, GOOSE', 'Sin pérdidas', False), ('NO se escribieron ajustes ni se ejecutaron órdenes de control', 'Cumplido', False),
      ('Nomenclatura TAG_MARCA_MODELO_AAAAMMDD y respaldo en servidor', 'Archivos respaldados', False)]
for t, c, k in bi:
    n += 1; B.append(item(n, 'A', t, c, k))
for t, c in [('Laptop desconectada; relevador en servicio sin alarmas nuevas', 'IN SERVICE / READY / HEALTHY'), ('Hallazgos registrados y aviso SAP IW21 generado', 'Registrado')]:
    n += 1; B.append(item(n, 'B', t, c))
gen_a = {'id': 'A-GEN', 'anexo': '9.1–9.4 (genérico)', 'tipo': 'A', 'marca': 'GEN', 'titulo': 'INSPECCIÓN TIPO A (MANUAL, NAVEGANDO EN EL HMI DEL RELEVADOR) · FORMATO GENÉRICO', 'modelos': 'Relevadores del censo sin anexo propio en el PEO-003 (SEL, Basler, ABB REA, otros). Armado con los conceptos comunes de los anexos 9.1–9.4; validar rutas de menú con el manual del fabricante.', 'secs': {'A': 'Inspección visual', 'B': 'Navegación por el HMI', 'C': 'Alimentación, mediciones, TCS, entorno y cierre'}, 'items': A}
gen_b = {'id': 'B-GEN', 'anexo': '9.5–9.8 (genérico)', 'tipo': 'B', 'marca': 'GEN', 'titulo': 'INSPECCIÓN TIPO B (POR SOFTWARE, CONEXIÓN DIRECTA O POR RED IEC 61850) · FORMATO GENÉRICO', 'modelos': 'Relevadores del censo sin anexo propio en el PEO-003. Armado con los conceptos comunes de los anexos 9.5–9.8.', 'secs': {'A': 'Conexión, lectura y descargas', 'B': 'Cierre'}, 'items': B}
d['formatos'] += [gen_a, gen_b]
json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print({f['id']: len(f['items']) for f in d['formatos']})
