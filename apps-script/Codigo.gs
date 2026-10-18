/**
 * MercaData · Registro del día de ventas.
 * Va dentro de la hoja de Google (Extensiones > Apps Script). Recibe el día desde la página "Registrar el día"
 * y lo anota en la pestaña Ventas aplicando las reglas de limpieza del cuaderno:
 *  - lista cerrada de productos (los de la pestaña Productos),
 *  - una fecha, una fila por producto (un día guardado dos veces reemplaza al anterior, nunca se duplica),
 *  - si un producto no salió no se escribe la fila,
 *  - precio y costo salen de la pestaña Productos, no de lo que llegue de la página.
 */
var ZONA = "America/Bogota";
var DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
var MAX_UNIDADES = 500;

function doGet() { return salida({ ok: true, mensaje: "Registro de MercaData activo." }); }

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    return salida(registrarDia(JSON.parse(e.postData.contents)));
  } catch (err) {
    return salida({ ok: false, error: "No se pudo registrar: " + err });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function salida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function norm(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim(); }

/* Devuelve la fecha de una celda como "aaaa-mm-dd" (acepta fechas reales, 2026-08-03 y 03/08/2026). */
function aIso(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ZONA, "yyyy-MM-dd");
  var s = String(v == null ? "" : v).trim(), m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return m[3] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[1]).slice(-2);
  return "";
}
function nombreDia(iso) { var p = iso.split("-"); return DIAS[new Date(+p[0], +p[1] - 1, +p[2], 12).getDay()]; }
function col(head, nombres) { for (var i = 0; i < nombres.length; i++) { var k = head.indexOf(nombres[i]); if (k >= 0) return k; } return -1; }

function registrarDia(p) {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), hP = ss.getSheetByName("Productos"), hV = ss.getSheetByName("Ventas");
  if (!hP || !hV) return { ok: false, error: "Faltan las pestañas Productos y Ventas." };

  var fecha = aIso(p.fecha), hoy = Utilities.formatDate(new Date(), ZONA, "yyyy-MM-dd");
  if (!fecha) return { ok: false, error: "La fecha no es válida." };
  if (fecha > hoy) return { ok: false, error: "No se puede registrar un día que todavía no llegó." };
  if (fecha < "2020-01-01") return { ok: false, error: "La fecha es demasiado antigua." };

  var lp = hP.getDataRange().getValues(), hp = lp[0].map(norm);
  var iN = col(hp, ["producto"]), iC = col(hp, ["categoria"]), iPr = col(hp, ["precio de venta", "precio"]), iCo = col(hp, ["costo unitario", "costo"]);
  if ([iN, iC, iPr, iCo].some(function (x) { return x < 0; })) return { ok: false, error: "No encuentro las columnas de Productos. No cambies los títulos de la fila 1." };
  var cat = {}; lp.slice(1).forEach(function (r) { if (r[iN] !== "") cat[norm(r[iN])] = r; });

  var lineas = [], fuera = [], vistos = {};
  (p.lineas || []).forEach(function (l) {
    var k = norm(l.producto), u = Math.round(Number(l.unidades));
    if (!u || u <= 0) return;                       /* si no salió, no hay fila */
    if (u > MAX_UNIDADES) { fuera.push(l.producto + " (" + u + " unidades es demasiado)"); return; }
    var r = cat[k];
    if (!r) { fuera.push(String(l.producto).slice(0, 40)); return; }
    if (vistos[k]) return; vistos[k] = 1;
    var precio = Number(r[iPr]), costo = Number(r[iCo]);
    if (!(precio > 0) || !(costo > 0) || costo >= precio) { fuera.push(r[iN] + " (revisa precio y costo en Productos)"); return; }
    lineas.push([fecha, nombreDia(fecha), r[iN], r[iC], u, precio, u * precio, costo, u * costo, u * (precio - costo)]);
  });
  if (fuera.length) return { ok: false, error: "No se guardó nada. Revisa: " + fuera.join(", ") + ".", fuera: fuera };
  if (!lineas.length) return { ok: false, error: "No hay unidades para guardar. Si ese día no hubo ventas, déjalo sin registro." };

  /* una fecha, una fila por producto */
  var datos = hV.getDataRange().getValues(), filasDia = [];
  for (var i = 1; i < datos.length; i++) if (aIso(datos[i][0]) === fecha) filasDia.push(i + 1);
  if (filasDia.length && !p.reemplazar) return { ok: false, duplicado: true, filas: filasDia.length, error: "Ese día ya tiene " + filasDia.length + " líneas registradas." };
  for (var j = filasDia.length - 1; j >= 0; j--) hV.deleteRow(filasDia[j]);

  var a = hV.getRange(1, 1, Math.max(hV.getMaxRows(), 1), 1).getValues(), ult = 1;
  for (var k = a.length - 1; k >= 0; k--) { if (String(a[k][0]).trim() !== "") { ult = k + 1; break; } }
  var rango = hV.getRange(ult + 1, 1, lineas.length, 10);
  rango.setValues(lineas);
  hV.getRange(ult + 1, 1, lineas.length, 1).setNumberFormat("yyyy-mm-dd");
  hV.getRange(ult + 1, 6, lineas.length, 5).setNumberFormat("$#,##0");
  return { ok: true, fecha: fecha, lineas: lineas.length, unidades: lineas.reduce(function (s, l) { return s + l[4]; }, 0), ingreso: lineas.reduce(function (s, l) { return s + l[6]; }, 0), reemplazo: filasDia.length };
}
