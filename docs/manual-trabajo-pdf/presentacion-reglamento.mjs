// Presentación del Reglamento interno de Operaciones para la reunión con el
// equipo de obra. Mismo diseño que los manuales (colores, fuentes, fotos), en
// diapositivas 16:9 que salen a PDF.
//
//   node docs/manual-trabajo-pdf/presentacion-reglamento.mjs <salida.pdf> [carpeta-vistas]
//
// Corre con el Playwright de ~/tools/pw (o el de PW_DIR).
// El contenido sale del reglamento (docs/Reglamento-Interno-Operaciones.md) y de
// las notas de docs/pendientes/presentacion-reglamento.md: si cambia algo ahí,
// se corrige acá a mano.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import { createRequire } from "node:module";
// Playwright está instalado en ~/tools/pw, fuera del repo.
const { chromium } = createRequire(path.join(process.env.PW_DIR ?? path.join(os.homedir(), "tools/pw"), "x.js"))("playwright");

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const IMG = (n) => "file://" + path.join(AQUI, "imagenes", n);
const [salida, vistas] = process.argv.slice(2);

const AZUL = "#1836b2", NEGRO = "#10131f", TEXTO = "#3a3e50", GRIS = "#6b7188",
  BORDE = "#e6e8f2", FONDO = "#f4f6fd", VERDE = "#3d6b47", VERDE_F = "#e9f4ea",
  ROJO = "#8f1d1d", ROJO_F = "#fbeeee";
const SANS = "'Barlow', sans-serif", SERIF = "'Source Serif 4', Georgia, serif";
const W = 1280, H = 720;

const pie = (n, oscuro = false) => `
  <div style="position:absolute; left:72px; right:72px; bottom:28px; display:flex; justify-content:space-between;
    align-items:center; font-family:${SANS}; font-size:14px; color:${oscuro ? "#8f9ad4" : GRIS}">
    <span style="display:flex; align-items:center; gap:8px"><img src="${IMG(oscuro ? "logo-isotipo-blanco.png" : "logo-isotipo.png")}" style="height:14px">Reglamento interno de Operaciones</span>
    <span>${n}</span></div>`;

const encabezado = (rotulo, titulo) => `
  <div style="font-family:${SANS}; font-size:15px; font-weight:600; letter-spacing:3px; color:${AZUL}">${rotulo}</div>
  <h1 style="margin:8px 0 0; font-family:${SANS}; font-size:44px; font-weight:700; letter-spacing:-1px; line-height:1.05; color:${NEGRO}">${titulo}</h1>
  <div data-cuerpo style="flex:1; display:flex; flex-direction:column; justify-content:center; padding-bottom:36px">`;

const num = (n, fondo = AZUL) => `<span style="flex-shrink:0; width:40px; height:40px; border-radius:50%; background:${fondo};
  color:#fff; font-family:${SANS}; font-weight:700; font-size:19px; display:flex; align-items:center; justify-content:center">${n}</span>`;

// Tarjetas con número: el motivo de toda la presentación.
const tarjetas = (items, cols = 2, tam = 21) => `
  <div style="display:grid; grid-template-columns:repeat(${cols}, 1fr); gap:20px; margin-top:34px">
    ${items.map(([t, d], i) => `<div style="background:${FONDO}; border-radius:14px; padding:22px 24px; display:flex; gap:16px">
      ${num(i + 1)}<div><div style="font-family:${SANS}; font-weight:700; font-size:${tam + 2}px; color:${NEGRO}; line-height:1.2">${t}</div>
      ${d ? `<div style="margin-top:6px; font-family:${SERIF}; font-size:${tam - 2}px; line-height:1.4; color:${TEXTO}">${d}</div>` : ""}</div></div>`).join("")}
  </div>`;

const hoja = (cuerpo, n, { fondo = "#fff", oscuro = false } = {}) => `
  <section style="width:${W}px; height:${H}px; position:relative; overflow:hidden; background:${fondo}; box-sizing:border-box; padding:60px 72px; display:flex; flex-direction:column">
    ${cuerpo}${cuerpo.includes("data-cuerpo") ? "</div>" : ""}${n ? pie(n, oscuro) : ""}</section>`;

const S = [];

// 1 · Portada
S.push(`<section style="width:${W}px; height:${H}px; position:relative; overflow:hidden; display:flex; background:#fff">
  <div style="width:600px; height:100%; background:url('${IMG("reglamento-portada.jpg")}') center/cover"></div>
  <div style="flex:1; padding:80px 64px; display:flex; flex-direction:column">
    <img src="${IMG("logo-completo.png")}" style="height:46px; align-self:flex-start">
    <div style="flex:1"></div>
    <div style="font-family:${SANS}; font-size:16px; font-weight:600; letter-spacing:3px; color:${AZUL}">EQUIPO DE OPERACIONES</div>
    <h1 style="margin:12px 0 0; font-family:${SANS}; font-size:66px; font-weight:700; letter-spacing:-2px; line-height:1; color:${NEGRO}">Reglamento interno</h1>
    <p style="margin:22px 0 0; font-family:${SERIF}; font-size:23px; line-height:1.45; color:${TEXTO}">Las reglas claras, para todos y por escrito.</p>
    <div style="flex:1"></div>
    <div style="font-family:${SANS}; font-size:15px; color:${GRIS}">Versión para conversar · noviembre de 2026</div>
  </div></section>`);

// 2 · Para qué
S.push(hoja(`${encabezado("PARA QUÉ ES", "Reglas claras, sin teléfono descompuesto")}
  <p style="margin:18px 0 0; max-width:900px; font-family:${SERIF}; font-size:23px; line-height:1.45; color:${TEXTO}">
  Que nadie tenga que adivinar. Lo que está escrito vale para todos, y lo que se acuerda queda anotado.
  El reglamento separa tres cosas:</p>
  ${tarjetas([
    ["Lo que marca la ley", "No se discute, ni para un lado ni para el otro."],
    ["Lo que Voltia da por encima de la ley", "Decisiones de la empresa, que dependen de que el equipo funcione bien."],
    ["Lo que Voltia espera de cada uno", "Avisos, permisos, reclamos, conducta y seguridad."],
  ], 3)}`, 2));

// 3 · Ley: feriados
S.push(hoja(`${encabezado("LO QUE MARCA LA LEY", "Feriados: hay dos clases")}
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:34px">
    <div style="background:${AZUL}; border-radius:16px; padding:30px 32px; color:#fff">
      <div style="font-family:${SANS}; font-size:15px; font-weight:600; letter-spacing:2px; color:#c9d2f5">FERIADOS PAGOS · 7</div>
      <div style="margin-top:12px; font-family:${SANS}; font-size:30px; font-weight:700; line-height:1.25">1&nbsp;de&nbsp;enero · 1&nbsp;de&nbsp;mayo · 18&nbsp;de&nbsp;julio · 25&nbsp;de&nbsp;agosto · 25&nbsp;de&nbsp;diciembre</div>
      <div style="margin-top:10px; font-family:${SANS}; font-size:24px; font-weight:600; color:#dde3f8">+ por ser de la construcción: 2&nbsp;de&nbsp;noviembre y tercer lunes de octubre</div>
      <div style="margin-top:22px; font-family:${SERIF}; font-size:22px; color:#fff">Si se trabajan, se pagan <b>doble</b>.</div>
    </div>
    <div style="background:${FONDO}; border-radius:16px; padding:30px 32px">
      <div style="font-family:${SANS}; font-size:15px; font-weight:600; letter-spacing:2px; color:${AZUL}">FERIADOS COMUNES</div>
      <div style="margin-top:12px; font-family:${SANS}; font-size:30px; font-weight:700; line-height:1.25; color:${NEGRO}">6&nbsp;de&nbsp;enero · Carnaval · Turismo · 19&nbsp;de&nbsp;abril · 18&nbsp;de&nbsp;mayo · 19&nbsp;de&nbsp;junio · 12&nbsp;de&nbsp;octubre</div>
      <div style="margin-top:22px; font-family:${SERIF}; font-size:22px; color:${TEXTO}">Se trabajan y se pagan <b>normal</b>.</div>
    </div>
  </div>
  <p style="margin:26px 0 0; font-family:${SERIF}; font-size:21px; color:${TEXTO}">El 2 de noviembre de este año se les paga doble a quienes trabajaron.</p>`, 3));

// 4 · Ley: plata y días
S.push(hoja(`${encabezado("LO QUE MARCA LA LEY", "Horas extra, licencia y aguinaldo")}
  ${tarjetas([
    ["Horas extra", "Con el acuerdo del trabajador y hasta 8 por semana. El doble en día hábil; dos veces y media en el día de descanso o en un feriado."],
    ["Licencia", "20 días por año, más días por antigüedad desde el quinto año. Se toma de corrido."],
    ["Salario vacacional", "Lo mismo que se cobra en mano por los días de licencia. Se paga antes de salir."],
    ["Aguinaldo", "La doceava parte de lo cobrado en el año, en dos cuotas: junio y diciembre."],
  ], 2)}`, 4));

// 5 · Ley: salud y licencias especiales
S.push(hoja(`${encabezado("LO QUE MARCA LA LEY", "Salud, accidentes y licencias especiales")}
  ${tarjetas([
    ["Enfermedad", "Se avisa que se está certificado: el certificado lo carga el médico en el BPS. El BPS paga desde el cuarto día."],
    ["Accidente de trabajo", "Lo cubre el BSE. Se avisa el mismo día: Voltia lo tiene que denunciar en plazo."],
    ["Estudios médicos", "Por el convenio de la construcción: 3 días por año, más uno para el examen de próstata, avisando con 48 horas."],
    ["Licencias especiales", "Pagas: paternidad (20 días), matrimonio (3), duelo (3 hábiles), estudio y donación de sangre."],
  ], 2)}`, 5));

// 6 · Lo que da Voltia
S.push(hoja(`${encabezado("LO QUE VOLTIA DA POR ENCIMA DE LA LEY", "Más descanso, mejor ropa, más flexibilidad")}
  <div style="display:flex; gap:28px; margin-top:30px; align-items:stretch">
    <div style="width:330px; flex-shrink:0; background:${AZUL}; border-radius:16px; padding:30px; color:#fff; display:flex; flex-direction:column; justify-content:center">
      <div style="font-family:${SANS}; font-size:84px; font-weight:700; line-height:1">≈ 2</div>
      <div style="margin-top:6px; font-family:${SANS}; font-size:26px; font-weight:600">semanas más de descanso pago por año</div>
      <div style="margin-top:12px; font-family:${SERIF}; font-size:18px; color:#dde3f8">Por los días libres y por contar la licencia de lunes a viernes.</div>
    </div>
    <div style="flex:1">${tarjetas([
      ["6 días libres pagos", "24 y 31 de diciembre, lunes y martes de Carnaval, jueves y viernes de Turismo."],
      ["Licencia coordinada", "Cada uno propone cuándo, en vez de fechas fijas para todos."],
      ["Ropa de primera calidad", "Dos equipos por año. Nadie trabaja con ropa propia."],
      ["Trámites sin descuento", "Si se pide con tiempo, las horas se recuperan."],
    ], 2, 19).replace("margin-top:34px", "margin-top:0")}</div>
  </div>
  <p style="margin:22px 0 0; font-family:${SERIF}; font-size:19px; color:${TEXTO}">En el interior: viático de $ 1.100 por día y casas con cocina siempre que se pueda.</p>`, 6));

// 7 · Marcas
S.push(hoja(`${encabezado("NUEVO", "Se marca la entrada y la salida")}
  <div style="display:flex; gap:40px; margin-top:34px">
    <div style="flex:1">${tarjetas([
      ["Con la aplicación del teléfono", "Sirve también en las obras del interior."],
      ["O en el reloj del depósito", "Para no depender del teléfono ni de internet."],
      ["Marcar es responsabilidad de cada uno", "Si alguien no pudo, le avisa ese día al gerente de Operaciones."],
    ], 1, 21).replace("margin-top:34px", "margin-top:0")}</div>
    <div style="width:420px; background:${FONDO}; border-radius:16px; padding:30px 32px; align-self:flex-start">
      <div style="font-family:${SANS}; font-size:15px; font-weight:600; letter-spacing:2px; color:${AZUL}">LA UBICACIÓN</div>
      <p style="margin:12px 0 0; font-family:${SERIF}; font-size:22px; line-height:1.45; color:${TEXTO}">La aplicación toma la ubicación solo al marcar y durante la jornada. Nunca fuera de hora, y solo para el horario.</p>
    </div>
  </div>`, 7));

// 8 · Permisos
S.push(hoja(`${encabezado("NUEVO", "Lo que se puede prever, se pide")}
  <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:22px; margin-top:34px">
    ${[["SE PIDE", "Turnos, trámites, llegar tarde, irse antes", "Fuera de hora siempre que se pueda. Si no, se pide por escrito al gerente, con tiempo, y se espera la respuesta. No la noche antes.", AZUL, "#fff"],
       ["SE AVISA", "Enfermedad, urgencia, accidente", "Apenas se sabe.", FONDO, NEGRO],
       ["ES UN DERECHO", "Licencias especiales y estudios médicos", "Se avisan y se acreditan. Estudios médicos: con 48 horas.", FONDO, NEGRO]]
      .map(([r, t, d, f, c]) => `<div style="background:${f}; border-radius:16px; padding:28px 28px">
        <div style="font-family:${SANS}; font-size:15px; font-weight:600; letter-spacing:2px; color:${f === AZUL ? "#c9d2f5" : AZUL}">${r}</div>
        <div style="margin-top:10px; font-family:${SANS}; font-size:26px; font-weight:700; line-height:1.2; color:${c}">${t}</div>
        <div style="margin-top:12px; font-family:${SERIF}; font-size:19px; line-height:1.45; color:${f === AZUL ? "#e6eaf9" : TEXTO}">${d}</div></div>`).join("")}
  </div>
  <p style="margin:26px 0 0; font-family:${SERIF}; font-size:20px; color:${TEXTO}">"Capaz que no voy" no es un aviso. Quien tiene permiso para llegar tarde va directo a la obra; Voltia le reintegra el boleto.</p>`, 8));

// 9 · Jornada y obra
S.push(hoja(`${encabezado("EL DÍA A DÍA", "Jornada, lluvia y horas extra")}
  ${tarjetas([
    ["8 horas corridas", "Con media hora de descanso paga, coordinada con el capataz. Nunca más de 5 horas seguidas."],
    ["Si llueve, el día no se pierde", "Se vuelve al depósito y se trabaja ahí. Es un día normal."],
    ["Horas extra que se pagan", "Las que pide el trabajo, o las que el capataz aprueba para terminar la obra."],
    ["Quedarse por cuenta propia", "Está bien visto, pero no es hora extra. Si se quiere cobrar, se pide antes por escrito."],
  ], 2)}`, 9));

// 10 · Conducta
S.push(hoja(`${encabezado("LO QUE VOLTIA ESPERA", "Conducta y trato")}
  <div style="display:flex; gap:32px; margin-top:30px">
    <div style="flex:1">${tarjetas([
      ["Los reclamos, a quien corresponde", "Al gerente de Operaciones o a la Dirección, en privado. No en el grupo ni de pasillo."],
      ["Los grupos de WhatsApp, para coordinar", "No para quejas ni para hablar de los compañeros."],
      ["En redes, con respeto", "Se puede opinar y criticar. Insultos, amenazas o acusaciones, no."],
      ["Ni una colilla", "No se fuma en la propiedad del cliente: solo afuera."],
    ], 2, 19).replace("margin-top:34px", "margin-top:0")}</div>
  </div>`, 10));

// 11 · Seguridad (oscura)
S.push(hoja(`<div style="font-family:${SANS}; font-size:15px; font-weight:600; letter-spacing:3px; color:#8f9ad4">SEGURIDAD</div>
  <h1 style="margin:8px 0 0; font-family:${SANS}; font-size:60px; font-weight:700; letter-spacing:-1.5px; color:#fff">Si no es seguro, no se empieza</h1>
  <div style="margin-top:34px; border-top:1px solid #2a2f45">
    ${["El equipo de protección no sirve en la obra: tiene que estar puesto.",
       "Desde 2 metros: arnés, cabo de vida y anclaje. Nadie trabaja solo en altura.",
       "Cualquiera puede y debe parar una tarea si ve un riesgo grave.",
       "Si el gerente encuentra a alguien sin protección, se sanciona también al capataz."]
      .map((t, i) => `<div style="display:flex; gap:20px; align-items:baseline; padding:18px 0; border-bottom:1px solid #2a2f45">
        <span style="font-family:${SANS}; font-size:20px; font-weight:700; color:#7f8fd8; width:30px">0${i + 1}</span>
        <span style="font-family:${SANS}; font-size:28px; font-weight:600; color:#fff; line-height:1.25">${t}</span></div>`).join("")}
  </div>`, 11, { fondo: NEGRO, oscuro: true }));

// 12 · Sanciones
S.push(hoja(`${encabezado("SANCIONES", "Faltas por puntos, en 12 meses")}
  <div style="display:flex; gap:32px; margin-top:30px">
    <div style="width:330px; flex-shrink:0; display:flex; flex-direction:column; gap:18px">
      <div style="background:${FONDO}; border-radius:14px; padding:22px 24px"><div style="font-family:${SANS}; font-size:22px; font-weight:700; color:${NEGRO}">Falta leve · 1 punto</div>
        <div style="margin-top:6px; font-family:${SERIF}; font-size:18px; color:${TEXTO}">Llegar tarde, no marcar, dejar colillas, faltar sin permiso.</div></div>
      <div style="background:${FONDO}; border-radius:14px; padding:22px 24px"><div style="font-family:${SANS}; font-size:22px; font-weight:700; color:${NEGRO}">Falta grave · 2 puntos</div>
        <div style="margin-top:6px; font-family:${SERIF}; font-size:18px; color:${TEXTO}">Trabajar sin protección, faltar sin aviso, falsear las marcas.</div></div>
    </div>
    <div style="flex:1">
      ${[["1", "Observación por escrito"], ["2", "Apercibimiento"], ["3", "Segundo apercibimiento"], ["4", "Suspensión de un día"], ["5", "Suspensión de dos días"], ["6+", "Puede considerarse notoria mala conducta"]]
        .map(([p, s], i) => `<div style="display:flex; align-items:center; gap:18px; padding:9px 0; border-bottom:1px solid ${BORDE}">
          ${num(p, i === 5 ? ROJO : AZUL)}<span style="font-family:${SANS}; font-size:23px; font-weight:600; color:${NEGRO}">${s}</span></div>`).join("")}
    </div>
  </div>
  <p style="margin:20px 0 0; font-family:${SERIF}; font-size:19px; color:${TEXTO}">Antes de cada sanción escrita hay derecho a descargo. Nada es automático: decide la Gerencia.</p>`, 12));

// 13 · Sábados (consulta)
S.push(hoja(`${encabezado("UNA CONSULTA", "¿Medio día los sábados?")}
  <div style="display:flex; gap:40px; margin-top:34px; align-items:center">
    <div style="flex:1">
      <p style="margin:0; font-family:${SERIF}; font-size:26px; line-height:1.5; color:${TEXTO}">Queremos saber quién estaría interesado en pasar de 40 a 44 horas por semana, trabajando medio día los sábados, <b>con un aumento de sueldo un poco mejor que proporcional</b>.</p>
      <p style="margin:24px 0 0; font-family:${SERIF}; font-size:22px; line-height:1.5; color:${GRIS}">Es solo una consulta. Si sale, el acuerdo se arma después, por escrito y con la contadora.</p>
    </div>
    <div style="width:300px; height:300px; border-radius:50%; background:${FONDO}; display:flex; flex-direction:column; align-items:center; justify-content:center">
      <div style="font-family:${SANS}; font-size:96px; font-weight:700; color:${AZUL}; line-height:1">44</div>
      <div style="font-family:${SANS}; font-size:22px; font-weight:600; color:${NEGRO}">horas por semana</div>
    </div>
  </div>`, 13));

// 14 · Próximos pasos
S.push(hoja(`${encabezado("CÓMO SIGUE", "Próximos pasos")}
  ${tarjetas([
    ["Cada uno se lleva el reglamento", "Para leerlo con tiempo y traer las dudas."],
    ["Lo terminamos de confirmar con la contadora", "Algunos puntos se pueden ajustar."],
    ["La semana que viene se firma", "Cada uno firma que lo recibió, lo leyó y lo acepta."],
    ["Autorización de imagen, aparte", "Para las fotos en redes: es optativa y no firmarla no tiene ninguna consecuencia."],
  ], 2)}`, 14));

// 15 · Cierre
S.push(`<section style="width:${W}px; height:${H}px; position:relative; overflow:hidden; display:flex; background:#fff">
  <div style="flex:1; padding:80px 72px; display:flex; flex-direction:column; justify-content:center">
    <h1 style="margin:0; font-family:${SANS}; font-size:84px; font-weight:700; letter-spacing:-2px; color:${NEGRO}">¿Preguntas?</h1>
    <p style="margin:20px 0 0; font-family:${SERIF}; font-size:24px; color:${TEXTO}">Lo que no quede claro hoy, se lo plantean al gerente de Operaciones.</p>
    <img src="${IMG("logo-completo.png")}" style="height:46px; align-self:flex-start; margin-top:60px">
  </div>
  <div style="width:560px; height:100%; background:url('${IMG("reglamento-cierre.jpg")}') center/cover"></div></section>`);

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap" rel="stylesheet">
<style>@page{size:${W}px ${H}px;margin:0} html,body{margin:0;padding:0} section{break-after:page} b{color:inherit}</style>
</head><body>${S.join("\n")}</body></html>`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: W, height: H } });
const tmp = path.join(path.dirname(path.resolve(salida)), "presentacion-reglamento.html");
fs.writeFileSync(tmp, html);
await pagina.goto("file://" + tmp, { waitUntil: "networkidle" });
await pagina.evaluate(() => document.fonts.ready);
await pagina.pdf({ path: salida, width: `${W}px`, height: `${H}px`, printBackground: true });
if (vistas) {
  fs.mkdirSync(vistas, { recursive: true });
  const secciones = await pagina.$$("section");
  for (let i = 0; i < secciones.length; i++) {
    await secciones[i].screenshot({ path: path.join(vistas, `d${String(i + 1).padStart(2, "0")}.png`) });
  }
}
// Hojas que se pasan de alto: el contenido no puede salir del recuadro.
const pasadas = await pagina.$$eval("section", (ss) => ss.map((s, i) => [i + 1, s.scrollHeight]).filter(([, h]) => h > 720));
console.log(`${S.length} diapositivas → ${salida}`, pasadas.length ? `· se pasan: ${JSON.stringify(pasadas)}` : "· todas entran");
await navegador.close();
