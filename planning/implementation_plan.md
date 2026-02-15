# Criptopilot: Plan de Producción (Fases Finales)

Este plan cierra las brechas de seguridad y optimización para operar con capital real de forma desatendida, utilizando exclusivamente algoritmos locales deterministas.

---

## 🚩 Brechas Pendientes para Producción

1. **Protocolo de Datos (CRÍTICO):** El polling de 5s causa un retraso que puede arruinar un trade de Scalping. **Debemos usar WebSockets**.
2. **Resiliencia:** Manejo de desconexiones del socket y reconexión automática.
3. **Validación Algorítmica:** Terminar de mover el 100% de la lógica pesada al script Python local.

---

## 🕒 Análisis de Frecuencia de Señales

Basado en la configuración actual del sistema, los tiempos de detección y ejecución son:

| Modo         | Frecuencia Estimada        | Requisitos Clave                          | Perfil                                     |
| :----------- | :------------------------- | :---------------------------------------- | :----------------------------------------- |
| **Scalping** | Alta (Varias por hora/día) | 1 Condición + Tendencia (SMA50)           | Busca micro-movimientos constantes.        |
| **Sniper**   | Baja (Muy selectiva)       | 2+ Condiciones + Spike de Volumen (>1.5x) | Busca movimientos institucionales fuertes. |

> [!NOTE]
> Actualmente el bot hace "polling" cada **5 segundos**, pero los datos reales de velas se refrescan cada **30 segundos**. La señal real se genera al cierre/actualización de la vela según el timeframe seleccionado.

---

## 🐍 Integración Local con Python (Alto Rendimiento)

Para mejorar la precisión sin dependencias externas, el bot utilizará Python **local directamente en el servidor**:

1. **Python Bridge (Procesamiento Batch):** Uso de `child_process.spawn` para ejecutar scripts de Python que analicen patrones históricos complejos con `Pandas-TA`.
2. **IPC Local (Tiempo Real):** Implementación de un pequeño servidor de Python (Script paralelo) que Node.js consulta mediante sockets locales para validación de señales en <10ms.
3. **Entorno Aislado:** Instalación de un `venv` en la raíz del proyecto para gestionar `scikit-learn` y `pandas` sin contaminar el sistema.

---

## 🚩 Brechas Identificadas (Gaps)

1. **Arquitectura de Ejecución:** El bot debe migrarse a un proceso de fondo (_Background Worker_) en el servidor para garantizar disponibilidad 24/7.
2. **Seguridad de API:** Los endpoints de `/api/binance` no tienen protección de autenticación/sesión, permitiendo ejecuciones externas si no se protegen.
3. **Persistencia de Estado:** Las posiciones abiertas reales deben persistir en MongoDB para recuperarse ante reinicios del servidor.
4. **Observabilidad:** Falta de logs centralizados y alertas (Sentry/Winston) para monitorear errores en tiempo real en producción.
5. **Validación y Pruebas:** Los cálculos de indicadores y estrategias no tienen pruebas unitarias automáticas, lo que aumenta el riesgo de errores matemáticos fatales.

---

## 🎟️ Planning: Tickets de Ejecución

### Fase 1: Estabilidad y Persistencia (Prioridad Alta)

#### [CP-001] Migración del Bot a Background Worker

- **Descripción:** Mover la lógica de `useTradingBot.ts` a un servicio en el servidor (ej. usando un Worker de Node o un proceso independiente).
- **Criterio de Aceptación:** El bot debe seguir operando aunque el frontend esté cerrado.

#### [CP-002] Persistencia de Posiciones Reales

- **Descripción:** Implementar una colección `active_positions` en MongoDB para guardar trades reales abiertos.
- **Criterio de Aceptación:** Al reiniciar el bot, este debe retomar las posiciones abiertas desde la DB y re-aplicar la lógica de monitoreo.

---

### Fase 2: Seguridad y Protección (Prioridad Alta)

#### [CP-003] Protección de API Routes (Validación Local)

- **Descripción:** Implementar un middleware de Next.js que valide un **Token JWT local** o una **API Key estática** definida en el `.env` para asegurar que el bot no responda a peticiones externas no autorizadas.
- **Criterio de Aceptación:** Cualquier petición a `/api/binance/*` sin el header `Authorization` correcto debe ser rechazada con un 401.

#### [CP-004] Endurecimiento de Validación de Datos (Zod)

- **Descripción:** Reforzar las validaciones en los endpoints con `zod` para prevenir payloads malformados o ataques de inyección.
- **Criterio de Aceptación:** Todas las entradas de API deben ser validadas estrictamente.

---

### Fase 3: Observabilidad y Pruebas (Prioridad Media)

#### [CP-005] Sistema de Logs y Alertas Proactivas

- **Descripción:** Integrar Winston para logs persistentes y Sentry para captura de excepciones. Implementar alertas (ej. vía Telegram o Slack) para errores de ejecución críticos.
- **Criterio de Aceptación:** Logs legibles en consola/archivo y notificaciones automáticas ante fallos de API.

#### [CP-006] Implementación de Unit Testing para Estrategias

- **Descripción:** Configurar Jest y escribir pruebas para `src/lib/indicators.ts` y `src/lib/strategies/tradingStrategy.ts`.
- **Criterio de Aceptación:** Cobertura de tests en las funciones matemáticas críticas.

---

### Fase 4: Optimización y Limpieza (Prioridad Baja)

#### [CP-007] Consolidación de Dependencias de Binance

- **Descripción:** Evaluar y eliminar la redundancia entre `ccxt`, `@binance/connector` y `node-binance-api`. Priorizar `ccxt` por su robustez.
- **Criterio de Aceptación:** Reducción del tamaño del `node_modules` y unificación del cliente.

#### [CP-008] Optimización de Gráficos en Mobile

- **Descripción:** Mejorar el rendimiento de `lightweight-charts` y ApexCharts en dispositivos móviles.
- **Criterio de Aceptación:** UX fluida en dispositivos con recursos limitados.

---

---

## 🐍 Sección 4: Optimización Algorítmica Local (Python)

Para mejorar la precisión matemática sin depender de servicios externos:

- **CP-009: Puente de Comunicación Node-Python:** Ejecución directa de scripts `.py` para procesamiento de indicadores complejos.
- **CP-010: Motor Algorítmico Pandas-TA:** Sustitución de lógica JS por cálculos vectorizados en Python para evitar errores de redondeo y latencia en indicadores como ADX y ATR.
- **Validación Determinista:** Uso de Python para validar que las señales de Scalping/Sniper cumplen con el rigor matemático antes de ejecutar la orden. No se utiliza IA ni modelos probabilísticos; solo matemáticas puras.

---

## Plan de Verificación Sugerido

### Automatizado

- Ejecutar `npm run typecheck` y `npm run lint` de forma obligatoria en CI.
- Implementar un flujo de GitHub Actions para correr los nuevos tests de Jest.

### Manual

- **Prueba de "Cerrar Tab":** Verificar que el bot sigue operando en el log del servidor tras cerrar el navegador.
- **Prueba de Autenticación:** Intentar acceder a `/api/binance/trade` con una herramienta externa (como Postman) sin token y verificar el bloqueo.
