#!/usr/bin/env python3
"""Ensambla app/sicm-ele.html inyectando los datasets en app/sicm-ele.template.html."""
import json
from pathlib import Path
ROOT = Path("/home/user/gifthub")
tpl = (ROOT / "app/sicm-ele.template.html").read_text(encoding="utf-8")

def load(p): return (ROOT / p).read_text(encoding="utf-8")

# Fase 2: usamos el manifiesto enriquecido con nameplate (V, I, HP, kVA, NT)
equipos = load("data/normalized/equipos_nameplate.min.json")
limites = load("data/normalized/limites.json")
actividades = load("data/normalized/actividades.json")
kpi_sector = load("data/normalized/kpis_por_sector.json")
kpi_familia = load("data/normalized/kpis_por_familia.json")
ranking = load("data/normalized/ranking_criticidad.json")
matriz = load("data/normalized/matriz_sector_familia.json")

ventanas = load("data/normalized/ventanas_operativas.json")
tendencias = load("data/normalized/tendencias.json")
# Extract just the mediciones array from synthetic dataset for embed
import json as _j
syn_wrap = _j.loads(load("data/normalized/mediciones_sinteticas.json"))
syn_meds = _j.dumps(syn_wrap["mediciones"], ensure_ascii=False, separators=(",",":"))

out = (tpl
 .replace("__LIMITES__", limites)
 .replace("__ACTIVIDADES__", actividades)
 .replace("__EQUIPOS__", equipos)
 .replace("__KPI_SECTOR__", kpi_sector)
 .replace("__KPI_FAMILIA__", kpi_familia)
 .replace("__RANKING__", ranking)
 .replace("__MATRIZ__", matriz)
 .replace("__VENTANAS__", ventanas)
 .replace("__TENDENCIAS__", tendencias)
 .replace("__SYN_MEDS__", syn_meds)
)
target = ROOT / "app/sicm-ele.html"
target.write_text(out, encoding="utf-8")
print(f"Escrito {target}: {target.stat().st_size:,} bytes")
