/**
 * Nutrición: objetivos calculados y plan de comidas.
 *
 * Nada de pesar cada gramo del día: se calcula el gasto, se fijan macros y se
 * arma un plan de comidas con cantidades concretas que puedes marcar hechas.
 * El único dato que hay que meter a diario es el peso corporal, y con la
 * tendencia se ajustan las calorías solas.
 */
import { S, guardar, pesoActual, tendenciaPeso } from '../store.js';
import { hoyISO, num } from '../lib/ui.js';

let BD = null;

export async function cargarAlimentos() {
  if (BD) return BD;
  const r = await fetch('js/data/foods.json');
  if (!r.ok) throw new Error('No se pudo cargar la base de alimentos');
  BD = await r.json();
  BD.mapa = new Map(BD.alimentos.map((a) => [a.id, a]));
  return BD;
}

export const alimento = (id) => BD?.mapa.get(id) || null;
export const alimentos = () => BD?.alimentos || [];

export const FACTOR_ACTIVIDAD = {
  sedentario: { f: 1.2, nombre: 'Sedentario', desc: 'Trabajo sentado y poco más' },
  ligero: { f: 1.375, nombre: 'Ligero', desc: 'Algo de movimiento diario' },
  moderado: { f: 1.55, nombre: 'Moderado', desc: 'Entreno 3-5 días y vida activa' },
  alto: { f: 1.725, nombre: 'Alto', desc: 'Entreno duro casi a diario' },
  muy_alto: { f: 1.9, nombre: 'Muy alto', desc: 'Trabajo físico + entreno' },
};

export const OBJETIVOS = {
  definir: { nombre: 'Definir', ajuste: -0.15, ritmo: [-0.7, -0.3], desc: 'Perder grasa manteniendo músculo' },
  mantener: { nombre: 'Mantener', ajuste: 0, ritmo: [-0.15, 0.15], desc: 'Recomposición, sin prisa' },
  volumen: { nombre: 'Ganar músculo', ajuste: 0.1, ritmo: [0.15, 0.4], desc: 'Superávit controlado' },
};

/** Metabolismo basal por Mifflin-St Jeor. */
export function tmb({ sexo, peso, altura, edad }) {
  const base = 10 * peso + 6.25 * altura - 5 * edad;
  return sexo === 'mujer' ? base - 161 : base + 5;
}

/** Objetivos de calorías y macros a partir del perfil + ajustes acumulados. */
export function objetivos(perfil = S.perfil) {
  if (!perfil) return null;
  const peso = pesoActual() ?? perfil.peso;
  const basal = tmb({ ...perfil, peso });
  const gasto = basal * (FACTOR_ACTIVIDAD[perfil.actividad]?.f ?? 1.55);
  const obj = OBJETIVOS[perfil.objetivo] ?? OBJETIVOS.mantener;

  const ajusteManual = (S.comida.ajustes || []).reduce((t, a) => t + a.kcal, 0);
  const kcal = Math.round(gasto * (1 + obj.ajuste) + ajusteManual);

  // Proteína alta y grasa suficiente; el resto, carbohidrato para entrenar.
  const proteina = Math.round(peso * (perfil.objetivo === 'definir' ? 2.2 : 2.0));
  const grasa = Math.round(peso * 0.8);
  const carbo = Math.max(50, Math.round((kcal - proteina * 4 - grasa * 9) / 4));

  return {
    basal: Math.round(basal),
    gasto: Math.round(gasto),
    kcal,
    proteina,
    grasa,
    carbo,
    ajusteManual,
    objetivo: obj,
    peso,
  };
}

/* ==========================================================================
   Plan de comidas
   ========================================================================== */

/** Reparto de los macros del día entre las comidas. */
const REPARTO = {
  2: [0.45, 0.55],
  3: [0.3, 0.4, 0.3],
  4: [0.25, 0.15, 0.35, 0.25],
  5: [0.22, 0.12, 0.31, 0.13, 0.22],
};

const redondear = (g) => (g >= 100 ? Math.round(g / 10) * 10 : Math.round(g / 5) * 5);

/**
 * Ajusta las cantidades de una comida para cuadrar sus macros.
 *
 * No basta con dividir "proteína entre el alimento proteico": el arroz o la
 * avena también aportan proteína, y la fuente proteica aporta carbohidrato.
 * Se resuelve en dos pasadas, descontando en cada una lo que ya aporta el
 * otro alimento, y al final la grasa rellena el hueco que quede.
 */
function cuadrarComida(plantilla, objetivo, elegidos) {
  const p = alimento(elegidos.proteina);
  const c = alimento(elegidos.carbo);
  const g = alimento(elegidos.grasa);
  const items = [];

  const TOPE_PROT = 400;
  const TOPE_CARB = 700;

  // La verdura va a cantidad fija, así que sus macros se descuentan antes.
  const verdura = (plantilla.extra || []).map(alimento).find(Boolean);
  if (verdura) {
    const k = 150 / 100;
    objetivo = {
      proteina: Math.max(0, objetivo.proteina - verdura.p * k),
      carbo: Math.max(0, objetivo.carbo - verdura.c * k),
      grasa: Math.max(0, objetivo.grasa - verdura.g * k),
    };
  }

  // 1ª pasada: cuánto carbohidrato haría falta si viniera todo de su alimento.
  let gC = c?.c > 0 ? Math.min((objetivo.carbo / c.c) * 100, TOPE_CARB) : 0;

  // 2ª pasada: la proteína que ya trae ese carbohidrato reduce la fuente proteica.
  let gP = 0;
  if (p?.p > 0) {
    const proteinaDelCarbo = (gC * (c?.p ?? 0)) / 100;
    gP = Math.min(Math.max(0, (objetivo.proteina - proteinaDelCarbo) / p.p) * 100, TOPE_PROT);
  }

  // Y el carbohidrato que trae la fuente proteica reduce a su vez el carbo.
  if (c?.c > 0) {
    const carboDeLaProteina = (gP * (p?.c ?? 0)) / 100;
    gC = Math.min(Math.max(0, (objetivo.carbo - carboDeLaProteina) / c.c) * 100, TOPE_CARB);
  }

  gP = redondear(gP);
  gC = redondear(gC);
  if (gP > 0) items.push({ id: p.id, gramos: gP });
  if (gC > 0) items.push({ id: c.id, gramos: gC });

  const grasaYaPuesta = (gP * (p?.g ?? 0)) / 100 + (gC * (c?.g ?? 0)) / 100;
  const restoGrasa = objetivo.grasa - grasaYaPuesta;

  if (g && g.g > 0 && restoGrasa > 2) {
    const gG = Math.min(redondear((restoGrasa / g.g) * 100), 120);
    if (gG > 0) items.push({ id: g.id, gramos: gG });
  }

  for (const id of plantilla.extra || []) {
    if (alimento(id)) { items.push({ id, gramos: 150 }); break; }
  }

  return items;
}

/** Suma de macros de una lista de {id, gramos}. */
export function macrosDe(items) {
  return items.reduce((t, it) => {
    const a = alimento(it.id);
    if (!a) return t;
    const k = it.gramos / 100;
    return {
      kcal: t.kcal + a.kcal * k,
      p: t.p + a.p * k,
      c: t.c + a.c * k,
      g: t.g + a.g * k,
    };
  }, { kcal: 0, p: 0, c: 0, g: 0 });
}

/**
 * Genera el plan del día. `preferencias` permite fijar el alimento de un hueco
 * concreto (`{ 'comida.proteina': 'ternera' }`) para que el usuario cambie
 * cosas sin que se le descuadren los macros.
 */
export function generarPlan(nComidas = 4, preferencias = {}) {
  const obj = objetivos();
  if (!obj || !BD) return null;

  const plantillas = elegirPlantillas(nComidas);
  const reparto = REPARTO[nComidas] || REPARTO[4];

  const comidas = plantillas.map((pl, i) => {
    const parte = reparto[i];
    const objetivoComida = {
      proteina: obj.proteina * parte,
      carbo: obj.carbo * parte,
      grasa: obj.grasa * parte,
    };
    const elegidos = {
      proteina: preferencias[`${pl.id}.proteina`] || pl.proteina[0],
      carbo: preferencias[`${pl.id}.carbo`] || pl.carbo[0],
      grasa: preferencias[`${pl.id}.grasa`] || pl.grasa[0],
    };
    const items = cuadrarComida(pl, objetivoComida, elegidos);
    return { id: pl.id, nombre: pl.nombre, hora: pl.hora, elegidos, items, macros: macrosDe(items) };
  });

  return {
    creado: hoyISO(),
    nComidas,
    preferencias,
    objetivos: obj,
    comidas,
    total: comidas.reduce((t, c) => ({
      kcal: t.kcal + c.macros.kcal,
      p: t.p + c.macros.p,
      c: t.c + c.macros.c,
      g: t.g + c.macros.g,
    }), { kcal: 0, p: 0, c: 0, g: 0 }),
  };
}

function elegirPlantillas(n) {
  const todas = BD.plantillas;
  if (n >= todas.length) return todas;
  const orden = { 2: ['comida', 'cena'], 3: ['desayuno', 'comida', 'cena'], 4: ['desayuno', 'media_manana', 'comida', 'cena'] };
  const ids = orden[n] || todas.slice(0, n).map((p) => p.id);
  return ids.map((id) => todas.find((p) => p.id === id)).filter(Boolean);
}

export function guardarPlan(plan) {
  S.comida.plan = plan;
  guardar();
}

/* ==========================================================================
   Seguimiento diario y autoajuste
   ========================================================================== */

export function marcarComida(fecha, comidaId, hecho) {
  S.comida.hecho[fecha] = S.comida.hecho[fecha] || {};
  S.comida.hecho[fecha][comidaId] = hecho;
  guardar();
}

export function comidasHechas(fecha = hoyISO()) {
  return S.comida.hecho[fecha] || {};
}

const suma = (a, b) => ({ kcal: a.kcal + b.kcal, p: a.p + b.p, c: a.c + b.c, g: a.g + b.g });
const CERO = { kcal: 0, p: 0, c: 0, g: 0 };

/* ---------- Diario: lo que has comido de verdad ---------- */

export const diarioDe = (fecha = hoyISO()) => S.comida.diario[fecha] || [];

/** Añade un producto escaneado o buscado, con los gramos que te has comido. */
export function anotarEnDiario(producto, gramos, fecha = hoyISO()) {
  const g = Number(gramos) || 0;
  if (!g) return null;
  const k = g / 100;
  const entrada = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    codigo: producto.codigo || null,
    nombre: producto.nombre,
    marca: producto.marca || '',
    gramos: g,
    por100: { kcal: producto.kcal, p: producto.p, c: producto.c, g: producto.g },
    macros: { kcal: producto.kcal * k, p: producto.p * k, c: producto.c * k, g: producto.g * k },
    ts: Date.now(),
  };
  S.comida.diario[fecha] = [...diarioDe(fecha), entrada];
  guardar();
  return entrada;
}

export function borrarDelDiario(id, fecha = hoyISO()) {
  S.comida.diario[fecha] = diarioDe(fecha).filter((e) => e.id !== id);
  guardar();
}

export const macrosDelDiario = (fecha = hoyISO()) => diarioDe(fecha).reduce((t, e) => suma(t, e.macros), CERO);

/* ---------- Mi despensa: productos ya conocidos ---------- */

/**
 * Todo producto que pasa por el escáner se guarda aquí. Así el segundo escaneo
 * es instantáneo y funciona sin conexión, y los productos que Open Food Facts
 * no tiene (casi todo lo local) se crean una vez y quedan para siempre.
 */
export function guardarProducto(producto) {
  const i = S.comida.misProductos.findIndex(
    (p) => (producto.codigo && p.codigo === producto.codigo)
      || (!producto.codigo && p.nombre.toLowerCase() === producto.nombre.toLowerCase()),
  );
  const limpio = { ...producto, usos: (S.comida.misProductos[i]?.usos || 0) + 1, visto: hoyISO() };
  if (i >= 0) S.comida.misProductos[i] = limpio;
  else S.comida.misProductos.push(limpio);
  guardar();
  return limpio;
}

export const productoGuardado = (codigo) => S.comida.misProductos.find((p) => p.codigo === codigo) || null;

/** Los más usados primero: es lo que vas a volver a comer. */
export const misProductos = () => [...S.comida.misProductos].sort((a, b) => (b.usos || 0) - (a.usos || 0));

export function borrarProducto(codigoONombre) {
  S.comida.misProductos = S.comida.misProductos.filter(
    (p) => p.codigo !== codigoONombre && p.nombre !== codigoONombre,
  );
  guardar();
}

/** Macros ingeridos hoy: plan marcado + lo anotado en el diario. */
export function ingeridoHoy(fecha = hoyISO()) {
  const plan = S.comida.plan;
  const hecho = comidasHechas(fecha);
  const delPlan = plan
    ? plan.comidas.filter((c) => hecho[c.id]).reduce((t, c) => suma(t, c.macros), CERO)
    : CERO;
  return suma(delPlan, macrosDelDiario(fecha));
}

const SEMANA_MS = 7 * 86400000;

/**
 * Autoajuste: si la tendencia de peso de las últimas semanas no va en la
 * dirección del objetivo, mueve las calorías. Solo actúa una vez cada 14 días
 * y con al menos 8 pesajes, para no perseguir el ruido de la báscula.
 */
export function revisarAjuste() {
  const perfil = S.perfil;
  if (!perfil) return null;
  if (S.peso.length < 8) return { estado: 'pocos_datos', texto: 'Pésate al menos 3 veces por semana durante 2-3 semanas y te ajusto las calorías solo.' };

  const ultimo = S.comida.ajustes.at(-1);
  if (ultimo && Date.now() - new Date(ultimo.fecha).getTime() < 2 * SEMANA_MS) {
    return { estado: 'reciente', texto: 'Ajusté las calorías hace menos de dos semanas. Dale tiempo antes de tocarlas otra vez.' };
  }

  const t = tendenciaPeso();
  if (!t) return null;
  const [minR, maxR] = OBJETIVOS[perfil.objetivo]?.ritmo ?? [-0.15, 0.15];
  const ritmo = t.porSemana;

  if (ritmo < minR) {
    return {
      estado: 'subir',
      delta: 120,
      texto: `Estás perdiendo ${num(Math.abs(ritmo))} kg por semana, más rápido de lo aconsejable (${num(Math.abs(maxR))} kg). Te subo 120 kcal para no perder músculo por el camino.`,
    };
  }
  if (ritmo > maxR) {
    return {
      estado: 'bajar',
      delta: -120,
      texto: `Estás ganando ${num(ritmo)} kg por semana, por encima del objetivo. Te bajo 120 kcal: por encima de ese ritmo lo que se gana es grasa.`,
    };
  }
  return { estado: 'ok', texto: `Vas a ${num(ritmo)} kg por semana, justo en el ritmo del objetivo. No toco nada.` };
}

export function aplicarAjuste(delta, motivo) {
  S.comida.ajustes.push({ fecha: hoyISO(), kcal: delta, motivo });
  if (S.comida.plan) S.comida.plan = generarPlan(S.comida.plan.nComidas, S.comida.plan.preferencias);
  guardar();
}
