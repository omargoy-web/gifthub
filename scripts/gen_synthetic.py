#!/usr/bin/env python3
"""
Fase 3 · Generador de mediciones sintéticas (DEMO).

Produce data/normalized/mediciones_sinteticas.json con 6 puntos históricos por equipo
crítico (top 50 por score). Cada serie tiene tendencia realista de degradación ±ruido.

MARCADO EXPLÍCITAMENTE COMO SINTÉTICO — sirve solo para poblar las gráficas y
demostrar los cálculos de la Fase 3. NO usar para decisiones operativas.
"""
from __future__ import annotations
import json, math, random
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path("/home/user/gifthub")
random.seed(42)  # reproducible

ranking = json.loads((ROOT / "data/normalized/ranking_criticidad.json").read_text())
equipos = json.loads((ROOT / "data/normalized/equipos_nameplate.min.json").read_text())
eq_idx = {e["tag"]: e for e in equipos}

# Perfiles de degradación por familia — pendiente esperada por parámetro
PROFILES = {
    "motor": {
        "temp_max_c": {"base": 85, "slope_per_day": 0.08, "noise": 3},
        "delta_t_c":  {"base": 4,  "slope_per_day": 0.03, "noise": 1},
        "IP":         {"base": 3.2, "slope_per_day":-0.008, "noise": 0.15},
        "R_aislamiento_MOhm": {"base": 1500, "slope_per_day":-3, "noise": 80},
        "THD_V_pct":  {"base": 3.8, "slope_per_day": 0.01, "noise": 0.4},
        "THD_I_pct":  {"base": 8.5, "slope_per_day": 0.02, "noise": 1.2},
        "vibracion_rms_mms": {"base": 3.2, "slope_per_day": 0.012, "noise": 0.4},
    },
    "transformador": {
        "temp_max_c": {"base": 68, "slope_per_day": 0.05, "noise": 2.5},
        "delta_t_c":  {"base": 2,  "slope_per_day": 0.02, "noise": 0.8},
        "IP":         {"base": 3.5, "slope_per_day":-0.005, "noise": 0.12},
        "R_aislamiento_MOhm": {"base": 3000, "slope_per_day":-4, "noise": 100},
    },
    "transformador_seco": {
        "temp_max_c": {"base": 95, "slope_per_day": 0.07, "noise": 3},
        "delta_t_c":  {"base": 3,  "slope_per_day": 0.025, "noise": 1},
    },
    "tablero": {
        "temp_max_c": {"base": 42, "slope_per_day": 0.06, "noise": 2},
        "delta_t_c":  {"base": 3.5, "slope_per_day": 0.04, "noise": 1.2},
        "THD_V_pct":  {"base": 4.2, "slope_per_day": 0.015, "noise": 0.5},
    },
    "interruptor": {
        "temp_max_c": {"base": 45, "slope_per_day": 0.05, "noise": 2},
        "delta_t_c":  {"base": 3, "slope_per_day": 0.03, "noise": 1},
    },
    "ccm": {
        "temp_max_c": {"base": 40, "slope_per_day": 0.04, "noise": 1.8},
        "delta_t_c":  {"base": 2.8, "slope_per_day": 0.03, "noise": 1},
        "THD_V_pct":  {"base": 3.9, "slope_per_day": 0.02, "noise": 0.5},
        "THD_I_pct":  {"base": 10.2, "slope_per_day": 0.03, "noise": 1.5},
    },
    "arrancador": {
        "temp_max_c": {"base": 38, "slope_per_day": 0.04, "noise": 1.5},
        "delta_t_c":  {"base": 2.5, "slope_per_day": 0.02, "noise": 0.8},
    },
    "subestacion": {
        "temp_max_c": {"base": 42, "slope_per_day": 0.03, "noise": 1.5},
        "delta_t_c":  {"base": 3.2, "slope_per_day": 0.04, "noise": 1.2},
    },
}

def actividad_para_familia(fam):
    m = {
        "motor": "MMR-VIB",
        "transformador": "IEA-TRA",
        "transformador_seco": "IEA-TRS",
        "tablero": "IEA-TAB",
        "interruptor": "IEA-INT",
        "arrancador": "IEA-ARR",
        "ccm": "MMR-CCM",
        "subestacion": "IEA-SUB",
    }
    return m.get(fam, "IEA-SUB")

def gen_serie(base, slope, noise, n_pts=6):
    """Genera puntos: t=0 base, avanza slope/día, con ruido gaussiano."""
    # espaciado 30 días entre lecturas
    return [round(base + slope*30*i + random.gauss(0, noise), 3) for i in range(n_pts)]

# Elegimos top 60 por criticidad + 40 aleatorios adicionales
random.shuffle(equipos)
extra_random = [e for e in equipos if e["familia"] in PROFILES][:40]
top_tags = [r["tag"] for r in ranking[:60]]
extra_tags = [e["tag"] for e in extra_random if e["tag"] not in top_tags][:40]

selected_tags = top_tags + extra_tags

mediciones = []
now = datetime(2026, 8, 1, 8, 0)
mid = 1

for tag in selected_tags:
    eq = eq_idx.get(tag)
    if not eq: continue
    fam = eq["familia"]
    profile = PROFILES.get(fam)
    if not profile: continue

    # Introducir "malos actores": 15% de equipos con degradación acelerada
    is_bad = random.random() < 0.15

    # generamos series por parámetro
    series_by_param = {}
    for p, cfg in profile.items():
        slope = cfg["slope_per_day"] * (2.5 if is_bad else 1.0)
        base = cfg["base"] + random.gauss(0, cfg["noise"])
        series_by_param[p] = gen_serie(base, slope, cfg["noise"])

    # Corrientes por fase con desbalance ligero (más marcado en malos actores)
    I_nom = eq.get("I") or 100
    load = 0.55 if not is_bad else 0.70
    for i in range(6):
        fecha = (now - timedelta(days=(6-i)*30)).isoformat(timespec="minutes")
        unbal_i = (random.random()*0.06) if not is_bad else (random.random()*0.15)
        I_avg = I_nom * load * (1 + random.gauss(0, 0.03))
        I_F1 = round(I_avg * (1 - unbal_i/2), 2)
        I_F2 = round(I_avg, 2)
        I_F3 = round(I_avg * (1 + unbal_i/2), 2)
        V_nom = eq.get("V") or 480
        unbal_v = (random.random()*0.01) if not is_bad else (random.random()*0.025)
        V12 = round(V_nom, 1)
        V23 = round(V_nom * (1 - unbal_v/2), 1)
        V31 = round(V_nom * (1 + unbal_v/2), 1)
        m = {
            "id_medicion": f"SYN-{mid:06d}",
            "tag": tag,
            "id_actividad": actividad_para_familia(fam),
            "fecha_iso": fecha,
            "operario": "SINTÉTICO",
            "I_F1": I_F1, "I_F2": I_F2, "I_F3": I_F3,
            "V_L1L2": V12, "V_L2L3": V23, "V_L3L1": V31,
            "observaciones": f"[DEMO SINTÉTICO — degradación {'acelerada' if is_bad else 'normal'}]",
            "_sintetico": True,
        }
        for p, series in series_by_param.items():
            m[p] = series[i]
        mediciones.append(m)
        mid += 1

out = {
    "schema": "sicm-ele/v1",
    "sintetico": True,
    "generado": datetime.utcnow().isoformat() + "Z",
    "seed": 42,
    "descripcion": "Mediciones sintéticas para poblar tendencias/vida remanente. NO USAR PARA DECISIONES OPERATIVAS.",
    "equipos_incluidos": len(selected_tags),
    "puntos_por_equipo": 6,
    "espaciado_dias": 30,
    "mediciones": mediciones
}
(ROOT / "data/normalized/mediciones_sinteticas.json").write_text(
    json.dumps(out, ensure_ascii=False, separators=(",",":")), encoding="utf-8")

sz = (ROOT / "data/normalized/mediciones_sinteticas.json").stat().st_size
print(f"Generado: {len(mediciones)} mediciones sintéticas para {len(selected_tags)} equipos ({sz:,} bytes)")
print(f"Bad actors (~15%): tendencia degradación acelerada")
