/**
 * Generador de rutinas: convierte una plantilla de patrones en ejercicios
 * concretos del catálogo, usando solo el material disponible.
 */
import { PLANTILLAS, PATRONES } from '../data/splits.js';
import { porNombre, buscar, ejercicio } from '../data/catalog.js';
import { equiposDisponibles } from '../data/i18n.js';
import { S, uid } from '../store.js';

/** Resuelve un patrón: primera preferencia disponible, o el mejor del músculo. */
export function resolverPatron(patron, equipos, usados = new Set()) {
  const vale = (ex) => ex && !usados.has(ex.id) && (!equipos.size || equipos.has(ex.equipment));

  for (const nombre of patron.pref) {
    const ex = porNombre(nombre);
    if (vale(ex)) return ex;
  }
  const candidatos = buscar({ target: patron.target, equipos, limite: 40 });
  return candidatos.find((ex) => !usados.has(ex.id)) || candidatos[0] || null;
}

/** Configuración de un ejercicio dentro de una rutina. */
export function configDeEjercicio(ex, patron = {}) {
  const tipo = patron.tipo || 'hipertrofia';
  return {
    exId: ex.id,
    nombre: ex.name,
    equipment: ex.equipment,
    target: ex.target,
    series: patron.series ?? 3,
    repMin: patron.repMin ?? 8,
    repMax: patron.repMax ?? 12,
    tipo,
    descanso: S.ajustes.descanso[tipo] ?? 90,
  };
}

/**
 * @param {object} o
 * @param {number} o.dias        días de entreno a la semana (2-6)
 * @param {string[]} o.categorias  categorías de material elegidas
 */
export function generarRutina({ dias = 3, categorias = [] } = {}) {
  const plantilla = PLANTILLAS[dias] || PLANTILLAS[3];
  const equipos = equiposDisponibles(categorias);

  return {
    id: uid(),
    nombre: plantilla.nombre,
    descripcion: plantilla.descripcion,
    diasSemana: dias,
    creada: new Date().toISOString(),
    dias: plantilla.dias.map((d) => {
      const usados = new Set();
      const ejercicios = [];
      for (const clave of d.patrones) {
        const patron = PATRONES[clave];
        if (!patron) continue;
        const ex = resolverPatron(patron, equipos, usados);
        if (!ex) continue;
        usados.add(ex.id);
        ejercicios.push(configDeEjercicio(ex, patron));
      }
      return { id: uid(), nombre: d.nombre, ejercicios };
    }),
  };
}

const MAPA_MUSCULOS = {
  pecho: ['empujeHorizontal', 'empujeInclinado', 'aperturaPecho'],
  espalda: ['traccionVertical', 'traccionHorizontal'],
  pierna: ['sentadilla', 'bisagra', 'zancada', 'curlFemoral', 'gemelo'],
  hombro: ['empujeVertical', 'lateral', 'deltoidePosterior'],
  brazos: ['biceps', 'triceps'],
  core: ['core']
};

/**
 * Genera una rutina personalizada basada en los músculos seleccionados día a día.
 * @param {string[][]} seleccion Array de 7 días, con los IDs de músculos seleccionados por día.
 * @param {string[]} categorias  Categorías de material elegidas.
 */
export function generarRutinaCustom(seleccion, categorias = []) {
  const equipos = equiposDisponibles(categorias);
  const diasSemanales = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  
  const diasGenerados = [];
  
  seleccion.forEach((musculos, idx) => {
    if (musculos.length === 0) return; // Día de descanso
    
    let patronesDelDia = [];
    musculos.forEach(m => {
      if (MAPA_MUSCULOS[m]) patronesDelDia.push(...MAPA_MUSCULOS[m]);
    });
    
    // Evitar que sea un día gigante, limitamos a un poco si hace falta,
    // o simplemente tomamos los patrones y resolvemos.
    const usados = new Set();
    const ejercicios = [];
    
    for (const clave of patronesDelDia) {
      const patron = PATRONES[clave];
      if (!patron) continue;
      const ex = resolverPatron(patron, equipos, usados);
      if (!ex) continue;
      usados.add(ex.id);
      ejercicios.push(configDeEjercicio(ex, patron));
    }
    
    diasGenerados.push({
      id: uid(),
      nombre: diasSemanales[idx],
      ejercicios
    });
  });

  return {
    id: uid(),
    nombre: 'Tu rutina habitual',
    descripcion: 'Generada a partir de tu división muscular actual.',
    diasSemana: diasGenerados.length,
    creada: new Date().toISOString(),
    dias: diasGenerados,
  };
}

/** Rutina vacía para montarla a mano. */
export function rutinaVacia(nombre = 'Mi rutina') {
  return {
    id: uid(),
    nombre,
    descripcion: 'Rutina creada a mano',
    diasSemana: 1,
    creada: new Date().toISOString(),
    dias: [{ id: uid(), nombre: 'Día 1', ejercicios: [] }],
  };
}

/** Sustituye un ejercicio conservando series y rango de reps. */
export function cambiarEjercicio(config, nuevoId) {
  const ex = ejercicio(nuevoId);
  if (!ex) return config;
  return { ...config, exId: ex.id, nombre: ex.name, equipment: ex.equipment, target: ex.target };
}
