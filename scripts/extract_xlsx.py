#!/usr/bin/env python3
"""
SICM-ELE Fase 1: extracción y normalización.

Lee todos los xlsx en data/raw/xlsx/ + los .txt de data/raw/text/
y produce un dump crudo por archivo en data/normalized/raw_dump/ .

Cada dump JSON tiene la forma:
{
  "source_id": "<google drive file id>",
  "source_title": "<original title>",
  "sheets": [{"name": "...", "rows": [[cell, cell, ...], ...]}]
}
"""
from __future__ import annotations
import json, os, re, sys
from pathlib import Path
from openpyxl import load_workbook

ROOT = Path("/home/user/gifthub")
XLSX_DIR = ROOT / "data/raw/xlsx"
TXT_DIR = ROOT / "data/raw/text"
OUT_DIR = ROOT / "data/normalized/raw_dump"
OUT_DIR.mkdir(parents=True, exist_ok=True)

def _cell_val(v):
    if v is None: return None
    if isinstance(v, (int, float, bool)): return v
    s = str(v).strip()
    return s if s else None

def dump_xlsx(path: Path) -> dict:
    fid, title = path.stem.split("__", 1)
    wb = load_workbook(filename=str(path), data_only=True, read_only=True)
    sheets = []
    for ws in wb.worksheets:
        rows = []
        for row in ws.iter_rows(values_only=True):
            r = [_cell_val(c) for c in row]
            while r and r[-1] is None: r.pop()
            if r: rows.append(r)
        sheets.append({"name": ws.title, "rows": rows, "row_count": len(rows)})
    wb.close()
    return {"source_id": fid, "source_title": title, "sheets": sheets, "sheet_count": len(sheets)}

def dump_text(path: Path) -> dict:
    """The 'read_file_content' text version splits sheets by a heuristic pattern."""
    fid_title = path.stem
    fid, title = fid_title.split("__", 1)
    text = path.read_text(encoding="utf-8", errors="replace")
    # These text dumps are essentially CSV-ish flattening: sheets separated by sheet-name tokens.
    # We store them as a single "text_blob" chunk and let downstream parse as needed.
    return {"source_id": fid, "source_title": title, "sheets": [{"name": "TEXT_DUMP", "text": text[:2_000_000]}], "text_dump": True}

def main():
    summary = {"xlsx_files": [], "text_files": [], "errors": []}
    for f in sorted(XLSX_DIR.glob("*.xlsx")):
        try:
            d = dump_xlsx(f)
            out = OUT_DIR / (f.stem + ".json")
            out.write_text(json.dumps(d, ensure_ascii=False, default=str), encoding="utf-8")
            summary["xlsx_files"].append({
                "file": f.name, "id": d["source_id"], "sheets": d["sheet_count"],
                "row_totals": sum(s["row_count"] for s in d["sheets"])
            })
            print(f"OK  xlsx {f.name}: {d['sheet_count']} sheets, {sum(s['row_count'] for s in d['sheets'])} rows")
        except Exception as e:
            summary["errors"].append({"file": f.name, "error": str(e)})
            print(f"ERR xlsx {f.name}: {e}", file=sys.stderr)
    for f in sorted(TXT_DIR.glob("*.txt")):
        try:
            d = dump_text(f)
            out = OUT_DIR / (f.stem + ".json")
            out.write_text(json.dumps(d, ensure_ascii=False, default=str), encoding="utf-8")
            summary["text_files"].append({"file": f.name, "id": d["source_id"], "size": f.stat().st_size})
            print(f"OK  text {f.name}: {f.stat().st_size} bytes")
        except Exception as e:
            summary["errors"].append({"file": f.name, "error": str(e)})
            print(f"ERR text {f.name}: {e}", file=sys.stderr)
    (ROOT / "reports/fase1_extraction_summary.json").parent.mkdir(parents=True, exist_ok=True)
    (ROOT / "reports/fase1_extraction_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nSUMMARY: xlsx={len(summary['xlsx_files'])} text={len(summary['text_files'])} errors={len(summary['errors'])}")

if __name__ == "__main__":
    main()
