#!/usr/bin/env python3
"""Reduce equipos.json a un manifiesto mínimo (tag, familia, sector, planta, denom, criticidad, sap)."""
import json
from pathlib import Path
ROOT = Path("/home/user/gifthub")
src = json.loads((ROOT / "data/normalized/equipos.json").read_text())
slim = []
for r in src:
    slim.append({
        "tag": r["tag"],
        "familia": r["familia"],
        "sector": r.get("sector"),
        "planta": r.get("planta"),
        "denom": r.get("denominacion"),
        "crit": r.get("criticidad_abc"),
        "sap": r.get("sap_equipo"),
    })
(ROOT / "data/normalized/equipos.min.json").write_text(json.dumps(slim, ensure_ascii=False, separators=(",",":")), encoding="utf-8")
size = (ROOT / "data/normalized/equipos.min.json").stat().st_size
print(f"Escrito equipos.min.json: {size:,} bytes ({len(slim)} registros)")
