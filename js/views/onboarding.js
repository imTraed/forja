/* Alta inicial: cuatro pasos y sales con perfil y rutina generada. */
import { S, guardar, registrarPeso, guardarRutina } from '../store.js';
import { acts, esc, toast } from '../lib/ui.js';
import { CATEGORIAS_EQUIPO } from '../data/i18n.js';
import { FACTOR_ACTIVIDAD, OBJETIVOS } from '../engine/nutrition.js';
import { cargar as cargarCatalogo } from '../data/catalog.js';
import { generarRutina } from '../engine/generator.js';
import { PLANTILLAS } from '../data/splits.js';

let paso = 0;
const datos = {
  nombre: '',
  sexo: 'hombre',
  edad: 25,
  altura: 175,
  peso: 75,
  actividad: 'moderado',
  objetivo: 'volumen',
  dias: 3,
  categorias: ['barra', 'mancuernas', 'maquinas', 'corporal'],
};

const PASOS = [bienvenida, cuerpo, meta, material];

export async function render(ctx) {
  ctx.view.innerHTML = `
    <div class="onb">
      <div class="bar mt" style="margin-bottom:22px"><i style="width:${((paso + 1) / PASOS.length) * 100}%"></i></div>
      ${PASOS[paso]()}
    </div>`;

  acts(ctx.view, {
    siguiente: () => { leerCampos(ctx.view); paso = Math.min(PASOS.length - 1, paso + 1); render(ctx); },
    atras: () => { leerCampos(ctx.view); paso = Math.max(0, paso - 1); render(ctx); },
    opcion: (n) => {
      const { campo, valor } = n.dataset;
      datos[campo] = Number.isNaN(Number(valor)) || campo === 'sexo' || campo === 'actividad' || campo === 'objetivo'
        ? valor : Number(valor);
      render(ctx);
    },
    material: (n) => {
      const id = n.dataset.id;
      datos.categorias = datos.categorias.includes(id)
        ? datos.categorias.filter((c) => c !== id)
        : [...datos.categorias, id];
      render(ctx);
    },
    terminar: async (n) => {
      leerCampos(ctx.view);
      if (!datos.categorias.length) return toast('Elige al menos un tipo de material', 'bad');
      n.disabled = true;
      n.textContent = 'Montando tu rutina…';
      try {
        await cargarCatalogo();
        const rutina = generarRutina({ dias: datos.dias, categorias: datos.categorias });
        S.perfil = { ...datos, creado: new Date().toISOString() };
        guardarRutina(rutina);
        S.rutinaActiva = rutina.id;
        registrarPeso(datos.peso);
        guardar();
        paso = 0;
        ctx.ir('/hoy', true);
        location.reload();
      } catch (e) {
        n.disabled = false;
        n.textContent = 'Crear mi plan';
        toast(e.message, 'bad');
      }
    },
  });
}

function leerCampos(root) {
  root.querySelectorAll('[data-campo]').forEach((el) => {
    const v = el.type === 'number' ? Number(el.value) : el.value;
    if (v !== '' && !Number.isNaN(v)) datos[el.dataset.campo] = v;
  });
}

/* ---------- Pasos ---------- */

function bienvenida() {
  return `
    <div class="center" style="padding:26px 0 10px">
      <div class="eyebrow">Tu entrenador</div>
      <h1 class="page-title" style="font-size:2.1rem">Deja de adivinar<br>qué peso poner</h1>
      <p class="muted" style="margin-top:14px">
        Apuntas cada serie. Yo llevo la cuenta, te digo cuándo subir peso,
        cuándo estás estancado y qué comer para que el entreno sirva de algo.
      </p>
    </div>
    <div class="card accent">
      <div class="eyebrow">Cómo funciona</div>
      <ul class="stack small">
        <li><b>Semanas 1 y 2:</b> entreno normal. Mido tus pesos y tus reps reales, no toco nada.</li>
        <li><b>Semana 3 en adelante:</b> cada sesión llega con el peso ya calculado.</li>
        <li><b>Siempre:</b> descansos cronometrados y comidas con cantidades concretas.</li>
      </ul>
    </div>
    <button class="btn primary block lg mt" data-act="siguiente">Empezar</button>`;
}

function cuerpo() {
  return `
    <div class="eyebrow">Paso 1 de 4</div>
    <h2 class="page-title">Tus datos</h2>
    <p class="page-sub">Con esto calculo tus calorías. Se puede cambiar luego.</p>

    <div class="field">
      <label>Sexo</label>
      <div class="seg">
        <button data-act="opcion" data-campo="sexo" data-valor="hombre" class="${datos.sexo === 'hombre' ? 'on' : ''}">Hombre</button>
        <button data-act="opcion" data-campo="sexo" data-valor="mujer" class="${datos.sexo === 'mujer' ? 'on' : ''}">Mujer</button>
      </div>
    </div>
    <div class="row">
      <div class="field grow">
        <label>Edad</label>
        <input class="input num" type="number" inputmode="numeric" data-campo="edad" value="${datos.edad}">
      </div>
      <div class="field grow">
        <label>Altura (cm)</label>
        <input class="input num" type="number" inputmode="numeric" data-campo="altura" value="${datos.altura}">
      </div>
    </div>
    <div class="field">
      <label>Peso actual (kg)</label>
      <input class="input num" type="number" inputmode="decimal" step="0.1" data-campo="peso" value="${datos.peso}">
    </div>
    <div class="row mt">
      <button class="btn quiet" data-act="atras">Atrás</button>
      <button class="btn primary grow" data-act="siguiente">Seguir</button>
    </div>`;
}

function meta() {
  return `
    <div class="eyebrow">Paso 2 de 4</div>
    <h2 class="page-title">Tu objetivo</h2>
    <p class="page-sub">Marca la dirección de las calorías y el ritmo que voy a vigilar.</p>

    <div class="field">
      <label>Qué quieres</label>
      <div class="stack">
        ${Object.entries(OBJETIVOS).map(([id, o]) => `
          <button class="list-item" data-act="opcion" data-campo="objetivo" data-valor="${id}"
                  style="${datos.objetivo === id ? 'border-color:var(--accent)' : ''}">
            <div class="body">
              <b>${esc(o.nombre)}</b>
              <small>${esc(o.desc)}</small>
            </div>
            ${datos.objetivo === id ? '<span class="tag accent">Elegido</span>' : ''}
          </button>`).join('')}
      </div>
    </div>

    <div class="field">
      <label>Actividad fuera del gimnasio</label>
      <div class="stack">
        ${Object.entries(FACTOR_ACTIVIDAD).map(([id, a]) => `
          <button class="list-item" data-act="opcion" data-campo="actividad" data-valor="${id}"
                  style="${datos.actividad === id ? 'border-color:var(--accent)' : ''}">
            <div class="body"><b>${esc(a.nombre)}</b><small>${esc(a.desc)}</small></div>
          </button>`).join('')}
      </div>
    </div>
    <div class="row mt">
      <button class="btn quiet" data-act="atras">Atrás</button>
      <button class="btn primary grow" data-act="siguiente">Seguir</button>
    </div>`;
}

function material() {
  const plantilla = PLANTILLAS[datos.dias];
  return `
    <div class="eyebrow">Paso 3 de 4</div>
    <h2 class="page-title">Tu gimnasio</h2>
    <p class="page-sub">Solo te propondré ejercicios que puedas hacer de verdad.</p>

    <div class="field">
      <label>Días por semana</label>
      <div class="chips">
        ${[2, 3, 4, 5, 6].map((d) => `
          <button class="chip ${datos.dias === d ? 'on' : ''}" data-act="opcion" data-campo="dias" data-valor="${d}">${d} días</button>`).join('')}
      </div>
    </div>

    ${plantilla ? `
      <div class="card accent">
        <div class="eyebrow">Te tocaría</div>
        <h3>${esc(plantilla.nombre)}</h3>
        <p class="muted small mb0">${esc(plantilla.descripcion)}</p>
      </div>` : ''}

    <div class="field">
      <label>Material disponible</label>
      <div class="chips">
        ${CATEGORIAS_EQUIPO.map((c) => `
          <button class="chip ${datos.categorias.includes(c.id) ? 'on' : ''}" data-act="material" data-id="${c.id}">${esc(c.nombre)}</button>`).join('')}
      </div>
    </div>

    <div class="row mt-lg">
      <button class="btn quiet" data-act="atras">Atrás</button>
      <button class="btn primary grow lg" data-act="terminar">Crear mi plan</button>
    </div>`;
}
