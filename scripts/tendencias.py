#!/usr/bin/env python3
"""
Fase 3 · Motor de tendencias y tasas de degradación.

Para cada equipo con ≥3 mediciones en un parámetro:
 - Regresión lineal simple: pendiente, intercepto, R², N.
 - Aplica ventana operativa (data/normalized/ventanas_operativas.json).
 - Estima días al umbral amarillo/rojo por extrapolación.
 - Marca condición (Normal/Alerta/Alarma) para el último valor.

Salidas:
 - data/normalized/tendencias.json    (series y regresiones por equipo/parámetro)
 - data/normalized/tasa_degradacion.csv (tasas ordenadas)
 - data/normalized/pareto_hallazgos.json (conteo de modos)
"""
from __future__ import annotations
import json, csv, math
from datetime import datetime
from collections import defaultdict, Counter
from pathlib import Path

ROOT = Path("/home/user/gifthub")

meds_wrap = json.loads((ROOT / "data/normalized/mediciones_sinteticas.json").read_text())
mediciones = meds_wrap["mediciones"]
equipos = {e["tag"]: e for e in json.loads((ROOT / "data/normalized/equipos_nameplate.min.json").read_text())}
ventanas = json.loads((ROOT / "data/normalized/ventanas_operativas.json").read_text())["bandas"]

# Index ventanas: (familia, parametro) -> primera banda coincidente
V_IDX = {}
for b in ventanas:
    key = (b["familia"], b["parametro"])
    if key not in V_IDX: V_IDX[key] = b

def ventana_para(familia, parametro):
    """Busca ventana; primero familia exacta, luego 'universal'."""
    # Mapeo de parámetros de medición → nombre en ventanas
    param_map = {
        "temp_max_c": "temp_devanado_C",
        "delta_t_c": "delta_t_termografico_C",
        "vibracion_rms_mms": "vibracion_rms_mms",
        "IP": "IP",
        "R_aislamiento_MOhm": "R_aislamiento_MOhm",
        "THD_V_pct": "THD_V_pct",
        "THD_I_pct": "THD_I_pct",
        "desbalance_i_pct": "desbalance_i_pct",
        "desbalance_v_pct": "desbalance_v_pct",
    }
    vp = param_map.get(parametro, parametro)
    for k in [(familia, vp), (familia, parametro), ("universal", vp)]:
        if k in V_IDX: return V_IDX[k]
    # motor: probar grupo default GP2 rigida para vibración
    if parametro == "vibracion_rms_mms":
        for b in ventanas:
            if b["familia"]=="motor" and b["parametro"]=="vibracion_rms_mms" and b.get("grupo")=="GP2_base_rigida":
                return b
    return None

def linreg(xs, ys):
    n = len(xs)
    if n < 2: return None
    mx = sum(xs)/n; my = sum(ys)/n
    num = sum((xs[i]-mx)*(ys[i]-my) for i in range(n))
    den = sum((xs[i]-mx)**2 for i in range(n))
    if den == 0: return None
    slope = num/den; intercept = my - slope*mx
    sst = sum((y-my)**2 for y in ys)
    ssr = sum((ys[i] - (slope*xs[i]+intercept))**2 for i in range(n))
    r2 = 1 - ssr/sst if sst > 0 else 1.0
    return {"slope": slope, "intercept": intercept, "r2": r2, "n": n,
            "mean": my, "std": math.sqrt(sum((y-my)**2 for y in ys)/n)}

def nema_unbalance(vals):
    vals = [v for v in vals if v is not None and v > 0]
    if len(vals) < 3: return None
    avg = sum(vals)/len(vals)
    return max(abs(v-avg) for v in vals)/avg * 100

# Agrupar mediciones por (tag, parametro)
series = defaultdict(list)
PARAMS_NUM = ["temp_max_c","delta_t_c","IP","R_aislamiento_MOhm","THD_V_pct","THD_I_pct",
              "vibracion_rms_mms","vibracion_pico_mms"]
PARAMS_DERIVED = ["desbalance_i_pct","desbalance_v_pct","corriente_avg"]

for m in mediciones:
    tag = m["tag"]
    fecha_day = datetime.fromisoformat(m["fecha_iso"]).timestamp() / 86400
    # Params directos
    for p in PARAMS_NUM:
        if m.get(p) is not None:
            series[(tag, p)].append((fecha_day, float(m[p])))
    # Derivados
    d_i = nema_unbalance([m.get("I_F1"), m.get("I_F2"), m.get("I_F3")])
    d_v = nema_unbalance([m.get("V_L1L2"), m.get("V_L2L3"), m.get("V_L3L1")])
    if d_i is not None: series[(tag,"desbalance_i_pct")].append((fecha_day, d_i))
    if d_v is not None: series[(tag,"desbalance_v_pct")].append((fecha_day, d_v))

# Calcular regresión y estado por serie
tendencias = []
hallazgos_counter = Counter()

for (tag, param), pts in series.items():
    if len(pts) < 3: continue
    eq = equipos.get(tag)
    if not eq: continue
    familia = eq["familia"]
    pts.sort(key=lambda x: x[0])
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    rg = linreg(xs, ys)
    if not rg: continue

    band = ventana_para(familia, param)
    ultimo = ys[-1]
    estado = "sin_ventana"
    dias_alerta = None
    dias_alarma = None
    if band:
        sentido = band.get("sentido", "above")  # above = mayor es peor
        vmax = band.get("verde_max"); amax = band.get("amarillo_max"); rmin = band.get("rojo_min")
        if sentido == "above":
            if ultimo >= rmin: estado = "alarma"
            elif ultimo > amax: estado = "alerta"
            elif ultimo <= vmax: estado = "normal"
            else: estado = "normal"
            # Días al umbral
            if rg["slope"] > 0:
                if ultimo < amax:
                    dias_alerta = round((amax - ultimo) / rg["slope"])
                if ultimo < rmin:
                    dias_alarma = round((rmin - ultimo) / rg["slope"])
        else:  # below = menor es peor (IP, R aislamiento, rigidez, tensión interfacial)
            if ultimo <= rmin: estado = "alarma"
            elif ultimo <= amax: estado = "alerta"
            else: estado = "normal"
            if rg["slope"] < 0:
                if ultimo > amax:
                    dias_alerta = round((ultimo - amax) / abs(rg["slope"]))
                if ultimo > rmin:
                    dias_alarma = round((ultimo - rmin) / abs(rg["slope"]))

    if estado in ("alerta","alarma"):
        hallazgos_counter[f"{familia}::{param}::{estado}"] += 1

    tendencias.append({
        "tag": tag, "familia": familia, "sector": eq.get("sector"),
        "parametro": param, "unidad": band.get("unidad") if band else None,
        "n_puntos": rg["n"],
        "valor_actual": round(ultimo, 3),
        "media": round(rg["mean"], 3),
        "pendiente_por_dia": round(rg["slope"], 5),
        "r2": round(rg["r2"], 3),
        "estado": estado,
        "banda_verde_max": band.get("verde_max") if band else None,
        "banda_amarillo_max": band.get("amarillo_max") if band else None,
        "banda_rojo_min": band.get("rojo_min") if band else None,
        "norma": band.get("norma") if band else None,
        "dias_a_alerta": dias_alerta,
        "dias_a_alarma": dias_alarma,
        "serie": [{"t": round(x-xs[0],1), "y": round(y,3)} for x,y in zip(xs,ys)],
    })

# Sort por urgencia: días a alarma ascendente
def urgency_key(t):
    d = t.get("dias_a_alarma")
    if t["estado"] == "alarma": return -1
    if d is None: return 999999
    return d
tendencias.sort(key=urgency_key)

(ROOT / "data/normalized/tendencias.json").write_text(
    json.dumps(tendencias, ensure_ascii=False, indent=1), encoding="utf-8")

# CSV tasa de degradación
with (ROOT / "data/normalized/tasa_degradacion.csv").open("w", newline="") as f:
    keys = ["tag","familia","sector","parametro","unidad","valor_actual","pendiente_por_dia",
            "r2","n_puntos","estado","dias_a_alerta","dias_a_alarma","norma"]
    w = csv.DictWriter(f, fieldnames=keys); w.writeheader()
    for t in tendencias: w.writerow({k: t.get(k) for k in keys})

# Pareto de hallazgos (agrupado por parámetro)
pareto_param = Counter()
pareto_modos = Counter()
for k, v in hallazgos_counter.items():
    fam, par, est = k.split("::")
    pareto_param[par] += v
    pareto_modos[f"{fam} {par} → {est}"] += v

pareto = {
    "por_parametro": sorted([{"parametro":p,"n":n} for p,n in pareto_param.items()], key=lambda x:-x["n"]),
    "por_modo": sorted([{"modo":k,"n":n} for k,n in pareto_modos.items()], key=lambda x:-x["n"])[:20]
}
(ROOT / "data/normalized/pareto_hallazgos.json").write_text(
    json.dumps(pareto, ensure_ascii=False, indent=1), encoding="utf-8")

print(f"Tendencias calculadas: {len(tendencias)} series (equipo×parámetro)")
print(f"Con hallazgo (alerta/alarma): {sum(1 for t in tendencias if t['estado'] in ('alerta','alarma'))}")
print(f"Top-5 por urgencia:")
for t in tendencias[:5]:
    d = t.get("dias_a_alarma")
    print(f"  {t['tag']:<18} {t['parametro']:<20} valor={t['valor_actual']}  slope={t['pendiente_por_dia']:.4f}  R²={t['r2']}  estado={t['estado']}  días_a_alarma={d}")
