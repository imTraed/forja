/**
 * Descarga el dataset de hasaneyldrm/exercises-dataset (16,6 MB, 10 idiomas)
 * y escribe dos ficheros recortados que sí se pueden servir a un móvil:
 *
 *   js/data/exercises.min.json    ficha completa en español, sin los otros 9 idiomas
 *   js/data/vocab.json            valores distintos de equipment/target/body_part
 *
 * Uso:  node tools/build-dataset.mjs
 */
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAW = 'https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'js', 'data');

/** Idiomas por orden de preferencia para las instrucciones. */
const LANGS = ['es', 'en'];

function pickSteps(ex) {
  const steps = ex.instruction_steps || {};
  for (const lang of LANGS) {
    const s = steps[lang];
    if (Array.isArray(s) && s.length) return s;
  }
  // Algunos registros solo traen el texto corrido.
  const text = ex.instructions?.es || ex.instructions?.en;
  return text ? String(text).split(/\r?\n/).filter(Boolean) : [];
}

const norm = (v) => (typeof v === 'string' ? v.trim().toLowerCase() : '');

/**
 * El dataset original tiene nombres mal codificados ("sled 45в° leg press",
 * con una в cirílica colada delante del grado). Se limpian aquí para no
 * arrastrar la errata a las plantillas de rutina.
 */
function limpiarNombre(n) {
  return String(n)
    .replace(/[\u0400-\u04FF](?=[\u00B0\u00BA])/g, '')  // cirilica pegada a un grado
    .replace(/\s+/g, ' ')
    .trim();
}

console.log('Descargando dataset…');
const res = await fetch(RAW);
if (!res.ok) throw new Error(`GitHub respondió ${res.status}`);
const all = await res.json();
console.log(`  ${all.length} ejercicios en bruto`);

const vocab = { body_part: new Set(), equipment: new Set(), target: new Set() };

const slim = all.map((ex) => {
  vocab.body_part.add(norm(ex.body_part));
  vocab.equipment.add(norm(ex.equipment));
  vocab.target.add(norm(ex.target));
  return {
    id: String(ex.id),
    name: limpiarNombre(ex.name),
    bodyPart: norm(ex.body_part),
    equipment: norm(ex.equipment),
    target: norm(ex.target),
    muscleGroup: norm(ex.muscle_group),
    secondary: (ex.secondary_muscles || []).map(norm).filter(Boolean),
    steps: pickSteps(ex),
    image: ex.image,
    gif: ex.gif_url,
  };
});

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'exercises.min.json'), JSON.stringify(slim));
await writeFile(
  join(OUT, 'vocab.json'),
  JSON.stringify(
    Object.fromEntries(Object.entries(vocab).map(([k, v]) => [k, [...v].filter(Boolean).sort()])),
    null,
    2,
  ),
);

const mb = (s) => (Buffer.byteLength(JSON.stringify(s)) / 1024 / 1024).toFixed(2);
console.log(`  exercises.min.json   ${mb(slim)} MB`);
console.log('Vocabulario:');
for (const [k, v] of Object.entries(vocab)) console.log(`  ${k}: ${[...v].filter(Boolean).length} valores`);
