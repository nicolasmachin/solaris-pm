"""Las fotos y capturas del manual, ya subidas como assets del canvas.

Se referencian por la URL que devolvió la subida, tal cual: son rutas del
propio artifact y resuelven en cualquier vista. No poner `data:` ni nombres de
archivo, que no resuelven.

Para reemplazar una imagen hay que volver a subirla (queda otra id) y cambiar
la línea de acá. El script que las prepara en la medida correcta es
`preparar-imagenes.mjs`; el que saca las capturas de la app, `capturas.mjs`.
"""

# El logo de marca, en las tres formas que usa la maqueta.
LOGO = "/_blob/fceabe45b0a94985f8b086c5659dd1b0"              # completo, portada y cierre
LOGO_ISOTIPO = "/_blob/baa0359c4ef0ed78003b3e040a4963aa"       # solo la V, pies sobre blanco
LOGO_ISOTIPO_BLANCO = "/_blob/17e994db89caae8d602d7657a2149918"  # solo la V, pies sobre azul

# Fotos de instalaciones nuestras.
PORTADA = "/_blob/b2f147bf02b92484b8558c53a06e0ae0"          # aérea, tres filas a suelo
PORTADILLA_E1 = "/_blob/ba026e93a5c4deccb1cce71f3f8a2bf9"     # estructura en obra
PORTADILLA_E2 = "/_blob/294fb9b20f0c556a8474cbe3f2f76e65"     # techo terminado, esperando UTE
PORTADILLA_E3 = "/_blob/7a6e4b4dd365df3dec1ddc9ab43b6bc3"     # atardecer, ya generando
CIERRE = "/_blob/9e1076439b37ecb7e912e7e51fd3241f"            # azotea, banda de cierre

# Capturas de la app.
FICHA_ENCABEZADO = "/_blob/4b0e4c73872534bd2d5c0371ae2947b3"  # el recorte que entra en la página 28
FICHA_CLIENTE = "/_blob/9feab197ce54933b2e9be57dd0d9e33c"
TRAMITE_UTE = "/_blob/8a9347575a8b4c80a048a70320cb30ef"
PLANTILLAS = "/_blob/1147f42b1f562d8674c0b804534c5a92"
PORTAL_CLIENTE = "/_blob/3d9b760e21b780239ba99bc7806e8b1c"
REPORTES_FV = "/_blob/1a7d22406797c0e5da1d309f7cb4ed42"
LISTADO_CLIENTES = "/_blob/3e3f15d04e34eceff2402c344251aa2c"
RECORRIDO_ETAPAS = "/_blob/3ab00a0e1108336f05c53e54570f32f8"
CALENDARIO = "/_blob/441a3c0aa3e4bcdba002c019e5fb7005"
PASOS_E2 = "/_blob/960f2d93e35cd66880b05906700cb762"     # la Regla de Oro, en su paso
