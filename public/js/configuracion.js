/**
 * PITBULL Manager v1.0
 * Pantalla de configuración (solo gerente)
 */

const API_BASE = "api";
const API = `${API_BASE}/config_sistema.php`;

const $ = (sel) => document.querySelector(sel);

// ============================================
// HELPER FETCH AUTENTICADO
// ============================================
async function apiFetch(url, options = {}) {
  const token = Sesion.getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    Sesion.limpiar();
    window.location.href = "login.html";
    throw new Error("Sesión expirada");
  }
  return res;
}

// ============================================
// GUARDIA DE SESIÓN + PERMISOS
// ============================================
(async () => {
  const ok = await Sesion.exigir(API_BASE);
  if (!ok) return;

  // Solo gerente puede ver configuración
  if (!Sesion.tienePermiso("config.editar")) {
    alert("No tienes permiso para acceder a la configuración");
    window.location.href = "index.html";
    return;
  }

  const u = Sesion.getUsuario();
  window.PitbullMenu?.setUser(u);
  window.PitbullMenu?.applyPermissions();
  $("#user-nombre").textContent = `${u.nombre_completo} (${u.rol_nombre})`;
  $("#btn-logout").addEventListener("click", () => Sesion.cerrar(API_BASE));

  // Ocultar enlace a usuarios si no tiene permiso
  if (!Sesion.tienePermiso("usuarios.ver")) {
    const nav = $("#nav-usuarios");
    if (nav) nav.style.display = "none";
  }

  await cargarConfig();
})();

// ============================================
// CARGAR CONFIGURACIÓN
// ============================================
async function cargarConfig() {
  try {
    const res = await apiFetch(API);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const c = data.config;

    $("#cfg-tasa-bcv").value = c.tasa_bcv?.valor || 0;
    $("#cfg-tasa-paralelo").value = c.tasa_paralelo?.valor || 0;
    $("#cfg-tasa-usada").value = c.tasa_usada?.valor || "bcv";
    $("#cfg-iva").value = c.iva_porcentaje?.valor || 16;
    $("#cfg-margen").value = c.margen_ganancia_default?.valor || 15;
    $("#cfg-nombre-empresa").value = c.nombre_empresa?.valor || "";
    $("#cfg-rif-empresa").value = c.rif_empresa?.valor || "";
    $("#cfg-telefono-empresa").value = c.telefono_empresa?.valor || "";
    $("#cfg-direccion-empresa").value = c.direccion_empresa?.valor || "";

    actualizarPreview();
  } catch (e) {
    alert("Error al cargar configuración: " + e.message);
  }
}

// ============================================
// PREVIEW TASA ACTIVA
// ============================================
function actualizarPreview() {
  const usada = $("#cfg-tasa-usada").value;
  const bcv = parseFloat($("#cfg-tasa-bcv").value) || 0;
  const par = parseFloat($("#cfg-tasa-paralelo").value) || 0;
  const activa = usada === "bcv" ? bcv : par;
  $("#preview-tasa").textContent = activa.toFixed(2);
}

["cfg-tasa-bcv", "cfg-tasa-paralelo", "cfg-tasa-usada"].forEach((id) => {
  document.addEventListener("DOMContentLoaded", () => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", actualizarPreview);
  });
});

// ============================================
// GUARDAR TODO
// ============================================
$("#btn-guardar-todo").addEventListener("click", async () => {
  const btn = $("#btn-guardar-todo");
  const msg = $("#msg-guardado");

  btn.disabled = true;
  btn.textContent = "⏳ Guardando...";

  const payload = {
    tasa_bcv: $("#cfg-tasa-bcv").value,
    tasa_paralelo: $("#cfg-tasa-paralelo").value,
    tasa_usada: $("#cfg-tasa-usada").value,
    iva_porcentaje: $("#cfg-iva").value,
    margen_ganancia_default: $("#cfg-margen").value,
    nombre_empresa: $("#cfg-nombre-empresa").value,
    rif_empresa: $("#cfg-rif-empresa").value,
    telefono_empresa: $("#cfg-telefono-empresa").value,
    direccion_empresa: $("#cfg-direccion-empresa").value,
  };

  try {
    const res = await apiFetch(API, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al guardar");

    msg.hidden = false;
    setTimeout(() => (msg.hidden = true), 3000);
  } catch (e) {
    alert("❌ " + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = " Guardar toda la configuración";
  }
});
if (!Sesion.tienePermiso("usuarios.ver")) {
  const el = $("#nav-usuarios");
  if (el) el.style.display = "none";
}
if (!Sesion.tienePermiso("config.editar")) {
  const el = $("#nav-config");
  if (el) el.style.display = "none";
}
