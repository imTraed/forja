/**
 * Chequeo semanal del modo lite.
 *
 * En lite no se anota serie a serie, así que sin esto no habría con qué medir
 * si progresas. Una vez por semana se pregunta por un solo ejercicio de cada
 * zona — el básico que ya tienes en tu rutina — y ese número entra al historial
 * como un punto más. Cuatro preguntas y sigues teniendo gráficas, récords y un
 * entrenador que sabe si vas subiendo o llevas un mes clavado.
 *
 * Se pregunta por ejercicios concretos y no por "el peso de la zona" a propósito:
 * repartir un número entre todos los ejercicios de una zona sería inventarse
 * datos, y un dato inventado es peor que ninguno.
 */
import { rutinaActiva, historial, ultimoChequeo } from '../store.js';
import { grupoDe } from '../data/i18n.js';

export const ZONAS = [
  { id: 'pecho', nombre: 'Pecho', grupos: ['pecho'] },
  { id: 'espalda', nombre: 'Espalda', grupos: ['espalda', 'trapecio'] },
  { id: 'brazos', nombre: 'Brazos', grupos: ['bíceps', 'tríceps', 'antebrazo'] },
  { id: 'piernas', nombre: 'Piernas', grupos: ['cuádriceps', 'femoral', 'glúteos', 'gemelos'] },
];

/** Cuanto más básico y pesado, mejor referencia para medir la fuerza de la zona. */
const PESO_TIPO = { fuerza: 3, hipertrofia: 2, accesorio: 1 };

/**
 * El ejercicio de la rutina que mejor representa una zona: el más básico, y
 * entre iguales, el que más veces aparece en la semana.
 */
export function ejercicioClave(zona, rutina = rutinaActiva()) {
  if (!rutina?.dias?.length) return null;

  const candidatos = new Map();
  for (const dia of rutina.dias) {
    for (const ej of dia.ejercicios) {
      if (!zona.grupos.includes(grupoDe(ej.target))) continue;
      const previo = candidatos.get(ej.exId);
      if (previo) previo.veces++;
      else candidatos.set(ej.exId, { ...ej, veces: 1 });
    }
  }
  if (!candidatos.size) return null;

  return [...candidatos.values()].sort((a, b) => {
    const tipo = (PESO_TIPO[b.tipo] || 0) - (PESO_TIPO[a.tipo] || 0);
    if (tipo) return tipo;
    if (a.repMin !== b.repMin) return a.repMin - b.repMin;   // más pesado primero
    return b.veces - a.veces;
  })[0];
}

/**
 * Las preguntas del chequeo, ya resueltas contra la rutina activa y con el
 * último peso conocido para no partir de cero.
 * @returns {{zona, nombre, ej, reps, ultimo, fechaUltimo}[]}
 */
export function preguntas(rutina = rutinaActiva()) {
  const previo = ultimoChequeo();

  return ZONAS.map((zona) => {
    const ej = ejercicioClave(zona, rutina);
    if (!ej) return null;

    const hist = historial(ej.exId);
    const ultimoDelChequeo = previo?.zonas.find((z) => z.exId === ej.exId)?.peso;
    const ultimoDelHistorial = hist.at(-1)?.mejor?.peso;

    return {
      zona: zona.id,
      nombre: zona.nombre,
      ej,
      // Punto medio del rango: en lite nadie cuenta las reps exactas.
      reps: Math.round(((ej.repMin || 8) + (ej.repMax || 12)) / 2),
      ultimo: ultimoDelChequeo ?? ultimoDelHistorial ?? null,
      fechaUltimo: hist.at(-1)?.fecha ?? null,
    };
  }).filter(Boolean);
}

/** Convierte lo respondido en el formato que guarda el store. */
export function aZonas(preguntasResueltas, valores) {
  return preguntasResueltas.map((p) => ({
    zona: p.zona,
    exId: p.ej.exId,
    nombre: p.ej.nombre,
    equipment: p.ej.equipment,
    target: p.ej.target,
    peso: Number(valores[p.zona]) || 0,
    reps: p.reps,
  }));
}

/** Comparación con el chequeo anterior, para contar qué ha cambiado. */
export function comparar(zonas) {
  const previo = ultimoChequeo();
  if (!previo) return [];
  return zonas.map((z) => {
    const antes = previo.zonas.find((x) => x.exId === z.exId)?.peso;
    if (!antes) return null;
    return { nombre: z.nombre, antes, ahora: z.peso, delta: z.peso - antes };
  }).filter(Boolean);
}
