/**
 * Cuentas y sincronización contra Supabase, hablando con su API REST a pelo.
 *
 * Sin librería aposta: el SDK oficial son 100 KB y habría que traerlo de un CDN,
 * lo que rompería el funcionamiento sin conexión. Aquí solo hacen falta cuatro
 * llamadas y caben en este archivo.
 *
 * El estado entero de la app viaja como un único JSON por usuario. Es lo que
 * mejor encaja: la app ya guardaba todo en un objeto y ya sabía exportarlo e
 * importarlo, así que sincronizar es mandar y traer ese mismo objeto.
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY, hayNube } from '../config.js';

const CLAVE_SESION = 'forja.sesion';
const TABLA = 'estados';

let sesion = cargarSesion();
const oyentes = new Set();

export const alCambiarSesion = (fn) => { oyentes.add(fn); return () => oyentes.delete(fn); };
const avisar = () => oyentes.forEach((fn) => fn(sesion));

export { hayNube };
export const usuario = () => sesion?.user || null;
export const haySesion = () => Boolean(sesion?.access_token);

function cargarSesion() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_SESION));
  } catch {
    return null;
  }
}

function guardarSesion(s) {
  sesion = s;
  if (s) localStorage.setItem(CLAVE_SESION, JSON.stringify(s));
  else localStorage.removeItem(CLAVE_SESION);
  avisar();
}

/** Traduce los errores de Supabase a algo que se entienda. */
function mensajeDe(datos, respuesta) {
  const bruto = datos?.error_description || datos?.msg || datos?.message || datos?.error || '';
  const tabla = {
    'Invalid login credentials': 'Correo o contraseña incorrectos.',
    'Email not confirmed': 'Tienes que confirmar el correo antes de entrar. Mira tu bandeja.',
    'User already registered': 'Ese correo ya tiene cuenta. Inicia sesión.',
  };
  if (tabla[bruto]) return tabla[bruto];
  if (/password/i.test(bruto) && /6/.test(bruto)) return 'La contraseña necesita al menos 6 caracteres.';
  if (respuesta?.status === 429) return 'Demasiados intentos seguidos. Espera un minuto.';
  return bruto || 'No se ha podido conectar con el servidor.';
}

async function pedir(ruta, opciones = {}, conSesion = false) {
  const cabeceras = {
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    ...opciones.headers,
  };
  if (conSesion && sesion?.access_token) cabeceras.Authorization = `Bearer ${sesion.access_token}`;

  let r;
  try {
    r = await fetch(`${SUPABASE_URL}${ruta}`, { ...opciones, headers: cabeceras });
  } catch {
    // Sin internet, o la URL del proyecto mal escrita en config.js.
    throw new Error('No hay conexión con el servidor. Comprueba tu internet.');
  }

  const texto = await r.text();
  const datos = texto ? JSON.parse(texto) : null;
  if (!r.ok) throw new Error(mensajeDe(datos, r));
  return datos;
}

/* ==========================================================================
   Cuentas
   ========================================================================== */

/**
 * @returns {Promise<{estado:'dentro'|'confirma-correo'}>}
 *   `confirma-correo` sale cuando el proyecto tiene activada la confirmación
 *   por email: la cuenta existe pero aún no se puede entrar.
 */
export async function registrar(email, password) {
  const datos = await pedir('/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (datos?.access_token) {
    guardarSesion(datos);
    return { estado: 'dentro' };
  }
  return { estado: 'confirma-correo' };
}

export async function entrar(email, password) {
  const datos = await pedir('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  guardarSesion(datos);
  return { estado: 'dentro' };
}

export async function salir() {
  try {
    await pedir('/auth/v1/logout', { method: 'POST' }, true);
  } catch { /* si el token ya no vale da igual: lo que importa es soltarlo aquí */ }
  guardarSesion(null);
}

/** El token dura una hora; esto lo renueva con el refresh_token. */
export async function renovar() {
  if (!sesion?.refresh_token) return false;
  try {
    const datos = await pedir('/auth/v1/token?grant_type=refresh_token', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: sesion.refresh_token }),
    });
    guardarSesion(datos);
    return true;
  } catch {
    guardarSesion(null);
    return false;
  }
}

/** Reintenta una vez renovando el token si ha caducado. */
async function conReintento(fn) {
  try {
    return await fn();
  } catch (e) {
    if (!/JWT|token|401/i.test(e.message)) throw e;
    if (!await renovar()) throw new Error('Se ha cerrado la sesión. Vuelve a entrar.');
    return fn();
  }
}

/* ==========================================================================
   Estado en la nube
   ========================================================================== */

export async function descargarEstado() {
  if (!haySesion()) return null;
  const uid = usuario()?.id;
  const filas = await conReintento(() => pedir(
    `/rest/v1/${TABLA}?select=estado,actualizado&user_id=eq.${uid}`, {}, true,
  ));
  return filas?.[0] || null;
}

export async function subirEstado(estado) {
  if (!haySesion()) return false;
  const uid = usuario()?.id;
  await conReintento(() => pedir(`/rest/v1/${TABLA}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: uid, estado, actualizado: new Date().toISOString() }),
  }, true));
  return true;
}
