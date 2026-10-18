/* MercaData · Cálculos del tablero. Funciones puras: reciben las ventas y los productos, devuelven números. */
(function (w) {
  "use strict";
  var X = w.MD, CFG = X.CFG, norm = X.norm, sum = X.sum, DIAS = X.ORDEN_DIAS;

  function analizar(ven, prod, opt) {
    opt = opt || {};
    var rows = ven.filter(function (v) { return v.fecha && (!opt.desde || v.fecha >= opt.desde) && (!opt.hasta || v.fecha <= opt.hasta); });
    var A = { rows: rows, n: rows.length };
    A.ing = sum(rows, function (v) { return v.ingreso; });
    A.costo = sum(rows, function (v) { return v.costo; });
    A.margen = A.ing - A.costo;
    A.uni = sum(rows, function (v) { return v.unidades; });
    var fechas = {}; rows.forEach(function (v) { fechas[v.fecha] = (fechas[v.fecha] || 0) + 1; });
    A.fechas = Object.keys(fechas).sort(); A.nDias = A.fechas.length;
    A.desde = A.fechas[0] || ""; A.hasta = A.fechas[A.nDias - 1] || "";
    A.diasRango = A.nDias ? Math.round((new Date(A.hasta + "T12:00:00") - new Date(A.desde + "T12:00:00")) / 864e5) + 1 : 0;
    A.sinRegistro = []; for (var i = 0; i < A.diasRango; i++) { var d = X.addDays(A.desde, i); if (!fechas[d]) A.sinRegistro.push(d); }
    A.semanasN = A.diasRango / 7;

    /* por categoría */
    A.cat = {}; rows.forEach(function (v) { var k = v.categoria || "Sin categoría", c = A.cat[k] || (A.cat[k] = { ing: 0, margen: 0, uni: 0 }); c.ing += v.ingreso; c.margen += v.margen; c.uni += v.unidades; });
    /* por día de la semana (total y por ocurrencia) */
    A.dow = {}; DIAS.forEach(function (d) { A.dow[d] = { ing: 0, uni: 0, fechas: {} }; });
    rows.forEach(function (v) { var o = A.dow[X.dayName(v.fecha)]; o.ing += v.ingreso; o.uni += v.unidades; o.fechas[v.fecha] = 1; });
    /* por día calendario */
    A.dia = {}; rows.forEach(function (v) { A.dia[v.fecha] = (A.dia[v.fecha] || 0) + v.ingreso; });
    /* por semana (lunes a domingo) */
    A.sem = {}; rows.forEach(function (v) { var k = X.mondayOf(v.fecha), s = A.sem[k] || (A.sem[k] = { ing: 0, uni: 0, margen: 0, lineas: 0, dias: {}, mapa: {} }); s.ing += v.ingreso; s.uni += v.unidades; s.margen += v.margen; s.lineas++; s.dias[v.fecha] = 1; var m = X.dayName(v.fecha) + "|" + norm(v.producto); s.mapa[m] = (s.mapa[m] || 0) + v.unidades; });
    A.semKeys = Object.keys(A.sem).sort();

    /* por producto */
    var cat = {}; prod.forEach(function (p) { cat[norm(p.producto)] = p.categoria; });
    var P = {}; prod.forEach(function (p) { P[norm(p.producto)] = { producto: p.producto, categoria: p.categoria, uni: 0, ing: 0, margen: 0, dias: {}, dow: DIAS.map(function () { return 0; }) }; });
    rows.forEach(function (v) {
      var k = norm(v.producto), o = P[k] || (P[k] = { producto: v.producto, categoria: v.categoria || "Fuera de la lista", uni: 0, ing: 0, margen: 0, dias: {}, dow: DIAS.map(function () { return 0; }) });
      o.uni += v.unidades; o.ing += v.ingreso; o.margen += v.margen; o.dias[v.fecha] = 1; o.dow[DIAS.indexOf(X.dayName(v.fecha))] += v.unidades;
    });
    var maxFin = CFG.FIN_DE_SEMANA_PCT == null ? 37 : CFG.FIN_DE_SEMANA_PCT, maxQ = CFG.QUIETO_MAX_SEMANA == null ? 4 : CFG.QUIETO_MAX_SEMANA, minD = CFG.DIARIO_PCT == null ? 90 : CFG.DIARIO_PCT;
    A.prod = Object.keys(P).map(function (k) { return P[k]; }).map(function (o) {
      o.semana = A.semanasN ? o.uni / A.semanasN : 0;
      o.pctDias = A.nDias ? Object.keys(o.dias).length * 100 / A.nDias : 0;
      o.pctFinde = o.uni ? (o.dow[4] + o.dow[5]) * 100 / o.uni : 0;
      o.mgPct = o.ing ? o.margen * 100 / o.ing : 0;
      o.pico = o.uni ? DIAS[o.dow.indexOf(Math.max.apply(null, o.dow))] : "—";
      o.lunJue = A.semanasN ? (o.dow[0] + o.dow[1] + o.dow[2] + o.dow[3]) / A.semanasN : 0;
      o.vieDom = A.semanasN ? (o.dow[4] + o.dow[5] + o.dow[6]) / A.semanasN : 0;
      o.estado = o.semana <= maxQ ? "Pausar" : (o.pctFinde >= maxFin ? "Reforzar" : (o.pctDias >= minD ? "Firme" : "Normal"));
      return o;
    });
    A.prod.sort(function (a, b) { return b.uni - a.uni; });
    return A;
  }

  /* Revisiones de calidad de los datos. Cada una: { nivel: "ok"|"revisar", titulo, detalle } */
  function calidad(ven, prod) {
    var out = [], lista = {}; prod.forEach(function (p) { lista[norm(p.producto)] = p; });
    function add(ok, titulo, bien, mal) { out.push({ nivel: ok ? "ok" : "revisar", titulo: titulo, detalle: ok ? bien : mal }); }
    var malFecha = ven.filter(function (v) { return !v.fecha; }).length;
    add(!malFecha, "Fechas válidas", "Todas las filas tienen fecha.", malFecha + " filas con fecha vacía o ilegible. Escríbela como aaaa-mm-dd.");
    var vistos = {}, dup = []; ven.forEach(function (v) { var k = v.fecha + "|" + norm(v.producto); if (vistos[k]) dup.push(v.producto + " (" + X.fmtDate(v.fecha) + ")"); vistos[k] = 1; });
    add(!dup.length, "Una fecha, una fila por producto", "No hay filas repetidas.", dup.length + " repetidas: " + dup.slice(0, 5).join(", ") + (dup.length > 5 ? "…" : "") + ". Sumadas dos veces inflan el ingreso.");
    var fuera = {}; ven.forEach(function (v) { if (!lista[norm(v.producto)]) fuera[v.producto] = 1; });
    var fk = Object.keys(fuera);
    add(!fk.length, "Lista cerrada de productos", "Todos los productos están en la hoja Productos.", fk.length + " fuera de la lista: " + fk.slice(0, 5).join(", ") + ". Agrégalos a Productos o corrige el nombre.");
    var malU = ven.filter(function (v) { return v.unidades <= 0; }).length;
    add(!malU, "Unidades mayores que cero", "Todas las filas tienen unidades.", malU + " filas con 0 unidades o texto. Si no salió, no se escribe la fila.");
    var malC = ven.filter(function (v) { return v.costoU <= 0 || v.costoU >= v.precio; }).length;
    add(!malC, "Costo menor que el precio", "El costo es menor que el precio en todas las filas.", malC + " filas con costo en cero o igual o mayor al precio. El costo sale de la factura, no del precio de venta.");
    var difP = ven.filter(function (v) { var p = lista[norm(v.producto)]; return p && p.precio !== v.precio; }).length;
    add(!difP, "Precio igual al de la lista", "Todos los precios coinciden con la hoja Productos.", difP + " filas con un precio distinto al de la lista. Puede ser un cambio real de precio; si no, corrígelo.");
    var difI = ven.filter(function (v) { return v.ingresoDicho != null && v.ingresoDicho !== v.ingreso; }).length;
    add(!difI, "Ingreso = unidades × precio", "El ingreso anotado coincide con unidades × precio.", difI + " filas donde el ingreso anotado no coincide con unidades × precio.");

    var A = analizar(ven, prod);
    add(!A.sinRegistro.length, "Días sin registro", A.nDias ? "Los " + A.nDias + " días entre el " + X.fmtDate(A.desde) + " y el " + X.fmtDate(A.hasta) + " tienen registro." : "Todavía no hay ventas.",
      A.sinRegistro.length + " días sin registro: " + A.sinRegistro.slice(0, 6).map(function (d) { return X.dayName(d).toLowerCase() + " " + X.fmtDate(d); }).join(", ") + ". Confirma si no hubo ventas o faltó anotar; no se rellenan con promedios.");
    /* semana igual a la anterior, línea por línea */
    var rep = [];
    for (var i = 1; i < A.semKeys.length; i++) {
      var a = A.sem[A.semKeys[i - 1]], b = A.sem[A.semKeys[i]], ka = Object.keys(a.mapa), kb = Object.keys(b.mapa);
      if (ka.length >= 20 && ka.length === kb.length && ka.every(function (k) { return a.mapa[k] === b.mapa[k]; })) rep.push({ de: A.semKeys[i - 1], a: A.semKeys[i], lineas: ka.length });
    }
    add(!rep.length, "Semanas distintas entre sí", "Ninguna semana repite a la anterior línea por línea.",
      rep.map(function (r) { return "La semana del " + X.fmtDate(r.a) + " es idéntica a la del " + X.fmtDate(r.de) + " (" + r.lineas + " de " + r.lineas + " líneas con las mismas unidades)"; }).join(". ") + ". Es raro en ventas reales: contrasta con las fotos del cuaderno antes de usar el patrón semanal.");
    return out;
  }

  w.MDA = { analizar: analizar, calidad: calidad };
})(window);
