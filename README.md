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

## FASE 2 — Consolidación e indicadores (entregado)

Con la base normalizada de la Fase 1, se agregan **indicadores consolidados de censo + KPI engine dinámico** sobre las mediciones. Salidas nuevas:

- `data/normalized/equipos_nameplate.json` — censo con **nameplate por familia** (V, I, HP, kVA, clase de aislamiento, RPM, etc.). Corrige inconsistencias de unidad de SAP con el cálculo eléctrico √3·V·I cuando ambos datos están disponibles.
- `data/normalized/kpis_por_sector.{json,csv}` — totales, criticidad, distribución BT/MT/AT, HP y MVA instalados.
- `data/normalized/kpis_por_familia.{json,csv}` — mismos KPIs por familia.
- `data/normalized/ranking_criticidad.{json,csv}` — top 100 por score = `criticidad_ABC × nivel_tension × log10(potencia+1)`.
- `data/normalized/matriz_sector_familia.json` — matriz numérica para heatmap.
- `reports/fase2_kpis.md` — reporte narrativo con tablas y sección de calidad de datos SAP.

**Nueva pestaña "Consolidado (Fase 2)" en la PWA** con:
- Tablas de KPIs por sector y familia.
- Ranking Top 20 activos.
- Matriz sector × familia como heatmap.
- Distribución de condición operativa por parámetro (Normal/Alerta/Alarma/sin dato) que se **actualiza en vivo** conforme se ingesten mediciones.

**Módulo KPI engine** (`KPI_EVAL` en `app/sicm-ele.template.html`): funciones evaluadoras por parámetro que aplican las ventanas normativas de la Fase 1 y devuelven `{estado, ref}`. Cubre: desbalance I/V, IP, THD V/I, ΔT termográfico, temperatura, vibración y **carga vs nominal** (usando nameplate).

## Total refinería (nameplate consolidado)

- **10,930 equipos** censados en **14 familias** × 8 sectores + área de talleres.
- **34 subestaciones** derivadas del campo `Ubicac.técnica` (SEP01/SEP02 principales; SE-001 a SE-033; SE-ANR arranque negro).
- **~3,112 MVA** de transformación instalada (excluye 2 outliers SAP > 250 MVA).
- **447 MW (599,561 HP)** potencia motriz instalada.
- Detalle en `reports/fase2_kpis.md`.

## Ampliación posterior a la primera entrega (Fase 2+)

**Subestaciones agregadas al censo** — 34 subestaciones se extraen del patrón de `ubicacion` (`DBP-<sector><area>-<S_XXX|SEP0X>-…`) y se agregan como una nueva familia `subestacion` con:
- Criticidad ABC = A por defecto (todo el sector eléctrico depende de ellas).
- Conteo de equipos asociados (SEP01 = 546 equipos; SEP02 = 305; SE-015 = 252; …).
- Ubicación base para navegación jerárquica.
- Salidas dedicadas: `data/normalized/subestaciones.{json,csv}`.

**Catálogo de ACTIVIDADES expandido a las 16 técnicas SICM** operadas en la Refinería Olmeca (más 1 auxiliar):
1. Inspección preventiva a subestaciones (estado aparente) — NRF-048/NFPA 70B
2. Inspección de transformadores en aceite — IEEE C57.152
3. Temperatura en transformadores secos (termografía) — IEEE C57.12
4. Temperatura en tableros eléctricos (termografía) — ANSI C37.20/NFPA 70B
5. Temperatura en interruptores de alta tensión (termografía) — ANSI C37.20
6. Termografía a arrancadores — NFPA 70B/NETA MTS
7. Vibraciones de motores eléctricos — ISO 20816-3/IEEE 841/NEMA MG-1
8. Monitoreo de motores con VFD — IEEE 1415/NEMA MG-1 §30
9. Desbalance CCM 480 V — NEMA MG-1 §14.35/§14.36/IEEE 519
10. Ultrasonido acústico de condición — ISO 17359/ISO 29821-1
11. Rigidez dieléctrica de aceite (D-1816) — ASTM D-1816/IEEE C57.106
12. Transformadores de desaladora (monitoreo específico) — IEEE C57.106
13. Cargador y banco de baterías (celda por celda) — IEEE 450/1188; NRF-097
14. Sistema de fuerza ininterrumpida (SFI/UPS) — IEEE 946/IEC 62040; NRF-097
15. Relevadores de protección (ajustes) — IEEE C37.90/C37.2
16. Estado aparente torres de enfriamiento — CTI Institute/ISO 20816-3
17. Estado aparente de soloaires — ISO 20816-3 A2 GP2

**Familias del censo expandidas de 8 a 14**: se agregaron `alumbrado` (413), `baterias` (212), `circuito_potencia` (994), `pararrayos` (208), `sistema_tierra` (331), y `subestacion` (34).

**Pendiente (bajo esfuerzo)**: 6 familias adicionales de SAP —`turbogenerador` (4 equipos, ya en placa: 4 TG de 112 MVA c/u), `vfd` (~40 variadores), `hvac` (~100 unidades), `neutro_tierra` (~80 resistencias), `trazas_electricas` (~50 sistemas), `banco_capacitores` (~50 bancos). Sus xlsx fueron descargados pero llegaron en línea y no persistieron en esta sesión; con `read_file_content` o descarga a `data/raw/xlsx/` y re-corrida de `scripts/extract_xlsx.py` se ingestan.

## FASE 3 — Tendencias, ventanas operativas y tasas de degradación (entregado)

**Ventanas operativas expandidas** a 48 bandas por familia específica con norma explícita (`data/normalized/ventanas_operativas.json`). Cada banda contiene `verde_max / amarillo_max / rojo_min / unidad / norma / sentido`. Cubre motor (MT/BT, clase F/H, vibración GP1/GP2), transformador (aceite/seco, temperatura, aceite dieléctrico, DGA H2/CH4/C2H2/C2H4/CO), tableros, interruptores, arrancadores, CCM, VFD, baterías, SFI/UPS, sistema de tierras, pararrayos y turbogenerador.

**Motor de tendencias** (`scripts/tendencias.py`) — para cada serie `(tag, parametro)` con ≥3 puntos:
- Regresión lineal: pendiente por día, R², n.
- Estado actual contra ventana normativa.
- Días al umbral amarillo/rojo por extrapolación.
- Ranking por urgencia (equipos en alarma primero, luego por días al umbral).

**Dataset sintético para demostrar el pipeline** (`scripts/gen_synthetic.py` → `data/normalized/mediciones_sinteticas.json`): 600 mediciones sobre 100 equipos críticos con 6 puntos históricos cada uno, 30 días de espaciado, seed reproducible. Etiquetadas explícitamente como sintéticas — sustituir por datos reales cuando se disponga.

**Nueva pestaña "Tendencias (Fase 3)" en la PWA** con los 6 tipos de gráficas exigidos + un extra:
1. **Tendencia temporal con bandas normativas** — SVG con banda verde/amarilla/roja sombreadas + línea de regresión
2. **Comparativa de corriente por fase** — barras F1/F2/F3 + promedio + I_nom con badge de desbalance NEMA
3. **Gráfica de control** — CL / UCL(µ+3σ) / líneas de alerta/alarma, puntos coloreados por zona
4. **Dispersión I vs T** — correlación mecánico-eléctrica coloreada por familia
5. **Mapa de calor sector × familia** — condición agregada con gradiente
6. **Pareto de hallazgos** — modos más frecuentes con barras
7. **Ranking urgencia (top 20)** — recalculado en vivo desde `MEDICIONES` con pendiente y días al umbral

Botón *"Cargar dataset sintético"* pobla la PWA con las 600 mediciones para explorar todas las gráficas sin datos reales.

**Salidas del pipeline Fase 3**:
- `data/normalized/tendencias.json` — 516 series analizadas con regresión completa
- `data/normalized/tasa_degradacion.csv` — export ordenado por urgencia
- `data/normalized/pareto_hallazgos.json` — conteo de modos por parámetro y familia
- `reports/fase3_tendencias.md` — reporte narrativo con top-20, metodología, aviso de honestidad

## FASE 4 — Motor de diagnóstico basado en reglas normativas (entregado)

Refactor del motor embebido de Fase 1 (11 reglas hardcodeadas) a un catálogo completo con arquitectura RCM + FMEA/FMECA:

**Catálogo de reglas** (`data/normalized/reglas_diagnostico.json`) — **36 reglas** en DSL JSON con operadores lógicos compuestos (and/or/not) y comparadores (gt/gte/lt/lte/eq/between/isnull). Cada regla incluye: `familia`, `descripción`, `condición`, `estado`, `modo_falla`, `causa_probable`, `mecanismo_físico`, `acción`, `prioridad` (rutina/programar/próximo_paro/inmediata) y `norma`. Cubre motor, transformador aceite/seco, tablero, interruptor, arrancador, CCM, VFD, baterías, SFI, tierras, pararrayos y turbogenerador. Incluye reglas compuestas ejemplares:
- `R-MOT-005` desbalance I >10% con V balanceado → falla interna estator (no alimentador)
- `R-MOT-011` MCSA sidebands ±2·s·f + vibración → barras rotas confirmadas
- `R-COMP-001` alta vibración + alta T rodamiento → falla incipiente confirmada por dos técnicas
- `R-COMP-003` DGA C2H4 + CH4 altos → Duval T3 sobrecalentamiento >700°C

**Matriz FMEA/FMECA formal** (`data/normalized/fmea.json`) — **20 modos de falla** con Severidad · Ocurrencia · Detectabilidad (escalas 1-10) y Risk Priority Number (RPN = S×O×D). Incluye referencias cruzadas a las reglas que detectan cada modo, causa, efecto, mecanismo, controles preventivos y norma base. Top 3 por RPN:
1. `FM-TRA-04` OLTC transformador · RPN 216 (S9·O4·D6)
2. `FM-SFI-01` autonomía SFI degradada · RPN 180 (S9·O5·D4)
3. `FM-MOT-04` cortocircuito espiras estator · RPN 180 (S10·O3·D6)

**Catálogo de acciones RCM** (`data/normalized/acciones_rcm.json`) — **25 acciones** clasificadas como Preventivas (P), Predictivas de condición (D), Correctivas (C) o Rediseño (R), con frecuencia, duración estimada, recursos requeridos y detalle técnico ejecutable en campo.

**Motor Python canónico** (`scripts/diagnostico.py`) con función `diagnosticar(medicion, equipo, catalogo)` que devuelve `{estado, hallazgos:[…], derivadas}`. Ejecutable en batch para reportes. El motor JS de la PWA implementa el **mismo DSL** garantizando equivalencia funcional.

**PWA pestaña Diagnóstico ampliada** — 4 tarjetas:
1. Motor de diagnóstico con selector de medición y filtro por prioridad + botón "Diagnosticar TODAS" con top-25 modos y agregado por estado
2. Catálogo de 36 reglas navegable (filtrable por familia y búsqueda por texto)
3. Matriz FMEA completa ordenada por RPN con codificación de color por severidad
4. Catálogo de 25 acciones RCM con badges por tipo

Al aplicar el motor a las 600 mediciones sintéticas: 439 normales, 161 en alerta (dominadas por `R-TAB-002` calentamiento moderado y `R-MOT-010` vibración zona B — coherente con los perfiles de degradación normal + 15% bad actors).

## Rama y estado

Trabajado en la rama `claude/sicm-mantenimiento-predictivo-syd9ui`. Fases 1, 2, extensión (subestaciones + 16 actividades), Fase 3 y Fase 4 entregadas.

---

## Dashboard térmico de activos críticos (`app/sicm-termico.html`)

Archivo **único y autocontenido** (2 MB; sin CDN ni peticiones de red, CSP `connect-src 'none'`; lector PDF `pdf.js` 3.11 incrustado) para monitoreo de salud, confiabilidad y análisis predictivo de **transformadores, tableros y motores/arrancadores**: semáforo de criticidad, tendencias con zoom y dT/dt, correlación T–carga–ambiente, bitácora de inspecciones con ΔT (NETA MTS 100.18) y galería, y Weibull (β, η, F(t), R(t), h(t), RUL).

**Base real incluida:** 94 reportes PDF de termografía (Drive «json de temperatura 08102026», 20-jul → 8-oct-2026) → 1,118 activos, ~9,800 lecturas válidas y 1,214 inspecciones. Se omiten lecturas imposibles (<12 °C o >250/300 °C) por error de captura del reporte; las >150 °C en conexiones se marcan «verificar lectura». La mayoría de los equipos tiene **una sola visita**: las tendencias aparecen conforme se agregan datos.

**Actualizar la base día a día** (pestaña «Datos y carga»):
- Arrastrar **PDF** de termografía (tableros ANSI C37.20, transformadores secos NMX-J-351, arrancadores POE-009) o **JSON** → vista previa con «equipos / total del resumen», lecturas nuevas y duplicadas → «Agregar a la base». Re-subir un reporte no duplica datos (llave TAG + fecha + punto).
- **Captura diaria manual** por activo (o activo nuevo) con T ambiente, corriente, temperaturas por punto y observaciones; clasifica severidad y crea la inspección.
- Persistencia en IndexedDB **de ese navegador/equipo**: usar «Exportar base» periódicamente como respaldo o para pasarla a otro equipo.

**Regenerar:** `python3 scripts/build_termico_real.py <dir con TBL_*.jsonl TRAN_*.jsonl TMO_*.jsonl>` → `data/termico/seed_real.json`; luego `python3 scripts/build_termico.py` (plantilla `app/sicm-termico.template.html` + `vendor/pdfjs`). Los datos de `data/termico/demo_simulado_*.json` son **simulados** (monitoreo continuo) y sirven solo para probar la carga de JSON y las gráficas de dT/dt. Las poblaciones Weibull incluidas también son simuladas.
