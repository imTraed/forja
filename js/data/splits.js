/**
 * Plantillas de rutina. Cada día es una lista de patrones de movimiento, no de
 * ejercicios concretos: el generador resuelve cada patrón contra el catálogo
 * usando el material que el usuario tenga, cayendo a la siguiente preferencia
 * cuando algo no está disponible.
 */

/** Biblioteca de patrones. `pref` va de mejor a peor; `target` es el respaldo. */
export const PATRONES = {
  empujeHorizontal: {
    nombre: 'Empuje horizontal', tipo: 'fuerza', series: 4, repMin: 5, repMax: 8,
    pref: ['barbell bench press', 'dumbbell bench press', 'lever chest press', 'smith bench press', 'push-up'],
    target: 'pectorals',
  },
  empujeInclinado: {
    nombre: 'Pecho superior', tipo: 'hipertrofia', series: 3, repMin: 8, repMax: 12,
    pref: ['dumbbell incline bench press', 'barbell incline bench press', 'lever incline chest press', 'incline push-up'],
    target: 'pectorals',
  },
  aperturaPecho: {
    nombre: 'Apertura de pecho', tipo: 'accesorio', series: 3, repMin: 12, repMax: 15,
    pref: ['cable middle fly', 'dumbbell fly', 'lever seated fly', 'cable low fly'],
    target: 'pectorals',
  },
  empujeVertical: {
    nombre: 'Empuje vertical', tipo: 'fuerza', series: 4, repMin: 6, repMax: 10,
    pref: ['dumbbell seated shoulder press', 'barbell seated overhead press', 'lever shoulder press', 'dumbbell standing overhead press'],
    target: 'delts',
  },
  traccionVertical: {
    nombre: 'Tracción vertical', tipo: 'hipertrofia', series: 4, repMin: 6, repMax: 12,
    pref: ['cable pulldown', 'pull-up', 'chin-up', 'assisted pull-up', 'lever reverse grip vertical row'],
    target: 'lats',
  },
  traccionHorizontal: {
    nombre: 'Remo', tipo: 'hipertrofia', series: 4, repMin: 8, repMax: 12,
    pref: ['barbell bent over row', 'dumbbell bent over row', 'cable low seated row', 'lever narrow grip seated row'],
    target: 'upper back',
  },
  sentadilla: {
    nombre: 'Sentadilla', tipo: 'fuerza', series: 4, repMin: 5, repMax: 8,
    pref: ['barbell full squat', 'smith full squat', 'sled 45° leg press', 'smith leg press', 'dumbbell squat', 'split squats'],
    target: 'quads',
  },
  bisagra: {
    nombre: 'Bisagra de cadera', tipo: 'fuerza', series: 3, repMin: 6, repMax: 10,
    pref: ['barbell romanian deadlift', 'dumbbell romanian deadlift', 'barbell deadlift', 'barbell straight leg deadlift'],
    target: 'glutes',
  },
  zancada: {
    nombre: 'Zancada', tipo: 'hipertrofia', series: 3, repMin: 10, repMax: 14,
    pref: ['dumbbell lunge', 'barbell lunge', 'dumbbell rear lunge', 'walking lunge'],
    target: 'quads',
  },
  extensionRodilla: {
    nombre: 'Extensión de rodilla', tipo: 'accesorio', series: 3, repMin: 12, repMax: 15,
    pref: ['lever leg extension', 'resistance band leg extension'],
    target: 'quads',
  },
  curlFemoral: {
    nombre: 'Curl femoral', tipo: 'hipertrofia', series: 3, repMin: 10, repMax: 15,
    pref: ['lever seated leg curl', 'lever lying leg curl', 'lever kneeling leg curl'],
    target: 'hamstrings',
  },
  gemelo: {
    nombre: 'Gemelo', tipo: 'accesorio', series: 4, repMin: 10, repMax: 15,
    pref: ['lever seated calf raise', 'lever standing calf raise', 'dumbbell standing calf raise', 'barbell standing calf raise'],
    target: 'calves',
  },
  lateral: {
    nombre: 'Elevación lateral', tipo: 'accesorio', series: 3, repMin: 12, repMax: 15,
    pref: ['dumbbell lateral raise', 'cable lateral raise', 'lever lateral raise'],
    target: 'delts',
  },
  deltoidePosterior: {
    nombre: 'Deltoide posterior', tipo: 'accesorio', series: 3, repMin: 12, repMax: 15,
    pref: ['cable rear delt row (with rope)', 'dumbbell rear delt row_shoulder', 'cable cross-over revers fly', 'band reverse fly'],
    target: 'delts',
  },
  biceps: {
    nombre: 'Bíceps', tipo: 'accesorio', series: 3, repMin: 8, repMax: 12,
    pref: ['barbell curl', 'dumbbell biceps curl', 'ez barbell curl', 'cable curl'],
    target: 'biceps',
  },
  triceps: {
    nombre: 'Tríceps', tipo: 'accesorio', series: 3, repMin: 8, repMax: 12,
    pref: ['cable pushdown', 'dumbbell lying triceps extension', 'barbell lying triceps extension', 'triceps dip'],
    target: 'triceps',
  },
  trapecio: {
    nombre: 'Trapecio', tipo: 'accesorio', series: 3, repMin: 10, repMax: 15,
    pref: ['barbell shrug', 'dumbbell shrug', 'cable shrug'],
    target: 'traps',
  },
  core: {
    nombre: 'Core', tipo: 'accesorio', series: 3, repMin: 10, repMax: 20,
    pref: ['cable kneeling crunch', 'hanging leg raise', 'crunch floor', 'weighted front plank'],
    target: 'abs',
  },
};

/** Plantillas por número de días a la semana. */
export const PLANTILLAS = {
  2: {
    nombre: 'Full body ×2',
    descripcion: 'Dos sesiones de cuerpo entero. Con 2 días es lo único que da estímulo suficiente a todo.',
    dias: [
      { nombre: 'Full body A', patrones: ['sentadilla', 'empujeHorizontal', 'traccionHorizontal', 'curlFemoral', 'lateral', 'core'] },
      { nombre: 'Full body B', patrones: ['bisagra', 'empujeVertical', 'traccionVertical', 'zancada', 'biceps', 'triceps'] },
    ],
  },
  3: {
    nombre: 'Full body ×3',
    descripcion: 'Cuerpo entero tres veces por semana: cada músculo recibe estímulo 3 veces, ideal para progresar rápido al principio.',
    dias: [
      { nombre: 'Full body A', patrones: ['sentadilla', 'empujeHorizontal', 'traccionHorizontal', 'curlFemoral', 'lateral', 'core'] },
      { nombre: 'Full body B', patrones: ['bisagra', 'empujeVertical', 'traccionVertical', 'extensionRodilla', 'biceps', 'triceps'] },
      { nombre: 'Full body C', patrones: ['sentadilla', 'empujeInclinado', 'traccionHorizontal', 'curlFemoral', 'deltoidePosterior', 'gemelo'] },
    ],
  },
  4: {
    nombre: 'Torso / Pierna ×2',
    descripcion: 'Dos días de torso y dos de pierna. El reparto clásico cuando ya tienes algo de base.',
    dias: [
      { nombre: 'Torso A', patrones: ['empujeHorizontal', 'traccionHorizontal', 'empujeVertical', 'traccionVertical', 'lateral', 'triceps'] },
      { nombre: 'Pierna A', patrones: ['sentadilla', 'curlFemoral', 'zancada', 'gemelo', 'core'] },
      { nombre: 'Torso B', patrones: ['empujeInclinado', 'traccionVertical', 'aperturaPecho', 'deltoidePosterior', 'biceps', 'trapecio'] },
      { nombre: 'Pierna B', patrones: ['bisagra', 'extensionRodilla', 'curlFemoral', 'gemelo', 'core'] },
    ],
  },
  5: {
    nombre: 'Empuje / Tirón / Pierna + Torso / Pierna',
    descripcion: 'Cinco días con frecuencia alta en los grupos que más cuesta subir.',
    dias: [
      { nombre: 'Empuje', patrones: ['empujeHorizontal', 'empujeVertical', 'empujeInclinado', 'lateral', 'triceps'] },
      { nombre: 'Tirón', patrones: ['traccionVertical', 'traccionHorizontal', 'deltoidePosterior', 'biceps', 'trapecio'] },
      { nombre: 'Pierna', patrones: ['sentadilla', 'curlFemoral', 'zancada', 'gemelo', 'core'] },
      { nombre: 'Torso', patrones: ['empujeInclinado', 'traccionHorizontal', 'lateral', 'biceps', 'triceps'] },
      { nombre: 'Pierna y core', patrones: ['bisagra', 'extensionRodilla', 'curlFemoral', 'gemelo', 'core'] },
    ],
  },
  6: {
    nombre: 'Empuje / Tirón / Pierna ×2',
    descripcion: 'Seis días. Solo tiene sentido si duermes y comes bien: es mucho volumen semanal.',
    dias: [
      { nombre: 'Empuje A', patrones: ['empujeHorizontal', 'empujeVertical', 'aperturaPecho', 'lateral', 'triceps'] },
      { nombre: 'Tirón A', patrones: ['traccionVertical', 'traccionHorizontal', 'deltoidePosterior', 'biceps', 'trapecio'] },
      { nombre: 'Pierna A', patrones: ['sentadilla', 'curlFemoral', 'zancada', 'gemelo', 'core'] },
      { nombre: 'Empuje B', patrones: ['empujeInclinado', 'empujeVertical', 'aperturaPecho', 'lateral', 'triceps'] },
      { nombre: 'Tirón B', patrones: ['traccionHorizontal', 'traccionVertical', 'deltoidePosterior', 'biceps', 'core'] },
      { nombre: 'Pierna B', patrones: ['bisagra', 'extensionRodilla', 'curlFemoral', 'gemelo', 'core'] },
    ],
  },
};
