/* Traducción del vocabulario del dataset (inglés) y agrupación muscular propia. */

export const BODY_PART_ES = {
  'back': 'espalda',
  'cardio': 'cardio',
  'chest': 'pecho',
  'lower arms': 'antebrazos',
  'lower legs': 'pantorrillas',
  'neck': 'cuello',
  'shoulders': 'hombros',
  'upper arms': 'brazos',
  'upper legs': 'piernas',
  'waist': 'core',
};

export const EQUIPO_ES = {
  'assisted': 'asistido',
  'band': 'banda elástica',
  'barbell': 'barra',
  'body weight': 'peso corporal',
  'bosu ball': 'bosu',
  'cable': 'polea',
  'dumbbell': 'mancuernas',
  'elliptical machine': 'elíptica',
  'ez barbell': 'barra Z',
  'hammer': 'martillo',
  'kettlebell': 'kettlebell',
  'leverage machine': 'máquina',
  'medicine ball': 'balón medicinal',
  'olympic barbell': 'barra olímpica',
  'resistance band': 'banda de resistencia',
  'roller': 'rueda',
  'rope': 'cuerda',
  'skierg machine': 'skierg',
  'sled machine': 'prensa',
  'smith machine': 'multipower',
  'stability ball': 'fitball',
  'stationary bike': 'bici estática',
  'stepmill machine': 'escaladora',
  'tire': 'neumático',
  'trap bar': 'barra hexagonal',
  'upper body ergometer': 'ergómetro de brazos',
  'weighted': 'lastrado',
  'wheel roller': 'rueda abdominal',
};

export const TARGET_ES = {
  'abductors': 'abductores',
  'abs': 'abdomen',
  'adductors': 'aductores',
  'biceps': 'bíceps',
  'calves': 'gemelos',
  'cardiovascular system': 'cardio',
  'delts': 'hombros',
  'forearms': 'antebrazos',
  'glutes': 'glúteos',
  'hamstrings': 'femoral',
  'lats': 'dorsales',
  'levator scapulae': 'cuello',
  'pectorals': 'pecho',
  'quads': 'cuádriceps',
  'serratus anterior': 'serrato',
  'spine': 'lumbar',
  'traps': 'trapecio',
  'triceps': 'tríceps',
  'upper back': 'espalda alta',
};

/** Grupos con los que se cuenta el volumen semanal (series por grupo). */
export const GRUPO = {
  'pectorals': 'pecho',
  'lats': 'espalda',
  'upper back': 'espalda',
  'traps': 'trapecio',
  'delts': 'hombros',
  'biceps': 'bíceps',
  'triceps': 'tríceps',
  'forearms': 'antebrazo',
  'quads': 'cuádriceps',
  'hamstrings': 'femoral',
  'glutes': 'glúteos',
  'calves': 'gemelos',
  'abs': 'core',
  'serratus anterior': 'core',
  'spine': 'lumbar',
  'abductors': 'abductores',
  'adductors': 'aductores',
  'levator scapulae': 'cuello',
  'cardiovascular system': 'cardio',

  // El dataset usa otro vocabulario para los músculos secundarios que para el
  // objetivo principal ("quadriceps" frente a "quads"), así que hay que
  // mapearlo también o el volumen indirecto se pierde.
  'quadriceps': 'cuádriceps',
  'shoulders': 'hombros',
  'deltoids': 'hombros',
  'rear deltoids': 'hombros',
  'rotator cuff': 'hombros',
  'chest': 'pecho',
  'upper chest': 'pecho',
  'core': 'core',
  'obliques': 'core',
  'abdominals': 'core',
  'lower abs': 'core',
  'hip flexors': 'core',
  'lower back': 'lumbar',
  'back': 'espalda',
  'rhomboids': 'espalda',
  'latissimus dorsi': 'espalda',
  'trapezius': 'trapecio',
  'brachialis': 'bíceps',
  'wrist flexors': 'antebrazo',
  'wrist extensors': 'antebrazo',
  'grip muscles': 'antebrazo',
  'wrists': 'antebrazo',
  'hands': 'antebrazo',
  'soleus': 'gemelos',
  'inner thighs': 'aductores',
  'groin': 'aductores',
};

/** Músculos secundarios que no aportan volumen de entrenamiento real. */
const SIN_VOLUMEN = new Set(['ankles', 'feet', 'ankle stabilizers', 'shins', 'sternocleidomastoid']);

/** Series semanales recomendadas por grupo para hipertrofia (mínimo útil / tope sensato). */
export const VOLUMEN_OBJETIVO = {
  pecho: [10, 20],
  espalda: [10, 22],
  hombros: [8, 20],
  bíceps: [6, 18],
  tríceps: [6, 18],
  cuádriceps: [8, 20],
  femoral: [6, 16],
  glúteos: [6, 16],
  gemelos: [6, 16],
  core: [4, 16],
  trapecio: [4, 12],
  lumbar: [2, 10],
  antebrazo: [2, 10],
};

/**
 * Familia de incremento: de cuánto en cuánto se puede subir el peso de verdad
 * con ese material. Se cruza con ajustes.incrementos.
 */
export function familiaEquipo(equipment = '') {
  const e = equipment.toLowerCase();
  if (/barbell|trap bar|smith/.test(e)) return 'barbell';
  if (/dumbbell|kettlebell/.test(e)) return 'dumbbell';
  if (e === 'cable' || e === 'rope') return 'cable';
  if (/machine|assisted|hammer|sled/.test(e)) return 'machine';
  if (/band/.test(e)) return 'band';
  if (/body weight|weighted|ball|roller|tire/.test(e)) return 'bodyweight';
  return 'otro';
}

/** Categorías de material que se eligen en el onboarding. */
export const CATEGORIAS_EQUIPO = [
  { id: 'barra', nombre: 'Barra', equipos: ['barbell', 'ez barbell', 'olympic barbell', 'trap bar', 'smith machine'] },
  { id: 'mancuernas', nombre: 'Mancuernas', equipos: ['dumbbell', 'kettlebell'] },
  { id: 'maquinas', nombre: 'Máquinas y poleas', equipos: ['cable', 'leverage machine', 'sled machine', 'assisted', 'hammer', 'rope'] },
  { id: 'bandas', nombre: 'Bandas', equipos: ['band', 'resistance band'] },
  { id: 'corporal', nombre: 'Peso corporal', equipos: ['body weight', 'weighted', 'stability ball', 'bosu ball', 'medicine ball', 'roller', 'wheel roller'] },
];

/** Conjunto de equipment del dataset disponibles según las categorías elegidas. */
export function equiposDisponibles(categorias = []) {
  const set = new Set();
  for (const c of CATEGORIAS_EQUIPO) {
    if (categorias.includes(c.id)) c.equipos.forEach((e) => set.add(e));
  }
  return set;
}

export const tEquipo = (e) => EQUIPO_ES[e] || e;
export const tTarget = (t) => TARGET_ES[t] || t;
export const tBodyPart = (b) => BODY_PART_ES[b] || b;
export const grupoDe = (target) => GRUPO[target] || TARGET_ES[target] || target;

/** Grupos secundarios de un ejercicio, sin repetir el principal ni los inútiles. */
export function gruposSecundarios(secundarios = [], principal = '') {
  const g = grupoDe(principal);
  const out = [];
  for (const m of secundarios) {
    if (SIN_VOLUMEN.has(m)) continue;
    const grupo = GRUPO[m];
    if (!grupo || grupo === g || out.includes(grupo)) continue;
    out.push(grupo);
  }
  return out.slice(0, 2);
}
