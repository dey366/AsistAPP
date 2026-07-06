# AsistApp - Sistema Web de Control de Asistencia Académico

¡Bienvenido a **AsistApp**! Este es un sistema web multi-tenant diseñado para la gestión y control de asistencia académica, justificaciones, horarios y reportes analíticos para universidades. Está estructurado como un monorepo administrado con `pnpm`.

---

## 🚀 Arquitectura y Tecnologías
El sistema se compone de los siguientes elementos:

1. **Frontend (Next.js 15+ & React 19)**: Interfaz responsiva y dinámica con soporte para temas (claro/oscuro), paneles personalizados por rol (Administrador, Docente, Supervisor, Estudiante).
2. **Backend (NestJS 10+)**: API REST robusta que maneja la lógica de negocio, validación de conflictos de horarios y autenticación.
3. **Base de Datos & Auth (Supabase & PostgreSQL)**: Base de datos en la nube relacional con autenticación OAuth (Google SSO) e inicio de sesión institucional.
4. **ORM (Prisma)**: Sincronización del modelo relacional mediante migraciones automáticas.

---

## 🛠️ Requisitos Previos
Antes de iniciar la instalación, asegúrate de tener instalado:
*   [Node.js](https://nodejs.org/) (versión 18 o superior recomendada)
*   [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
*   Un proyecto activo en [Supabase](https://supabase.com/)

---

## 📦 Guía de Instalación Local

### 1. Clonar el repositorio
```bash
git clone https://github.com/dey366/AsistAPP.git
cd AsistApp
```

### 2. Instalar dependencias del Monorepo
Desde la raíz del proyecto, ejecuta:
```bash
pnpm install
```

### 3. Configurar variables de entorno (`.env`)
Crea un archivo `.env` en la **raíz del proyecto** copiando el archivo de ejemplo:
```bash
cp .env.example .env
```

Llena las variables en el `.env` con los valores de tu panel de Supabase:
```env
# Supabase Cloud Config
SUPABASE_URL=https://[tu-proyecto].supabase.co
SUPABASE_ANON_KEY=[tu-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[tu-service-role-key]

# Backend NestJS
PORT=4000
NODE_ENV=development
JWT_SECRET=clave-secreta-para-tokens-jwt
DATABASE_URL=postgresql://postgres:[tu-password-supabase]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true

# Frontend Next.js
NEXT_PUBLIC_SUPABASE_URL=https://[tu-proyecto].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[tu-anon-key]
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

*(Nota: Asegúrate de tener los archivos `.env` sincronizados en `apps/backend/.env` y `apps/frontend/.env` si es necesario).*

### 4. Sincronizar y migrar la Base de Datos (Prisma)
Para aplicar las tablas y relaciones a tu base de datos de Supabase, ejecuta los siguientes comandos desde la raíz:
```bash
# Generar el cliente de Prisma
pnpm --filter backend prisma generate

# Aplicar las migraciones a la base de datos remota
pnpm --filter backend prisma db push
```

### 5. Iniciar la aplicación en modo desarrollo
Para arrancar el backend y el frontend de forma simultánea:
```bash
pnpm dev
```
*   **Frontend**: Disponible en [http://localhost:3000](http://localhost:3000)
*   **Backend API**: Disponible en [http://localhost:4000/api](http://localhost:4000/api)

---

## 🔑 Cuentas de Prueba Preestablecidas
Al registrar usuarios desde el panel de administración, la contraseña temporal asignada por defecto es:
*   🔑 **Contraseña por defecto:** `AsistApp2026!`

Los usuarios creados se redirigirán dinámicamente a sus respectivos dashboards según su rol:
*   `admin` ➔ Panel de control administrativo global.
*   `docente` ➔ Panel de marcado de asistencia y gestión de clases.
*   `estudiante` ➔ Panel de visualización de asistencias y carga de justificaciones.
*   `supervisor` ➔ Gestión de reportes y aprobación de faltas justificadas.

---

## ☁️ Despliegue en Producción

### Frontend (Vercel)
1. Conecta tu repositorio de GitHub a Vercel.
2. Configura las siguientes variables de entorno en Vercel:
   *   `NEXT_PUBLIC_SUPABASE_URL`
   *   `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   *   `NEXT_PUBLIC_API_URL` (Debe apuntar a la URL de producción de tu Backend).
3. Vercel detectará la configuración de Next.js de forma automática.

### Backend (Render / Railway / Heroku)
1. Conecta tu repositorio al servicio de hosting web.
2. Comando de instalación: `pnpm install`
3. Comando de inicio/construcción: `pnpm --filter backend build` y luego `pnpm --filter backend start:prod`
4. Configura las variables de entorno correspondientes del Backend.
