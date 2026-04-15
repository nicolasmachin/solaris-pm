# Guía de migración a SaaS multi-tenant

## Qué está preparado
- Columnas `tenantId` en `Project`, `User` y `SalesLead`
- Sistema de permisos en DB, sin reglas hardcodeadas
- Settings a tres niveles: sistema, proyecto y usuario
- AuditLog preparado para incorporar aislamiento por tenant sin rediseñar el modelo

## Pasos para activar multi-tenancy
1. Poblar `tenantId` en todas las entidades existentes
2. Agregar `tenantId` al payload del JWT
3. Agregar middleware que filtre todas las queries por `req.user.tenantId`
4. Convertir Settings de nivel `SYSTEM` a nivel `TENANT`
5. Agregar tabla `Tenant` con plan, features activas y límites de uso
6. Implementar billing por tenant

## Módulos que se pueden vender por separado
- `VENTAS` — pipeline comercial
- `METRICAS` — dashboard avanzado y Gantt
- `NOTIFICACIONES` — email, WhatsApp e in-app
- `DOCUMENTOS` — archivos adjuntos y propuestas

## Lo que NO requiere cambios para multi-tenancy
- Sistema de roles y permisos, ya configurable desde DB
- AuditLog, ya relacionado con proyecto y usuario
- Comentarios, ya relacionados con `projectId` o `leadId`
- Notificaciones, ya relacionadas con `projectId`
