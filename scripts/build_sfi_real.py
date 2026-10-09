#!/usr/bin/env python3
"""Consolida los JSONL extraídos de los PDF de SFI / cargador+banco en data/sfi/seed_real_sfi.json.
Uso: build_sfi_real.py <dir con SFI_*.jsonl BAT_*.jsonl OBSG_*.jsonl>
 - Control: total_esperado (línea 'resumen') vs registros extraídos por archivo.
 - Une las 'observaciones generales' (OBSG) a cada equipo por (fuente_id, tag).
 - Elimina duplicados (mismo TAG y fecha de captura: PDFs repetidos «(1)»).
 - Agrega poblaciones SIMULADAS de falla (origen:"simulado") para la pestaña de Weibull."""
import json, glob, os, sys, random, math, collections

d = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), '..', 'data', 'sfi', 'seed_real_sfi.json')
recs, res, obs = [], [], {}
for f in sorted(glob.glob(os.path.join(d, '*.jsonl'))):
    b = os.path.basename(f)
    for l in open(f, encoding='utf-8'):
        l = l.strip()
        if not l: continue
        r = json.loads(l)
        if b.startswith('OBSG'):
            obs[(r['fuente_id'], r['tag'])] = r.get('obs_generales') or ''
        elif r.get('resumen'): res.append(r)
        elif r.get('fmt') in ('SFI', 'BAT'): recs.append(r)

# --- control de totales
by = collections.defaultdict(lambda: [0, 0, ''])
for r in recs: by[r['fuente_id']][0] += 1; by[r['fuente_id']][2] = r['archivo']
for r in res: by[r['fuente_id']][1] += r.get('total_esperado') or 0
bad = [(v[2], v[0], v[1]) for v in by.values() if v[0] != v[1]]

# --- observaciones generales + deduplicación
seen, uniq, dup = {}, [], 0
for r in recs:
    o = obs.get((r['fuente_id'], r['tag']))
    if o:
        if r['fmt'] == 'SFI': r['obs_gen'] = o
        elif not r.get('obs'): r['obs'] = o
    k = (r['tag'].upper().strip(), r.get('capturado') or r.get('fecha_doc'))
    if k in seen: dup += 1; continue
    seen[k] = 1; uniq.append(r)

# --- poblaciones simuladas (Weibull) por modo de falla; horas de operación hasta falla / suspensión
rng = random.Random(20261009)
def pop(id_, desc, beta, eta, n, frac_susp):
    datos = []
    for _ in range(n):
        t = eta * (-math.log(1 - rng.random())) ** (1 / beta)
        t = max(500, round(t, -2))
        if rng.random() < frac_susp: datos.append({'horas': round(t * rng.uniform(.5, 1.0), -2) or 500, 'evento': 'suspension'})
        else: datos.append({'horas': t, 'evento': 'falla'})
    return {'id': id_, 'descripcion': desc, 'origen': 'simulado', 'datos': datos}
pobs = [
 pop('Secado de electrolito', 'Pérdida de agua del electrolito por sobrecarga / temperatura alta (Ni-Cd y VLA)', 2.2, 95000, 30, .25),
 pop('Falla de cargador / ventiladores', 'Falla del rectificador-cargador o de su enfriamiento (tasa de falla casi constante a creciente)', 1.4, 80000, 30, .3),
 pop('Sulfatación / corrosión de bornes', 'Degradación de conexiones, puentes y bornes (ambiente salino costero)', 2.8, 60000, 30, .2),
 pop('Envejecimiento del banco', 'Fin de vida por desgaste (capacidad < 80 %, IEEE 450 / 1106)', 4.0, 150000, 30, .35),
]
doc = {'schema': 'sicm-sfi/v1', 'origen': 'Recorridos PDF SICM-ME-PO-005 / Anexo 9.4-9.5 (jul–oct 2026)', 'recorridos': uniq, 'poblaciones': pobs}
os.makedirs(os.path.dirname(out), exist_ok=True)
json.dump(doc, open(out, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
c = collections.Counter(r['fmt'] for r in uniq)
print(f'registros {len(recs)} -> únicos {len(uniq)} (duplicados {dup}) · {dict(c)} · TAGs {len({r["tag"].upper() for r in uniq})}')
print('OBSG aplicadas:', sum(1 for r in uniq if r.get('obs_gen') or (r['fmt'] == 'BAT' and r.get('obs'))), '· OBSG leídas:', len(obs))
print('CONTROL de totales:', 'OK (todos los archivos cuadran)' if not bad else bad)
print('→', os.path.abspath(out), round(os.path.getsize(out) / 1024), 'KB')
