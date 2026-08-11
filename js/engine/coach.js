/**
 * El entrenador: lee el historial y saca conclusiones en castellano.
 * Cubre el informe de calibración de las dos primeras semanas y el repaso
 * semanal a partir de ahí.
 */
import {
  S, semanaPrograma, sesionesDeSemana, historial, rutinaActiva,
  ejerciciosEntrenados, tendenciaPeso, SEMANAS_CALIBRACION, enCalibracion, guardar,
} from '../store.js';

import { grupoDe, gruposSecundarios, VOLUMEN_OBJETIVO } from '../data/i18n.js';
import { ejercicio } from '../data/catalog.js';
import { diagnostico, marcas } from './progression.js';
import { num, hoyISO, diasEntre } from '../lib/ui.js';

/**
 * Series efectivas por grupo muscular en una semana del programa.
 * El músculo objetivo se lleva la serie entera; los dos secundarios más
 * relevantes, media serie cada uno — así una sentadilla cuenta también para
 * cuádriceps y no solo para glúteo, que es como está etiquetada en el dataset.
 */
export function volumenSemanal(sem) {
  const out = {};
  const sumar = (grupo, n) => { out[grupo] = (out[grupo] || 0) + n; };

  for (const s of sesionesDeSemana(sem)) {
    for (const e of s.ejercicios) {
      const hechas = (e.sets || []).filter((x) => x.reps > 0).length;
      if (!hechas) continue;
      sumar(grupoDe(e.target), hechas);
      const ex = ejercicio(e.exId);
      for (const g of gruposSecundarios(ex?.secondary, e.target)) sumar(g, hechas * 0.5);
    }
  }
  for (const k of Object.keys(out)) out[k] = Math.round(out[k] * 2) / 2;
  return out;
}

/** Tonelaje total (kg movidos) de una semana. */
export function tonelajeSemanal(sem) {
  let t = 0;
  for (const s of sesionesDeSemana(sem)) {
    for (const e of s.ejercicios) {
      for (const x of e.sets || []) t += (x.peso || 0) * (x.reps || 0);
    }
  }
  return t;
}

/** Grupos por debajo del mínimo útil, con cuántas series les faltan. */
export function gruposFlojos(vol) {
  const out = [];
  for (const [grupo, [min]] of Object.entries(VOLUMEN_OBJETIVO)) {
    const hechas = vol[grupo] || 0;
    if (hechas < min) out.push({ grupo, hechas, min, faltan: min - hechas });
  }
  return out.sort((a, b) => b.faltan - a.faltan);
}

/** Grupos pasados de vueltas. */
export function gruposPasados(vol) {
  const out = [];
  for (const [grupo, [, max]] of Object.entries(VOLUMEN_OBJETIVO)) {
    const hechas = vol[grupo] || 0;
    if (hechas > max) out.push({ grupo, hechas, max });
  }
  return out.sort((a, b) => b.hechas - a.hechas);
}

/* ==========================================================================
   Informe de calibración (al terminar la semana 2)
   ========================================================================== */

export function informeCalibracionDisponible() {
  return semanaPrograma() > SEMANAS_CALIBRACION
    && !S.coach.informes.some((i) => i.tipo === 'calibracion')
    && S.sesiones.length >= 2;
}

export function generarInformeCalibracion() {
  const ejercicios = ejerciciosEntrenados().map(({ exId, nombre }) => {
    const h = historial(exId);
    return { exId, nombre, ...marcas(h), sesiones: h.length };
  }).filter((e) => e.e1rm);

  const vol = {};
  for (let sem = 1; sem <= SEMANAS_CALIBRACION; sem++) {
    for (const [g, n] of Object.entries(volumenSemanal(sem))) vol[g] = (vol[g] || 0) + n;
  }
  // Media por semana de las dos de calibración.
  const volMedio = Object.fromEntries(Object.entries(vol).map(([g, n]) => [g, Math.round((n / SEMANAS_CALIBRACION) * 2) / 2]));

  const sesiones = S.sesiones.length;
  const rutina = rutinaActiva();
  const previstas = (rutina?.dias?.length || 0) * SEMANAS_CALIBRACION;

  const notas = [];
  notas.push(previstas && sesiones < previstas
    ? `Hiciste ${sesiones} de las ${previstas} sesiones previstas. La constancia es lo que más va a mover la aguja: apunta a no fallar ninguna.`
    : `Completaste las ${sesiones} sesiones previstas. Con esa base ya puedo subirte pesos con criterio.`);

  const flojos = gruposFlojos(volMedio).slice(0, 3);
  if (flojos.length) {
    notas.push(`Te faltan series en ${flojos.map((f) => `${f.grupo} (${num(f.hechas)}, mínimo ${f.min})`).join(', ')}. Le sumo series a esos grupos en las próximas semanas.`);
  }
  const pasados = gruposPasados(volMedio).slice(0, 2);
  if (pasados.length) {
    notas.push(`Te has pasado de volumen en ${pasados.map((p) => `${p.grupo} (${num(p.hechas)})`).join(', ')}. Más no es mejor: recuperar también entrena.`);
  }

  const sinRir = S.sesiones.some((s) => s.ejercicios.some((e) => (e.sets || []).some((x) => x.reps > 0 && x.rir == null)));
  if (sinRir) notas.push('Hay series sin marcar el esfuerzo (reps de sobra). Marcarlo es lo que me permite saber si te sobra peso o te falta.');

  const informe = {
    id: `cal-${Date.now()}`,
    tipo: 'calibracion',
    fecha: hoyISO(),
    titulo: 'Informe de calibración',
    sesiones,
    previstas,
    ejercicios: ejercicios.sort((a, b) => b.e1rm - a.e1rm),
    volumen: volMedio,
    notas,
  };
  S.coach.informes.unshift(informe);
  guardar();
  return informe;
}

/* ==========================================================================
   Repaso semanal
   ========================================================================== */

export function informeSemanal(sem = semanaPrograma() - 1) {
  if (sem < 1) return null;
  const vol = volumenSemanal(sem);
  const sesiones = sesionesDeSemana(sem);
  if (!sesiones.length) return null;

  const avisos = [];
  const rutina = rutinaActiva();
  const previstas = rutina?.dias?.length || 0;
  if (previstas && sesiones.length < previstas) {
    avisos.push({ tono: 'warn', texto: `Semana ${sem}: ${sesiones.length} de ${previstas} sesiones. Lo que no se entrena no progresa.` });
  }

  for (const f of gruposFlojos(vol).slice(0, 3)) {
    avisos.push({ tono: 'warn', texto: `${f.grupo}: ${num(f.hechas)} series, por debajo de las ${f.min} mínimas. Añade ${Math.ceil(f.faltan)} series repartidas.` });
  }
  for (const p of gruposPasados(vol).slice(0, 2)) {
    avisos.push({ tono: 'info', texto: `${p.grupo}: ${num(p.hechas)} series, por encima de las ${p.max} que puedes recuperar bien. Quita alguna.` });
  }

  const estancados = [];
  for (const { exId, nombre } of ejerciciosEntrenados()) {
    const h = historial(exId);
    if (h.length >= 3 && diagnostico(h).estancado) estancados.push({ exId, nombre, e1rm: h.at(-1).e1rm });
  }
  for (const e of estancados.slice(0, 4)) {
    avisos.push({ tono: 'bad', texto: `${e.nombre} lleva 3 sesiones plano en ${num(e.e1rm)} kg de 1RM estimado. Descarga o cámbialo.` });
  }

  const subidas = [];
  for (const { exId, nombre } of ejerciciosEntrenados()) {
    const h = historial(exId, 4);
    if (h.length >= 2 && h.at(-1).e1rm > h[0].e1rm * 1.02) {
      subidas.push({ nombre, pct: ((h.at(-1).e1rm - h[0].e1rm) / h[0].e1rm) * 100 });
    }
  }

  return {
    sem,
    sesiones: sesiones.length,
    previstas,
    volumen: vol,
    tonelaje: tonelajeSemanal(sem),
    avisos,
    subidas: subidas.sort((a, b) => b.pct - a.pct).slice(0, 4),
    estancados,
  };
}

/* ==========================================================================
   Consejo corto para la pantalla de Hoy
   ========================================================================== */

export function consejosDelDia() {
  const sem = semanaPrograma();
  const consejos = [];

  if (!S.sesiones.length) {
    consejos.push({
      tono: 'accent',
      titulo: 'Empezamos por medir',
      texto: 'Las dos primeras semanas no te voy a subir nada: necesito ver con qué pesos te mueves y cuántas reps aguantas de verdad.',
    });
  } else if (enCalibracion()) {
    const restan = (SEMANAS_CALIBRACION - sem + 1);
    consejos.push({
      tono: 'accent',
      titulo: `Calibración · semana ${Math.max(1, sem)} de ${SEMANAS_CALIBRACION}`,
      texto: `Queda${restan === 1 ? '' : 'n'} ${restan} semana${restan === 1 ? '' : 's'} de medición. Mantén los pesos y apunta las reps de sobra.`,
    });
  } else {
    consejos.push({
      tono: 'accent',
      titulo: `Semana ${sem}`,
      texto: 'Progresión normal: cierra el rango de reps en todas las series y te subo el peso a la siguiente.',
    });
  }

  // Solo tiene sentido si ya has entrenado alguna vez: a quien acaba de
  // instalar la app no se le puede decir que lleva 99 días parado.
  const ultimo = S.sesiones.at(-1);
  const diasParado = ultimo ? diasEntre(ultimo.fecha, hoyISO()) : 0;
  if (diasParado >= 7) {
    consejos.push({
      tono: 'warn',
      titulo: `${diasParado} días sin entrenar`,
      texto: 'Vuelve con el peso de la última sesión, no con el que te gustaría. Una sesión conservadora hoy vale más que una heroica que te deje agujetas tres días.',
    });
  }

  const previa = informeSemanal(sem - 1);
  if (previa?.avisos.length) {
    const a = previa.avisos[0];
    consejos.push({ tono: a.tono, titulo: `Repaso de la semana ${previa.sem}`, texto: a.texto });
  }

  const t = tendenciaPeso();
  const objetivo = S.perfil?.objetivo;
  if (t && objetivo && Math.abs(t.porSemana) < 0.1) {
    consejos.push({
      tono: 'info',
      titulo: 'Tu peso lleva plano',
      texto: objetivo === 'definir'
        ? 'Si quieres bajar y la báscula no se mueve, el problema está en la comida, no en el entreno. Mira la pestaña de Comida: te ajusto las calorías.'
        : 'Para ganar músculo la báscula tiene que subir poco a poco. Si lleva plana, sube algo las calorías.',
    });
  }

  if (previa?.subidas.length) {
    const s = previa.subidas[0];
    consejos.push({
      tono: 'ok',
      titulo: 'Vas subiendo',
      texto: `${s.nombre} ha subido un ${num(s.pct)} % en las últimas sesiones. Sigue con la misma progresión, funciona.`,
    });
  }

  // Rellenar con consejos generales si hay pocos
  if (consejos.length < 3) {
    consejos.push({
      tono: 'accent',
      titulo: 'Recuerda el descanso',
      texto: 'El músculo crece mientras descansas, no mientras entrenas. Asegúrate de dormir 7-8 horas.'
    });
    consejos.push({
      tono: 'accent',
      titulo: 'La constancia es la clave',
      texto: 'Más vale un entrenamiento regular al 80% que uno perfecto al 100% pero que dejas a las dos semanas.'
    });
  }

  return consejos;
}
