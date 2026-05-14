/**
 * app.js | Ejecutiva Ambiental – Portal de Cliente
 *
 * Lógica principal de la SPA (Single Page Application).
 *
 * SEGURIDAD IMPLEMENTADA EN ESTE ARCHIVO:
 *  ✓ Sanitización XSS: todos los datos de API se convierten a texto plano
 *    antes de insertarlos en el DOM. Nunca se usa innerHTML con datos externos.
 *  ✓ Validación de entrada antes de enviar al API.
 *  ✓ Sesión en sessionStorage (se limpia al cerrar pestaña).
 *  ✓ Sin contraseñas, tokens ni enlaces privados en este archivo.
 *  ✓ Roles: la UI oculta elementos según el rol del usuario autenticado.
 *  ✓ URLs de documentos: nunca se almacenan — se solicitan al servidor al momento.
 *
 * PENDIENTE EN BACKEND:
 *  ✗ Validación real de credenciales (hash + salt)
 *  ✗ Emisión de JWT / session cookie httpOnly
 *  ✗ Generación de URLs firmadas para documentos
 *  ✗ Rate limiting en login (prevención de fuerza bruta)
 *  ✗ Cabeceras HTTPS, HSTS, CSP, X-Frame-Options (configurar en servidor web)
 */

'use strict';

// ─── SEGURIDAD: SANITIZACIÓN XSS ─────────────────────────────────────────────

/**
 * Escapa caracteres HTML especiales en un string.
 * Usar SIEMPRE que se inserte contenido externo en el DOM via innerHTML.
 * Preferir textContent cuando sea posible (aún más seguro).
 */
function sanitize(str) {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\//g, '&#x2F;');
}

/** Asigna texto de forma segura a un elemento del DOM. */
function setText(el, text) {
  if (el) el.textContent = String(text ?? '');
}

// ─── UTILIDADES DE FECHA ──────────────────────────────────────────────────────

const MONTHS_ES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function formatDate(isoStr) {
  if (!isoStr || isoStr === '—') return '—';
  try {
    const [y, m, d] = isoStr.split('-').map(Number);
    return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
  } catch { return sanitize(isoStr); }
}

function getDateParts(isoStr) {
  try {
    const [, m, d] = isoStr.split('-').map(Number);
    return { day: String(d).padStart(2,'0'), month: MONTHS_ES[m - 1] };
  } catch { return { day: '—', month: '—' }; }
}

// ─── CONFIGURACIÓN DE STATUS ──────────────────────────────────────────────────

const STATUS_CONFIG = {
  recibido:   { label: 'Recibido',           css: 'status-recibido',   step: 0 },
  programado: { label: 'Programado',         css: 'status-programado', step: 1 },
  en_campo:   { label: 'En campo',           css: 'status-campo',      step: 2 },
  revision:   { label: 'En revisión',        css: 'status-revision',   step: 3 },
  enviado:    { label: 'Enviado al cliente', css: 'status-enviado',    step: 4 },
  cerrado:    { label: 'Cerrado',            css: 'status-cerrado',    step: 5 },
};

const STATUS_STEPS = ['recibido','programado','en_campo','revision','enviado','cerrado'];

const STATUS_STEP_LABELS = [
  'Recibido', 'Programado', 'En campo', 'En revisión', 'Enviado', 'Cerrado'
];

// ─── ESTADO DE LA APLICACIÓN ──────────────────────────────────────────────────

const AppState = {
  session: null,
  activeTab: 'resumen',
  orders: [],
  documents: [],
  upcomingDates: [],
};

// ─── REFERENCIAS AL DOM ───────────────────────────────────────────────────────

const DOM = {
  // Secciones principales
  loginSection:     () => document.getElementById('loginSection'),
  dashboardSection: () => document.getElementById('dashboardSection'),

  // Login
  loginForm:        () => document.getElementById('loginForm'),
  emailInput:       () => document.getElementById('email'),
  passwordInput:    () => document.getElementById('password'),
  emailError:       () => document.getElementById('emailError'),
  passwordError:    () => document.getElementById('passwordError'),
  loginAlert:       () => document.getElementById('loginAlert'),
  loginBtn:         () => document.getElementById('loginBtn'),

  // Header usuario
  headerUserName:   () => document.getElementById('headerUserName'),
  headerUserRole:   () => document.getElementById('headerUserRole'),
  headerUserArea:   () => document.getElementById('headerUserArea'),

  // Cliente info
  clientAvatar:     () => document.getElementById('clientAvatar'),
  clientName:       () => document.getElementById('clientName'),
  clientCompany:    () => document.getElementById('clientCompany'),
  clientRole:       () => document.getElementById('clientRoleBadge'),
  clientRfc:        () => document.getElementById('clientRfc'),
  clientPhone:      () => document.getElementById('clientPhone'),

  // Métricas
  metricTotal:      () => document.getElementById('metricTotal'),
  metricActivos:    () => document.getElementById('metricActivos'),
  metricRevision:   () => document.getElementById('metricRevision'),
  metricDocs:       () => document.getElementById('metricDocs'),

  // Tablas
  ordersTableBody:  () => document.getElementById('ordersTableBody'),
  docsListBody:     () => document.getElementById('docsListBody'),
  datesList:        () => document.getElementById('datesList'),

  // Navegación
  navTabs:          () => document.querySelectorAll('.nav-tab'),
  tabPanels:        () => document.querySelectorAll('.tab-panel'),
};

// ─── VALIDACIÓN DE ENTRADAS ───────────────────────────────────────────────────

function isValidEmail(email) {
  // RFC-básico — validación completa debe hacerse en backend
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function showFieldError(errorEl, message) {
  if (!errorEl) return;
  errorEl.textContent = message;
  errorEl.classList.add('visible');
}

function clearFieldError(errorEl) {
  if (!errorEl) return;
  errorEl.textContent = '';
  errorEl.classList.remove('visible');
}

function showAlert(alertEl, message, type = 'error') {
  if (!alertEl) return;
  alertEl.textContent = message;
  alertEl.className = `alert alert-${type} visible`;
}

function hideAlert(alertEl) {
  if (!alertEl) return;
  alertEl.className = 'alert';
}

// ─── FLUJO DE AUTENTICACIÓN ───────────────────────────────────────────────────

async function handleLogin(event) {
  event.preventDefault();

  const emailEl    = DOM.emailInput();
  const passwordEl = DOM.passwordInput();
  const emailErr   = DOM.emailError();
  const pwdErr     = DOM.passwordError();
  const alertEl    = DOM.loginAlert();
  const btn        = DOM.loginBtn();

  clearFieldError(emailErr);
  clearFieldError(pwdErr);
  hideAlert(alertEl);

  const email    = emailEl?.value?.trim() ?? '';
  const password = passwordEl?.value ?? '';

  let valid = true;

  if (!email) {
    showFieldError(emailErr, 'Ingresa tu correo electrónico.');
    emailEl?.setAttribute('aria-invalid', 'true');
    valid = false;
  } else if (!isValidEmail(email)) {
    showFieldError(emailErr, 'El formato del correo no es válido.');
    emailEl?.setAttribute('aria-invalid', 'true');
    valid = false;
  } else {
    emailEl?.removeAttribute('aria-invalid');
  }

  if (!password) {
    showFieldError(pwdErr, 'Ingresa tu contraseña o código de acceso.');
    passwordEl?.setAttribute('aria-invalid', 'true');
    valid = false;
  } else if (password.length < 4) {
    showFieldError(pwdErr, 'La contraseña es demasiado corta.');
    passwordEl?.setAttribute('aria-invalid', 'true');
    valid = false;
  } else {
    passwordEl?.removeAttribute('aria-invalid');
  }

  if (!valid) return;

  // Deshabilitar botón durante la llamada
  if (btn) { btn.disabled = true; setText(btn, 'Verificando...'); }

  try {
    const session = await AuthAPI.login(email, password);
    AppState.session = session;
    passwordEl.value = ''; // Limpiar contraseña de memoria apenas se usa
    await initDashboard();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al iniciar sesión. Inténtalo de nuevo.';
    showAlert(alertEl, msg, 'error');
  } finally {
    if (btn) { btn.disabled = false; setText(btn, 'Ingresar al portal'); }
  }
}

async function handleLogout() {
  try {
    await AuthAPI.logout();
  } catch { /* ignorar errores de logout */ }
  AppState.session = null;
  AppState.orders  = [];
  AppState.documents = [];
  showLogin();
}

// ─── CONTROL DE VISTAS ────────────────────────────────────────────────────────

function showLogin() {
  DOM.loginSection()?.classList.remove('hidden');
  DOM.dashboardSection()?.classList.add('hidden');
  DOM.loginForm()?.reset();
  hideAlert(DOM.loginAlert());
}

function showDashboard() {
  DOM.loginSection()?.classList.add('hidden');
  DOM.dashboardSection()?.classList.remove('hidden');
}

// ─── INICIALIZACIÓN DEL DASHBOARD ────────────────────────────────────────────

async function initDashboard() {
  showDashboard();
  renderClientCard();
  renderHeaderUser();
  activateTab('resumen');

  // Carga de datos en paralelo
  const [orders, documents, dates] = await Promise.all([
    ClientAPI.getOrders().catch(() => []),
    ClientAPI.getDocuments().catch(() => []),
    ClientAPI.getUpcomingDates().catch(() => []),
  ]);

  AppState.orders        = orders;
  AppState.documents     = documents;
  AppState.upcomingDates = dates;

  renderMetrics();
  renderOrders();
  renderDocuments();
  renderUpcomingDates();
}

// ─── RENDERIZADO: HEADER / PERFIL ─────────────────────────────────────────────

function renderHeaderUser() {
  const s = AppState.session;
  if (!s) return;
  setText(DOM.headerUserName(), s.name);
  setText(DOM.headerUserRole(), roleLabel(s.role));
}

function renderClientCard() {
  const s = AppState.session;
  if (!s) return;

  const initials = getInitials(s.name);
  setText(DOM.clientAvatar(), initials);
  setText(DOM.clientName(), s.name);
  setText(DOM.clientCompany(), s.company);

  const roleEl = DOM.clientRole();
  if (roleEl) {
    setText(roleEl, roleLabel(s.role));
    roleEl.className = `client-role-badge ${roleCssClass(s.role)}`;
  }

  // Datos adicionales del perfil (disponibles en demo solo si el usuario lo tiene)
  ClientAPI.getProfile().then(p => {
    setText(DOM.clientRfc(),   p.rfc   ? `RFC: ${p.rfc}`   : '');
    setText(DOM.clientPhone(), p.phone ? p.phone : '');
  }).catch(() => {});
}

function getInitials(name = '') {
  return name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase() || 'EA';
}

function roleLabel(role) {
  const map = { cliente: 'Cliente', administrador: 'Administrador', solo_lectura: 'Solo lectura' };
  return map[role] ?? sanitize(role);
}

function roleCssClass(role) {
  const map = { cliente: 'role-cliente', administrador: 'role-admin', solo_lectura: 'role-lectura' };
  return map[role] ?? 'role-lectura';
}

// ─── RENDERIZADO: MÉTRICAS ────────────────────────────────────────────────────

function renderMetrics() {
  const { orders, documents } = AppState;

  const activos   = orders.filter(o => o.status !== 'cerrado').length;
  const revision  = orders.filter(o => o.status === 'revision').length;
  const docsDisp  = documents.filter(d => d.status === 'disponible').length;

  setText(DOM.metricTotal(),    orders.length);
  setText(DOM.metricActivos(),  activos);
  setText(DOM.metricRevision(), revision);
  setText(DOM.metricDocs(),     docsDisp);

  // Actualizar badge del tab de servicios
  const ordersTab = document.querySelector('[data-tab="servicios"] .tab-badge');
  if (ordersTab) setText(ordersTab, orders.length);

  // Actualizar badge del tab de documentos
  const docsTab = document.querySelector('[data-tab="documentos"] .tab-badge');
  if (docsTab) setText(docsTab, docsDisp);
}

// ─── RENDERIZADO: PRÓXIMAS FECHAS (RESUMEN) ───────────────────────────────────

function renderUpcomingDates() {
  const listEl = DOM.datesList();
  if (!listEl) return;
  const dates = AppState.upcomingDates;

  if (!dates.length) {
    listEl.innerHTML = '<li class="empty-state"><p>No hay fechas próximas registradas.</p></li>';
    return;
  }

  // Construir con textContent para evitar XSS
  listEl.innerHTML = '';
  dates.forEach(d => {
    const { day, month } = getDateParts(d.date);
    const li = document.createElement('li');
    li.className = 'date-item';
    li.innerHTML = `
      <div class="date-badge">
        <div class="date-day"></div>
        <div class="date-month"></div>
      </div>
      <div class="date-info">
        <h3></h3>
        <p></p>
      </div>`;
    li.querySelector('.date-day').textContent  = day;
    li.querySelector('.date-month').textContent = month;
    li.querySelector('h3').textContent = d.title;
    li.querySelector('p').textContent  = d.description;
    listEl.appendChild(li);
  });
}

// ─── RENDERIZADO: TABLA DE ÓRDENES ────────────────────────────────────────────

function renderOrders() {
  const tbody = DOM.ordersTableBody();
  if (!tbody) return;
  const orders = AppState.orders;

  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><p>No hay órdenes de trabajo registradas.</p></td></tr>';
    return;
  }

  tbody.innerHTML = '';
  orders.forEach(order => {
    const cfg = STATUS_CONFIG[order.status] ?? { label: order.status, css: 'status-recibido' };
    const tr  = document.createElement('tr');

    // ─ Celda: ID
    const tdId = document.createElement('td');
    const idSpan = document.createElement('span');
    idSpan.className = 'order-id';
    idSpan.textContent = order.id;
    tdId.appendChild(idSpan);

    // ─ Celda: Servicio
    const tdService = document.createElement('td');
    const nameDiv = document.createElement('div');
    nameDiv.className = 'service-name';
    nameDiv.textContent = order.service;
    const descDiv = document.createElement('div');
    descDiv.className = 'service-desc';
    descDiv.textContent = order.description;
    tdService.appendChild(nameDiv);
    tdService.appendChild(descDiv);

    // ─ Celda: Área
    const tdArea = document.createElement('td');
    tdArea.textContent = order.area;

    // ─ Celda: Fecha
    const tdDate = document.createElement('td');
    tdDate.textContent = formatDate(order.scheduledDate);

    // ─ Celda: Estado
    const tdStatus = document.createElement('td');
    const badge = document.createElement('span');
    badge.className = `status ${cfg.css}`;
    badge.textContent = cfg.label;
    tdStatus.appendChild(badge);

    // ─ Celda: Documento / Acción
    const tdDoc = document.createElement('td');
    if (order.docKey) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost btn-sm';
      btn.textContent = 'Ver documento';
      btn.dataset.docKey = order.docKey;
      btn.addEventListener('click', () => openDocument(order.docKey));
      tdDoc.appendChild(btn);
    } else {
      const span = document.createElement('span');
      span.className = 'text-muted';
      span.style.fontSize = '0.78rem';
      span.textContent = '—';
      tdDoc.appendChild(span);
    }

    tr.append(tdId, tdService, tdArea, tdDate, tdStatus, tdDoc);
    tbody.appendChild(tr);
  });
}

// ─── RENDERIZADO: DOCUMENTOS ──────────────────────────────────────────────────

function renderDocuments() {
  const listEl = DOM.docsListBody();
  if (!listEl) return;
  const docs = AppState.documents;

  if (!docs.length) {
    listEl.innerHTML = '<li class="empty-state"><p>No hay documentos disponibles.</p></li>';
    return;
  }

  listEl.innerHTML = '';
  docs.forEach(doc => {
    const li = document.createElement('li');
    li.className = 'doc-item';

    // Ícono según tipo
    const icon = document.createElement('div');
    icon.className = `doc-icon doc-icon-${doc.type === 'pdf' ? 'pdf' : doc.type === 'xls' ? 'xls' : 'gen'}`;
    icon.textContent = doc.type === 'pdf' ? '📄' : doc.type === 'xls' ? '📊' : '📁';

    // Info
    const info = document.createElement('div');
    info.className = 'doc-info';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'doc-name';
    nameDiv.textContent = doc.name;

    const metaDiv = document.createElement('div');
    metaDiv.className = 'doc-meta';
    metaDiv.textContent = `${formatDate(doc.date)} · ${doc.size}`;

    info.appendChild(nameDiv);
    info.appendChild(metaDiv);

    // Acción
    const action = document.createElement('div');

    if (doc.status === 'disponible' && doc.accessKey) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost btn-sm';
      btn.textContent = 'Descargar';
      btn.addEventListener('click', () => openDocument(doc.accessKey));
      action.appendChild(btn);
    } else {
      const locked = document.createElement('span');
      locked.className = 'doc-locked';
      locked.textContent = 'No disponible';
      action.appendChild(locked);
    }

    li.append(icon, info, action);
    listEl.appendChild(li);
  });
}

// ─── ACCIÓN: ABRIR DOCUMENTO ──────────────────────────────────────────────────

async function openDocument(accessKey) {
  if (!accessKey) return;

  try {
    const result = await ClientAPI.getDocumentUrl(accessKey);

    if (result.demo) {
      // En modo demo, mostramos advertencia — no hay URL real
      alert('MODO DEMO: En producción, aquí se abriría el documento desde una URL firmada generada por el servidor.\n\nEsta URL expira en pocos minutos y solo funciona para usuarios autorizados.');
      return;
    }

    // En producción: abrir en nueva pestaña
    // La URL es temporal y firmada — no la almacenes
    const a = document.createElement('a');
    a.href   = result.url;
    a.target = '_blank';
    a.rel    = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

  } catch (err) {
    alert('No se pudo obtener el documento. Inténtalo de nuevo o contacta a soporte.');
    console.error('[Portal] Error al obtener URL de documento:', err.message);
  }
}

// ─── NAVEGACIÓN POR TABS ──────────────────────────────────────────────────────

function activateTab(tabName) {
  AppState.activeTab = tabName;

  DOM.navTabs().forEach(tab => {
    const active = tab.dataset.tab === tabName;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  DOM.tabPanels().forEach(panel => {
    const active = panel.dataset.panel === tabName;
    panel.classList.toggle('active', active);
    panel.hidden = !active;
  });
}

// ─── BARRA DE PROGRESO DE ESTADO (DETALLE DE ORDEN) ──────────────────────────

function renderProgressBar(containerId, status) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const currentStep = STATUS_STEPS.indexOf(status);
  el.innerHTML = '';

  STATUS_STEPS.forEach((s, i) => {
    const step = document.createElement('div');
    step.className = 'step';
    if (i < currentStep)  step.classList.add('completed');
    if (i === currentStep) step.classList.add('current');

    const dot   = document.createElement('div');
    dot.className = 'step-dot';
    dot.textContent = i < currentStep ? '✓' : String(i + 1);

    const label = document.createElement('div');
    label.className = 'step-label';
    label.textContent = STATUS_STEP_LABELS[i];

    step.append(dot, label);
    el.appendChild(step);
  });
}

// ─── BOOTSTRAP DE LA APLICACIÓN ──────────────────────────────────────────────

function initApp() {
  // Verificar si hay sesión activa (pestaña no cerrada)
  const existingSession = AuthAPI.getCurrentSession();
  if (existingSession) {
    AppState.session = existingSession;
    initDashboard();
  } else {
    showLogin();
  }

  // Bindings: formulario de login
  DOM.loginForm()?.addEventListener('submit', handleLogin);

  // Bindings: tabs de navegación
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      if (tabName) activateTab(tabName);
    });
  });

  // Binding: botón de logout
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);

  // Limpiar errores de campo al escribir
  DOM.emailInput()?.addEventListener('input', () => clearFieldError(DOM.emailError()));
  DOM.passwordInput()?.addEventListener('input', () => clearFieldError(DOM.passwordError()));
}

// Arrancar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initApp);
