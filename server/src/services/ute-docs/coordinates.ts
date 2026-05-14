// Coordenadas portadas tal cual de DOCs_UTE_personas.py.
// Sistema: origen bottom-left (mismo que pdf-lib y reportlab).
// Las tuplas vienen en el orden en que el mapping del Python las consume
// (ver mappings.ts).
//
// Para documentos multipágina (Convenio, Contrato), `null` indica una página
// sin overlay. El array por página puede tener distintos tamaños.

export type Coord = readonly [number, number];

export const SOLICITUD_IMG: readonly (readonly Coord[] | null)[] = [
  [
    [267, 775], // Cliente
    [267, 757], // Cliente (repetido)
    [267, 739], // Mail
    [267, 720], // Cel
    [267, 703], // Cuenta
    [267, 685], // Caso
    [267, 668], // Potencia contratada (×1000)
    [267, 651], // Tarifa
    [267, 618], // Dirección
    [267, 600], // Ciudad
    [380, 600], // Depto
    [253, 583], // Persona Física (X)
    [402, 583], // Empresa (X)
    [300, 568], // CI cliente
    [259, 439], // Potencia nominal
    [259, 419], // Intensidad nominal
    [364, 401], // Tensión 230
    [432, 401], // Tensión 400
    [323, 386], // Fases mono
    [456, 386], // Fases tri
    [259, 367], // Cantidad paneles
    [259, 345], // Cantidad inversores
    [445, 307], // Pot total paneles
    [483, 289], // Área
    [361, 250], // Tipo gen sincrono tri
    [469, 250], // Tipo gen sincrono mono
    [290, 234], // Marca paneles
    [422, 234], // Modelo paneles
    [350, 217], // Serie paneles
    [360, 198], // Pot nom paneles
    [260, 180], // Marca inversor
    [260, 161], // Modelo inversor
    [260, 143], // Serie inversor
    [364, 127], // Tensión nom inv 230
    [432, 127], // Tensión nom inv 400
    [351, 113], // Fases mono (inv)
    [427, 113], // Fases tri (inv)
    [260, 82],  // Pot nom inversor
  ],
];

export const DAR: readonly (readonly Coord[] | null)[] = [
  [
    [100, 726], // Ciudad
    [315, 726], // Día
    [410, 726], // Mes
    [520, 726], // Año
    [280, 706], // FI
    [80, 682],  // RUT
    [280, 682], // Dir FI
    [280, 658], // TI
    [480, 658], // CI TI
    [280, 635], // Cliente
    [90, 612],  // CI Cliente
    [280, 612], // Dir Cliente
    [280, 540], // Dir Cliente 2
    [282, 515], // AS
    [420, 515], // Cuenta UTE
    [95, 490],  // X
    [187, 217], // RUT (firma)
    [440, 217], // Aclaración RUT
    [190, 190], // CI TI (firma)
    [440, 190], // Aclaración firma TI
    [260, 128], // Oficina UTE
    [187, 270], // Doc cliente
    [400, 270], // Aclaración cliente
    [350, 90],  // Nombre cliente (pie)
    [280, 65],  // Día (pie)
    [375, 65],  // Mes (pie)
    [495, 65],  // Año (pie)
  ],
];

export const JURADA_MIN: readonly (readonly Coord[] | null)[] = [
  [
    [130, 722], // Representante
    [250, 700], // CI Repre
    [130, 675], // Cliente
    [460, 675], // CI Cliente
    [160, 652], // Calle
    [480, 652], // Num calle
    [140, 630], // Ciudad
    [380, 630], // Depto
    [160, 608], // Calidad
    [450, 560], // Cuenta
    [140, 536], // PS
    [315, 213], // Ciudad (pie)
    [190, 35],  // Oficina UTE
    [175, 120], // Doc cliente
    [400, 120], // Aclaración cliente
    [100, 188], // Día
    [270, 188], // Mes
    [450, 188], // Año
  ],
];

export const JURADA_TEC: readonly (readonly Coord[] | null)[] = [
  [
    [170, 763], // FI
    [460, 763], // RUT
    [200, 750], // TI
    [220, 736], // CI TI
    [200, 723], // TI (repetido)
    [220, 709], // CI TI (repetido)
    [250, 680], // Cliente
    [200, 666], // Cuenta
    [450, 666], // PS
    [90, 607],  // normas1
    [270, 576], // normas2
    [110, 297], // X
    [300, 166], // Ciudad
    [145, 101], // RUT (firma)
    [430, 101], // TI (firma)
    [150, 80],  // CI TI (firma)
    [430, 80],  // TI (rep firma)
    [190, 31],  // Oficina UTE
    [215, 652], // Día
    [315, 652], // Mes
    [490, 652], // Año
    [80, 150],  // Día (pie)
    [190, 150], // Mes (pie)
    [340, 150], // Año (pie)
    [110, 420], // x1
    [240, 420], // x2
    [110, 405], // x3
    [240, 405], // x4
  ],
];

export const CONVENIO: readonly (readonly Coord[] | null)[] = [
  null, // página 1
  null, // página 2
  [    // página 3
    [120, 710], // Ciudad
    [312, 710], // Día
    [360, 710], // Mes
    [494, 710], // Año (corto)
    [250, 655], // Rep UTE
    [250, 635], // Calidad UTE
    [250, 615], // Cliente
    [320, 598], // CI Cliente
    [250, 578], // Calle
    [466, 578], // Num
    [250, 558], // Cliente (rep)
    [250, 538], // Calidad Repre
    [320, 522], // CI Cliente
  ],
  null, // página 4
  [    // página 5
    [370, 138], // Calle
    [101, 120], // Num calle
    [420, 120], // PS
  ],
  [    // página 6
    [103, 730], // X
    [310, 529], // Pot IMG
    [120, 514], // Pot IMG num
    [284, 486], // Pot contratada
    [120, 470], // Pot contratada num
    [406, 441], // Pot IMG (rep)
    [120, 426], // Pot IMG num (rep)
  ],
  [    // página 7
    [260, 690], // fp
  ],
  null, // 8
  null, // 9
  null, // 10
  null, // 11
  null, // 12
  null, // 13
  [    // página 14 — datos del cliente (firma)
    [150, 703], // Cliente
    [150, 658], // Dir cliente
    [200, 628], // Mail
  ],
];

export const SOL_HAB: readonly (readonly Coord[] | null)[] = [
  [
    [100, 726], // Ciudad
    [315, 726], // Día fin
    [407, 726], // Mes fin
    [520, 726], // Año fin
    [150, 704], // Cliente
    [470, 704], // CI Cliente
    [180, 635], // FI
    [470, 635], // RUT
    [280, 612], // TI
    [280, 590], // CI TI
    [280, 568], // TI (rep)
    [280, 545], // CI TI (rep)
    [270, 472], // Día convenio
    [380, 472], // Mes convenio
    [511, 473], // Año convenio
    [115, 448], // Cuenta
    [424, 448], // PS
    [190, 180], // CI Cliente (firma)
    [380, 180], // Cliente (firma)
    [190, 120], // RUT (firma)
    [440, 120], // TI (firma)
    [190, 92],  // CI TI (firma)
    [440, 92],  // TI (rep firma)
    [250, 32],  // Oficina UTE
  ],
];

export const ACTA_HAB: readonly (readonly Coord[] | null)[] = [
  [
    [100, 726], // Ciudad
    [311, 726], // Día fin
    [407, 726], // Mes fin
    [520, 726], // Año fin
    [150, 704], // Cliente
    [470, 704], // CI Cliente
    [180, 635], // FI
    [470, 635], // RUT
    [280, 612], // TI
    [280, 590], // CI TI
    [280, 568], // TI (rep)
    [280, 545], // CI TI (rep)
    [306, 473], // Día convenio
    [390, 473], // Mes convenio
    [513, 473], // Año convenio
    [115, 450], // Cuenta
    [424, 450], // PS
    [190, 180], // CI Cliente (firma)
    [380, 180], // Cliente (firma)
    [190, 120], // RUT (firma)
    [440, 120], // TI (firma)
    [190, 92],  // CI TI (firma)
    [440, 92],  // TI (rep firma)
    [250, 32],  // Oficina UTE
  ],
];

export const CONTRATO: readonly (readonly Coord[] | null)[] = [
  [    // página 1
    [120, 695], // Ciudad
    [312, 695], // Día fin
    [360, 695], // Mes fin
    [493, 695], // Año (corto)
    [250, 640], // Rep UTE
    [250, 620], // Calidad UTE
    [250, 600], // Cliente
    [325, 583], // CI Cliente
    [220, 562], // Calle
    [464, 562], // Num
    [255, 544], // Representa
    [205, 527], // Calidad Repre
    [350, 507], // CI Repre
  ],
  [    // página 2
    [145, 602], // Dir cliente
    [185, 582], // Ciudad
    [225, 562], // Depto
    [186, 544], // Cuenta
    [431, 544], // PS
    [313, 524], // Pot contratada
    [348, 476], // Día
    [373, 476], // Mes (número)
    [400, 476], // Año (corto)
    [100, 438], // Pot IMG
    [240, 419], // Pot IMG (rep)
  ],
];

export const COORDINATES = {
  solicitud_img: SOLICITUD_IMG,
  dar: DAR,
  jurada_min: JURADA_MIN,
  jurada_tec: JURADA_TEC,
  convenio: CONVENIO,
  sol_hab: SOL_HAB,
  acta_hab: ACTA_HAB,
  contrato: CONTRATO,
} as const;

export type UteDocKey = keyof typeof COORDINATES;
export const UTE_DOC_KEYS: UteDocKey[] = [
  "solicitud_img",
  "dar",
  "jurada_min",
  "jurada_tec",
  "convenio",
  "sol_hab",
  "acta_hab",
  "contrato",
];

// Etiqueta legible para nombrar archivos del ZIP y mostrar en UI.
export const UTE_DOC_LABEL: Record<UteDocKey, string> = {
  solicitud_img: "Solicitud_IMG",
  dar: "DAR",
  jurada_min: "Jurada_Min",
  jurada_tec: "Jurada_Tec",
  convenio: "Convenio",
  sol_hab: "Sol_Hab",
  acta_hab: "Acta_Hab",
  contrato: "Contrato",
};

// Nombre del archivo PDF "limpio" en server/src/assets/ute-templates/.
// Los `original_*.pdf` que provee UTE vienen con encripción y referencias
// malformadas que pdf-lib no puede parsear. El script
// `prepare-ute-templates.py` los normaliza una vez (PyPDF2 decrypt + rewrite)
// produciendo `clean_*.pdf` que sí son compatibles con pdf-lib.
export const UTE_DOC_TEMPLATE: Record<UteDocKey, string> = {
  solicitud_img: "clean_Solicitud_IMG.pdf",
  dar: "clean_DAR.pdf",
  jurada_min: "clean_JuradaMin.pdf",
  jurada_tec: "clean_JuradaTec.pdf",
  convenio: "clean_Convenio.pdf",
  sol_hab: "clean_Sol_Hab.pdf",
  acta_hab: "clean_Acta_Hab.pdf",
  contrato: "clean_Contrato.pdf",
};
