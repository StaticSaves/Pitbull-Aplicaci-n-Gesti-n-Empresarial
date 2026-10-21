/**
 * PITBULL Manager v1.0
 * Lógica de la pantalla de login
 */

const API_BASE = "api";

const form = document.getElementById("form-login");
const inputEmail = document.getElementById("login-email");
const inputPass = document.getElementById("login-password");
const boxError = document.getElementById("login-error");
const btnLogin = document.getElementById("btn-login");

function mostrarError(mensaje) {
  boxError.textContent = mensaje;
  boxError.hidden = false;
}

// Solo se redirige si el servidor confirma que la sesión guardada sigue activa.
if (Sesion.activa()) {
  btnLogin.disabled = true;
  btnLogin.textContent = " Verificando sesión...";

  Sesion.verificarConServidor(API_BASE).then((valida) => {
    if (valida) {
      window.location.replace("index.html");
      return;
    }

    if (Sesion.activa()) {
      mostrarError("No se pudo conectar con el servidor para validar la sesión. Inténtalo de nuevo.");
    }

    btnLogin.disabled = false;
    btnLogin.textContent = " Entrar";
  });
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  boxError.hidden = true;
  btnLogin.disabled = true;
  btnLogin.textContent = " Verificando...";

  try {
    const res = await fetch(`${API_BASE}/auth.php?action=login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inputEmail.value.trim(),
        password: inputPass.value,
      }),
    });

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`El servidor devolvió una respuesta no válida (HTTP ${res.status}).`);
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("El servidor devolvió una respuesta no válida.");
    }
    if (!res.ok || data.ok !== true) {
      throw new Error(data.error || `No se pudo iniciar sesión (HTTP ${res.status}).`);
    }
    if (
      typeof data.token !== "string" ||
      !data.token ||
      !data.usuario ||
      typeof data.usuario !== "object" ||
      Array.isArray(data.usuario) ||
      !Array.isArray(data.permisos)
    ) {
      throw new Error("El servidor no devolvió los datos necesarios para iniciar sesión.");
    }

    Sesion.guardar(data);
    window.location.replace("index.html");
  } catch (err) {
    const mensaje =
      err instanceof TypeError
        ? "No se pudo conectar con el servidor. Verifica que Apache esté activo e inténtalo de nuevo."
        : err.message;
    mostrarError(mensaje);
    inputPass.value = "";
    inputPass.focus();
  } finally {
    if (window.location.pathname.endsWith("/login.html")) {
      btnLogin.disabled = false;
      btnLogin.textContent = " Entrar";
    }
  }
});
