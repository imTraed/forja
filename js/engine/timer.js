/**
 * Temporizador de descanso.
 *
 * Cuenta contra un instante objetivo en vez de ir restando segundos, así que
 * sobrevive a que se bloquee la pantalla, a que el navegador congele los
 * intervalos en segundo plano y a que se repinte la vista.
 */
import { S } from '../store.js';

let objetivo = null;      // ms epoch en que termina
let total = 0;            // duración configurada, para la barra de progreso
let intervalo = null;
let wakeLock = null;
const oyentes = new Set();

export const alTic = (fn) => { oyentes.add(fn); return () => oyentes.delete(fn); };

export const activo = () => objetivo != null;
export const restante = () => (objetivo ? Math.max(0, (objetivo - Date.now()) / 1000) : 0);
export const duracionTotal = () => total;

function avisar(fin = false) {
  const r = restante();
  oyentes.forEach((fn) => fn(r, fin));
}

function bucle() {
  if (!objetivo) return;
  if (Date.now() >= objetivo) {
    parar();
    sonar();
    avisar(true);
    return;
  }
  avisar();
}

export function arrancar(segundos) {
  total = segundos;
  objetivo = Date.now() + segundos * 1000;
  clearInterval(intervalo);
  intervalo = setInterval(bucle, 250);
  avisar();
}

export function parar() {
  clearInterval(intervalo);
  intervalo = null;
  objetivo = null;
  avisar();
}

export function sumar(segundos) {
  if (!objetivo) return;
  objetivo += segundos * 1000;
  total += Math.max(0, segundos);
  avisar();
}

/* ---------- Aviso ---------- */

let audioCtx = null;

/** Pitido corto con WebAudio: no hace falta ningún fichero de sonido. */
export function sonar() {
  if (S.ajustes.vibrar && navigator.vibrate) navigator.vibrate([180, 90, 180]);
  if (!S.ajustes.sonido) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t0 = audioCtx.currentTime;
    [0, 0.22, 0.44].forEach((offset, i) => {
      const osc = audioCtx.createOscillator();
      const vol = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = i === 2 ? 1180 : 880;
      vol.gain.setValueAtTime(0.0001, t0 + offset);
      vol.gain.exponentialRampToValueAtTime(0.4, t0 + offset + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.18);
      osc.connect(vol).connect(audioCtx.destination);
      osc.start(t0 + offset);
      osc.stop(t0 + offset + 0.2);
    });
  } catch { /* el navegador puede bloquear el audio hasta que haya interacción */ }
}

/** Desbloquea el audio en el primer toque del usuario (política de iOS/Android). */
export function prepararAudio() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch { /* sin audio, queda la vibración */ }
}

/* ---------- Pantalla encendida durante el entreno ---------- */

export async function mantenerPantalla(on) {
  if (!S.ajustes.pantallaActiva || !('wakeLock' in navigator)) return;
  try {
    if (on && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch { /* el navegador puede negarlo, no es crítico */ }
}

// Al volver de segundo plano puede haberse soltado el bloqueo de pantalla.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (S.sesionActiva) mantenerPantalla(true);
    if (objetivo) bucle();
  }
});
