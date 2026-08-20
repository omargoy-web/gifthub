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
reglas = load("data/normalized/reglas_diagnostico.json")
fmea = load("data/normalized/fmea.json")
acciones = load("data/normalized/acciones_rcm.json")
# Extract just the mediciones array from synthetic dataset for embed
import json as _j
syn_wrap = _j.loads(load("data/normalized/mediciones_sinteticas.json"))
syn_meds = _j.dumps(syn_wrap["mediciones"], ensure_ascii=False, separators=(",",":"))

# Mediciones REALES ingestadas por scripts/parse_recorridos.py — horneadas en el HTML
ingest_path = ROOT / "data/normalized/mediciones_ingestadas.json"
if ingest_path.exists():
    ingest_wrap = _j.loads(ingest_path.read_text(encoding="utf-8"))
    ingest_meds = _j.dumps(ingest_wrap.get("mediciones", []), ensure_ascii=False, separators=(",",":"))
    ingest_meta = _j.dumps({"total": ingest_wrap.get("total",0),
                            "en_censo": ingest_wrap.get("en_censo",0),
                            "archivos_procesados": ingest_wrap.get("archivos_procesados",[]),
                            "por_tipo": ingest_wrap.get("por_tipo",{}),
                            "ingestados_at": ingest_wrap.get("ingestados_at","")},
                           ensure_ascii=False, separators=(",",":"))
    print(f"  ▸ horneando {ingest_wrap.get('total',0)} mediciones reales ingestadas ({len(ingest_wrap.get('archivos_procesados',[]))} archivos)")
else:
    ingest_meds = "[]"
    ingest_meta = '{"total":0,"en_censo":0,"archivos_procesados":[],"por_tipo":{}}'

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
 .replace("__REGLAS__", reglas)
 .replace("__FMEA__", fmea)
 .replace("__ACCIONES__", acciones)
 .replace("__INGEST_MEDS__", ingest_meds)
 .replace("__INGEST_META__", ingest_meta)
)
target = ROOT / "app/sicm-ele.html"
target.write_text(out, encoding="utf-8")
print(f"Escrito {target}: {target.stat().st_size:,} bytes")
