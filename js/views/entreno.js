/**
 * Runtime de la sesión: el peso ya viene puesto, tú confirmas lo que has hecho
 * y el descanso arranca solo.
 */
import {
  S, guardar, uid, rutinaActiva, siguienteDia, historial, e1rm, enCalibracion,
  registrarPeso, pesoActual, MAX_SERIES,
} from '../store.js';
import {
  acts, esc, toast, sheet, confirmar, num, kg, mmss, duracion, hoyISO, diasEntre, $,
} from '../lib/ui.js';
import { sugerencia, avisoEstancamiento, incrementoDe, marcas } from '../engine/progression.js';
import { cargar as cargarCatalogo, ejercicio, gifDe, alternativas, buscar } from '../data/catalog.js';
import { tTarget, tEquipo, equiposDisponibles } from '../data/i18n.js';
import { cambiarEjercicio } from '../engine/generator.js';
import * as timer from '../engine/timer.js';

let ctx = null;
let desuscribir = null;

export function salir() {
  desuscribir?.();
  desuscribir = null;
  timer.mantenerPantalla(false);
}

export async function render(c) {
  ctx = c;
  await cargarCatalogo();

  if (!S.sesionActiva) {
    if (c.params && c.params[0] === 'hoy') {
      const rutina = rutinaActiva();
      const sugerido = siguienteDia(rutina);
      if (rutina && sugerido) {
        ctx.view.innerHTML = `
          <div class="card accent glow mt-lg" style="text-align: center; padding: 40px 20px;">
            <div class="eyebrow">Preparando tu sesión</div>
            <h2 class="page-title" style="margin-bottom: 8px;">${esc(sugerido.nombre)}</h2>
            <p class="muted small mb0">Elige el modo de entrenamiento para empezar.</p>
          </div>
        `;
        confirmarModoEntreno(rutina, sugerido);
        return;
      }
    }
    return pintarInicio();
  }

  pintarSesion();
  timer.mantenerPantalla(true);
  desuscribir?.();
  desuscribir = timer.alTic(actualizarTemporizador);
}

/* ==========================================================================
   Antes de empezar: elegir el día
   ========================================================================== */

/**
 * El apartado «+»: el menú de qué hacer hoy. Lo que toca según la rutina,
 * entrenar otro día distinto, o cualquier otra cosa que quieras apuntar.
 */
function pintarInicio() {
  const rutina = rutinaActiva();
  if (!rutina?.dias?.length) {
    ctx.view.innerHTML = `
      <div class="empty">
        <h3>No hay ninguna rutina activa</h3>
        <p class="small">Crea una rutina y vuelve. Sin plan no hay progresión.</p>
        <button class="btn primary mt" data-act="rutinas">Ir a rutinas</button>
      </div>`;
    return acts(ctx.view, { rutinas: () => ctx.ir('/rutinas') });
  }

  // Aquí nunca hay sesión a medias: si la hubiera, render() ya habría entrado
  // directo al entreno sin pasar por este menú.
  const sugerido = siguienteDia(rutina);
  const otros = rutina.dias.filter((d) => d.id !== sugerido?.id);
  const ultimaDelDia = S.sesiones.filter((s) => s.diaId === sugerido?.id).at(-1);
  const desde = ultimaDelDia ? diasEntre(ultimaDelDia.fecha, hoyISO()) : null;

  ctx.view.innerHTML = `
    <h2 class="page-title">¿Qué haces hoy?</h2>
    <p class="page-sub">${esc(rutina.nombre)}</p>

    <div class="card accent glow">
      <div class="eyebrow">Te toca</div>
      <h3 style="font-size:1.5rem;color:var(--accent)">${esc(sugerido.nombre)}</h3>
      <p class="muted tiny" style="margin:6px 0 14px">
        ${sugerido.ejercicios.length} ejercicios${desde != null ? ` · última vez hace ${desde} día${desde === 1 ? '' : 's'}` : ' · primera vez'}
      </p>
      <button class="btn primary block lg" data-act="empezar" data-id="${sugerido.id}">Empezar entreno</button>
    </div>

    ${otros.length ? `
      <div class="card">
        <div class="card-head"><h3>Entrenar otro día</h3></div>
        <p class="muted tiny" style="margin-top:-6px">Si hoy te apetece otra cosa, elige el día que quieras. La progresión se lleva por día, así que no se descuadra nada.</p>
        <div class="stack" style="gap:8px">
          ${otros.map((d) => {
    const ult = S.sesiones.filter((s) => s.diaId === d.id).at(-1);
    return `
            <button class="list-item" data-act="empezar" data-id="${d.id}" style="margin:0">
              <div class="body">
                <b>${esc(d.nombre)}</b>
                <small>${d.ejercicios.length} ejercicios${ult ? ` · hace ${diasEntre(ult.fecha, hoyISO())} días` : ' · nunca'}</small>
              </div>
            </button>`;
  }).join('')}
        </div>
      </div>` : ''}

    <div class="card">
      <div class="card-head"><h3>Otra cosa</h3></div>
      <div class="stack" style="gap:8px">
        <button class="list-item" data-act="peso" style="margin:0">
          <div class="body"><b>Anotar mi peso corporal</b><small>${pesoActual() ? `Ahora mismo: ${kg(pesoActual())}` : 'Aún no te has pesado'}</small></div>
        </button>
        <button class="list-item" data-act="comida" style="margin:0">
          <div class="body"><b>Comida de hoy</b><small>Macros del día y plan de comidas</small></div>
        </button>
        <button class="list-item" data-act="rutinas" style="margin:0">
          <div class="body"><b>Mis rutinas</b><small>Cambiar ejercicios, series o repeticiones</small></div>
        </button>
      </div>
    </div>`;

  acts(ctx.view, {
    rutinas: () => ctx.ir('/rutinas'),
    comida: () => ctx.ir('/comida'),
    peso: () => hojaPeso(),
    empezar: (n) => confirmarModoEntreno(rutina, rutina.dias.find((d) => d.id === n.dataset.id)),
  });
}

/** Apunte rápido del peso corporal desde el menú. */
function hojaPeso() {
  const actual = pesoActual();
  const h = sheet({
    title: 'Peso corporal',
    body: `
      <p class="muted small">Pésate siempre igual, en ayunas. Lo que miro es la tendencia de varias semanas, no el número de hoy.</p>
      <div class="row mt">
        <input class="input num grow" id="peso-rapido" type="number" inputmode="decimal" step="0.1"
               value="${actual ?? ''}" placeholder="${actual ?? 75}" style="min-height:56px;font-size:1.3rem;text-align:center">
        <button class="btn primary" id="peso-ok">Guardar</button>
      </div>`,
  });
  h.el.querySelector('#peso-ok').onclick = () => {
    const v = Number(h.el.querySelector('#peso-rapido').value);
    if (!v || v < 25 || v > 300) return toast('Ese peso no cuadra', 'bad');
    registrarPeso(v);
    h.close();
    toast('Peso guardado', 'ok');
    pintarInicio();
  };
}

/**
 * Selector de modo. Sale siempre antes de empezar: anotar pesos o solo entrenar.
 * Si se cierra sin elegir, vuelve al menú en vez de dejarte en una pantalla
 * muerta esperando una sesión que nunca arrancó.
 */
function confirmarModoEntreno(rutina, dia) {
  if (!dia) return;
  let elegido = false;

  const s = sheet({
    title: 'Modo de entrenamiento',
    body: `
      <p class="muted small mb0">Anotar tus pesos mejorará tus resultados, pero si no lo haces, de igual forma mejorarás por el simple hecho de entrenar.</p>
      <div class="stack mt">
        <button class="list-item" id="modo-detallado" style="border-color:var(--accent)">
          <div class="body">
            <b>Anotar pesos (Recomendado)</b>
            <small>Control total de series, reps y peso para asegurar progreso.</small>
          </div>
        </button>
        <button class="list-item" id="modo-simple">
          <div class="body">
            <b>Solo entrenar (Modo simple)</b>
            <small>Te digo qué hacer y cuánto descansar. Cero estrés.</small>
          </div>
        </button>
      </div>`,
    onClose: () => {
      if (elegido || S.sesionActiva) return;
      if (location.hash.startsWith('#/entreno/hoy')) ctx.ir('/entreno');
      else pintarInicio();
    },
  });

  const arrancar = (modo) => {
    elegido = true;
    s.close();
    empezarSesion(rutina, dia, modo);
  };
  s.el.querySelector('#modo-detallado').onclick = () => arrancar('detallado');
  s.el.querySelector('#modo-simple').onclick = () => arrancar('simple');
}

function empezarSesion(rutina, dia, modo) {
  if (!dia) return;
  S.sesionActiva = {
    id: uid(),
    fecha: hoyISO(),
    inicio: Date.now(),
    rutinaId: rutina.id,
    diaId: dia.id,
    nombre: dia.nombre,
    modo: modo || 'detallado',
    idx: 0,
    ejercicios: dia.ejercicios.map((e) => ({
      ...e,
      sug: sugerencia(e, historial(e.exId)),
      sets: [],
      nota: '',
    })),
  };
  if (!S.coach.inicio) S.coach.inicio = hoyISO();
  guardar();
  timer.prepararAudio();
  render(ctx);
}

/**
 * Explicación que aparece solo la primera vez que usas una pantalla. Los
 * botones dicen lo que hacen, pero la primera vez conviene contar el flujo
 * entero: qué se espera de ti y en qué orden.
 */
function tarjetaPrimeraVez(clave, titulo, cuerpoHTML) {
  if (S.ajustes.vistos?.[clave]) return '';
  return `
    <div class="card" style="border-left:3px solid var(--accent)">
      <div class="eyebrow">${esc(titulo)}</div>
      <div class="small muted">${cuerpoHTML}</div>
      <button class="btn sm ghost mt" data-act="ocultarAviso" data-clave="${clave}">Entendido</button>
    </div>`;
}

/* ==========================================================================
   Modo Simple (Perezoso)
   ========================================================================== */

function pintarSesionSimple() {
  const s = S.sesionActiva;
  const ej = s.ejercicios[s.idx];
  const ex = ejercicio(ej.exId);
  const hechas = s.idx;
  const total = s.ejercicios.length;

  ctx.view.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:center">
      <div>
        <div class="eyebrow">${esc(s.nombre)} · Modo Simple</div>
        <p class="tiny faint mb0">Ejercicio ${s.idx + 1} de ${total}</p>
      </div>
      <button class="btn sm quiet" data-act="terminarSimple">Terminar</button>
    </div>
    <div class="bar mt" style="margin-bottom:16px"><i style="width:${total ? (hechas / total) * 100 : 0}%"></i></div>

    ${tarjetaPrimeraVez('lite', 'Cómo va esto', `
      Te voy pasando los ejercicios de uno en uno. En cada uno haz las series que te digo y,
      entre serie y serie, dale a <b>Empezar descanso</b>: te aviso con un pitido cuando toque la siguiente.<br><br>
      <b>Cómo se hace</b> te enseña el movimiento paso a paso.
      <b>Cambiar ejercicio</b> te busca otro que trabaje el mismo músculo, por si la máquina está ocupada.<br><br>
      Cuando acabes las series, <b>Siguiente ejercicio</b>.`)}

    <div class="card accent" style="text-align: center; padding: 24px 16px;">
      <img src="${gifDe(ex)}" alt="" style="width: 160px; height: 160px; object-fit: cover; border-radius: 16px; margin: 0 auto 16px; display: block; border: 1px solid var(--line);" loading="lazy" onerror="this.style.display='none'">
      <h3 style="text-transform:capitalize;font-size:1.4rem; margin-bottom: 8px;">${esc(ej.nombre)}</h3>
      <p class="small faint" style="margin-bottom: 18px;">
        ${esc(tTarget(ej.target))} · ${esc(tEquipo(ej.equipment))}
      </p>
      <div class="row wrap" style="justify-content: center; gap:8px">
        <button class="btn sm quiet" data-act="comoSeHace">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>
          Cómo se hace
        </button>
        <button class="btn sm quiet" data-act="cambiar">
          <svg viewBox="0 0 24 24"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>
          Cambiar ejercicio
        </button>
      </div>
    </div>

    <div class="card glow" style="text-align:center; padding: 26px 16px;">
      <h2 style="font-size: 2.2rem; color: var(--text); margin-bottom: 8px;">${ej.series} series</h2>
      <p class="muted mb0">de ${ej.repMin} a ${ej.repMax} repeticiones</p>
      <p class="tiny faint" style="margin-top:10px">Haz una serie y dale al botón para cronometrar el descanso antes de la siguiente.</p>

      <button class="btn primary block lg mt" data-act="iniciarDescansoSimple">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Empezar descanso · ${mmss(ej.descanso)}
      </button>
    </div>

    <div class="row mt">
      <button class="btn quiet grow" data-act="anterior" ${s.idx === 0 ? 'disabled' : ''}>Anterior</button>
      <button class="btn ${s.idx === s.ejercicios.length - 1 ? 'primary' : 'ghost'} grow" data-act="siguienteSimple">
        ${s.idx === s.ejercicios.length - 1 ? 'Finalizar entreno' : 'Siguiente ejercicio'}
      </button>
    </div>

    <div id="timer-slot"></div>`;

  acts(ctx.view, MANEJADORES);
  actualizarTemporizador(timer.restante());
  
  timer.mantenerPantalla(true);
  desuscribir?.();
  desuscribir = timer.alTic(actualizarTemporizador);
}

function pintarResumenSimple() {
  const s = S.sesionActiva;
  // Solo los ejercicios a los que llegaste: si lo dejaste a medias, no se
  // apunta trabajo que no hiciste.
  const hechos = s.ejercicios.slice(0, s.idx + 1);

  ctx.view.innerHTML = `
    <h2 class="page-title">Buen trabajo</h2>
    <p class="page-sub">Si te acuerdas, dime por encima con cuánto peso fuiste. No hace falta que sea exacto y puedes dejar en blanco lo que quieras: la sesión cuenta igual.</p>

    <div class="stack mt-lg">
      ${hechos.map((ej, i) => `
        <div class="card" style="padding: 12px; margin-bottom: 0;">
          <div class="row" style="align-items:center; gap: 12px;">
            <img src="${gifDe(ejercicio(ej.exId))}" style="width:48px;height:48px;border-radius:8px;" onerror="this.style.display='none'">
            <div class="grow">
              <b style="font-size:0.9rem">${esc(ej.nombre)}</b>
              <div class="row" style="align-items:center; gap: 8px; margin-top:6px;">
                <input class="input num peso-max" data-idx="${i}" type="number" inputmode="decimal" step="0.5"
                       placeholder="${esCorporal(ej) ? 'Sin peso extra' : 'Aprox. (opcional)'}"
                       style="min-height:40px; padding: 6px 10px; font-size:1rem;">
                <span class="muted small">kg</span>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <button class="btn primary block lg mt-lg" data-act="guardarSimple">Guardar y terminar</button>
    <p class="tiny faint center">Lo que dejes en blanco cuenta como entrenado, pero no lo uso para subirte pesos. Para eso está el modo con pesos.</p>
    <div style="height:32px"></div>
  `;

  acts(ctx.view, MANEJADORES);
}

/** Ejercicios sin carga externa: ahí el 0 kg es el dato correcto. */
const esCorporal = (ej) => incrementoDe(ej.equipment) === 0;


/* ==========================================================================
   Sesión en curso (Modo Detallado)
   ========================================================================== */

function pintarSesion() {
  const s = S.sesionActiva;
  if (!s) return;
  if (s.paso === 'resumen-simple') return pintarResumenSimple();
  if (s.modo === 'simple') return pintarSesionSimple();
  
  pintarSesionDetallada();
}

function pintarSesionDetallada() {
  const s = S.sesionActiva;
  const ej = s.ejercicios[s.idx];
  const ex = ejercicio(ej.exId);
  const hist = historial(ej.exId);
  const aviso = avisoEstancamiento(ej, hist, ej.sug.estado);
  const hechas = s.ejercicios.reduce((t, e) => t + e.sets.filter((x) => x.reps > 0).length, 0);
  const total = s.ejercicios.reduce((t, e) => t + Math.max(e.series, e.sets.length), 0);

  ctx.view.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:center">
      <div>
        <div class="eyebrow">${esc(s.nombre)}</div>
        <p class="tiny faint mb0">Ejercicio ${s.idx + 1} de ${s.ejercicios.length} · ${hechas}/${total} series</p>
      </div>
      <button class="btn sm quiet" data-act="terminar">Terminar</button>
    </div>
    <div class="bar mt" style="margin-bottom:16px"><i style="width:${total ? (hechas / total) * 100 : 0}%"></i></div>

    ${tarjetaPrimeraVez('pro', 'Cómo va esto', `
      El peso ya viene puesto: es el que te toca hoy según lo que levantaste la última vez.
      Haz la serie, corrige el peso o las reps si no salió eso exacto, y dale a <b>Serie hecha</b>.
      El descanso arranca solo.<br><br>
      <b>Reps que te quedaban</b> es cuántas más habrías podido hacer. Es lo que me dice si te sobra
      peso o te falta, así que merece la pena marcarlo.<br><br>
      Puedes tocar cualquier serie ya guardada para corregirla.`)}

    <div class="card accent">
      <div class="row" style="gap:13px;align-items:flex-start">
        <img class="thumb" style="width:74px;height:74px;flex:none" alt=""
             src="${gifDe(ex)}" loading="lazy"
             onerror="this.style.visibility='hidden'">
        <div style="min-width:0;flex:1">
          <h3 style="text-transform:capitalize;font-size:1.05rem">${esc(ej.nombre)}</h3>
          <p class="tiny faint" style="margin:4px 0 8px">
            ${esc(tTarget(ej.target))} · ${esc(tEquipo(ej.equipment))} · objetivo ${ej.repMin}-${ej.repMax} reps
          </p>
          <div class="row wrap" style="gap:6px">
            <button class="btn sm quiet" data-act="comoSeHace">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>
              Cómo se hace
            </button>
            <button class="btn sm quiet" data-act="cambiar">
              <svg viewBox="0 0 24 24"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>
              Cambiar ejercicio
            </button>
          </div>
        </div>
      </div>

      <div class="divider"></div>
      <div class="eyebrow">Qué toca hoy</div>
      <p class="small mb0">${esc(ej.sug.motivo)}</p>
      ${aviso ? `<p class="small" style="color:var(--bad);margin-top:8px">${esc(aviso.texto)}</p>` : ''}
      ${hist.length ? `<p class="tiny faint" style="margin-top:8px">Última vez (${hist.at(-1).fecha}): ${hist.at(-1).sets.map((x) => `${num(x.peso)}×${x.reps}`).join(' · ')}</p>` : ''}
    </div>

    ${filasDeSeries(ej)}

    <div class="row mt">
      <button class="btn quiet grow" data-act="anterior" ${s.idx === 0 ? 'disabled' : ''}>Anterior</button>
      <button class="btn ${todasHechas(ej) ? 'primary' : 'ghost'} grow" data-act="siguiente"
              ${s.idx === s.ejercicios.length - 1 ? 'disabled' : ''}>Siguiente</button>
    </div>
    ${ej.series < MAX_SERIES && ej.sets.length < MAX_SERIES
    ? '<button class="btn quiet block mt" data-act="anadirSerie">Añadir una serie más</button>' : ''}

    <div id="timer-slot"></div>`;

  acts(ctx.view, MANEJADORES);
  actualizarTemporizador(timer.restante());
}

const todasHechas = (ej) => ej.sets.filter((x) => x.reps > 0).length >= ej.series;

/** Filas de series: hechas arriba, la siguiente con los campos listos. */
function filasDeSeries(ej) {
  const inc = incrementoDe(ej.equipment);
  const n = Math.min(MAX_SERIES, Math.max(ej.series, ej.sets.length + 1));
  const filas = [];

  for (let i = 0; i < n; i++) {
    const hecha = ej.sets[i];
    if (hecha) {
      filas.push(`
        <button class="list-item" data-act="editarSerie" data-i="${i}" style="padding:10px 12px">
          <span class="tag accent" style="flex:none">${i + 1}</span>
          <div class="body">
            <b class="mono">${num(hecha.peso)} kg × ${hecha.reps}</b>
            <small>${hecha.rir != null ? `(${hecha.rir} reps de sobra)` : 'sin esfuerzo marcado'} · 1RM est. ${num(e1rm(hecha.peso, hecha.reps, hecha.rir))} kg</small>
          </div>
          <span class="tiny faint">editar</span>
        </button>`);
      continue;
    }
    if (i === ej.sets.length) {
      filas.push(filaActiva(ej, i, inc));
      continue;
    }
    // Las series aún por hacer heredan el peso de la última que sí registró.
    const previsto = ej.sets.at(-1)?.peso ?? ej.sug.peso;
    filas.push(`
      <div class="list-item" style="padding:10px 12px;opacity:.4">
        <span class="tag" style="flex:none">${i + 1}</span>
        <div class="body"><b class="mono">${previsto != null ? `${num(previsto)} kg × ${ej.sug.reps}` : `— × ${ej.sug.reps}`}</b></div>
      </div>`);
  }
  const tope = ej.sets.length >= MAX_SERIES
    ? `<p class="tiny faint center" style="margin:4px 0 0">Máximo ${MAX_SERIES} series por ejercicio. Pasa al siguiente.</p>`
    : '';
  return `<div class="stack" style="gap:8px;margin-top:16px">${filas.join('')}</div>${tope}`;
}

function filaActiva(ej, i, inc) {
  const previa = ej.sets[i - 1];
  const peso = previa?.peso ?? ej.sug.peso ?? '';
  const reps = ej.sug.reps ?? ej.repMin;
  const rir = 2;
  return `
    <div class="card accent glow" style="margin:0;padding:14px">
      <div class="row" style="justify-content:space-between;align-items:center;margin-bottom:12px">
        <span class="eyebrow mb0">Serie ${i + 1}</span>
        <span class="tiny faint">${ej.repMin}-${ej.repMax} reps</span>
      </div>

      <div class="row" style="gap:10px">
        <div style="flex:1">
          <label class="tiny faint">Peso (kg)</label>
          <div class="row" style="gap:6px;margin-top:4px">
            <button class="icon-btn" data-act="pesoMenos" data-inc="${inc || 1}">−</button>
            <input class="input num grow center" id="in-peso" type="number" inputmode="decimal" step="0.5"
                   value="${peso}" placeholder="—" style="min-height:52px;font-size:1.2rem">
            <button class="icon-btn" data-act="pesoMas" data-inc="${inc || 1}">+</button>
          </div>
        </div>
        <div style="flex:1">
          <label class="tiny faint">Reps</label>
          <div class="row" style="gap:6px;margin-top:4px">
            <button class="icon-btn" data-act="repsMenos">−</button>
            <input class="input num grow center" id="in-reps" type="number" inputmode="numeric"
                   value="${reps}" style="min-height:52px;font-size:1.2rem">
            <button class="icon-btn" data-act="repsMas">+</button>
          </div>
        </div>
      </div>

      <div style="margin-top:12px">
        <label class="tiny faint">Reps que te quedaban (de sobra)</label>
        <div class="chips" style="margin-top:6px" id="rir-chips">
          ${[0, 1, 2, 3, 4].map((v) => `
            <button class="chip ${v === rir ? 'on' : ''}" data-act="rir" data-v="${v}">${v === 4 ? '4+' : v}</button>`).join('')}
        </div>
      </div>

      <button class="btn primary block lg mt" data-act="guardarSerie">Serie hecha</button>
    </div>`;
}

/* ---------- Acciones ---------- */

let rirElegido = 2;

const MANEJADORES = {
  pesoMenos: (n) => ajustar('#in-peso', -Number(n.dataset.inc || 1)),
  pesoMas: (n) => ajustar('#in-peso', Number(n.dataset.inc || 1)),
  repsMenos: () => ajustar('#in-reps', -1),
  repsMas: () => ajustar('#in-reps', 1),

  rir: (n) => {
    rirElegido = Number(n.dataset.v);
    n.parentElement.querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', c === n));
  },

  guardarSerie: () => {
    const s = S.sesionActiva;
    const ej = s.ejercicios[s.idx];
    if (ej.sets.length >= MAX_SERIES) {
      return toast(`Máximo ${MAX_SERIES} series por ejercicio`, 'bad');
    }
    const peso = Number($('#in-peso').value);
    const reps = Number($('#in-reps').value);
    if (!reps || reps < 1) return toast('¿Cuántas reps has hecho?', 'bad');
    if (Number.isNaN(peso)) return toast('Falta el peso', 'bad');
    // Un 0 en un ejercicio con carga no es un dato: sin peso real no puedo
    // calcular nada. Si no te apetece anotarlo, el sitio es el modo simple.
    if (peso <= 0 && !esCorporal(ej)) return toast('Pon el peso que has movido', 'bad');

    // El récord se compara contra el historial cerrado, antes de apuntar la serie.
    const previo = marcas(historial(ej.exId));
    const nuevo = e1rm(peso, reps, rirElegido);

    ej.sets.push({ peso, reps, rir: rirElegido, ts: Date.now() });
    rirElegido = 2;
    guardar();

    if (previo && nuevo > previo.e1rmMax) toast(`¡Récord en ${ej.nombre}!`, 'ok');

    // El aviso solo salta al cerrar la última serie prevista, no en cada extra.
    if (ej.sets.length === ej.series && s.idx < s.ejercicios.length - 1) {
      toast('Ejercicio completado', 'ok');
    } else if (ej.sets.length < MAX_SERIES) {
      timer.arrancar(ej.descanso);
    }
    pintarSesion();
  },

  ocultarAviso: (n) => {
    S.ajustes.vistos = { ...(S.ajustes.vistos || {}), [n.dataset.clave]: true };
    guardar();
    pintarSesion();
  },

  editarSerie: (n) => editarSerie(Number(n.dataset.i)),

  anadirSerie: () => {
    const s = S.sesionActiva;
    const ej = s.ejercicios[s.idx];
    if (ej.series >= MAX_SERIES) return toast(`Máximo ${MAX_SERIES} series por ejercicio`, 'bad');
    ej.series += 1;
    guardar();
    pintarSesion();
  },

  anterior: () => { S.sesionActiva.idx--; guardar(); pintarSesion(); },
  siguiente: () => { S.sesionActiva.idx++; guardar(); pintarSesion(); },

  comoSeHace: () => verInstrucciones(),
  cambiar: () => cambiarEjercicioSheet(),

  saltarDescanso: () => { timer.parar(); pintarSesion(); },
  masTiempo: () => timer.sumar(30),
  menosTiempo: () => timer.sumar(-15),

  terminar: () => terminarSesion(),

  iniciarDescansoSimple: () => {
    const ej = S.sesionActiva.ejercicios[S.sesionActiva.idx];
    timer.arrancar(ej.descanso);
    pintarSesionSimple();
  },

  siguienteSimple: () => {
    timer.parar();
    if (S.sesionActiva.idx === S.sesionActiva.ejercicios.length - 1) {
      S.sesionActiva.paso = 'resumen-simple';
      guardar();
      pintarResumenSimple();
    } else {
      S.sesionActiva.idx++;
      guardar();
      pintarSesionSimple();
    }
  },

  terminarSimple: () => {
    S.sesionActiva.paso = 'resumen-simple';
    guardar();
    pintarResumenSimple();
  },

  guardarSimple: () => {
    const s = S.sesionActiva;
    const inputs = Array.from(ctx.view.querySelectorAll('.peso-max'));

    inputs.forEach((input) => {
      const ej = s.ejercicios[Number(input.dataset.idx)];
      const escrito = input.value.trim();
      const peso = escrito === '' ? null : Number(escrito);

      // En blanco entra como null, no como 0: la serie cuenta para el volumen
      // de la semana pero queda fuera del cálculo de progresión, que es lo
      // honesto cuando no sabemos con cuánto peso se hizo.
      const pesoFinal = escrito === '' ? (esCorporal(ej) ? 0 : null)
        : (Number.isNaN(peso) ? null : peso);

      for (let i = 0; i < ej.series; i++) {
        ej.sets.push({
          peso: pesoFinal,
          reps: ej.repMax || 10,
          rir: null,            // en modo lite nadie mide el esfuerzo real
          estimado: true,       // marca de que es una aproximación, no un registro
          ts: Date.now(),
        });
      }
    });

    // El resumen del modo simple ya es la confirmación: no preguntamos otra vez.
    terminarSesion({ pedirConfirmacion: false });
  },
};

function ajustar(sel, delta) {
  const el = $(sel);
  if (!el) return;
  const v = Number(el.value || 0) + delta;
  el.value = Math.max(0, Math.round(v * 100) / 100);
}

function editarSerie(i) {
  const ej = S.sesionActiva.ejercicios[S.sesionActiva.idx];
  const set = ej.sets[i];
  if (!set) return;
  const s = sheet({
    title: `Serie ${i + 1}`,
    body: `
      <div class="row">
        <div class="field grow"><label>Peso</label>
          <input class="input num" id="ed-peso" type="number" inputmode="decimal" step="0.5" value="${set.peso}"></div>
        <div class="field grow"><label>Reps</label>
          <input class="input num" id="ed-reps" type="number" inputmode="numeric" value="${set.reps}"></div>
      </div>
      <div class="field">
        <label>Reps de sobra</label>
        <div class="chips" id="ed-rir">
          ${[0, 1, 2, 3, 4].map((v) => `<button class="chip ${v === set.rir ? 'on' : ''}" data-v="${v}">${v === 4 ? '4+' : v}</button>`).join('')}
        </div>
      </div>
      <button class="btn primary block" id="ed-ok">Guardar</button>
      <button class="btn danger block mt" id="ed-del">Borrar serie</button>`,
  });
  let rir = set.rir;
  s.el.querySelector('#ed-rir').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    rir = Number(b.dataset.v);
    s.el.querySelectorAll('#ed-rir .chip').forEach((c) => c.classList.toggle('on', c === b));
  });
  s.el.querySelector('#ed-ok').onclick = () => {
    const peso = Number(s.el.querySelector('#ed-peso').value);
    const reps = Number(s.el.querySelector('#ed-reps').value);
    if (!reps || reps < 1) return toast('¿Cuántas reps has hecho?', 'bad');
    if (peso <= 0 && !esCorporal(ej)) return toast('Pon el peso que has movido', 'bad');
    set.peso = peso;
    set.reps = reps;
    set.rir = rir;
    delete set.estimado;   // al editarla a mano deja de ser una aproximación
    guardar();
    s.close();
    pintarSesion();
  };
  s.el.querySelector('#ed-del').onclick = () => {
    ej.sets.splice(i, 1);
    guardar();
    s.close();
    pintarSesion();
  };
}

function verInstrucciones() {
  const ej = S.sesionActiva.ejercicios[S.sesionActiva.idx];
  const ex = ejercicio(ej.exId);
  if (!ex) return;
  sheet({
    title: ex.name,
    body: `
      <img src="${gifDe(ex)}" alt="" style="width:100%;max-width:260px;display:block;margin:0 auto 16px;border-radius:14px;">
      <div class="row wrap" style="gap:6px;margin-bottom:14px">
        <span class="tag accent">${esc(tTarget(ex.target))}</span>
        <span class="tag">${esc(tEquipo(ex.equipment))}</span>
        ${ex.secondary.slice(0, 3).map((m) => `<span class="tag">${esc(tTarget(m))}</span>`).join('')}
      </div>
      <ol class="stack small" style="padding-left:18px;list-style:decimal">
        ${ex.steps.map((p) => `<li style="margin-bottom:8px">${esc(p)}</li>`).join('')}
      </ol>`,
  });
}

function cambiarEjercicioSheet() {
  const s = S.sesionActiva;
  const ej = s.ejercicios[s.idx];
  const ex = ejercicio(ej.exId);
  const equipos = equiposDisponibles(S.perfil?.categorias || []);
  const alts = alternativas(ex, equipos, 10);

  const item = (o) => `
    <button class="list-item" data-id="${o.id}">
      <img class="thumb" src="${gifDe(o)}" alt="" loading="lazy" onerror="this.className='thumb ph'">
      <div class="body">
        <b class="truncate" style="text-transform:capitalize">${esc(o.name)}</b>
        <small>${esc(tTarget(o.target))} · ${esc(tEquipo(o.equipment))}</small>
      </div>
    </button>`;

  const hoja = sheet({
    title: 'Cambiar ejercicio',
    body: `
      <p class="muted small">Mismo músculo (${esc(tTarget(ex.target))}), distinto material. El historial del ejercicio nuevo empieza de cero.</p>
      <input class="input" id="bus" placeholder="O busca otro ejercicio…" style="margin-bottom:12px">
      <div id="lista" class="stack" style="gap:8px">${alts.map(item).join('')}</div>`,
  });

  hoja.el.querySelector('#bus').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    const res = q.length > 1 ? buscar({ q, equipos, limite: 20 }) : alts;
    hoja.el.querySelector('#lista').innerHTML = res.map(item).join('');
  });

  hoja.el.querySelector('#lista').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const nuevoConfig = cambiarEjercicio(ej, b.dataset.id);
    Object.assign(ej, nuevoConfig, { sug: sugerencia(nuevoConfig, historial(nuevoConfig.exId)), sets: ej.sets });
    guardar();
    hoja.close();
    pintarSesion();
    toast('Ejercicio cambiado');
  });
}

/* ---------- Temporizador ---------- */

function actualizarTemporizador(restante) {
  const slot = ctx?.view.querySelector('#timer-slot');
  if (!slot) return;
  if (!timer.activo()) { slot.innerHTML = ''; return; }
  const pct = (restante / (timer.duracionTotal() || 1)) * 100;
  slot.innerHTML = `
    <div style="position:fixed;left:0;right:0;bottom:calc(var(--tabbar-h) + var(--safe-b));z-index:60;
                background:#181818;border-top:1px solid var(--accent-line);padding:12px 16px calc(12px);
                max-width:560px;margin:0 auto">
      <div class="row" style="align-items:center;justify-content:space-between;gap:12px">
        <div>
          <div class="tiny faint">Descanso</div>
          <b class="mono" style="font-size:1.6rem;color:var(--accent)">${mmss(restante)}</b>
        </div>
        <div class="row" style="gap:6px">
          <button class="btn sm quiet" data-act="menosTiempo">−15 s</button>
          <button class="btn sm quiet" data-act="masTiempo">+30 s</button>
          <button class="btn sm ghost" data-act="saltarDescanso">Saltar</button>
        </div>
      </div>
      <div class="bar" style="margin-top:8px"><i style="width:${pct}%"></i></div>
    </div>`;
}

/* ---------- Cierre ---------- */

/**
 * @param {object} o
 * @param {boolean} o.pedirConfirmacion  el modo simple ya confirma en su
 *   pantalla de resumen, así que ahí no hace falta preguntar dos veces.
 */
async function terminarSesion({ pedirConfirmacion = true } = {}) {
  const s = S.sesionActiva;
  const series = s.ejercicios.reduce((t, e) => t + e.sets.filter((x) => x.reps > 0).length, 0);
  const nEjercicios = s.ejercicios.filter((e) => e.sets.length).length;

  if (!series) {
    if (!await confirmar('Descartar sesión', 'No has registrado nada. Se descartará la sesión.', 'Descartar')) return;
    S.sesionActiva = null;
    timer.parar();
    guardar();
    return ctx.ir('/hoy');
  }

  if (pedirConfirmacion && !await confirmar(
    'Terminar entreno',
    `Vas a guardar ${nEjercicios} ejercicio${nEjercicios === 1 ? '' : 's'}. Después ya no se puede seguir añadiendo a esta sesión.`,
    'Terminar', false)) return;

  const records = [];
  for (const e of s.ejercicios) {
    const previo = marcas(historial(e.exId));
    const mejorHoy = Math.max(0, ...e.sets.map((x) => e1rm(x.peso, x.reps, x.rir)));
    // Sin historial previo no hay récord que batir: la primera vez es la marca base.
    if (previo && mejorHoy > previo.e1rmMax) records.push({ nombre: e.nombre, e1rm: mejorHoy });
  }

  const sesion = {
    ...s,
    fin: Date.now(),
    duracion: Date.now() - s.inicio,
    ejercicios: s.ejercicios.filter((e) => e.sets.length),
  };
  delete sesion.idx;
  S.sesiones.push(sesion);
  S.sesionActiva = null;
  timer.parar();
  timer.mantenerPantalla(false);
  guardar();

  // Las series sin peso anotado suman 0 al tonelaje, no NaN.
  const tonelaje = sesion.ejercicios.reduce((t, e) => t + e.sets.reduce((u, x) => u + (x.peso || 0) * x.reps, 0), 0);
  const hechos = sesion.ejercicios.length;
  const aproximado = sesion.ejercicios.some((e) => e.sets.some((x) => x.estimado));

  sheet({
    title: 'Sesión guardada',
    body: `
      <div class="stat-grid">
        <div class="stat hi"><b>${hechos}</b><span>ejercicio${hechos === 1 ? '' : 's'}</span></div>
        <div class="stat"><b>${series}</b><span>series</span></div>
        <div class="stat"><b>${duracion(sesion.duracion)}</b><span>duración</span></div>
      </div>
      ${tonelaje > 0
    ? `<p class="tiny faint center" style="margin-top:10px">${aproximado ? '≈ ' : ''}${Math.round(tonelaje).toLocaleString('es-ES')} kg movidos${aproximado ? ', por lo que anotaste a ojo' : ''}</p>`
    : ''}
      ${records.length ? `
        <div class="card accent mt">
          <div class="eyebrow">Récords de hoy</div>
          ${records.map((r) => `<p class="small mb0" style="text-transform:capitalize">${esc(r.nombre)} · ${kg(r.e1rm)} de 1RM estimado</p>`).join('')}
        </div>` : ''}
      <p class="muted small mt">${enCalibracion()
    ? 'Sigo midiendo. Cuando cierres la semana 2 te doy el informe completo.'
    : 'Ya he actualizado tus pesos para la próxima sesión de este día.'}</p>`,
  });
  ctx.ir('/hoy');
}
