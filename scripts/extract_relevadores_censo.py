#!/usr/bin/env python3
"""Genera data/relevadores/censo_sap.json a partir del censo de equipos SAP PM (data/normalized/equipos.json, familia «relevador»).
Normaliza marca, modelo, subestación y alcance (protección / medición / arco). Todo es editable en la app."""
import json, re, os, collections
root = os.path.join(os.path.dirname(__file__), '..')
src = json.load(open(os.path.join(root, 'data', 'normalized', 'equipos.json'), encoding='utf-8'))
rel = [x for x in src if x.get('familia') == 'relevador']
g = lambda x, k: (str(x.get(k) or '').strip())

def marca_of(m):
    m = m.upper()
    if m in ('GE', 'GENERAL ELECTRIC'): return 'GE'
    if m == 'ABB': return 'ABB'
    if m == 'SIEMENS': return 'SIE'
    if m.startswith('SCHNEIDER'): return 'SCH'
    if m == 'SEL': return 'SEL'
    return 'OTRA' if m else ''

def modelo_of(x, marca):
    txt = ' '.join([g(x, 'extra_MODELO_RELEVADOR'), g(x, 'extra_TIPO DE RELAVADOR'), g(x, 'extra_TIPO DE RELEVADOR'), x['tag']]).upper().replace('_', ' ')
    pats = {
        'ABB': [(r'REF ?-?615', 'REF615'), (r'REM ?-?615', 'REM615'), (r'RET ?-?615', 'RET615'), (r'RED ?-?615', 'RED615'), (r'REG ?-?615', 'REG615'), (r'REF ?-?620', 'REF620'), (r'REM ?-?620', 'REM620'), (r'REB ?-?670', 'REB670'), (r'RET ?-?670', 'RET670'), (r'REA ?-?10[135]', None), (r'PROTECCION ARCO', 'REA 101')],
        'GE': [(r'\b(850|869|845|890|350|489|750|C30|T60|F60|B90|G60|L90|D60|C60|M60|N60|SR\d+)\b', None)],
        'SIE': [(r'7SR\s?\d{2,4}\w*', None), (r'7KM ?54\w*', None), (r'ARGUS', 'Argus 7SR1x')],
        'SEL': [(r'SEL ?-?(\d{3}\w?)', None)],
        'SCH': [(r'P\s?5\w{2,3}|P14\w|P3P\w*|P143|EASERGY \w+', None)],
    }
    for rx, fixed in pats.get(marca, []):
        m = re.search(rx, txt)
        if m:
            if fixed: return fixed
            s = re.sub(r'\s+', '', m.group(0)) if marca in ('SIE', 'GE') else re.sub(r'\s+', '', m.group(0))
            if marca == 'ABB' and s.startswith('REA'): return 'REA ' + s[3:].lstrip('-')
            if marca == 'GE': return {'850': '850', '869': '869', '845': '845', '890': '890'}.get(s, s)
            if marca == 'SEL': return 'SEL-' + m.group(1)
            return s
    raw = g(x, 'extra_MODELO_RELEVADOR')
    return '' if raw in ('', 'MULTILIN', 'SEL', 'MEDICION', 'REYROLLE', 'NONE') else raw

def sub_of(u):
    p = u.split('-')
    s = p[4] if len(p) > 4 else ''
    m = re.match(r'^S_0?(\d+)$', s)
    if m: return 'SE-' + str(int(m.group(1)))
    m = re.match(r'^S(\d+)_(\d+)$', s)
    if m: return f'SE-{int(m.group(1))}.{m.group(2)}'
    return s

def tablero_of(u):
    p = u.split('-')
    return p[5] if len(p) > 5 else ''

out = []
for x in rel:
    mk = marca_of(g(x, 'extra_MARCA DEL RELEVADOR'))
    mo = modelo_of(x, mk)
    uso = g(x, 'extra_FUNCION DEL RELEVADO')
    tipo = ' '.join([g(x, 'extra_TIPO DE RELAVADOR'), g(x, 'extra_MODELO_RELEVADOR'), uso, x['tag']]).upper()
    if re.search(r'REA ?-?10[135]|ARCO', tipo): alc = 'arco'
    elif re.search(r'SENTRON|7KM|SHARK|MULTIMEDIDOR|GAUGETECH', tipo) or (uso.upper() in ('MEDICION', 'MEDICIÓN') ): alc = 'medicion'
    else: alc = 'proteccion'
    vnom = re.match(r'(\d+(?:\.\d+)?)', g(x, 'extra_VOLTAJE_NOMINAL'))
    out.append({
        'tag': x['tag'], 'sap': g(x, 'sap_equipo'), 'sector': x.get('sector'), 'planta': g(x, 'planta'), 'subestacion': sub_of(g(x, 'ubicacion')),
        'tablero': tablero_of(g(x, 'ubicacion')), 'ubic': g(x, 'ubicacion'), 'marca': mk, 'marcaTxt': g(x, 'extra_MARCA DEL RELEVADOR'), 'modelo': mo,
        'tipoSap': g(x, 'extra_TIPO DE RELAVADOR'), 'uso': uso, 'funcion': g(x, 'extra_TIPO DE OPERACION DE'), 'vcd': float(vnom.group(1)) if vnom else None,
        'puerto': g(x, 'extra_PUERTO DE COMUNICACI'), 'alcance': alc, 'denom': g(x, 'denominacion')})
json.dump({'fuente': 'SAP PM · data/normalized/equipos.json (familia relevador)', 'n': len(out), 'rel': out}, open(os.path.join(root, 'data', 'relevadores', 'censo_sap.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
c = collections.Counter
print(len(out), c(o['marca'] for o in out).most_common(), c(o['alcance'] for o in out).most_common())
print(c((o['marca'], o['modelo']) for o in out).most_common(45))
print(c(o['subestacion'] for o in out).most_common(8), sum(1 for o in out if not o['modelo']), sum(1 for o in out if o['funcion']))
