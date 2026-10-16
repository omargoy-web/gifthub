#!/usr/bin/env python3
"""Consolida las extracciones JSONL de los PDF de termografía (Drive) en data/termico/seed_real.json.

Uso: build_termico_real.py <dir con TBL_*.jsonl, TRAN_*.jsonl, TMO_*.jsonl>
El dashboard convierte estos 'recorridos' a activos/lecturas/inspecciones con el MISMO código que usa para
importar PDF (ingestRec en app/sicm-termico.template.html), de modo que hay una sola lógica de ingesta.
Las poblaciones Weibull se heredan de demo_simulado_completo.json y son SIMULADAS.
"""
import glob, json, os, re, sys
from collections import Counter, defaultdict
SRC = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'termico')
recs, ctrl, bad = [], [], 0
for f in sorted(glob.glob(os.path.join(SRC, '*.jsonl'))):
    for line in open(f, encoding='utf-8'):
        line = line.strip()
        if not line: continue
        try: d = json.loads(line)
        except Exception: bad += 1; continue
        (ctrl if d.get('resumen') else recs).append(d)
# --- deduplicar copias "(1)" del mismo folio: llave tag|capturado|folio
seen, uniq, dups = set(), [], 0
for r in recs:
    k = (re.sub(r'\s+', ' ', str(r.get('tag')).strip().upper()), r.get('capturado') or r.get('fecha_doc'), r.get('fmt'))
    if k in seen: dups += 1; continue
    seen.add(k); uniq.append(r)
# --- control de calidad
def vals(r):
    f = r['fmt']
    if f == 'TBL': return (r.get('linea') or []) + (r.get('carga') or [])
    if f == 'TMO': return sum([(r.get(k) or []) for k in ('int_ent', 'int_sal', 'arr_ent', 'arr_sal')], [])
    return (r.get('bt_vals') or []) + (r.get('alta_vals') or [])
out_rng = Counter(); n_vals = 0
for r in uniq:
    for v in vals(r):
        if v is None: continue
        n_vals += 1
        if v < 8 or v > (300 if r['fmt'] == 'TRAN' else 250): out_rng[r['fmt']] += 1
fmts = Counter(r['fmt'] for r in uniq)
tags = {f: len({re.sub(r'\s+', ' ', r['tag'].strip().upper()) for r in uniq if r['fmt'] == f}) for f in fmts}
vis = Counter(); per = defaultdict(set)
for r in uniq: per[(r['fmt'], re.sub(r'\s+', ' ', r['tag'].strip().upper()))].add(r.get('capturado') or r.get('fecha_doc'))
for v in per.values(): vis[len(v)] += 1
fechas = sorted(r['capturado'][:10] for r in uniq if r.get('capturado'))
mism = [c for c in ctrl if c.get('error') or c.get('total_esperado') != c.get('extraidos')]
print('líneas inválidas:', bad, '| registros:', len(recs), '| únicos:', len(uniq), '| copias duplicadas descartadas:', dups)
print('por formato:', dict(fmts), '| activos distintos:', tags, '| total', sum(tags.values()))
print('archivos con control:', len(ctrl), '| con error/descuadre:', len(mism))
for c in mism[:20]: print('  ', c.get('archivo'), c.get('error') or (c.get('total_esperado'), c.get('extraidos')))
print('valores de temperatura:', n_vals, '| fuera de rango plausible (<8 ó >250/300 °C):', dict(out_rng))
print('visitas por activo (nº de fechas -> activos):', dict(sorted(vis.items())))
print('rango de fechas de captura:', fechas[0] if fechas else None, '→', fechas[-1] if fechas else None)
pobs = json.load(open(os.path.join(OUT, 'demo_simulado_completo.json'), encoding='utf-8'))['poblaciones']
seed = dict(schema='sicm-termico/v1', fuente='PDF de termografía SICM (Drive: json de temperatura 08102026). Recorridos REALES; poblaciones Weibull SIMULADAS.', recorridos=uniq, poblaciones=pobs)
p = os.path.join(OUT, 'seed_real.json'); json.dump(seed, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('seed_real.json', os.path.getsize(p) // 1024, 'KB')
