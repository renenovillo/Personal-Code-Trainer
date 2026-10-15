import React, { useState, useEffect, useCallback, useMemo } from "react";

/* ============================================================
   CODEGYM v3 · Práctica deliberada de SQL y Python
   Estructura: Lenguaje → Nivel → Módulo (tema) → Lección → Ejercicios
   ~50 ejercicios por lenguaje. Pistas en 3 fases + solución.
   ============================================================ */

// ---------- ESQUEMA DE CONTENIDO (módulo dinámico) ----------
const SCHEMA_SPEC = `{
  "id": "string único (ej: 'sql', 'python', 'r')",
  "name": "Nombre visible",
  "runner": "sql | python | none",
  "color": "#hex",
  "cheatsheet": [ { "title": "Sección", "items": [["sintaxis", "descripción"], ...] } ],
  "modules": [
    {
      "id": "string único", "level": "basico | intermedio | avanzado",
      "title": "Tema del módulo",
      "lessons": [
        {
          "id": "string único", "title": "Micro-lección (5-10 min)",
          "theory": ["máx 5 bullets, 1 idea por bullet"],
          "exercises": [
            { "id": "único", "prompt": "instrucción corta",
              "starter": "código inicial", "setup": "(SQL) DDL/INSERT",
              "solution": "código solución", "check": "stdout | sqlresult",
              "hints": ["fase 1: enfoque", "fase 2: estructura", "fase 3: casi la respuesta"],
              "xp": 20 } ],
          "caseStudy": { "id", "title", "context": "escenario de negocio",
            "prompt", "starter", "setup", "solution", "check", "hints", "xp": 50 }
        } ] } ] }
REGLAS PARA LA IA GENERADORA:
1. Teoría en bullets, nunca párrafos. Práctica = 80% del tiempo.
2. Cada ejercicio resoluble en 2-5 min (microlearning).
3. NIVEL AVANZADO = conceptos profundos (llaves, integridad, normalización,
   índices, NULL semantics, complejidad, generadores, mutabilidad, recursión,
   patrones de datos) resueltos con código FÁCIL o INTERMEDIO.
4. hints SIEMPRE en 3 fases; la solución completa es la fase 4 (sin costo XP).
5. check="stdout" compara salida impresa vs solution; check="sqlresult"
   compara el resultado de la consulta vs solution (pide ORDER BY explícito).
6. Casos de estudio con contexto de negocio realista (LatAm bienvenido).
7. El explorador de esquema se genera solo: SQL desde "setup", Python desde
   las variables del "starter".`;

// ---------- CHEAT SHEETS ----------
const CHEATSHEETS = {
  sql: [
    { title: "Consultar", items: [["SELECT col1, col2 FROM t", "elegir columnas"], ["SELECT DISTINCT col", "valores únicos"], ["WHERE cond", "filtrar filas"], ["ORDER BY col DESC", "ordenar"], ["LIMIT n", "recortar filas"]] },
    { title: "Condiciones", items: [["=, <>, >, <, >=, <=", "comparación"], ["AND / OR / NOT", "combinar"], ["LIKE '%texto%'", "patrón"], ["IN (a, b, c)", "lista de valores"], ["BETWEEN x AND y", "rango"], ["IS NULL / IS NOT NULL", "nulos"]] },
    { title: "Agregación", items: [["COUNT(*), SUM(c), AVG(c)", "resumen"], ["MIN(c), MAX(c)", "extremos"], ["GROUP BY col", "agrupar"], ["HAVING cond", "filtrar grupos"], ["ROUND(x, 2)", "redondear"], ["AS alias", "renombrar"]] },
    { title: "JOINs", items: [["INNER JOIN t ON a.id=b.id", "solo coincidencias"], ["LEFT JOIN t ON ...", "todo lo izq + NULL"], ["a LEFT JOIN b ... WHERE b.id IS NULL", "huérfanos"]] },
    { title: "Lógica", items: [["CASE WHEN cond THEN x ELSE y END", "condicional"], ["COALESCE(a, b)", "primer no-nulo"], ["subconsulta: (SELECT ...)", "consulta anidada"]] },
    { title: "Avanzado", items: [["WITH cte AS (...)", "consulta temporal"], ["ROW_NUMBER() OVER (ORDER BY c)", "numerar filas"], ["SUM(c) OVER (ORDER BY f)", "acumulado"], ["PARTITION BY col", "reiniciar por grupo"], ["PRIMARY KEY / FOREIGN KEY", "identidad / referencia"]] },
  ],
  python: [
    { title: "Básico", items: [["print(x)", "imprimir"], ["f'Total: {x}'", "f-string"], ["round(x, 2)", "redondear"], ["len(x)", "tamaño"], ["int(s), float(s), str(n)", "conversión"]] },
    { title: "Strings", items: [["s.upper(), s.lower()", "mayús/minús"], ["s.strip()", "quitar espacios"], ["s.replace(a, b)", "reemplazar"], ["s.split(',')", "partir a lista"], ["','.join(lista)", "unir"], ["s.startswith(p)", "prefijo"]] },
    { title: "Listas", items: [["lista[0], lista[-1], lista[1:3]", "índices y slices"], ["lista.append(x)", "agregar"], ["sum(l), max(l), min(l)", "agregados"], ["[f(x) for x in l]", "comprensión"], ["[x for x in l if cond]", "filtrar"], ["sorted(l, key=..., reverse=True)", "ordenar"]] },
    { title: "Diccionarios", items: [["d = {'k': v}", "crear"], ["d['k'] / d.get('k', def)", "leer"], ["d.items(), d.keys(), d.values()", "iterar"], ["d[k] = d.get(k, 0) + 1", "contador"]] },
    { title: "Control y funciones", items: [["if / elif / else", "condiciones"], ["for x in it: / while cond:", "bucles"], ["def f(a, b=1): return ...", "función"], ["lambda x: x * 2", "anónima"], ["try / except Error:", "manejo de errores"]] },
    { title: "Conceptos", items: [["set(l)", "únicos, búsqueda O(1)"], ["enumerate(l), zip(a, b)", "iteración útil"], ["(x for x in l)", "generador (lazy)"], ["copiar lista: l[:]", "evitar alias mutable"]] },
  ],
};

// ---------- SETUPS SQL COMPARTIDOS ----------
const S_PROD = `CREATE TABLE productos (id INTEGER PRIMARY KEY, nombre TEXT, categoria TEXT, precio REAL, stock INTEGER);
INSERT INTO productos VALUES (1,'Refrigeradora','Linea Blanca',899.99,12),(2,'Licuadora','Electromenor',79.5,40),(3,'Televisor 55','Audio y Video',649.0,8),(4,'Cocina a gas','Linea Blanca',520.0,15),(5,'Ventilador','Electromenor',45.0,60),(6,'Lavadora','Linea Blanca',740.0,10),(7,'Parlante BT','Audio y Video',120.0,0);`;
const S_VENTAS = `CREATE TABLE productos (id INTEGER PRIMARY KEY, nombre TEXT, categoria TEXT);
INSERT INTO productos VALUES (1,'Refrigeradora','Linea Blanca'),(2,'Licuadora','Electromenor'),(3,'Televisor 55','Audio y Video'),(4,'Microondas','Electromenor');
CREATE TABLE ventas (id INTEGER PRIMARY KEY, producto_id INTEGER, ciudad TEXT, unidades INTEGER, monto REAL);
INSERT INTO ventas VALUES (1,1,'Cuenca',5,4499.95),(2,2,'Quito',12,954.0),(3,1,'Guayaquil',3,2699.97),(4,3,'Cuenca',7,4543.0),(5,2,'Cuenca',4,318.0),(6,3,'Quito',2,1298.0);`;
const S_EMP = `CREATE TABLE empleados (id INTEGER PRIMARY KEY, nombre TEXT, area TEXT, salario REAL, jefe_id INTEGER);
INSERT INTO empleados VALUES (1,'Ana','Comercial',2500,NULL),(2,'Luis','Comercial',1400,1),(3,'Marta','Datos',1900,1),(4,'Pedro','Datos',1500,3),(5,'Sofia','Comercial',1350,1),(6,'Jorge','Datos',1450,3);`;
const S_CLI = `CREATE TABLE clientes (id INTEGER, codigo TEXT, nombre TEXT, ciudad TEXT, email TEXT);
INSERT INTO clientes VALUES (1,'C001','Ana','Cuenca','ana@mail.com'),(2,'C002','Luis','Quito',NULL),(3,'C001','Ana Maria','Cuenca','anam@mail.com'),(4,'C003','Pedro','Loja','pedro@mail.com'),(5,'C002','Luis A.','Quito',NULL),(6,'C004','Rosa','Cuenca','rosa@mail.com');`;
const S_MESES = `CREATE TABLE ventas_mes (mes TEXT, monto REAL);
INSERT INTO ventas_mes VALUES ('2026-01',12000),('2026-02',15500),('2026-03',9800),('2026-04',17200),('2026-05',16100);`;

// Helper para crear ejercicios de forma compacta
const ex = (id, prompt, starter, solution, hints, extra = {}) => ({ id, prompt, starter, solution, hints, check: extra.setup ? "sqlresult" : "stdout", xp: 20, ...extra });

// ---------- CONTENIDO ----------
const CONTENT = { languages: [
  // ================= SQL =================
  { id: "sql", name: "SQL", runner: "sql", color: "#0E7C66", modules: [
    { id: "sql-b1", level: "basico", title: "SELECT y filtrado", lessons: [
      { id: "sql-b1-l1", title: "Tu primer SELECT",
        theory: ["SELECT elige columnas; FROM indica la tabla.", "* devuelve todas las columnas (útil para explorar).", "WHERE filtra filas con condiciones (=, >, <, <>).", "ORDER BY ordena; DESC invierte.", "LIMIT recorta el número de filas."],
        exercises: [
          ex("sql-b1-l1-e1", "Selecciona nombre y precio de los productos con precio mayor a 500, de mayor a menor precio.", "SELECT ", "SELECT nombre, precio FROM productos WHERE precio > 500 ORDER BY precio DESC;", ["Tres cláusulas: elegir columnas, filtrar, ordenar.", "SELECT nombre, precio FROM productos WHERE ... ORDER BY ...", "WHERE precio > 500 ORDER BY precio DESC"], { setup: S_PROD }),
          ex("sql-b1-l1-e2", "Muestra las 3 filas con menor stock (todas las columnas).", "SELECT ", "SELECT * FROM productos ORDER BY stock ASC LIMIT 3;", ["\"Menor\" implica ordenar; \"las 3\" implica limitar.", "SELECT * FROM productos ORDER BY ... LIMIT ...", "ORDER BY stock ASC LIMIT 3"], { setup: S_PROD }),
          ex("sql-b1-l1-e3", "Lista las categorías distintas que existen, ordenadas alfabéticamente (columna: categoria).", "SELECT ", "SELECT DISTINCT categoria FROM productos ORDER BY categoria;", ["Hay una palabra clave para eliminar duplicados.", "SELECT DISTINCT ...", "SELECT DISTINCT categoria ... ORDER BY categoria"], { setup: S_PROD }),
          ex("sql-b1-l1-e4", "Muestra nombre y precio con el precio en dólares con IVA 12% como precio_iva (precio * 1.12), ordenado por nombre.", "SELECT nombre, ", "SELECT nombre, precio * 1.12 AS precio_iva FROM productos ORDER BY nombre;", ["Puedes hacer aritmética directamente en el SELECT.", "precio * 1.12 AS precio_iva", "SELECT nombre, precio * 1.12 AS precio_iva FROM productos ORDER BY nombre"], { setup: S_PROD }),
        ] },
      { id: "sql-b1-l2", title: "Condiciones: LIKE, IN, BETWEEN, NULL",
        theory: ["LIKE busca patrones: '%a' termina en a, 'a%' empieza con a, '%a%' contiene a.", "IN (a, b) equivale a varias comparaciones con OR.", "BETWEEN x AND y incluye ambos extremos.", "NULL no se compara con =; usa IS NULL / IS NOT NULL.", "AND y OR combinan condiciones; usa paréntesis para claridad."],
        exercises: [
          ex("sql-b1-l2-e1", "Muestra nombre de los productos cuyo nombre contiene la letra 'o', ordenado alfabéticamente.", "SELECT nombre\nFROM productos\n", "SELECT nombre FROM productos WHERE nombre LIKE '%o%' ORDER BY nombre;", ["Busca un patrón de texto, no una igualdad.", "WHERE nombre LIKE ...", "LIKE '%o%'"], { setup: S_PROD }),
          ex("sql-b1-l2-e2", "Muestra nombre y categoria de los productos de 'Linea Blanca' o 'Audio y Video', ordenado por nombre. Usa IN.", "SELECT nombre, categoria\nFROM productos\n", "SELECT nombre, categoria FROM productos WHERE categoria IN ('Linea Blanca','Audio y Video') ORDER BY nombre;", ["IN recibe una lista de valores válidos.", "WHERE categoria IN (...)", "IN ('Linea Blanca','Audio y Video')"], { setup: S_PROD }),
          ex("sql-b1-l2-e3", "Muestra nombre y precio de productos con precio entre 100 y 700 (inclusive), ordenado por precio.", "SELECT nombre, precio\nFROM productos\n", "SELECT nombre, precio FROM productos WHERE precio BETWEEN 100 AND 700 ORDER BY precio;", ["Hay una cláusula para rangos inclusivos.", "WHERE precio BETWEEN ... AND ...", "BETWEEN 100 AND 700 ORDER BY precio"], { setup: S_PROD }),
          ex("sql-b1-l2-e4", "Lista codigo y nombre de los clientes SIN email registrado, ordenado por codigo.", "SELECT codigo, nombre\nFROM clientes\n", "SELECT codigo, nombre FROM clientes WHERE email IS NULL ORDER BY codigo;", ["NULL no se compara con =.", "WHERE email IS ...", "WHERE email IS NULL ORDER BY codigo"], { setup: S_CLI }),
        ] },
      { id: "sql-b1-l3", title: "Agregaciones",
        theory: ["COUNT(*) cuenta filas; COUNT(col) ignora NULLs.", "SUM, AVG, MIN, MAX resumen una columna numérica.", "ROUND(x, 2) redondea el resultado.", "Sin GROUP BY, la agregación devuelve UNA fila para toda la tabla."],
        exercises: [
          ex("sql-b1-l3-e1", "¿Cuántos productos hay en total? (columna: n)", "SELECT ", "SELECT COUNT(*) AS n FROM productos;", ["Una función cuenta filas.", "COUNT(*) AS n", "SELECT COUNT(*) AS n FROM productos"], { setup: S_PROD }),
          ex("sql-b1-l3-e2", "Calcula el precio promedio redondeado a 2 decimales (columna: prom) y el precio máximo (columna: maximo).", "SELECT ", "SELECT ROUND(AVG(precio), 2) AS prom, MAX(precio) AS maximo FROM productos;", ["Dos agregaciones en el mismo SELECT.", "ROUND(AVG(precio), 2) y MAX(precio)", "SELECT ROUND(AVG(precio), 2) AS prom, MAX(precio) AS maximo FROM productos"], { setup: S_PROD }),
          ex("sql-b1-l3-e3", "Suma el valor total del inventario (precio * stock) como valor_inv.", "SELECT ", "SELECT SUM(precio * stock) AS valor_inv FROM productos;", ["Puedes agregar sobre una expresión, no solo una columna.", "SUM(precio * stock)", "SELECT SUM(precio * stock) AS valor_inv FROM productos"], { setup: S_PROD }),
        ] },
      { id: "sql-b1-l4", title: "GROUP BY y HAVING",
        theory: ["GROUP BY agrupa filas por una o más columnas antes de agregar.", "Cada columna del SELECT debe estar agregada o en el GROUP BY.", "HAVING filtra grupos (WHERE filtra filas, antes de agrupar).", "Puedes ordenar por el alias de la agregación."],
        exercises: [
          ex("sql-b1-l4-e1", "Precio promedio por categoría (columnas: categoria, precio_prom), ordenado por categoria.", "SELECT categoria, ", "SELECT categoria, AVG(precio) AS precio_prom FROM productos GROUP BY categoria ORDER BY categoria;", ["Agregación + agrupar por la columna no agregada.", "AVG(precio) ... GROUP BY categoria", "SELECT categoria, AVG(precio) AS precio_prom FROM productos GROUP BY categoria ORDER BY categoria"], { setup: S_PROD }),
          ex("sql-b1-l4-e2", "Cuenta productos por categoría, solo categorías con más de 2 productos (columnas: categoria, n).", "SELECT categoria, COUNT(*) AS n\nFROM productos\n", "SELECT categoria, COUNT(*) AS n FROM productos GROUP BY categoria HAVING COUNT(*) > 2;", ["Filtrar DESPUÉS de agrupar no es trabajo de WHERE.", "GROUP BY categoria HAVING ...", "HAVING COUNT(*) > 2"], { setup: S_PROD }),
          ex("sql-b1-l4-e3", "Stock total por categoría, ordenado de mayor a menor stock total (columnas: categoria, stock_total).", "SELECT categoria, ", "SELECT categoria, SUM(stock) AS stock_total FROM productos GROUP BY categoria ORDER BY stock_total DESC;", ["SUM + GROUP BY + orden por el alias.", "SUM(stock) AS stock_total ... GROUP BY categoria", "ORDER BY stock_total DESC"], { setup: S_PROD }),
        ],
        caseStudy: { id: "sql-b1-l4-cs", title: "Reporte de salud del catálogo", context: "Gerencia comercial quiere una vista rápida por categoría: cuántos productos, a qué precio promedio y cuánto stock hay, para decidir dónde reforzar surtido.",
          prompt: "Devuelve categoria, n (conteo), precio_prom (AVG redondeado a 2) y stock_total (SUM), ordenado por stock_total descendente.",
          starter: "SELECT categoria,\n", solution: "SELECT categoria, COUNT(*) AS n, ROUND(AVG(precio),2) AS precio_prom, SUM(stock) AS stock_total FROM productos GROUP BY categoria ORDER BY stock_total DESC;",
          setup: S_PROD, check: "sqlresult", xp: 50,
          hints: ["Es un solo GROUP BY con tres agregaciones distintas.", "COUNT(*), ROUND(AVG(precio),2), SUM(stock) agrupando por categoria.", "ORDER BY stock_total DESC al final."] }
      },
      { id: "sql-b1-l5", title: "Funciones de texto",
        theory: ["UPPER(s)/LOWER(s) cambian mayúsculas; LENGTH(s) mide.", "SUBSTR(s, inicio, largo) extrae una parte (1-indexado).", "|| concatena textos en SQLite.", "TRIM(s) quita espacios de los extremos."],
        exercises: [
          ex("sql-b1-l5-e1", "Muestra el nombre en mayúsculas y su longitud (columnas: nombre_may, largo), ordenado por nombre_may.", "SELECT ", "SELECT UPPER(nombre) AS nombre_may, LENGTH(nombre) AS largo FROM productos ORDER BY nombre_may;", ["Dos funciones de texto en el mismo SELECT.", "UPPER(nombre) y LENGTH(nombre)", "SELECT UPPER(nombre) AS nombre_may, LENGTH(nombre) AS largo FROM productos ORDER BY nombre_may"], { setup: S_PROD }),
          ex("sql-b1-l5-e2", "Crea la etiqueta 'nombre (categoria)' concatenando con || (columna: etiqueta), ordenado por etiqueta.", "SELECT ", "SELECT nombre || ' (' || categoria || ')' AS etiqueta FROM productos ORDER BY etiqueta;", ["|| une textos y literales.", "nombre || ' (' || categoria || ')'", "AS etiqueta y ORDER BY etiqueta"], { setup: S_PROD }),
          ex("sql-b1-l5-e3", "Extrae los 3 primeros caracteres del nombre como prefijo (columnas: nombre, prefijo), ordenado por nombre.", "SELECT nombre, ", "SELECT nombre, SUBSTR(nombre, 1, 3) AS prefijo FROM productos ORDER BY nombre;", ["SUBSTR empieza en 1, no en 0.", "SUBSTR(nombre, 1, 3)", "SELECT nombre, SUBSTR(nombre, 1, 3) AS prefijo ... ORDER BY nombre"], { setup: S_PROD }),
        ] },
    ] },
    { id: "sql-i0", level: "intermedio", title: "Modificar datos (DML)", lessons: [
      { id: "sql-i0-l1", title: "INSERT, UPDATE y DELETE",
        theory: ["INSERT INTO t VALUES (...) agrega filas.", "UPDATE t SET col = v WHERE cond modifica; SIN WHERE modifica TODO (peligro real).", "DELETE FROM t WHERE cond elimina filas.", "Buena práctica: prueba el WHERE con un SELECT antes del UPDATE/DELETE."],
        exercises: [
          ex("sql-i0-l1-e1", "Inserta el producto (8, 'Aspiradora', 'Electromenor', 210.0, 25) y verifica con: SELECT * FROM productos WHERE id = 8;", "INSERT INTO productos ", "INSERT INTO productos VALUES (8, 'Aspiradora', 'Electromenor', 210.0, 25);\nSELECT * FROM productos WHERE id = 8;", ["Dos sentencias: el INSERT y el SELECT de verificación.", "INSERT INTO productos VALUES (8, 'Aspiradora', 'Electromenor', 210.0, 25);", "Luego SELECT * FROM productos WHERE id = 8;"], { setup: S_PROD, xp: 25 }),
          ex("sql-i0-l1-e2", "Sube 5% el precio de 'Electromenor' y verifica con: SELECT nombre, precio FROM productos WHERE categoria = 'Electromenor' ORDER BY nombre;", "UPDATE productos\n", "UPDATE productos SET precio = precio * 1.05 WHERE categoria = 'Electromenor';\nSELECT nombre, precio FROM productos WHERE categoria = 'Electromenor' ORDER BY nombre;", ["SET con expresión sobre la propia columna + WHERE por categoría.", "SET precio = precio * 1.05 WHERE categoria = 'Electromenor'", "Termina con el SELECT de verificación indicado."], { setup: S_PROD, xp: 25 }),
          ex("sql-i0-l1-e3", "Elimina los productos con stock 0 y verifica con: SELECT COUNT(*) AS n FROM productos;", "DELETE FROM productos\n", "DELETE FROM productos WHERE stock = 0;\nSELECT COUNT(*) AS n FROM productos;", ["DELETE con condición, nunca sin WHERE.", "DELETE FROM productos WHERE stock = 0;", "Luego SELECT COUNT(*) AS n FROM productos;"], { setup: S_PROD, xp: 25 }),
          ex("sql-i0-l1-e4", "Asigna al cliente id 2 el email 'luis@mail.com' y verifica con: SELECT id, email FROM clientes WHERE id = 2;", "UPDATE clientes\n", "UPDATE clientes SET email = 'luis@mail.com' WHERE id = 2;\nSELECT id, email FROM clientes WHERE id = 2;", ["UPDATE puntual por PK.", "SET email = 'luis@mail.com' WHERE id = 2", "Termina con el SELECT de verificación."], { setup: S_CLI, xp: 25 }),
        ] },
    ] },
    { id: "sql-i1", level: "intermedio", title: "JOINs", lessons: [
      { id: "sql-i1-l1", title: "INNER JOIN",
        theory: ["JOIN combina tablas por una condición ON.", "INNER JOIN: solo filas con coincidencia en ambas tablas.", "Usa alias cortos (p, v) y prefíjalos en cada columna.", "JOIN + GROUP BY es el patrón de reporte más común."],
        exercises: [
          ex("sql-i1-l1-e1", "Muestra nombre del producto y unidades de cada venta (columnas: nombre, unidades), ordenado por nombre y unidades.", "SELECT p.nombre, v.unidades\nFROM ventas v\n", "SELECT p.nombre, v.unidades FROM ventas v INNER JOIN productos p ON p.id = v.producto_id ORDER BY p.nombre, v.unidades;", ["Une por la FK producto_id contra la PK id.", "INNER JOIN productos p ON p.id = v.producto_id", "ORDER BY p.nombre, v.unidades"], { setup: S_VENTAS, xp: 25 }),
          ex("sql-i1-l1-e2", "Total de unidades vendidas por producto (columnas: nombre, unidades), de mayor a menor.", "SELECT p.nombre, ", "SELECT p.nombre, SUM(v.unidades) AS unidades FROM ventas v INNER JOIN productos p ON p.id = v.producto_id GROUP BY p.nombre ORDER BY unidades DESC;", ["JOIN + agregación por producto.", "SUM(v.unidades) ... GROUP BY p.nombre", "ORDER BY unidades DESC"], { setup: S_VENTAS, xp: 25 }),
          ex("sql-i1-l1-e3", "Monto total vendido por ciudad y categoría (columnas: ciudad, categoria, total), ordenado por ciudad y categoria.", "SELECT v.ciudad, p.categoria, ", "SELECT v.ciudad, p.categoria, SUM(v.monto) AS total FROM ventas v INNER JOIN productos p ON p.id = v.producto_id GROUP BY v.ciudad, p.categoria ORDER BY v.ciudad, p.categoria;", ["Puedes agrupar por dos columnas a la vez.", "GROUP BY v.ciudad, p.categoria", "SUM(v.monto) AS total y ordena por ambas columnas"], { setup: S_VENTAS, xp: 25 }),
        ] },
      { id: "sql-i1-l2", title: "LEFT JOIN y huérfanos",
        theory: ["LEFT JOIN: todas las filas de la izquierda, NULL si no hay match.", "El patrón LEFT JOIN + IS NULL encuentra filas sin pareja.", "Elegir bien qué tabla va a la izquierda es la mitad del problema.", "COALESCE(x, 0) reemplaza NULL por un valor por defecto."],
        exercises: [
          ex("sql-i1-l2-e1", "Muestra TODOS los productos y sus unidades vendidas; los no vendidos deben salir con 0 (columnas: nombre, unidades), ordenado por nombre.", "SELECT p.nombre, ", "SELECT p.nombre, COALESCE(SUM(v.unidades), 0) AS unidades FROM productos p LEFT JOIN ventas v ON v.producto_id = p.id GROUP BY p.nombre ORDER BY p.nombre;", ["Productos a la izquierda para no perder los no vendidos.", "LEFT JOIN ventas v ON v.producto_id = p.id", "COALESCE(SUM(v.unidades), 0) AS unidades"], { setup: S_VENTAS, xp: 25 }),
          ex("sql-i1-l2-e2", "Lista los productos que NUNCA se han vendido (columna: nombre).", "SELECT p.nombre\nFROM productos p\n", "SELECT p.nombre FROM productos p LEFT JOIN ventas v ON v.producto_id = p.id WHERE v.id IS NULL;", ["Los no vendidos quedan con NULL del lado de ventas.", "LEFT JOIN + filtro por NULL.", "WHERE v.id IS NULL"], { setup: S_VENTAS, xp: 25 }),
        ],
        caseStudy: { id: "sql-i1-l2-cs", title: "Cobertura de portafolio por ciudad", context: "El equipo comercial sospecha que algunas ciudades no venden todo el portafolio. Necesitan el monto vendido por ciudad para cada producto, incluyendo dónde no hubo ventas.",
          prompt: "Devuelve nombre del producto y el monto total vendido en Cuenca (0 si no vendió allí), columnas: nombre, total_cuenca, ordenado por nombre.",
          starter: "SELECT p.nombre,\n", solution: "SELECT p.nombre, COALESCE(SUM(CASE WHEN v.ciudad = 'Cuenca' THEN v.monto END), 0) AS total_cuenca FROM productos p LEFT JOIN ventas v ON v.producto_id = p.id GROUP BY p.nombre ORDER BY p.nombre;",
          setup: S_VENTAS, check: "sqlresult", xp: 50,
          hints: ["Combina LEFT JOIN (no perder productos) con una suma condicional solo de Cuenca.", "SUM(CASE WHEN v.ciudad = 'Cuenca' THEN v.monto END)", "Envuelve en COALESCE(..., 0) y agrupa por p.nombre."] }
      },
    ] },
    { id: "sql-i2", level: "intermedio", title: "Subconsultas y CASE", lessons: [
      { id: "sql-i2-l1", title: "Subconsultas",
        theory: ["Una subconsulta es un SELECT dentro de otro.", "En WHERE: comparar contra un valor calculado (> (SELECT AVG(...))).", "Con IN: filtrar contra la lista que produce otra consulta.", "Si crece o se repite, conviértela en CTE (nivel avanzado)."],
        exercises: [
          ex("sql-i2-l1-e1", "Empleados con salario mayor al promedio general (columnas: nombre, salario), ordenado por salario desc.", "SELECT nombre, salario\nFROM empleados\nWHERE salario > ", "SELECT nombre, salario FROM empleados WHERE salario > (SELECT AVG(salario) FROM empleados) ORDER BY salario DESC;", ["El promedio se calcula con otra consulta dentro del WHERE.", "WHERE salario > (SELECT ... FROM empleados)", "(SELECT AVG(salario) FROM empleados)"], { setup: S_EMP, xp: 25 }),
          ex("sql-i2-l1-e2", "Productos que SÍ tienen ventas, usando IN con subconsulta (columna: nombre), ordenado por nombre.", "SELECT nombre\nFROM productos\nWHERE id IN ", "SELECT nombre FROM productos WHERE id IN (SELECT producto_id FROM ventas) ORDER BY nombre;", ["La subconsulta produce la lista de ids vendidos.", "IN (SELECT producto_id FROM ventas)", "WHERE id IN (SELECT producto_id FROM ventas) ORDER BY nombre"], { setup: S_VENTAS, xp: 25 }),
          ex("sql-i2-l1-e3", "Muestra el/los empleados con el salario máximo (columnas: nombre, salario).", "SELECT nombre, salario\nFROM empleados\n", "SELECT nombre, salario FROM empleados WHERE salario = (SELECT MAX(salario) FROM empleados);", ["Compara contra el máximo calculado aparte.", "WHERE salario = (SELECT MAX(...) ...)", "(SELECT MAX(salario) FROM empleados)"], { setup: S_EMP, xp: 25 }),
        ] },
      { id: "sql-i2-l2", title: "CASE WHEN: lógica en columnas",
        theory: ["CASE WHEN cond THEN x WHEN cond2 THEN y ELSE z END crea columnas condicionales.", "Sirve para segmentar (etiquetas) y para agregación condicional.", "SUM(CASE WHEN cond THEN 1 ELSE 0 END) cuenta con condición.", "Es la base del pivoteo manual de datos."],
        exercises: [
          ex("sql-i2-l2-e1", "Etiqueta cada producto: 'Premium' si precio >= 500, si no 'Estandar' (columnas: nombre, segmento), ordenado por nombre.", "SELECT nombre,\n  CASE ", "SELECT nombre, CASE WHEN precio >= 500 THEN 'Premium' ELSE 'Estandar' END AS segmento FROM productos ORDER BY nombre;", ["CASE evalúa la condición fila por fila.", "CASE WHEN precio >= 500 THEN 'Premium' ELSE 'Estandar' END", "No olvides el alias AS segmento y el ORDER BY nombre."], { setup: S_PROD, xp: 25 }),
          ex("sql-i2-l2-e2", "Cuenta cuántos productos hay 'Premium' (precio >= 500) y cuántos 'Estandar' en UNA fila (columnas: premium, estandar).", "SELECT\n  ", "SELECT SUM(CASE WHEN precio >= 500 THEN 1 ELSE 0 END) AS premium, SUM(CASE WHEN precio < 500 THEN 1 ELSE 0 END) AS estandar FROM productos;", ["Agregación condicional: suma 1 cuando se cumple.", "SUM(CASE WHEN precio >= 500 THEN 1 ELSE 0 END)", "Dos SUM(CASE ...) en el mismo SELECT."], { setup: S_PROD, xp: 25 }),
          ex("sql-i2-l2-e3", "Pivotea: monto total por producto en Cuenca y Quito en columnas separadas (columnas: nombre, cuenca, quito), ordenado por nombre.", "SELECT p.nombre,\n  ", "SELECT p.nombre, COALESCE(SUM(CASE WHEN v.ciudad='Cuenca' THEN v.monto END),0) AS cuenca, COALESCE(SUM(CASE WHEN v.ciudad='Quito' THEN v.monto END),0) AS quito FROM productos p LEFT JOIN ventas v ON v.producto_id=p.id GROUP BY p.nombre ORDER BY p.nombre;", ["Una columna condicional por ciudad, agregada.", "SUM(CASE WHEN v.ciudad='Cuenca' THEN v.monto END) y lo mismo para Quito.", "Envuelve cada una en COALESCE(...,0) y agrupa por nombre."], { setup: S_VENTAS, xp: 25 }),
        ],
        caseStudy: { id: "sql-i2-l2-cs", title: "Semáforo de inventario", context: "Operaciones quiere un semáforo simple para la reunión semanal: qué productos están en rojo (stock 0), amarillo (stock < 15) o verde.",
          prompt: "Devuelve nombre, stock y la columna estado ('Rojo' si stock = 0, 'Amarillo' si stock < 15, si no 'Verde'), ordenado por stock ascendente.",
          starter: "SELECT nombre, stock,\n  CASE\n", solution: "SELECT nombre, stock, CASE WHEN stock = 0 THEN 'Rojo' WHEN stock < 15 THEN 'Amarillo' ELSE 'Verde' END AS estado FROM productos ORDER BY stock ASC;",
          setup: S_PROD, check: "sqlresult", xp: 50,
          hints: ["CASE admite varios WHEN en orden: el primero que se cumple gana.", "WHEN stock = 0 ... WHEN stock < 15 ... ELSE ...", "Cierra con END AS estado y ORDER BY stock ASC."] }
      },
    ] },
    { id: "sql-a1", level: "avanzado", title: "Modelado: llaves e integridad", lessons: [
      { id: "sql-a1-l1", title: "Llaves primarias y foráneas",
        theory: ["PRIMARY KEY (PK): identidad única de cada fila; no admite NULL ni duplicados.", "FOREIGN KEY (FK): columna que referencia la PK de otra tabla; el pegamento del modelo relacional.", "Integridad referencial: una FK sin fila padre es un dato huérfano — corrupción del modelo.", "Auditar huérfanos y duplicados es tarea frecuente en data warehousing.", "El código es simple (LEFT JOIN + IS NULL); lo avanzado es saber QUÉ buscar."],
        exercises: [
          ex("sql-a1-l1-e1", "Auditoría: encuentra las ventas huérfanas, cuyo producto_id no existe en productos (columnas: id, producto_id), ordenado por id.", "-- Ventas cuyo producto_id NO existe en productos\nSELECT v.id, v.producto_id\nFROM ventas v\n", "SELECT v.id, v.producto_id FROM ventas v LEFT JOIN productos p ON p.id = v.producto_id WHERE p.id IS NULL ORDER BY v.id;", ["Concepto: la FK referencia una PK inexistente. Une manteniendo todas las ventas.", "LEFT JOIN productos p ON p.id = v.producto_id", "WHERE p.id IS NULL ORDER BY v.id"], { setup: `CREATE TABLE productos (id INTEGER PRIMARY KEY, nombre TEXT);
INSERT INTO productos VALUES (1,'Refrigeradora'),(2,'Licuadora'),(3,'Televisor 55');
CREATE TABLE ventas (id INTEGER PRIMARY KEY, producto_id INTEGER, unidades INTEGER);
INSERT INTO ventas VALUES (1,1,5),(2,9,2),(3,2,12),(4,7,1),(5,8,3);`, xp: 30 }),
          ex("sql-a1-l1-e2", "PK candidata: el campo codigo debería ser único. Encuentra los códigos repetidos y sus conteos (columnas: codigo, n), ordenado por codigo.", "SELECT codigo, COUNT(*) AS n\nFROM clientes\n", "SELECT codigo, COUNT(*) AS n FROM clientes GROUP BY codigo HAVING COUNT(*) > 1 ORDER BY codigo;", ["Si codigo fuera PK, el conteo por codigo daría siempre 1.", "GROUP BY codigo y filtra grupos con más de 1.", "HAVING COUNT(*) > 1 ORDER BY codigo"], { setup: S_CLI, xp: 30 }),
          ex("sql-a1-l1-e3", "Jerarquía con FK a sí misma: empleados.jefe_id referencia empleados.id. Muestra empleado y nombre de su jefe (columnas: empleado, jefe), solo quienes tienen jefe, ordenado por empleado.", "SELECT e.nombre AS empleado, j.nombre AS jefe\nFROM empleados e\n", "SELECT e.nombre AS empleado, j.nombre AS jefe FROM empleados e INNER JOIN empleados j ON j.id = e.jefe_id ORDER BY e.nombre;", ["Concepto: self-join, la tabla se une consigo misma con dos alias.", "INNER JOIN empleados j ON j.id = e.jefe_id", "Alias e (empleado) y j (jefe), ORDER BY e.nombre."], { setup: S_EMP, xp: 30 }),
        ],
        caseStudy: { id: "sql-a1-l1-cs", title: "Migración con integridad", context: "Tu empresa migra el catálogo a un nuevo ERP. Antes de activar las FOREIGN KEYs en producción debes cuantificar el daño: cuántas ventas serían rechazadas por integridad referencial.",
          prompt: "Devuelve una fila con la columna ventas_rechazadas: total de ventas cuyo producto_id no existe en productos.",
          starter: "SELECT COUNT(*) AS ventas_rechazadas\nFROM ventas v\n", solution: "SELECT COUNT(*) AS ventas_rechazadas FROM ventas v LEFT JOIN productos p ON p.id = v.producto_id WHERE p.id IS NULL;",
          setup: `CREATE TABLE productos (id INTEGER PRIMARY KEY, nombre TEXT);
INSERT INTO productos VALUES (1,'Refrigeradora'),(2,'Licuadora'),(3,'Televisor 55');
CREATE TABLE ventas (id INTEGER PRIMARY KEY, producto_id INTEGER, unidades INTEGER);
INSERT INTO ventas VALUES (1,1,5),(2,9,2),(3,2,12),(4,7,1),(5,8,3);`, check: "sqlresult", xp: 50,
          hints: ["Mismo patrón de huérfanos, agregado a un conteo.", "LEFT JOIN + IS NULL, envuelto en COUNT(*).", "SELECT COUNT(*) ... WHERE p.id IS NULL"] }
      },
      { id: "sql-a1-l2", title: "Normalización y calidad de datos",
        theory: ["1FN: sin listas dentro de una celda; un valor por campo.", "2FN/3FN: cada atributo depende de la llave, toda la llave y nada más que la llave.", "Datos denormalizados producen anomalías: el mismo cliente con 2 ciudades distintas.", "Detectar inconsistencias = agrupar por la entidad y contar valores distintos del atributo."],
        exercises: [
          ex("sql-a1-l2-e1", "Inconsistencia de atributo: encuentra códigos de cliente que aparecen con más de un nombre distinto (columnas: codigo, nombres_distintos), ordenado por codigo.", "SELECT codigo, COUNT(DISTINCT nombre) AS nombres_distintos\nFROM clientes\n", "SELECT codigo, COUNT(DISTINCT nombre) AS nombres_distintos FROM clientes GROUP BY codigo HAVING COUNT(DISTINCT nombre) > 1 ORDER BY codigo;", ["Concepto: si codigo determina al cliente, su nombre debería ser único por codigo.", "COUNT(DISTINCT nombre) por codigo.", "HAVING COUNT(DISTINCT nombre) > 1"], { setup: S_CLI, xp: 30 }),
          ex("sql-a1-l2-e2", "Deduplicación: quédate con UNA fila por codigo, la de menor id (columnas: id, codigo, nombre), ordenado por codigo.", "SELECT id, codigo, nombre\nFROM clientes\nWHERE id IN ", "SELECT id, codigo, nombre FROM clientes WHERE id IN (SELECT MIN(id) FROM clientes GROUP BY codigo) ORDER BY codigo;", ["Concepto: define un criterio determinista de supervivencia (menor id).", "Subconsulta: SELECT MIN(id) FROM clientes GROUP BY codigo", "WHERE id IN (esa subconsulta) ORDER BY codigo"], { setup: S_CLI, xp: 30 }),
        ] },
    ] },
    { id: "sql-a2", level: "avanzado", title: "CTEs y window functions", lessons: [
      { id: "sql-a2-l1", title: "CTEs: pensar en pasos",
        theory: ["WITH nombre AS (...) da nombre a un paso intermedio.", "Concepto: descomponer en pasos legibles > una consulta anidada críptica.", "Puedes encadenar varias CTEs separadas por coma.", "La consulta final consume las CTEs como si fueran tablas."],
        exercises: [
          ex("sql-a2-l1-e1", "Con una CTE 'tot' que calcule unidades por producto, muestra los productos con más de 5 unidades vendidas (columnas: nombre, unidades), orden desc por unidades.", "WITH tot AS (\n  SELECT producto_id, SUM(unidades) AS unidades\n  FROM ventas\n  GROUP BY producto_id\n)\nSELECT ", "WITH tot AS (SELECT producto_id, SUM(unidades) AS unidades FROM ventas GROUP BY producto_id) SELECT p.nombre, t.unidades FROM tot t INNER JOIN productos p ON p.id = t.producto_id WHERE t.unidades > 5 ORDER BY t.unidades DESC;", ["Paso 1 ya está hecho (la CTE); paso 2 es unir con productos y filtrar.", "FROM tot t INNER JOIN productos p ON p.id = t.producto_id", "WHERE t.unidades > 5 ORDER BY t.unidades DESC"], { setup: S_VENTAS, xp: 30 }),
          ex("sql-a2-l1-e2", "Con una CTE calcula el salario promedio por área y muestra los empleados que ganan sobre el promedio de SU área (columnas: nombre, area, salario), ordenado por nombre.", "WITH prom AS (\n  SELECT area, AVG(salario) AS prom_area\n  FROM empleados\n  GROUP BY area\n)\nSELECT ", "WITH prom AS (SELECT area, AVG(salario) AS prom_area FROM empleados GROUP BY area) SELECT e.nombre, e.area, e.salario FROM empleados e INNER JOIN prom p ON p.area = e.area WHERE e.salario > p.prom_area ORDER BY e.nombre;", ["Concepto: comparar cada fila contra el agregado de su grupo → une la CTE por area.", "INNER JOIN prom p ON p.area = e.area", "WHERE e.salario > p.prom_area ORDER BY e.nombre"], { setup: S_EMP, xp: 30 }),
        ] },
      { id: "sql-a2-l2", title: "Window functions",
        theory: ["Las window functions calculan sobre un conjunto de filas SIN colapsarlas.", "ROW_NUMBER() OVER (PARTITION BY g ORDER BY c DESC): ranking por grupo.", "SUM(c) OVER (ORDER BY f): acumulado (running total).", "LAG(c) OVER (ORDER BY f): valor de la fila anterior → variaciones vs periodo previo.", "El patrón 'top 1 por grupo' (rn = 1) resuelve media analítica de negocio."],
        exercises: [
          ex("sql-a2-l2-e1", "Top 1 por grupo: producto más vendido por categoría (columnas: categoria, nombre, unidades), ordenado por categoria.", "WITH ranking AS (\n  SELECT categoria, nombre, unidades,\n         \n  FROM ventas\n)\nSELECT ", "WITH ranking AS (SELECT categoria, nombre, unidades, ROW_NUMBER() OVER (PARTITION BY categoria ORDER BY unidades DESC) AS rn FROM ventas) SELECT categoria, nombre, unidades FROM ranking WHERE rn = 1 ORDER BY categoria;", ["Numera dentro de cada categoría por unidades desc; quédate con el 1.", "ROW_NUMBER() OVER (PARTITION BY categoria ORDER BY unidades DESC) AS rn", "WHERE rn = 1 ORDER BY categoria"], { setup: `CREATE TABLE ventas (categoria TEXT, nombre TEXT, unidades INTEGER);
INSERT INTO ventas VALUES ('Linea Blanca','Refrigeradora',8),('Linea Blanca','Cocina',14),('Electromenor','Licuadora',12),('Electromenor','Ventilador',20);`, xp: 30 }),
          ex("sql-a2-l2-e2", "Acumulado: muestra mes, monto y el acumulado del año como acum, ordenado por mes.", "SELECT mes, monto,\n       ", "SELECT mes, monto, SUM(monto) OVER (ORDER BY mes) AS acum FROM ventas_mes ORDER BY mes;", ["Un SUM ventana ordenado por mes acumula hasta cada fila.", "SUM(monto) OVER (ORDER BY mes)", "AS acum, y ORDER BY mes al final."], { setup: S_MESES, xp: 30 }),
          ex("sql-a2-l2-e3", "Variación vs mes anterior: muestra mes, monto y var (monto - mes anterior; el primer mes queda NULL), ordenado por mes.", "SELECT mes, monto,\n       ", "SELECT mes, monto, monto - LAG(monto) OVER (ORDER BY mes) AS var FROM ventas_mes ORDER BY mes;", ["LAG trae el valor de la fila anterior según un orden.", "LAG(monto) OVER (ORDER BY mes)", "monto - LAG(monto) OVER (ORDER BY mes) AS var"], { setup: S_MESES, xp: 30 }),
        ],
        caseStudy: { id: "sql-a2-l2-cs", title: "Tablero de tendencia mensual", context: "El comité de gerencia revisa cada mes la venta, su acumulado anual y si el mes creció o cayó vs el anterior. Hoy lo arman a mano en Excel; te piden la consulta que alimente el tablero.",
          prompt: "Devuelve mes, monto, acum (acumulado) y tendencia ('Sube' si monto > mes anterior, 'Baja' si es menor, 'Inicio' si es el primer mes), ordenado por mes.",
          starter: "SELECT mes, monto,\n       SUM(monto) OVER (ORDER BY mes) AS acum,\n       ", solution: "SELECT mes, monto, SUM(monto) OVER (ORDER BY mes) AS acum, CASE WHEN LAG(monto) OVER (ORDER BY mes) IS NULL THEN 'Inicio' WHEN monto > LAG(monto) OVER (ORDER BY mes) THEN 'Sube' ELSE 'Baja' END AS tendencia FROM ventas_mes ORDER BY mes;",
          setup: S_MESES, check: "sqlresult", xp: 50,
          hints: ["Combina el acumulado (ya en el starter) con un CASE sobre LAG.", "CASE WHEN LAG(monto) OVER (ORDER BY mes) IS NULL THEN 'Inicio' ...", "WHEN monto > LAG(...) THEN 'Sube' ELSE 'Baja' END AS tendencia"] }
      },
    ] },
    { id: "sql-a3", level: "avanzado", title: "NULLs, fechas e índices", lessons: [
      { id: "sql-a3-l1", title: "La lógica de tres valores (NULL)",
        theory: ["NULL no es 0 ni '': es 'desconocido'. Cualquier comparación con NULL da NULL (ni true ni false).", "Por eso WHERE col <> 'x' EXCLUYE los NULL silenciosamente — bug clásico.", "COUNT(col) ignora NULLs; COUNT(*) no. AVG también los ignora.", "COALESCE(a, b, c) devuelve el primer no-nulo."],
        exercises: [
          ex("sql-a3-l1-e1", "Trampa de NULL: cuenta los clientes cuyo email NO es 'ana@mail.com', INCLUYENDO a los que no tienen email (columna: n).", "SELECT COUNT(*) AS n\nFROM clientes\n", "SELECT COUNT(*) AS n FROM clientes WHERE email <> 'ana@mail.com' OR email IS NULL;", ["Concepto: email <> 'x' descarta los NULL sin avisar.", "Agrega la condición de NULL explícitamente con OR.", "WHERE email <> 'ana@mail.com' OR email IS NULL"], { setup: S_CLI, xp: 30 }),
          ex("sql-a3-l1-e2", "Muestra codigo y email de todos los clientes reemplazando NULL por 'sin-email' (columnas: codigo, email), ordenado por codigo y email.", "SELECT codigo, ", "SELECT codigo, COALESCE(email, 'sin-email') AS email FROM clientes ORDER BY codigo, email;", ["Hay una función que sustituye NULL por un valor.", "COALESCE(email, 'sin-email')", "AS email, ORDER BY codigo, email"], { setup: S_CLI, xp: 30 }),
        ] },
      { id: "sql-a3-l2", title: "Índices: el porqué de la velocidad",
        theory: ["Un índice es como el índice de un libro: evita leer toda la tabla (full scan).", "Acelera búsquedas por igualdad/rango en la columna indexada; encarece INSERT/UPDATE.", "La PK crea un índice automáticamente.", "Concepto: indexa columnas de filtro/join frecuente, no todo.", "EXPLAIN QUERY PLAN (SQLite) muestra si la consulta usa índice o escanea."],
        exercises: [
          ex("sql-a3-l2-e1", "Crea un índice llamado idx_cat sobre productos(categoria) y luego consulta el plan de la búsqueda por categoría. Ejecuta ambas sentencias.", "CREATE INDEX idx_cat ON productos(categoria);\nEXPLAIN QUERY PLAN\nSELECT * FROM productos WHERE categoria = 'Linea Blanca';", "CREATE INDEX idx_cat ON productos(categoria);\nEXPLAIN QUERY PLAN\nSELECT * FROM productos WHERE categoria = 'Linea Blanca';", ["El starter ya está completo: ejecútalo y observa el plan.", "Busca en el resultado la palabra 'USING INDEX idx_cat'.", "Valida tal cual: la meta es LEER el plan, no memorizar sintaxis."], { setup: S_PROD, xp: 30 }),
        ] },
    ] },
  ] },

  // ================= PYTHON =================
  { id: "python", name: "Python", runner: "python", color: "#2456A6", modules: [
    { id: "py-b1", level: "basico", title: "Fundamentos", lessons: [
      { id: "py-b1-l1", title: "Variables, tipos y f-strings",
        theory: ["Tipado dinámico: x = 5 (int), x = 'hola' (str).", "f-strings: f'Total: {valor}' interpola variables.", "round(x, 2) redondea; int()/float()/str() convierten.", "print() escribe en la salida estándar (así validamos)."],
        exercises: [
          ex("py-b1-l1-e1", "Calcula el precio final de $850 con 12% de IVA e imprime: 'Precio final: 952.0'", "precio = 850\niva = 0.12\n", "precio = 850\niva = 0.12\nprint(f'Precio final: {precio * (1 + iva)}')", ["Precio final = precio × (1 + iva).", "Usa un f-string con el texto exacto.", "print(f'Precio final: {precio * (1 + iva)}')"]),
          ex("py-b1-l1-e2", "Convierte el texto '1450.75' a número e imprime la mitad de su valor.", "monto_texto = '1450.75'\n", "monto_texto = '1450.75'\nprint(float(monto_texto) / 2)", ["Primero conversión, luego aritmética.", "float(monto_texto)", "print(float(monto_texto) / 2)"]),
          ex("py-b1-l1-e3", "Imprime el resultado de 7 dividido 2 de tres formas: división real (/), división entera (//) y residuo (%), una por línea.", "", "print(7 / 2)\nprint(7 // 2)\nprint(7 % 2)", ["Son tres operadores distintos.", "/, // y %", "print(7 / 2), print(7 // 2), print(7 % 2)"]),
          ex("py-b1-l1-e4", "Imprime 'Cuenca-Ecuador' combinando las dos variables con un guion, usando f-string.", "ciudad = 'Cuenca'\npais = 'Ecuador'\n", "ciudad = 'Cuenca'\npais = 'Ecuador'\nprint(f'{ciudad}-{pais}')", ["Un f-string admite varias variables.", "f'{ciudad}-{pais}'", "print(f'{ciudad}-{pais}')"]),
        ] },
      { id: "py-b1-l2", title: "Strings: limpiar y transformar",
        theory: ["s.strip() quita espacios en extremos; s.upper()/lower() cambian mayúsculas.", "s.replace(a, b) sustituye; s.split(sep) parte a lista; sep.join(lista) une.", "s.startswith(p)/endswith(p) prueban prefijo/sufijo.", "Limpiar texto es el 80% del trabajo real con datos."],
        exercises: [
          ex("py-b1-l2-e1", "Limpia el código: quita espacios de los extremos y pásalo a mayúsculas. Imprime el resultado.", "codigo = '  ab-102x  '\n", "codigo = '  ab-102x  '\nprint(codigo.strip().upper())", ["Dos métodos encadenados.", ".strip() y luego .upper()", "print(codigo.strip().upper())"]),
          ex("py-b1-l2-e2", "Convierte el precio con formato local '1.450,75' a float e imprímelo (quita el punto de miles y cambia la coma por punto).", "precio = '1.450,75'\n", "precio = '1.450,75'\nprint(float(precio.replace('.', '').replace(',', '.')))", ["Dos replace en cadena, en el orden correcto.", ".replace('.', '').replace(',', '.')", "print(float(precio.replace('.', '').replace(',', '.')))"]),
          ex("py-b1-l2-e3", "Parte el CSV en una lista con split e imprime la lista.", "linea = 'Refrigeradora,899.99,12'\n", "linea = 'Refrigeradora,899.99,12'\nprint(linea.split(','))", ["Un método parte por separador.", "linea.split(',')", "print(linea.split(','))"]),
          ex("py-b1-l2-e4", "Une la lista de columnas en un string separado por ' | ' e imprímelo.", "cols = ['nombre', 'precio', 'stock']\n", "cols = ['nombre', 'precio', 'stock']\nprint(' | '.join(cols))", ["join se llama sobre el separador.", "' | '.join(cols)", "print(' | '.join(cols))"]),
        ] },
      { id: "py-b1-l3", title: "Listas e índices",
        theory: ["lista[0] primero, lista[-1] último, lista[1:3] slice (fin exclusivo).", "append agrega al final; len mide.", "sum/max/min agregan listas numéricas.", "sorted(lista) devuelve una copia ordenada."],
        exercises: [
          ex("py-b1-l3-e1", "Imprime el primer y el último precio de la lista, en dos líneas.", "precios = [899.99, 79.5, 649.0, 520.0, 45.0]\n", "precios = [899.99, 79.5, 649.0, 520.0, 45.0]\nprint(precios[0])\nprint(precios[-1])", ["Índice 0 y el índice negativo.", "precios[0] y precios[-1]", "print(precios[0]) y print(precios[-1])"]),
          ex("py-b1-l3-e2", "Imprime los 3 primeros elementos usando un slice.", "precios = [899.99, 79.5, 649.0, 520.0, 45.0]\n", "precios = [899.99, 79.5, 649.0, 520.0, 45.0]\nprint(precios[:3])", ["Un slice sin inicio arranca en 0.", "precios[:3]", "print(precios[:3])"]),
          ex("py-b1-l3-e3", "Imprime el promedio de la lista redondeado a 2 decimales.", "precios = [899.99, 79.5, 649.0, 520.0, 45.0]\n", "precios = [899.99, 79.5, 649.0, 520.0, 45.0]\nprint(round(sum(precios)/len(precios), 2))", ["Suma entre tamaño.", "sum(precios) / len(precios)", "print(round(sum(precios)/len(precios), 2))"]),
          ex("py-b1-l3-e4", "Imprime la lista ordenada de mayor a menor SIN modificar la original, y luego imprime la original.", "precios = [100, 45, 250]\n", "precios = [100, 45, 250]\nprint(sorted(precios, reverse=True))\nprint(precios)", ["sorted devuelve copia; sort() muta.", "sorted(precios, reverse=True)", "print(sorted(precios, reverse=True)) y luego print(precios)"]),
        ] },
      { id: "py-b1-l4", title: "Condicionales y bucles",
        theory: ["if / elif / else evalúan en orden; el primero que cumple gana.", "for x in iterable recorre elementos; range(n) genera 0..n-1.", "La indentación define los bloques (4 espacios).", "Acumular en una variable dentro del for es el patrón más común."],
        exercises: [
          ex("py-b1-l4-e1", "Clasifica el stock: imprime 'Critico' si es 0, 'Bajo' si es menor a 15, si no 'OK'.", "stock = 8\n", "stock = 8\nif stock == 0:\n    print('Critico')\nelif stock < 15:\n    print('Bajo')\nelse:\n    print('OK')", ["Tres ramas en orden: caso exacto, rango, resto.", "if stock == 0 ... elif stock < 15 ... else", "Con stock = 8 debe imprimir 'Bajo'."]),
          ex("py-b1-l4-e2", "Con un for, imprime cada producto en una línea con el formato 'Producto: <nombre>'.", "productos = ['Refrigeradora', 'Licuadora', 'Televisor']\n", "productos = ['Refrigeradora', 'Licuadora', 'Televisor']\nfor p in productos:\n    print(f'Producto: {p}')", ["Un for sobre la lista y un print dentro.", "for p in productos:", "print(f'Producto: {p}') indentado"]),
          ex("py-b1-l4-e3", "Suma los precios mayores a 90 usando un for con acumulador e imprime el total.", "precios = [100, 250, 80, 45, 95]\ntotal = 0\n", "precios = [100, 250, 80, 45, 95]\ntotal = 0\nfor p in precios:\n    if p > 90:\n        total += p\nprint(total)", ["Acumulador + condición dentro del bucle.", "if p > 90: total += p", "print(total) fuera del for"]),
          ex("py-b1-l4-e4", "Imprime los números del 1 al 5 usando range (uno por línea).", "", "for i in range(1, 6):\n    print(i)", ["range admite inicio y fin (exclusivo).", "range(1, 6)", "for i in range(1, 6): print(i)"]),
        ] },
      { id: "py-b1-l5", title: "Listas por comprensión",
        theory: ["[expr for x in lista] transforma cada elemento.", "[x for x in lista if cond] filtra.", "Puedes combinar: [f(x) for x in l if cond].", "Más legible que for + append para transformaciones simples."],
        exercises: [
          ex("py-b1-l5-e1", "Aplica 10% de descuento a cada precio con una comprensión e imprime la lista.", "precios = [100, 250, 80]\n", "precios = [100, 250, 80]\nprint([p * 0.9 for p in precios])", ["Cada precio por 0.9.", "[p * 0.9 for p in precios]", "print([p * 0.9 for p in precios])"]),
          ex("py-b1-l5-e2", "Imprime la lista de precios mayores a 90 (comprensión con if).", "precios = [100, 250, 80, 45, 95]\n", "precios = [100, 250, 80, 45, 95]\nprint([p for p in precios if p > 90])", ["El filtro va al final.", "[p for p in precios if ...]", "print([p for p in precios if p > 90])"]),
          ex("py-b1-l5-e3", "Convierte los nombres a mayúsculas, pero solo los que empiezan con 'L'. Imprime la lista.", "nombres = ['Licuadora', 'Televisor', 'Lavadora', 'Cocina']\n", "nombres = ['Licuadora', 'Televisor', 'Lavadora', 'Cocina']\nprint([n.upper() for n in nombres if n.startswith('L')])", ["Transformación + filtro en la misma comprensión.", "n.upper() ... if n.startswith('L')", "print([n.upper() for n in nombres if n.startswith('L')])"]),
        ],
        caseStudy: { id: "py-b1-l5-cs", title: "Limpieza exprés de precios scrapeados", context: "Un scraper entrega precios como texto con símbolo y espacios. Antes de analizarlos necesitas convertirlos a números.",
          prompt: "Limpia cada precio (quita '$' y espacios), conviértelo a float e imprime la lista resultante usando una comprensión.",
          starter: "crudos = ['$ 899.99', ' $79.5', '$649.0 ']\n", solution: "crudos = ['$ 899.99', ' $79.5', '$649.0 ']\nprint([float(c.replace('$', '').strip()) for c in crudos])",
          check: "stdout", xp: 50,
          hints: ["Cada elemento necesita replace + strip + float.", "float(c.replace('$', '').strip())", "print([float(c.replace('$', '').strip()) for c in crudos])"] }
      },
    ] },
    { id: "py-i1", level: "intermedio", title: "Funciones y diccionarios", lessons: [
      { id: "py-i1-l1", title: "Funciones",
        theory: ["def nombre(params): define; return devuelve (sin return → None).", "Parámetros con default: def f(x, tasa=0.12).", "Una función debe hacer UNA cosa con nombre claro.", "Probar una función = llamarla con casos conocidos."],
        exercises: [
          ex("py-i1-l1-e1", "Define margen(precio, costo) que retorne el margen % redondeado a 1 decimal ((precio-costo)/precio*100). Imprime margen(200, 150).", "def margen(precio, costo):\n    pass\n\nprint(margen(200, 150))", "def margen(precio, costo):\n    return round((precio - costo) / precio * 100, 1)\n\nprint(margen(200, 150))", ["Reemplaza pass por un return con la fórmula.", "return round(formula, 1)", "return round((precio - costo) / precio * 100, 1)"], { xp: 25 }),
          ex("py-i1-l1-e2", "Define precio_final(precio, iva=0.12) con IVA por defecto. Imprime precio_final(100) y precio_final(100, 0.15), una por línea.", "def precio_final(precio, iva=0.12):\n    pass\n\n", "def precio_final(precio, iva=0.12):\n    return precio * (1 + iva)\n\nprint(precio_final(100))\nprint(precio_final(100, 0.15))", ["El default se usa cuando no pasas el argumento.", "return precio * (1 + iva)", "Llama una vez con un argumento y otra con dos."], { xp: 25 }),
          ex("py-i1-l1-e3", "Define es_kvi(precio, umbral=500) que retorne True si precio >= umbral. Imprime es_kvi(650) y es_kvi(120), una por línea.", "def es_kvi(precio, umbral=500):\n    pass\n\n", "def es_kvi(precio, umbral=500):\n    return precio >= umbral\n\nprint(es_kvi(650))\nprint(es_kvi(120))", ["Una comparación ya ES un booleano; retórnala directa.", "return precio >= umbral", "print(es_kvi(650)) y print(es_kvi(120))"], { xp: 25 }),
        ] },
      { id: "py-i1-l2", title: "Diccionarios",
        theory: ["d = {'clave': valor} mapea clave → valor.", "d.get(k, default) lee sin explotar si falta la clave.", "d[k] = d.get(k, 0) + 1 es el patrón contador.", "d.items() itera pares (clave, valor)."],
        exercises: [
          ex("py-i1-l2-e1", "Imprime el precio de la 'Licuadora' y luego el de 'Parlante' usando get con default 0 (dos líneas).", "precios = {'Refrigeradora': 899.99, 'Licuadora': 79.5}\n", "precios = {'Refrigeradora': 899.99, 'Licuadora': 79.5}\nprint(precios.get('Licuadora', 0))\nprint(precios.get('Parlante', 0))", ["get evita el KeyError con la clave ausente.", "precios.get('Parlante', 0)", "Dos prints con get y default 0."], { xp: 25 }),
          ex("py-i1-l2-e2", "Cuenta cuántas ventas hay por categoría e imprime el diccionario.", "categorias = ['LB', 'EM', 'LB', 'AV', 'EM', 'LB']\nconteo = {}\n", "categorias = ['LB', 'EM', 'LB', 'AV', 'EM', 'LB']\nconteo = {}\nfor c in categorias:\n    conteo[c] = conteo.get(c, 0) + 1\nprint(conteo)", ["Patrón contador dentro de un for.", "conteo[c] = conteo.get(c, 0) + 1", "print(conteo) al final."], { xp: 25 }),
          ex("py-i1-l2-e3", "Recorre el dict e imprime una línea 'producto: precio' por cada par.", "precios = {'Refrigeradora': 899.99, 'Licuadora': 79.5, 'Televisor': 649.0}\n", "precios = {'Refrigeradora': 899.99, 'Licuadora': 79.5, 'Televisor': 649.0}\nfor prod, precio in precios.items():\n    print(f'{prod}: {precio}')", ["items() da los pares desempacados.", "for prod, precio in precios.items():", "print(f'{prod}: {precio}')"], { xp: 25 }),
          ex("py-i1-l2-e4", "Sube 5% todos los precios del dict con una comprensión de diccionario e imprime el resultado.", "precios = {'A': 100, 'B': 200}\n", "precios = {'A': 100, 'B': 200}\nprint({k: v * 1.05 for k, v in precios.items()})", ["Existe la comprensión {k: f(v) for ...}.", "{k: v * 1.05 for k, v in precios.items()}", "print({k: v * 1.05 for k, v in precios.items()})"], { xp: 25 }),
        ],
        caseStudy: { id: "py-i1-l2-cs", title: "Tabla de tipos de cambio", context: "Un mini conversor para el equipo de compras: reciben montos en USD y deben reportarlos en varias monedas con una tabla de cambio del día.",
          prompt: "Define convertir(monto, moneda, tabla) que retorne monto * tasa usando get (si la moneda no existe, retorna None). Imprime convertir(100, 'EUR', tasas) y convertir(100, 'GBP', tasas), una por línea.",
          starter: "tasas = {'EUR': 0.92, 'COP': 4100}\n\ndef convertir(monto, moneda, tabla):\n    pass\n\n", solution: "tasas = {'EUR': 0.92, 'COP': 4100}\n\ndef convertir(monto, moneda, tabla):\n    tasa = tabla.get(moneda)\n    if tasa is None:\n        return None\n    return monto * tasa\n\nprint(convertir(100, 'EUR', tasas))\nprint(convertir(100, 'GBP', tasas))", check: "stdout", xp: 50,
          hints: ["get sin default devuelve None si falta la clave.", "tasa = tabla.get(moneda); si es None retorna None.", "return monto * tasa en el caso normal."] }
      },
      { id: "py-i1-l3", title: "Tuplas, zip y enumerate",
        theory: ["Las tuplas son listas inmutables: (a, b). Se desempacan: cat, u = ('LB', 5).", "zip(a, b) empareja dos listas elemento a elemento.", "enumerate(l) da (índice, valor) al iterar.", "Son la base para recorrer datos tabulares sin pandas."],
        exercises: [
          ex("py-i1-l3-e1", "Empareja productos con precios usando zip e imprime 'producto: precio' por línea.", "productos = ['Refrigeradora', 'Licuadora']\nprecios = [899.99, 79.5]\n", "productos = ['Refrigeradora', 'Licuadora']\nprecios = [899.99, 79.5]\nfor prod, precio in zip(productos, precios):\n    print(f'{prod}: {precio}')", ["zip une las dos listas por posición.", "for prod, precio in zip(productos, precios):", "print(f'{prod}: {precio}')"], { xp: 25 }),
          ex("py-i1-l3-e2", "Imprime cada producto con su posición empezando en 1, formato '1. Refrigeradora'.", "productos = ['Refrigeradora', 'Licuadora', 'Televisor']\n", "productos = ['Refrigeradora', 'Licuadora', 'Televisor']\nfor i, p in enumerate(productos, 1):\n    print(f'{i}. {p}')", ["enumerate acepta el inicio como segundo argumento.", "enumerate(productos, 1)", "print(f'{i}. {p}')"], { xp: 25 }),
          ex("py-i1-l3-e3", "Convierte la lista de tuplas (nombre, precio) en un diccionario con dict() e imprímelo.", "pares = [('Refrigeradora', 899.99), ('Licuadora', 79.5)]\n", "pares = [('Refrigeradora', 899.99), ('Licuadora', 79.5)]\nprint(dict(pares))", ["dict() acepta directamente pares clave-valor.", "dict(pares)", "print(dict(pares))"], { xp: 25 }),
        ] },
      { id: "py-i1-l4", title: "Ordenar con key y lambda",
        theory: ["sorted(l, key=funcion) ordena por lo que retorna la función.", "lambda x: x[1] es una función anónima de una línea.", "reverse=True invierte.", "Ordenar dicts: sorted(d.items(), key=lambda kv: kv[1])."],
        exercises: [
          ex("py-i1-l4-e1", "Ordena los productos (tuplas nombre, precio) por precio ascendente e imprime la lista.", "prods = [('Refrigeradora', 899.99), ('Licuadora', 79.5), ('Televisor', 649.0)]\n", "prods = [('Refrigeradora', 899.99), ('Licuadora', 79.5), ('Televisor', 649.0)]\nprint(sorted(prods, key=lambda p: p[1]))", ["La key extrae el precio de cada tupla.", "key=lambda p: p[1]", "print(sorted(prods, key=lambda p: p[1]))"], { xp: 25 }),
          ex("py-i1-l4-e2", "Imprime el nombre del producto MÁS CARO usando max con key.", "prods = [('Refrigeradora', 899.99), ('Licuadora', 79.5), ('Televisor', 649.0)]\n", "prods = [('Refrigeradora', 899.99), ('Licuadora', 79.5), ('Televisor', 649.0)]\nprint(max(prods, key=lambda p: p[1])[0])", ["max también acepta key.", "max(prods, key=lambda p: p[1])", "Del resultado toma el índice [0] (el nombre)."], { xp: 25 }),
          ex("py-i1-l4-e3", "Ordena los nombres por longitud, de más corto a más largo, e imprime la lista.", "nombres = ['Refrigeradora', 'TV', 'Licuadora']\n", "nombres = ['Refrigeradora', 'TV', 'Licuadora']\nprint(sorted(nombres, key=len))", ["len ya es una función: úsala como key directamente.", "key=len", "print(sorted(nombres, key=len))"], { xp: 25 }),
        ] },
    ] },
    { id: "py-a1", level: "avanzado", title: "Complejidad y estructuras", lessons: [
      { id: "py-a1-l1", title: "Por qué set gana a lista",
        theory: ["'x in lista' recorre todo: O(n). 'x in set' usa hash: O(1).", "Con 10 elementos da igual; con 1 millón, es segundos vs milisegundos.", "Concepto: elegir la estructura correcta > escribir código 'inteligente'.", "Patrón real: validar códigos contra un catálogo → catálogo a set."],
        exercises: [
          ex("py-a1-l1-e1", "Convierte el catálogo a set e imprime la lista de escaneados que NO están en él (en su orden original).", "escaneados = ['A1', 'B7', 'A1', 'C3', 'Z9', 'B7', 'X0']\ncatalogo = ['A1', 'B7', 'C3', 'D4']\n", "escaneados = ['A1', 'B7', 'A1', 'C3', 'Z9', 'B7', 'X0']\ncatalogo = ['A1', 'B7', 'C3', 'D4']\nvalidos = set(catalogo)\nprint([c for c in escaneados if c not in validos])", ["Cada 'in' sobre lista es O(n); convierte a set UNA vez.", "validos = set(catalogo)", "print([c for c in escaneados if c not in validos])"], { xp: 30 }),
          ex("py-a1-l1-e2", "Imprime cuántos códigos ÚNICOS fueron escaneados.", "escaneados = ['A1', 'B7', 'A1', 'C3', 'Z9', 'B7', 'X0']\n", "escaneados = ['A1', 'B7', 'A1', 'C3', 'Z9', 'B7', 'X0']\nprint(len(set(escaneados)))", ["Un set no admite duplicados.", "set(escaneados)", "print(len(set(escaneados)))"], { xp: 30 }),
          ex("py-a1-l1-e3", "Operaciones de conjuntos: imprime (ordenados con sorted) los códigos que están en AMBAS listas, y luego los que están solo en la primera. Dos líneas.", "lista_a = ['A1', 'B7', 'C3']\nlista_b = ['B7', 'C3', 'D4']\n", "lista_a = ['A1', 'B7', 'C3']\nlista_b = ['B7', 'C3', 'D4']\nprint(sorted(set(lista_a) & set(lista_b)))\nprint(sorted(set(lista_a) - set(lista_b)))", ["Concepto: intersección (&) y diferencia (-) de conjuntos.", "set(a) & set(b) y set(a) - set(b)", "Envuelve ambos en sorted() para orden determinista."], { xp: 30 }),
        ] },
      { id: "py-a1-l2", title: "Mutabilidad: el bug silencioso",
        theory: ["b = a NO copia una lista: ambas variables apuntan al MISMO objeto.", "Mutar b también 'cambia' a — el bug más traicionero de Python.", "Copia superficial: a[:] o list(a). Las tuplas son inmutables por diseño.", "Concepto: saber qué se copia y qué se comparte evita horas de debugging."],
        exercises: [
          ex("py-a1-l2-e1", "Copia la lista de forma segura en 'copia', agrega 999 solo a la copia e imprime original y copia (dos líneas).", "original = [100, 200]\n", "original = [100, 200]\ncopia = original[:]\ncopia.append(999)\nprint(original)\nprint(copia)", ["b = a no copia; usa slicing o list().", "copia = original[:]", "append solo a copia, luego imprime ambas."], { xp: 30 }),
          ex("py-a1-l2-e2", "Predice y demuestra: crea x = [1, 2], asigna y = x, haz y.append(3) e imprime x. Comenta el resultado imprimiendo también 'mismo objeto:' seguido de x is y.", "x = [1, 2]\n", "x = [1, 2]\ny = x\ny.append(3)\nprint(x)\nprint('mismo objeto:', y is x)", ["Concepto: asignar no copia, crea un alias.", "y = x; y.append(3); imprime x.", "print('mismo objeto:', y is x) — 'is' compara identidad."], { xp: 30 }),
        ] },
    ] },
    { id: "py-a2", level: "avanzado", title: "Patrones de datos", lessons: [
      { id: "py-a2-l1", title: "Split-apply-combine",
        theory: ["Split-apply-combine: dividir en grupos, agregar, combinar.", "Es EL patrón detrás de GROUP BY en SQL y groupby en pandas.", "En Python puro: un dict acumulador en UNA pasada (O(n)), no bucles anidados (O(n²)).", "Dominarlo a mano hace trivial a pandas después."],
        exercises: [
          ex("py-a2-l1-e1", "Agrupa por categoría sumando unidades e imprime 'categoria: total' por línea, en orden alfabético. UNA sola pasada.", "ventas = [('LB', 5), ('EM', 12), ('LB', 3), ('EM', 8)]\ntotales = {}\n", "ventas = [('LB', 5), ('EM', 12), ('LB', 3), ('EM', 8)]\ntotales = {}\nfor cat, u in ventas:\n    totales[cat] = totales.get(cat, 0) + u\nfor cat in sorted(totales):\n    print(f'{cat}: {totales[cat]}')", ["Acumula en el dict mientras recorres.", "totales[cat] = totales.get(cat, 0) + u", "for cat in sorted(totales): print(f'{cat}: {totales[cat]}')"], { xp: 30 }),
          ex("py-a2-l1-e2", "Promedio por grupo: acumula suma y conteo por categoría e imprime 'categoria: promedio' (redondeado a 1) en orden alfabético.", "ventas = [('LB', 10), ('EM', 12), ('LB', 20), ('EM', 8)]\nacum = {}\n", "ventas = [('LB', 10), ('EM', 12), ('LB', 20), ('EM', 8)]\nacum = {}\nfor cat, u in ventas:\n    s, n = acum.get(cat, (0, 0))\n    acum[cat] = (s + u, n + 1)\nfor cat in sorted(acum):\n    s, n = acum[cat]\n    print(f'{cat}: {round(s / n, 1)}')", ["Concepto: para promediar necesitas DOS acumuladores (suma y conteo) por grupo.", "Guarda una tupla (suma, conteo) por categoría.", "s, n = acum.get(cat, (0, 0)); acum[cat] = (s + u, n + 1)"], { xp: 30 }),
          ex("py-a2-l1-e3", "Agrupa nombres de producto por categoría en listas e imprime 'categoria: [lista]' en orden alfabético.", "filas = [('LB', 'Refrigeradora'), ('EM', 'Licuadora'), ('LB', 'Cocina')]\ngrupos = {}\n", "filas = [('LB', 'Refrigeradora'), ('EM', 'Licuadora'), ('LB', 'Cocina')]\ngrupos = {}\nfor cat, prod in filas:\n    grupos.setdefault(cat, []).append(prod)\nfor cat in sorted(grupos):\n    print(f'{cat}: {grupos[cat]}')", ["Concepto: agrupar en listas usa setdefault (o get con lista vacía).", "grupos.setdefault(cat, []).append(prod)", "Itera sorted(grupos) e imprime cada par."], { xp: 30 }),
        ],
        caseStudy: { id: "py-a2-l1-cs", title: "Top categoría del día", context: "El gerente comercial quiere, al cierre del día, la categoría con más unidades vendidas, sin esperar el refresh del data warehouse.",
          prompt: "Imprime una línea: 'Top: <categoria> (<total>)' con la categoría de mayores unidades. Empate: gana la primera alfabéticamente.",
          starter: "ventas = [('LB', 5), ('EM', 12), ('LB', 3), ('AV', 9), ('EM', 8)]\ntotales = {}\n", solution: "ventas = [('LB', 5), ('EM', 12), ('LB', 3), ('AV', 9), ('EM', 8)]\ntotales = {}\nfor cat, u in ventas:\n    totales[cat] = totales.get(cat, 0) + u\ntop = sorted(totales.items(), key=lambda kv: (-kv[1], kv[0]))[0]\nprint(f'Top: {top[0]} ({top[1]})')", check: "stdout", xp: 50,
          hints: ["Primero agrupa; luego ordena los items del dict.", "key=lambda kv: (-kv[1], kv[0]) pone al mayor primero y desempata alfabéticamente.", "top = sorted(...)[0]; print(f'Top: {top[0]} ({top[1]})')"] }
      },
      { id: "py-a2-l2", title: "Generadores y lazy evaluation",
        theory: ["(expr for x in l) crea un generador: no calcula nada hasta que se consume.", "Concepto: procesar millones de filas sin cargarlas todas en memoria.", "sum(x for x in l if cond) agrega sin construir una lista intermedia.", "Un generador se agota: solo se puede recorrer una vez."],
        exercises: [
          ex("py-a2-l2-e1", "Suma los montos mayores a 100 usando una expresión generadora (sin crear lista) e imprime el total.", "montos = [50, 300, 120, 80, 500]\n", "montos = [50, 300, 120, 80, 500]\nprint(sum(m for m in montos if m > 100))", ["Igual que una comprensión pero sin corchetes.", "sum(m for m in montos if m > 100)", "print(sum(m for m in montos if m > 100))"], { xp: 30 }),
          ex("py-a2-l2-e2", "Demuestra que un generador se agota: créalo, imprime sum(g) y luego imprime sum(g) otra vez.", "g = (x for x in [1, 2, 3])\n", "g = (x for x in [1, 2, 3])\nprint(sum(g))\nprint(sum(g))", ["Concepto: la segunda pasada no tiene elementos.", "Dos sum(g) seguidos.", "El segundo imprime 0: el generador ya se consumió."], { xp: 30 }),
        ] },
      { id: "py-a2-l3", title: "Errores y código defensivo",
        theory: ["try/except captura errores esperables (conversión, división, clave ausente).", "Captura errores ESPECÍFICOS (ValueError), nunca un except desnudo.", "Concepto: los datos reales siempre vienen sucios; el código de producción lo asume.", "Patrón: intentar convertir, y decidir qué hacer con lo inválido (descartar, default, log)."],
        exercises: [
          ex("py-a2-l3-e1", "Convierte a float los valores válidos y descarta los inválidos con try/except ValueError. Imprime la lista limpia.", "crudos = ['899.99', 'N/A', '79.5', 'error', '649.0']\nlimpios = []\n", "crudos = ['899.99', 'N/A', '79.5', 'error', '649.0']\nlimpios = []\nfor c in crudos:\n    try:\n        limpios.append(float(c))\n    except ValueError:\n        pass\nprint(limpios)", ["Intenta convertir dentro del try; el except descarta.", "try: limpios.append(float(c)) / except ValueError: pass", "print(limpios) al final."], { xp: 30 }),
          ex("py-a2-l3-e2", "División segura: define dividir(a, b) que retorne a/b, o None si b es 0 (usa try/except ZeroDivisionError). Imprime dividir(10, 2) y dividir(5, 0), una por línea.", "def dividir(a, b):\n    pass\n\n", "def dividir(a, b):\n    try:\n        return a / b\n    except ZeroDivisionError:\n        return None\n\nprint(dividir(10, 2))\nprint(dividir(5, 0))", ["El return puede vivir dentro del try y del except.", "except ZeroDivisionError: return None", "print(dividir(10, 2)) y print(dividir(5, 0))"], { xp: 30 }),
        ] },
      { id: "py-a2-l4", title: "Recursión y algoritmos clásicos",
        theory: ["Recursión: una función que se llama a sí misma con un caso base que la detiene.", "Todo lo recursivo puede escribirse iterativo; elige por claridad.", "Búsqueda binaria: en datos ORDENADOS, descarta la mitad en cada paso → O(log n).", "Concepto: reconocer cuándo un problema se parte en subproblemas iguales."],
        exercises: [
          ex("py-a2-l4-e1", "Implementa factorial(n) de forma recursiva (caso base: n <= 1 retorna 1). Imprime factorial(5).", "def factorial(n):\n    pass\n\nprint(factorial(5))", "def factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(5))", ["Caso base primero, luego la llamada a sí misma.", "if n <= 1: return 1", "return n * factorial(n - 1)"], { xp: 30 }),
          ex("py-a2-l4-e2", "Búsqueda binaria: completa la función para que retorne el índice de x en la lista ordenada (o -1). Imprime buscar(datos, 23) y buscar(datos, 4), una por línea.", "def buscar(lista, x):\n    lo, hi = 0, len(lista) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        # completa: compara lista[mid] con x\n    return -1\n\ndatos = [2, 5, 8, 12, 16, 23, 38]\n", "def buscar(lista, x):\n    lo, hi = 0, len(lista) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if lista[mid] == x:\n            return mid\n        elif lista[mid] < x:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1\n\ndatos = [2, 5, 8, 12, 16, 23, 38]\nprint(buscar(datos, 23))\nprint(buscar(datos, 4))", ["Tres casos: igual (encontrado), menor (busca a la derecha), mayor (a la izquierda).", "if lista[mid] == x: return mid / elif lista[mid] < x: lo = mid + 1 / else: hi = mid - 1", "Al final imprime buscar(datos, 23) → 5 y buscar(datos, 4) → -1."], { xp: 30 }),
          ex("py-a2-l4-e3", "Memoización manual: completa fib(n) con un dict cache para no recalcular. Imprime fib(20).", "cache = {}\n\ndef fib(n):\n    if n in cache:\n        return cache[n]\n    # caso base y recursión con guardado en cache\n\nprint(fib(20))", "cache = {}\n\ndef fib(n):\n    if n in cache:\n        return cache[n]\n    if n <= 1:\n        return n\n    cache[n] = fib(n - 1) + fib(n - 2)\n    return cache[n]\n\nprint(fib(20))", ["Concepto: guardar resultados ya calculados convierte O(2^n) en O(n).", "if n <= 1: return n como caso base.", "cache[n] = fib(n-1) + fib(n-2); return cache[n]"], { xp: 30 }),
        ],
        caseStudy: { id: "py-a2-l4-cs", title: "Pipeline mínimo de datos", context: "Recibes un 'archivo' de líneas CSV crudas de ventas. Debes armar el mini ETL completo: parsear, limpiar, agrupar y reportar — el esqueleto de cualquier pipeline real.",
          prompt: "Parsea cada línea (categoria,monto), descarta montos inválidos con try/except, agrupa sumando por categoría e imprime 'categoria: total' en orden alfabético.",
          starter: "lineas = ['LB,899.99', 'EM,79.5', 'LB,error', 'AV,649.0', 'EM,120.0']\ntotales = {}\n", solution: "lineas = ['LB,899.99', 'EM,79.5', 'LB,error', 'AV,649.0', 'EM,120.0']\ntotales = {}\nfor linea in lineas:\n    cat, monto = linea.split(',')\n    try:\n        valor = float(monto)\n    except ValueError:\n        continue\n    totales[cat] = totales.get(cat, 0) + valor\nfor cat in sorted(totales):\n    print(f'{cat}: {totales[cat]}')", check: "stdout", xp: 50,
          hints: ["Es la suma de tres patrones que ya practicaste: split, try/except y dict acumulador.", "cat, monto = linea.split(',') y convierte con try; continue si falla.", "totales[cat] = totales.get(cat, 0) + valor; al final itera sorted(totales)."] }
      },
    ] },
  ] },
] };

const LEVEL_LABEL = { basico: "Básico", intermedio: "Intermedio", avanzado: "Avanzado" };
const LEVEL_DESC = {
  basico: "Sintaxis y primeros resultados",
  intermedio: "Combinar herramientas para resolver problemas",
  avanzado: "Conceptos profundos con código simple"
};
const LEVEL_ORDER = ["basico", "intermedio", "avanzado"];

// ---------- RUNNERS ----------
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => rej(new Error("No se pudo cargar " + src));
    document.head.appendChild(s);
  });
}
let pyodidePromise = null;
const PYODIDE_BASE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = loadScript(PYODIDE_BASE + "pyodide.js")
      .then(() => window.loadPyodide({ indexURL: PYODIDE_BASE }))
      .catch(err => { pyodidePromise = null; throw err; }); // no cachear fallos: permite reintentar
  }
  return pyodidePromise;
}
async function runPython(code) {
  let py;
  try { py = await getPyodide(); }
  catch (e) { return { ok: false, out: "No se pudo cargar el motor de Python (Pyodide): " + String(e.message || e) }; }
  await py.runPythonAsync("import sys, io\nsys.stdout = io.StringIO()\nsys.stderr = sys.stdout");
  try {
    await py.runPythonAsync(code);
    return { ok: true, out: py.runPython("sys.stdout.getvalue()") };
  } catch (e) { return { ok: false, out: String(e.message || e) }; }
}
let sqlPromise = null;
function getSql() {
  if (!sqlPromise) {
    sqlPromise = loadScript("https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js")
      .then(() => window.initSqlJs({ locateFile: f => "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/" + f }));
  }
  return sqlPromise;
}
async function runSql(setup, code) {
  const SQL = await getSql();
  const db = new SQL.Database();
  try {
    if (setup) db.run(setup);
    const res = db.exec(code);
    return { ok: true, results: res };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
  finally { db.close(); }
}
const sqlResultKey = res => JSON.stringify((res || []).map(r => ({ c: r.columns, v: r.values })));

// ---------- EXPLORADOR DE ESQUEMA / CONTEXTO ----------
function parseSqlSchema(setup) {
  if (!setup) return [];
  const tables = [];
  const re = /CREATE\s+TABLE\s+(\w+)\s*\(([^;]*)\)/gi;
  let m;
  while ((m = re.exec(setup))) {
    const cols = m[2].split(",").map(c => {
      const parts = c.trim().split(/\s+/);
      return { name: parts[0], type: (parts[1] || "").toUpperCase(), pk: /PRIMARY/i.test(c) };
    }).filter(c => c.name && !/^(PRIMARY|FOREIGN|UNIQUE|CONSTRAINT)$/i.test(c.name));
    tables.push({ name: m[1], cols });
  }
  return tables;
}
function parsePyVars(starter) {
  if (!starter) return [];
  const vars = [];
  starter.split("\n").forEach(line => {
    const m = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (!m) return;
    const val = m[2].trim();
    let type = "valor";
    if (val.startsWith("[")) type = "list";
    else if (val.startsWith("{")) type = "dict";
    else if (val.startsWith("(")) type = "tuple / gen";
    else if (val.startsWith("'") || val.startsWith('"')) type = "str";
    else if (/^\d+\.\d+/.test(val)) type = "float";
    else if (/^\d+$/.test(val)) type = "int";
    vars.push({ name: m[1], type, preview: val.length > 46 ? val.slice(0, 43) + "…" : val });
  });
  return vars;
}

// ---------- PERSISTENCIA ----------
const emptyProgress = () => ({ xp: 0, streak: 0, lastDay: null, done: {}, xpLog: {}, badges: [] });
async function loadProgress() {
  try { const r = await window.storage.get("codegym-progress-v1"); return r ? { ...emptyProgress(), ...JSON.parse(r.value) } : emptyProgress(); }
  catch { return emptyProgress(); }
}
async function saveProgress(p) { try { await window.storage.set("codegym-progress-v1", JSON.stringify(p)); } catch {} }
const todayStr = () => new Date().toISOString().slice(0, 10);

// ---------- BADGES ----------
const BADGES = [
  { id: "first", name: "Primer paso", desc: "Completa tu primer ejercicio", test: p => Object.keys(p.done).length >= 1 },
  { id: "streak3", name: "Racha ×3", desc: "3 días seguidos practicando", test: p => p.streak >= 3 },
  { id: "streak7", name: "Racha ×7", desc: "7 días seguidos", test: p => p.streak >= 7 },
  { id: "xp200", name: "200 XP", desc: "Acumula 200 XP", test: p => p.xp >= 200 },
  { id: "xp500", name: "500 XP", desc: "Acumula 500 XP", test: p => p.xp >= 500 },
  { id: "case1", name: "Consultor", desc: "Resuelve un caso de estudio", test: p => Object.keys(p.done).some(k => k.startsWith("case:")) },
  { id: "adv1", name: "Conceptual", desc: "Resuelve un ejercicio avanzado", test: p => Object.keys(p.done).some(k => /-(a\d)-/.test(k)) },
  { id: "ex25", name: "Maratonista", desc: "25 ejercicios resueltos", test: p => Object.keys(p.done).length >= 25 },
];

// ---------- UI TOKENS ----------
const ui = {
  bg: "#F4F6F8", ink: "#152238", sub: "#5B6B80", card: "#FFFFFF",
  line: "#DFE5EC", accent: "#E85D2F", ok: "#0E7C66", err: "#B3261E",
  mono: "'JetBrains Mono','SFMono-Regular',Consolas,monospace",
  sans: "'Inter',system-ui,sans-serif",
};
function btn(kind) {
  const base = { border: "none", borderRadius: 9, padding: "8px 14px", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: ui.sans };
  if (kind === "primary") return { ...base, background: ui.accent, color: "#fff" };
  return { ...base, background: "#EDF1F5", color: ui.ink };
}
const Chevron = ({ open }) => (
  <span style={{ fontSize: 17, lineHeight: 1, color: ui.accent, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", display: "inline-block" }}>➤</span>
);

// ---------- COMPONENTES ----------
function XPToast({ toast }) {
  if (!toast) return null;
  return <div style={{ position: "fixed", top: 18, right: 18, zIndex: 60, background: ui.ink, color: "#fff", padding: "10px 18px", borderRadius: 10, fontFamily: ui.sans, fontWeight: 700, boxShadow: "0 8px 24px rgba(0,0,0,.25)", animation: "pop .25s ease" }}>{toast}</div>;
}

function SchemaPanel({ lang, ex }) {
  const [open, setOpen] = useState(true);
  const sqlTables = useMemo(() => lang.runner === "sql" ? parseSqlSchema(ex.setup) : [], [lang, ex]);
  const pyVars = useMemo(() => lang.runner === "python" ? parsePyVars(ex.starter) : [], [lang, ex]);
  if (lang.runner === "sql" && !sqlTables.length) return null;
  if (lang.runner === "python" && !pyVars.length) return null;
  return (
    <div style={{ border: `1px solid ${ui.line}`, borderRadius: 10, background: "#F7F9FB", marginBottom: 10 }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "8px 12px", cursor: "pointer", fontWeight: 800, fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase", color: ui.sub, display: "flex", alignItems: "center", gap: 8 }}>
        <Chevron open={open} />
        {lang.runner === "sql" ? "🗄 Esquema de la base (tablas y columnas)" : "🧭 Variables disponibles"}
      </button>
      {open && (
        <div style={{ padding: "0 12px 12px", display: "flex", gap: 14, flexWrap: "wrap" }}>
          {lang.runner === "sql" && sqlTables.map(t => (
            <div key={t.name} style={{ fontFamily: ui.mono, fontSize: 12.5, background: ui.card, border: `1px solid ${ui.line}`, borderRadius: 8, padding: "8px 12px", minWidth: 150 }}>
              <div style={{ fontWeight: 800, color: lang.color, borderBottom: `1px solid ${ui.line}`, paddingBottom: 4, marginBottom: 4 }}>📋 {t.name}</div>
              {t.cols.map(c => (
                <div key={c.name} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>{c.pk ? "🔑 " : ""}{c.name}</span>
                  <span style={{ color: ui.sub }}>{c.type}</span>
                </div>
              ))}
            </div>
          ))}
          {lang.runner === "python" && (
            <div style={{ fontFamily: ui.mono, fontSize: 12.5, background: ui.card, border: `1px solid ${ui.line}`, borderRadius: 8, padding: "8px 12px", width: "100%", boxSizing: "border-box" }}>
              {pyVars.map(v => (
                <div key={v.name} style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800, color: lang.color }}>{v.name}</span>
                  <span style={{ color: ui.sub }}>: {v.type}</span>
                  <span style={{ color: ui.sub, opacity: .8 }}>= {v.preview}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultBox({ result }) {
  if (!result) return null;
  const { ok, text, table } = result;
  return (
    <div style={{ marginTop: 10, borderRadius: 10, border: `1px solid ${ok ? "#BFE3D9" : "#F1C4C0"}`, background: ok ? "#F0FAF7" : "#FDF3F2", padding: 12, fontFamily: ui.mono, fontSize: 12.5, whiteSpace: "pre-wrap", overflowX: "auto" }}>
      {table ? (
        <table style={{ borderCollapse: "collapse" }}>
          <thead><tr>{table.columns.map(c => <th key={c} style={{ textAlign: "left", padding: "3px 12px 3px 0", borderBottom: `1px solid ${ui.line}` }}>{c}</th>)}</tr></thead>
          <tbody>{table.values.map((row, i) => <tr key={i}>{row.map((v, j) => <td key={j} style={{ padding: "3px 12px 3px 0" }}>{String(v)}</td>)}</tr>)}</tbody>
        </table>
      ) : text}
    </div>
  );
}

function HintLadder({ exercise }) {
  const [phase, setPhase] = useState(0);
  const hints = exercise.hints || [];
  const maxPhase = hints.length + 1;
  return (
    <div style={{ marginTop: 10 }}>
      {phase < maxPhase && (
        <button onClick={() => setPhase(phase + 1)} style={{ ...btn("ghost"), fontSize: 12.5 }}>
          {phase === 0 ? "💡 Necesito una pista" : phase < hints.length ? `💡 Pista ${phase + 1} de ${hints.length}` : "🔓 Ver la solución"}
        </button>
      )}
      {phase > 0 && (
        <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
          {hints.slice(0, Math.min(phase, hints.length)).map((h, i) => (
            <div key={i} style={{ fontSize: 13, color: ui.ink, background: "#FFF9F0", border: "1px solid #F0DFC2", borderRadius: 8, padding: "8px 12px" }}>
              <b style={{ color: "#9A6B15" }}>Pista {i + 1}:</b> {h}
            </div>
          ))}
          {phase >= maxPhase && (
            <div style={{ background: "#0F1B2D", color: "#E8EEF6", borderRadius: 8, padding: "10px 12px", fontFamily: ui.mono, fontSize: 12.5, whiteSpace: "pre-wrap" }}>
              <div style={{ color: "#9FB3CC", fontFamily: ui.sans, fontWeight: 700, fontSize: 11.5, marginBottom: 6 }}>SOLUCIÓN — estúdiala, escríbela tú y valida. Aprender de la solución también es aprender.</div>
              {exercise.solution}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExerciseCard({ exercise, lang, kind, progress, onSolved }) {
  const key = (kind === "case" ? "case:" : "ex:") + exercise.id;
  const done = !!progress.done[key];
  const [code, setCode] = useState(exercise.starter || "");
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState(done ? "done" : "idle");

  const run = async (validate) => {
    setStatus("running"); setResult(null);
    if (lang.runner === "python") {
      const r = await runPython(code);
      if (!r.ok) { setResult({ ok: false, text: r.out }); setStatus("fail"); return; }
      if (!validate) { setResult({ ok: true, text: r.out || "(sin salida)" }); setStatus(done ? "done" : "idle"); return; }
      const sol = await runPython(exercise.solution);
      const pass = r.out.trim() === sol.out.trim();
      setResult({ ok: pass, text: pass ? "✔ Salida correcta:\n" + r.out : "✘ Tu salida:\n" + (r.out || "(vacía)") + "\nSalida esperada:\n" + sol.out });
      if (pass) { setStatus("done"); if (!done) onSolved(key, exercise.xp || 20); } else setStatus("fail");
    } else {
      const r = await runSql(exercise.setup, code);
      if (!r.ok) { setResult({ ok: false, text: r.error }); setStatus("fail"); return; }
      const first = r.results[0];
      if (!validate) { setResult({ ok: true, table: first || null, text: first ? null : "Consulta ejecutada (sin filas)" }); setStatus(done ? "done" : "idle"); return; }
      const sol = await runSql(exercise.setup, exercise.solution);
      const pass = sqlResultKey(r.results) === sqlResultKey(sol.results);
      setResult({ ok: pass, table: pass ? first : null, text: pass ? null : "✘ El resultado no coincide con el esperado. Revisa columnas, filtros y orden." });
      if (pass) { setStatus("done"); if (!done) onSolved(key, exercise.xp || 20); } else setStatus("fail");
    }
  };

  return (
    <div style={{ background: ui.card, border: `1px solid ${status === "done" ? "#BFE3D9" : ui.line}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div style={{ fontWeight: 700, fontSize: 14.5 }}>{kind === "case" ? "🏢 " + exercise.title : exercise.prompt}</div>
        <div style={{ fontFamily: ui.mono, fontSize: 12, color: status === "done" ? ui.ok : ui.sub, whiteSpace: "nowrap" }}>
          {status === "done" ? "✔ resuelto" : `+${exercise.xp || 20} XP`}
        </div>
      </div>
      {kind === "case" && <p style={{ color: ui.sub, fontSize: 13.5, margin: "8px 0 4px" }}>{exercise.context}</p>}
      {kind === "case" && <p style={{ fontSize: 13.5, margin: "4px 0 10px", fontWeight: 600 }}>{exercise.prompt}</p>}
      <div style={{ marginTop: 10 }}>
        <SchemaPanel lang={lang} ex={exercise} />
        <textarea value={code} onChange={e => setCode(e.target.value)} spellCheck={false}
          style={{ width: "100%", minHeight: 150, background: "#0F1B2D", color: "#E8EEF6", border: "none", borderRadius: 10, padding: 14, fontFamily: ui.mono, fontSize: 13.5, lineHeight: 1.55, resize: "vertical", outline: "none", boxSizing: "border-box" }} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        <button onClick={() => run(false)} disabled={status === "running"} style={btn("ghost")}>▶ Ejecutar</button>
        <button onClick={() => run(true)} disabled={status === "running"} style={btn("primary")}>{status === "running" ? "Ejecutando…" : "✓ Validar respuesta"}</button>
        <button onClick={() => setCode(exercise.starter || "")} style={btn("ghost")}>↺ Reiniciar</button>
      </div>
      <HintLadder exercise={exercise} />
      <ResultBox result={result} />
    </div>
  );
}

function CheatSheetDrawer({ lang, onClose }) {
  const sheet = CHEATSHEETS[lang.id] || lang.cheatsheet || [];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 55, display: "flex", justifyContent: "flex-end", background: "rgba(15,27,45,.35)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "min(400px, 92vw)", background: ui.card, height: "100%", overflowY: "auto", padding: 20, boxShadow: "-12px 0 30px rgba(0,0,0,.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>📄 Cheat sheet · <span style={{ color: lang.color }}>{lang.name}</span></div>
          <button onClick={onClose} style={btn("ghost")}>✕</button>
        </div>
        {sheet.map(sec => (
          <div key={sec.title} style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 11.5, letterSpacing: 1, textTransform: "uppercase", color: ui.sub, marginBottom: 6 }}>{sec.title}</div>
            {sec.items.map(([syn, desc], i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "5px 0", borderBottom: `1px solid ${ui.line}`, fontSize: 12.5, alignItems: "baseline" }}>
                <code style={{ fontFamily: ui.mono, background: "#F1F4F8", padding: "2px 6px", borderRadius: 5, whiteSpace: "nowrap", overflow: "auto", maxWidth: "58%" }}>{syn}</code>
                <span style={{ color: ui.sub }}>{desc}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- APP ----------
export default function App() {
  const [progress, setProgress] = useState(emptyProgress());
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState({ page: "home" });
  const [toast, setToast] = useState(null);
  const [cheatLang, setCheatLang] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openKeys, setOpenKeys] = useState({ "sql": true, "sql:basico": true });

  useEffect(() => {
    loadProgress().then(p => {
      const t = todayStr();
      if (p.lastDay && p.lastDay !== t) {
        const diff = Math.round((new Date(t) - new Date(p.lastDay)) / 86400000);
        if (diff > 1) p.streak = 0;
      }
      setProgress(p); setLoaded(true);
    });
  }, []);

  const persist = useCallback(p => { setProgress({ ...p }); saveProgress(p); }, []);
  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 2200); };
  const toggle = k => setOpenKeys(o => ({ ...o, [k]: !o[k] }));

  const onSolved = (key, xp) => {
    const p = { ...progress };
    const t = todayStr();
    if (p.lastDay !== t) {
      const diff = p.lastDay ? Math.round((new Date(t) - new Date(p.lastDay)) / 86400000) : null;
      p.streak = diff === 1 ? p.streak + 1 : 1;
      p.lastDay = t;
    }
    p.done[key] = t;
    p.xp += xp;
    p.xpLog[t] = (p.xpLog[t] || 0) + xp;
    const newBadges = BADGES.filter(b => !p.badges.includes(b.id) && b.test(p)).map(b => b.id);
    p.badges = [...p.badges, ...newBadges];
    persist(p);
    showToast(`+${xp} XP 🔥 racha ${p.streak}` + (newBadges.length ? " · 🏅 insignia nueva" : ""));
  };

  if (!loaded) return <div style={{ fontFamily: ui.sans, padding: 40, color: ui.sub }}>Cargando tu progreso…</div>;

  const level = Math.floor(progress.xp / 100) + 1;
  const levelPct = progress.xp % 100;
  const lessonKeys = les => [...les.exercises.map(e => "ex:" + e.id), ...(les.caseStudy ? ["case:" + les.caseStudy.id] : [])];
  const allExKeys = l => l.modules.flatMap(m => m.lessons.flatMap(lessonKeys));
  const totalEx = CONTENT.languages.flatMap(allExKeys).length;
  const doneCount = Object.keys(progress.done).length;
  const countDone = keys => keys.filter(k => progress.done[k]).length;

  return (
    <div style={{ minHeight: "100vh", background: ui.bg, color: ui.ink, fontFamily: ui.sans }}>
      <style>{`
        @keyframes pop { from { transform: translateY(-8px); opacity: 0 } to { transform: none; opacity: 1 } }
        button:focus-visible, textarea:focus-visible { outline: 2px solid ${ui.accent}; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important } }
      `}</style>
      <XPToast toast={toast} />
      {cheatLang && <CheatSheetDrawer lang={cheatLang} onClose={() => setCheatLang(null)} />}

      <header style={{ background: ui.ink, color: "#fff", padding: "14px 20px" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ fontFamily: ui.mono, fontWeight: 800, fontSize: 15.5, letterSpacing: -0.3, whiteSpace: "nowrap" }}>
            personal<span style={{ color: ui.accent }}>code</span>trainer_
          </div>
          <nav style={{ display: "flex", gap: 6, flex: 1, alignItems: "center" }}>
            {[["home", "Práctica"], ["dashboard", "Dashboard"]].map(([k, label]) => (
              <button key={k} onClick={() => { setView({ page: k }); setMenuOpen(false); }}
                style={{ background: view.page === k ? "rgba(255,255,255,.14)" : "transparent", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                {label}
              </button>
            ))}
            <div style={{ position: "relative" }}>
              <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Más opciones"
                style={{ background: view.page === "schema" || menuOpen ? "rgba(255,255,255,.14)" : "transparent", color: "#fff", border: "none", borderRadius: 8, padding: "0px 12px 6px", cursor: "pointer", fontWeight: 800, fontSize: 22, lineHeight: 1, letterSpacing: 2 }}>
                ⋯
              </button>
              {menuOpen && (
                <div style={{ position: "absolute", top: "110%", left: 0, background: ui.card, color: ui.ink, borderRadius: 10, boxShadow: "0 10px 28px rgba(0,0,0,.25)", padding: 6, zIndex: 70, minWidth: 190 }}>
                  <button onClick={() => { setView({ page: "schema" }); setMenuOpen(false); }}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: 7, padding: "9px 12px", cursor: "pointer", fontSize: 13.5, fontWeight: 600, color: ui.ink }}>
                    🧩 Esquema de contenido
                  </button>
                </div>
              )}
            </div>
          </nav>
          <div style={{ display: "flex", gap: 14, alignItems: "center", fontFamily: ui.mono, fontSize: 13 }}>
            <span>🔥 {progress.streak}</span>
            <span>⚡ {progress.xp} XP</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              Nv.{level}
              <span style={{ width: 60, height: 6, background: "rgba(255,255,255,.2)", borderRadius: 4, overflow: "hidden", display: "inline-block" }}>
                <span style={{ display: "block", width: `${levelPct}%`, height: "100%", background: ui.accent }} />
              </span>
            </span>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "24px 16px 80px" }}>

        {view.page === "home" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 10 }}>
              <div>
                <h1 style={{ fontSize: 24, margin: "4px 0 2px" }}>Tu ruta de práctica</h1>
                <p style={{ color: ui.sub, marginTop: 0, fontSize: 14 }}>
                  Micro-lecciones de 5–10 min · 80% práctica · {doneCount}/{totalEx} ejercicios resueltos
                </p>
              </div>
            </div>

            {CONTENT.languages.map(lang => {
              const langKeys = allExKeys(lang);
              const langDone = countDone(langKeys);
              const langOpen = !!openKeys[lang.id];
              return (
                <section key={lang.id} style={{ marginTop: 18 }}>
                  <button onClick={() => toggle(lang.id)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: ui.ink, border: "none", borderRadius: 12, padding: "14px 16px", cursor: "pointer", textAlign: "left" }}>
                    <Chevron open={langOpen} />
                    <span style={{ fontFamily: ui.mono, fontSize: 18, fontWeight: 800, color: "#fff" }}>{lang.name}</span>
                    <span style={{ flex: 1 }} />
                    <button onClick={e => { e.stopPropagation(); setCheatLang(lang); }} style={{ ...btn("ghost"), background: "rgba(255,255,255,.12)", color: "#fff", fontSize: 12 }}>📄 Cheat sheet</button>
                    <span style={{ fontFamily: ui.mono, fontSize: 12.5, color: langDone === langKeys.length ? "#7BE0C3" : "rgba(255,255,255,.75)", whiteSpace: "nowrap" }}>
                      {langDone}/{langKeys.length}
                    </span>
                  </button>

                  {langOpen && LEVEL_ORDER.map(lv => {
                    const mods = lang.modules.filter(m => m.level === lv);
                    if (!mods.length) return null;
                    const lvKeys = mods.flatMap(m => m.lessons.flatMap(lessonKeys));
                    const lvDone = countDone(lvKeys);
                    const k = lang.id + ":" + lv;
                    const isOpen = !!openKeys[k];
                    return (
                      <div key={k} style={{ marginTop: 10, marginLeft: 10 }}>
                        <button onClick={() => toggle(k)}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: ui.card, border: `1px solid ${ui.line}`, borderLeft: `4px solid ${lang.color}`, borderRadius: 12, padding: "11px 16px", cursor: "pointer", textAlign: "left" }}>
                          <Chevron open={isOpen} />
                          <span style={{ fontSize: 15.5, fontWeight: 800, color: ui.ink }}>{LEVEL_LABEL[lv]}</span>
                          <span style={{ color: ui.sub, fontSize: 12.5, flex: 1 }}>{LEVEL_DESC[lv]}</span>
                          <span style={{ fontFamily: ui.mono, fontSize: 12, color: lvDone === lvKeys.length && lvKeys.length > 0 ? ui.ok : ui.sub, whiteSpace: "nowrap" }}>
                            {lvDone === lvKeys.length && lvKeys.length > 0 ? "✅ " : ""}{lvDone}/{lvKeys.length}
                          </span>
                        </button>
                        {isOpen && (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12, marginTop: 10, marginLeft: 10 }}>
                            {mods.map(mod => (
                              <div key={mod.id} style={{ background: ui.card, border: `1px solid ${ui.line}`, borderRadius: 14, padding: "14px 18px" }}>
                                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: lang.color }}>Tema</div>
                                <div style={{ fontWeight: 700, fontSize: 15, margin: "3px 0 8px" }}>{mod.title}</div>
                                {mod.lessons.map(les => {
                                  const lKeys = lessonKeys(les);
                                  const dN = countDone(lKeys);
                                  return (
                                    <button key={les.id} onClick={() => setView({ page: "lesson", langId: lang.id, lessonId: les.id, modId: mod.id })}
                                      style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", background: "#F7F9FB", border: `1px solid ${ui.line}`, borderRadius: 10, padding: "10px 14px", marginBottom: 6, cursor: "pointer", fontSize: 14, color: ui.ink, textAlign: "left" }}>
                                      <span>{dN === lKeys.length && lKeys.length > 0 ? "✅" : "▫️"} {les.title}</span>
                                      <span style={{ fontFamily: ui.mono, fontSize: 12, color: ui.sub }}>{dN}/{lKeys.length}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </>
        )}

        {view.page === "lesson" && (() => {
          const lang = CONTENT.languages.find(l => l.id === view.langId);
          const mod = lang.modules.find(m => m.id === view.modId);
          const les = mod.lessons.find(l => l.id === view.lessonId);
          return (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                <button onClick={() => setView({ page: "home" })} style={btn("ghost")}>← Volver a la ruta</button>
                <button onClick={() => setCheatLang(lang)} style={{ ...btn("ghost"), border: `1px solid ${ui.line}` }}>📄 Cheat sheet {lang.name}</button>
              </div>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase", color: lang.color }}>{lang.name} · {LEVEL_LABEL[mod.level]} · {mod.title}</div>
              <h1 style={{ fontSize: 22, margin: "4px 0 14px" }}>{les.title}</h1>

              <div style={{ background: ui.card, border: `1px solid ${ui.line}`, borderLeft: `4px solid ${lang.color}`, borderRadius: 12, padding: "14px 18px", marginBottom: 18 }}>
                <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: ui.sub, marginBottom: 6 }}>Teoría en 60 segundos</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
                  {les.theory.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </div>

              <div style={{ fontWeight: 800, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: ui.sub, marginBottom: 8 }}>Ahora tú · práctica</div>
              {les.exercises.map(e2 => (
                <ExerciseCard key={e2.id} exercise={e2} lang={lang} kind="ex" progress={progress} onSolved={onSolved} />
              ))}
              {les.caseStudy && <ExerciseCard exercise={les.caseStudy} lang={lang} kind="case" progress={progress} onSolved={onSolved} />}
            </>
          );
        })()}

        {view.page === "dashboard" && (() => {
          const days = [...Array(14)].map((_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (13 - i));
            const k = d.toISOString().slice(0, 10);
            return { k, label: k.slice(5), xp: progress.xpLog[k] || 0 };
          });
          const maxXp = Math.max(20, ...days.map(d => d.xp));
          return (
            <>
              <h1 style={{ fontSize: 24, marginBottom: 4 }}>Dashboard de progreso</h1>
              <p style={{ color: ui.sub, marginTop: 0, fontSize: 14 }}>La constancia gana: sesiones cortas, todos los días.</p>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 18 }}>
                {[["⚡ XP total", progress.xp], ["🔥 Racha actual", progress.streak + " días"], ["✅ Ejercicios", doneCount + "/" + totalEx], ["🏅 Insignias", progress.badges.length]].map(([k, v]) => (
                  <div key={k} style={{ background: ui.card, border: `1px solid ${ui.line}`, borderRadius: 12, padding: 14 }}>
                    <div style={{ fontSize: 12, color: ui.sub }}>{k}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, fontFamily: ui.mono }}>{v}</div>
                  </div>
                ))}
              </div>

              <div style={{ background: ui.card, border: `1px solid ${ui.line}`, borderRadius: 12, padding: 16, marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>XP · últimos 14 días</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 110 }}>
                  {days.map(d => (
                    <div key={d.k} title={`${d.k}: ${d.xp} XP`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                      <div style={{ width: "100%", height: `${(d.xp / maxXp) * 90}px`, minHeight: d.xp ? 4 : 1, background: d.xp ? ui.accent : ui.line, borderRadius: 3 }} />
                      <div style={{ fontSize: 8.5, color: ui.sub, fontFamily: ui.mono }}>{d.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: ui.card, border: `1px solid ${ui.line}`, borderRadius: 12, padding: 16, marginBottom: 18 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Avance por lenguaje y nivel</div>
                {CONTENT.languages.map(lang => {
                  const all = allExKeys(lang);
                  const d = countDone(all);
                  const pct = all.length ? Math.round(d / all.length * 100) : 0;
                  return (
                    <div key={lang.id} style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, color: lang.color }}>{lang.name}</span>
                        <span style={{ fontFamily: ui.mono, color: ui.sub }}>{d}/{all.length} · {pct}%</span>
                      </div>
                      <div style={{ height: 8, background: "#EDF1F5", borderRadius: 5, overflow: "hidden", marginBottom: 6 }}>
                        <div style={{ width: pct + "%", height: "100%", background: lang.color }} />
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {LEVEL_ORDER.map(lv => {
                          const keys = lang.modules.filter(m => m.level === lv).flatMap(m => m.lessons.flatMap(lessonKeys));
                          if (!keys.length) return null;
                          return (
                            <span key={lv} style={{ fontFamily: ui.mono, fontSize: 11.5, color: ui.sub, background: "#F1F4F8", borderRadius: 6, padding: "3px 8px" }}>
                              {LEVEL_LABEL[lv]}: {countDone(keys)}/{keys.length}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ background: ui.card, border: `1px solid ${ui.line}`, borderRadius: 12, padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>Insignias</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {BADGES.map(b => {
                    const got = progress.badges.includes(b.id);
                    return (
                      <div key={b.id} title={b.desc} style={{ border: `1px solid ${got ? "#F0C9A8" : ui.line}`, background: got ? "#FFF6EE" : "#F7F9FB", opacity: got ? 1 : 0.55, borderRadius: 10, padding: "8px 12px", fontSize: 13 }}>
                        🏅 <b>{b.name}</b><div style={{ fontSize: 11.5, color: ui.sub }}>{b.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          );
        })()}

        {view.page === "schema" && (
          <>
            <h1 style={{ fontSize: 24, marginBottom: 4 }}>Esquema de contenido (módulo dinámico)</h1>
            <p style={{ color: ui.sub, fontSize: 14 }}>
              Para agregar o quitar un lenguaje, cualquier IA puede generar un objeto JSON con este formato exacto
              y añadirlo/quitarlo del array <code style={{ fontFamily: ui.mono }}>CONTENT.languages</code> del código de la app.
              La UI, el compilador, la validación, las pistas, el explorador de esquema, el XP y el dashboard se adaptan automáticamente.
            </p>
            <pre style={{ background: "#0F1B2D", color: "#E8EEF6", borderRadius: 12, padding: 18, fontSize: 12.5, fontFamily: ui.mono, overflowX: "auto", lineHeight: 1.55 }}>{SCHEMA_SPEC}</pre>
            <p style={{ color: ui.sub, fontSize: 13 }}>
              Runners disponibles hoy: <b>sql</b> (sql.js/SQLite en el navegador) y <b>python</b> (Pyodide/WebAssembly).
              Para un lenguaje sin runner usa <code style={{ fontFamily: ui.mono }}>"runner": "none"</code>.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
