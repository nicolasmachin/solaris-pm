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
FICHA_ENCABEZADO = "/_blob/0668c9715214e19bfb962f90def1e356"  # el recorte que entra en la página 28
FICHA_CLIENTE = "/_blob/7d12e76a60ddf71686963835eeae7ae9"
TRAMITE_UTE = "/_blob/c6b293f462d3d2e3272cbbb22cdbcd54"
PLANTILLAS = "/_blob/0931914e600bb5e58f7a3d18b911eb75"
PORTAL_CLIENTE = "/_blob/ba28daa6ab82cd96e68263c2429930b5"
REPORTES_FV = "/_blob/3a4089cd2f312ead916c4184c7c99086"
LISTADO_CLIENTES = "/_blob/685c0ffbd6517ff5b75a7e65842864c9"
RECORRIDO_ETAPAS = "/_blob/7e790e097b7b7f2659e88cee1a86f3e6"
CALENDARIO = "/_blob/5e4bc2b717be45ea55913a98004d51ce"
PASOS_E2 = "/_blob/f1ee815f7a6797acf2f7d1a3bdc1632e"     # la Regla de Oro, en su paso
