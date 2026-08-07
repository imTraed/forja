/* Asistente para calcar la rutina actual del usuario día a día. */
import { S, guardarRutina, guardar } from '../store.js';
import { acts, toast } from '../lib/ui.js';
import { generarRutinaCustom, generarRutina } from '../engine/generator.js';
import { cargar as cargarCatalogo } from '../data/catalog.js';

let ctx = null;

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MUSCULOS = [
  { id: 'pecho', nombre: 'Pecho' },
  { id: 'espalda', nombre: 'Espalda' },
  { id: 'pierna', nombre: 'Pierna' },
  { id: 'hombro', nombre: 'Hombro' },
  { id: 'brazos', nombre: 'Brazos' },
  { id: 'core', nombre: 'Core / Abs' },
];

let seleccion = [[], [], [], [], [], [], []]; // Lunes a Domingo
let paso = 0; // 0 = verificando, 1 = wizard, 2 = novato

export async function render(c) {
  ctx = c;
  const p = S.perfil;

  if (paso === 0) {
    if (p.experiencia === 'novato') {
      paso = 2; // Mostrar pantalla de novato
    } else {
      paso = 1; // Mostrar wizard
    }
  }

  if (paso === 2) {
    ctx.view.innerHTML = `
      <div class="card accent glow mt-lg">
        <div class="eyebrow">Tu primera rutina</div>
        <h2 class="page-title" style="margin-bottom:12px">Lista para empezar</h2>
        <p class="muted">Como nos dijiste que eres novato, he preparado la rutina ideal para ti. Está adaptada a los ${p.dias} días que tienes disponibles.</p>
        <button class="btn primary block lg mt-lg" data-act="generarNovato">Empezar a entrenar</button>
      </div>
    `;
  } else if (paso === 1) {
    ctx.view.innerHTML = `
      <div class="eyebrow mt">Tu rutina actual</div>
      <h2 class="page-title" style="margin-bottom:8px">Calquemos tu semana</h2>
      <p class="page-sub">Selecciona qué músculos entrenas cada día. Deja en blanco los días de descanso.</p>

      <div class="stack mt-lg" style="gap:16px; margin-bottom: 24px">
        ${DIAS.map((d, i) => `
          <div class="card">
            <h3 style="margin-bottom: 12px">${d}</h3>
            <div class="seg" style="flex-wrap: wrap; gap: 8px;">
              ${MUSCULOS.map((m) => {
      const activo = seleccion[i].includes(m.id);
      return `<button data-act="toggle" data-dia="${i}" data-musculo="${m.id}" class="${activo ? 'on' : ''}" style="flex: 1 1 calc(33% - 8px); min-width: 80px; text-align: center; font-size: 0.85rem">${m.nombre}</button>`;
    }).join('')}
            </div>
            ${seleccion[i].length === 0 ? `<p class="tiny muted" style="margin-top:8px">Día de descanso</p>` : ''}
          </div>
        `).join('')}
      </div>

      <button class="btn primary block lg" data-act="generarWizard">Crear mi rutina</button>
      <div style="height:32px"></div>
    `;
  }

  acts(ctx.view, {
    toggle: (n) => {
      const dia = Number(n.dataset.dia);
      const musculo = n.dataset.musculo;
      const idx = seleccion[dia].indexOf(musculo);
      if (idx > -1) seleccion[dia].splice(idx, 1);
      else seleccion[dia].push(musculo);
      render(ctx);
    },
    generarNovato: async (n) => {
      n.disabled = true;
      n.textContent = 'Creando...';
      try {
        await cargarCatalogo();
        const rutina = generarRutina({ dias: p.dias, categorias: p.categorias });
        guardarRutina(rutina);
        S.rutinaActiva = rutina.id;
        guardar();
        ctx.ir('/hoy', true);
        location.reload();
      } catch (e) {
        n.disabled = false;
        toast(e.message, 'bad');
      }
    },
    generarWizard: async (n) => {
      const diasActivos = seleccion.filter(s => s.length > 0).length;
      if (diasActivos === 0) return toast('Selecciona al menos un día de entreno', 'bad');

      n.disabled = true;
      n.textContent = 'Creando...';
      try {
        await cargarCatalogo();
        const rutina = generarRutinaCustom(seleccion, p.categorias);
        guardarRutina(rutina);
        S.rutinaActiva = rutina.id;
        guardar();
        ctx.ir('/hoy', true);
        location.reload();
      } catch (e) {
        n.disabled = false;
        toast(e.message, 'bad');
      }
    }
  });
}

export function salir() {
  paso = 0;
  seleccion = [[], [], [], [], [], [], []];
}
