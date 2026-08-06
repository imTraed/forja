/**
 * Motor de progresión: decide qué peso y cuántas reps tocan en cada ejercicio.
 *
 * Reglas, sin IA y sin aleatoriedad, para que la respuesta sea siempre la misma
 * ante los mismos datos:
 *  · Doble progresión — subes reps dentro del rango y, cuando lo cierras entero
 *    con poco margen, subes peso y vuelves al fondo del rango.
 *  · Semanas 1-2 en calibración — no se sube nada, solo se mide.
 *  · Tres sesiones sin mejorar el 1RM estimado = estancamiento, con salida
 *    (descarga o cambio de ejercicio).
 */
import { S, enCalibracion, enDeload } from '../store.js';
import { familiaEquipo } from '../data/i18n.js';
import { alPaso, num, kg } from '../lib/ui.js';

/** Incremento real de peso para ese material, según los ajustes del usuario. */
export function incrementoDe(equipment) {
  const familia = familiaEquipo(equipment);
  return S.ajustes.incrementos[familia] ?? S.ajustes.incrementos.otro ?? 2.5;
}

/** Peso principal de una sesión: el que más series concentra. */
function pesoTrabajo(sets) {
  const cuenta = new Map();
  for (const s of sets) cuenta.set(s.peso, (cuenta.get(s.peso) || 0) + 1);
  let mejor = null;
  for (const [peso, n] of cuenta) {
    if (!mejor || n > mejor.n || (n === mejor.n && peso > mejor.peso)) mejor = { peso, n };
  }
  return mejor?.peso ?? null;
}

const mediana = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  return v[Math.floor(v.length / 2)];
};

/** Estado de estancamiento mirando el 1RM estimado de las últimas sesiones. */
export function diagnostico(hist) {
  if (hist.length < 3) return { estancado: false, sesiones: hist.length, mejoraPct: null };
  const ult = hist.slice(-3).map((h) => h.e1rm);
  const mejora = (ult.at(-1) - Math.max(ult[0], ult[1])) / Math.max(ult[0], ult[1]);
  return {
    estancado: mejora <= 0.005,
    sesiones: hist.length,
    mejoraPct: mejora * 100,
  };
}

/** Sesiones consecutivas (desde la última hacia atrás) por debajo del rango. */
function fallosSeguidos(hist, repMin) {
  let n = 0;
  for (let i = hist.length - 1; i >= 0; i--) {
    const w = pesoTrabajo(hist[i].sets);
    const trabajo = hist[i].sets.filter((s) => s.peso === w);
    if (Math.min(...trabajo.map((s) => s.reps)) < repMin) n++;
    else break;
  }
  return n;
}

/**
 * Qué hacer hoy en un ejercicio.
 * @returns {{peso:number|null, reps:number, series:number, estado:string, motivo:string, aviso?:string}}
 */
export function sugerencia(cfg, hist) {
  const inc = incrementoDe(cfg.equipment);
  const corporal = inc === 0;
  const series = cfg.series;
  const ultima = hist.at(-1);

  if (!ultima) {
    return {
      peso: null,
      reps: cfg.repMin,
      series,
      estado: 'primera',
      motivo: corporal
        ? `Primera vez. Haz las series hasta cerca del fallo y anota las reps reales.`
        : `Primera vez. Busca un peso con el que llegues a ${cfg.repMin}-${cfg.repMax} dejándote 2 reps en la recámara, y anótalo.`,
    };
  }

  const w = pesoTrabajo(ultima.sets);
  const trabajo = ultima.sets.filter((s) => s.peso === w);
  const reps = trabajo.map((s) => s.reps);
  const minReps = Math.min(...reps);
  const rirMed = mediana(trabajo.map((s) => s.rir));
  const rirDesconocido = rirMed == null;
  const todasAlTope = reps.every((r) => r >= cfg.repMax);

  if (enDeload()) {
    return {
      peso: corporal ? w : alPaso(w * 0.9, inc),
      reps: cfg.repMin,
      series: Math.max(2, series - 1),
      estado: 'deload',
      motivo: `Semana de descarga: ${corporal ? 'baja el ritmo' : `−10 % de peso`} y una serie menos. Sirve para que la siguiente semana vuelvas más fuerte, no para castigarte.`,
    };
  }

  if (enCalibracion()) {
    // Excepción: si el peso se le quedó claramente corto, no tiene sentido
    // "medir" dos semanas con un peso que no supone estímulo.
    if (todasAlTope && (rirMed ?? 0) >= 3) {
      const nuevo = corporal ? w : alPaso(w + inc, inc);
      return {
        peso: nuevo,
        reps: cfg.repMax,
        series,
        estado: 'subir',
        motivo: `Cerraste las ${reps.length} series a ${cfg.repMax} con ${rirMed} reps de sobra: ese peso no te está costando. Sube a ${kg(nuevo)} aunque estemos calibrando.`,
      };
    }
    return {
      peso: w,
      reps: Math.min(cfg.repMax, minReps + 1),
      series,
      estado: 'calibrando',
      motivo: `Calibración: repite ${kg(w)} y anota las reps reales. Estas dos semanas mido de qué eres capaz; a partir de la 3 empiezo a subirte.`,
    };
  }

  if (todasAlTope && (rirDesconocido || rirMed <= 1)) {
    if (corporal) {
      return {
        peso: w,
        reps: cfg.repMax + 2,
        series,
        estado: 'subir',
        motivo: `Cerraste todas las series a ${cfg.repMax}. Al ser peso corporal, sube subiendo reps: apunta a ${cfg.repMax + 2}, y cuando te sobre, añade lastre.`,
      };
    }
    const nuevo = alPaso(w + inc, inc);
    return {
      peso: nuevo,
      reps: cfg.repMin,
      series,
      estado: 'subir',
      motivo: `Cerraste las ${reps.length} series a ${cfg.repMax} reps. Toca subir: ${kg(w)} → ${kg(nuevo)} y vuelves al fondo del rango (${cfg.repMin} reps).`,
    };
  }

  if (minReps >= cfg.repMin) {
    const objetivo = Math.min(cfg.repMax, minReps + 1);
    return {
      peso: w,
      reps: objetivo,
      series,
      estado: 'mantener',
      motivo: `Mismo peso, ${kg(w)}. La última te quedaste en ${minReps} reps en la peor serie: hoy busca ${objetivo} en todas. Cuando cierres las ${series} a ${cfg.repMax}, te subo el peso.`,
    };
  }

  const fallos = fallosSeguidos(hist, cfg.repMin);
  if (fallos >= 2 && !corporal) {
    const nuevo = alPaso(w * 0.9, inc);
    return {
      peso: nuevo,
      reps: cfg.repMin,
      series,
      estado: 'bajar',
      motivo: `Llevas ${fallos} sesiones sin llegar a ${cfg.repMin} reps con ${kg(w)}. Bajamos a ${kg(nuevo)} para volver a progresar desde un sitio sólido; no es retroceder, es coger carrerilla.`,
    };
  }

  return {
    peso: w,
    reps: cfg.repMin,
    series,
    estado: 'mantener',
    motivo: `Te quedaste en ${minReps} reps, por debajo del rango. Repite ${kg(w)} e intenta llegar a ${cfg.repMin} en todas las series antes de subir.`,
  };
}

/**
 * Aviso extra cuando el ejercicio lleva tiempo plano.
 *
 * Solo tiene sentido cuando la sugerencia es mantener: si ya le estoy subiendo
 * el peso o bajándoselo, el estancamiento ya tiene respuesta y avisar además
 * de él sería contradictorio.
 */
export function avisoEstancamiento(cfg, hist, estado = 'mantener') {
  if (estado !== 'mantener') return null;
  if (enCalibracion() || hist.length < 3) return null;
  const d = diagnostico(hist);
  if (!d.estancado) return null;
  return {
    tipo: 'estancado',
    texto: `${cfg.nombre}: tres sesiones sin mover el 1RM estimado (${num(hist.at(-1).e1rm)} kg). O haces una semana de descarga, o cambias el ejercicio por otro que trabaje lo mismo.`,
  };
}

/** 1RM estimado actual y máximo histórico de un ejercicio. */
export function marcas(hist) {
  if (!hist.length) return null;
  const mejorE1 = hist.reduce((a, b) => (a.e1rm >= b.e1rm ? a : b));
  const mejorPeso = hist.reduce((a, b) => (a.mejor.peso >= b.mejor.peso ? a : b));
  return {
    e1rm: hist.at(-1).e1rm,
    e1rmMax: mejorE1.e1rm,
    e1rmMaxFecha: mejorE1.fecha,
    pesoMax: mejorPeso.mejor.peso,
    progresoPct: hist.length > 1 ? ((hist.at(-1).e1rm - hist[0].e1rm) / hist[0].e1rm) * 100 : 0,
  };
}
