/**
 * Plantillas de rutina. Cada día es una lista de patrones de movimiento, no de
 * ejercicios concretos: el generador resuelve cada patrón contra el catálogo
 * usando el material que el usuario tenga, cayendo a la siguiente preferencia
 * cuando algo no está disponible.
 */

/** Biblioteca de patrones. `pref` va de mejor a peor; `target` es el respaldo. */
export const PATRONES = {
  empujeHorizontal: {
    nombre: 'Empuje horizontal', tipo: 'fuerza', series: 4, repMin: 12, repMax: 15,
    pref: ['press de banca con barra', 'press de banca con mancuernas', 'prensa de pecho con palanca', 'press de banca smith', 'flexión'],
    target: 'pectorals',
  },
  empujeInclinado: {
    nombre: 'Pecho superior', tipo: 'hipertrofia', series: 3, repMin: 12, repMax: 15,
    pref: ['press de banca inclinado con mancuernas', 'press de banca inclinado con barra', 'press de pecho inclinado con palanca', 'flexión inclinada'],
    target: 'pectorals',
  },
  aperturaPecho: {
    nombre: 'Apertura de pecho', tipo: 'accesorio', series: 3, repMin: 12, repMax: 15,
    pref: ['mosca media del cable', 'mosca con mancuernas', 'mosca sentada con palanca', 'cable de vuelo bajo'],
    target: 'pectorals',
  },
  empujeVertical: {
    nombre: 'Empuje vertical', tipo: 'fuerza', series: 4, repMin: 12, repMax: 15,
    pref: ['press de hombros sentado con mancuernas', 'press de hombros sentado con barra', 'press de hombros con palanca', 'press de hombros de pie con mancuernas'],
    target: 'delts',
  },
  traccionVertical: {
    nombre: 'Tracción vertical', tipo: 'hipertrofia', series: 4, repMin: 12, repMax: 15,
    pref: ['cable desplegable', 'levantarse', 'dominadas', 'dominadas asistidas', 'palanca de agarre inverso fila vertical'],
    target: 'lats',
  },
  traccionHorizontal: {
    nombre: 'Remo', tipo: 'hipertrofia', series: 4, repMin: 12, repMax: 15,
    pref: ['barra inclinada sobre remo', 'mancuerna inclinada sobre la fila', 'fila baja sentada con cable', 'palanca de agarre estrecho fila sentada'],
    target: 'upper back',
  },
  sentadilla: {
    nombre: 'Sentadilla', tipo: 'fuerza', series: 4, repMin: 12, repMax: 15,
    pref: ['sentadilla completa con barra', 'sentadilla completa smith', 'prensa de piernas en trineo a 45°', 'prensa de piernas smith', 'sentadilla con mancuernas', 'sentadillas divididas'],
    target: 'cuádriceps',
  },
  bisagra: {
    nombre: 'Bisagra de cadera', tipo: 'fuerza', series: 3, repMin: 12, repMax: 15,
    pref: ['peso muerto rumano con barra', 'peso muerto rumano con mancuernas', 'peso muerto con barra', 'peso muerto con pierna recta y barra'],
    target: 'glutes',
  },
  zancada: {
    nombre: 'Zancada', tipo: 'hipertrofia', series: 3, repMin: 12, repMax: 15,
    pref: ['estocada con mancuernas', 'estocada con barra', 'estocada trasera con mancuernas', 'estocada caminando'],
    target: 'cuádriceps',
  },
  extensionRodilla: {
    nombre: 'Extensión de rodilla', tipo: 'accesorio', series: 3, repMin: 12, repMax: 15,
    pref: ['extensión de pierna de palanca', 'extensión de pierna con banda de resistencia'],
    target: 'cuádriceps',
  },
  curlFemoral: {
    nombre: 'Curl femoral', tipo: 'hipertrofia', series: 3, repMin: 12, repMax: 15,
    pref: ['curl de piernas sentado con palanca', 'curl de piernas acostado con palanca', 'curl de piernas arrodillado con palanca'],
    target: 'hamstrings',
  },
  gemelo: {
    nombre: 'Gemelo', tipo: 'accesorio', series: 4, repMin: 12, repMax: 15,
    pref: ['elevación de pantorrilla sentado con palanca', 'elevación de pantorrilla de pie con palanca', 'elevación de pantorrilla de pie con mancuernas', 'elevación de pantorrilla de pie con barra'],
    target: 'calves',
  },
  lateral: {
    nombre: 'Elevación lateral', tipo: 'accesorio', series: 3, repMin: 12, repMax: 15,
    pref: ['elevación lateral con mancuernas', 'elevación lateral del cable', 'elevación lateral de la palanca'],
    target: 'delts',
  },
  deltoidePosterior: {
    nombre: 'Deltoide posterior', tipo: 'accesorio', series: 3, repMin: 12, repMax: 15,
    pref: ['remo delt trasero con cable (con cuerda)', 'remo delt trasero con mancuernas hombro', 'cable cruzado invertido volar', 'mosca inversa de banda'],
    target: 'delts',
  },
  biceps: {
    nombre: 'Bíceps', tipo: 'accesorio', series: 3, repMin: 12, repMax: 15,
    pref: ['curl con barra', 'curl de bíceps con mancuernas', 'curl con barra ez', 'enrollamiento del cable'],
    target: 'biceps',
  },
  triceps: {
    nombre: 'Tríceps', tipo: 'accesorio', series: 3, repMin: 12, repMax: 15,
    pref: ['empuje del cable', 'extensión de tríceps tumbado con mancuernas', 'extensión de tríceps tumbado con barra', 'inmersión de tríceps'],
    target: 'triceps',
  },
  trapecio: {
    nombre: 'Trapecio', tipo: 'accesorio', series: 3, repMin: 12, repMax: 15,
    pref: ['encogimiento de hombros con barra', 'encogimiento de hombros con mancuernas', 'encogimiento de hombros'],
    target: 'traps',
  },
  core: {
    nombre: 'Core', tipo: 'accesorio', series: 3, repMin: 12, repMax: 15,
    pref: ['crujido de cable de rodillas', 'elevación de piernas colgando', 'piso crujiente', 'tabla frontal ponderada'],
    target: 'abs',
  },
};

/** Plantillas por número de días a la semana. */
export const PLANTILLAS = {
  2: {
    nombre: 'Cuerpo entero (2 días)',
    descripcion: 'Dos sesiones de cuerpo entero. Con 2 días es lo único que da estímulo suficiente a todo.',
    dias: [
      { nombre: 'Full body A (Cuerpo entero)', patrones: ['sentadilla', 'empujeHorizontal', 'traccionHorizontal', 'curlFemoral', 'lateral', 'core'] },
      { nombre: 'Full body B (Cuerpo entero)', patrones: ['bisagra', 'empujeVertical', 'traccionVertical', 'zancada', 'biceps', 'triceps'] },
    ],
  },
  3: {
    nombre: 'Cuerpo entero (3 días)',
    descripcion: 'Cuerpo entero tres veces por semana: cada músculo recibe estímulo 3 veces, ideal para progresar rápido al principio.',
    dias: [
      { nombre: 'Full body A (Cuerpo entero)', patrones: ['sentadilla', 'empujeHorizontal', 'traccionHorizontal', 'curlFemoral', 'lateral', 'core'] },
      { nombre: 'Full body B (Cuerpo entero)', patrones: ['bisagra', 'empujeVertical', 'traccionVertical', 'extensionRodilla', 'biceps', 'triceps'] },
      { nombre: 'Full body C (Cuerpo entero)', patrones: ['sentadilla', 'empujeInclinado', 'traccionHorizontal', 'curlFemoral', 'deltoidePosterior', 'gemelo'] },
    ],
  },
  4: {
    nombre: 'Torso y Pierna (Pecho, Espalda, Brazos, Piernas)',
    descripcion: 'Dos días de torso y dos de pierna. El reparto clásico cuando ya tienes algo de base.',
    dias: [
      { nombre: 'Torso A (Pecho, Espalda, Hombro, Brazos)', patrones: ['empujeHorizontal', 'traccionHorizontal', 'empujeVertical', 'traccionVertical', 'lateral', 'triceps'] },
      { nombre: 'Pierna A (Cuádriceps, Femoral, Gemelo)', patrones: ['sentadilla', 'curlFemoral', 'zancada', 'gemelo', 'core'] },
      { nombre: 'Torso B (Pecho, Espalda, Hombro, Brazos)', patrones: ['empujeInclinado', 'traccionVertical', 'aperturaPecho', 'deltoidePosterior', 'biceps', 'trapecio'] },
      { nombre: 'Pierna B (Cuádriceps, Femoral, Gemelo)', patrones: ['bisagra', 'extensionRodilla', 'curlFemoral', 'gemelo', 'core'] },
    ],
  },
  5: {
    nombre: 'Pecho/Tríceps, Espalda/Bíceps y Pierna (5 días)',
    descripcion: 'Cinco días con frecuencia alta en los grupos que más cuesta subir.',
    dias: [
      { nombre: 'Empuje (Pecho, Hombro, Tríceps)', patrones: ['empujeHorizontal', 'empujeVertical', 'empujeInclinado', 'lateral', 'triceps'] },
      { nombre: 'Tirón (Espalda, Bíceps, Trapecio)', patrones: ['traccionVertical', 'traccionHorizontal', 'deltoidePosterior', 'biceps', 'trapecio'] },
      { nombre: 'Pierna (Cuádriceps, Femoral, Gemelo)', patrones: ['sentadilla', 'curlFemoral', 'zancada', 'gemelo', 'core'] },
      { nombre: 'Torso (Pecho, Espalda, Hombro, Brazos)', patrones: ['empujeInclinado', 'traccionHorizontal', 'lateral', 'biceps', 'triceps'] },
      { nombre: 'Pierna y core (Cuádriceps, Femoral, Gemelo, Abs)', patrones: ['bisagra', 'extensionRodilla', 'curlFemoral', 'gemelo', 'core'] },
    ],
  },
  6: {
    nombre: 'Pecho/Tríceps, Espalda/Bíceps y Pierna (6 días)',
    descripcion: 'Seis días. Solo tiene sentido si duermes y comes bien: es mucho volumen semanal.',
    dias: [
      { nombre: 'Empuje A (Pecho, Hombro, Tríceps)', patrones: ['empujeHorizontal', 'empujeVertical', 'aperturaPecho', 'lateral', 'triceps'] },
      { nombre: 'Tirón A (Espalda, Bíceps, Trapecio)', patrones: ['traccionVertical', 'traccionHorizontal', 'deltoidePosterior', 'biceps', 'trapecio'] },
      { nombre: 'Pierna A (Cuádriceps, Femoral, Gemelo)', patrones: ['sentadilla', 'curlFemoral', 'zancada', 'gemelo', 'core'] },
      { nombre: 'Empuje B (Pecho, Hombro, Tríceps)', patrones: ['empujeInclinado', 'empujeVertical', 'aperturaPecho', 'lateral', 'triceps'] },
      { nombre: 'Tirón B (Espalda, Bíceps, Trapecio)', patrones: ['traccionHorizontal', 'traccionVertical', 'deltoidePosterior', 'biceps', 'core'] },
      { nombre: 'Pierna B (Cuádriceps, Femoral, Gemelo)', patrones: ['bisagra', 'extensionRodilla', 'curlFemoral', 'gemelo', 'core'] },
    ],
  },
};
