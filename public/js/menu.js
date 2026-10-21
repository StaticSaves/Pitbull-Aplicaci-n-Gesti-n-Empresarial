const PITBULL_MENU_ITEMS = [
  {
    section: "GENERAL",
    links: [
      { href: "index.html", label: "Panel principal", title: "Panel principal", icon: "dashboard" },
      { href: "productos.html", label: "Productos", permission: "productos.ver", icon: "products" },
      { href: "ventas.html", label: "Ventas", permission: "ventas.ver", icon: "sales" },
    ],
  },
  {
    section: "OPERACIONES",
    links: [
      { href: "entradas.html", label: "Entradas", permission: "entradas.crear", icon: "entries" },
      { href: "caja.html", label: "Caja", permission: "caja.ver|caja.abrir|caja.cerrar", icon: "cash" },
    ],
  },
  {
    section: "ADMINISTRACIÓN",
    links: [
      { href: "usuarios.html", label: "Usuarios", permission: "usuarios.ver", icon: "users" },
      { href: "configuracion.html", label: "Configuración", permission: "config.editar", icon: "settings" },
    ],
  },
];

const PITBULL_MENU_ICONS = {
  dashboard:
    '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>',
  products:
    '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  sales:
    '<path d="M4 19V5m0 14h17"/><path d="m7 15 4-4 3 2 6-7"/><path d="M16 6h4v4"/>',
  entries:
    '<path d="M12 16V4m0 0L7 9m5-5 5 5"/><path d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"/>',
  cash:
    '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M16 14h5M3 10h18M7 5V3h10v2"/><circle cx="16" cy="15" r="1"/>',
  users:
    '<circle cx="9" cy="8" r="3.5"/><path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20"/><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.5a4.5 4.5 0 0 1 3 4.3V20"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2Z"/>',
  collapse: '<path d="m14 18-6-6 6-6"/><path d="M20 4v16"/>',
  logout: '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

function pitbullMenuSvg(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${PITBULL_MENU_ICONS[name]}</svg>`;
}

function createPitbullSidebar() {
  const pathname = window.location.pathname;
  const activePath = pathname.substring(pathname.lastIndexOf("/") + 1) || "index.html";
  const pageLink = PITBULL_MENU_ITEMS.flatMap((section) => section.links).find(
    (link) => link.href === activePath,
  );
  const pageTitle = pageLink?.label || "PITBULL Manager";

  const sidebar = document.createElement("aside");
  sidebar.className = "dashboard-sidebar";
  sidebar.id = "dashboard-sidebar";
  sidebar.setAttribute("aria-label", "Menú lateral");

  const sections = PITBULL_MENU_ITEMS.map((section) => {
    const links = section.links
      .map((link) => {
        const active = link.href === activePath;
        const permission = link.permission
          ? ` data-permission="${link.permission}"`
          : "";
        const legacyId =
          link.href === "usuarios.html"
            ? ' id="nav-usuarios"'
            : link.href === "configuracion.html"
              ? ' id="nav-config"'
              : "";

        return `
          <a href="${link.href}" class="sidebar-link${active ? " active" : ""}"${active ? ' aria-current="page"' : ""} title="${link.label}"${permission}${legacyId}>
            ${pitbullMenuSvg(link.icon)}
            <span class="sidebar-link-label">${link.label}</span>
          </a>`;
      })
      .join("");

    return `
      <div class="sidebar-nav-group">
        <div class="sidebar-section-label">${section.section}</div>
        <nav class="sidebar-nav" aria-label="${section.section.toLowerCase()}">
          ${links}
        </nav>
      </div>`;
  }).join("");

  sidebar.innerHTML = `
    <a class="sidebar-brand" href="index.html" aria-label="PITBULL Manager, inicio">
      <img src="assets/logo.png" alt="" class="sidebar-logo" />
      <span class="sidebar-brand-copy">
        <strong>PITBULL</strong>
        <small>GESTIÓN EMPRESARIAL</small>
      </span>
    </a>
    ${sections}
    <div class="sidebar-bottom">
      <button class="sidebar-collapse" id="sidebar-collapse" type="button" aria-label="Contraer menú" aria-pressed="false">
        ${pitbullMenuSvg("collapse")}
        <span class="sidebar-link-label">Contraer menú</span>
      </button>
      <div class="sidebar-user">
        <span class="sidebar-avatar" id="user-avatar">P</span>
        <span class="sidebar-user-copy">
          <strong id="user-nombre">—</strong>
          <small id="menu-user-rol">Sesión activa</small>
        </span>
        <button id="btn-logout" class="sidebar-logout" type="button" aria-label="Cerrar sesión" title="Cerrar sesión">
          ${pitbullMenuSvg("logout")}
        </button>
      </div>
    </div>`;

  return { sidebar, activePath, pageTitle };
}

function installPitbullMenu() {
  const oldHeader = document.querySelector("body > header.topbar");
  const content = document.querySelector("body > main, body > .pos-container");
  if (!oldHeader || !content || document.querySelector(".dashboard-shell")) return;

  const { sidebar, pageTitle } = createPitbullSidebar();
  const shell = document.createElement("div");
  shell.className = "dashboard-shell";

  const backdrop = document.createElement("button");
  backdrop.className = "sidebar-backdrop";
  backdrop.id = "sidebar-backdrop";
  backdrop.type = "button";
  backdrop.setAttribute("aria-label", "Cerrar menú");
  backdrop.tabIndex = -1;
  backdrop.hidden = true;

  const page = document.createElement("div");
  page.className = "dashboard-page";

  const topbar = document.createElement("header");
  topbar.className = "topbar dashboard-topbar";
  topbar.innerHTML = `
    <button class="sidebar-toggle" id="sidebar-toggle" type="button" aria-label="Abrir menú" aria-controls="dashboard-sidebar" aria-expanded="false">
      ${pitbullMenuSvg("menu")}
    </button>
    <div class="topbar-title">
      <span>${pageTitle}</span>
      <small>PITBULL · Gestión empresarial</small>
    </div>
    <div class="topbar-info dashboard-account">
      <span class="user-name" id="topbar-user-nombre">PITBULL Manager</span>
      <span class="topbar-avatar" id="topbar-avatar">P</span>
    </div>`;

  oldHeader.replaceWith(shell);
  shell.append(sidebar, backdrop, page);
  page.append(topbar, content);

  document.body.classList.add("dashboard-body", "app-shell-body");

  const sectionGroups = sidebar.querySelectorAll(".sidebar-nav-group");
  sectionGroups.forEach((group) => {
    const heading = group.querySelector(".sidebar-section-label");
    heading.classList.toggle("sidebar-section-spaced", group !== sectionGroups[0]);
  });

  window.PitbullMenu = {
    setUser(user) {
      if (!user) return;

      const firstName = String(user.nombre_completo || "Usuario").split(" ")[0];
      const avatar = firstName.charAt(0).toLocaleUpperCase("es");
      sidebar.querySelector("#user-nombre").textContent = user.nombre_completo;
      sidebar.querySelector("#menu-user-rol").textContent = user.rol_nombre || "Usuario";
      sidebar.querySelector("#user-avatar").textContent = avatar;
      page.querySelector("#topbar-user-nombre").textContent = user.nombre_completo;
      page.querySelector("#topbar-avatar").textContent = avatar;
    },

    applyPermissions(permissions = Sesion.getPermisos()) {
      const granted = new Set(permissions);
      sidebar.querySelectorAll("[data-permission]").forEach((link) => {
        const alternatives = link.dataset.permission.split("|");
        link.hidden = !alternatives.some((permission) => granted.has(permission));
      });
      sectionGroups.forEach((group) => {
        group.hidden = !group.querySelector(".sidebar-link:not([hidden])");
      });
    },
  };

  const userName = sidebar.querySelector("#user-nombre");
  new MutationObserver(() => {
    const user = Sesion.getUsuario();
    if (user && userName.textContent !== user.nombre_completo) {
      window.PitbullMenu.setUser(user);
    }
  }).observe(userName, { childList: true, characterData: true, subtree: true });

  initializePitbullSidebar(sidebar, backdrop);
}

function initializePitbullSidebar(sidebar, backdrop) {
  const toggle = document.getElementById("sidebar-toggle");
  const collapse = document.getElementById("sidebar-collapse");
  const stateKey = "pitbull_sidebar_collapsed";
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const isCollapsed = localStorage.getItem(stateKey) === "true";

  function setMobileOpen(isOpen) {
    document.body.classList.toggle("sidebar-open", isOpen);
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
    sidebar.inert = !isOpen;
    sidebar.setAttribute("aria-hidden", String(!isOpen));
    backdrop.hidden = !isOpen;
  }

  function setCollapsed(isCollapsed) {
    document.body.classList.toggle("sidebar-collapsed", isCollapsed);
    localStorage.setItem(stateKey, String(isCollapsed));
    collapse.setAttribute("aria-pressed", String(isCollapsed));
    collapse.setAttribute(
      "aria-label",
      isCollapsed ? "Expandir menú" : "Contraer menú",
    );
    collapse.querySelector(".sidebar-link-label").textContent =
      isCollapsed ? "Expandir menú" : "Contraer menú";
  }

  document.body.classList.toggle("sidebar-collapsed", !isMobile && isCollapsed);
  sidebar.inert = isMobile;
  sidebar.setAttribute("aria-hidden", String(isMobile));
  collapse.setAttribute("aria-pressed", String(!isMobile && isCollapsed));
  collapse.setAttribute(
    "aria-label",
    !isMobile && isCollapsed ? "Expandir menú" : "Contraer menú",
  );
  collapse.querySelector(".sidebar-link-label").textContent =
    !isMobile && isCollapsed ? "Expandir menú" : "Contraer menú";

  toggle.addEventListener("click", () => {
    setMobileOpen(!document.body.classList.contains("sidebar-open"));
  });
  backdrop.addEventListener("click", () => setMobileOpen(false));
  collapse.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 760px)").matches) {
      setMobileOpen(false);
      return;
    }
    setCollapsed(!document.body.classList.contains("sidebar-collapsed"));
  });
  sidebar.addEventListener("click", (event) => {
    if (
      event.target.closest("a.sidebar-link") &&
      window.matchMedia("(max-width: 760px)").matches
    ) {
      setMobileOpen(false);
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
      setMobileOpen(false);
      toggle.focus();
    }
  });
  window.addEventListener("resize", () => {
    setMobileOpen(false);
    if (!window.matchMedia("(max-width: 760px)").matches) {
      sidebar.inert = false;
      sidebar.setAttribute("aria-hidden", "false");
    }
  });
}

installPitbullMenu();
