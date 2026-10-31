/**
 * PITBULL Manager v1.0
 * Configuración organizada por permiso
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

  const u = Sesion.getUsuario();
  const puedeVerConfiguracion = Sesion.tienePermiso("config.ver") ||
    Sesion.tienePermiso("config.editar");
  if (!puedeVerConfiguracion) {
    alert("No tienes permiso para acceder a la configuración");
    window.location.href = "index.html";
    return;
  }

  inicializarPestanas();
  window.PitbullMenu?.setUser(u);
  window.PitbullMenu?.applyPermissions();
  $("#user-nombre").textContent = `${u.nombre_completo} (${u.rol_nombre})`;
  $("#btn-logout").addEventListener("click", () => Sesion.cerrar(API_BASE));

  await cargarConfig();
})();

function puedeEditarConfiguracion(permiso) {
  return Sesion.tienePermiso("config.editar") || Sesion.tienePermiso(permiso);
}

function inicializarPestanas() {
  const tabs = [...document.querySelectorAll("[data-config-tab]")];
  const panels = [...document.querySelectorAll("[data-config-panel]")];
  const visibles = tabs.filter((tab) => {
    const permitidos = tab.dataset.permission.split("|");
    const visible = permitidos.some((permiso) => Sesion.tienePermiso(permiso));
    tab.hidden = !visible;
    return visible;
  });
  $("#config-no-options").hidden = visibles.length > 0;
  $("#btn-guardar-todo").hidden = visibles.length === 0;

  panels.forEach((panel) => {
    panel.hidden = !visibles.some(
      (tab) => tab.dataset.configTab === panel.dataset.configPanel,
    );
  });

  function seleccionarTab(tab) {
    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute("aria-selected", String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.configPanel !== tab.dataset.configTab;
    });
  }

  visibles.forEach((tab) => {
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", "false");
    tab.addEventListener("click", () => seleccionarTab(tab));
  });
  if (visibles[0]) seleccionarTab(visibles[0]);
}

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
    $("#cfg-color-principal").value = c.color_principal?.valor || "#1e3a8a";
    $("#cfg-color-acento").value = c.color_acento?.valor || "#3b82f6";
    $("#logo-preview").src = c.logo_empresa?.valor || "assets/logo.png";
    $("#cfg-impresora-tipo").value = c.impresora_tipo?.valor || "termica";
    $("#cfg-impresora-ancho").value = c.impresora_ancho_mm?.valor || 72;
    $("#cfg-impresora-papel").value = c.impresora_papel?.valor || "a4";
    $("#cfg-impresora-orientacion").value =
      c.impresora_orientacion?.valor || "vertical";
    $("#cfg-impresora-margen").value = c.impresora_margen_mm?.valor || 0;
    $("#cfg-impresora-fuente").value = c.impresora_fuente_px?.valor || 10;
    actualizarOpcionesImpresora();

    actualizarPreview();
  } catch (e) {
    alert("Error al cargar configuración: " + e.message);
  }
}

function actualizarOpcionesImpresora() {
  const tipo = $("#cfg-impresora-tipo").value;
  const esHoja = tipo === "hoja";
  $("#cfg-impresora-ancho-contenedor").hidden = esHoja;
  $("#cfg-impresora-papel-contenedor").hidden = !esHoja;
  $("#cfg-impresora-orientacion-contenedor").hidden = !esHoja;
  $("#cfg-impresora-fiscal-nota").hidden = tipo !== "fiscal";
}

$("#cfg-impresora-tipo").addEventListener("change", actualizarOpcionesImpresora);

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

let logoEmpresa = "";

$("#cfg-logo").addEventListener("change", () => {
  const file = $("#cfg-logo").files[0];
  const mensaje = $("#msg-logo");
  mensaje.hidden = true;
  if (!file) return;
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    $("#cfg-logo").value = "";
    mensaje.textContent = "Selecciona un archivo PNG, JPG o WebP.";
    mensaje.hidden = false;
    return;
  }
  if (file.size > 300 * 1024) {
    $("#cfg-logo").value = "";
    mensaje.textContent = "El logo no puede superar los 300 KB.";
    mensaje.hidden = false;
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    if (typeof reader.result !== "string") {
      mensaje.textContent = "No se pudo leer el archivo seleccionado.";
      mensaje.hidden = false;
      return;
    }
    logoEmpresa = reader.result;
    $("#logo-preview").src = logoEmpresa;
  });
  reader.addEventListener("error", () => {
    mensaje.textContent = "No se pudo leer el archivo seleccionado.";
    mensaje.hidden = false;
  });
  reader.readAsDataURL(file);
});

$("#logo-preview").addEventListener("error", () => {
  logoEmpresa = "";
  $("#logo-preview").src = "assets/logo.png";
  const mensaje = $("#msg-logo");
  mensaje.textContent =
    "El logo guardado no es válido. Selecciona una imagen nueva para reemplazarlo.";
  mensaje.hidden = false;
});

$("#btn-quitar-logo").addEventListener("click", () => {
  logoEmpresa = "";
  $("#cfg-logo").value = "";
  $("#logo-preview").src = "assets/logo.png";
});

// ============================================
// GUARDAR TODO
// ============================================
$("#btn-guardar-todo").addEventListener("click", async () => {
  const btn = $("#btn-guardar-todo");
  const msg = $("#msg-guardado");

  btn.disabled = true;
  btn.textContent = "Guardando...";

  const payload = {
    ...(puedeEditarConfiguracion("config.tasas") && {
      tasa_bcv: $("#cfg-tasa-bcv").value,
      tasa_paralelo: $("#cfg-tasa-paralelo").value,
      tasa_usada: $("#cfg-tasa-usada").value,
    }),
    ...(puedeEditarConfiguracion("config.fiscal") && {
      iva_porcentaje: $("#cfg-iva").value,
      margen_ganancia_default: $("#cfg-margen").value,
    }),
    ...(puedeEditarConfiguracion("config.empresa") && {
      nombre_empresa: $("#cfg-nombre-empresa").value,
      rif_empresa: $("#cfg-rif-empresa").value,
      telefono_empresa: $("#cfg-telefono-empresa").value,
      direccion_empresa: $("#cfg-direccion-empresa").value,
    }),
    ...(puedeEditarConfiguracion("config.personalizacion") && {
      color_principal: $("#cfg-color-principal").value,
      color_acento: $("#cfg-color-acento").value,
      logo_empresa: logoEmpresa || (
        $("#logo-preview").src.endsWith("assets/logo.png")
          ? ""
          : $("#logo-preview").src
      ),
    }),
    ...(puedeEditarConfiguracion("config.impresion") && {
      impresora_tipo: $("#cfg-impresora-tipo").value,
      impresora_ancho_mm: $("#cfg-impresora-ancho").value,
      impresora_papel: $("#cfg-impresora-papel").value,
      impresora_orientacion: $("#cfg-impresora-orientacion").value,
      impresora_margen_mm: $("#cfg-impresora-margen").value,
      impresora_fuente_px: $("#cfg-impresora-fuente").value,
    }),
  };

  try {
    const res = await apiFetch(API, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error al guardar");

    if (payload.nombre_empresa !== undefined) {
      window.PitbullBranding?.aplicar(payload);
    }
    if (payload.logo_empresa !== undefined) logoEmpresa = payload.logo_empresa;
    msg.hidden = false;
    setTimeout(() => (msg.hidden = true), 3000);
  } catch (e) {
    alert("Error: " + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = " Guardar toda la configuración";
  }
});
