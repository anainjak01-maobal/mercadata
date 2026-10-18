/* MercaData · Funciones comunes: leer las hojas de Google, calcular indicadores, formatear. */
(function (w) {
  "use strict";
  var CFG = w.MD_CONFIG || {};

  function norm(s) { return String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim(); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return "$" + Math.round(+n || 0).toLocaleString("es-CO"); }
  function toNum(v) { var s = String(v == null ? "" : v).replace(/[^\d-]/g, ""); return s ? parseInt(s, 10) : 0; }
  function sum(list, fn) { return list.reduce(function (a, x) { return a + fn(x); }, 0); }
  function pct(a, b) { return b ? Math.round(a * 100 / b) + " %" : "—"; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

  /* Acepta 2026-08-03 y 03/08/2026 (día/mes/año). Devuelve "aaaa-mm-dd" o "". */
  function parseDate(v) {
    var s = String(v == null ? "" : v).trim(), m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return m[1] + "-" + m[2].padStart(2, "0") + "-" + m[3].padStart(2, "0");
    if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
    return "";
  }
  var MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  function fmtDate(iso) { var m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? (+m[3]) + " " + MESES[+m[2] - 1] : "—"; }
  var DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  var ORDEN_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  function dayName(iso) { var d = new Date(iso + "T12:00:00"); return isNaN(d) ? "" : DIAS[d.getDay()]; }
  function addDays(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function mondayOf(iso) { var d = new Date(iso + "T12:00:00"), k = (d.getDay() + 6) % 7; return addDays(iso, -k); }

  function parseCSV(t) {
    var rows = [], row = [], cur = "", q = false, i, ch;
    t = String(t || "").replace(/^﻿/, "");
    for (i = 0; i < t.length; i++) {
      ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cur); cur = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
      else cur += ch;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.join("").trim() !== ""; });
  }

  var ALIAS = {
    productos: { producto: ["producto"], categoria: ["categoria"], precio: ["precio de venta", "precio"], costo: ["costo unitario", "costo"] },
    ventas: { fecha: ["fecha"], producto: ["producto"], categoria: ["categoria"], unidades: ["unidades"], precio: ["precio"], ingreso: ["ingreso"], costoU: ["costo unitario"], costoT: ["costo total"], margen: ["margen"] }
  };
  function findCol(headers, aliases) {
    var i, j;
    for (j = 0; j < aliases.length; j++) for (i = 0; i < headers.length; i++) if (headers[i] === aliases[j]) return i;
    for (j = 0; j < aliases.length; j++) for (i = 0; i < headers.length; i++) if (headers[i].indexOf(aliases[j]) === 0) return i;
    return -1;
  }
  function toObjects(kind, csv) {
    var rows = parseCSV(csv);
    if (rows.length < 2) return { rows: [], missing: ["(la hoja está vacía)"] };
    var headers = rows[0].map(norm), map = {}, missing = [];
    Object.keys(ALIAS[kind]).forEach(function (k) { map[k] = findCol(headers, ALIAS[kind][k]); });
    var required = { productos: ["producto", "precio", "costo"], ventas: ["fecha", "producto", "unidades", "precio"] }[kind];
    required.forEach(function (k) { if (map[k] < 0) missing.push(ALIAS[kind][k][0]); });
    var out = rows.slice(1).map(function (r) {
      var o = {}; Object.keys(map).forEach(function (k) { o[k] = map[k] >= 0 ? String(r[map[k]] == null ? "" : r[map[k]]).trim() : ""; }); return o;
    }).filter(function (o) { return o.producto; });
    return { rows: out, missing: missing };
  }
  function clean(kind, list) {
    if (kind === "productos") return list.map(function (o) { return { producto: o.producto, categoria: o.categoria || "Sin categoría", precio: toNum(o.precio), costo: toNum(o.costo) }; });
    return list.map(function (o) {
      var u = toNum(o.unidades), p = toNum(o.precio), cu = o.costoU !== "" && o.costoU != null ? toNum(o.costoU) : (o.costoT ? Math.round(toNum(o.costoT) / (u || 1)) : 0);
      return { fecha: parseDate(o.fecha), producto: o.producto, categoria: o.categoria || "", unidades: u, precio: p, costoU: cu, ingreso: u * p, costo: u * cu, margen: u * (p - cu), ingresoDicho: o.ingreso === "" || o.ingreso == null ? null : toNum(o.ingreso) };
    });
  }
  function fetchCsv(url) {
    var u = url + (url.indexOf("?") < 0 ? "?" : "&") + "t=" + Date.now();
    return fetch(u, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); });
  }

  /* Devuelve { prod, ven, modo: "demo"|"hojas", avisos: [] } */
  function loadData() {
    var H = CFG.HOJAS || {}, D = w.MD_DEMO;
    function demo(avisos) { return { prod: clean("productos", D.productos), ven: clean("ventas", D.ventas.map(function (v) { return { fecha: v.fecha, producto: v.producto, categoria: v.categoria, unidades: v.unidades, precio: v.precio, costoU: v.costoU, ingreso: "", costoT: "" }; })), modo: "demo", avisos: avisos || [] }; }
    if (!H.productos && !H.ventas) return Promise.resolve(demo());
    if (!(H.productos && H.ventas)) return Promise.resolve(demo(["Faltan enlaces en config.js: se necesitan los dos (productos y ventas). Se muestran los datos de demostración."]));
    return Promise.all([fetchCsv(H.productos), fetchCsv(H.ventas)]).then(function (t) {
      var a = toObjects("productos", t[0]), b = toObjects("ventas", t[1]), avisos = [];
      [["Productos", a], ["Ventas", b]].forEach(function (x) { if (x[1].missing.length) avisos.push("En la hoja " + x[0] + " no encuentro la columna: " + x[1].missing.join(", ") + "."); });
      return { prod: clean("productos", a.rows), ven: clean("ventas", b.rows), modo: "hojas", avisos: avisos };
    }).catch(function () { return demo(["No se pudo leer la hoja de Google. Revisa que esté publicada en la web en formato CSV. Mientras tanto se muestran datos de demostración, NO los reales."]); });
  }

  /* Envía el día al script de Google. Siempre resuelve: { ok, ... } o { ok:false, red:true } si no hubo conexión. */
  function registrar(payload) {
    if (!CFG.REGISTRO) return Promise.resolve({ ok: false, sinConfig: true });
    return fetch(CFG.REGISTRO, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
      .then(function (r) { return r.json(); })
      .catch(function () { return { ok: false, red: true, error: "No hubo conexión con el registro." }; });
  }

  w.MD = { norm: norm, esc: esc, money: money, toNum: toNum, sum: sum, pct: pct, today: today, parseDate: parseDate, fmtDate: fmtDate, dayName: dayName, addDays: addDays, mondayOf: mondayOf, ORDEN_DIAS: ORDEN_DIAS, parseCSV: parseCSV, loadData: loadData, registrar: registrar, CFG: CFG };
})(window);
