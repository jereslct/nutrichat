# NutriChat AI - Asistente Nutricional Inteligente

Una aplicación web completa que permite a los usuarios subir su plan nutricional en formato PDF y chatear con una IA para obtener respuestas personalizadas sobre su dieta.

## 🚀 Stack Tecnológico

### Frontend
- **React** 18 con **TypeScript**
- **Vite** para desarrollo y build
- **Tailwind CSS** para estilos
- **shadcn/ui** para componentes UI
- **React Router** v6 para navegación
- **React Query** para manejo de estado del servidor

### Backend
- **Lovable Cloud** (Supabase)
  - PostgreSQL como base de datos
  - Supabase Auth para autenticación
  - Edge Functions para lógica del servidor
- **Lovable AI** (Gateway a Gemini) para chat con IA

## 📋 Características

- ✅ Autenticación de usuarios (registro e inicio de sesión)
- ✅ Upload de archivos PDF (planes nutricionales)
- ✅ Procesamiento y extracción de texto de PDFs
- ✅ Chat interactivo con IA usando contexto del PDF
- ✅ Historial de conversaciones persistente
- ✅ Diseño responsive y moderno
- ✅ Row Level Security (RLS) para protección de datos

## 🛠️ Configuración Local

### Prerrequisitos

- Node.js 18+ y npm instalados
- Cuenta en Lovable.dev (gratuita)

### Variables de Entorno

Las variables de entorno se gestionan automáticamente mediante Lovable Cloud. No necesitas crear un archivo `.env` manualmente. Las siguientes variables están preconfiguradas:

- `VITE_SUPABASE_URL` - URL del proyecto Supabase
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Clave pública de Supabase
- `LOVABLE_API_KEY` - Clave API de Lovable AI (configurada automáticamente)

### Instalación

1. Clona el repositorio:
```bash
git clone <TU_GIT_URL>
cd <NOMBRE_PROYECTO>
```

2. Instala las dependencias:
```bash
npm install
```

3. Inicia el servidor de desarrollo:
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:8080`

## 🏗️ Estructura del Proyecto

```
.
├── src/
│   ├── components/       # Componentes reutilizables
│   │   └── ui/          # Componentes de shadcn/ui
│   ├── pages/           # Páginas de la aplicación
│   │   ├── Index.tsx    # Landing page
│   │   ├── Auth.tsx     # Autenticación
│   │   ├── Upload.tsx   # Subida de PDF
│   │   └── Chat.tsx     # Chat con IA
│   ├── integrations/    # Integraciones (Supabase)
│   ├── hooks/           # Custom hooks
│   └── lib/             # Utilidades
├── supabase/
│   └── functions/       # Edge Functions
│       ├── upload-pdf/  # Procesa PDFs
│       └── chat/        # Maneja chat con IA
└── public/              # Archivos estáticos
```

## 🗄️ Esquema de Base de Datos

### Tabla `profiles`
- `id` (UUID, PK) - Referencia a auth.users
- `full_name` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### Tabla `diets`
- `id` (UUID, PK)
- `user_id` (UUID, FK) - Referencia a profiles
- `file_name` (TEXT)
- `content` (TEXT) - Texto extraído del PDF
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

### Tabla `chat_messages`
- `id` (UUID, PK)
- `user_id` (UUID, FK) - Referencia a profiles
- `diet_id` (UUID, FK) - Referencia a diets
- `role` (TEXT) - 'user' o 'assistant'
- `content` (TEXT)
- `created_at` (TIMESTAMPTZ)

## 🔒 Seguridad

- **Row Level Security (RLS)** habilitado en todas las tablas
- Los usuarios solo pueden ver y modificar sus propios datos
- Autenticación mediante Supabase Auth
- Edge Functions autenticadas por JWT
- Validación de entrada con Zod

## 📡 Edge Functions

### `upload-pdf`
- **Ruta**: `/functions/v1/upload-pdf`
- **Método**: POST
- **Body**: `{ pdf: string (base64), fileName: string }`
- **Descripción**: Recibe un PDF en base64, extrae el texto y lo guarda en la base de datos

### `chat`
- **Ruta**: `/functions/v1/chat`
- **Método**: POST
- **Body**: `{ message: string, dietId: string }`
- **Descripción**: Procesa un mensaje del usuario, consulta la IA con el contexto del plan nutricional y devuelve la respuesta

## 🚀 Despliegue

### Opción 1: Lovable (Recomendado)

1. Abre tu proyecto en [Lovable.dev](https://lovable.dev)
2. Haz clic en el botón **Publish** (esquina superior derecha en desktop)
3. Tu app estará disponible en `https://tu-proyecto.lovable.app`
4. Los Edge Functions se despliegan automáticamente

### Opción 2: Self-hosting

1. Build del frontend:
```bash
npm run build
```

2. El output estará en la carpeta `dist/`

3. Despliega en tu hosting preferido (Vercel, Netlify, etc.)

4. Configura las variables de entorno en tu plataforma de hosting

## 🎨 Personalización del Diseño

El sistema de diseño está centralizado en:
- `src/index.css` - Variables CSS y temas
- `tailwind.config.ts` - Configuración de Tailwind

Colores principales:
- **Primary**: Verde saludable `hsl(142 76% 36%)`
- **Accent**: Turquesa `hsl(170 70% 45%)`
- **Background**: Blanco cálido `hsl(140 20% 98%)`

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT.

## 📞 Soporte

- [Documentación de Lovable](https://docs.lovable.dev/)
- [Comunidad Discord de Lovable](https://discord.com/channels/1119885301872070706/1280461670979993613)
- [Tutoriales en YouTube](https://www.youtube.com/watch?v=9KHLTZaJcR8&list=PLbVHz4urQBZkJiAWdG8HWoJTdgEysigIO)

## 🎯 Próximos Pasos

- [ ] Mejorar extracción de texto de PDFs (usar librería robusta)
- [ ] Agregar soporte para más formatos (DOCX, TXT)
- [ ] Implementar búsqueda en historial de chats
- [ ] Añadir exportación de conversaciones
- [ ] Modo oscuro completo
- [ ] PWA para uso offline

---

Desarrollado con ❤️ usando [Lovable.dev](https://lovable.dev)