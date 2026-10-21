const API_BASE = "api";
const API = `${API_BASE}/dashboard.php`;

const dashboardMessage = document.getElementById("dashboard-message");
const salesChart = document.getElementById("sales-chart");
const lowStockList = document.getElementById("low-stock-list");
const recentSalesBody = document.getElementById("recent-sales-body");
const sidebar = document.getElementById("dashboard-sidebar");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebarBackdrop = document.getElementById("sidebar-backdrop");
const sidebarCollapse = document.getElementById("sidebar-collapse");

const SIDEBAR_STATE_KEY = "pitbull_sidebar_collapsed";

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function formatMoney(value) {
  return `Bs. ${Number(value || 0).toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value, options = {}) {
  if (!value) return "—";
  const date =
    value instanceof Date ? value : new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-VE", options).format(date);
}

function showMessage(message, isError = false) {
  dashboardMessage.textContent = message;
  dashboardMessage.hidden = !message;
  dashboardMessage.classList.toggle("is-error", isError);
}

function applyPermissions() {
  document.querySelectorAll("[data-permission]").forEach((element) => {
    if (!Sesion.tienePermiso(element.dataset.permission)) {
      element.hidden = true;
    }
  });

  if (!Sesion.tienePermiso("ventas.ver")) {
    document.querySelector('[data-metric="today-sales"]').hidden = true;
    document.querySelector('[data-metric="month-sales"]').hidden = true;
    document.querySelector('[data-section="sales"]').hidden = true;
    document.querySelector('[data-section="recent-sales"]').hidden = true;
  }

  if (!Sesion.tienePermiso("productos.ver")) {
    document.querySelector('[data-metric="low-stock"]').hidden = true;
    document.querySelector('[data-section="inventory"]').hidden = true;
  }

  if (
    !Sesion.tienePermiso("caja.ver") &&
    !Sesion.tienePermiso("caja.abrir") &&
    !Sesion.tienePermiso("caja.cerrar")
  ) {
    document.querySelector('[data-metric="cash"]').hidden = true;
  }
}

function setMobileSidebarOpen(isOpen) {
  document.body.classList.toggle("sidebar-open", isOpen);
  sidebarToggle.setAttribute("aria-expanded", String(isOpen));
  sidebarToggle.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
  sidebar.inert = !isOpen;
  sidebar.setAttribute("aria-hidden", String(!isOpen));
  sidebarBackdrop.hidden = !isOpen;
}

function initializeSidebar() {
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  const isCollapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === "true";

  document.body.classList.toggle("sidebar-collapsed", !isMobile && isCollapsed);
  sidebar.inert = isMobile;
  sidebar.setAttribute("aria-hidden", String(isMobile));
  sidebarCollapse.setAttribute("aria-pressed", String(!isMobile && isCollapsed));
  sidebarCollapse.setAttribute(
    "aria-label",
    !isMobile && isCollapsed ? "Expandir menú" : "Contraer menú",
  );
  sidebarCollapse.querySelector(".sidebar-link-label").textContent =
    !isMobile && isCollapsed ? "Expandir menú" : "Contraer menú";

  sidebarToggle.addEventListener("click", () => {
    setMobileSidebarOpen(!document.body.classList.contains("sidebar-open"));
  });

  sidebarBackdrop.addEventListener("click", () => setMobileSidebarOpen(false));

  sidebarCollapse.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 760px)").matches) {
      setMobileSidebarOpen(false);
      return;
    }

    const isCollapsed = !document.body.classList.contains("sidebar-collapsed");
    document.body.classList.toggle("sidebar-collapsed", isCollapsed);
    localStorage.setItem(SIDEBAR_STATE_KEY, String(isCollapsed));
    sidebarCollapse.setAttribute("aria-pressed", String(isCollapsed));
    sidebarCollapse.setAttribute(
      "aria-label",
      isCollapsed ? "Expandir menú" : "Contraer menú",
    );
    sidebarCollapse.querySelector(".sidebar-link-label").textContent =
      isCollapsed ? "Expandir menú" : "Contraer menú";
  });

  sidebar.addEventListener("click", (event) => {
    if (event.target.closest("a.sidebar-link") && window.matchMedia("(max-width: 760px)").matches) {
      setMobileSidebarOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
      setMobileSidebarOpen(false);
      sidebarToggle.focus();
    }
  });

  window.addEventListener("resize", () => {
    if (window.matchMedia("(max-width: 760px)").matches) {
      setMobileSidebarOpen(false);
    } else {
      setMobileSidebarOpen(false);
      sidebar.inert = false;
      sidebar.setAttribute("aria-hidden", "false");
    }
  });
}

function renderSalesChart(dailySales) {
  const totals = new Map(dailySales.map((day) => [day.sale_date, Number(day.total)]));
  const days = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    days.push({ key, date, total: totals.get(key) || 0 });
  }

  const maxTotal = Math.max(...days.map((day) => day.total), 1);
  salesChart.innerHTML = days
    .map(
      (day) => `
        <div class="chart-column" title="${escapeHtml(formatMoney(day.total))}">
          <span class="chart-value">${day.total ? escapeHtml(formatMoney(day.total)) : ""}</span>
          <div class="chart-track"><span class="chart-bar" style="height:${Math.max((day.total / maxTotal) * 100, day.total ? 8 : 0)}%"></span></div>
          <span class="chart-label">${escapeHtml(formatDate(day.date, { weekday: "short" }))}</span>
        </div>
      `,
    )
    .join("");
}

function renderInventory(inventory) {
  document.getElementById("metric-low-stock").textContent =
    Number(inventory.low_stock_count).toLocaleString("es-VE");
  document.getElementById("metric-products-count").textContent =
    `${Number(inventory.active_products).toLocaleString("es-VE")} productos · ${Number(inventory.active_categories).toLocaleString("es-VE")} categorías`;

  if (!inventory.low_stock.length) {
    lowStockList.innerHTML = `
      <div class="dashboard-empty">
        <span class="empty-check" aria-hidden="true">✓</span>
        <strong>Inventario al día</strong>
        <span>No hay productos por debajo del mínimo.</span>
      </div>`;
    return;
  }

  lowStockList.innerHTML = inventory.low_stock
    .map(
      (product) => `
        <a class="stock-alert" href="productos.html">
          <span class="stock-alert-icon" aria-hidden="true">!</span>
          <span class="stock-alert-copy">
            <strong>${escapeHtml(product.nombre)}</strong>
            <small>${escapeHtml(product.sku)}</small>
          </span>
          <span class="stock-alert-quantity">
            <strong>${Number(product.stock)}</strong>
            <small>mín. ${Number(product.stock_minimo)} ${escapeHtml(product.unidad_medida || "")}</small>
          </span>
        </a>
      `,
    )
    .join("");
}

function renderRecentSales(sales) {
  if (!sales.recent.length) {
    recentSalesBody.innerHTML =
      '<tr><td colspan="6" class="dashboard-loading">Todavía no hay ventas registradas.</td></tr>';
    return;
  }

  recentSalesBody.innerHTML = sales.recent
    .map((sale) => {
      const status = sale.estado === "anulada" ? "Anulada" : sale.estado === "pendiente" ? "Pendiente" : "Completada";
      const statusClass = sale.estado === "anulada" ? "status-cancelled" : sale.estado === "pendiente" ? "status-pending" : "status-complete";
      return `
        <tr>
          <td><strong>${escapeHtml(sale.numero_factura)}</strong></td>
          <td>${escapeHtml(sale.cliente_nombre || "Cliente general")}</td>
          <td>${escapeHtml(formatDate(sale.created_at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }))}</td>
          <td>${escapeHtml(String(sale.metodo_pago || "—").replaceAll("_", " "))}</td>
          <td><span class="sale-status ${statusClass}">${status}</span></td>
          <td class="align-right"><strong>${escapeHtml(formatMoney(sale.total))}</strong></td>
        </tr>`;
    })
    .join("");
}

function renderDashboard(data) {
  if (data.sales) {
    document.getElementById("metric-today-total").textContent = formatMoney(data.sales.today_total);
    document.getElementById("metric-today-count").textContent =
      `${Number(data.sales.today_count).toLocaleString("es-VE")} ventas completadas`;
    document.getElementById("metric-month-total").textContent = formatMoney(data.sales.month_total);
    document.getElementById("metric-month-count").textContent =
      `${Number(data.sales.month_count).toLocaleString("es-VE")} ventas este mes`;
    renderSalesChart(data.sales.daily);
    renderRecentSales(data.sales);
  }

  if (data.inventory) renderInventory(data.inventory);

  if (data.cash) {
    const isOpen = data.cash.my_open_registers > 0;
    document.getElementById("metric-cash").textContent = isOpen ? "Abierta" : "Cerrada";
    document.querySelector('[data-metric="cash"] .metric-icon').textContent =
      isOpen ? "✓" : "▣";
    document.querySelector('[data-metric="cash"] .metric-icon').classList.toggle("cash-open", isOpen);
  }

  const updatedAt = formatDate(data.generated_at, {
    hour: "2-digit",
    minute: "2-digit",
  });
  document.getElementById("dashboard-updated").textContent =
    `Actualizado a las ${updatedAt}`;
}

async function loadDashboard() {
  const button = document.getElementById("btn-refresh");
  button.disabled = true;
  button.textContent = "Actualizando...";
  showMessage("");

  try {
    const response = await fetch(API, {
      headers: { Authorization: `Bearer ${Sesion.getToken()}` },
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error(`Respuesta inválida del servidor (HTTP ${response.status}).`);
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("El servidor devolvió una respuesta no válida.");
    }

    if (response.status === 401) {
      Sesion.limpiar();
      window.location.replace("login.html");
      return;
    }
    if (!response.ok) {
      throw new Error(data.error || `Error al cargar el dashboard (HTTP ${response.status}).`);
    }

    renderDashboard(data);
  } catch (error) {
    showMessage(error instanceof TypeError
      ? "No se pudo conectar con el servidor. Verifica Apache y vuelve a intentarlo."
      : error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Actualizar datos";
  }
}

(async () => {
  const valid = await Sesion.exigir(API_BASE);
  if (!valid) return;

  const user = Sesion.getUsuario();
  if (user) {
    const firstName = user.nombre_completo.split(" ")[0];
    document.getElementById("user-nombre").textContent = user.nombre_completo;
    document.getElementById("user-rol").textContent = user.rol_nombre;
    document.getElementById("user-avatar").textContent = firstName.charAt(0).toUpperCase();
    document.getElementById("topbar-user-nombre").textContent = user.nombre_completo;
    document.getElementById("topbar-avatar").textContent = firstName.charAt(0).toUpperCase();
    document.getElementById("welcome-title").textContent =
      `Hola, ${firstName}`;
  }

  document.getElementById("dashboard-date").textContent =
    new Intl.DateTimeFormat("es-VE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  document.getElementById("btn-logout").addEventListener("click", () => Sesion.cerrar(API_BASE));
  document.getElementById("btn-refresh").addEventListener("click", loadDashboard);

  initializeSidebar();
  applyPermissions();
  await loadDashboard();
})();
