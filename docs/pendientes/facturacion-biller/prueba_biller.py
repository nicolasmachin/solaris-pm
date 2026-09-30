"""
Prueba de la API de Biller en ambiente de TEST (según el OpenAPI de biller-labs, sept-2026).

Cubre los criterios de aceptación del handoff:
  A) e-Factura a CRÉDITO con fecha de hace 10 días  -> aceptada DGI
  B) e-Factura CONTADO con fecha de hace 5 días     -> aceptada DGI
  C) Reenvío con el mismo numero_interno que A       -> ¿rechaza o duplica?
  D) Dos recibos parciales (40% + 60%) sobre A        -> A queda cobrada
  E) Nota de crédito PARCIAL (112) sobre B
  F) PDF de A
  G) Estado de las notificaciones por mail de A

Uso (desde la raíz del repo, con BILLER_TOKEN y BILLER_SUCURSAL en .env):
  set -a; source .env; set +a
  python3 docs/pendientes/facturacion-biller/prueba_biller.py

Deja todo lo que pasa en biller_salida_<timestamp>.json al lado del script.
"""
import base64
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("BILLER_BASE", "https://test.biller.uy")
TOKEN = os.environ.get("BILLER_TOKEN")
SUCURSAL = os.environ.get("BILLER_SUCURSAL")
if not TOKEN or not SUCURSAL:
    sys.exit("Falta BILLER_TOKEN o BILLER_SUCURSAL")
if "test." not in BASE:
    sys.exit(f"Este script es solo para TEST y BILLER_BASE apunta a {BASE}")

AQUI = os.path.dirname(os.path.abspath(__file__))
STAMP = int(time.time())
LOG = []


def api(method, path, body=None, params=None):
    time.sleep(1.2)  # límite: 1 pedido por segundo al emitir/consultar DGI
    url = BASE + path + ("?" + urllib.parse.urlencode(params) if params else "")
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    for intento in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                status, raw = r.status, r.read().decode()
        except urllib.error.HTTPError as e:
            status, raw = e.code, e.read().decode()
        if status != 429:
            break
        time.sleep(3 * (intento + 1))
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        parsed = raw
    LOG.append({"method": method, "url": url, "body": body, "status": status,
                "response": parsed if not (isinstance(parsed, str) and len(parsed) > 500) else parsed[:200] + "…"})
    return status, parsed


def paso(titulo):
    print(f"\n=== {titulo}")


def ok(st):
    return st in (200, 201)


def detalle(cid):
    return api("GET", "/v3/comprobantes/detalle", params={"id": cid})


def esperar_aceptado(cid, max_seg=60):
    """Sin webhooks: se consulta el detalle hasta un estado final. La guía técnica
    llama "Esperando aceptación" al intermedio; el handoff decía "Pendiente DGI"."""
    t0 = time.time()
    while True:
        st, d = detalle(cid)
        estado = d.get("estado") if isinstance(d, dict) else None
        print(f"   estado de {cid}: {st} {estado}")
        intermedio = estado and ("Pendiente" in estado or "Esperando" in estado)
        if not ok(st) or (estado and not intermedio) or time.time() - t0 > max_seg:
            return st, d
        time.sleep(3)


hoy = dt.date.today()
ddmm = lambda d: d.strftime("%d/%m/%Y")

# RUT de ejemplo de la propia documentación de Biller
cliente = {
    "tipo_documento": 2,
    "documento": "214987440015",
    "razon_social": "Arcos Plateados SRL",
    "sucursal": {"direccion": "Amézaga 2100", "ciudad": "Montevideo",
                 "departamento": "Montevideo", "pais": "UY"},
}
item_fv = {"codigo": "FV-6KW", "cantidad": 1, "concepto": "Instalación solar fotovoltaica 6 kW",
           "precio": 1000, "indicador_facturacion": 3}


def factura(tipo_pago, fecha, interno, **extra):
    body = {
        "tipo_comprobante": 111,
        "numero_interno": interno,
        "forma_pago": tipo_pago,
        "fecha_emision": ddmm(fecha),
        "sucursal": int(SUCURSAL),
        "moneda": "USD",
        "montos_brutos": 0,
        "cliente": cliente,
        "items": [item_fv],
        "adenda": "Obra de prueba Voltia PM",
        **extra,
    }
    return api("POST", "/v3/comprobantes/emitir", body)


resumen = {}

# A) crédito con fecha anterior
fa = hoy - dt.timedelta(days=10)
interno_a = f"VOLTIA-TEST-A-{STAMP}"
paso(f"A) e-Factura CRÉDITO fecha {ddmm(fa)}")
st, A = factura(2, fa, interno_a, fecha_vencimiento=ddmm(fa + dt.timedelta(days=30)))
print(st, A)
if not ok(st):
    json.dump(LOG, open(os.path.join(AQUI, f"biller_salida_{STAMP}.json"), "w"), ensure_ascii=False, indent=2)
    sys.exit("No se pudo emitir A; revisá el error de arriba.")
aid = A["id"]
st, dA = esperar_aceptado(aid)
resumen["A"] = {"id": aid, "estado": dA.get("estado"), "fecha_emision": dA.get("fecha_emision"),
                "total": dA.get("total"), "tasa_cambio": dA.get("tasa_cambio")}
print(resumen["A"])

# B) contado con fecha anterior
fb = hoy - dt.timedelta(days=5)
paso(f"B) e-Factura CONTADO fecha {ddmm(fb)}")
st, B = factura(1, fb, f"VOLTIA-TEST-B-{STAMP}")
print(st, B)
bid = B.get("id") if ok(st) else None
if bid:
    st, dB = esperar_aceptado(bid)
    resumen["B"] = {"id": bid, "estado": dB.get("estado"), "fecha_emision": dB.get("fecha_emision"),
                    "total": dB.get("total")}
    print(resumen["B"])

# C) duplicado: mismo numero_interno que A
paso("C) Reenvío con el mismo numero_interno que A")
st, C = factura(2, fa, interno_a, fecha_vencimiento=ddmm(fa + dt.timedelta(days=30)))
print(st, C)
st2, por_interno = api("GET", "/v2/comprobantes/obtener",
                       params={"desde": f"{fa} 00:00:00", "numero_interno": interno_a})
n = len(por_interno) if isinstance(por_interno, list) else "?"
resumen["C_duplicado"] = {"status_reenvio": st, "respuesta": C, "comprobantes_con_ese_interno": n}
print(f"   comprobantes con numero_interno={interno_a}: {n}")

# D) dos recibos parciales sobre A (fechas aaaa-mm-dd; tasa_cambio obligatoria si no es UYU)
total_a = float(dA.get("total") or 1220)
tasa = float(dA.get("tasa_cambio") or 0) or None
partes = [round(total_a * 0.4, 2)]
partes.append(round(total_a - partes[0], 2))
resumen["D_recibos"] = []
for i, monto in enumerate(partes, 1):
    paso(f"D{i}) Recibo parcial {monto} de {total_a} sobre A")
    body = {
        "tipo_comprobante": 111, "forma_pago": 1, "fecha_emision": hoy.isoformat(),
        "sucursal": int(SUCURSAL), "moneda": "USD", "montos_brutos": 0,
        "cliente": cliente,
        "referencias": [{"padre": aid, "total": monto}],
        "pago": {"fecha": hoy.isoformat(), "monto": monto, "referencia": f"Transferencia BROU prueba {i}"},
    }
    if tasa:
        body["tasa_cambio"] = tasa
    st, R = api("POST", "/v2/recibos/crear", body)
    print(st, R)
    resumen["D_recibos"].append({"status": st, "respuesta": R})
paso("D) Detalle de A después de los recibos")
st, dA2 = detalle(aid)
resumen["A_despues_recibos"] = {k: dA2.get(k) for k in ("estado", "total", "referenciado_por")} if isinstance(dA2, dict) else dA2
print(resumen["A_despues_recibos"])

# E) nota de crédito parcial sobre B
if bid:
    paso("E) Nota de crédito PARCIAL (200 + IVA) sobre B")
    st, E = api("POST", "/v3/comprobantes/emitir", {
        "tipo_comprobante": 112, "forma_pago": 1, "sucursal": int(SUCURSAL),
        "moneda": "USD", "montos_brutos": 0, "cliente": cliente,
        "numero_interno": f"VOLTIA-TEST-NC-{STAMP}",
        "items": [{"codigo": "FV-6KW", "cantidad": 1, "concepto": "Bonificación parcial obra de prueba",
                   "precio": 200, "indicador_facturacion": 3}],
        "referencias": [bid],
    })
    print(st, E)
    resumen["E_nc"] = {"status": st, "respuesta": E}
    if ok(st):
        st, dE = esperar_aceptado(E["id"])
        resumen["E_nc"]["estado"] = dE.get("estado") if isinstance(dE, dict) else dE

# F) PDF de A
paso("F) PDF de A")
st, pdf = api("GET", "/v2/comprobantes/pdf", params={"id": aid})
if st == 200 and isinstance(pdf, str):
    ruta = os.path.join(AQUI, f"factura_{aid}.pdf")
    with open(ruta, "wb") as f:
        f.write(base64.b64decode(pdf.strip().strip('"')))
    print("Guardado", ruta)
    resumen["F_pdf"] = ruta
else:
    print(st, str(pdf)[:300])
    resumen["F_pdf"] = {"status": st}

# G) notificaciones por mail de A
paso("G) Notificaciones de A")
st, G = api("GET", "/v3/comprobantes/notificaciones/obtener", params={"id": aid})
print(st, G)
resumen["G_notificaciones"] = {"status": st, "respuesta": G}

salida = os.path.join(AQUI, f"biller_salida_{STAMP}.json")
with open(salida, "w") as f:
    json.dump({"resumen": resumen, "llamados": LOG}, f, ensure_ascii=False, indent=2)
print(f"\nListo. Detalle completo en {salida}")
