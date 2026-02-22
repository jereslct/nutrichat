# Flujo de la Aplicación NutriChat

## Visión General

NutriChat es un asistente nutricional con IA que permite a pacientes subir planes de dieta en PDF y chatear con la IA para recibir orientación alimentaria personalizada. Soporta tres roles: **paciente**, **médico** y **super admin**.

---

## 1. Rutas y Accesos

### Rutas públicas
| Ruta | Página | Descripción |
|------|--------|-------------|
| `/` | `Index.tsx` | Landing page con información del producto |
| `/register` | `Register.tsx` | Login y registro (redirige si ya autenticado) |
| `*` | `NotFound.tsx` | Página 404 |

### Rutas protegidas (requieren autenticación)
| Ruta | Página | Acceso |
|------|--------|--------|
| `/upload` | `Upload.tsx` | Todos los autenticados |
| `/chat` | `Chat.tsx` | Todos (requiere dieta subida) |
| `/profile` | `Profile.tsx` | Todos los autenticados |
| `/subscription` | `Subscription.tsx` | Todos los autenticados |
| `/dashboard` | `DoctorDashboard.tsx` | Solo doctores |
| `/admin` | `AdminDashboard.tsx` | Solo super admin |

---

## 2. Flujo de Autenticación

### Registro
1. Usuario accede a `/register`
2. Selecciona rol: **Paciente** o **Médico**
3. Completa formulario (nombre, email, contraseña) validado con Zod
4. Supabase Auth crea el usuario
5. Se asigna rol en tabla `user_roles`

### Login
1. Usuario ingresa credenciales en `/register`
2. Supabase Auth valida y crea sesión JWT
3. Redirección inteligente según rol y estado:
   - **Médico** → `/dashboard`
   - **Paciente con dieta** → `/chat`
   - **Paciente sin dieta** → `/upload`

### Verificación de sesión (patrón en todas las páginas protegidas)
```
useEffect:
  1. Listener con onAuthStateChange() para cambios en tiempo real
  2. Verificar sesión existente con getSession()
  3. Si no hay sesión → redirigir a /register
```

---

## 3. Flujos Principales por Rol

### 3.1 Flujo del Paciente

```
Landing (/)
  └─> Registro (/register) [rol: paciente]
        └─> Subir PDF (/upload)
              └─> Chat con IA (/chat)
                    ├─> Enviar mensajes de texto
                    ├─> Enviar imágenes de comida
                    └─> Alcanzar límite → PremiumModal → Suscripción (/subscription)
```

#### Subida de PDF (`/upload`)
1. Paciente selecciona archivo PDF (máx 6MB)
2. Frontend convierte a base64
3. Llama Edge Function `upload-pdf`
4. La función usa Lovable AI (Gemini) para extraer texto del PDF
5. Guarda en tabla `diets` con el texto extraído en `pdf_text`
6. Paciente es redirigido a `/chat`
7. Si ya tiene dieta: puede verla, eliminarla o subir otra

#### Chat con IA (`/chat`)
1. Paciente escribe mensaje o adjunta imagen
2. Frontend guarda mensaje en `chat_messages` (rol: `user`)
3. Llama Edge Function `chat` con mensaje + `dietId`
4. La función:
   - Autentica JWT del usuario
   - Verifica suscripción y límites de uso
   - Obtiene la dieta (texto del PDF) desde `diets`
   - Obtiene últimos 10 mensajes para contexto
   - Construye prompt con el plan nutricional como contexto
   - Llama a Lovable AI (Gemini 2.5 Flash)
   - Actualiza contadores en `user_usage` y `profiles.chat_count`
5. Frontend guarda respuesta en `chat_messages` (rol: `assistant`)
6. Muestra la respuesta en el chat

#### Análisis de imágenes de comida
1. Paciente toma foto o selecciona imagen desde galería
2. Frontend convierte a base64 y muestra preview
3. Llama Edge Function `analyze-food-image` con imagen + `dietId`
4. La función usa Lovable AI con visión para analizar la comida vs el plan nutricional
5. Retorna análisis detallado
6. Límite: 3 imágenes por día

#### Límites de uso
| Tipo de usuario | Chats totales | Consultas diarias | Imágenes diarias |
|-----------------|---------------|-------------------|------------------|
| Gratuito | 5 | 9 | 3 |
| Premium | Ilimitados | 9 | 3 |

Al alcanzar el límite gratuito se muestra `PremiumModal` con invitación a suscribirse.

### 3.2 Flujo del Médico

```
Landing (/)
  └─> Registro (/register) [rol: doctor]
        └─> Dashboard (/dashboard)
              ├─> Ver pacientes vinculados
              ├─> Ver detalle/resumen de paciente
              ├─> Invitar pacientes (código de invitación)
              ├─> Gestionar solicitudes de vinculación
              └─> Suscripción (/subscription) [para licencias]
```

#### Dashboard del médico (`/dashboard`)
- Muestra estadísticas: pacientes activos, mensajes totales, licencias disponibles
- Lista de pacientes vinculados con paginación
- Búsqueda de pacientes
- Gestión de solicitudes de vinculación pendientes

#### Ver detalle de paciente
1. Médico hace clic en un paciente
2. Se abre `PatientDetailDialog`
3. Llama Edge Function `generate-patient-summary` con `patient_id`
4. La función obtiene últimos 100 mensajes del paciente
5. Usa Lovable AI para generar resumen estructurado (JSON): temas, preocupaciones, patrones, recomendaciones
6. Guarda en tabla `patient_summaries`
7. Médico puede exportar el resumen como PDF (jsPDF)

### 3.3 Flujo del Super Admin

```
Login (admin@nutrichat.com o rol super_admin)
  └─> Panel Admin (/admin)
        ├─> KPIs (usuarios totales, premium, doctores, ingresos)
        ├─> Lista de usuarios con búsqueda y filtros
        └─> Activar/desactivar premium manualmente
```

Usa Edge Function `admin-dashboard` que retorna KPIs calculados y lista de usuarios.

---

## 4. Flujo de Vinculación Doctor-Paciente

Existen dos mecanismos de vinculación:

### 4.1 Por código de invitación (iniciado por médico)
1. Médico crea invitación desde `AllPatientsDialog`
2. Edge Function `create-patient-invitation`:
   - Verifica que el médico tenga licencias disponibles (según plan)
   - Genera código único de 8 caracteres
   - Crea registro en `doctor_patients` con `patient_id: null`
3. Médico comparte código o URL con el paciente
4. Paciente usa el código (durante registro o después)
5. Sistema vincula al paciente actualizando `doctor_patients.patient_id`

### 4.2 Por solicitud directa
1. Paciente busca médico en `DoctorSelector` (desde `/profile`)
2. Envía solicitud → Edge Function `handle-link-request` con `action: "send_request"`
3. Se crea registro en `link_requests` con `status: "pending"`
4. Médico ve notificación en `LinkRequestsNotification` (badge en header)
5. Médico puede:
   - **Aceptar** → se crea relación en `doctor_patients`, status → `accepted`
   - **Rechazar** → status → `rejected`

El flujo también funciona en dirección contraria (médico solicita vincular paciente).

---

## 5. Flujo de Suscripción (MercadoPago)

### Planes disponibles
| Plan | Precio (ARS/mes) | Licencias | Dirigido a |
|------|-------------------|-----------|------------|
| `individual` | $16.999 | 0 | Pacientes |
| `doctor_basic` | $27.999 | 10 | Médicos |
| `doctor_pro` | $43.999 | 25 | Médicos |

### Flujo completo
1. Usuario accede a `/subscription` y selecciona plan
2. Frontend llama Edge Function `create-subscription` con `plan_tier`
3. La función crea un **preapproval** en MercadoPago:
   - `external_reference`: `userId|planTier|licenses` (para identificar en webhook)
   - `auto_recurring`: frecuencia mensual con precio según plan
4. Retorna `init_point` (URL de checkout de MercadoPago)
5. Frontend redirige al usuario a MercadoPago
6. Usuario completa el pago
7. MercadoPago envía webhook a Edge Function `mp-webhook`
8. La función:
   - Obtiene recurso desde API de MercadoPago
   - Parsea `external_reference` para identificar usuario y plan
   - Actualiza `profiles`:
     - `subscription_status` → `active`
     - `plan_tier` → plan seleccionado
     - `licenses_count` → según plan
     - `is_premium` → `true`
9. Usuario es redirigido de vuelta a la app (`/chat?subscription=success`)
10. Frontend muestra notificación de éxito

### Estados de suscripción
- `authorized` → se marca como `active`
- `cancelled` → se marca como `cancelled`
- `paused` → se marca como `paused`

---

## 6. Flujo de Datos (Edge Functions)

### Mapa de Edge Functions

| Función | Método | Descripción |
|---------|--------|-------------|
| `chat` | POST | Chat con IA usando contexto del PDF |
| `upload-pdf` | POST | Procesa PDF y extrae texto con IA |
| `analyze-food-image` | POST | Analiza imagen de comida vs plan nutricional |
| `create-subscription` | POST | Crea suscripción en MercadoPago |
| `mp-webhook` | POST | Webhook de MercadoPago (suscripciones) |
| `payment-webhook` | POST | Webhook de pagos únicos (legacy) |
| `create-preference` | POST | Preferencia de pago único (legacy) |
| `handle-link-request` | POST | Gestiona solicitudes de vinculación |
| `create-patient-invitation` | POST | Genera código de invitación |
| `get-pending-requests` | POST | Obtiene solicitudes pendientes |
| `get-all-doctors` | POST | Lista médicos disponibles |
| `get-all-patients` | POST | Lista pacientes disponibles |
| `get-doctor-patients` | POST | Pacientes de un médico (paginado) |
| `generate-patient-summary` | POST | Genera resumen de paciente con IA |
| `admin-dashboard` | POST | Datos del panel de administración |

### Patrón de autenticación en Edge Functions
```
1. Recibe request con header Authorization: Bearer <JWT>
2. Crea cliente Supabase con JWT del usuario
3. Obtiene usuario con getUser()
4. Verifica rol/permisos consultando user_roles
5. Ejecuta lógica de negocio con service role (admin)
6. Retorna respuesta JSON con CORS headers
```

---

## 7. Modelo de Datos Simplificado

```
auth.users (Supabase Auth)
  │
  ├─── profiles (1:1)
  │      Campos clave: full_name, avatar_url, is_premium,
  │      subscription_status, plan_tier, licenses_count, chat_count
  │
  ├─── user_roles (1:N)
  │      Roles: patient, doctor, super_admin
  │
  ├─── diets (1:N)
  │      Campos clave: file_name, file_url, pdf_text
  │      │
  │      └─── chat_messages (1:N)
  │             Campos: role (user/assistant), content
  │
  ├─── user_usage (1:1)
  │      Campos: daily_query_count, daily_image_count, last_query_date
  │
  └─── doctor_patients (N:M entre doctores y pacientes)
         Campos: doctor_id, patient_id, invitation_code

link_requests (solicitudes de vinculación)
  Campos: requester_id, target_id, status (pending/accepted/rejected)

patient_summaries (resúmenes generados por IA)
  Campos: patient_id, doctor_id, summary_text, topics, key_concerns
```

---

## 8. Integración con IA

- **Gateway**: Lovable AI (`https://ai.gateway.lovable.dev/v1/chat/completions`)
- **Modelo**: Google Gemini 2.5 Flash
- **Usos**:
  1. **Chat nutricional**: Respuestas contextualizadas con el plan del PDF
  2. **Extracción de PDF**: Conversión de PDF a texto plano
  3. **Análisis de imágenes**: Evaluación de fotos de comida vs plan nutricional
  4. **Resúmenes de pacientes**: Análisis de historial de chat para médicos
- **Sanitización**: El input del usuario se sanitiza para prevenir inyección de prompts

---

## 9. Seguridad

- **Autenticación**: JWT de Supabase en todas las Edge Functions
- **Roles**: Verificados desde `user_roles` (tabla segura, no editable por usuarios)
- **RLS**: Row Level Security habilitado en todas las tablas
- **Service Role**: Usado solo en Edge Functions para operaciones privilegiadas
- **Rate Limiting**: Límites diarios controlados en `user_usage`
- **Validación**: Zod en frontend, validación manual en Edge Functions
- **CORS**: Configurado en todas las Edge Functions

---

## 10. Diagrama de Navegación General

```
                    ┌─────────────┐
                    │  Landing /  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  Register   │
                    │  /register  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼──────┐    │     ┌──────▼──────┐
       │  Dashboard  │    │     │   Upload    │
       │  /dashboard │    │     │   /upload   │
       │  (doctores) │    │     │ (pacientes) │
       └──────┬──────┘    │     └──────┬──────┘
              │            │            │
              │            │     ┌──────▼──────┐
              │            │     │    Chat     │
              │            │     │    /chat    │
              │            │     └──────┬──────┘
              │            │            │
              │     ┌──────▼──────┐     │
              ├────►│   Profile   │◄────┤
              │     │   /profile  │     │
              │     └─────────────┘     │
              │                         │
              │  ┌──────────────────┐   │
              └─►│  Subscription    │◄──┘
                 │  /subscription   │
                 └──────────────────┘

       ┌──────────────┐
       │    Admin     │  (acceso solo super admin)
       │    /admin    │
       └──────────────┘
```
