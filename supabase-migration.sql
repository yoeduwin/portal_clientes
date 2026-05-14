-- ═══════════════════════════════════════════════════════════════════════
--  MIGRACIÓN COMPLETA — Portal de Cliente | Ejecutiva Ambiental
--
--  INSTRUCCIONES:
--  1. Ve a tu proyecto en supabase.com
--  2. Haz clic en "SQL Editor" en el menú izquierdo
--  3. Haz clic en "New Query"
--  4. Copia TODO este texto y pégalo ahí
--  5. Haz clic en "Run" (o presiona Ctrl+Enter)
--  6. Deberías ver "Success" al final
--
--  Solo necesitas hacer esto UNA VEZ cuando configures el proyecto.
-- ═══════════════════════════════════════════════════════════════════════


-- ── 1. TABLA: profiles ──────────────────────────────────────────────────
-- Guarda el nombre, empresa y rol de cada cliente.
-- Se conecta automáticamente con el sistema de login de Supabase.
-- Cuando creas un usuario en Authentication → Users, Supabase agrega
-- una fila aquí automáticamente (gracias al trigger al final de este script).
-- Tú solo necesitas editar la fila para poner el nombre y empresa del cliente.

CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL DEFAULT '',
  company    TEXT NOT NULL DEFAULT '',
  role       TEXT NOT NULL DEFAULT 'cliente'
               CHECK (role IN ('cliente', 'administrador', 'solo_lectura')),
  rfc        TEXT,
  phone      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'Perfil de cada cliente del portal';


-- ── 2. TABLA: orders ─────────────────────────────────────────────────────
-- Guarda las órdenes de trabajo de cada cliente.
-- Cada orden tiene un estado que avanza: recibido → programado → en campo
-- → en revisión → enviado al cliente → cerrado.

CREATE TABLE IF NOT EXISTS public.orders (
  id             TEXT PRIMARY KEY,
  client_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service        TEXT NOT NULL DEFAULT '',
  description    TEXT NOT NULL DEFAULT '',
  area           TEXT NOT NULL DEFAULT '',
  scheduled_date DATE,
  status         TEXT NOT NULL DEFAULT 'recibido'
                   CHECK (status IN ('recibido','programado','en_campo','revision','enviado','cerrado')),
  assigned_to    TEXT,
  notes          TEXT,
  doc_key        TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.orders    IS 'Órdenes de trabajo por cliente';
COMMENT ON COLUMN public.orders.doc_key IS 'Clave opaca que conecta la orden con su documento';


-- ── 3. TABLA: documents ──────────────────────────────────────────────────
-- Guarda la información de cada documento (informe, certificado, etc.).
-- IMPORTANTE: la columna storage_path guarda la ruta REAL del archivo
-- dentro de Supabase Storage, pero NUNCA se envía al navegador del cliente.
-- El cliente solo ve el nombre y una clave opaca (access_key).

CREATE TABLE IF NOT EXISTS public.documents (
  id           TEXT PRIMARY KEY,
  client_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id     TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  name         TEXT NOT NULL DEFAULT '',
  type         TEXT NOT NULL DEFAULT 'pdf'
                 CHECK (type IN ('pdf', 'xls')),
  size         TEXT NOT NULL DEFAULT '—',
  date         DATE,
  status       TEXT NOT NULL DEFAULT 'no_disponible'
                 CHECK (status IN ('disponible', 'no_disponible')),
  access_key   TEXT,
  storage_path TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE  public.documents              IS 'Metadatos de documentos por cliente';
COMMENT ON COLUMN public.documents.access_key   IS 'Clave opaca que ve el frontend';
COMMENT ON COLUMN public.documents.storage_path IS 'Ruta real en Storage — nunca se envía al browser';


-- ── 4. TABLA: upcoming_dates ──────────────────────────────────────────────
-- Guarda fechas importantes como visitas técnicas o vencimientos de contrato.

CREATE TABLE IF NOT EXISTS public.upcoming_dates (
  id          BIGSERIAL PRIMARY KEY,
  client_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  order_id    TEXT REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.upcoming_dates IS 'Fechas importantes por cliente';


-- ═══════════════════════════════════════════════════════════════════════
--  SEGURIDAD: ROW LEVEL SECURITY (RLS)
--
--  Esto es la protección más importante. Le dice a la base de datos que
--  cada cliente SOLO puede ver sus propios datos, aunque intente pedir
--  los datos de otro cliente. La base de datos lo rechaza automáticamente.
--
--  Piénsalo así: aunque el portal tuviera un error de programación,
--  la base de datos tiene su propio guardia de seguridad que comprueba
--  "¿este dato pertenece al usuario que está pidiendo?" en cada consulta.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upcoming_dates ENABLE ROW LEVEL SECURITY;

-- Cada cliente puede leer solo su propio perfil
CREATE POLICY "Cliente ve su propio perfil"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Cada cliente puede leer solo sus propias órdenes
CREATE POLICY "Cliente ve sus propias ordenes"
  ON public.orders FOR SELECT
  USING (auth.uid() = client_id);

-- Cada cliente puede leer solo sus propios documentos
CREATE POLICY "Cliente ve sus propios documentos"
  ON public.documents FOR SELECT
  USING (auth.uid() = client_id);

-- Cada cliente puede leer solo sus propias fechas
CREATE POLICY "Cliente ve sus propias fechas"
  ON public.upcoming_dates FOR SELECT
  USING (auth.uid() = client_id);


-- ═══════════════════════════════════════════════════════════════════════
--  VISTA SEGURA: documents_safe
--
--  Esta vista es como una "ventana" a la tabla documents que tiene
--  tapada la columna storage_path (la ruta real del archivo).
--  El portal siempre consulta esta vista, nunca la tabla directamente.
--  Así, aunque algo saliera mal, el cliente nunca podría ver la ruta.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW public.documents_safe AS
  SELECT
    id,
    client_id,
    order_id,
    name,
    type,
    size,
    date,
    status,
    access_key,
    created_at
    -- storage_path está intencionalmente excluida de esta vista
  FROM public.documents;

COMMENT ON VIEW public.documents_safe IS 'Vista de documents sin storage_path — segura para el frontend';


-- ═══════════════════════════════════════════════════════════════════════
--  FUNCIÓN RPC: get_signed_document_url
--
--  Esta función corre en el servidor de Supabase (no en el navegador).
--  Cuando el cliente hace clic en "Descargar", el portal llama a esta
--  función enviando solo el access_key (la clave opaca).
--  La función:
--    1. Verifica que el documento pertenece al cliente autenticado
--    2. Busca el storage_path real (que el cliente nunca ve)
--    3. Devuelve el storage_path solo al JavaScript del portal,
--       que lo usa para generar una URL temporal de descarga
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_signed_document_url(p_access_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_path   TEXT;
  v_client UUID := auth.uid();
BEGIN
  -- Verificar que hay una sesión activa
  IF v_client IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Buscar el storage_path, pero SOLO si el documento pertenece al cliente
  SELECT storage_path INTO v_path
  FROM public.documents
  WHERE access_key = p_access_key
    AND client_id  = v_client
    AND status     = 'disponible'
    AND storage_path IS NOT NULL;

  -- Si no se encontró, el cliente no tiene acceso (o el documento no existe)
  IF v_path IS NULL THEN
    RAISE EXCEPTION 'Documento no encontrado o sin autorización';
  END IF;

  -- Devolver el path para que el JS genere la URL firmada
  RETURN jsonb_build_object('storage_path', v_path);
END;
$$;

COMMENT ON FUNCTION public.get_signed_document_url IS
  'Devuelve el storage_path de un documento verificando que pertenece al usuario autenticado';


-- ═══════════════════════════════════════════════════════════════════════
--  TRIGGER: crear perfil automáticamente
--
--  Cuando creas un usuario en Authentication → Users → Add User,
--  este trigger inserta automáticamente una fila vacía en la tabla profiles.
--  Tú solo tienes que editar esa fila en Table Editor para poner el nombre,
--  empresa y rol del cliente. No necesitas hacerlo manualmente dos veces.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, company, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name',    ''),
    COALESCE(NEW.raw_user_meta_data->>'company', ''),
    'cliente'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

COMMENT ON TRIGGER on_auth_user_created ON auth.users IS
  'Crea automáticamente una fila en profiles cuando se crea un usuario';


-- ═══════════════════════════════════════════════════════════════════════
--  STORAGE: bucket para documentos PDF
--
--  Los archivos PDF/XLS se guardan aquí de forma privada.
--  Las carpetas se organizan por UUID del cliente:
--    documentos/
--      3a7f2c91-xxxx-xxxx-xxxx-xxxxxxxxxxxx/   ← UUID del cliente
--        informe-nom-025.pdf
--        certificado-nom-030.pdf
--
--  Para subir archivos: Supabase → Storage → documentos → carpeta del cliente
--  Luego registra el documento en Table Editor → documents, poniendo en
--  storage_path el valor: uuid-del-cliente/nombre-del-archivo.pdf
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

-- El cliente puede leer archivos de su propia carpeta (identificada por su UUID)
CREATE POLICY "Cliente descarga sus propios archivos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'documentos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Solo el rol de servicio (tú, desde el dashboard de Supabase) puede subir archivos
CREATE POLICY "Solo servicio sube archivos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'documentos'
    AND auth.role() = 'service_role'
  );


-- ═══════════════════════════════════════════════════════════════════════
--  FIN DE LA MIGRACIÓN
--  Si ves "Success" o ningún error en rojo, todo quedó configurado.
--
--  PRÓXIMOS PASOS:
--  1. Ve a Authentication → Users → Add User
--     Crea el correo y contraseña de tu primer cliente.
--  2. Ve a Table Editor → profiles
--     Busca la fila del cliente recién creado y edita:
--     name, company, role (deja 'cliente'), rfc (opcional), phone (opcional)
--  3. Ve a Table Editor → orders
--     Agrega las órdenes de trabajo del cliente.
--     En client_id pon el UUID del cliente (lo ves en Authentication → Users)
--  4. Ve a Storage → documentos
--     Crea una carpeta con el UUID del cliente y sube sus PDFs.
--  5. Ve a Table Editor → documents
--     Registra cada PDF: pon el storage_path como "uuid/nombre-archivo.pdf"
--     y el access_key como un código inventado (ej. "DOC-2026-001")
-- ═══════════════════════════════════════════════════════════════════════
