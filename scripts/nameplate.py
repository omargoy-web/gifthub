#!/usr/bin/env python3
"""
Fase 2 · Enriquecimiento de nameplate.

Toma equipos.json y agrega, por familia, los campos de placa relevantes
(V nominal, I nominal, potencia, clase de aislamiento) usando las
columnas extra_* provenientes de SAP.

Salida: data/normalized/equipos_nameplate.json (+ .min.json para PWA).
"""
from __future__ import annotations
import json, re
from pathlib import Path

ROOT = Path("/home/user/gifthub")
src = json.loads((ROOT / "data/normalized/equipos.json").read_text())

def num(v):
    if v is None: return None
    s = str(v).strip().replace(",", "")
    m = re.search(r"[-+]?\d+(?:\.\d+)?", s)
    if not m: return None
    try: return float(m.group())
    except: return None

def unit(v):
    """Retorna la primera unidad reconocida en el texto: V, kV, A, kA, HP, kW, MVA, kVA, RPM."""
    if v is None: return None
    s = str(v).upper()
    for u in ["MVA","KVA","KV","KW","KA","HP","RPM","GAL","LITROS","LTS"," V"," A"]:
        if u.strip() in s: return u.strip()
    return None

def kva_from(v, family):
    """Normaliza potencia a kVA para transformadores, o HP para motores."""
    if v is None: return None
    s = str(v).upper()
    n = num(v)
    if n is None: return None
    if "MVA" in s: return n*1000
    if "KVA" in s or "KVA" in s: return n
    return n  # asume kVA

def volt_class(v):
    """Devuelve BT/MT/AT según nivel de tensión en volts."""
    if v is None: return "?"
    n = v if isinstance(v,(int,float)) else num(v)
    if n is None: return "?"
    if n <= 1000: return "BT"
    if n <= 34500: return "MT"
    return "AT"

# Mapping familia → columnas relevantes
MAPS = {
    "motor": {
        "V_nom": "extra_VOLTAJE MOTOR ELECTR",
        "I_nom": "extra_CORRIENTE NOM MOTOR",
        "P_HP":  "extra_POTENCIA DISEÑO MOTO",
        "clase_aislamiento": "extra_CLASE DE AISLAMIENTO",
        "factor_servicio": "extra_FACTOR DE SERVICIO",
        "eficiencia_pct": "extra_EFICIENCIA DEL MOTOR",
        "fp": "extra_FACTOR DE POTENC MOT",
        "rpm": "extra_VELOCIDAD ANGULAR DE",
        "tipo": "extra_TIPO DE MOTOR",
        "marca": "extra_MARCA DEL MOTOR ELEC",
        "diseno_nema": "extra_DISEÑO NEMA MOTOR EL",
        "cod_rotor_bloqueado": "extra_CODIGO DE ROTOR BLOQ",
    },
    "transformador": {
        "V_prim": "extra_VOLTAJE PRIMARIO TRA",
        "V_sec": "extra_VOLTAJE SECUND TRANS",
        "capacidad": "extra_CAPACIDAD TRANSFORMA",
        "I_sec": "extra_CORRIENTE SECUNDARIO",
        "I_tap": "extra_CORRIENTE DERIV. TAP",
        "elevacion_temp": "extra_ELEVACIÓN DE TEMPERA",
    },
    "transformador_seco": {
        "V_prim": "extra_VOLTAJE PRIMARIO TRA",
        "V_sec": "extra_VOLTAJE SECUND TRANS",
        "capacidad": "extra_CAPACIDAD TRANSFORMA",
        "I_sec": "extra_CORRIENTE SECUNDARIO",
        "I_tap": "extra_CORRIENTE DERIV. TAP",
        "clase_aislamiento": "extra_CLASE DE AISLAMIENTO",
        "altitud": "extra_ALTITUD",
    },
    "interruptor": {
        "I_nom": "extra_CORRIENTE NOM INTERR",
        "corto_circuito": "extra_CAPACIDAD DE CORTO C",
        "tipo": "extra_TIPO DE INTERRUPTOR",
        "marca": "extra_MARCA INTERRUPTOR DE",
        "fases": "extra_NUMERO DE FASES",
    },
    "tablero": {
        "V_nom": "extra_VOLTAJE TABLERO DIST",
        "I_nom": "extra_CAPACIDAD NOMINAL",
        "corto_circuito": "extra_CAPACIDAD DE CORTO C",
        "n_interruptores": "extra_CANTIDAD DE INTERRUP",
        "tipo": "extra_TIPO DE TABLERO DE D",
        "marca": "extra_MARCA TABLERO MED BA",
    },
    "ccm": {
        "V_nom": "extra_VOLTAJE NOMINAL DEL",
        "corto_circuito": "extra_CAPACIDAD DE CORTO C",
        "capacidad_barras": "extra_CAPACIDAD BARRAS PRI",
        "n_arrancadores": "extra_CANTIDAD DE ARRANCAD",
        "n_interruptores": "extra_CANTIDAD DE INTERRUP",
    },
    "arrancador": {
        "P_HP": "extra_POTENCIA DE DISEÑO A",
        "V_operacion": "extra_VOLTAJE DE OPERACIÓN",
        "V_control": "extra_VOLTAJE DE CONTROL",
        "tamano_nema": "extra_TAMAÑO NEMA ARRANCAD",
        "marca": "extra_MARCA DEL ARRANCADOR",
    },
    "relevador": {
        "V_nom": "extra_VOLTAJE_NOMINAL",
        "tipo": "extra_TIPO DE RELEVADOR",
        "marca": "extra_MARCA DEL RELEVADOR",
        "funcion": "extra_FUNCIÓN DEL RELEVADO",
    },
}

# Enriquece
def enrich(rec):
    fam = rec["familia"]
    m = MAPS.get(fam, {})
    plate = {}
    for logical, src_key in m.items():
        raw = rec.get(src_key)
        plate[logical] = raw
        # numeric versions
        nkey = logical + "_num"
        if logical in ("V_nom","V_prim","V_sec","V_operacion","V_control","V_nom","I_nom","I_sec","I_tap",
                       "P_HP","capacidad","rpm","fp","eficiencia_pct","factor_servicio","corto_circuito",
                       "capacidad_barras","fases","n_interruptores","n_arrancadores","altitud"):
            plate[nkey] = num(raw)
    # Derivados
    if fam == "motor":
        V = plate.get("V_nom_num"); I = plate.get("I_nom_num"); HP = plate.get("P_HP_num")
        # Si no hay I pero hay HP y V, estimar: I ≈ HP*746/(√3·V·fp·η)
        fp = plate.get("fp_num") or 0.85
        eta = (plate.get("eficiencia_pct_num") or 90)/100.0
        if not I and HP and V and V>0:
            plate["I_nom_calc_num"] = round(HP*746/(1.732*V*fp*eta), 1)
        # Nivel de tensión
        plate["nivel_tension"] = volt_class(V)
    elif fam in ("transformador","transformador_seco"):
        V = plate.get("V_prim_num"); Vs = plate.get("V_sec_num")
        Isec = plate.get("I_sec_num")
        cap_raw = plate.get("capacidad")
        # kVA normalizada declarada en SAP (con unidades sucias)
        kVA_sap = None
        if cap_raw:
            s = str(cap_raw).upper()
            n = num(cap_raw)
            if n:
                if "MVA" in s: kVA_sap = n*1000
                elif "KVA" in s: kVA_sap = n
                else: kVA_sap = n
        # kVA calculado por corriente/tensión secundaria (autoritativo cuando existe)
        kVA_calc = None
        if Vs and Isec:
            kVA_calc = round(1.732 * Vs * Isec / 1000, 1)
        elif V and Isec:
            kVA_calc = round(1.732 * V * Isec / 1000, 1)
        plate["kVA_sap"] = kVA_sap
        plate["kVA_calc"] = kVA_calc
        # Autoritativa: si SAP y CALC difieren >2× → usar CALC (SAP suele venir con unidades erradas)
        if kVA_calc and kVA_sap:
            ratio = kVA_sap / kVA_calc
            if ratio > 2 or ratio < 0.5:
                plate["kVA"] = kVA_calc
                plate["kVA_fuente"] = "calc_isec_vs_(sap_inconsistente)"
            else:
                plate["kVA"] = kVA_sap
                plate["kVA_fuente"] = "sap"
        elif kVA_calc:
            plate["kVA"] = kVA_calc
            plate["kVA_fuente"] = "calc_isec_vs"
        elif kVA_sap:
            plate["kVA"] = kVA_sap
            plate["kVA_fuente"] = "sap"
        plate["nivel_tension_prim"] = volt_class(V)
        plate["nivel_tension_sec"] = volt_class(Vs)
    elif fam == "arrancador":
        V = plate.get("V_operacion_num"); HP = plate.get("P_HP_num")
        plate["nivel_tension"] = volt_class(V)
    elif fam in ("interruptor","tablero","ccm","relevador"):
        V = plate.get("V_nom_num")
        plate["nivel_tension"] = volt_class(V)

    # Criticidad final: si ABC=A → alta, B→media, C→baja, resto → media por defecto
    crit_abc = (rec.get("criticidad_abc") or "").upper()
    plate["criticidad"] = {"A":"alta","B":"media","C":"baja"}.get(crit_abc, "media")

    return plate

enriched = []
for r in src:
    plate = enrich(r)
    enriched.append({
        "tag": r["tag"],
        "familia": r["familia"],
        "sap": r.get("sap_equipo"),
        "sector": r.get("sector"),
        "planta": r.get("planta"),
        "denom": r.get("denominacion"),
        "criticidad_abc": r.get("criticidad_abc"),
        "criticidad": plate.pop("criticidad", None),
        "plate": {k:v for k,v in plate.items() if v not in (None,"","-",[])},
    })

out = ROOT / "data/normalized/equipos_nameplate.json"
out.write_text(json.dumps(enriched, ensure_ascii=False, indent=1, default=str), encoding="utf-8")

# Slim para embed: solo campos que el motor de KPIs necesita
slim = []
for r in enriched:
    p = r.get("plate", {})
    slim.append({
        "tag": r["tag"], "familia": r["familia"], "sector": r["sector"], "planta": r["planta"],
        "denom": r["denom"], "sap": r["sap"], "crit": r["criticidad"], "crit_abc": r["criticidad_abc"],
        "V": p.get("V_nom_num") or p.get("V_prim_num") or p.get("V_operacion_num"),
        "I": p.get("I_nom_num") or p.get("I_nom_calc_num") or p.get("I_sec_num"),
        "HP": p.get("P_HP_num"),
        "kVA": p.get("kVA"),
        "rpm": p.get("rpm_num"),
        "clase": p.get("clase_aislamiento"),
        "NT": p.get("nivel_tension") or p.get("nivel_tension_prim"),
    })
(ROOT / "data/normalized/equipos_nameplate.min.json").write_text(
    json.dumps(slim, ensure_ascii=False, separators=(",",":")), encoding="utf-8"
)

print(f"Enriched: {len(enriched)} equipos → equipos_nameplate.json")
print(f"Slim: equipos_nameplate.min.json → {(ROOT/'data/normalized/equipos_nameplate.min.json').stat().st_size:,} bytes")

# Cobertura de datos por familia
from collections import Counter, defaultdict
cov = defaultdict(lambda: {"n":0,"V":0,"I":0,"HP":0,"kVA":0})
for r in slim:
    c = cov[r["familia"]]
    c["n"]+=1
    if r["V"]: c["V"]+=1
    if r["I"]: c["I"]+=1
    if r["HP"]: c["HP"]+=1
    if r["kVA"]: c["kVA"]+=1
print("\nCobertura nameplate por familia:")
print(f"{'familia':<20} {'n':>6} {'V':>6} {'I':>6} {'HP':>6} {'kVA':>6}")
for fam, c in sorted(cov.items()):
    print(f"{fam:<20} {c['n']:>6} {c['V']:>6} {c['I']:>6} {c['HP']:>6} {c['kVA']:>6}")
