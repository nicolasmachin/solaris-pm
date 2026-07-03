# Checklist de QA visual — pre-deploy

Recorrido manual de la app antes de deployar. Es para Nicolás (ojos humanos),
no es código. Marcá cada ítem; anotá al lado lo que falle. Recorrer con **DevTools
abierto** (consola + red) para cazar errores.

Fecha del recorrido: __________ · Versión: __________

## 7.1 Autenticación y roles

- [ ] Login funciona (admin, asesor).
- [ ] Logout funciona.
- [ ] Cada rol ve solo lo suyo (admin, asesor, ingeniería, operaciones, finanzas).
- [ ] `/settings` (Mi perfil): editar nombre, cargo, teléfono y guardar.

## 7.2 Ventas / Leads

- [ ] Kanban de leads carga.
- [ ] Abrir un lead muestra el detalle.
- [ ] Botón "Armar propuesta" aparece y abre el constructor.
- [ ] Sistema viejo de propuestas (`/proposals/generate`) sigue funcionando.

## 7.3 Constructor de propuestas (nuevo)

- [ ] `/leads/:leadId/propuesta` carga con datos default.
- [ ] Autosave: cambiar un campo, esperar, recargar → el cambio persiste.
- [ ] Preview PDF se actualiza (con debounce) al editar.
- [ ] Validación bloquea publicar si faltan obligatorios (muestra faltantes).
- [ ] Publicar una versión nueva funciona.
- [ ] Lista de versiones muestra todas con sus acciones.
- [ ] Descargar PDF completo y resumen funciona.
- [ ] Descartar y restaurar versiones funciona.
- [ ] **Markup en %**: cambiar el markup del asesor (ej. 20) y ver que el precio
      es coherente (no ×100). Publicar una V y confirmar el total.
- [ ] Drawer de debug (solo admin) abre y muestra los intermedios.
- [ ] **Sub-header en móvil**: los botones (autosave, ver preview, debug,
      publicar) no se amontonan; Debug se ve como ícono.

## 7.4 Admin de propuestas

- [ ] `/admin/propuestas/defaults` muestra todos los valores editables.
- [ ] El markup se muestra con sufijo **%** y valor en porcentaje (ej. 20).
- [ ] Guardar variables persiste (recargar y verificar).
- [ ] Subir tapa PDF funciona.
- [ ] Preview de tapa con overlay funciona.
- [ ] Link **"Ver memoria de cálculo →"** aparece y abre la página.
- [ ] **Memoria de cálculo**: los chips (`markupPorcentaje`, factores, etc.)
      muestran los valores **actuales** del singleton. Cambiar un valor en
      Defaults, volver a la memoria y confirmar que el chip cambió.
- [ ] Un asesor sin permiso `VENTAS:ACCESS_MEMORIA` **no** ve el link ni puede
      entrar a `/admin/propuestas/memoria-calculo` (redirige con toast).

## 7.5 Ingeniería (regresión)

- [ ] Generador de unifilar funciona.
- [ ] Consolidador de materiales funciona.
- [ ] Pre-Ingeniería funciona.
- [ ] Extracción de minutas con IA funciona.

## 7.6 Otros módulos (pasada superficial)

- [ ] Operaciones.
- [ ] Finanzas (movimientos, cashflow, estado de resultados).
- [ ] Tramitación UTE.
- [ ] Atención al cliente / Experiencia.
- [ ] Métricas.

Buscar regresiones visuales o errores obvios en cada uno.

## 7.7 Responsive

- [ ] Constructor de propuestas en móvil (form, preview full-screen, publicar).
- [ ] Drawer de debug en móvil abre full-screen.
- [ ] Admin en móvil (opcional, no primario).

## 7.8 Errores

- [ ] Recorrido con DevTools abierto: sin errores rojos en consola.
- [ ] Endpoints nuevos no tiran 500 con casos borde:
  - [ ] `/draft/preview.pdf` con borrador incompleto → 400 claro, no 500.
  - [ ] `/draft/calc` (debug) como no-admin → 403.
  - [ ] `/calculator-memoria` como rol sin `ACCESS_MEMORIA` → 403.

---

**Resultado del recorrido:** ⬜ OK para deploy · ⬜ Con observaciones (anotar arriba)
