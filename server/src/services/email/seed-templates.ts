import { EmailTemplateScope, Module, type PrismaClient } from "@prisma/client";

// Fuente única de la plantilla de sistema "Consulta UTE". La usan tanto el seed
// general (prisma/seed.ts) como el script standalone (scripts/seed-email-templates.ts),
// para poder sembrarla aunque el seed completo no corra.
//
// Create-if-absent: NO pisa si ya existe (preserva ediciones de ADMIN).
export async function seedConsultaUteTemplate(prisma: PrismaClient): Promise<void> {
  const subjectTemplate =
    "CONSULTA Nuevo Microgenerador{{#if cliente.esEmpresa}} {{cliente.nombre}} - EMPRESA Cta {{suministro.cuenta}}{{else}} - {{cliente.nombre}} - CTA {{suministro.cuenta}}{{/if}}";

  const bodyTemplate = `Buenas tardes, envío consulta para comenzar el trámite de una nueva instalación fotovoltaica en un cliente {{#if cliente.esEmpresa}}empresa{{else}}residencial{{/if}}.
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

Ing. Nicolás Machín
Cel: 098 546 991
nfmj@hotmail.com`;

  const existing = await prisma.emailTemplate.findUnique({ where: { key: "consulta_ute" } });
  if (existing) {
    console.log("ℹ️  Plantilla 'Consulta UTE' ya existe, skip (se preservan ediciones de ADMIN).");
    return;
  }

  await prisma.emailTemplate.create({
    data: {
      key: "consulta_ute",
      nombre: "Consulta UTE",
      descripcion: "Consulta de nuevo microgenerador a UTE desde Onboarding.",
      modulo: Module.ONBOARDING,
      scope: EmailTemplateScope.PROJECT,
      // To/Cc son placeholders editables por ADMIN.
      toTemplate: "microgeneracion@ute.com.uy",
      ccTemplate: "luna@voltia.com.uy",
      bccTemplate: "{{cliente.email}}",
      subjectTemplate,
      bodyTemplate,
      activo: true,
      esSistema: true,
    },
  });
  console.log("✅ Plantilla 'Consulta UTE' sembrada.");
}
