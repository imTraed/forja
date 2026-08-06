/**
 * Catálogo de ejercicios: carga perezosa del JSON recortado (1 MB) y búsqueda.
 * Las imágenes y GIFs se sirven desde el repo original; el service worker los
 * va cacheando conforme se ven, y Ajustes permite precargar los de tu rutina.
 */
import { tEquipo, tTarget, familiaEquipo } from './i18n.js';

const RAW = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/';

let cache = null;
let cargando = null;
let porId = new Map();

export function cargado() {
  return cache != null;
}

export function cargar() {
  if (cache) return Promise.resolve(cache);
  if (!cargando) {
    cargando = fetch('js/data/exercises.min.json')
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudo cargar el catálogo (${r.status})`);
        return r.json();
      })
      .then((datos) => {
        cache = datos;
        porId = new Map(datos.map((e) => [e.id, e]));
        return cache;
      })
      .catch((e) => {
        cargando = null;
        throw e;
      });
  }
  return cargando;
}

export const ejercicio = (id) => porId.get(id) || null;

export const media = (ruta) => (ruta ? RAW + ruta : '');
export const gifDe = (ex) => media(ex?.gif);
export const imagenDe = (ex) => media(ex?.image);

const sinAcentos = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLowerCase();

/**
 * Puntúa lo "canónico" que es un ejercicio: penaliza variantes raras, versiones
 * y ejercicios unilaterales, para que las sugerencias automáticas sean las de
 * toda la vida y no "band one arm twisting chest press".
 */
export function calidad(ex) {
  let p = 0;
  const n = ex.name;
  if (/\(|v\. \d|pov|female|male/.test(n)) p -= 4;
  if (/one arm|single leg|alternat|twisting|assisted|kneeling|on knees/.test(n)) p -= 3;
  if (/^(barbell|dumbbell|lever|cable|smith)/.test(n)) p += 2;
  if (familiaEquipo(ex.equipment) === 'band') p -= 2;
  p -= Math.floor(n.split(' ').length / 3);
  return p;
}

/**
 * Busca en el catálogo. Todos los filtros son opcionales.
 * @param {object} o
 * @param {string} o.q            texto libre (nombre, músculo o material, en ES o EN)
 * @param {Set}    o.equipos      equipment permitidos
 * @param {string} o.target       músculo objetivo exacto
 * @param {string} o.bodyPart
 * @param {number} o.limite
 */
export function buscar({ q = '', equipos = null, target = null, bodyPart = null, limite = 60 } = {}) {
  if (!cache) return [];
  const términos = sinAcentos(q).split(/\s+/).filter(Boolean);
  const res = [];
  for (const ex of cache) {
    if (target && ex.target !== target) continue;
    if (bodyPart && ex.bodyPart !== bodyPart) continue;
    if (equipos && equipos.size && !equipos.has(ex.equipment)) continue;
    if (términos.length) {
      const heno = sinAcentos(`${ex.name} ${ex.target} ${ex.equipment} ${ex.bodyPart} ${tTarget(ex.target)} ${tEquipo(ex.equipment)}`);
      if (!términos.every((t) => heno.includes(t))) continue;
    }
    res.push(ex);
  }
  res.sort((a, b) => {
    if (términos.length) {
      const ea = sinAcentos(a.name).startsWith(términos[0]) ? 1 : 0;
      const eb = sinAcentos(b.name).startsWith(términos[0]) ? 1 : 0;
      if (ea !== eb) return eb - ea;
    }
    return calidad(b) - calidad(a);
  });
  return res.slice(0, limite);
}

/** Busca por nombre exacto (los splits los referencian así). */
export function porNombre(nombre) {
  if (!cache) return null;
  return cache.find((e) => e.name === nombre) || null;
}

/**
 * Alternativas para cambiar un ejercicio estancado: mismo músculo objetivo,
 * distinto material, ordenadas por lo canónicas que sean.
 */
export function alternativas(ex, equipos = null, limite = 8) {
  if (!cache || !ex) return [];
  return cache
    .filter((o) => o.id !== ex.id && o.target === ex.target && o.equipment !== ex.equipment
      && (!equipos || !equipos.size || equipos.has(o.equipment)))
    .sort((a, b) => calidad(b) - calidad(a))
    .slice(0, limite);
}
