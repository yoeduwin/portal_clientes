/**
 * api.js | Ejecutiva Ambiental – Portal de Cliente
 *
 * CAPA DE ABSTRACCIÓN DE API
 * ─────────────────────────────────────────────────────────────────────────────
 * Este archivo centraliza todas las llamadas al backend.
 * El frontend nunca debe llamar directamente a URLs de datos privados.
 *
 * MODO ACTUAL: 'demo'   ← Usar mock-data.js para pruebas sin backend
 * MODO PRODUCCIÓN: 'production'  ← Apunta a tu endpoint real
 *
 * Para cambiar a producción:
 *   1. Cambia API_CONFIG.mode a 'production'
 *   2. Cambia API_CONFIG.baseUrl a tu endpoint real
 *   3. Implementa el backend correspondiente
 *
 * BACKENDS SOPORTADOS (implementación pendiente):
 *   - Google Apps Script:  https://script.google.com/macros/s/YOUR_ID/exec
 *   - Firebase Functions:  https://us-central1-YOUR_PROJECT.cloudfunctions.net/api
 *   - Supabase:            https://YOUR_PROJECT.supabase.co/rest/v1/
 *   - Custom REST API:     https://api.tudominio.com/v1/
 *
 * SEGURIDAD:
 *   - El token de sesión viaja en el header Authorization, nunca en la URL
 *   - El backend valida el token y los permisos por recurso
 *   - Las URLs de documentos son generadas por el servidor con expiración
 *   - El frontend nunca almacena claves de API ni secrets
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ─── CONFIGURACIÓN ───────────────────────────────────────────────────────────

const API_CONFIG = {
  // 'demo' → usa datos de mock-data.js sin llamar a ningún servidor
  // 'production' → llama a baseUrl con autenticación real
  mode: 'demo',

  // TODO(producción): reemplaza con tu URL de backend
  baseUrl: 'https://api.tudominio.com/v1',

  // Tiempo de espera para requests (ms)
  timeout: 10000,

  // Simula latencia de red en modo demo (ms) — poner 0 para desactivar
  mockDelay: 600,
};

// ─── GESTOR DE SESIÓN ────────────────────────────────────────────────────────
// IMPORTANTE: Solo se guarda un indicador de sesión en sessionStorage.
// El token real (httpOnly cookie) lo gestiona el servidor.
// sessionStorage se limpia al cerrar la pestaña — más seguro que localStorage.

const Session = {
  _key: 'ea_session',

  save(data) {
    // Guardamos solo lo necesario para la UI — NUNCA el token crudo
    const safe = {
      userId: data.userId,
      name: data.name,
      company: data.company,
      role: data.role,
      // El token REAL debe ir en cookie httpOnly — aquí solo indicamos que hay sesión
      // En Google Apps Script / Firebase el token puede ir aquí en demo,
      // pero en producción usa cookies httpOnly configuradas por el servidor
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

// ─── UTILIDADES INTERNAS ──────────────────────────────────────────────────────

function mockDelay() {
  return new Promise(resolve => setTimeout(resolve, API_CONFIG.mockDelay));
}

/**
 * Realiza un request autenticado al backend real.
 * Incluye el token en el header Authorization.
 *
 * TODO(producción): esta función debe enviar las credenciales de la forma
 * que tu backend espere (Bearer token, session cookie, API key, etc.)
 */
async function _authenticatedFetch(path, options = {}) {
  const url = `${API_CONFIG.baseUrl}${path}`;

  // En producción, si usas cookie httpOnly, el navegador la envía automáticamente
  // con credentials: 'include'. Si usas Bearer token, agrégalo aquí.
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    // 'Authorization': `Bearer ${tuTokenAquí}`, // solo si NO usas httpOnly cookie
    ...options.headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // envía cookies httpOnly automáticamente
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Error de red' }));
      throw new ApiError(err.message || `HTTP ${res.status}`, res.status);
    }

    return res.json();
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new ApiError('Tiempo de espera agotado', 408);
    throw e;
  }
}

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
   * Inicia sesión.
   * DEMO: valida contra mock-data.js
   * PRODUCCIÓN: POST a /auth/login — el servidor valida y devuelve session/cookie
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{userId, name, company, role}>}
   */
  async login(email, password) {
    if (API_CONFIG.mode === 'demo') {
      await mockDelay();
      const user = MOCK_USERS.find(
        u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
      );
      if (!user) throw new ApiError('Credenciales incorrectas. Verifica tu correo y contraseña.', 401);
      const sessionData = { userId: user.id, name: user.name, company: user.company, role: user.role };
      Session.save(sessionData);
      return sessionData;
    }

    // ── PRODUCCIÓN ──────────────────────────────────────────────────────────
    // TODO: el servidor debe:
    //   1. Validar email + password con hash (bcrypt / Argon2)
    //   2. Emitir un JWT o session token
    //   3. Retornarlo como httpOnly cookie O en el body (según arquitectura)
    //   4. Nunca devolver datos sensibles innecesarios
    const data = await _authenticatedFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    Session.save(data.user);
    return data.user;
  },

  /**
   * Cierra la sesión activa.
   */
  async logout() {
    Session.clear();
    if (API_CONFIG.mode === 'production') {
      // TODO: POST /auth/logout para invalidar el token en el servidor
      await _authenticatedFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    }
  },

  /** Retorna los datos de la sesión actual o null si no hay sesión. */
  getCurrentSession() {
    return Session.load();
  },
};

// ─── MÓDULO: DATOS DEL CLIENTE ────────────────────────────────────────────────

const ClientAPI = {
  /**
   * Devuelve el perfil del cliente autenticado.
   */
  async getProfile() {
    if (API_CONFIG.mode === 'demo') {
      await mockDelay();
      const session = Session.load();
      const user = MOCK_USERS.find(u => u.id === session?.userId);
      if (!user) throw new ApiError('Sesión no válida', 401);
      return { id: user.id, name: user.name, company: user.company, role: user.role, rfc: user.rfc, phone: user.phone };
    }
    // TODO: GET /client/profile
    return _authenticatedFetch('/client/profile');
  },

  /**
   * Devuelve las órdenes de trabajo del cliente autenticado.
   * El backend filtra por cliente y rol — el frontend no filtra por permisos.
   */
  async getOrders() {
    if (API_CONFIG.mode === 'demo') {
      await mockDelay();
      return [...MOCK_ORDERS];
    }
    // TODO: GET /client/orders
    return _authenticatedFetch('/client/orders');
  },

  /**
   * Devuelve los documentos a los que el cliente tiene acceso.
   * Los documentos bloqueados se incluyen pero sin URL — el servidor decide.
   */
  async getDocuments() {
    if (API_CONFIG.mode === 'demo') {
      await mockDelay();
      return [...MOCK_DOCUMENTS];
    }
    // TODO: GET /client/documents
    return _authenticatedFetch('/client/documents');
  },

  /**
   * Solicita una URL firmada y temporal para descargar un documento.
   * NUNCA almacenes esta URL — expira en minutos.
   *
   * @param {string} accessKey - Identificador opaco del documento
   * @returns {Promise<{url: string, expiresIn: number}>}
   */
  async getDocumentUrl(accessKey) {
    if (API_CONFIG.mode === 'demo') {
      await mockDelay();
      // En demo, simulamos que el servidor autoriza el acceso
      // En producción, el servidor genera una URL firmada de Google Drive / Firebase Storage / S3
      return { url: '#demo-url-no-funcional', expiresIn: 300, demo: true };
    }
    // TODO: POST /documents/signed-url
    // El servidor valida que el usuario tenga permiso sobre ese accessKey
    // y devuelve una URL temporal (ej. Google Drive export link con token, o signed S3 URL)
    return _authenticatedFetch('/documents/signed-url', {
      method: 'POST',
      body: JSON.stringify({ accessKey }),
    });
  },

  /**
   * Devuelve las fechas importantes del cliente.
   */
  async getUpcomingDates() {
    if (API_CONFIG.mode === 'demo') {
      await mockDelay();
      return [...MOCK_UPCOMING_DATES];
    }
    // TODO: GET /client/dates
    return _authenticatedFetch('/client/dates');
  },
};

// ─── EXPORTAR (para entornos con módulos ES6) ─────────────────────────────────
// Si tu bundler soporta modules, descomenta:
// export { AuthAPI, ClientAPI, Session, ApiError, API_CONFIG };
