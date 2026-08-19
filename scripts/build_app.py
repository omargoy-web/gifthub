#!/usr/bin/env python3
"""Ensambla app/sicm-ele.html inyectando los datasets en app/sicm-ele.template.html."""
import json
from pathlib import Path
ROOT = Path("/home/user/gifthub")
tpl = (ROOT / "app/sicm-ele.template.html").read_text(encoding="utf-8")
limites = (ROOT / "data/normalized/limites.json").read_text(encoding="utf-8")
actividades = (ROOT / "data/normalized/actividades.json").read_text(encoding="utf-8")
equipos = (ROOT / "data/normalized/equipos.min.json").read_text(encoding="utf-8")

out = tpl.replace("__LIMITES__", limites).replace("__ACTIVIDADES__", actividades).replace("__EQUIPOS__", equipos)
target = ROOT / "app/sicm-ele.html"
target.write_text(out, encoding="utf-8")
print(f"Escrito {target}: {target.stat().st_size:,} bytes")
