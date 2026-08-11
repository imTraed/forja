/**
 * Conexión con Supabase (gratis).
 *
 * Mientras esto esté vacío la app funciona igual, pero sin cuentas: cada
 * navegador guarda lo suyo y no hay forma de recuperarlo si lo borras.
 * En cuanto pegues las dos claves aparece el registro y el inicio de sesión.
 *
 * Dónde están: supabase.com -> tu proyecto -> Project Settings -> API.
 *   URL      -> "Project URL"
 *   ANON_KEY -> "anon public"
 *
 * La clave anon es pública a propósito: va en el navegador de todos y no da
 * acceso a nada por sí sola. Lo que protege los datos son las políticas RLS
 * de la base, que están en el README.
 */
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const hayNube = () => Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
