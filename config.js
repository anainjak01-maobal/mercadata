/* ============================================================
   MercaData · Configuración del sitio
   Es el único archivo que se edita para conectar el sitio con la hoja de Google.
   ============================================================ */
window.MD_CONFIG = {
  NEGOCIO: "Mini Mercado El Cruce · Maicao",

  /* Enlaces CSV de las hojas de Google (Archivo > Compartir > Publicar en la web > elegir la pestaña > CSV).
     Se publican solo Productos y Ventas. Si los dos quedan vacíos, el sitio muestra los datos de demostración. */
  HOJAS: {
    productos: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeXxXfa-kYPiIVUlkgYgXp1J8YcssyI02SDEqV3vg8AwGcVYhCjo1UpvSPdKudmXguxm4KUmKPne2N/pub?gid=1677494855&single=true&output=csv",
    ventas: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTeXxXfa-kYPiIVUlkgYgXp1J8YcssyI02SDEqV3vg8AwGcVYhCjo1UpvSPdKudmXguxm4KUmKPne2N/pub?gid=1872904283&single=true&output=csv"
  },

  /* Registro automático: dirección de la aplicación web de Apps Script (ver LEEME, paso 5).
     Si queda vacío, la página de registro solo permite copiar las filas para pegarlas a mano. */
  REGISTRO: "https://script.google.com/macros/s/AKfycbw-uQr1ib2qUixhNIIV-E94-3HWK_xDYLH9NpG6N2zaA9Qd6JFIXhhI_42Wv-GHiqe6qg/exec",

  /* Un producto que vende esta cantidad de unidades por semana (o menos) se marca "Pausar un pedido". */
  QUIETO_MAX_SEMANA: 4,

  /* Un producto que vendió al menos este porcentaje de sus unidades el viernes y el sábado se marca "Reforzar viernes".
     Si las ventas fueran parejas, esos dos días tendrían cerca del 29 % (37 % es 1,3 veces lo esperado). */
  FIN_DE_SEMANA_PCT: 37,

  /* Un producto que se vendió al menos este porcentaje de los días con registro se marca "No puede faltar". */
  DIARIO_PCT: 90
};
