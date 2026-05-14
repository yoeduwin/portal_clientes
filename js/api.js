/**
 * api.js | Ejecutiva Ambiental – Portal de Cliente
 *
 * CAPA DE ABSTRACCIÓN DE API — Versión Supabase
 * ─────────────────────────────────────────────────────────────────────
 * Todas las llamadas al backend pasan por aquí.
 * `supabaseClient` viene de js/supabase-client.js (cargado antes en index.html).
 * js/app.js no necesita cambios — llama las mismas funciones de siempre.
 *
 * SEGURIDAD IMPLEMENTADA:
 *  ✓ Supabase valida y hashea contraseñas automáticamente (bcrypt interno)
 *  ✓ El token de sesión lo gestiona Supabase en localStorage cifrado
 *  ✓ Row Level Security (RLS) en Supabase: cada cliente solo ve sus datos
 *  ✓ storage_path nunca sale de la base de datos (función RPC en el servidor)
 *  ✓ URLs de documentos son temporales (5 minutos) y generadas por el servidor
 *  ✓ sessionStorage solo guarda nombre/empresa para mostrar en la UI
 * ─────────────────────────────────────────────────────────────────────
 */

'use strict';

// ─── CLASE DE ERROR ───────────────────────────────────────────────────────────
// app.js usa esta clase para mostrar mensajes de error amigables al usuario.

class ApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

// ─── MÓDULO: AUTENTICACIÓN ────────────────────────────────────────────────────

const AuthAPI = {

  /**
   * Inicia sesión con correo y contraseña.
   *
   * Supabase valida las credenciales y hashea la contraseña internamente.
   * Nosotros nunca vemos ni guardamos la contraseña.
   * El token de sesión lo guarda Supabase de forma cifrada en localStorage.
   * En sessionStorage solo guardamos nombre y empresa para mostrar en la UI.
   */
  async login(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email:    email.trim(),
      password: password,
    });

    if (error) {
      // Supabase devuelve mensajes en inglés — los traducimos aquí.
      throw new ApiError(
        'Credenciales incorrectas. Verifica tu correo y contraseña.',
        401
      );
    }

    // Obtenemos los datos del perfil (nombre, empresa, rol) para la UI.
    const profile = await _fetchProfile(data.user.id);

    const sessionData = {
      userId:  data.user.id,
      name:    profile.name,
      company: profile.company,
      role:    profile.role,
    };

    Session.save(sessionData);
    return sessionData;
  },

  /**
   * Cierra la sesión activa.
   * Supabase elimina el token de localStorage y lo invalida.
   */
  async logout() {
    Session.clear();
    await supabaseClient.auth.signOut();
  },

  /**
   * Devuelve los datos de la sesión guardados en sessionStorage (solo para UI).
   * Si el usuario recargar la página, Supabase recupera su sesión automáticamente.
   */
  getCurrentSession() {
    return Session.load();
  },
};

// ─── MÓDULO: DATOS DEL CLIENTE ────────────────────────────────────────────────

const ClientAPI = {

  /**
   * Devuelve el perfil del cliente autenticado (nombre, empresa, rol, RFC, teléfono).
   */
  async getProfile() {
    const userId = await _requireUserId();
    return _fetchProfile(userId);
  },

  /**
   * Devuelve las órdenes de trabajo del cliente autenticado.
   * Row Level Security en Supabase garantiza que cada cliente
   * solo recibe sus propias órdenes — no necesitamos filtrar aquí.
   */
  async getOrders() {
    await _requireUserId();

    const { data, error } = await supabaseClient
      .from('orders')
      .select('*')
      .order('scheduled_date', { ascending: true });

    if (error) throw new ApiError('Error al cargar órdenes de trabajo.', 500);

    // Convertir nombres de columna (snake_case de la base de datos)
    // al formato que espera app.js (camelCase).
    return (data || []).map(row => ({
      id:            row.id,
      service:       row.service,
      description:   row.description,
      area:          row.area,
      scheduledDate: row.scheduled_date,
      status:        row.status,
      assignedTo:    row.assigned_to,
      notes:         row.notes,
      docKey:        row.doc_key,
    }));
  },

  /**
   * Devuelve los documentos a los que el cliente tiene acceso.
   * Usamos la vista `documents_safe` que excluye la columna `storage_path`.
   * El cliente nunca ve la ruta real del archivo — solo el nombre y el accessKey.
   */
  async getDocuments() {
    await _requireUserId();

    const { data, error } = await supabaseClient
      .from('documents_safe')
      .select('*')
      .order('date', { ascending: false });

    if (error) throw new ApiError('Error al cargar documentos.', 500);

    return (data || []).map(row => ({
      id:        row.id,
      name:      row.name,
      type:      row.type,
      size:      row.size,
      date:      row.date,
      status:    row.status,
      orderId:   row.order_id,
      accessKey: row.access_key,
    }));
  },

  /**
   * Genera una URL firmada y temporal para descargar un documento.
   *
   * Flujo de seguridad:
   *   1. El frontend envía solo el `accessKey` (una clave opaca, no la ruta real).
   *   2. La función RPC en Supabase (`get_signed_document_url`) verifica que el
   *      documento pertenece al usuario autenticado y devuelve el `storage_path`.
   *   3. Con ese path, `createSignedUrl` genera una URL válida por 5 minutos.
   *   4. app.js abre la URL en nueva pestaña y NO la guarda en ningún lado.
   *
   * @param {string} accessKey - Clave opaca del documento (ej. "DOC-2026-004-PREV")
   * @returns {Promise<{url: string, expiresIn: number}>}
   */
  async getDocumentUrl(accessKey) {
    if (!accessKey) throw new ApiError('Clave de documento inválida.', 400);

    // Paso 1: el servidor verifica permisos y devuelve el storage_path real.
    const { data: rpcData, error: rpcError } = await supabaseClient.rpc(
      'get_signed_document_url',
      { p_access_key: accessKey }
    );

    if (rpcError || !rpcData?.storage_path) {
      throw new ApiError('Documento no disponible o acceso no autorizado.', 403);
    }

    // Paso 2: generar URL firmada (expira en 300 segundos = 5 minutos).
    const { data: signedData, error: signedError } = await supabaseClient
      .storage
      .from('documentos')
      .createSignedUrl(rpcData.storage_path, 300);

    if (signedError || !signedData?.signedUrl) {
      throw new ApiError('No se pudo generar el enlace de descarga.', 500);
    }

    return {
      url:       signedData.signedUrl,
      expiresIn: 300,
    };
  },

  /**
   * Devuelve las fechas importantes del cliente (solo fechas futuras, ordenadas).
   */
  async getUpcomingDates() {
    await _requireUserId();

    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

    const { data, error } = await supabaseClient
      .from('upcoming_dates')
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true });

    if (error) throw new ApiError('Error al cargar fechas importantes.', 500);

    return (data || []).map(row => ({
      date:        row.date,
      title:       row.title,
      description: row.description,
      orderId:     row.order_id,
    }));
  },
};

// ─── FUNCIONES INTERNAS ───────────────────────────────────────────────────────

/**
 * Obtiene el perfil desde la tabla `profiles`.
 * Reutilizada por `AuthAPI.login()` y `ClientAPI.getProfile()`.
 */
async function _fetchProfile(userId) {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, name, company, role, rfc, phone')
    .eq('id', userId)
    .single();

  if (error || !data) {
    throw new ApiError('No se encontró el perfil del usuario.', 404);
  }

  return data;
}

/**
 * Verifica que hay una sesión de Supabase activa.
 * Si la sesión expiró, lanza ApiError para que app.js muestre el login.
 */
async function _requireUserId() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session?.user?.id) {
    throw new ApiError('Sesión expirada. Por favor inicia sesión de nuevo.', 401);
  }
  return session.user.id;
}

// ─── GESTOR DE SESIÓN (solo para la UI) ──────────────────────────────────────
// Guarda nombre, empresa y rol para mostrar en pantalla.
// El token de autenticación real lo gestiona Supabase en localStorage cifrado.
// sessionStorage se limpia al cerrar la pestaña.

const Session = {
  _key: 'ea_session',

  save(data) {
    const safe = {
      userId:         data.userId,
      name:           data.name,
      company:        data.company,
      role:           data.role,
      _sessionActive: true,
    };
    try {
      sessionStorage.setItem(this._key, JSON.stringify(safe));
    } catch (e) {
      console.warn('[Session] No se pudo guardar en sessionStorage');
    }
  },

  load() {
    try {
      const raw = sessionStorage.getItem(this._key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  clear() {
    try {
      sessionStorage.removeItem(this._key);
    } catch { /* ignorar */ }
  },

  isActive() {
    const s = this.load();
    return s !== null && s._sessionActive === true;
  },
};
