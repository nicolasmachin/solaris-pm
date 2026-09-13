"""Convierte el manual (Markdown) a la página HTML.

No es un conversor genérico: cubre exactamente lo que usa este documento
—títulos, tablas, listas, citas, bloques de código, negritas y cursivas— y tiene
una guardia contra bucles, porque una línea que arranca con `**negrita**` parece
un ítem de lista y trababa el recorrido.
"""
import re, html, sys

MD = '/Users/nicolasmachin/Dev/voltia-pm/docs/Manual-de-Trabajo-Voltia.md'
S = '/private/tmp/claude-501/-Users-nicolasmachin-Dev-voltia-pm/fce0a8bb-e714-426e-93fd-cb7895ac6015/scratchpad'

def inline(t):
    t = html.escape(t)
    t = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', t)
    t = re.sub(r'`(.+?)`', r'<code>\1</code>', t)
    t = re.sub(r'(?<!\w)\*(?!\s)(.+?)(?<!\s)\*(?!\w)', r'<em>\1</em>', t)
    return t

L = open(MD).read().split('\n')
out, i, secs = [], 0, []
COL = {3: '--ventas', 4: '--ingenieria', 5: '--operaciones',
       6: '--operaciones', 7: '--ute', 8: '--cx'}

while i < len(L):
    ini = i
    l = L[i]
    if l.startswith('```'):
        i += 1; buf = []
        while i < len(L) and not L[i].startswith('```'):
            buf.append(html.escape(L[i])); i += 1
        out.append('<pre>' + '\n'.join(buf) + '</pre>'); i += 1
    elif l.startswith('|'):
        filas = []
        while i < len(L) and L[i].startswith('|'):
            filas.append(L[i]); i += 1
        cel = [[c.strip() for c in f.strip('|').split('|')] for f in filas]
        cuerpo = cel[2:] if len(cel) > 1 and set(cel[1][0]) <= set('-: ') else cel[1:]
        th = ''.join(f'<th>{inline(c)}</th>' for c in cel[0])
        tr = ''.join('<tr>' + ''.join(f'<td>{inline(c)}</td>' for c in f) + '</tr>' for f in cuerpo)
        out.append(f'<div class="tw"><table><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>')
    elif l.startswith('>'):
        buf = []
        while i < len(L) and L[i].startswith('>'):
            buf.append(L[i][2:] if len(L[i]) > 2 else ''); i += 1
        txt = '\n'.join(buf).strip()
        if txt.startswith('### '):
            lin = txt.split('\n')
            resto = ' '.join(lin[1:]).strip()
            out.append(f'<blockquote><h3>{inline(lin[0][4:])}</h3>'
                       + (f'<p>{inline(resto)}</p>' if resto else '') + '</blockquote>')
        else:
            parr = [p.replace('\n', ' ').strip() for p in txt.split('\n\n') if p.strip()]
            out.append('<blockquote>' + ''.join(f'<p>{inline(p)}</p>' for p in parr) + '</blockquote>')
    elif re.match(r'^([-*]|\d+\.) ', l):
        ord_ = bool(re.match(r'^\d+\. ', l)); items = []
        while i < len(L) and (re.match(r'^([-*]|\d+\.) ', L[i]) or (L[i].startswith('  ') and L[i].strip())):
            if L[i].startswith('  ') and items:
                items[-1] += ' ' + L[i].strip()
            else:
                items.append(re.sub(r'^([-*]|\d+\.) ', '', L[i]))
            i += 1
        tag = 'ol' if ord_ else 'ul'
        out.append(f'<{tag}>' + ''.join(f'<li>{inline(x)}</li>' for x in items) + f'</{tag}>')
    elif re.match(r'^#{1,4} ', l):
        m = re.match(r'^(#{1,4}) (.+)$', l); n, txt = len(m.group(1)), m.group(2)
        if n == 1:
            pass                                   # el título va en la portada
        elif n == 2:
            mm = re.match(r'^(\d+) · (.+)$', txt)
            if mm:
                num, tit = mm.group(1), mm.group(2)
                c = COL.get(int(num), '--struct'); idd = f's{num}'
                secs.append((num, tit, idd, c))
                out.append(f'</section><section id="{idd}" style="--c: var({c})">'
                           f'<h2><span class="n">{num.zfill(2)}</span>{inline(tit)}</h2>')
            else:
                tit = txt.replace('Anexo · ', '')
                idd = 'ax-' + re.sub(r'[^a-z]+', '-', tit.lower())[:16].strip('-')
                secs.append(('·', tit, idd, '--struct'))
                out.append(f'</section><section id="{idd}"><h2>{inline(txt)}</h2>')
        elif n == 3:
            out.append(f'<h3>{inline(txt)}</h3>')
        else:
            out.append(f'<h4>{inline(txt)}</h4>')
        i += 1
    elif l.strip() == '---' or not l.strip():
        i += 1
    else:
        buf = []
        # Ojo con el `*`: una línea que arranca con **negrita** NO es una lista.
        while i < len(L) and L[i].strip() and not re.match(r'^([-*] |#{1,4} |>|\||\d+\. |```)', L[i]):
            buf.append(L[i]); i += 1
        out.append(f'<p>{inline(" ".join(buf) if buf else l)}</p>')
    if i == ini:
        i += 1

cuerpo = '\n'.join(out).replace('</section>', '', 1)
# El pie en cursiva del markdown queda como párrafo suelto: se le da su estilo.
cuerpo = re.sub(r'<p><em>(Cómo trabajamos[^<]*)</em></p>', r'<p class="pie">\1</p>', cuerpo)
nav = ''.join(f'<a href="#{d}" style="--c: var({c})"><span class="n">{n}</span>{html.escape(t)}</a>'
              for n, t, d, c in secs)
doc = f'''{open(S + "/_cabeza.html").read()}
<div class="shell">
  <header class="cover">
    <p class="eyebrow">Voltia · Uruguay</p>
    <h1>Cómo trabajamos en Voltia</h1>
    <p class="sub">Qué tiene que hacer cada uno y cómo hacerlo en Voltia&nbsp;PM. El procedimiento y la herramienta, juntos.</p>
    <p class="meta"><span>Versión 1.0</span><span>9 de septiembre de 2026</span><span>{len(secs)} capítulos</span></p>
  </header>
  <div class="layout">
    <aside class="toc"><nav aria-label="Índice">{nav}</nav></aside>
    <main>{cuerpo}</section></main>
  </div>
</div>'''
open(S + '/manual-trabajo.html', 'w').write(doc)
print('bytes:', len(doc), '| capítulos:', len(secs))
