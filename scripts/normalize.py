#!/usr/bin/env python3
"""
SICM-ELE Fase 1: normalización -> EQUIPOS, ACTIVIDADES, LIMITES.

Lee data/normalized/raw_dump/*.json y produce:
 - data/normalized/equipos.json      + equipos.csv
 - data/normalized/actividades.json  + actividades.csv
 - data/normalized/limites.json      + limites.csv
 - data/normalized/mediciones_template.json (esquema vacío)
 - reports/fase1_data_quality.md
"""
from __future__ import annotations
import json, csv, re, sys
from collections import defaultdict, OrderedDict
from pathlib import Path

ROOT = Path("/home/user/gifthub")
DUMP = ROOT / "data/normalized/raw_dump"
OUT = ROOT / "data/normalized"
OUT.mkdir(parents=True, exist_ok=True)

# ---------- Mapping FAMILIAS_SAP file -> tipo lógico ---------------------------------
FAMILY_MAP = {
    "PM_MOTOR_planta": "motor",
    "PM_MOTOR_planta_CON_LUBRICACION_Y_RODAMIENTOS_REV.1": "motor",
    "PM_TRANSFORMADOR": "transformador",
    "PM_TRANSFORMADORES_SECOS__TERMOMETRIA": "transformador_seco",
    "CENSO_TRANSFORMADORES_EN_ACEITE_TERMOMETRIA": "transformador_aceite",
    "PM_INTERRUPTOR": "interruptor",
    "PM_INTERRUPTOR_TERMOMETRIA": "interruptor",
    "PM_ARRANCADOR": "arrancador",
    "PM_ARRANCADOR__TERMOGRAFIA": "arrancador",
    "PM_TABLEROS": "tablero",
    "PM_TABLEROS_TERMOGRAFIA": "tablero",
    "PM_CCM": "ccm",
    "PM_RELEVADOR": "relevador",
    "PM_TURBOGENERADOR": "turbogenerador",
    "PM_VDF": "vfd",
    "PM_SFI": "ups_sfi",
    "PM_BANCO_CAPACITORES": "banco_capacitores",
    "PM_ALUMBRADO": "alumbrado",
    "PM_HVAC": "hvac",
    "PM_BATERIAS": "baterias",
    "PM_SISTEMA_TIERRA": "sistema_tierra",
    "PM_NEUTRO_TIERRA": "neutro_tierra",
    "PM_PARARRAYOS": "pararrayos",
    "PM_CIRCUITO_POTENCIA": "circuito_potencia",
    "PM_TRAZAS_ELECTRICAS": "trazas_electricas",
}

# ---------- EQUIPOS -----------------------------------------------------------------
# Columnas SAP comunes en PM_*.xlsx
COL_ALIAS = {
    "Grupo planif.": "grupo_planif",
    "Equipo": "sap_equipo",
    "NºIdentif.técn.": "tag",
    "NºIdentif.técn.": "tag",
    "Local": "sector",
    "Denominación": "denom",
    "Denominación": "denom",
    "Ubicac.técnica": "ubicacion",
    "Ubicac.técnica": "ubicacion",
    "PLANTA": "planta",
    "Status sistema": "status",
    "Emplazamiento": "emplazamiento",
    "Centro coste": "centro_coste",
    "Indicador ABC": "criticidad_abc",
}

def norm_key(k: str) -> str:
    return COL_ALIAS.get(k, k)

def is_pm_family_file(title: str) -> str | None:
    stem = title.replace(".xlsx", "").replace(".txt", "")
    return FAMILY_MAP.get(stem)

def parse_equipos(dumps):
    equipos = OrderedDict()  # key = tag
    seen_dup = defaultdict(int)
    for d in dumps:
        family = is_pm_family_file(d["source_title"])
        if not family: continue
        for sheet in d["sheets"]:
            rows = sheet.get("rows", [])
            if not rows: continue
            hdr = rows[0]
            # Skip if header doesn't look like a PM census
            if not any(k in hdr for k in ("NºIdentif.técn.", "NºIdentif.técn.", "Equipo")):
                continue
            # locate primary columns
            def col(name):
                for k in (name, name.replace("°","")):
                    if k in hdr: return hdr.index(k)
                return -1
            i_tag = col("NºIdentif.técn.")
            i_sap = col("Equipo")
            i_sector = col("Local")
            i_planta = col("PLANTA")
            i_ubic = col("Ubicac.técnica")
            i_denom = -1
            # denom is "Denominación" (there may be 2 columns with same name — take the first)
            for idx, k in enumerate(hdr):
                if k in ("Denominación", "Denominación"):
                    i_denom = idx; break
            i_crit = col("Indicador ABC")
            # extra family-specific columns
            def cell(row, idx):
                if idx < 0 or idx >= len(row): return None
                v = row[idx]
                return None if v is None or (isinstance(v, str) and not v.strip()) else v
            for r in rows[1:]:
                tag = cell(r, i_tag)
                if not tag: continue
                tag = str(tag).strip()
                sector = cell(r, i_sector) or ""
                # normalizar sector "SECTOR08" -> 8, "SECTOR01" -> 1
                m = re.match(r"SECTOR\s*0?(\d+)", str(sector), re.I)
                sector_n = int(m.group(1)) if m else sector
                rec = {
                    "tag": tag,
                    "familia": family,
                    "sap_equipo": cell(r, i_sap),
                    "sector": sector_n,
                    "planta": cell(r, i_planta),
                    "ubicacion": cell(r, i_ubic),
                    "denominacion": cell(r, i_denom),
                    "criticidad_abc": cell(r, i_crit),
                    "fuente": d["source_id"],
                }
                # extra keys from remaining columns (only if not present)
                for idx, k in enumerate(hdr):
                    key = norm_key(k)
                    if key in rec: continue
                    v = cell(r, idx)
                    if v is not None:
                        rec.setdefault(f"extra_{key}", v)
                if tag in equipos:
                    seen_dup[tag] += 1
                    # merge: prefer non-null new fields
                    for k, v in rec.items():
                        if not equipos[tag].get(k) and v: equipos[tag][k] = v
                else:
                    equipos[tag] = rec
    return equipos, seen_dup

# ---------- ACTIVIDADES catalog -----------------------------------------------------
ACTIVIDADES = [
    {"id": "TERMO",  "nombre": "Termografía infrarroja",           "tecnica": "IR imaging",     "norma": "NFPA 70B; NETA MTS Tbl 100.18", "periodicidad": "Trimestral / Semestral"},
    {"id": "TERMOM", "nombre": "Termometría (puntual)",            "tecnica": "Pirómetro IR",   "norma": "NFPA 70B",                       "periodicidad": "Mensual"},
    {"id": "VIB",    "nombre": "Análisis de vibraciones",          "tecnica": "Vibrómetro / colector", "norma": "ISO 20816-3; IEEE 841; NEMA MG-1 §7", "periodicidad": "Mensual / Bimestral"},
    {"id": "US",     "nombre": "Ultrasonido pasivo",               "tecnica": "SEE / gE ultrasónico",  "norma": "ISO 17359; NETA MTS", "periodicidad": "Trimestral"},
    {"id": "RAIS",   "nombre": "Resistencia de aislamiento (IP/DAR)","tecnica": "Megger 500-10kV DC", "norma": "IEEE 43-2013",                  "periodicidad": "Anual / Bianual"},
    {"id": "MCSA",   "nombre": "MCSA / firma de corriente",        "tecnica": "FFT corriente estator", "norma": "ISO 20958; IEEE 1415",         "periodicidad": "Semestral"},
    {"id": "QE",     "nombre": "Calidad de energía (THD, desbal.)","tecnica": "Analizador clase A",    "norma": "IEEE 519; NEMA MG-1 §14.35",   "periodicidad": "Continua / trimestral"},
    {"id": "ACEITE", "nombre": "Análisis fisicoquímico de aceite", "tecnica": "ASTM D-877/D-1816/D-971/D-974", "norma": "IEEE C57.106; ASTM D-1816", "periodicidad": "Anual"},
    {"id": "AGD",    "nombre": "Análisis de gases disueltos (DGA)","tecnica": "Cromatografía de gases (ASTM D-3612)", "norma": "IEEE C57.104",  "periodicidad": "Anual / Semestral"},
    {"id": "INSP",   "nombre": "Inspección de estado aparente",    "tecnica": "Recorrido visual",      "norma": "NRF-048-PEMEX; NOM-029-STPS",  "periodicidad": "Mensual"},
    {"id": "TIERRA", "nombre": "Medición de red de tierras",       "tecnica": "Telurómetro caída potencial", "norma": "NRF-011-PEMEX; IEEE 81",    "periodicidad": "Anual"},
    {"id": "RCONT",  "nombre": "Resistencia de contactos",         "tecnica": "Micro-ohmiómetro (ductor)", "norma": "IEEE C57.152; NETA MTS 7.1",  "periodicidad": "Bianual (mayor)"},
]

# ---------- LIMITES (ventanas operativas normativas) --------------------------------
# Extraídos manualmente de VENTANAS OPERATIVAS con cita normativa explícita.
LIMITES = [
    # ---- Vibración: ISO 20816-3 (equipo acoplado, con carga) ----
    {"tipo_equipo": "motobomba_horizontal_rigida", "parametro": "vibracion_velocidad_rms", "unidad": "mm/s",
     "banda_verde_max": 4.5, "banda_amarilla_max": 7.1, "banda_roja_min": 7.1,
     "norma": "ISO 20816-3 A1 GP1 (>400HP, H>315mm)", "fuente": "VALORES_VIBRACION_R12.xlsx"},
    {"tipo_equipo": "motobomba_horizontal_flexible", "parametro": "vibracion_velocidad_rms", "unidad": "mm/s",
     "banda_verde_max": 7.1, "banda_amarilla_max": 11.0, "banda_roja_min": 11.0,
     "norma": "ISO 20816-3 A1 GP1", "fuente": "VALORES_VIBRACION_R12.xlsx"},
    {"tipo_equipo": "motobomba_vertical_rigida", "parametro": "vibracion_velocidad_rms", "unidad": "mm/s",
     "banda_verde_max": 4.5, "banda_amarilla_max": 7.1, "banda_roja_min": 7.1,
     "norma": "ISO 20816-3 A1 GP1", "fuente": "VALORES_VIBRACION_R12.xlsx"},
    {"tipo_equipo": "motor_gp2_base_rigida", "parametro": "vibracion_velocidad_rms", "unidad": "mm/s",
     "banda_verde_max": 2.8, "banda_amarilla_max": 4.5, "banda_roja_min": 4.5,
     "norma": "ISO 20816-3 A2 GP2 (>20 <400HP, H<315mm)", "fuente": "VALORES_VIBRACION_R12.xlsx"},
    {"tipo_equipo": "motor_gp2_base_flexible", "parametro": "vibracion_velocidad_rms", "unidad": "mm/s",
     "banda_verde_max": 4.5, "banda_amarilla_max": 7.1, "banda_roja_min": 7.1,
     "norma": "ISO 20816-3 A2 GP2", "fuente": "VALORES_VIBRACION_R12.xlsx"},
    {"tipo_equipo": "motoventilador_soloaire_flexible", "parametro": "vibracion_velocidad_rms", "unidad": "mm/s",
     "banda_verde_max": 4.5, "banda_amarilla_max": 9.3, "banda_roja_min": 9.3,
     "norma": "ISO 20816-1", "fuente": "VALORES_VIBRACION_R12.xlsx"},
    {"tipo_equipo": "tiro_inducido_torre_enfriamiento", "parametro": "vibracion_velocidad_rms", "unidad": "mm/s",
     "banda_verde_max": 10.9, "banda_amarilla_max": 12.7, "banda_roja_min": 12.7,
     "norma": "CTI Institute", "fuente": "VALORES_VIBRACION_R12.xlsx"},
    # ---- Vibración motores desacoplados: NEMA MG-1 §7 / IEEE 841 §6.9 ----
    {"tipo_equipo": "motor_ieee841_2_4_6polos_desacoplado", "parametro": "vibracion_velocidad_pico_sin_filtrar", "unidad": "mm/s",
     "banda_verde_max": 2.03, "banda_amarilla_max": 2.03, "banda_roja_min": 2.03,
     "norma": "IEEE 841 §6.9 (a) motores 2/4/6 polos, desbalanceo/global", "fuente": "VALORES_VIBRACION_R12.xlsx"},
    {"tipo_equipo": "motor_ieee841_8polos_desacoplado", "parametro": "vibracion_velocidad_pico_sin_filtrar", "unidad": "mm/s",
     "banda_verde_max": 1.52, "banda_amarilla_max": 1.52, "banda_roja_min": 1.52,
     "norma": "IEEE 841 §6.9 (a) motores 8 polos", "fuente": "VALORES_VIBRACION_R12.xlsx"},
    # ---- Ajustes de temperatura motores (RTD) - AJUSTE_TEMPERATURA_MOTORES ----
    {"tipo_equipo": "motor_mt_13.8_4.16kV_devanados_clase_F", "parametro": "temp_devanado", "unidad": "°C",
     "banda_verde_max": 120, "banda_amarilla_max": 135, "banda_roja_min": 155,
     "norma": "Ajuste temperatura motores R1 (Clase F, MT RTD)", "fuente": "AJUSTE_TEMPERATURA_MOTORES_R1.xlsx"},
    {"tipo_equipo": "motor_mt_devanados_clase_H", "parametro": "temp_devanado", "unidad": "°C",
     "banda_verde_max": 125, "banda_amarilla_max": 135, "banda_roja_min": 175,
     "norma": "Ajuste temperatura motores R1 (Clase H)", "fuente": "AJUSTE_TEMPERATURA_MOTORES_R1.xlsx"},
    {"tipo_equipo": "motor_bt_480V_clase_F_pirometro", "parametro": "temp_devanado", "unidad": "°C",
     "banda_verde_max": 100, "banda_amarilla_max": 110, "banda_roja_min": 120,
     "norma": "Ajuste temperatura motores R1 (BT clase F pirómetro; restar 20°C al valor RTD)", "fuente": "AJUSTE_TEMPERATURA_MOTORES_R1.xlsx"},
    {"tipo_equipo": "motor_bt_480V_clase_H_pirometro", "parametro": "temp_devanado", "unidad": "°C",
     "banda_verde_max": 110, "banda_amarilla_max": 120, "banda_roja_min": 130,
     "norma": "Ajuste temperatura motores R1 (BT clase H pirómetro)", "fuente": "AJUSTE_TEMPERATURA_MOTORES_R1.xlsx"},
    {"tipo_equipo": "motor_rodamientos", "parametro": "temp_rodamiento", "unidad": "°C",
     "banda_verde_max": 70, "banda_amarilla_max": 85, "banda_roja_min": 95,
     "norma": "Ajuste temperatura motores R1 (rodamientos MT)", "fuente": "AJUSTE_TEMPERATURA_MOTORES_R1.xlsx"},
    {"tipo_equipo": "motor_desbalance_temp_fases", "parametro": "delta_temp_entre_fases", "unidad": "°C",
     "banda_verde_max": 10, "banda_amarilla_max": 15, "banda_roja_min": 15,
     "norma": "Ajuste temperatura motores R1 (delta 15°C por fase)", "fuente": "AJUSTE_TEMPERATURA_MOTORES_R1.xlsx"},
    # ---- Delta T termográfico (NFPA 70B / NETA MTS) ----
    {"tipo_equipo": "conexion_electrica", "parametro": "delta_t_termografico", "unidad": "°C",
     "banda_verde_max": 3, "banda_amarilla_max": 15, "banda_roja_min": 15,
     "norma": "NFPA 70B / NETA MTS Tbl 100.18 (1-3 investigar; 4-15 reparar corto plazo; >15 mayor)", "fuente": "Codificación normativa"},
    # ---- Aislamiento - IEEE 43 ----
    {"tipo_equipo": "motor_transformador", "parametro": "indice_polarizacion", "unidad": "-",
     "banda_verde_max": 4.0, "banda_amarilla_max": 4.0, "banda_roja_min": 1.0,
     "norma": "IEEE 43-2013 (<1 peligroso; 1-2 cuestionable; 2-4 aceptable; >4 excelente)", "fuente": "Codificación normativa"},
    {"tipo_equipo": "motor_transformador", "parametro": "resistencia_aislamiento_min", "unidad": "MΩ",
     "banda_verde_max": None, "banda_amarilla_max": None, "banda_roja_min": None,
     "norma": "IEEE 43-2013: kV+1 MΩ mínimo a 40°C (para máquinas fabricadas antes 1970: (kV+1)); para pos-1970: 100 MΩ mínimo", "fuente": "Codificación normativa"},
    # ---- Desbalance (NEMA MG-1 §14.35) ----
    {"tipo_equipo": "motor_inducción", "parametro": "desbalance_corriente_pct", "unidad": "%",
     "banda_verde_max": 5, "banda_amarilla_max": 10, "banda_roja_min": 10,
     "norma": "NEMA MG-1 §14.35 (>10% no operar sin derateo; contextualizar con carga)", "fuente": "Codificación normativa"},
    {"tipo_equipo": "motor_inducción", "parametro": "desbalance_tension_pct", "unidad": "%",
     "banda_verde_max": 1, "banda_amarilla_max": 2, "banda_roja_min": 2,
     "norma": "NEMA MG-1 §14.36 (<1% ideal; <2% límite)", "fuente": "Codificación normativa"},
    # ---- THD IEEE 519 (PCC BT y MT) ----
    {"tipo_equipo": "PCC_bt_baja_tension", "parametro": "THD_V", "unidad": "%",
     "banda_verde_max": 5, "banda_amarilla_max": 8, "banda_roja_min": 8,
     "norma": "IEEE 519-2022 Tbl 1 (V≤1kV)", "fuente": "Codificación normativa"},
    {"tipo_equipo": "PCC_mt_1_69kV", "parametro": "THD_V", "unidad": "%",
     "banda_verde_max": 5, "banda_amarilla_max": 5, "banda_roja_min": 5,
     "norma": "IEEE 519-2022 Tbl 1 (1kV<V≤69kV)", "fuente": "Codificación normativa"},
    # ---- Aceite dielectrico IEEE C57.106 / ASTM ----
    {"tipo_equipo": "transformador_aceite_mineral", "parametro": "rigidez_dielectrica_D1816_2mm", "unidad": "kV",
     "banda_verde_max": None, "banda_amarilla_max": 35, "banda_roja_min": 35,
     "norma": "IEEE C57.106; ASTM D-1816 gap 2mm (≥35 kV en servicio ≤69kV)", "fuente": "RANGOS_ACEITE_R1.xlsx"},
    {"tipo_equipo": "transformador_aceite_mineral", "parametro": "factor_potencia_25C", "unidad": "%",
     "banda_verde_max": 0.05, "banda_amarilla_max": 0.05, "banda_roja_min": 0.05,
     "norma": "ASTM D-924 (<0.05% @ 25°C)", "fuente": "RANGOS_ACEITE_R1.xlsx"},
    {"tipo_equipo": "transformador_aceite_mineral", "parametro": "factor_potencia_100C", "unidad": "%",
     "banda_verde_max": 0.30, "banda_amarilla_max": 0.30, "banda_roja_min": 0.30,
     "norma": "ASTM D-924 (<0.30% @ 100°C)", "fuente": "RANGOS_ACEITE_R1.xlsx"},
    {"tipo_equipo": "transformador_aceite_mineral", "parametro": "tension_interfacial_25C", "unidad": "mN/m",
     "banda_verde_max": None, "banda_amarilla_max": 40, "banda_roja_min": 40,
     "norma": "ASTM D-971 (<40 mN/m alerta contaminación)", "fuente": "RANGOS_ACEITE_R1.xlsx"},
    {"tipo_equipo": "transformador_aceite_mineral", "parametro": "contenido_agua_ppm", "unidad": "ppm",
     "banda_verde_max": 25, "banda_amarilla_max": 35, "banda_roja_min": 35,
     "norma": "IEEE C57.106 Tbl 4 (≤35 ppm servicio 69kV) - ajustar por clase de tensión", "fuente": "RANGOS_ACEITE_R1.xlsx"},
    {"tipo_equipo": "transformador_aceite_mineral", "parametro": "acidez_D664", "unidad": "mgKOH/g",
     "banda_verde_max": 0.10, "banda_amarilla_max": 0.20, "banda_roja_min": 0.30,
     "norma": "IEEE C57.106 (Buen: ≤0.10; alerta 0.10-0.20; degradación >0.20)", "fuente": "RANGOS_ACEITE_R1.xlsx"},
    # ---- Temperatura transformadores en aceite (censo) ----
    {"tipo_equipo": "transformador_aceite_devanado", "parametro": "temp_devanado", "unidad": "°C",
     "banda_verde_max": 75, "banda_amarilla_max": 85, "banda_roja_min": 100,
     "norma": "CENSO_TRANSFORMADORES_EN_ACEITE (Alerta1 75°C, Alerta2 85°C, Disparo 100°C, límite diseño 120°C)", "fuente": "CENSO_TRANSFORMADORES_EN_ACEITE.xlsx"},
    {"tipo_equipo": "transformador_aceite_aceite", "parametro": "temp_aceite", "unidad": "°C",
     "banda_verde_max": 75, "banda_amarilla_max": 85, "banda_roja_min": 100,
     "norma": "CENSO_TRANSFORMADORES_EN_ACEITE", "fuente": "CENSO_TRANSFORMADORES_EN_ACEITE.xlsx"},
    # ---- DGA por IEEE C57.104 (concentraciones L1) ----
    {"tipo_equipo": "transformador_aceite_dga", "parametro": "H2", "unidad": "ppm",
     "banda_verde_max": 100, "banda_amarilla_max": 700, "banda_roja_min": 1800,
     "norma": "IEEE C57.104-2019 Tbl 3 concentraciones (Condición 1/2/3)", "fuente": "Codificación normativa"},
    {"tipo_equipo": "transformador_aceite_dga", "parametro": "CH4", "unidad": "ppm",
     "banda_verde_max": 120, "banda_amarilla_max": 400, "banda_roja_min": 1000,
     "norma": "IEEE C57.104-2019", "fuente": "Codificación normativa"},
    {"tipo_equipo": "transformador_aceite_dga", "parametro": "C2H2", "unidad": "ppm",
     "banda_verde_max": 1, "banda_amarilla_max": 9, "banda_roja_min": 35,
     "norma": "IEEE C57.104-2019 (acetileno: cualquier presencia investigar)", "fuente": "Codificación normativa"},
    {"tipo_equipo": "transformador_aceite_dga", "parametro": "C2H4", "unidad": "ppm",
     "banda_verde_max": 50, "banda_amarilla_max": 100, "banda_roja_min": 200,
     "norma": "IEEE C57.104-2019", "fuente": "Codificación normativa"},
    {"tipo_equipo": "transformador_aceite_dga", "parametro": "CO", "unidad": "ppm",
     "banda_verde_max": 350, "banda_amarilla_max": 570, "banda_roja_min": 1400,
     "norma": "IEEE C57.104-2019", "fuente": "Codificación normativa"},
]

# ---------- MAIN --------------------------------------------------------------------
def load_dumps():
    dumps = []
    for p in sorted(DUMP.glob("*.json")):
        try:
            dumps.append(json.loads(p.read_text(encoding="utf-8")))
        except Exception as e:
            print(f"WARN cannot load {p.name}: {e}")
    return dumps

def write_csv(path: Path, rows: list[dict]):
    if not rows:
        path.write_text("", encoding="utf-8"); return
    keys = list({k for r in rows for k in r.keys()})
    # Put common keys first
    priority = ["tag", "familia", "sap_equipo", "sector", "planta", "denominacion", "id", "nombre", "tecnica", "norma", "tipo_equipo", "parametro", "unidad"]
    keys = [k for k in priority if k in keys] + sorted(k for k in keys if k not in priority)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in rows: w.writerow({k: r.get(k) for k in keys})

def main():
    dumps = load_dumps()
    print(f"Loaded {len(dumps)} dumps")

    # --- EQUIPOS ---
    equipos, dups = parse_equipos(dumps)
    print(f"EQUIPOS: {len(equipos)} unique tags, dedup collisions: {sum(dups.values())} across {len(dups)} tags")
    # Save
    (OUT / "equipos.json").write_text(json.dumps(list(equipos.values()), ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    write_csv(OUT / "equipos.csv", list(equipos.values()))

    # Breakdown by familia and sector
    by_family = defaultdict(int); by_sector = defaultdict(int)
    for r in equipos.values():
        by_family[r["familia"]] += 1
        by_sector[str(r.get("sector",""))] += 1

    # --- ACTIVIDADES ---
    (OUT / "actividades.json").write_text(json.dumps(ACTIVIDADES, ensure_ascii=False, indent=1), encoding="utf-8")
    write_csv(OUT / "actividades.csv", ACTIVIDADES)

    # --- LIMITES ---
    (OUT / "limites.json").write_text(json.dumps(LIMITES, ensure_ascii=False, indent=1), encoding="utf-8")
    write_csv(OUT / "limites.csv", LIMITES)

    # --- MEDICIONES template ---
    tpl = {
        "schema_version": "1.0",
        "campos": [
            "id_medicion", "tag", "id_actividad", "fecha_iso", "operario",
            "I_F1", "I_F2", "I_F3",
            "V_L1L2", "V_L2L3", "V_L3L1",
            "temp_max_c", "delta_t_c",
            "R_aislamiento_MOhm", "IP", "DAR",
            "THD_V_pct", "THD_I_pct",
            "vibracion_rms_mms", "vibracion_pico_mms",
            "condicion", "observaciones",
        ],
        "condicion_enum": ["normal", "alerta", "alarma"],
        "registros": []
    }
    (OUT / "mediciones_template.json").write_text(json.dumps(tpl, ensure_ascii=False, indent=1), encoding="utf-8")

    # --- Data quality report ---
    families_seen = sorted(set(by_family.keys()))
    families_missing = sorted([f for f in set(FAMILY_MAP.values()) if f not in families_seen])
    report_lines = [
        "# Reporte de calidad de datos — FASE 1",
        "",
        f"- Archivos fuente procesados: **{len(dumps)}**",
        f"- EQUIPOS únicos extraídos: **{len(equipos)}**",
        f"- Colisiones de TAG entre fuentes: **{sum(dups.values())}** (en {len(dups)} tags)",
        f"- ACTIVIDADES catalogadas: **{len(ACTIVIDADES)}**",
        f"- LIMITES normativos codificados: **{len(LIMITES)}**",
        f"- MEDICIONES cargadas: **0** (esquema listo, esperando ingesta desde recorridos y campañas)",
        "",
        "## Distribución de EQUIPOS por familia",
        "",
        "| Familia | # Equipos |",
        "|---|---:|",
    ]
    for fam, n in sorted(by_family.items(), key=lambda x: -x[1]):
        report_lines.append(f"| {fam} | {n} |")
    report_lines += [
        "",
        "## Distribución de EQUIPOS por sector",
        "",
        "| Sector | # Equipos |",
        "|---|---:|",
    ]
    for sec, n in sorted(by_sector.items(), key=lambda x: (str(x[0]))):
        report_lines.append(f"| {sec} | {n} |")

    report_lines += [
        "",
        "## Familias faltantes o no ingestadas",
        "",
    ]
    if families_missing:
        for f in families_missing:
            report_lines.append(f"- `{f}` — sin registros ingestados (archivo pendiente de descarga o vacío en esta corrida)")
    else:
        report_lines.append("_Ninguna familia declarada quedó sin registros._")

    report_lines += [
        "",
        "## Limitaciones honestas de la Fase 1",
        "",
        "1. El corpus original citado como \"16 archivos\" corresponde en realidad a **30 archivos** disponibles en Drive: 10 en `VENTANAS OPERATIVAS` y 20 en `FAMILIAS_SAP`. Se procesaron **21** (16 xlsx + 5 text) por límites de tamaño/context de sesión; los 9 restantes (`PM_ALUMBRADO`, `PM_HVAC`, `PM_BATERIAS`, `PM_NEUTRO_TIERRA`, `PM_PARARRAYOS`, `PM_SISTEMA_TIERRA`, `PM_CIRCUITO_POTENCIA`, `PM_TRAZAS_ELECTRICAS`, y `CENSO_TRANSFORMADORES_ACEITE` como xlsx) están inventariados en `scripts/inventory.json` y pueden ingestarse ejecutando `scripts/extract_xlsx.py` tras descargarlos.",
        "2. El archivo `CENSO_TRANSFORMADORES_EN_ACEITE_TERMOMETRIA.xlsx` (~32 transformadores en aceite) se accedió sólo en formato texto plano; sus registros no están en `equipos.json` pero SÍ están reflejados en `limites.json` (bandas de temperatura 75/85/100°C).",
        "3. La tabla `MEDICIONES` está vacía: no existen aún registros transaccionales en Drive. El sistema se conecta con la PWA `recorridos-ebv-sicm` (rama INSTRUMENTOS) y con la nueva PWA `sicm-ele.html` (esta entrega) que comparten el patrón IndexedDB → JSON exportable.",
        "4. Los umbrales de DGA en `limites.json` corresponden a IEEE C57.104-2019 Tabla 3 (condiciones 1/2/3); ajustar por edad del aceite y por muestreo previo si se desea aplicar C57.104 §5 (tasas de generación).",
        "5. `IP/DAR`: IEEE 43-2013 fija umbrales cualitativos, no absolutos por tipo de máquina; el motor de diagnóstico usa 1.0/2.0/4.0 como bandas verde/amarilla/roja pero para dictamen formal debe considerarse temperatura de prueba y limpieza.",
        "6. Los umbrales de desbalance de corriente **pierden significado a cargas <20% de la nominal** (NEMA MG-1 §14.35). El motor de diagnóstico incluye esta salvedad.",
        "",
        "## Siguientes fases requieren:",
        "",
        "- **Fase 2**: ingesta continua desde el módulo de captura de la PWA `sicm-ele.html` para poblar `MEDICIONES`.",
        "- **Fase 3**: mínimo 3 puntos históricos por parámetro/equipo para calcular pendiente de degradación.",
        "- **Fase 5**: la extrapolación lineal es válida sólo mientras el proceso de degradación sea monótono. Para modelos ML de predicción real se requieren **~30+ mediciones por equipo** con etiquetado de eventos de falla.",
    ]
    (ROOT / "reports/fase1_data_quality.md").write_text("\n".join(report_lines), encoding="utf-8")
    print(f"Reporte escrito: reports/fase1_data_quality.md")

if __name__ == "__main__":
    main()
