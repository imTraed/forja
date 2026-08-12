/**
 * Conexión con Supabase (gratis).
 *
 * Mientras esto esté vacío la app funciona igual, pero sin cuentas: cada
 * navegador guarda lo suyo y no hay forma de recuperarlo si lo borras.
 * En cuanto pegues las dos claves aparece el registro y el inicio de sesión.
 *
 * Dónde están: supabase.com -> tu proyecto -> Project Settings -> API.
 *   URL      -> "Project URL"
 *   ANON_KEY -> "anon public" (o "publishable" en proyectos nuevos)
 *
 * Esta clave es pública a propósito: va en el navegador de todos y no da
 * acceso a nada por sí sola. Lo que protege los datos son las políticas RLS
 * de la base, que están en supabase.sql.
 *
 * La clave "secret" (sb_secret_... o "service_role") es la otra mitad del
 * par y NUNCA va aquí: salta las políticas RLS y da acceso a todo. Esa se
 * queda fuera del código, no se sube a ningún sitio.
 */
export const SUPABASE_URL = 'https://vcufjctblduympjeqath.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_nPO7rYqTsAQv3FTYePtoWQ_UV0Kc_Hn';

export const hayNube = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
