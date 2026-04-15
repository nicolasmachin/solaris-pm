# SOLARIS PM

SOLARIS PM es un sistema interno para gestionar proyectos fotovoltaicos de punta a punta. El objetivo del producto es que un equipo pueda seguir el ciclo completo de trabajo en un solo lugar: desde el lead comercial hasta la ejecución, habilitación, postventa, auditoría, métricas y notificaciones.

Este README está escrito para que lo pueda usar alguien que no conozca el proyecto de antemano. Si abrís este repo por primera vez, lo ideal es seguir los pasos en el orden en que aparecen.

## Qué resuelve el sistema

Hoy el sistema ya cubre estos bloques principales:

- CRM comercial con leads y pipeline de ventas
- Gestión de proyectos con etapas y subetapas basadas en SOPs
- Checklist operativos por etapa
- Tareas, archivos y comentarios por nivel
- Auditoría completa de cambios
- Dashboard de métricas y cronograma tipo Gantt
- Notificaciones in-app, email y WhatsApp
- Roles y permisos configurados desde base de datos

En otras palabras: no es solo un tablero de tareas, sino una herramienta para operar proyectos solares con trazabilidad.

## Stack tecnológico

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- Zustand
- TanStack Query

### Backend
- Node.js
- Fastify
- TypeScript
- Prisma ORM

### Infraestructura y servicios
- PostgreSQL
- JWT para autenticación
- Nodemailer para email
- Twilio para WhatsApp
- Script Python opcional para propuestas comerciales

## Requisitos previos

Antes de levantar el proyecto necesitás tener instalado:

- Node.js `>= 20`
- npm `>= 10`
- PostgreSQL `>= 15`
- Python 3

Si no vas a usar todavía el generador de propuestas, Python no bloquea el resto del sistema, pero conviene tenerlo instalado igual para dejar el entorno completo.

## Estructura general del repositorio

```text
solaris-pm/
├── client/
│   ├── src/
│   │   ├── api/                # clientes Axios por módulo
│   │   ├── components/         # layout, proyecto, ventas, comments, ui
│   │   ├── hooks/              # permisos, tema y helpers
│   │   ├── pages/              # vistas principales de la app
│   │   ├── store/              # estado global con Zustand
│   │   └── types/              # contratos TypeScript
│   └── .env                    # variables del frontend
├── server/
│   ├── docs/                   # documentación técnica adicional
│   ├── prisma/
│   │   ├── migrations/         # migraciones versionadas
│   │   ├── schema.prisma       # modelo principal de datos
│   │   └── seed.ts             # datos iniciales de ejemplo
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   └── tests/                  # archivos de prueba manual / HTTP
├── .env.example
└── README.md
```

### Cómo pensar esta estructura

- `client/` contiene toda la aplicación web que ve el usuario.
- `server/` contiene la API, la lógica de negocio, el acceso a base y los jobs.
- `prisma/` es la fuente de verdad del modelo de base de datos.
- `migrations/` guarda la historia estructural del schema.
- `docs/` guarda documentación técnica complementaria, por ejemplo la preparación para multi-tenancy.

## Puesta en marcha paso a paso

## 1. Clonar el repositorio

```bash
git clone <repo>
cd solaris-pm
```

Si ya tenés el repo descargado, asegurate de estar parado en la carpeta raíz `solaris-pm/` antes de seguir.

## 2. Instalar dependencias

Primero el backend:

```bash
cd server
npm install
```

Después el frontend:

```bash
cd ../client
npm install
```

Después de esto deberías tener `node_modules/` tanto en `server/` como en `client/`.

## 3. Crear variables de entorno

Volvé a la raíz del proyecto y copiá el ejemplo:

```bash
cd ..
cp .env.example .env
```

Para el frontend, si no existe un `.env` propio, crealo así:

```bash
cd client
printf "VITE_API_URL=http://localhost:4000\n" > .env
cd ..
```

### Qué completar sí o sí en `.env`

Para poder arrancar lo mínimo, necesitás:

- `DATABASE_URL`
- `JWT_SECRET`
- `BASE_URL`

Un ejemplo local típico podría ser:

```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/solaris_pm
JWT_SECRET=dev-secret
JWT_EXPIRES_IN=7d
STORAGE_PATH=./storage
MAX_FILE_SIZE_MB=20
BASE_URL=http://localhost:5173
```

Y en `client/.env`:

```env
VITE_API_URL=http://localhost:4000
```

## 4. Aplicar migraciones de base de datos

Desde `server/`:

```bash
cd server
npx prisma migrate dev
```

Esto hace dos cosas:
- crea o actualiza la estructura de la base
- deja registrada la migración ejecutada

Si esta parte falla, normalmente el problema está en:
- `DATABASE_URL` mal escrita
- PostgreSQL apagado
- base de datos inexistente

## 5. Cargar datos de ejemplo

Todavía desde `server/`:

```bash
npx prisma db seed
```

El seed deja la app en un estado útil para probar desde el primer arranque. No carga solo usuarios: también crea proyectos, etapas, subetapas, leads, comentarios, auditoría y notificaciones.

## 6. Levantar el backend

Desde `server/`:

```bash
npm run dev
```

Si todo está bien, el backend debería quedar escuchando en:

- `http://localhost:4000`

Podés verificarlo con:

```bash
curl http://localhost:4000/health
```

## 7. Levantar el frontend

En otra terminal:

```bash
cd client
npm run dev
```

La app debería abrir en:

- `http://localhost:5173`

## 8. Abrir Prisma Studio opcionalmente

Si querés inspeccionar la base de datos visualmente:

```bash
cd server
npx prisma studio
```

Esto es muy útil para verificar:
- usuarios
- proyectos
- etapas
- checklist
- leads
- auditoría
- notificaciones

## Variables de entorno

## Backend `.env`

| Variable | Obligatoria | Para qué sirve |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Conexión a PostgreSQL |
| `JWT_SECRET` | Sí | Secreto usado para firmar tokens |
| `JWT_EXPIRES_IN` | No | Duración del JWT |
| `STORAGE_PATH` | No | Carpeta donde se guardan uploads |
| `MAX_FILE_SIZE_MB` | No | Tamaño máximo de archivos |
| `BASE_URL` | Sí | URL del frontend usada en emails y links |
| `SMTP_HOST` | No | Host SMTP para email |
| `SMTP_PORT` | No | Puerto SMTP |
| `SMTP_USER` | No | Usuario SMTP |
| `SMTP_PASS` | No | Password SMTP |
| `SMTP_FROM` | No | Remitente por defecto |
| `TWILIO_ACCOUNT_SID` | No | Identificador de cuenta Twilio |
| `TWILIO_AUTH_TOKEN` | No | Token Twilio |
| `TWILIO_WHATSAPP_FROM` | No | Número emisor de WhatsApp |

### Importante

Si no completás SMTP o Twilio:
- la app igual arranca
- las notificaciones in-app siguen funcionando
- simplemente se omite el envío real y se loguea esa situación

## Frontend `client/.env`

| Variable | Obligatoria | Para qué sirve |
| --- | --- | --- |
| `VITE_API_URL` | Sí | URL base de la API |

## Usuarios de prueba

El seed crea estos usuarios para probar roles distintos:

| Email | Password | Rol | Uso recomendado |
| --- | --- | --- | --- |
| `admin@solarispm.com` | `Admin1234` | `ADMIN` | Ver todo y configurar todo |
| `comercial@solarispm.com` | `Admin1234` | `ASESOR_COMERCIAL` | Probar CRM y ventas |
| `ingeniero@solarispm.com` | `Admin1234` | `INGENIERIA` | Probar vistas técnicas |
| `operaciones@solarispm.com` | `Admin1234` | `OPERACIONES` | Probar ejecución y seguimiento |

## Scripts útiles

## Server

```bash
npm run dev
npm run build
npx prisma migrate dev
npx prisma db seed
npx prisma studio
```

### Cuándo usar cada uno

- `npm run dev`: para desarrollo diario
- `npm run build`: para validar que el backend compila bien
- `npx prisma migrate dev`: cuando cambiaste el schema
- `npx prisma db seed`: para repoblar datos de ejemplo
- `npx prisma studio`: para mirar datos visualmente

## Client

```bash
npm run dev
npm run build
```

- `npm run dev`: levanta la web en desarrollo
- `npm run build`: valida TypeScript y genera el bundle productivo

## Qué crea el seed

El seed no deja una base vacía. Deja un entorno útil para demo y pruebas:

- usuarios de ejemplo por rol
- proyectos con estructura operativa completa
- etapas y subetapas con checklist
- leads del pipeline comercial
- tareas y archivos de muestra
- comentarios
- entradas de auditoría
- notificaciones de ejemplo

Esto está pensado para que no tengas que crear todo manualmente solo para probar la app.

## URLs importantes

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Health check: `http://localhost:4000/health`
- Prisma Studio: puerto dinámico según ejecución

## Qué deberías probar primero

Si querés una validación rápida del sistema:

1. Iniciá sesión con `admin@solarispm.com`
2. Entrá al dashboard
3. Abrí un proyecto
4. Revisá etapas, tareas y comentarios
5. Entrá a ventas
6. Entrá a métricas
7. Probá la campana de notificaciones

Eso ya te da una pasada bastante completa por los módulos principales.

## Notas operativas importantes

- Los permisos no están hardcodeados. Se leen desde la base de datos.
- La auditoría está pensada para no perder historia.
- Los uploads se guardan en filesystem local, listos para migrar luego a S3.
- La arquitectura ya quedó preparada para una futura evolución SaaS.
- Las métricas y el cronograma dependen de que el backend esté actualizado y reiniciado.

## Roadmap SaaS

La preparación para multi-tenant está documentada en:

[server/docs/SAAS_MIGRATION.md](server/docs/SAAS_MIGRATION.md)

## Troubleshooting

## El frontend levanta pero no carga datos

Verificá:
- que el backend esté corriendo
- que `VITE_API_URL` apunte al backend correcto
- que no tengas el backend viejo corriendo en otro puerto o en una versión anterior

## `/metrics` o `Cronograma` no cargan

Esto casi siempre pasa por una de estas razones:
- backend no reiniciado después de cambios
- usuario sin permiso `METRICAS:VIEW`
- frontend apuntando a otra API

## Prisma falla al validar o migrar

Revisá:
- que `DATABASE_URL` exista en `.env`
- que PostgreSQL esté levantado
- que la base exista

## El puerto `4000` está ocupado

Tenés un backend viejo o colgado corriendo. Cerralo y volvé a levantar `npm run dev` en `server/`.

## No se envían emails o WhatsApp

Si SMTP o Twilio no están configurados:
- el sistema no se rompe
- la notificación se sigue registrando en la app
- el envío real se omite y se loguea

## Quiero revisar datos sin tocar la app

Usá Prisma Studio:

```bash
cd server
npx prisma studio
```

Es la forma más fácil de inspeccionar tablas y relaciones.

## Estado actual del proyecto

El sistema ya cubre el flujo operativo principal de forma bastante completa. Los siguientes pasos naturales, si quisieras endurecerlo para producción, serían:

- QA end-to-end más exhaustivo
- deploy y observabilidad
- backups automáticos
- activación progresiva de multi-tenancy
- monitoreo de jobs y alertas
