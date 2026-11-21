# Pendiente: pestaña «Novedades» en Recursos Humanos

Decidido con Nicolás el 21/11/2026. Falta programarla. El manual de Finanzas
(`docs/Manual-de-Trabajo-Finanzas.md`, §5.21 y lineamiento «Las horas extra y
las faltas se pagan a mes vencido») ya la describe como va a ser.

- Horas extra y faltas se pagan a **mes vencido** (las de octubre, en el sueldo
  de principios de diciembre). *A confirmar con la contadora.*
- Cada **gerente** entra a Recursos Humanos y ve solo **Novedades**, con la gente
  de su área (por rol). Hoy los gerentes no tienen `RRHH:EDIT`: hace falta un
  acceso acotado.
- Hora extra: fecha, desde–hasta, día hábil / descanso / feriado, obra, quién la
  aprobó. Falta: fecha, con o sin aviso, nota.
- Se carga **antes del día 10** del mes siguiente; ese día el mes anterior se
  **cierra solo** y queda fijo; lo cargado después pasa al mes siguiente.
- **Finanzas**: resumen por persona y mes, descargable en planilla.
- **Mi legajo**: cada persona ve sus horas extra y faltas.
- Datos sensibles: sumar las tablas nuevas a las prohibidas del asistente de IA
  (`ai-sql-validator.ts`), como el resto de RRHH.
- Al terminar: manual técnico `docs/manual/17-rrhh.md`, CHANGELOG, Reglamento
  interno (6.4 y 18) y Gerencia (cuando la contadora confirme).
