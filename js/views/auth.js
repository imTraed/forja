/* Registro e inicio de sesión. Solo aparece si hay Supabase configurado. */
import { acts, esc, toast, $ } from '../lib/ui.js';
import { registrar, entrar } from '../lib/nube.js';

let modo = 'entrar';   // 'entrar' | 'registro'
let ctx = null;

export async function render(c) {
  ctx = c;
  pintar();
}

function pintar(aviso = '') {
  const esRegistro = modo === 'registro';

  ctx.view.innerHTML = `
    <div style="display:flex;flex-direction:column;justify-content:center;min-height:78vh">
      <h1 class="brand" style="text-align:center;font-size:2.4rem;letter-spacing:5px;margin-bottom:8px">FORJA<span>.</span></h1>
      <p class="page-sub center">${esRegistro ? 'Crea tu cuenta y empieza' : 'Entra con tu cuenta'}</p>

      ${aviso ? `<div class="card accent"><p class="small mb0">${esc(aviso)}</p></div>` : ''}

      <div class="card">
        <div class="field">
          <label>Correo</label>
          <input class="input" id="email" type="email" inputmode="email" autocomplete="email"
                 autocapitalize="off" spellcheck="false" placeholder="tu@correo.com">
        </div>
        <div class="field mb0">
          <label>Contraseña</label>
          <input class="input" id="pass" type="password"
                 autocomplete="${esRegistro ? 'new-password' : 'current-password'}"
                 placeholder="${esRegistro ? 'Mínimo 6 caracteres' : ''}">
        </div>
      </div>

      <button class="btn primary block lg" data-act="enviar">
        ${esRegistro ? 'Crear cuenta' : 'Entrar'}
      </button>
      <button class="btn quiet block mt" data-act="cambiar">
        ${esRegistro ? 'Ya tengo cuenta' : 'No tengo cuenta, quiero registrarme'}
      </button>

      <p class="tiny faint center mt-lg">
        Tus datos se guardan en tu cuenta, así que puedes entrar desde otro móvil
        y seguir donde lo dejaste.
      </p>
    </div>`;

  acts(ctx.view, {
    cambiar: () => { modo = esRegistro ? 'entrar' : 'registro'; pintar(); },
    enviar: (boton) => enviar(boton),
  });

  // Enter en la contraseña envía, que en el móvil es lo natural.
  $('#pass', ctx.view).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ctx.view.querySelector('[data-act="enviar"]').click();
  });
}

async function enviar(boton) {
  const email = $('#email', ctx.view).value.trim();
  const password = $('#pass', ctx.view).value;

  if (!email.includes('@')) return toast('Ese correo no vale', 'bad');
  if (password.length < 6) return toast('La contraseña necesita 6 caracteres o más', 'bad');

  const textoOriginal = boton.textContent;
  boton.disabled = true;
  boton.textContent = modo === 'registro' ? 'Creando cuenta…' : 'Entrando…';

  try {
    const { estado } = modo === 'registro'
      ? await registrar(email, password)
      : await entrar(email, password);

    if (estado === 'confirma-correo') {
      modo = 'entrar';
      return pintar(`Cuenta creada. Te ha llegado un correo a ${email} para confirmarla: ábrelo y luego entra aquí.`);
    }
    // La sesión ya está guardada; el arranque se encarga de traer los datos.
    location.reload();
  } catch (e) {
    toast(e.message, 'bad');
    boton.disabled = false;
    boton.textContent = textoOriginal;
  }
}
