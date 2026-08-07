/* Alta inicial: 7 preguntas + formulario final y sales con perfil y rutina generada. */
import { S, guardar, registrarPeso, guardarRutina } from '../store.js';
import { acts, esc, toast } from '../lib/ui.js';
import { cargar as cargarCatalogo } from '../data/catalog.js';
import { generarRutina } from '../engine/generator.js';

let paso = 0;
const datos = {
  // Datos básicos (paso final)
  nombre: '',
  sexo: '',
  edad: '',
  altura: '',
  peso: '',

  // Encuesta
  experiencia: '',
  rutinaAnterior: '',
  alimentacion: '',
  objetivo: '',
  actividad: '',
  dias: null,
  categorias: [],
};

const PREGUNTAS = [
  {
    campo: 'experiencia',
    titulo: '¿Cuál es tu nivel de experiencia actual en el entrenamiento?',
    opciones: [
      { valor: 'novato', texto: 'Novato (Nunca he entrenado o lo dejé hace mucho)' },
      { valor: 'principiante', texto: 'Principiante (Llevo menos de 6 meses constantes)' },
      { valor: 'intermedio', texto: 'Intermedio (Llevo entre 1 y 2 años entrenando)' },
      { valor: 'avanzado', texto: 'Avanzado (Más de 2 años sin parar)' }
    ]
  },
  {
    campo: 'rutinaAnterior',
    titulo: '¿Qué tipo de rutina hacías antes de empezar aquí?',
    opciones: [
      { valor: 'aleatoria', texto: 'Ninguna, mi entrenamiento era aleatorio' },
      { valor: 'bro_split', texto: 'Hacía 1 músculo por día (Lunes pecho, Martes espalda...)' },
      { valor: 'dividida', texto: 'Hacía rutinas divididas (Torso/Pierna o Empuje/Tirón/Pierna)' },
      { valor: 'fullbody', texto: 'Hacía rutinas de cuerpo entero (Full Body)' }
    ]
  },
  {
    campo: 'alimentacion',
    titulo: '¿Cómo describirías tus hábitos de comida actuales?',
    opciones: [
      { valor: 'sin_control', texto: 'Como de todo, sin un horario ni control estricto' },
      { valor: 'moderado', texto: 'Hago 3-4 comidas al día, intento comer sano pero no mido nada' },
      { valor: 'proteina', texto: 'Controlo mis porciones y priorizo la proteína diaria' },
      { valor: 'estricto', texto: 'Cuento mis macros y calorías de forma estricta' }
    ]
  },
  {
    campo: 'objetivo',
    titulo: '¿Cuál es tu objetivo principal para estas próximas semanas?',
    opciones: [
      { valor: 'definicion', texto: 'Perder grasa (Definición)' },
      { valor: 'volumen', texto: 'Ganar masa muscular (Volumen)' },
      { valor: 'mantenimiento', texto: 'Mantenimiento y salud general (Recomposición)' },
      { valor: 'fuerza', texto: 'Aumentar mi fuerza máxima' }
    ]
  },
  {
    campo: 'actividad',
    titulo: '¿Cómo es tu actividad diaria (fuera del gimnasio)?',
    opciones: [
      { valor: 'sedentario', texto: 'Sedentario: Trabajo sentado (oficina/PC) y me muevo muy poco' },
      { valor: 'ligero', texto: 'Ligero: Trabajo sentado pero doy paseos diarios o me muevo en casa' },
      { valor: 'moderado', texto: 'Moderado: Trabajo de pie (dependiente, profesor) o camino +8000 pasos' },
      { valor: 'alto', texto: 'Muy activo: Trabajo físico (construcción, almacén) y no paro en el día' }
    ]
  },
  {
    campo: 'dias',
    titulo: '¿De cuánto tiempo y días dispones a la semana?',
    opciones: [
      { valor: 2, texto: '2 días a la semana (poco tiempo)' },
      { valor: 3, texto: '3 días a la semana' },
      { valor: 4, texto: '4 días a la semana' },
      { valor: 5, texto: '5 o 6 días a la semana' }
    ]
  },
  {
    campo: 'categorias',
    titulo: '¿Con qué equipamiento cuentas para entrenar?',
    opciones: [
      { valor: 'corporal', texto: 'Nada, solo mi propio cuerpo (Calistenia/Casa)' },
      { valor: 'mancuernas', texto: 'Un par de mancuernas en casa' },
      { valor: 'maquinas', texto: 'Gimnasio básico (Máquinas y algunas pesas libres)' },
      { valor: 'barra', texto: 'Gimnasio completo (Barras, racks, poleas, máquinas)' }
    ]
  }
];

export async function render(ctx) {
  const pasosTotales = PREGUNTAS.length + 1; // 7 preguntas + form final
  
  ctx.view.innerHTML = `
    <div class="onb" style="display:flex; flex-direction:column; justify-content:center; min-height: 85vh; padding-top: 20px;">
      <h1 class="brand" style="text-align:center; font-size: 2.5rem; margin-bottom: 40px; letter-spacing: 5px;">FORJA<span>.</span></h1>
      <div class="bar mt" style="margin-bottom:22px"><i style="width:${((paso + 1) / pasosTotales) * 100}%"></i></div>
      ${paso < PREGUNTAS.length ? renderPregunta(paso) : renderFinal()}
    </div>`;

  acts(ctx.view, {
    siguiente: () => {
      leerCampos(ctx.view);
      paso = Math.min(pasosTotales - 1, paso + 1);
      render(ctx);
    },
    atras: () => {
      leerCampos(ctx.view);
      paso = Math.max(0, paso - 1);
      render(ctx);
    },
    opcion: (n) => {
      leerCampos(ctx.view);
      const { campo, valor } = n.dataset;
      datos[campo] = valor;
      render(ctx);
    },
    responder: (n) => {
      const { campo, valor } = n.dataset;
      
      let val = valor;
      if (campo === 'dias') val = Number(valor);
      
      if (campo === 'categorias') {
        if (val === 'corporal') datos.categorias = ['corporal'];
        else if (val === 'mancuernas') datos.categorias = ['corporal', 'mancuernas'];
        else if (val === 'maquinas') datos.categorias = ['corporal', 'mancuernas', 'maquinas', 'bandas'];
        else if (val === 'barra') datos.categorias = ['corporal', 'mancuernas', 'maquinas', 'bandas', 'barra', 'barbell', 'dumbbell'];
      } else {
        datos[campo] = val;
      }
      
      // Auto-avance con pequeño delay para mostrar selección
      setTimeout(() => {
        paso = Math.min(pasosTotales - 1, paso + 1);
        render(ctx);
      }, 180);
    },
    terminar: async (n) => {
      leerCampos(ctx.view);
      if (!datos.nombre || !datos.peso || !datos.altura || !datos.edad || !datos.sexo) return toast('Completa todos los datos básicos', 'bad');
      if (!datos.categorias.length) datos.categorias = ['corporal', 'mancuernas', 'maquinas', 'bandas', 'barra'];
      
      n.disabled = true;
      n.textContent = 'Analizando perfil con IA...';
      
      try {
        await cargarCatalogo();
        
        // Simular tiempo de IA
        await new Promise(r => setTimeout(r, 1600));
        
        // El generador y store necesitan un objetivo válido (volumen, definicion, mantenimiento)
        const objReal = datos.objetivo === 'fuerza' ? 'volumen' : datos.objetivo;
        datos.objetivo = objReal;
        
        S.perfil = { ...datos, creado: new Date().toISOString() };
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
    if (el.value.trim() === '') return;
    const v = el.type === 'number' ? Number(el.value) : el.value;
    if (!Number.isNaN(v)) datos[el.dataset.campo] = v;
  });
}

function renderPregunta(idx) {
  const p = PREGUNTAS[idx];
  
  const esSeleccionado = (val) => {
    if (p.campo === 'categorias') {
      const equip = datos.categorias;
      if (val === 'corporal' && equip.length === 1 && equip[0] === 'corporal') return true;
      if (val === 'mancuernas' && equip.includes('mancuernas') && !equip.includes('maquinas')) return true;
      if (val === 'maquinas' && equip.includes('maquinas') && !equip.includes('barra')) return true;
      if (val === 'barra' && equip.includes('barra')) return true;
      return false;
    }
    return datos[p.campo] === val || datos[p.campo] === Number(val);
  };

  return `
    <div class="eyebrow">Pregunta ${idx + 1} de ${PREGUNTAS.length}</div>
    <h2 class="page-title" style="margin-bottom: 24px; font-size: 1.45rem;">${p.titulo}</h2>
    
    <div class="stack">
      ${p.opciones.map((o) => `
        <button class="list-item" data-act="responder" data-campo="${p.campo}" data-valor="${o.valor}"
                style="${esSeleccionado(o.valor) ? 'border-color:var(--accent)' : ''}">
          <div class="body">
            <b>${esc(o.texto)}</b>
          </div>
          ${esSeleccionado(o.valor) ? '<span class="tag accent">✓</span>' : ''}
        </button>
      `).join('')}
    </div>
    
    <div class="row mt-lg" style="justify-content: center;">
      ${idx > 0 ? `<button class="btn quiet" data-act="atras">Atrás</button>` : ''}
    </div>
  `;
}

function renderFinal() {
  return `
    <div class="eyebrow">Último paso</div>
    <h2 class="page-title">Datos Biométricos</h2>
    <p class="page-sub">La IA necesita estos datos para ajustar tus calorías y recomendarte los macros exactos.</p>

    <div class="field">
      <label>Nombre</label>
      <input class="input" type="text" data-campo="nombre" value="${datos.nombre}" placeholder="Ingresa tu nombre" onfocus="this.dataset.ph=this.placeholder; this.placeholder=''" onblur="this.placeholder=this.dataset.ph">
    </div>
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
        <input class="input num" type="number" inputmode="numeric" data-campo="edad" value="${datos.edad}" placeholder="21" onfocus="this.dataset.ph=this.placeholder; this.placeholder=''" onblur="this.placeholder=this.dataset.ph">
      </div>
      <div class="field grow">
        <label>Altura (cm)</label>
        <input class="input num" type="number" inputmode="numeric" data-campo="altura" value="${datos.altura}" placeholder="168" onfocus="this.dataset.ph=this.placeholder; this.placeholder=''" onblur="this.placeholder=this.dataset.ph">
      </div>
    </div>
    <div class="field">
      <label>Peso actual (kg)</label>
      <input class="input num" type="number" inputmode="decimal" step="0.1" data-campo="peso" value="${datos.peso}" placeholder="51.7" onfocus="this.dataset.ph=this.placeholder; this.placeholder=''" onblur="this.placeholder=this.dataset.ph">
    </div>
    <div class="row mt-lg">
      <button class="btn quiet" data-act="atras">Atrás</button>
      <button class="btn primary grow lg" data-act="terminar">Crear mi plan</button>
    </div>
  `;
}
