// Traduce el contexto del mail (datos del proyecto, ya editados por el asesor
// en la pantalla) a los campos del formulario de UTE.
//
// Es una traducción y no una copia porque los dos vocabularios no coinciden:
// el formulario separa el nivel de tensión de las fases, llama "General" a lo
// que el mail llama "Comercial", y no tiene campo para el número de cuenta
// (va dentro de Observaciones).

import type { EmailTemplateContext } from "../email/context.service.js";
import type { DatosFormulario } from "./xlsx.service.js";

export function datosFormularioDesdeContexto(ctx: EmailTemplateContext): DatosFormulario {
  return {
    // Suministro
    departamento: ctx.suministro.departamento,
    localidad: ctx.suministro.localidad,
    padron: ctx.suministro.padron,
    calle: ctx.suministro.calle,
    numero: ctx.suministro.numero,
    duplicador: ctx.suministro.duplicador,
    apartamento: ctx.suministro.apartamento,
    avisoAcceso: ctx.suministro.avisoAcceso,
    notificaciones: ctx.suministro.notificaciones,

    // Cliente
    documento: ctx.cliente.documento,
    documentoNro: ctx.cliente.ci,
    nombre: ctx.cliente.nombre,
    telefono: ctx.cliente.telefono,
    email: ctx.cliente.email,

    // Dirección alternativa de notificaciones
    notifCalle: ctx.suministro.notifCalle,
    notifNumero: ctx.suministro.notifNumero,
    notifDuplicador: ctx.suministro.notifDuplicador,
    notifApartamento: ctx.suministro.notifApartamento,
    notifDepartamento: ctx.suministro.notifDepartamento,
    notifLocalidad: ctx.suministro.notifLocalidad,

    // Técnicos
    tipoSolicitud: ctx.tecnica.tipoSolicitud,
    pasaLinea: ctx.tecnica.pasaLinea,
    acometida: ctx.tecnica.acometida,
    tramite: ctx.tecnica.tramite,
    requerimiento: ctx.tecnica.requerimiento,
    actividad: ctx.tecnica.actividad,
    tramiteAsociado: ctx.tecnica.tramiteAsociado,
    tipoMedida: ctx.tecnica.tipoMedida,
    // El formulario pide el nivel ("230 V"), no la descripción completa que
    // usa la consulta de microgenerador ("BT Monofásico 230V").
    tension: ctx.tecnica.tensionNivel,
    tarifa: ctx.tecnica.tarifa,
    fases: ctx.tecnica.fases,
    potenciaSolicitada: ctx.tecnica.potenciaSolicitada,
    dobleContratacion: ctx.tecnica.dobleContratacion,
    potenciaPunta: ctx.tecnica.potenciaPunta,
    certificadoCarga: ctx.tecnica.certificadoCarga,
    instaladaCalefaccion: ctx.tecnica.instaladaCalefaccion,
    cargaPerturbadora: ctx.tecnica.cargaPerturbadora,

    observaciones: ctx.tecnica.observaciones,
  };
}
