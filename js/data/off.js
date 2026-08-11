/**
 * Open Food Facts: del código de barras a los macros.
 *
 * El código de barras no guarda calorías, solo un número. Ese número es la
 * llave para buscar en una base de datos, y esta es la única grande que es
 * gratis y no pide clave.
 *
 * Es colaborativa, así que hay productos incompletos y productos que no están
 * — sobre todo marcas locales. Por eso todo lo que devuelve se valida, y si no
 * aparece nada la app deja crear el producto a mano y lo guarda para siempre.
 */

const API = 'https://world.openfoodfacts.org/api/v2/product/';
const CAMPOS = [
  'code', 'product_name', 'product_name_es', 'generic_name_es', 'brands',
  'quantity', 'serving_size', 'nutriments', 'image_front_small_url', 'nutriscore_grade',
].join(',');

/** Un código de barras válido es solo dígitos: EAN-8/13 o UPC-A/E. */
export function codigoValido(codigo) {
  return /^\d{8}$|^\d{12,14}$/.test(String(codigo).trim());
}

const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/**
 * Normaliza la respuesta al mismo formato que usa el resto de la app:
 * macros por 100 g. Devuelve null si al producto le faltan los datos que
 * de verdad importan, que es mejor que enseñar un alimento a cero.
 */
function normalizar(p) {
  const n = p.nutriments || {};
  const kcal = numero(n['energy-kcal_100g'])
    ?? (numero(n['energy_100g']) != null ? numero(n['energy_100g']) / 4.184 : null);
  const prot = numero(n.proteins_100g);
  const carb = numero(n.carbohydrates_100g);
  const gras = numero(n.fat_100g);

  if (kcal == null || prot == null || carb == null || gras == null) return null;

  const nombre = (p.product_name_es || p.product_name || p.generic_name_es || '').trim();
  if (!nombre) return null;

  // "30 g" o "30g" -> 30. Sirve para ofrecer la ración del envase.
  const racion = numero(String(p.serving_size || '').replace(',', '.').match(/([\d.]+)\s*g/i)?.[1]);

  return {
    codigo: String(p.code),
    nombre,
    marca: (p.brands || '').split(',')[0].trim(),
    imagen: p.image_front_small_url || '',
    kcal: Math.round(kcal),
    p: Math.round(prot * 10) / 10,
    c: Math.round(carb * 10) / 10,
    g: Math.round(gras * 10) / 10,
    racion,
    cantidad: p.quantity || '',
    nutriscore: p.nutriscore_grade || '',
    origen: 'off',
  };
}

/**
 * Busca un código de barras.
 * @returns {Promise<{estado:'ok'|'sin-datos'|'no-encontrado'|'sin-red', producto?:object}>}
 */
export async function buscarCodigo(codigo) {
  if (!codigoValido(codigo)) return { estado: 'no-encontrado' };

  let datos;
  try {
    const r = await fetch(`${API}${codigo}.json?fields=${CAMPOS}`);
    if (r.status === 404) return { estado: 'no-encontrado' };
    if (!r.ok) return { estado: 'sin-red' };
    datos = await r.json();
  } catch {
    // Sin conexión en el súper es lo normal: no es un fallo de la app.
    return { estado: 'sin-red' };
  }

  if (datos.status !== 1 || !datos.product) return { estado: 'no-encontrado' };

  const producto = normalizar(datos.product);
  if (!producto) return { estado: 'sin-datos' };
  return { estado: 'ok', producto };
}

/** Macros de una cantidad concreta de un producto guardado por 100 g. */
export function macrosDe(producto, gramos) {
  const k = (Number(gramos) || 0) / 100;
  return {
    kcal: producto.kcal * k,
    p: producto.p * k,
    c: producto.c * k,
    g: producto.g * k,
  };
}
