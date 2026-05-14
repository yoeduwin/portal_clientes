/**
 * supabase-client.js | Ejecutiva Ambiental – Portal de Cliente
 *
 * ═══════════════════════════════════════════════════════════════════
 *  PASO 1 DE 2: CONFIGURA TUS CREDENCIALES DE SUPABASE
 * ═══════════════════════════════════════════════════════════════════
 *
 *  1. Ve a https://supabase.com y entra a tu proyecto.
 *  2. En el menú izquierdo haz clic en "Project Settings" (ícono de engranaje).
 *  3. Haz clic en "API".
 *  4. Copia el valor de "Project URL" y pégalo en SUPABASE_URL (abajo).
 *  5. Copia el valor de "anon public" y pégalo en SUPABASE_ANON_KEY (abajo).
 *
 *  ¿Por qué puedo poner esta clave en el código del navegador?
 *  La clave "anon" es PÚBLICA por diseño — Supabase la espera en el navegador.
 *  La seguridad REAL la imponen las políticas de Row Level Security (RLS)
 *  en la base de datos: aunque alguien vea esta clave, la base de datos
 *  rechaza cualquier consulta que no pertenezca al usuario autenticado.
 *
 *  ⚠️ NUNCA pongas aquí la clave "service_role" — esa sí es secreta.
 *
 * ═══════════════════════════════════════════════════════════════════
 */

'use strict';

// ─── TUS CREDENCIALES ─────────────────────────────────────────────
// Reemplaza los textos entre comillas con tus valores reales de Supabase.

const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
//                          ↑ ejemplo: https://abcdefghijklmno.supabase.co

const SUPABASE_ANON_KEY = 'eyJ_TU_CLAVE_ANON_AQUI';
//                              ↑ empieza con "eyJ" y es muy larga (~200 caracteres)

// ─── INICIALIZACIÓN ───────────────────────────────────────────────
// La librería de Supabase viene del CDN definido en index.html.
// Esta línea crea la conexión que usa todo el portal.

const { createClient } = supabase;

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // Mantiene la sesión activa aunque el usuario recargue la página.
    // Supabase cifra el token antes de guardarlo en localStorage.
    persistSession: true,
    storageKey: 'ea_supabase_session',

    // Renueva el token automáticamente antes de que expire (~cada hora).
    // El usuario no necesita volver a iniciar sesión mientras tenga el navegador abierto.
    autoRefreshToken: true,

    // No intentar leer tokens desde la URL (no usamos OAuth con redirects).
    detectSessionInUrl: false,
  },
});

/*
 * ═══════════════════════════════════════════════════════════════════
 *  PASO 2 DE 2: SUBE LOS ARCHIVOS A HOSTGATOR
 * ═══════════════════════════════════════════════════════════════════
 *
 *  Archivos que SÍ debes subir a Hostgator (en la carpeta public_html):
 *
 *    ✓ index.html
 *    ✓ .htaccess
 *    ✓ css/styles.css
 *    ✓ js/supabase-client.js   ← este archivo (con tus credenciales ya puestas)
 *    ✓ js/api.js
 *    ✓ js/app.js
 *
 *  Archivos que NO debes subir:
 *    ✗ js/mock-data.js         ← solo era para pruebas, no va en producción
 *
 *  Cómo subir los archivos:
 *  1. Entra a tu panel de Hostgator (cPanel).
 *  2. Abre "Administrador de Archivos" (File Manager).
 *  3. Navega a la carpeta "public_html".
 *  4. Haz clic en "Subir" y sube cada archivo.
 *  5. Para ver el archivo .htaccess activa "Mostrar archivos ocultos"
 *     en la configuración del File Manager.
 *  6. Verifica que el SSL (candado 🔒) esté activo en tu dominio.
 *     Si no lo está, ve a cPanel → SSL/TLS → "Instalar y administrar SSL".
 *
 * ═══════════════════════════════════════════════════════════════════
 */
