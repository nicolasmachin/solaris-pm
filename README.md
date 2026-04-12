# SOLARIS PM

SOLARIS PM es una web app interna para gestionar proyectos de instalación solar fotovoltaica. Esta primera etapa deja lista la arquitectura inicial, la base de datos PostgreSQL modelada con Prisma, un backend mínimo en Fastify y datos de ejemplo realistas para arrancar con contexto desde el primer día.

## Stack

- `client/`: React + TypeScript + Vite
- `server/`: Node.js + Fastify + TypeScript
- Base de datos: PostgreSQL
- ORM y migraciones: Prisma
- Autenticación futura: JWT
- Archivos: storage local preparado para migración futura a S3

## Estructura

```text
solaris-pm/
├── client/
├── server/
│   ├── src/
│   └── prisma/
├── .env.example
└── README.md
```

## Requisitos Previos

- Node.js `>= 20`
- npm `>= 10`
- PostgreSQL `>= 15`
- Una base de datos creada y accesible desde `DATABASE_URL`

## Variables de Entorno

Copiá `.env.example` a `.env` en la raíz del proyecto y completá los valores necesarios.

Variables incluidas:

- `DATABASE_URL`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `STORAGE_PATH`
- `MAX_FILE_SIZE_MB`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`

## Levantar en Desarrollo

1. Clonar el repo.
2. Copiar `.env.example` a `.env` y completar variables.
3. Ejecutar `npm install` en `server/` y `client/`.
4. Ejecutar `npx prisma migrate dev` dentro de `server/`.
5. Ejecutar `npx prisma db seed` dentro de `server/`.
6. Ejecutar `npm run dev` dentro de `server/`.

Comandos útiles:

- Backend: `cd server && npm run dev`
- Prisma Studio: `cd server && npx prisma studio`
- Cliente placeholder: `cd client && npm run dev`

## Probar la API

1. Obtener JWT temporal:
   `POST /auth/login`
2. Usar el token en `Authorization: Bearer <token>` para todos los endpoints bajo `/api`.
3. Usuario de prueba:
   `admin@solarispm.com` / `Admin1234`

Endpoints principales de esta etapa:

- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects`
- `PATCH /api/projects/:id`
- `DELETE /api/projects/:id`
- `GET /api/projects/:projectId/stages`
- `PATCH /api/projects/:projectId/stages/:stageId`
- `GET /api/projects/:projectId/stages/:stageId/substages`
- `POST /api/projects/:projectId/stages/:stageId/substages`
- `PATCH /api/projects/:projectId/stages/:stageId/substages/:substageId`
- `PATCH /api/projects/:projectId/stages/:stageId/substages/reorder`
- `DELETE /api/projects/:projectId/stages/:stageId/substages/:substageId`
- `GET /api/projects/:projectId/tasks`
- `POST /api/projects/:projectId/tasks`
- `PATCH /api/projects/:projectId/tasks/:taskId`
- `DELETE /api/projects/:projectId/tasks/:taskId`
- `POST /api/projects/:projectId/files`
- `GET /api/projects/:projectId/files`
- `GET /api/files/:fileId/download`
- `DELETE /api/files/:fileId`
- `GET /api/projects/:projectId/audit`
- `GET /api/audit/stats/:projectId`
- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

## Datos de Ejemplo Incluidos

El seed crea:

- 2 usuarios de ejemplo:
- `admin@solarispm.com` / `Admin1234`
- `pm@solarispm.com` / `Admin1234`
- 4 proyectos del sector fotovoltaico argentino con estados distintos del pipeline
- 6 etapas por proyecto
- Subetapas realistas por cada etapa
- Tareas con distintos estados, prioridades y vencimientos
- Archivos adjuntos de ejemplo
- Notificaciones iniciales
- Mínimo 10 entradas de auditoría por proyecto

## Notas de Diseño

- La ubicación del proyecto se modeló como `locationCity` y `locationProvince` para facilitar filtros, reporting y futuras integraciones.
- `co2TonsAvoided` se persiste ya calculado desde `estimatedMwhYear * 0.5` para no perder snapshots históricos.
- `AuditLog` está diseñado como tabla inmutable: nunca se actualiza ni se borra en operación normal.
- Los campos de duración y desvío quedan persistidos para evitar recalcular historia operativa una vez cerradas las etapas.
- El storage local usa rutas relativas para simplificar una futura migración a S3 sin romper referencias existentes.

## Próximas Etapas

1. Etapa 1: Setup, arquitectura, base de datos y seed inicial.
2. Etapa 2: Backend + API REST + middleware de auditoría.
3. Etapa 3: Autenticación JWT, login y control de acceso.
4. Etapa 4: Gestión operativa de proyectos, etapas y subetapas.
5. Etapa 5: Tareas, archivos y trazabilidad documental.
6. Etapa 6: Dashboard, métricas, filtros y vistas de seguimiento.
7. Etapa 7: Notificaciones por email y WhatsApp.
