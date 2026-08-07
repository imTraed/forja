/**
 * Estado único de la app, persistido en localStorage bajo una clave versionada.
 * Todo pasa por aquí: las vistas leen `S` y llaman a `guardar()` o a las
 * acciones de más abajo. No hay servidor: el respaldo real es exportar el JSON.
 */
import { hoyISO, diasEntre } from './lib/ui.js';

const CLAVE = 'forja.v1';
const VERSION = 1;

export const SEMANAS_CALIBRACION = 2;

function inicial() {
  return {
    v: VERSION,
    perfil: null,
    ajustes: {
      incrementos: { barbell: 2.5, dumbbell: 2, machine: 5, cable: 2.5, band: 0, bodyweight: 0, otro: 2.5 },
      descanso: { fuerza: 180, hipertrofia: 90, accesorio: 60 },
      sonido: true,
      vibrar: true,
      pantallaActiva: true,
    },
    rutinas: [],
    rutinaActiva: null,
    sesiones: [],
    sesionActiva: null,
    peso: [],
    comida: { plan: null, hecho: {}, ajustes: [] },
    coach: { inicio: null, informes: [], deloadSemana: null, descartes: {} },
  };
}

/** Rellena claves que falten al cargar un estado de una versión anterior. */
function migrar(guardado) {
  const base = inicial();
  if (!guardado || typeof guardado !== 'object') return base;
  const s = { ...base, ...guardado, v: VERSION };
  s.ajustes = { ...base.ajustes, ...guardado.ajustes };
  s.ajustes.incrementos = { ...base.ajustes.incrementos, ...guardado.ajustes?.incrementos };
  s.ajustes.descanso = { ...base.ajustes.descanso, ...guardado.ajustes?.descanso };
  s.comida = { ...base.comida, ...guardado.comida };
  s.coach = { ...base.coach, ...guardado.coach };
  return s;
}

export let S = (() => {
  try {
    return migrar(JSON.parse(localStorage.getItem(CLAVE)));
  } catch {
    return inicial();
  }
})();

const oyentes = new Set();
export const alCambiar = (fn) => { oyentes.add(fn); return () => oyentes.delete(fn); };

export async function cargar() {
  const d = localStorage.getItem('gym_store');
  if (d) Object.assign(S, JSON.parse(d));
  
  // Migración: ajustar todas las rutinas existentes a 12-15 reps
  if (S.rutinas) {
    let modificado = false;
    S.rutinas.forEach(r => r.dias.forEach(dia => dia.ejercicios.forEach(e => {
      if (e.repMin !== 12 || e.repMax !== 15) {
        e.repMin = 12;
        e.repMax = 15;
        modificado = true;
      }
    })));
    
    if (S.sesionActiva) {
      S.sesionActiva.ejercicios.forEach(e => {
        if (e.repMin !== 12 || e.repMax !== 15) {
          e.repMin = 12;
          e.repMax = 15;
          modificado = true;
        }
      });
    }

    if (modificado) guardar();
  }
}

export function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(S));
  } catch (e) {
    console.error('No se pudo guardar', e);
  }
  oyentes.forEach((fn) => fn(S));
}

export function reemplazarEstado(nuevo) {
  S = migrar(nuevo);
  guardar();
}

export const uid = () => Math.random().toString(36).slice(2, 10);

/* ==========================================================================
   Programa: semanas, calibración, deload
   ========================================================================== */

/** Semana del programa, 1-based. 0 si aún no ha entrenado nunca. */
export function semanaPrograma(fecha = hoyISO()) {
  if (!S.coach.inicio) return 0;
  return Math.floor(diasEntre(S.coach.inicio, fecha) / 7) + 1;
}

export function enCalibracion() {
  const sem = semanaPrograma();
  return sem === 0 || sem <= SEMANAS_CALIBRACION;
}

export function enDeload() {
  return S.coach.deloadSemana != null && S.coach.deloadSemana === semanaPrograma();
}

/** Sesiones completadas de una semana concreta del programa. */
export function sesionesDeSemana(sem) {
  return S.sesiones.filter((s) => semanaPrograma(s.fecha) === sem);
}

/* ==========================================================================
   Rutinas
   ========================================================================== */

export const rutinaActiva = () => S.rutinas.find((r) => r.id === S.rutinaActiva) || null;

export function guardarRutina(rutina) {
  const i = S.rutinas.findIndex((r) => r.id === rutina.id);
  if (i >= 0) S.rutinas[i] = rutina;
  else S.rutinas.push(rutina);
  if (!S.rutinaActiva) S.rutinaActiva = rutina.id;
  guardar();
}

export function borrarRutina(id) {
  S.rutinas = S.rutinas.filter((r) => r.id !== id);
  if (S.rutinaActiva === id) S.rutinaActiva = S.rutinas[0]?.id ?? null;
  guardar();
}

/**
 * Siguiente día que toca: el que lleva más tiempo sin hacerse, respetando el
 * orden de la rutina. Así no hace falta atarse a días fijos de la semana.
 */
export function siguienteDia(rutina = rutinaActiva()) {
  if (!rutina?.dias?.length) return null;
  const ultima = {};
  for (const s of S.sesiones) {
    if (s.rutinaId !== rutina.id) continue;
    if (!ultima[s.diaId] || s.fecha > ultima[s.diaId]) ultima[s.diaId] = s.fecha;
  }
  const nunca = rutina.dias.find((d) => !ultima[d.id]);
  if (nunca) return nunca;
  return rutina.dias.reduce((a, b) => (ultima[a.id] <= ultima[b.id] ? a : b));
}

/* ==========================================================================
   Historial por ejercicio
   ========================================================================== */

/** Series válidas: las que tienen peso y reps registradas. */
const validas = (sets) => (sets || []).filter((x) => x.reps > 0 && x.peso != null);

/**
 * Historial de un ejercicio, de más antiguo a más reciente.
 * [{ fecha, sets, mejor: {peso,reps,rir}, e1rm, volumen }]
 */
export function historial(exId, limite = 0) {
  const out = [];
  for (const s of S.sesiones) {
    const e = s.ejercicios.find((x) => x.exId === exId);
    const sets = validas(e?.sets);
    if (!sets.length) continue;
    const conE1 = sets.map((x) => ({ ...x, e1: e1rm(x.peso, x.reps, x.rir) }));
    const mejor = conE1.reduce((a, b) => (a.e1 >= b.e1 ? a : b));
    out.push({
      fecha: s.fecha,
      sets,
      mejor,
      e1rm: mejor.e1,
      volumen: sets.reduce((t, x) => t + x.peso * x.reps, 0),
    });
  }
  out.sort((a, b) => a.fecha.localeCompare(b.fecha));
  return limite ? out.slice(-limite) : out;
}

/** Epley con las repeticiones en reserva contadas como reps que quedaban. */
export function e1rm(peso, reps, rir = 0) {
  if (!peso || !reps) return 0;
  const efectivas = reps + (Number(rir) || 0);
  return peso * (1 + efectivas / 30);
}

/** Ejercicios distintos que ha entrenado alguna vez, con su último registro. */
export function ejerciciosEntrenados() {
  const mapa = new Map();
  for (const s of S.sesiones) {
    for (const e of s.ejercicios) {
      if (!validas(e.sets).length) continue;
      const prev = mapa.get(e.exId);
      if (!prev || s.fecha > prev.fecha) mapa.set(e.exId, { exId: e.exId, nombre: e.nombre, fecha: s.fecha });
    }
  }
  return [...mapa.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/* ==========================================================================
   Peso corporal
   ========================================================================== */

export function registrarPeso(kilos, fecha = hoyISO()) {
  const i = S.peso.findIndex((p) => p.fecha === fecha);
  if (i >= 0) S.peso[i].kg = kilos;
  else S.peso.push({ fecha, kg: kilos });
  S.peso.sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (S.perfil) S.perfil.peso = kilos;
  guardar();
}

export const pesoActual = () => S.peso.at(-1)?.kg ?? S.perfil?.peso ?? null;

/** Media móvil de 7 días: la báscula diaria es ruido, la tendencia no. */
export function tendenciaPeso(dias = 7) {
  if (S.peso.length < 2) return null;
  const corte = (n) => {
    const grupo = S.peso.slice(-n);
    return grupo.reduce((t, p) => t + p.kg, 0) / grupo.length;
  };
  const reciente = corte(Math.min(dias, S.peso.length));
  const previos = S.peso.slice(0, -Math.min(dias, S.peso.length));
  if (!previos.length) return null;
  const antiguo = previos.slice(-dias).reduce((t, p) => t + p.kg, 0) / Math.min(dias, previos.length);
  const semanas = Math.max(1, diasEntre(S.peso[0].fecha, S.peso.at(-1).fecha) / 7);
  return { delta: reciente - antiguo, porSemana: (reciente - antiguo) / semanas, actual: reciente };
}

/* ==========================================================================
   Exportar / importar
   ========================================================================== */

export function exportar() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `forja-${hoyISO()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importar(file) {
  const texto = await file.text();
  const datos = JSON.parse(texto);
  if (!datos || typeof datos !== 'object' || !('v' in datos)) throw new Error('Ese archivo no es un respaldo de FORJA');
  reemplazarEstado(datos);
}
