#!/usr/bin/env python3
"""Genera apie/data/seed.js: datos semilla para la PWA APIE a partir de data/normalized.

Se emite como JS (window.APIE_SEED = {...}) y no como JSON para que la app funcione
también abierta desde file:// (fetch de JSON local está bloqueado por CORS en ese caso).

Activos: censo nameplate completo (10,930) en formato columnar para reducir peso.
Historial: solo mediciones REALES ingestadas (las sintéticas no se mezclan con campo).
Base de conocimientos: los formatos/ventanas de Drive ya inventariados + SOP derivados
del catálogo de actividades + lecciones aprendidas desde la matriz FMEA.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NORM = ROOT / "data/normalized"
OUT = ROOT / "apie/data/seed.js"


def load(name):
    return json.loads((NORM / name).read_text(encoding="utf-8"))


# ── Activos (columnar) ──────────────────────────────────────────────────────
COLS = ["tag", "familia", "sector", "planta", "denom", "sap", "crit_abc", "V", "I", "HP", "kVA", "rpm", "clase", "NT"]
equipos = load("equipos_nameplate.min.json")
plantas = sorted({e["planta"] or "" for e in equipos})
pidx = {p: i for i, p in enumerate(plantas)}
rows = []
for e in equipos:
    r = []
    for c in COLS:
        v = e.get(c)
        if c == "planta":
            v = pidx[v or ""]
        elif c == "sap" and v is not None:
            v = str(v)
        elif isinstance(v, float) and v.is_integer():
            v = int(v)
        r.append(v)
    rows.append(r)

# ── Historial real (mediciones ingestadas) ──────────────────────────────────
PARAM_KEYS = ("I_F1", "I_F2", "I_F3", "V_L1L2", "V_L2L3", "V_L3L1", "T_max", "dT", "vib", "IP", "THD")
ing = load("mediciones_ingestadas.json")["mediciones"]
historial = {}
for m in ing:
    if not m.get("_censo_match"):
        continue
    lect = {k: v for k, v in m.items()
            if v is not None and not k.startswith("_") and isinstance(v, (int, float)) and k not in ("sector",)}
    historial.setdefault(m["tag"], []).append({
        "fecha": m["fecha_iso"],
        "act": m["id_actividad"],
        "folio": m.get("folio"),
        "ing": (m.get("ingeniero") or "").split(" · ")[0],
        "estado": (m.get("_diag") or {}).get("estado", "sin_dx"),
        "hallazgos": [h.get("modo_falla") or h.get("id") for h in (m.get("_diag") or {}).get("hallazgos", [])],
        "lect": lect,
        "obs": m.get("observaciones") or "",
    })
for v in historial.values():
    v.sort(key=lambda x: x["fecha"], reverse=True)

# ── Base de conocimientos ───────────────────────────────────────────────────
docs = []
seen = set()
for folder, cat_default in (("xlsx", "Formato / Ventana operativa"), ("text", "Formato / Ventana operativa")):
    for p in sorted((ROOT / "data/raw" / folder).iterdir()):
        drive_id, _, name = p.stem.partition("__")
        if drive_id in seen:
            continue
        seen.add(drive_id)
        titulo = re.sub(r"_+", " ", name).strip()
        cat = "Criterio de aceptación" if re.search(r"VALORES|RANGOS|AJUSTE", name) else (
            "Formato de prueba" if "FORMATO" in name else cat_default)
        docs.append({
            "id": f"DRV-{drive_id[:8]}",
            "drive_id": drive_id,
            "titulo": titulo,
            "categoria": cat,
            "tags": [t.lower() for t in titulo.split() if len(t) > 3][:6],
            "fuente": "Google Drive · SICM",
        })

for a in load("actividades.json"):
    docs.append({
        "id": f"SOP-{a['id']}",
        "titulo": f"SOP {a['id']} · {a['nombre']}",
        "categoria": "SOP",
        "norma": a["norma"],
        "periodicidad": a["periodicidad"],
        "tecnica": a["tecnica"],
        "familias": a.get("familia_objetivo", []),
        "tags": [a["id"].lower()] + [f for f in a.get("familia_objetivo", [])],
        "fuente": "Catálogo SICM-ELE",
    })

fmea = load("fmea.json")
modos = fmea["modos"] if isinstance(fmea, dict) and "modos" in fmea else fmea
for f in sorted(modos, key=lambda x: -x.get("RPN", 0))[:10]:
    docs.append({
        "id": f"LA-{f['id']}",
        "titulo": f"Lección {f['id']} · {f.get('modo_falla', f.get('modo', ''))}",
        "categoria": "Lección aprendida",
        "familias": [f.get("familia")] if f.get("familia") else [],
        "rpn": f.get("RPN"),
        "causa": f.get("causa"),
        "efecto": f.get("efecto"),
        "controles": f.get("control_prevencion"),
        "deteccion": f.get("deteccion"),
        "norma": f.get("norma_base"),
        "tags": [f.get("familia", ""), "fmea", "rpn"],
        "fuente": "Matriz FMEA SICM-ELE",
    })

seed = {
    "generado": __import__("datetime").date.today().isoformat(),
    "activos": {"cols": COLS, "plantas": plantas, "rows": rows},
    "historial": historial,
    "kpi_sector": load("kpis_por_sector.json"),
    "kpi_familia": load("kpis_por_familia.json"),
    "ranking": [{k: r[k] for k in ("rank", "tag", "familia", "sector", "nivel_tension", "denom")} for r in load("ranking_criticidad.json")[:20]],
    "actividades": load("actividades.json"),
    "docs": docs,
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text("window.APIE_SEED=" + json.dumps(seed, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
print(f"{OUT.relative_to(ROOT)}: {OUT.stat().st_size/1024:.0f} KB · {len(rows)} activos · "
      f"{sum(len(v) for v in historial.values())} mediciones reales en {len(historial)} tags · {len(docs)} documentos")
