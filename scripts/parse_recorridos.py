#!/usr/bin/env python3
"""
Parser Python de los JSON generados por la PWA recorridos-ebv-sicm,
equivalente 1:1 al parser del HTML (parseRecorridoJSON en sicm-ele.template.html).

Uso:
    python3 scripts/parse_recorridos.py <ruta_a_json_o_carpeta> [ruta2 ...]

Devuelve/escribe:
    data/normalized/mediciones_ingestadas.json
        {schema, ingestados_at, total, por_tipo:{...}, mediciones:[...]}

Soporta ejecución iterativa: fusiona con lo que ya haya en el archivo (por id_medicion).
"""
from __future__ import annotations
import json, re, sys, hashlib
from pathlib import Path
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "normalized"
DEST = DATA / "mediciones_ingestadas.json"

# ---------- Cargar catálogo de equipos ----------
def load_equipos():
    eq = json.loads((DATA / "equipos_nameplate.min.json").read_text(encoding="utf-8"))
    idx_exact = {e["tag"]: e for e in eq}
    idx_norm = {}
    for e in eq:
        key = re.sub(r"[\s\-_]+", "", e["tag"].upper())
        idx_norm.setdefault(key, e)
    return eq, idx_exact, idx_norm

EQUIPOS, EQ_EXACT, EQ_NORM = load_equipos()

def find_equipo(tag):
    if not tag: return None
    if tag in EQ_EXACT: return EQ_EXACT[tag]
    trim = re.sub(r"\s+", " ", str(tag).strip())
    if trim in EQ_EXACT: return EQ_EXACT[trim]
    key = re.sub(r"[\s\-_]+", "", str(tag).upper())
    return EQ_NORM.get(key)

# ---------- Helpers ----------
def _num(v):
    if v is None or v == "": return None
    if isinstance(v, (int, float)): return v
    m = re.search(r"-?\d+(?:\.\d+)?", str(v))
    if not m: return None
    try: return float(m.group(0))
    except: return None

def _parse_range(v):
    """"62-63" -> {'max':63,'min':62,'delta':1,'avg':62.5} sin tratar '-' como signo."""
    if v is None or v == "": return None
    if isinstance(v, (int, float)):
        return {"max": v, "min": v, "delta": 0, "avg": v}
    s = str(v).strip()
    nums = [x for x in re.split(r"[\-\/,;\s]+", s) if x]
    parsed = []
    for x in nums:
        try: parsed.append(float(x))
        except: pass
    if not parsed: return None
    return {"max": max(parsed), "min": min(parsed),
            "delta": max(parsed) - min(parsed), "avg": (max(parsed)+min(parsed))/2}

# ---------- Mapeo tipo → id_actividad (mismo del HTML) ----------
TIPO_MAP = [
    ("TERMOGRAFIA","IEA-TAB"), ("TERMO","IEA-TAB"), ("TBL","IEA-TAB"),
    ("IATS","IEA-INT"), ("IAT","IEA-INT"),
    ("VIBRACION","MMR-VIB"), ("VME","MMR-VIB"), ("VIB","MMR-VIB"),
    ("MCSA","MMR-MON"), ("MOT","MMR-MON"),
    ("EAS","MMR-CCM"), ("ARR","MMR-CCM"),
    ("DSL","IEA-BAT"), ("BKP","IEA-BAT"), ("CEL","IEA-BAT"),
    ("ACEITE","IEA-TRA"), ("DGA","IEA-TRA"), ("RIG","DIE-RIG"),
    ("BAT","IEA-BAT"), ("SFI","IEA-SFI"), ("REL","IEA-REL"), ("TIE","IEA-SUB"),
    ("EBV","IEA-SUB"), ("SEC","IEA-SUB"), ("MIT","IEA-SUB"),
    ("SCD","IEA-SUB"), ("ESD","IEA-SUB"),
]
FAM_MAP = {"motor":"MMR-VIB", "transformador":"IEA-TRA",
           "transformador_seco":"IEA-TRS", "transformador_aceite":"IEA-TRA",
           "interruptor":"IEA-INT", "tablero":"IEA-TAB", "arrancador":"IEA-ARR",
           "ccm":"MMR-CCM", "subestacion":"IEA-SUB", "relevador":"IEA-REL",
           "baterias":"IEA-BAT", "ups_sfi":"IEA-SFI"}
def actividad_para(tipo, tag):
    t = (tipo or "").upper()
    for k, v in TIPO_MAP:
        if k in t: return v
    eq = find_equipo(tag)
    if eq and eq.get("familia") in FAM_MAP: return FAM_MAP[eq["familia"]]
    return "IEA-SUB"

def sector_from_folio(folio):
    m = re.search(r"-S(\d{1,2})-", folio or "")
    return int(m.group(1)) if m else None

# ---------- Parser principal ----------
def parse_recorrido(raw, filename):
    """Equivalente al parseRecorridoJSON del HTML."""
    out = []
    payload = raw
    if isinstance(raw, dict):
        payload = (raw.get("mediciones") or raw.get("recorridos") or raw.get("data")
                   or raw.get("entries") or raw.get("items")
                   or (raw.get("registros") if isinstance(raw.get("registros"), list) else None)
                   or raw.get("recorrido") or raw)
    arr = payload if isinstance(payload, list) else [payload]

    for rec in arr:
        if not isinstance(rec, dict): continue
        folio = rec.get("folio") or rec.get("id") or rec.get("numero")
        creado = rec.get("creado") or rec.get("fecha") or rec.get("timestamp") or rec.get("date")
        operario = rec.get("nombreOperario") or rec.get("operario") or rec.get("realizo")
        operario_ficha = rec.get("fichaOperario") or rec.get("operarioFicha") or rec.get("ficha")
        ingeniero = rec.get("nombreSector") or rec.get("ingeniero") or rec.get("padSICM")
        ingeniero_ficha = rec.get("fichaSector")
        operativo = rec.get("nombreOperativo")
        operativo_ficha = rec.get("fichaOperativo")
        tipo = rec.get("tipo") or rec.get("formato") or rec.get("categoria")
        obs_rec = rec.get("observacionesGenerales") or rec.get("observaciones") or ""
        sector_rec = rec.get("sector") or rec.get("padSector") or sector_from_folio(folio)

        items = rec.get("valvulas") or rec.get("items") or rec.get("equipos") or rec.get("item") or rec.get("verificados")
        items_arr = items if isinstance(items, list) else ([items] if items else [rec])

        for it in items_arr:
            if not isinstance(it, dict): continue
            # Para EAS preferimos motor_tag (arrancador → motor)
            tag = it.get("motor_tag") or it.get("tag") or it.get("TAG") or it.get("equipo") or rec.get("tag")
            if not tag: continue
            tag_arrancador = it.get("tag") if (it.get("motor_tag") and it.get("tag") and it.get("motor_tag") != it.get("tag")) else None
            tag = str(tag).strip()

            sap = it.get("sap") or rec.get("sap")
            sector = it.get("sector") or sector_rec
            planta = it.get("planta") or rec.get("planta") or rec.get("area")
            cuarto = it.get("cuarto") or rec.get("cuarto")
            servicio = it.get("servicio")
            cond_oper = it.get("cond_oper")

            obs = " | ".join(x for x in [obs_rec, it.get("obs"), it.get("observaciones")] if x)
            modo = it.get("modo_falla")
            modo_otro = it.get("modo_falla_otro")
            veredicto = it.get("veredicto") or it.get("condicion")
            accion = it.get("accion")
            fotos = len(it.get("fotos") or []) if isinstance(it.get("fotos"), list) else 0

            has_lect = isinstance(it.get("lect"), list) and len(it["lect"]) > 0
            if has_lect: snapshots = it["lect"]
            elif it.get("lect"): snapshots = [it["lect"]]
            else: snapshots = [it]  # EAS/VME/TBL: valores directamente en el item

            f_base = (it.get("fecha") or rec.get("fecha")
                      or (creado[:10] if creado else ""))

            for idx, L in enumerate(snapshots):
                if not isinstance(L, dict): continue
                # Fecha ISO
                d_raw = L.get("fecha") or f_base
                h = L.get("horario") or L.get("hora") or "00:00"
                f_iso = None
                if d_raw:
                    m = re.search(r"(\d{1,2})\/(\d{1,2})\/(\d{2,4})", str(d_raw))
                    if m:
                        y = "20" + m.group(3) if len(m.group(3)) == 2 else m.group(3)
                        d_iso = f"{y}-{m.group(2).zfill(2)}-{m.group(1).zfill(2)}"
                    elif re.match(r"^\d{4}-\d{2}-\d{2}", str(d_raw)):
                        d_iso = str(d_raw)[:10]
                    else:
                        d_iso = f_base or ""
                    if d_iso:
                        f_iso = f"{d_iso}T{h.zfill(5) if len(h)>=5 else h.ljust(5,'0')}"

                # Temperaturas — pares MOT + singles VME/TBL
                t_pairs = [x for x in (_parse_range(L.get(k)) for k in ("t12","t34","t56","t78","t910")) if x]
                t_singles = []
                for k in ("rtd_rod_1","rtd_rod_2","rtd_rod_3","rtd_rod_4",
                          "rtd_dev_5","rtd_dev_6","rtd_dev_7","rtd_dev_8","rtd_dev_9","rtd_dev_10",
                          "temp_lc","temp_lv","temp_cuerpo",
                          "temp_linea_f1","temp_linea_f2","temp_linea_f3",
                          "temp_carga_f1","temp_carga_f2","temp_carga_f3"):
                    n = _num(L.get(k))
                    if n is not None: t_singles.append(n)
                all_t = [r["max"] for r in t_pairs] + [r["min"] for r in t_pairs] + t_singles
                t_max = max(all_t) if all_t else None
                t_delta = max((r["delta"] for r in t_pairs), default=None)
                if t_delta is None:
                    rod = [_num(L.get(f"rtd_rod_{i}")) for i in range(1,5)]
                    rod = [x for x in rod if x is not None]
                    dev = [_num(L.get(f"rtd_dev_{i}")) for i in range(5,11)]
                    dev = [x for x in dev if x is not None]
                    if len(rod) >= 2: t_delta = max(rod) - min(rod)
                    elif len(dev) >= 2: t_delta = max(dev) - min(dev)
                    t_lin = [_num(L.get(f"temp_linea_f{i}")) for i in (1,2,3)]
                    t_car = [_num(L.get(f"temp_carga_f{i}")) for i in (1,2,3)]
                    deltas = [abs(a-b) for a,b in zip(t_lin,t_car) if a is not None and b is not None]
                    if deltas: t_delta = max(deltas + ([t_delta] if t_delta is not None else []))

                # Corrientes
                imm = _parse_range(L.get("imax_imin"))
                I_F1 = I_F2 = I_F3 = None
                if imm:
                    I_F1, I_F3 = imm["max"], imm["min"]
                    I_F2 = _num(L.get("i_motor")) if L.get("i_motor") is not None else imm["avg"]
                elif L.get("corr_ia") is not None or L.get("amp_ia") is not None:
                    I_F1 = _num(L.get("corr_ia") if L.get("corr_ia") is not None else L.get("amp_ia"))
                    I_F2 = _num(L.get("corr_ib") if L.get("corr_ib") is not None else L.get("amp_ib"))
                    I_F3 = _num(L.get("corr_ic") if L.get("corr_ic") is not None else L.get("amp_ic"))
                elif L.get("ia") is not None:
                    I_F1 = _num(L.get("ia")); I_F2 = _num(L.get("ib"))

                # Voltajes
                Vl = _num(L.get("v_linea"))
                Vs = _num(L.get("v_salida"))
                V12 = _num(L.get("volt_ab") or L.get("volt_fases_vab") or L.get("volts_f1"))
                V23 = _num(L.get("volt_bc") or L.get("volt_fases_vbc") or L.get("volts_f2"))
                V31 = _num(L.get("volt_ca") or L.get("volt_fases_vca") or L.get("volts_f3"))

                # Vibración
                vibs = [_num(L.get(k)) for k in ("vel_ll_v","vel_ll_h","vel_ll_a","vel_lc_v","vel_lc_h","vel_lc_a")]
                vibs = [x for x in vibs if x is not None]
                vib_rms = max(vibs) if vibs else _num(L.get("vib_rms") or L.get("vibRMS") or L.get("velocidad_rms"))
                acels = [_num(L.get("acel_ll")), _num(L.get("acel_lc"))]
                acels = [x for x in acels if x is not None]
                vib_pk = max(acels) if acels else _num(L.get("vib_pico") or L.get("vibPk"))

                # Normalización final del TAG contra el censo
                eqm = find_equipo(tag)
                tag_canon = eqm["tag"] if eqm else tag
                tag_original = tag if (eqm and eqm["tag"] != tag) else None

                id_med = "IMP-" + (folio or "NF") + "-" + tag_canon.replace(" ","_") + "-" + str(idx)

                med = {
                    "id_medicion": id_med,
                    "tag": tag_canon,
                    "id_actividad": actividad_para(tipo, tag_canon),
                    "fecha_iso": (f_iso or "")[:16],
                    "operario": " · ".join(x for x in [operario, operario_ficha] if x),
                    "ingeniero": " · ".join(x for x in [ingeniero, ingeniero_ficha] if x),
                    "responsable_operativo": " · ".join(x for x in [operativo, operativo_ficha] if x),
                    "sap": str(sap) if sap else None,
                    "sector": (int(sector) if isinstance(sector, (int,float)) else
                               (int(re.search(r"\d+", str(sector)).group()) if sector and re.search(r"\d+", str(sector)) else sector)),
                    "planta": planta or "",
                    "cuarto": cuarto or "",
                    "folio": folio or "",
                    "I_F1": I_F1, "I_F2": I_F2, "I_F3": I_F3,
                    "V_L1L2": V12 if V12 is not None else Vl,
                    "V_L2L3": V23 if V23 is not None else Vl,
                    "V_L3L1": V31 if V31 is not None else Vl,
                    "V_salida_VFD": Vs,
                    "kw": _num(L.get("kw")),
                    "rpm_op": _num(L.get("rpm")),
                    "fp": _num(L.get("fp")),
                    "torque": _num(L.get("torque")),
                    "carga_reportada": L.get("carga"),
                    "p_succion": L.get("p_succion"),
                    "p_descarga": L.get("p_descarga"),
                    "temp_max_c": t_max,
                    "delta_t_c": t_delta,
                    "V_celda_A": _num(L.get("va")),
                    "V_celda_B": _num(L.get("vb")),
                    "pos_A": _num(L.get("posa")),
                    "neg_A": _num(L.get("nega")),
                    "pos_B": _num(L.get("posb")),
                    "neg_B": _num(L.get("negb")),
                    "vibracion_rms_mms": vib_rms,
                    "vibracion_pico_mms": vib_pk,
                    "veredicto": veredicto,
                    "modo_falla_reportado": modo,
                    "modo_falla_otro": modo_otro,
                    "accion_reportada": accion,
                    "observaciones": obs,
                    "_origen": {
                        "archivo": filename, "folio": folio, "tipo": tipo,
                        "creado": creado, "operario": operario, "ingeniero": ingeniero,
                        "snapshot_index": idx, "snapshot_total": len(snapshots),
                        "cuarto": cuarto, "servicio": servicio, "cond_oper": cond_oper,
                        "fotos": fotos, "tag_arrancador": tag_arrancador, "tag_original": tag_original,
                    },
                    "_censo_match": bool(eqm),
                }
                out.append(med)
    return out


def collect_files(paths):
    files = []
    for p in paths:
        pp = Path(p)
        if pp.is_dir():
            files.extend(sorted(pp.glob("*.json")))
        elif pp.is_file() and pp.suffix.lower() == ".json":
            files.append(pp)
    return files


def main(args):
    if not args:
        print("Uso: parse_recorridos.py <json_o_carpeta> [más...]")
        sys.exit(1)

    files = collect_files(args)
    if not files:
        print("No se encontraron .json en las rutas dadas.")
        sys.exit(1)

    # Cargar existente para fusión por id_medicion
    prev = {"mediciones": [], "archivos_procesados": []}
    if DEST.exists():
        try: prev = json.loads(DEST.read_text(encoding="utf-8"))
        except: prev = {"mediciones": [], "archivos_procesados": []}
    existentes = {m["id_medicion"] for m in prev.get("mediciones", [])}
    archivos_prev = set(prev.get("archivos_procesados", []))

    nuevas, dup_ids = [], 0
    archivos_procesados = list(archivos_prev)
    for f in files:
        raw = json.loads(f.read_text(encoding="utf-8"))
        parsed = parse_recorrido(raw, f.name)
        for m in parsed:
            if m["id_medicion"] in existentes:
                dup_ids += 1
                continue
            existentes.add(m["id_medicion"])
            nuevas.append(m)
        if f.name not in archivos_prev:
            archivos_procesados.append(f.name)
        print(f"  {f.name}: +{len(parsed)} candidatos")

    todas = prev.get("mediciones", []) + nuevas
    # Correr diagnóstico (Python)
    sys.path.insert(0, str(ROOT / "scripts"))
    from diagnostico import cargar_catalogo, diagnosticar
    cat = cargar_catalogo()
    for m in todas:
        if m.get("_diag"): continue  # ya diagnosticado
        eq = EQ_EXACT.get(m["tag"])
        try: m["_diag"] = diagnosticar(m, eq, cat)
        except Exception as e: m["_diag"] = {"estado":"sin_diag","hallazgos":[],"_err":str(e)[:120]}

    # Estadísticas
    por_tipo = {}
    en_censo = sum(1 for m in todas if m.get("_censo_match"))
    for m in todas:
        t = (m.get("_origen") or {}).get("tipo") or "?"
        por_tipo[t] = por_tipo.get(t, 0) + 1
    estados = {}
    for m in todas:
        e = (m.get("_diag") or {}).get("estado") or "sin_diag"
        estados[e] = estados.get(e, 0) + 1

    out = {
        "schema": "sicm-ele/mediciones_ingestadas/v1",
        "ingestados_at": datetime.now().isoformat(timespec="seconds"),
        "total": len(todas),
        "nuevas": len(nuevas),
        "duplicadas_saltadas": dup_ids,
        "archivos_procesados": sorted(archivos_procesados),
        "en_censo": en_censo,
        "por_tipo": por_tipo,
        "por_estado_diagnostico": estados,
        "mediciones": todas,
    }
    DEST.write_text(json.dumps(out, ensure_ascii=False, separators=(",",":")), encoding="utf-8")

    print(f"\n✓ {len(nuevas)} nuevas · {dup_ids} duplicadas · total: {len(todas)}")
    print(f"  En censo: {en_censo}/{len(todas)}  Por tipo: {por_tipo}")
    print(f"  Estados diag: {estados}")
    print(f"  Escrito: {DEST.relative_to(ROOT)} ({DEST.stat().st_size/1024:.1f} KB)")


if __name__ == "__main__":
    main(sys.argv[1:])
