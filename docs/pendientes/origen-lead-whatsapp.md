# Origen del lead — Parte 2 (WhatsApp)

Encargo: `~/Dev/voltia-asesores/encargos/2026-10-22-origen-del-lead.md`.
La Parte 1 (campo, pantalla, conector, reporte) está hecha (22-oct-2026, v13.1).
Esta parte espera a que el WhatsApp Cloud API tenga **número real**.

## Qué falta

1. Al vincular una conversación con un lead (o crear el lead desde ella), buscar
   el primer mensaje entrante de ese número con `referral` en
   `whatsapp_mensajes.payload` y aplicar:
   `completarOrigenSiFalta(lead, origenDesdeAnuncio(referral))`
   (`server/src/services/sales/origen-lead.ts`, ya probadas). Si devuelve algo,
   guardarlo con `editarLead()` para que quede auditado.
2. Decidir si alcanza con `origenDetalle` (hoy queda "título · anuncio <id>") o
   si se suman columnas propias `origenAnuncioId` / `origenAnuncioTitulo`
   (migración aditiva) para cruzar con el gasto por anuncio de Meta. Si se suman,
   `origenDesdeAnuncio()` es el único lugar a cambiar.
3. Verificar con un anuncio de prueba que el `referral` llega también con el
   número en modo coexistencia (suposición no comprobada).

## Regla

Solo completa si el lead **no tiene origen**: lo que respondió el cliente a
"¿cómo nos conoció?" vale más que la inferencia.
