#!/usr/bin/env python3
"""
Fase 4 · Motor de diagnóstico Python (referencia canónica).

Evalúa una medición contra data/normalized/reglas_diagnostico.json y devuelve
lista de hallazgos ordenados por prioridad. Mismo DSL que el motor JS de la PWA.

Uso:
    from diagnostico import diagnosticar, cargar_catalogo
    catalogo = cargar_catalogo()
    hallazgos = diagnosticar(medicion, equipo, catalogo)

DSL de condiciones (JSON):
    {"var":"nombre","op":valor}     ← operadores gt/gte/lt/lte/eq/between/isnull
    {"and":[cond1, cond2, ...]}
    {"or":[cond1, cond2, ...]}
    {"not":cond}

Los "vars" pueden ser:
  - campo directo de la medición (temp_max_c, IP, THD_I_pct, ...)
  - eq.<campo> del equipo (eq.familia, eq.NT, eq.V, eq.I, eq.HP, eq.crit, eq.sector)
  - derivadas: desbalance_i_pct, desbalance_v_pct, carga_pct, corriente_avg
"""
from __future__ import annotations
import json, math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ---------- Cargar catálogos ---------------------------------
def cargar_catalogo():
    return {
        "reglas": json.loads((ROOT / "data/normalized/reglas_diagnostico.json").read_text(encoding="utf-8"))["reglas"],
        "fmea": json.loads((ROOT / "data/normalized/fmea.json").read_text(encoding="utf-8"))["modos"],
        "acciones": json.loads((ROOT / "data/normalized/acciones_rcm.json").read_text(encoding="utf-8"))["acciones"],
    }

# ---------- Derivadas ---------------------------------------
def _nema_unbalance(vals):
    vals = [v for v in vals if v is not None and v > 0]
    if len(vals) < 3: return None
    avg = sum(vals)/len(vals)
    return max(abs(v-avg) for v in vals)/avg * 100

def computar_derivadas(m, eq):
    d = {}
    d["desbalance_i_pct"] = _nema_unbalance([m.get("I_F1"), m.get("I_F2"), m.get("I_F3")])
    d["desbalance_v_pct"] = _nema_unbalance([m.get("V_L1L2"), m.get("V_L2L3"), m.get("V_L3L1")])
    I = [m.get("I_F1"), m.get("I_F2"), m.get("I_F3")]
    Ivs = [i for i in I if i is not None and i > 0]
    d["corriente_avg"] = sum(Ivs)/len(Ivs) if Ivs else None
    I_nom = eq.get("I") if eq else None
    d["carga_pct"] = (d["corriente_avg"]/I_nom*100) if (d["corriente_avg"] and I_nom) else None
    return d

# ---------- Resolver variables ------------------------------
def _resolver(var, contexto):
    m = contexto["m"]; eq = contexto["eq"]; d = contexto["d"]
    if var.startswith("eq."):
        return (eq or {}).get(var[3:])
    if var in d: return d[var]
    return m.get(var)

# ---------- Evaluar condiciones -----------------------------
def _evaluar(cond, ctx):
    if not isinstance(cond, dict): return False
    if "and" in cond: return all(_evaluar(c, ctx) for c in cond["and"])
    if "or"  in cond: return any(_evaluar(c, ctx) for c in cond["or"])
    if "not" in cond: return not _evaluar(cond["not"], ctx)
    if "var" not in cond: return False
    v = _resolver(cond["var"], ctx)
    if v is None:
        return bool(cond.get("isnull", False))
    if "gt"  in cond: return v > cond["gt"]
    if "gte" in cond: return v >= cond["gte"]
    if "lt"  in cond: return v < cond["lt"]
    if "lte" in cond: return v <= cond["lte"]
    if "eq"  in cond: return v == cond["eq"]
    if "between" in cond:
        a,b = cond["between"]; return a <= v <= b
    if "isnull" in cond: return False  # v no es None
    return False

# ---------- Motor principal ----------------------------------
_PRIORIDAD = {"inmediata":0, "proximo_paro":1, "programar":2, "rutina":3}

def diagnosticar(medicion, equipo, catalogo=None):
    if catalogo is None: catalogo = cargar_catalogo()
    d = computar_derivadas(medicion, equipo or {})
    ctx = {"m": medicion, "eq": equipo or {}, "d": d}
    hallazgos = []
    for regla in catalogo["reglas"]:
        familia = (equipo or {}).get("familia")
        if familia and regla.get("familia") and familia not in regla["familia"]:
            continue
        try:
            if _evaluar(regla["condicion"], ctx):
                acciones_ids = [a["id"] for a in catalogo["acciones"]
                                if any(a.get("modo") == fm["id"]
                                       for fm in catalogo["fmea"]
                                       if regla["id"] in fm.get("reglas", []))]
                hallazgos.append({
                    "regla_id": regla["id"],
                    "estado": regla["estado"],
                    "modo_falla": regla["modo_falla"],
                    "causa_probable": regla.get("causa_probable"),
                    "mecanismo": regla.get("mecanismo_fisico"),
                    "accion": regla["accion"],
                    "prioridad": regla.get("prioridad", "programar"),
                    "norma": regla["norma"],
                    "acciones_recomendadas": acciones_ids,
                })
        except Exception as e:
            hallazgos.append({"regla_id": regla["id"], "error": str(e)})

    # Ordenar por prioridad
    hallazgos.sort(key=lambda h: _PRIORIDAD.get(h.get("prioridad","programar"), 9))

    # Estado global
    if any(h.get("estado")=="alarma" for h in hallazgos):
        estado_global = "alarma"
    elif any(h.get("estado")=="alerta" for h in hallazgos):
        estado_global = "alerta"
    else:
        estado_global = "normal"

    return {"estado": estado_global, "hallazgos": hallazgos, "derivadas": d}


# ---------- Batch runner (útil para reportes y CI) -----------
def diagnosticar_lote(mediciones, equipos_dict, catalogo=None):
    if catalogo is None: catalogo = cargar_catalogo()
    resultados = []
    for m in mediciones:
        eq = equipos_dict.get(m.get("tag"))
        r = diagnosticar(m, eq, catalogo)
        resultados.append({"id_medicion": m.get("id_medicion"), "tag": m.get("tag"), **r})
    return resultados


if __name__ == "__main__":
    # Demo: correr el motor sobre las mediciones sintéticas
    catalogo = cargar_catalogo()
    print(f"Catálogo: {len(catalogo['reglas'])} reglas, {len(catalogo['fmea'])} modos FMEA, {len(catalogo['acciones'])} acciones RCM")

    syn = json.loads((ROOT / "data/normalized/mediciones_sinteticas.json").read_text(encoding="utf-8"))
    equipos = {e["tag"]: e for e in json.loads((ROOT / "data/normalized/equipos_nameplate.min.json").read_text(encoding="utf-8"))}
    resultados = diagnosticar_lote(syn["mediciones"], equipos, catalogo)

    from collections import Counter
    conteo = Counter(r["estado"] for r in resultados)
    print(f"Sobre {len(resultados)} mediciones sintéticas: {dict(conteo)}")
    ejemplos = [r for r in resultados if r["hallazgos"]][:5]
    for r in ejemplos:
        print(f"\n{r['tag']} · {r['estado']}")
        for h in r["hallazgos"][:2]:
            print(f"  [{h.get('regla_id')}] {h.get('modo_falla')} → {h.get('accion','')[:80]}")

    # Persistir para el reporte
    (ROOT / "data/normalized/diagnostico_batch.json").write_text(
        json.dumps({"total": len(resultados), "estados": dict(conteo), "resultados": resultados[:200]},
                   ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"\nGuardado: data/normalized/diagnostico_batch.json (primeros 200)")
