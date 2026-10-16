#!/usr/bin/env python3
"""Genera data/ultrasonido/censo_sap.json (equipos candidatos a inspección ultrasónica) desde data/normalized/equipos.json:
motores (rodamientos) y equipo eléctrico (tableros, CCM, transformadores, subestaciones)."""
import json, os, re
root = os.path.join(os.path.dirname(__file__), '..')
src = json.load(open(os.path.join(root, 'data', 'normalized', 'equipos.json'), encoding='utf-8'))
g = lambda x, k: str(x.get(k) or '').strip()
num = lambda s: (lambda m: float(m.group(0).replace(',', '')) if m else None)(re.search(r'[\d,]+(?:\.\d+)?', s or ''))
out = []
for x in src:
    f = x['familia']
    if f == 'motor':
        out.append({'tag': x['tag'], 'kind': 'rod', 'fam': f, 'sap': g(x, 'sap_equipo'), 'sector': x.get('sector'), 'planta': g(x, 'planta'), 'ubic': g(x, 'ubicacion'),
                    'marca': g(x, 'extra_MARCA DEL MOTOR ELEC'), 'rpm': num(g(x, 'extra_VELOCIDAD ANGULAR DE')), 'hp': num(g(x, 'extra_POTENCIA DISEÑO MOTO')), 'volt': num(g(x, 'extra_VOLTAJE MOTOR ELECTR')),
                    'acc': g(x, 'extra_EQUIPO ACCIONADO'), 'denom': g(x, 'denominacion')})
    elif f in ('tablero', 'ccm', 'transformador', 'transformador_seco', 'subestacion'):
        v = num(g(x, 'extra_VOLTAJE NOMINAL DEL') or g(x, 'extra_VOLTAJE PRIMARIO TRA') or g(x, 'extra_VOLTAJE TABLERO DIST'))
        out.append({'tag': x['tag'], 'kind': 'elec', 'fam': f, 'sap': g(x, 'sap_equipo'), 'sector': x.get('sector'), 'planta': g(x, 'planta'), 'ubic': g(x, 'ubicacion'), 'volt': v, 'denom': g(x, 'denominacion')})
json.dump({'fuente': 'SAP PM · data/normalized/equipos.json', 'n': len(out), 'eq': out}, open(os.path.join(root, 'data', 'ultrasonido', 'censo_sap.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
import collections as C
print(len(out), C.Counter(o['fam'] for o in out), sum(1 for o in out if o.get('rpm')))
