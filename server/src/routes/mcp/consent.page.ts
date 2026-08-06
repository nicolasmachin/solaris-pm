// Pantalla de autorización del conector.
//
// Es HTML servido por el backend en vez de una vista de React a propósito: es
// la única pantalla de la app que se abre desde fuera (la ventana que levanta
// Claude), se ve una vez cada varias semanas, y hacerla en el frontend
// obligaría a abrirle CORS al origen de Claude y a manejar el intercambio del
// código desde el navegador.

interface ConsentPageParams {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  /** Mensaje de error de un intento anterior, si lo hubo. */
  error?: string;
  /** Email tipeado antes, para no obligar a escribirlo de nuevo. */
  email?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** De dónde viene el pedido, en palabras. Lo pide la spec: el usuario tiene
 *  que poder ver a dónde va a parar la autorización antes de darla. */
function describeDestination(redirectUri: string): string {
  try {
    const url = new URL(redirectUri);
    if (url.hostname === "claude.ai") return "Claude (claude.ai)";
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return `una aplicación en esta computadora (${url.host})`;
    }
    return url.host;
  } catch {
    return redirectUri;
  }
}

export function renderConsentPage(params: ConsentPageParams): string {
  const destino = describeDestination(params.redirectUri);
  const errorBlock = params.error
    ? `<p class="error">${escapeHtml(params.error)}</p>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Conectar con Voltia PM</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 24px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: #0f1115; color: #e8eaed;
  }
  .card {
    width: 100%; max-width: 380px; background: #171a21; border: 1px solid #262b36;
    border-radius: 14px; padding: 28px;
  }
  h1 { margin: 0 0 6px; font-size: 19px; }
  .sub { margin: 0 0 22px; font-size: 13px; line-height: 1.5; color: #9aa3b2; }
  .dest { color: #e8eaed; font-weight: 600; }
  label { display: block; font-size: 12px; color: #9aa3b2; margin-bottom: 5px; }
  input {
    width: 100%; padding: 10px 12px; margin-bottom: 14px; font-size: 14px;
    background: #0f1115; border: 1px solid #2c323e; border-radius: 8px; color: #e8eaed;
  }
  input:focus { outline: none; border-color: #d4af37; }
  button {
    width: 100%; padding: 11px; font-size: 14px; font-weight: 600; cursor: pointer;
    background: #d4af37; color: #14161a; border: 0; border-radius: 8px;
  }
  button:hover { background: #e0bd4a; }
  .error {
    background: rgba(220,60,60,.12); border: 1px solid rgba(220,60,60,.35);
    color: #ff9b9b; padding: 9px 11px; border-radius: 8px;
    font-size: 12.5px; margin: 0 0 14px;
  }
  .foot { margin: 18px 0 0; font-size: 11.5px; color: #6b7280; line-height: 1.55; }
</style>
</head>
<body>
  <div class="card">
    <h1>Conectar con Voltia PM</h1>
    <p class="sub">
      <span class="dest">${escapeHtml(destino)}</span> pide acceso a tu cuenta para
      consultar y cargar información de ventas en tu nombre.
    </p>
    ${errorBlock}
    <form method="POST" action="/oauth/authorize">
      <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}">
      <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}">
      <input type="hidden" name="state" value="${escapeHtml(params.state)}">
      <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}">
      <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.codeChallengeMethod)}">

      <label for="email">Email</label>
      <input id="email" name="email" type="email" required autocomplete="username"
             value="${escapeHtml(params.email ?? "")}" autofocus>

      <label for="password">Contraseña</label>
      <input id="password" name="password" type="password" required autocomplete="current-password">

      <button type="submit">Autorizar</button>
    </form>
    <p class="foot">
      Se usa tu usuario de Voltia PM. El acceso queda limitado a lo que ya podés
      hacer con tu rol, y podés cortarlo desde la app cuando quieras.
    </p>
  </div>
</body>
</html>`;
}
