/** Generador ZIP compatible con navegadores modernos. Sin librerías externas.
 * Usa entradas STORE (sin compresión), perfectas para JPG/PNG/WEBP/GIF
 * que ya vienen comprimidos. Evita dependencias de CDN.
 */
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function dosDate(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}
export function crearZip(archivos) {
  if (archivos.length > 65535) throw new Error('Demasiados archivos para ZIP');
  const encoder = new TextEncoder(), partes = [], centrales = [];
  const now = dosDate();
  let offset = 0, centralLength = 0;
  for (const archivo of archivos) {
    const nombre = encoder.encode(archivo.name);
    const bytes = archivo.data instanceof Uint8Array ? archivo.data : encoder.encode(String(archivo.data));
    if (nombre.length > 65535 || bytes.length > 0xffffffff) throw new Error('Archivo demasiado grande');
    const crc = crc32(bytes);
    const local = new Uint8Array(30 + nombre.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true); // UTF-8
    view.setUint16(8, 0, true); // STORE
    view.setUint16(10, now.time, true); view.setUint16(12, now.day, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, bytes.length, true); view.setUint32(22, bytes.length, true);
    view.setUint16(26, nombre.length, true);
    local.set(nombre, 30);
    partes.push(local, bytes);

    const central = new Uint8Array(46 + nombre.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true); cv.setUint16(10, 0, true);
    cv.setUint16(12, now.time, true); cv.setUint16(14, now.day, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, bytes.length, true); cv.setUint32(24, bytes.length, true);
    cv.setUint16(28, nombre.length, true);
    cv.setUint32(42, offset, true);
    central.set(nombre, 46);
    centrales.push(central);
    centralLength += central.length;
    offset += local.length + bytes.length;
  }
  if (offset > 0xffffffff || centralLength > 0xffffffff) throw new Error('ZIP demasiado grande');
  const end = new Uint8Array(22), ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, archivos.length, true); ev.setUint16(10, archivos.length, true);
  ev.setUint32(12, centralLength, true); ev.setUint32(16, offset, true);
  return new Blob([...partes, ...centrales, end], { type: 'application/zip' });
}
