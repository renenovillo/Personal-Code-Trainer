# Personal Code Trainer

Práctica deliberada de **SQL** y **Python**, directo en el navegador — sin instalar nada, sin backend, sin costo. ~50 ejercicios por lenguaje, organizados por tema y nivel de dificultad, con un compilador integrado, pistas progresivas y gamificación para sostener la constancia.

🔗 **Demo en vivo:** https://renenovillo.github.io/Personal-Code-Trainer/

## Qué incluye

- **Compilador en el navegador** — Python vía [Pyodide](https://pyodide.org/) (WebAssembly) y SQL vía [sql.js](https://sql.js.org/) (SQLite compilado a WASM). Todo corre en tu máquina; ningún código se envía a un servidor.
- **~50 ejercicios por lenguaje**, agrupados por tema (no solo por dificultad): filtrado, agregaciones, JOINs, subconsultas, DML, y en el nivel avanzado — modelado de datos, integridad referencial, CTEs, window functions, complejidad algorítmica, generadores, recursión.
- **Botones separados "Ejecutar" y "Validar"** — explora y depura libremente sin que cada intento cuente como error; valida solo cuando estés listo (patrón Run/Submit de LeetCode).
- **Pistas en 3 fases + solución**, sin costo de XP — para que pedir ayuda nunca se sienta como perder.
- **Explorador de contexto automático** — muestra el esquema de tablas (SQL) o las variables disponibles (Python) sin que tengas que memorizarlas.
- **Gamificación**: XP, racha diaria, niveles, insignias y un dashboard con historial de 14 días.
- **Contenido modular y extensible** — el esquema JSON que define lenguajes/ejercicios está documentado dentro de la propia app (menú `⋯` → "Esquema de contenido"), pensado para que cualquier IA genere o amplíe contenido nuevo sin tocar el resto del código.
- **Progreso persistente en tu navegador** (localStorage) — nadie más ve tus datos; no hay cuenta ni servidor.

## Stack técnico

- [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/)
- [Pyodide 0.23.4](https://pyodide.org/) (runner de Python)
- [sql.js 1.8.0](https://sql.js.org/) (runner de SQL, SQLite sobre WebAssembly)
- Despliegue automático a **GitHub Pages** vía GitHub Actions

## Desarrollo local

Requiere [Node.js](https://nodejs.org/) 18+.

```bash
npm install
npm run dev       # http://localhost:5173
```

```bash
npm run build     # genera dist/ listo para producción
npm run preview   # sirve dist/ localmente para probarlo
```

## Despliegue

Cada `push` a `main` dispara el workflow `.github/workflows/deploy.yml`, que compila la app y la publica en GitHub Pages automáticamente. No hay pasos manuales.

Si cambias el nombre del repositorio, actualiza la propiedad `base` en `vite.config.js` para que coincida (debe ser `/nombre-del-repo/`).

## Agregar o ampliar contenido

Todo el contenido vive en el objeto `CONTENT.languages` dentro de `src/App.jsx`. La app trae su propia documentación del esquema (pestaña **Esquema de contenido**, en el menú `⋯`), pensada para que cualquier IA —o tú mismo— pueda generar nuevos ejercicios, lecciones o incluso lenguajes completos con solo seguir esa estructura. No se requiere tocar la lógica de la UI, el compilador, el sistema de XP ni el dashboard: todo se adapta automáticamente al contenido declarado.

## Licencia

Proyecto personal de aprendizaje. Sin licencia formal por ahora.
