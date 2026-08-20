# FASE 3 — Tendencias, ventanas operativas y tasas de degradación

## Resumen ejecutivo

- **49 ventanas normativas** codificadas cubriendo motor/transformador aceite y seco/tablero/interruptor/arrancador/CCM/VFD/baterías/SFI/tierras/pararrayos/turbogenerador.
- **600 mediciones sintéticas** generadas para 100 equipos críticos (6 puntos históricos × 30 días de espaciado, seed=42 reproducible).
- **516 series (equipo × parámetro)** analizadas con regresión lineal simple.
- **32 series con hallazgo**: 10 en alarma, 22 en alerta.

## ⚠ Aviso metodológico

Los datos son **sintéticos** y sirven exclusivamente para demostrar el pipeline de Fase 3. Reemplace `mediciones_sinteticas.json` con datos reales de campo (mismo esquema) y re-corra `scripts/tendencias.py` para obtener tasas de degradación operativas.

## Ventanas operativas ampliadas (matriz parámetro × familia)

Fase 3 extiende las 32 bandas de Fase 1-2 a **48 bandas** por familia específica con norma sustentante explícita:

| Familia | # bandas | Parámetros cubiertos |
|---|---:|---|
| motor | 13 | IP, R_aislamiento_MOhm, carga_pct, desbalance_i_pct, desbalance_v_pct, temp_deva |
| transformador_aceite | 12 | DGA_C2H2_ppm, DGA_C2H4_ppm, DGA_CH4_ppm, DGA_CO_ppm, DGA_H2_ppm, acidez_D664_mgK |
| interruptor | 3 | delta_t_termografico_C, resistencia_contactos_uohm_pct_fabrica, temp_conexion_C |
| ccm | 3 | THD_I_pct, THD_V_pct, desbalance_i_pct |
| baterias | 3 | gravedad_especifica, impedancia_interna_pct_vs_referencia, voltaje_flotacion_por |
| universal | 3 | THD_V_pct_AT, THD_V_pct_BT, THD_V_pct_MT |
| transformador_seco | 2 | temp_devanado_C |
| tablero | 2 | delta_t_termografico_C, temp_conexion_C |
| ups_sfi | 2 | THD_V_salida_pct, autonomia_min |
| turbogenerador | 2 | cojinete_temp_C, temp_devanado_estator_C |
| arrancador | 1 | delta_t_termografico_C |
| vfd | 1 | THD_I_pct |
| sistema_tierra | 1 | resistencia_tierra_ohm |
| pararrayos | 1 | corriente_fuga_uA |

## Top 20 equipos por urgencia (dataset sintético)

| # | TAG | Familia | Sector | Parámetro | Valor actual | Pendiente/día | R² | Estado | Días a alarma |
|---:|---|---|---:|---|---:|---:|---:|:-:|---:|
| 1 | `MGB-71001` | motor | 5 | vibracion_rms_mms | 4.535 mm/s | 0.01307 | 0.91 | alarma | — |
| 2 | `XV-31967C` | motor | 2 | vibracion_rms_mms | 5.779 mm/s | 0.01293 | 0.938 | alarma | — |
| 3 | `MOV-10220` | motor | 8 | vibracion_rms_mms | 5.485 mm/s | 0.01462 | 0.91 | alarma | — |
| 4 | `TG_300_88BT-1` | motor | 8 | vibracion_rms_mms | 5.263 mm/s | 0.01342 | 0.79 | alarma | — |
| 5 | `XV-31908E` | motor | 2 | vibracion_rms_mms | 5.014 mm/s | 0.0118 | 0.709 | alarma | — |
| 6 | `GBM-79001` | motor | 5 | vibracion_rms_mms | 5.039 mm/s | 0.01348 | 0.845 | alarma | — |
| 7 | `M-GA-89025` | motor | 7 | vibracion_rms_mms | 5.655 mm/s | 0.01661 | 0.918 | alarma | — |
| 8 | `CCM-151-04 BUS A` | ccm | 2 | THD_I_pct | 15.806 % | 0.03245 | 0.596 | alarma | — |
| 9 | `MSPE-61002-BD01A` | motor | 5 | vibracion_rms_mms | 4.629 mm/s | 0.01109 | 0.762 | alarma | — |
| 10 | `MOV-40003` | motor | 4 | vibracion_rms_mms | 6.423 mm/s | 0.02141 | 0.954 | alarma | — |
| 11 | `CCM-09-03 BUS B` | ccm | 6 | THD_I_pct | 14.485 % | 0.03988 | 0.893 | normal | 13 |
| 12 | `CCM-151-04 BUS A` | ccm | 2 | THD_V_pct | 7.629 % | 0.02019 | 0.9 | normal | 18 |
| 13 | `XV-22962` | motor | 3 | vibracion_rms_mms | 4.03 mm/s | 0.00924 | 0.634 | normal | 51 |
| 14 | `SPE-21012-BV03 D` | arrancador | 3 | delta_t_c | 11.532 °C | 0.0511 | 0.898 | normal | 68 |
| 15 | `CCM-09-03 BUS B` | ccm | 6 | THD_V_pct | 6.271 % | 0.02125 | 0.761 | normal | 81 |
| 16 | `TG_300_88BT-1` | motor | 8 | IP | 1.976 — | -0.0107 | 0.989 | alerta | 91 |
| 17 | `GBM-79001` | motor | 5 | IP | 1.766 — | -0.00813 | 0.9 | alerta | 94 |
| 18 | `XV-31904D` | motor | 2 | IP | 1.875 — | -0.00913 | 0.932 | alerta | 96 |
| 19 | `XV-31908E` | motor | 2 | IP | 1.931 — | -0.0083 | 0.84 | alerta | 112 |
| 20 | `IE-02 ACOM TDBT-18-1-03 B` | interruptor | 8 | delta_t_c | 11.412 °C | 0.03033 | 0.74 | normal | 118 |

## Distribución de hallazgos por parámetro

| Parámetro | Ocurrencias |
|---|---:|
| IP | 11 |
| R_aislamiento_MOhm | 11 |
| vibracion_rms_mms | 9 |
| THD_I_pct | 1 |

## Distribución de hallazgos por familia

| Familia | Ocurrencias |
|---|---:|
| motor | 31 |
| ccm | 1 |

## Metodología

### Regresión lineal simple
Para cada serie temporal `(t, y)` con `n≥3`:

```
slope = Σ(x-x̄)(y-ȳ) / Σ(x-x̄)²      (pendiente por día)
intercept = ȳ - slope·x̄
R² = 1 - SSR/SST
```

### Días al umbral (extrapolación)
```
días_a_alarma = (umbral_rojo - valor_actual) / slope    (sentido "above")
días_a_alarma = (valor_actual - umbral_rojo) / |slope|  (sentido "below": IP, R aisl., rigidez, tensión interf.)
```

### Confianza de la proyección
- **R² > 0.8**: alta (tendencia clara)
- **R² 0.5-0.8**: media (usar como indicador, no acción)
- **R² < 0.5**: baja (ruido domina)

## Gráficas en la PWA (pestaña Tendencias)

1. **Tendencia temporal con bandas normativas** — SVG con banda verde/amarilla/roja sombreadas + línea de regresión
2. **Comparativa de corriente por fase** — barras F1/F2/F3 + línea de promedio y corriente nominal + badge de desbalance NEMA
3. **Gráfica de control** — línea central (media), UCL (µ+3σ), líneas de alerta/alarma; puntos coloreados por zona
4. **Dispersión I vs T** — correlación mecánico-eléctrica coloreada por familia con leyenda
5. **Mapa de calor sector × familia** — condición agregada con gradiente de intensidad
6. **Pareto de hallazgos** — barras horizontales ordenadas + ranking urgencia
7. **Ranking urgencia top 20** — recalculado en vivo desde `MEDICIONES` con estado y días al umbral

## Cómo cargar datos reales

```bash
# 1. Sustituya mediciones_sinteticas.json con datos reales (mismo esquema)
# 2. Regenere tendencias:
python3 scripts/tendencias.py
# 3. Reconstruya la PWA embebiendo el nuevo dataset:
python3 scripts/build_app.py
```

El esquema exigido por parámetro/medición se documenta en `data/normalized/mediciones_template.json`.