# Generador de los documentos de la reunión

Convierte `docs/Manual-de-Trabajo-Voltia.md` en la página HTML y en el PDF.

Está versionado porque el scratchpad de la sesión se borra: sin esto, cada vez
que hay que regenerar el PDF se rehace el conversor desde cero.

```bash
python3 docs/reunion/generador/md-a-html.py     # markdown → HTML
# después, con Chrome headless:
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --no-pdf-header-footer --virtual-time-budget=10000 \
  --print-to-pdf=Manual-Voltia.pdf manual-print.html
```

- `estilos.html` — tokens y componentes. Los colores de área son los mismos del
  pipeline de Voltia PM (`client/src/constants/stages.ts`).
- `md-a-html.py` — conversor acotado a lo que usa este documento. **No es un
  conversor de markdown genérico.**

**Ojo con el conversor:** una línea que arranca con `**negrita**` parece un ítem
de lista. El patrón exige el espacio (`^[-*] `) y hay una guardia que fuerza el
avance del índice; sin las dos cosas entra en bucle infinito.
