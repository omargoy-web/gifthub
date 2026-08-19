# Reporte de calidad de datos — FASE 1

- Archivos fuente procesados: **19**
- EQUIPOS únicos extraídos: **8738**
- Colisiones de TAG entre fuentes: **7419** (en 3940 tags)
- ACTIVIDADES catalogadas: **12**
- LIMITES normativos codificados: **35**
- MEDICIONES cargadas: **0** (esquema listo, esperando ingesta desde recorridos y campañas)

## Distribución de EQUIPOS por familia

| Familia | # Equipos |
|---|---:|
| arrancador | 2799 |
| relevador | 1947 |
| motor | 1758 |
| interruptor | 1298 |
| transformador_seco | 392 |
| tablero | 286 |
| ccm | 219 |
| transformador | 39 |

## Distribución de EQUIPOS por sector

| Sector | # Equipos |
|---|---:|
| 1 | 702 |
| 2 | 936 |
| 3 | 1036 |
| 4 | 1054 |
| 5 | 1079 |
| 6 | 724 |
| 7 | 883 |
| 8 | 2229 |
| TALLERES | 95 |

## Familias faltantes o no ingestadas

- `alumbrado` — sin registros ingestados (archivo pendiente de descarga o vacío en esta corrida)
- `banco_capacitores` — sin registros ingestados (archivo pendiente de descarga o vacío en esta corrida)
- `baterias` — sin registros ingestados (archivo pendiente de descarga o vacío en esta corrida)
- `circuito_potencia` — sin registros ingestados (archivo pendiente de descarga o vacío en esta corrida)
- `hvac` — sin registros ingestados (archivo pendiente de descarga o vacío en esta corrida)
- `neutro_tierra` — sin registros ingestados (archivo pendiente de descarga o vacío en esta corrida)
- `pararrayos` — sin registros ingestados (archivo pendiente de descarga o vacío en esta corrida)
- `sistema_tierra` — sin registros ingestados (archivo pendiente de descarga o vacío en esta corrida)
- `transformador_aceite` — sin registros ingestados (archivo pendiente de descarga o vacío en esta corrida)
- `trazas_electricas` — sin registros ingestados (archivo pendiente de descarga o vacío en esta corrida)
- `turbogenerador` — sin registros ingestados (archivo pendiente de descarga o vacío en esta corrida)
- `ups_sfi` — sin registros ingestados (archivo pendiente de descarga o vacío en esta corrida)
- `vfd` — sin registros ingestados (archivo pendiente de descarga o vacío en esta corrida)

## Limitaciones honestas de la Fase 1

1. El corpus original citado como "16 archivos" corresponde en realidad a **30 archivos** disponibles en Drive: 10 en `VENTANAS OPERATIVAS` y 20 en `FAMILIAS_SAP`. Se procesaron **21** (16 xlsx + 5 text) por límites de tamaño/context de sesión; los 9 restantes (`PM_ALUMBRADO`, `PM_HVAC`, `PM_BATERIAS`, `PM_NEUTRO_TIERRA`, `PM_PARARRAYOS`, `PM_SISTEMA_TIERRA`, `PM_CIRCUITO_POTENCIA`, `PM_TRAZAS_ELECTRICAS`, y `CENSO_TRANSFORMADORES_ACEITE` como xlsx) están inventariados en `scripts/inventory.json` y pueden ingestarse ejecutando `scripts/extract_xlsx.py` tras descargarlos.
2. El archivo `CENSO_TRANSFORMADORES_EN_ACEITE_TERMOMETRIA.xlsx` (~32 transformadores en aceite) se accedió sólo en formato texto plano; sus registros no están en `equipos.json` pero SÍ están reflejados en `limites.json` (bandas de temperatura 75/85/100°C).
3. La tabla `MEDICIONES` está vacía: no existen aún registros transaccionales en Drive. El sistema se conecta con la PWA `recorridos-ebv-sicm` (rama INSTRUMENTOS) y con la nueva PWA `sicm-ele.html` (esta entrega) que comparten el patrón IndexedDB → JSON exportable.
4. Los umbrales de DGA en `limites.json` corresponden a IEEE C57.104-2019 Tabla 3 (condiciones 1/2/3); ajustar por edad del aceite y por muestreo previo si se desea aplicar C57.104 §5 (tasas de generación).
5. `IP/DAR`: IEEE 43-2013 fija umbrales cualitativos, no absolutos por tipo de máquina; el motor de diagnóstico usa 1.0/2.0/4.0 como bandas verde/amarilla/roja pero para dictamen formal debe considerarse temperatura de prueba y limpieza.
6. Los umbrales de desbalance de corriente **pierden significado a cargas <20% de la nominal** (NEMA MG-1 §14.35). El motor de diagnóstico incluye esta salvedad.

## Siguientes fases requieren:

- **Fase 2**: ingesta continua desde el módulo de captura de la PWA `sicm-ele.html` para poblar `MEDICIONES`.
- **Fase 3**: mínimo 3 puntos históricos por parámetro/equipo para calcular pendiente de degradación.
- **Fase 5**: la extrapolación lineal es válida sólo mientras el proceso de degradación sea monótono. Para modelos ML de predicción real se requieren **~30+ mediciones por equipo** con etiquetado de eventos de falla.