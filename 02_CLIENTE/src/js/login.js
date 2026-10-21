/**
 * PITBULL Manager v1.0
 * Lógica de la pantalla de login
 */

const API_BASE = "http://localhost:8000/api";

const form = document.getElementById("form-login");
const inputEmail = document.getElementById("login-email");
const inputPass = document.getElementById("login-password");
const boxError = document.getElementById("login-error");
const btnLogin = document.getElementById("btn-login");

// Si ya tiene sesión, redirigir directo a index
if (Sesion.activa()) {
  window.location.href = "index.html";
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

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Credenciales incorrectas");
    }

    // Guardar sesión y entrar
    Sesion.guardar(data);
    window.location.href = "index.html";
  } catch (err) {
    boxError.textContent = "X" + err.message;
    boxError.hidden = false;
    inputPass.value = "";
    inputPass.focus();
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = " Entrar";
  }
});
