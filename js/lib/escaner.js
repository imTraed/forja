/**
 * Lector de códigos de barras con la cámara.
 *
 * Dos caminos:
 *  1. `BarcodeDetector`, que Chrome en Android trae de serie. Cero descargas.
 *  2. ZXing en local (328 KB) para Safari e iOS, que no tienen el nativo.
 *     Se carga solo cuando hace falta, así que quien tenga el nativo no lo paga.
 *
 * La cámara solo funciona en HTTPS o en localhost: es una regla del navegador,
 * no algo que podamos saltarnos. En el móvil hay que abrir la web desplegada.
 */

const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'];

export const hayCamara = () => !!navigator.mediaDevices?.getUserMedia;
export const contextoSeguro = () => window.isSecureContext || location.hostname === 'localhost';
const hayNativo = () => 'BarcodeDetector' in window;

let zxingCargado = null;

function cargarZxing() {
  if (zxingCargado) return zxingCargado;
  zxingCargado = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/zxing-library.min.js';
    s.onload = () => (window.ZXing ? resolve(window.ZXing) : reject(new Error('ZXing no cargó')));
    s.onerror = () => reject(new Error('No se pudo cargar el lector'));
    document.head.appendChild(s);
  });
  return zxingCargado;
}

/**
 * Arranca la cámara sobre un <video> y avisa con el primer código que lea.
 * @returns {Promise<{parar: () => void}>}
 */
export async function escanear(video, alLeer, alFallar) {
  if (!contextoSeguro()) throw new Error('La cámara necesita HTTPS. Abre la web publicada, no el archivo local.');
  if (!hayCamara()) throw new Error('Este navegador no da acceso a la cámara.');

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment', width: { ideal: 1280 } },
  });

  video.srcObject = stream;
  video.setAttribute('playsinline', '');   // iOS: sin esto abre el vídeo a pantalla completa
  await video.play();

  let vivo = true;
  let lector = null;

  const parar = () => {
    vivo = false;
    stream.getTracks().forEach((t) => t.stop());
    try { lector?.reset(); } catch { /* el lector ya estaba parado */ }
    video.srcObject = null;
  };

  const acertar = (texto) => {
    if (!vivo) return;
    const limpio = String(texto).replace(/\D/g, '');
    if (!limpio) return;
    parar();
    alLeer(limpio);
  };

  if (hayNativo()) {
    const detector = new window.BarcodeDetector({ formats: FORMATOS });
    const bucle = async () => {
      if (!vivo) return;
      try {
        const codigos = await detector.detect(video);
        if (codigos.length) return acertar(codigos[0].rawValue);
      } catch { /* un fotograma ilegible no es un error: se intenta con el siguiente */ }
      requestAnimationFrame(bucle);
    };
    requestAnimationFrame(bucle);
    return { parar };
  }

  try {
    const ZXing = await cargarZxing();
    lector = new ZXing.BrowserMultiFormatReader();
    lector.decodeFromVideoElement(video, (resultado) => {
      if (resultado) acertar(resultado.getText());
    });
  } catch (e) {
    parar();
    alFallar?.(e);
    throw e;
  }

  return { parar };
}
