# 03 · Proyectos

> **Capítulo pendiente de escribir.** La funcionalidad existe y está en
> producción; lo que falta es la documentación. Se completa cuando se trabaje
> sobre este módulo.

El pipeline de obra: etapas, subetapas, checklists, ampliaciones y traspasos.

---

## Qué tiene que cubrir este capítulo

- Estructura Proyecto → Etapa → Subetapa → Checklist
- Los tipos de etapa y su mapeo a módulos de permisos
- Avance automático y manual del pipeline
- Ampliaciones sobre instalaciones existentes
- Traspasos T1–T13: qué los dispara y cómo se confirman
- Campos del proyecto y quién puede editar cada uno
- Archivado y borrado lógico

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
