# SICM-ELE · Sistema de Consolidación, Diagnóstico y Predicción de Mantenimiento Predictivo Eléctrico

Refinería Olmeca · PEMEX Transformación Industrial · Subgerencia de Confiabilidad del Mantenimiento

Complemento eléctrico de la PWA de recorridos SICM-INS (`recorridos-ebv-sicm`). Este repositorio contiene la **FASE 1** completa (extracción y normalización) y una aplicación web autocontenida (`app/sicm-ele.html`) que integra el diagnóstico basado en reglas normativas y la estimación de vida remanente por extrapolación lineal.

## Estructura

```
gifthub/
├── app/
│   ├── sicm-ele.template.html       Plantilla HTML+JS (sin datos)
│   └── sicm-ele.html                PWA lista para usar (1.5 MB, offline)
├── data/
│   ├── raw/
│   │   ├── xlsx/                    16 xlsx descargados de Drive
│   │   ├── text/                    5 archivos texto (auto-guardados por tamaño)
│   │   └── recorridos-ebv-sicm.html  copia de la PWA SICM-INS (referencia)
│   └── normalized/
│       ├── raw_dump/                dump JSON por archivo fuente
│       ├── equipos.json / .csv      censo maestro (8,738 activos)
│       ├── equipos.min.json         censo mínimo embebido en la PWA
│       ├── actividades.json / .csv  catálogo de 12 técnicas predictivas
│       ├── limites.json / .csv      ventanas operativas normativas
│       └── mediciones_template.json esquema vacío para nuevas mediciones
├── reports/
│   ├── fase1_extraction_summary.json
│   └── fase1_data_quality.md
├── scripts/
│   ├── inventory.json               inventario de fuentes en Drive
│   ├── extract_xlsx.py              lector openpyxl → JSON crudo
│   ├── normalize.py                 constructor EQUIPOS/ACTIVIDADES/LIMITES
│   ├── slim_equipos.py              censo mínimo para embed
│   └── build_app.py                 ensamblador de la PWA
└── README.md                        este archivo
```

## Uso rápido

### Usar la PWA
Abrir `app/sicm-ele.html` en cualquier navegador Chromium/WebKit/Firefox reciente. Todo el estado se guarda localmente en IndexedDB (`sicm_ele_idb`, key `sicm_ele_mediciones_v1`). No requiere Internet.

### Re-ejecutar la ingesta
```bash
pip install openpyxl
python3 scripts/extract_xlsx.py     # dump JSON de todos los xlsx
python3 scripts/normalize.py        # construye equipos/actividades/limites
python3 scripts/slim_equipos.py     # manifiesto compacto
python3 scripts/build_app.py        # rearma la PWA
```

## Alcance de la FASE 1

**Fuentes ingestadas (21/30 archivos):**

| Origen | Contenido | Estado |
|---|---|---|
| `VENTANAS OPERATIVAS/` | 10 xlsx normativos | 10/10 procesados |
| `FAMILIAS_SAP/` | 20 xlsx del maestro SAP | 11/20 procesados como xlsx (9 pendientes de re-descarga, ver `reports/fase1_data_quality.md`) |

**Salidas producidas:**

- **8,738 equipos únicos** clasificados por 8 familias (motor, arrancador, relevador, interruptor, tablero, transformador seco/aceite, CCM) y 8 sectores + área de talleres.
- **12 actividades predictivas** con norma y periodicidad.
- **32 límites/ventanas normativas** cubriendo termografía (NFPA 70B), vibración (ISO 20816-3, IEEE 841, NEMA MG-1 §7), temperatura de motores (Clase F/H), aislamiento (IEEE 43), desbalance (NEMA MG-1 §14.35/14.36), THD (IEEE 519), aceite dieléctrico (IEEE C57.106/ASTM), y DGA (IEEE C57.104).
- **Plantilla de mediciones** con esquema para I/V/T/R/IP/DAR/THD/vibración.
- **Reporte de calidad** con distribuciones y limitaciones honestas.

## Motor de diagnóstico (FASE 4, ya integrado en la PWA)

11 reglas codificadas explícitamente en `app/sicm-ele.template.html`, cada una con:
- Condición evaluable sobre la medición.
- Estado resultante (Normal / Alerta / Alarma).
- Modo de falla probable.
- Acción recomendada.
- **Norma citada** que sustenta el umbral.

Categorías cubiertas: termografía (NFPA 70B), temperatura devanado motor MT, IP (IEEE 43), desbalance de corriente y tensión (NEMA MG-1), vibración (ISO 20816-3), THD de corriente. Ampliable modificando `REGLAS` en la plantilla.

## Estimación de vida remanente (FASE 5)

Regresión lineal simple sobre cada parámetro con ≥3 mediciones históricas por equipo. Proyecta el número de días hasta cruzar el umbral normativo. **Se etiqueta explícitamente como "extrapolación de tendencia" — no ML.** La PWA lo indica al usuario en cada dictamen.

## Interoperabilidad con SICM-INS

La PWA `recorridos-ebv-sicm` (SICM-INS, ámbito instrumentos: EBV, SEC, MIT, SCD, ESD) exporta sus recorridos como JSON. `sicm-ele.html` puede importar esos exportes desde la pestaña **Datos y respaldo → Importar recorridos SICM-INS**, creando una entrada `INSP` (inspección) por cada recorrido.

## Marco normativo aplicado

Todas las bandas amarillo/rojo son trazables a fuente pública:

- **IEEE**: 43, 519, 841, C37.2, C57.104, C57.106, C57.152
- **ISO**: 14224, 17359, 20816-1/-3
- **NEMA**: MG-1 §7 (motores en vacío), §14.35 (desbalance corriente), §14.36 (tensión)
- **NFPA**: 70 (NEC), 70B (mantenimiento), 70E (seguridad)
- **ASTM**: D-877, D-971, D-974, D-1524, D-1816, D-2272, D-3612
- **NRF-PEMEX**: 011 (tierras), 048 (diseño eléctrico), 097 (SFI)
- **NOM**: NOM-001-SEDE, NOM-029-STPS

## Limitaciones honestas (declaradas también en la PWA)

1. `MEDICIONES` inicia vacía; la PWA es el punto de captura.
2. Con datos actuales, la vida remanente es **regresión lineal**, no ML. Para ML real: ≥30 mediciones por equipo con etiquetado de eventos.
3. El desbalance NEMA pierde significado a <20% de carga nominal.
4. IP/DAR requieren compensación por temperatura de prueba.
5. Umbrales DGA usan IEEE C57.104-2019 Tabla 3 concentraciones. Para dictamen formal considerar §5 (tasas de generación).

## Rama y estado

Trabajado en la rama `claude/sicm-mantenimiento-predictivo-syd9ui`.
