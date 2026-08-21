import { EmailTemplateScope, Module, type PrismaClient } from "@prisma/client";

// Fuente única de la plantilla de sistema "Consulta UTE". La usan el seed general
// (prisma/seed.ts), el script standalone (scripts/seed-email-templates.ts) y el
// script de actualización de firma (scripts/update-consulta-ute-template.ts).

export const CONSULTA_UTE_KEY = "consulta_ute";

export const CONSULTA_UTE_SUBJECT =
  "CONSULTA Nuevo Microgenerador{{#if cliente.esEmpresa}} {{cliente.nombre}} - EMPRESA Cta {{suministro.cuenta}}{{else}} - {{cliente.nombre}} - CTA {{suministro.cuenta}}{{/if}}";

// El bloque "Datos Firma Instaladora" es la empresa habilitada ante UTE (Voltia /
// Machin Justet): es fijo por obligación legal, NO cambia según quién envía.
// La firma de cortesía del final SÍ es dinámica: son los datos del usuario que
// prepara la consulta (namespace `firma`). Los condicionales omiten cargo/teléfono
// si el usuario no los tiene cargados (sin dejar líneas en blanco).
export const CONSULTA_UTE_BODY = `Buenas tardes, envío consulta para comenzar el trámite de una nueva instalación fotovoltaica en un cliente {{#if cliente.esEmpresa}}empresa{{else}}residencial{{/if}}.
A continuación se detallan todos los datos.

Datos Firma Instaladora

Razón Social: MACHIN JUSTET NICOLAS FERNANDO
RUT: 150733900014
Técnico: Nicolás Machín
C.I.: 4.139.492-7
Teléfono de contacto: 098546991
Email: nfmj@hotmail.com

Datos del suministro

Departamento: {{suministro.departamento}}
Localidad: {{suministro.localidad}}
Calle: {{suministro.calle}}
Nro. de puerta: {{suministro.numero}}

Datos del cliente

Nombre completo: {{cliente.nombre}}
{{#if cliente.esEmpresa}}RUT: {{cliente.ci}}{{else}}C.I./RUT: {{cliente.ci}}{{/if}}
Cuenta: {{suministro.cuenta}}
Teléfono de contacto: {{cliente.telefono}}

Datos técnicos de la solicitud

Tipo de solicitud: Consulta por microgenerador
Tensión suministro: {{tecnica.tension}}
Potencia comprometida del generador: {{tecnica.potenciaGenerador}}
Tipo de fuente: Fotovoltaica
Potencia contratada: {{tecnica.potenciaContratada}}
Tarifa: {{tecnica.tarifa}}
Trámite: Nueva solicitud
Pasa línea: {{tecnica.pasaLinea}}
Acometida: {{tecnica.acometida}}
Destino del servicio: {{tecnica.destino}}
Certificado carga: {{tecnica.certificadoCarga}}
La instalación incluye alguna carga perturbadora o sensible: {{tecnica.cargaPerturbadora}}

Muchas gracias,
Saludos!

{{firma.nombre}}
{{#if firma.cargo}}{{firma.cargo}}
{{/if}}{{#if firma.telefono}}Cel: {{firma.telefono}}
{{/if}}{{firma.email}}`;

// Create-if-absent: NO pisa si ya existe (preserva ediciones de ADMIN).
export async function seedConsultaUteTemplate(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.emailTemplate.findUnique({ where: { key: CONSULTA_UTE_KEY } });
  if (existing) {
    console.log("ℹ️  Plantilla 'Consulta UTE' ya existe, skip (se preservan ediciones de ADMIN).");
    return;
  }

  await prisma.emailTemplate.create({
    data: {
      key: CONSULTA_UTE_KEY,
      nombre: "Consulta UTE",
      descripcion: "Consulta de nuevo microgenerador a UTE desde Onboarding.",
      modulo: Module.ONBOARDING,
      scope: EmailTemplateScope.PROJECT,
      // To/Cc son placeholders editables por ADMIN.
      toTemplate: "microgeneracion@ute.com.uy",
      ccTemplate: "luna@voltia.com.uy",
      bccTemplate: "{{cliente.email}}",
      subjectTemplate: CONSULTA_UTE_SUBJECT,
      bodyTemplate: CONSULTA_UTE_BODY,
      activo: true,
      esSistema: true,
    },
  });
  console.log("✅ Plantilla 'Consulta UTE' sembrada.");
}

// Update puntual del CUERPO de la fila existente (la firma dinámica). El seed es
// create-if-absent y no pisa la fila ya sembrada, así que este update es necesario
// para llevar la firma nueva a entornos que ya tienen la plantilla (local y prod).
// Solo toca bodyTemplate: preserva to/cc/bcc/subject editados por ADMIN.
export async function updateConsultaUteBody(prisma: PrismaClient): Promise<number> {
  const res = await prisma.emailTemplate.updateMany({
    where: { key: CONSULTA_UTE_KEY },
    data: { bodyTemplate: CONSULTA_UTE_BODY },
  });
  if (res.count === 0) {
    console.log("ℹ️  No existe la fila 'consulta_ute' — corré seed-email-templates.ts para crearla.");
  } else {
    console.log(`✅ Cuerpo de 'consulta_ute' actualizado (firma dinámica). Filas: ${res.count}.`);
  }
  return res.count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Suministro Individual: solicitud de suministro / aumento de potencia
// contratada. Es UN solo formulario con dos modos que solo cambian el asunto y
// la frase de apertura (`tecnica.esAumento`); el cuerpo es idéntico.
//
// A diferencia de la consulta de microgenerador, este trámite es OPCIONAL: solo
// se manda cuando el suministro del cliente no da la potencia que necesita la
// instalación. Se dispara desde la subetapa "Consulta inicial UTE" de Onboarding.
// ─────────────────────────────────────────────────────────────────────────────

export const SUMINISTRO_INDIVIDUAL_KEY = "suministro_individual_ute";

export const SUMINISTRO_INDIVIDUAL_SUBJECT =
  "{{#if tecnica.esAumento}}Aumento de Potencia de Suministro Individual{{else}}Solicitud de Suministro Individual{{/if}} - {{cliente.nombre}}";

// El bloque "Datos Firma Instaladora" es la empresa habilitada ante UTE: es fijo
// por obligación legal, NO cambia según quién envía. La firma de cortesía del
// final SÍ es dinámica (namespace `firma`), igual que en la consulta.
export const SUMINISTRO_INDIVIDUAL_BODY = `Buenas tardes, envío {{#if tecnica.esAumento}}solicitud de aumento de potencia contratada{{else}}solicitud de suministro individual{{/if}} para el siguiente suministro.
A continuación se detallan todos los datos.

Datos Firma Instaladora

Razón Social: MACHIN JUSTET NICOLAS FERNANDO
RUT: 150733900014
Técnico: Nicolás Machín
C.I.: 41394927
Teléfono de contacto: 098546991
Email: nfmj@hotmail.com

Datos del Suministro

Departamento: {{suministro.departamento}}
Localidad: {{suministro.localidad}}
Calle: {{suministro.calle}}
Nro. de puerta: {{suministro.numero}}
Aviso de acceso: {{suministro.avisoAcceso}}
¿Desea recibir las notificaciones en esta dirección?: {{suministro.notificaciones}}

Datos del Cliente

Nombre completo: {{cliente.nombre}}
{{#if cliente.esEmpresa}}RUT: {{cliente.ci}}{{else}}C.I./RUT: {{cliente.ci}}{{/if}}
Teléfono de contacto: {{cliente.telefono}}
Email: {{cliente.email}}

Datos técnicos de la Solicitud

Tipo de solicitud: {{tecnica.tipoSolicitud}}
Tensión suministro: {{tecnica.tensionNivel}}
Tarifa: {{tecnica.tarifa}}
Trámite: {{tecnica.tramite}}
Trámite asociado: {{tecnica.tramiteAsociado}}
Pasa línea: {{tecnica.pasaLinea}}
Acometida: {{tecnica.acometida}}
Actividad: {{tecnica.actividad}}
Certificado carga: {{tecnica.certificadoCarga}}
Potencia solicitada: {{tecnica.potenciaSolicitada}}
Fases: {{tecnica.fases}}
La instalación incluye alguna carga perturbadora o sensible: {{tecnica.cargaPerturbadora}}
Observaciones: {{tecnica.observaciones}}

Muchas gracias,
Saludos!

{{firma.nombre}}
{{#if firma.cargo}}{{firma.cargo}}
{{/if}}{{#if firma.telefono}}Cel: {{firma.telefono}}
{{/if}}{{firma.email}}`;

// Create-if-absent: NO pisa si ya existe (preserva ediciones de ADMIN).
export async function seedSuministroIndividualTemplate(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.emailTemplate.findUnique({
    where: { key: SUMINISTRO_INDIVIDUAL_KEY },
  });
  if (existing) {
    console.log(
      "ℹ️  Plantilla 'Suministro Individual' ya existe, skip (se preservan ediciones de ADMIN).",
    );
    return;
  }

  await prisma.emailTemplate.create({
    data: {
      key: SUMINISTRO_INDIVIDUAL_KEY,
      nombre: "Suministro Individual (aumento de potencia)",
      descripcion:
        "Solicitud de suministro individual / aumento de potencia contratada a UTE desde Onboarding.",
      modulo: Module.ONBOARDING,
      scope: EmailTemplateScope.PROJECT,
      // El destinatario de UTE para este trámite NO es el mismo que el de
      // microgeneración (que va a microgeneracion@). Los tres son editables
      // antes de cada envío y configurables por ADMIN desde Configuración.
      toTemplate: "comercial@ute.com.uy",
      ccTemplate: "nicolas@voltia.com.uy",
      bccTemplate: "{{cliente.email}}",
      subjectTemplate: SUMINISTRO_INDIVIDUAL_SUBJECT,
      bodyTemplate: SUMINISTRO_INDIVIDUAL_BODY,
      activo: true,
      esSistema: true,
    },
  });
  console.log("✅ Plantilla 'Suministro Individual' sembrada.");
}
