const BRANDING_API = "api/config_sistema.php?public=branding";
const DEFAULT_BRAND_NAME = "PITBULL";
const DEFAULT_LOGO = "assets/logo.png";
let marcaGuardada = {};

function logoValido(logo) {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    logo || "",
  );
  if (!match) return false;

  try {
    const bytes = atob(match[2]);
    if (match[1] === "png") {
      return bytes.startsWith("\x89PNG\r\n\x1a\n");
    }
    if (match[1] === "jpeg") {
      return bytes.startsWith("\xff\xd8\xff");
    }
    return (
      bytes.startsWith("RIFF") &&
      bytes.slice(8, 12) === "WEBP"
    );
  } catch {
    return false;
  }
}

function aplicarMarca(config = {}) {
  const nombre = config.nombre_empresa || DEFAULT_BRAND_NAME;
  const logo = logoValido(config.logo_empresa)
    ? config.logo_empresa
    : DEFAULT_LOGO;
  const colorPrincipal = /^#[0-9a-f]{6}$/i.test(config.color_principal || "")
    ? config.color_principal
    : "#1e3a8a";
  const colorAcento = /^#[0-9a-f]{6}$/i.test(config.color_acento || "")
    ? config.color_acento
    : "#3b82f6";

  document.documentElement.style.setProperty("--azul-pitbull", colorPrincipal);
  document.documentElement.style.setProperty("--azul-claro", colorAcento);

  document.querySelectorAll(
    `img.brand-logo, img.sidebar-logo, img.login-logo, .comp-header img, #logo-preview, img[src$="${DEFAULT_LOGO}"]`,
  ).forEach((image) => {
    const logoUrl = new URL(logo, document.baseURI).href;
    if (image.src !== logoUrl) image.src = logo;
    if (image.alt !== nombre) image.alt = nombre;
  });
  document.querySelectorAll('link[rel="icon"]').forEach((icon) => {
    icon.href = logo;
  });
  document.querySelectorAll(".sidebar-brand, a.brand").forEach((element) => {
    element.setAttribute("aria-label", `${nombre}, inicio`);
  });
  document.querySelectorAll(
    ".brand-text h1, .brand-text strong, .sidebar-brand-copy strong, .login-brand h1, .comp-header h2",
  ).forEach((element) => {
    if (element.textContent !== nombre) element.textContent = nombre;
  });
  document.querySelectorAll(".topbar-title small").forEach((element) => {
    const texto = `${nombre} · Gestión empresarial`;
    if (element.textContent !== texto) element.textContent = texto;
  });
  document.querySelectorAll(".login-sub").forEach((element) => {
    if (element.textContent !== "Inicia sesión para continuar") {
      element.textContent = "Inicia sesión para continuar";
    }
  });
  const datosComprobante = [
    ["[data-brand-rif]", config.rif_empresa ? `RIF: ${config.rif_empresa}` : ""],
    ["[data-brand-address]", config.direccion_empresa || ""],
    ["[data-brand-phone]", config.telefono_empresa ? `Tel: ${config.telefono_empresa}` : ""],
  ];
  datosComprobante.forEach(([selector, text]) => {
    document.querySelectorAll(selector).forEach((element) => {
      if (element.textContent !== text) element.textContent = text;
    });
  });
  document.querySelectorAll(".comp-footer p:last-child").forEach((element) => {
    const texto = `${nombre} · Gestión empresarial`;
    if (element.textContent !== texto) element.textContent = texto;
  });
  document.querySelectorAll("title").forEach((element) => {
    const texto = element.textContent.replace(/PITBULL/gi, nombre);
    if (element.textContent !== texto) element.textContent = texto;
  });
}

window.PitbullBranding = {
  aplicar(config) {
    marcaGuardada = { ...marcaGuardada, ...config };
    aplicarMarca(marcaGuardada);
  },
};

fetch(BRANDING_API)
  .then((response) => {
    if (!response.ok) throw new Error(`No se pudo cargar la marca (HTTP ${response.status}).`);
    return response.json();
  })
  .then((data) => {
    if (!data || data.ok !== true || !data.branding) {
      throw new Error("Respuesta de personalización no válida.");
    }
    marcaGuardada = { ...data.branding, ...marcaGuardada };
    aplicarMarca(marcaGuardada);
    new MutationObserver(() => aplicarMarca(marcaGuardada)).observe(document.body, {
      childList: true,
      subtree: true,
    });
  })
  .catch((error) => console.error("Error cargando personalización:", error));
