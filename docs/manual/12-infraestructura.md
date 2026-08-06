# 12 · Infraestructura

> **Capítulo pendiente de escribir.** La funcionalidad existe y está en
> producción; lo que falta es la documentación. Se completa cuando se trabaje
> sobre este módulo.

Cómo corre la aplicación: contenedores, base, storage, jobs, correo, IA y respaldos.

---

## Qué tiene que cubrir este capítulo

- Docker Compose en desarrollo y en producción
- Base de datos: migraciones, seed y respaldos
- Storage de archivos y su respaldo a Backblaze B2
- Los ocho trabajos programados
- Correo saliente: SMTP por usuario y el guardrail de correos internos
- IA: modelos, costos, límites y el validador de SQL
- Despliegue y vuelta atrás

---

## Plantilla

Al escribirlo, seguir la estructura común (ver `README.md`):

```
## Para qué existe
## Cómo se usa
## Cómo funciona
## Permisos
## Reglas y decisiones
## Casos borde
```

## Mientras tanto

Fuentes para consultar, con la advertencia de que **ninguna es fuente de verdad
sobre cómo funciona hoy**:

- El código, que es lo único que no miente.
- `CHANGELOG.md` para saber qué cambió y cuándo.
- `docs/features/*/SPEC.md` si existe para este módulo: es diseño previo, puede
  contradecir a la implementación.
- `docs/pendientes/` para saber qué falta.
