#!/usr/bin/env python3
"""
Fase 2 · Consolidación de KPIs.

Genera:
 - data/normalized/kpis_por_sector.json (+ .csv)
 - data/normalized/kpis_por_familia.json (+ .csv)
 - data/normalized/ranking_criticidad.json (+ .csv) top 100 activos de alta criticidad
 - data/normalized/matriz_sector_familia.json (rollup para heatmap)

Nota: sin MEDICIONES la condición operativa se marca como "sin_dato". Los
KPIs son de censo/nameplate + estructura y sirven de línea base para Fase 3.
"""
from __future__ import annotations
import json, csv
from pathlib import Path
from collections import defaultdict

ROOT = Path("/home/user/gifthub")
OUT = ROOT / "data/normalized"

equipos = json.loads((OUT / "equipos_nameplate.min.json").read_text())

# Cap sanity: cualquier transformador con >250,000 kVA (250 MVA) es outlier de calidad SAP.
KVA_CAP = 250_000
outliers = [e for e in equipos if e.get("kVA") and float(e["kVA"]) > KVA_CAP]

# ---------- Agregados por sector ---------------
by_sector = defaultdict(lambda: {
    "n_total":0, "n_alta":0, "n_media":0, "n_baja":0,
    "n_BT":0, "n_MT":0, "n_AT":0,
    "HP_instalado":0, "kVA_instalada":0,
    "por_familia": defaultdict(int),
})

for e in equipos:
    s = str(e.get("sector") or "—")
    r = by_sector[s]
    r["n_total"] += 1
    crit = (e.get("crit") or "").lower()
    if crit == "alta": r["n_alta"] += 1
    elif crit == "media": r["n_media"] += 1
    elif crit == "baja": r["n_baja"] += 1
    NT = (e.get("NT") or "")
    if NT == "BT": r["n_BT"] += 1
    elif NT == "MT": r["n_MT"] += 1
    elif NT == "AT": r["n_AT"] += 1
    if e.get("HP"): r["HP_instalado"] += float(e["HP"])
    kva = float(e["kVA"]) if e.get("kVA") else 0
    if kva and kva <= KVA_CAP:
        r["kVA_instalada"] += kva
    r["por_familia"][e["familia"]] += 1

sectors_out = []
for s, r in sorted(by_sector.items(), key=lambda x: str(x[0])):
    sectors_out.append({
        "sector": s,
        "n_total": r["n_total"],
        "n_alta_criticidad": r["n_alta"],
        "n_media_criticidad": r["n_media"],
        "n_baja_criticidad": r["n_baja"],
        "n_BT": r["n_BT"], "n_MT": r["n_MT"], "n_AT": r["n_AT"],
        "HP_instalado": round(r["HP_instalado"],1),
        "MVA_instalada": round(r["kVA_instalada"]/1000, 2),
        "familias": dict(r["por_familia"]),
    })
(OUT / "kpis_por_sector.json").write_text(json.dumps(sectors_out, ensure_ascii=False, indent=1), encoding="utf-8")

# CSV plano (sin la col familias que es dict)
with (OUT / "kpis_por_sector.csv").open("w", newline="") as f:
    keys = ["sector","n_total","n_alta_criticidad","n_media_criticidad","n_baja_criticidad","n_BT","n_MT","n_AT","HP_instalado","MVA_instalada"]
    w = csv.DictWriter(f, fieldnames=keys)
    w.writeheader()
    for r in sectors_out: w.writerow({k:r.get(k) for k in keys})

# ---------- Agregados por familia --------------
by_family = defaultdict(lambda: {
    "n_total":0, "n_alta":0, "n_media":0, "n_baja":0,
    "n_BT":0, "n_MT":0, "n_AT":0,
    "HP_total":0, "kVA_total":0,
})
for e in equipos:
    f = e["familia"]; r = by_family[f]
    r["n_total"] += 1
    crit = (e.get("crit") or "").lower()
    if crit == "alta": r["n_alta"] += 1
    elif crit == "media": r["n_media"] += 1
    elif crit == "baja": r["n_baja"] += 1
    NT = e.get("NT") or ""
    if NT == "BT": r["n_BT"] += 1
    elif NT == "MT": r["n_MT"] += 1
    elif NT == "AT": r["n_AT"] += 1
    if e.get("HP"): r["HP_total"] += float(e["HP"])
    kva = float(e["kVA"]) if e.get("kVA") else 0
    if kva and kva <= KVA_CAP: r["kVA_total"] += kva

families_out = []
for f, r in sorted(by_family.items()):
    families_out.append({
        "familia": f,
        "n_total": r["n_total"],
        "n_alta": r["n_alta"], "n_media": r["n_media"], "n_baja": r["n_baja"],
        "n_BT": r["n_BT"], "n_MT": r["n_MT"], "n_AT": r["n_AT"],
        "HP_total": round(r["HP_total"],1),
        "MVA_total": round(r["kVA_total"]/1000, 2),
    })
(OUT / "kpis_por_familia.json").write_text(json.dumps(families_out, ensure_ascii=False, indent=1), encoding="utf-8")

with (OUT / "kpis_por_familia.csv").open("w", newline="") as f:
    keys = list(families_out[0].keys())
    w = csv.DictWriter(f, fieldnames=keys); w.writeheader()
    for r in families_out: w.writerow(r)

# ---------- Ranking por criticidad (top 100) ----------
# Score = criticidad (A=3, B=2, C=1, resto=1.5) × nivel_tension (AT=3, MT=2, BT=1) × log(HP or kVA)
import math
def score(e):
    crit = (e.get("crit_abc") or "").upper()
    s_c = {"A":3, "B":2, "C":1}.get(crit, 1.5)
    NT = e.get("NT") or ""
    s_v = {"AT":3, "MT":2, "BT":1}.get(NT, 1)
    kva = float(e.get("kVA") or 0)
    if kva > KVA_CAP: kva = KVA_CAP  # cap outliers
    pot = kva or float(e.get("HP") or 0)*0.746
    s_p = math.log10(max(pot,1)+1)
    return s_c * s_v * (1 + s_p)

ranking = sorted(equipos, key=score, reverse=True)[:100]
ranking_out = [{
    "rank": i+1, "score": round(score(e),2),
    "tag": e["tag"], "familia": e["familia"], "sector": e["sector"],
    "criticidad_abc": e.get("crit_abc"), "nivel_tension": e.get("NT"),
    "HP": e.get("HP"), "kVA": e.get("kVA"), "V": e.get("V"), "I": e.get("I"),
    "denom": e.get("denom"), "planta": e.get("planta"),
} for i, e in enumerate(ranking)]
(OUT / "ranking_criticidad.json").write_text(json.dumps(ranking_out, ensure_ascii=False, indent=1), encoding="utf-8")
with (OUT / "ranking_criticidad.csv").open("w", newline="") as f:
    keys = list(ranking_out[0].keys())
    w = csv.DictWriter(f, fieldnames=keys); w.writeheader()
    for r in ranking_out: w.writerow(r)

# ---------- Matriz sector × familia ----------
sec_fam = defaultdict(lambda: defaultdict(int))
sec_set, fam_set = set(), set()
for e in equipos:
    s = str(e.get("sector") or "—"); f = e["familia"]
    sec_fam[s][f] += 1
    sec_set.add(s); fam_set.add(f)
matriz = {
    "sectores": sorted(sec_set, key=lambda x: str(x)),
    "familias": sorted(fam_set),
    "counts": {s: {f: sec_fam[s].get(f, 0) for f in sorted(fam_set)} for s in sorted(sec_set, key=lambda x: str(x))}
}
(OUT / "matriz_sector_familia.json").write_text(json.dumps(matriz, ensure_ascii=False, indent=1), encoding="utf-8")

# ---------- Reporte de KPIs base ----------
lines = ["# KPIs consolidados — FASE 2", "",
    "## Totales por sector", "",
    "| Sector | Total | Alta crit. | MT | AT | MVA instalada | HP instalado |",
    "|---|---:|---:|---:|---:|---:|---:|"]
for r in sectors_out:
    lines.append(f"| {r['sector']} | {r['n_total']:,} | {r['n_alta_criticidad']:,} | {r['n_MT']:,} | {r['n_AT']:,} | {r['MVA_instalada']:,.2f} | {r['HP_instalado']:,.1f} |")

lines += ["", "## Totales por familia", "",
    "| Familia | Total | Alta crit. | BT | MT | AT | MVA total | HP total |",
    "|---|---:|---:|---:|---:|---:|---:|---:|"]
for r in families_out:
    lines.append(f"| {r['familia']} | {r['n_total']:,} | {r['n_alta']:,} | {r['n_BT']:,} | {r['n_MT']:,} | {r['n_AT']:,} | {r['MVA_total']:,.2f} | {r['HP_total']:,.1f} |")

# Total refinería
total_MVA = sum(r["MVA_instalada"] for r in sectors_out)
total_HP = sum(r["HP_instalado"] for r in sectors_out)
total_alta = sum(r["n_alta_criticidad"] for r in sectors_out)
lines += ["", "## Total refinería", "",
    f"- **{sum(r['n_total'] for r in sectors_out):,} equipos** censados",
    f"- **{total_alta:,}** con criticidad A (alta)",
    f"- **{total_MVA:,.2f} MVA** transformación instalada (excluye {len(outliers)} transformadores con dato SAP fuera de rango físico >250 MVA)",
    f"- **{total_HP:,.1f} HP** ({total_HP*0.746/1000:,.1f} MW) potencia motriz instalada",
    "",
    "## Calidad de datos SAP — transformadores con `capacidad` fuera de rango",
    "",
    f"{len(outliers)} transformadores tienen `capacidad` > 250 MVA en el nameplate SAP. Los valores calculados por corriente/tensión secundaria son consistentes con transformadores de refinería (12–200 MVA), lo que sugiere errores en la unidad o el número de ceros al cargar SAP. Estos equipos SÍ aparecen en el censo pero se excluyen del total MVA para no distorsionar el indicador.",
    "",
    "| TAG | kVA reportado SAP | Sector | Denominación |",
    "|---|---:|:-:|---|"
]
for o in outliers[:20]:
    lines.append(f"| `{o['tag']}` | {float(o['kVA']):,.0f} | {o['sector']} | {(o.get('denom') or '')[:60]} |")

lines += ["", "## Top 20 activos por score de criticidad", "",
    "| # | Score | TAG | Familia | Sector | Criticidad ABC | NT | Potencia | Denom |",
    "|---:|---:|---|---|---:|:-:|:-:|---:|---|"]
for r in ranking_out[:20]:
    pot = f"{r['kVA']:.0f} kVA" if r["kVA"] else (f"{r['HP']:.0f} HP" if r["HP"] else "—")
    lines.append(f"| {r['rank']} | {r['score']} | `{r['tag']}` | {r['familia']} | {r['sector']} | {r['criticidad_abc'] or '—'} | {r['nivel_tension'] or '?'} | {pot} | {(r['denom'] or '')[:40]} |")

lines += ["", "## Distribución de condición operativa", "",
    "Fase 2 aplica ventanas y clasifica en Normal/Alerta/Alarma **por medición**. Al no haber `MEDICIONES` ingestadas todavía, todos los equipos muestran condición **sin_dato**. El motor de KPIs de la PWA (`kpi_engine.js`) evalúa cada medición nueva contra los 32 límites codificados y actualiza el semáforo en vivo.", "",
    "## Metodología del score de criticidad", "",
    "Score = `criticidad_ABC` × `nivel_tension` × `log10(potencia + 1)`, donde:",
    "- criticidad_ABC: A=3, B=2, C=1, sin dato=1.5",
    "- nivel_tension: AT=3, MT=2, BT=1",
    "- potencia: kVA (transformadores) o HP×0.746 (motores/arrancadores)", "",
    "El score ordena los equipos de mayor impacto potencial ante falla. Es una heurística — para RCM formal se debe cruzar con historial de fallas y consecuencia operativa.",
]
(ROOT / "reports/fase2_kpis.md").write_text("\n".join(lines), encoding="utf-8")
print("✓ kpis_por_sector.json, .csv")
print("✓ kpis_por_familia.json, .csv")
print("✓ ranking_criticidad.json, .csv (top 100)")
print("✓ matriz_sector_familia.json")
print("✓ reports/fase2_kpis.md")
