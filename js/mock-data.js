/**
 * ⚠️  ARCHIVO DE SOLO DESARROLLO — NO USAR EN PRODUCCIÓN ⚠️
 *
 * mock-data.js | Ejecutiva Ambiental – Portal de Cliente
 *
 * Este archivo contiene datos ficticios para pruebas en frontend.
 * En producción, todos estos datos deben venir del backend seguro
 * (Google Apps Script, Firebase, Supabase u otro).
 *
 * NUNCA:
 *  - Incluir contraseñas reales
 *  - Incluir tokens de API reales
 *  - Incluir URLs privadas de Google Drive / S3 / Firebase Storage
 *  - Incluir datos personales reales de clientes
 *
 * REEMPLAZAR CON:
 *  - Llamadas autenticadas a tu backend (ver api.js)
 *  - URLs firmadas temporales generadas por el servidor
 *  - Datos filtrados por el rol y permisos del usuario autenticado
 */

'use strict';

/* eslint-disable no-unused-vars */

// ─────────────────────────────────────────────
//  CREDENCIALES DEMO (solo desarrollo)
//  En producción, la validación ocurre en el backend.
//  El frontend NUNCA debe contener credenciales reales.
// ─────────────────────────────────────────────
const MOCK_USERS = [
  {
    id: 'USR-001',
    email: 'demo@empresa.com',
    // ⚠️ Contraseña de demo pública — el backend real la valida con hash
    password: 'demo2026',
    name: 'Carlos Mendoza',
    company: 'Industrias Demo S.A. de C.V.',
    role: 'cliente',          // 'cliente' | 'administrador' | 'solo_lectura'
    rfc: 'IDM040101XXX',
    phone: '+52 222 555 0100',
  },
  {
    id: 'USR-002',
    email: 'admin@ejecutivambiental.com',
    password: 'admin2026',
    name: 'Administrador',
    company: 'Ejecutiva Ambiental',
    role: 'administrador',
    rfc: '',
    phone: '',
  },
];

// ─────────────────────────────────────────────
//  ÓRDENES DE TRABAJO DEMO
//  Cubre los 6 estados del ciclo de servicio
// ─────────────────────────────────────────────
const MOCK_ORDERS = [
  {
    id: 'OT-2026-001',
    service: 'NOM-025-STPS',
    description: 'Medición de niveles de iluminación',
    area: 'Planta de producción – Nave A',
    scheduledDate: '2026-05-15',
    status: 'recibido',
    assignedTo: 'Ing. Ramírez',
    notes: 'Pendiente de asignación de fecha exacta.',
    docKey: null,
  },
  {
    id: 'OT-2026-002',
    service: 'NOM-011-STPS',
    description: 'Evaluación de ruido en área de compresores',
    area: 'Sala de compresores',
    scheduledDate: '2026-05-18',
    status: 'programado',
    assignedTo: 'Ing. Torres',
    notes: 'Confirmar acceso con seguridad 24 hrs antes.',
    docKey: null,
  },
  {
    id: 'OT-2026-003',
    service: 'NOM-020-STPS',
    description: 'Inspección de recipientes sujetos a presión',
    area: 'Cuarto de máquinas',
    scheduledDate: '2026-05-22',
    status: 'en_campo',
    assignedTo: 'Ing. López',
    notes: 'Trabajo iniciado. Estimado de finalización: 2 días.',
    docKey: null,
  },
  {
    id: 'OT-2026-004',
    service: 'NOM-002-STPS',
    description: 'Condiciones de seguridad – prevención y protección contra incendios',
    area: 'Almacén general',
    scheduledDate: '2026-05-10',
    status: 'revision',
    assignedTo: 'Ing. García',
    notes: 'Informe preliminar en revisión interna.',
    docKey: 'DOC-2026-004-PREV',
  },
  {
    id: 'OT-2026-005',
    service: 'NOM-035-STPS',
    description: 'Factores de riesgo psicosocial en el trabajo',
    area: 'Oficinas administrativas',
    scheduledDate: '2026-04-28',
    status: 'enviado',
    assignedTo: 'Lic. Hernández',
    notes: 'Informe enviado el 05/05/2026. Esperando acuse de recibo.',
    docKey: 'DOC-2026-005-FINAL',
  },
  {
    id: 'OT-2026-006',
    service: 'NOM-030-STPS',
    description: 'Servicios preventivos de seguridad y salud en el trabajo',
    area: 'Toda la planta',
    scheduledDate: '2026-04-10',
    status: 'cerrado',
    assignedTo: 'Ing. Ramírez',
    notes: 'Servicio completado y aceptado por el cliente.',
    docKey: 'DOC-2026-006-CERT',
  },
];

// ─────────────────────────────────────────────
//  DOCUMENTOS DISPONIBLES DEMO
//
//  IMPORTANTE DE SEGURIDAD:
//  Las URLs reales de documentos NUNCA deben estar en el frontend.
//  El backend genera URLs firmadas temporales bajo demanda,
//  verificando que el usuario autenticado tenga permiso.
//
//  'accessKey' es un identificador opaco que el backend resuelve.
//  El frontend solo sabe el nombre — la URL la entrega el servidor.
// ─────────────────────────────────────────────
const MOCK_DOCUMENTS = [
  {
    id: 'DOC-001',
    name: 'Informe NOM-002-STPS – Preliminar',
    type: 'pdf',
    size: '1.8 MB',
    date: '2026-05-09',
    status: 'disponible',
    orderId: 'OT-2026-004',
    accessKey: 'DOC-2026-004-PREV',
    // ⚠️ No incluir URL real aquí. El backend la genera con tiempo de expiración.
  },
  {
    id: 'DOC-002',
    name: 'Informe NOM-035-STPS – Versión Final',
    type: 'pdf',
    size: '3.2 MB',
    date: '2026-05-05',
    status: 'disponible',
    orderId: 'OT-2026-005',
    accessKey: 'DOC-2026-005-FINAL',
  },
  {
    id: 'DOC-003',
    name: 'Certificado NOM-030-STPS',
    type: 'pdf',
    size: '0.6 MB',
    date: '2026-04-25',
    status: 'disponible',
    orderId: 'OT-2026-006',
    accessKey: 'DOC-2026-006-CERT',
  },
  {
    id: 'DOC-004',
    name: 'Programa de trabajo 2026',
    type: 'xls',
    size: '210 KB',
    date: '2026-01-15',
    status: 'disponible',
    orderId: null,
    accessKey: 'DOC-PLAN-2026',
  },
  {
    id: 'DOC-005',
    name: 'Informe NOM-011-STPS – Pendiente',
    type: 'pdf',
    size: '—',
    date: '—',
    status: 'no_disponible',
    orderId: 'OT-2026-002',
    accessKey: null,
  },
];

// ─────────────────────────────────────────────
//  FECHAS IMPORTANTES DEMO
// ─────────────────────────────────────────────
const MOCK_UPCOMING_DATES = [
  {
    date: '2026-05-15',
    title: 'Visita técnica – NOM-025-STPS',
    description: 'Medición de iluminación – Nave A',
    orderId: 'OT-2026-001',
  },
  {
    date: '2026-05-18',
    title: 'Visita técnica – NOM-011-STPS',
    description: 'Evaluación de ruido – Compresores',
    orderId: 'OT-2026-002',
  },
  {
    date: '2026-05-22',
    title: 'Visita técnica – NOM-020-STPS',
    description: 'Inspección de recipientes – Cuarto de máquinas',
    orderId: 'OT-2026-003',
  },
  {
    date: '2026-06-30',
    title: 'Renovación de contrato anual',
    description: 'Vencimiento del contrato de servicios 2026',
    orderId: null,
  },
];

// ─────────────────────────────────────────────
//  INFORMACIÓN DE CONTACTO INSTITUCIONAL
//  (estos datos son públicos — no son datos sensibles)
// ─────────────────────────────────────────────
const CONTACT_INFO = {
  email:     'aclientes@ejecutivambiental.com',
  whatsapp:  '2229417295',
  phone:     '222 941 7295',
  whatsappLabel: '222 941 7295',
  hours:     'Lunes a viernes · 9:00 – 18:00 h',
  website:   'ejecutivambiental.com',
};
