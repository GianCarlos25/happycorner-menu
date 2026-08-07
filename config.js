/* ============================================================
   CONFIGURACIÓN — esto lo toca la agencia UNA sola vez.
   ------------------------------------------------------------
   Usamos el enlace "gviz" de Google, que lee la hoja en vivo
   (sin el retraso de varios minutos que tiene "Publicar en la
   Web"). Para que funcione, la hoja debe estar compartida como
   "Cualquiera con el enlace puede ver" (Compartir → General →
   Cualquier usuario con el enlace → Lector).
   ============================================================ */

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/18Yb5uQ-sUvZkBsZ_5g92qn6B4Ikp2ggrsirgnhuCZIg/gviz/tq?tqx=out:csv&gid=497303217";

// Si en algún momento hay problemas con el método de arriba, la
// alternativa (más lenta para actualizar, unos minutos de retraso)
// es "Publicar en la Web" y pegar aquí ese enlace terminado en
// "/pub?output=csv" en su lugar.
