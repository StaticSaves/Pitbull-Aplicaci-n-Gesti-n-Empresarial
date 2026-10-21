/**
 * PITBULL Manager v1.0
 * Helper de sesión del cliente
 *
 * Guarda el token, el usuario y sus permisos en sessionStorage.
 * Provee métodos para consultar permisos desde cualquier parte del código.
 */

const Sesion = {
  // CLAVES DE ALMACENAMIENTO
  KEYS: {
    TOKEN: "pitbull_token",
    USUARIO: "pitbull_usuario",
    PERMISOS: "pitbull_permisos",
    EXPIRA: "pitbull_expira",
  },

  // ============================================
  // GUARDAR SESIÓN
  // ============================================
  guardar(data) {
    sessionStorage.setItem(this.KEYS.TOKEN, data.token);
    sessionStorage.setItem(this.KEYS.USUARIO, JSON.stringify(data.usuario));
    sessionStorage.setItem(
      this.KEYS.PERMISOS,
      JSON.stringify(data.permisos || []),
    );
    sessionStorage.setItem(this.KEYS.EXPIRA, data.expira_en || "");
  },

  // ============================================
  // LIMPIAR SESIÓN
  // ============================================
  limpiar() {
    Object.values(this.KEYS).forEach((k) => sessionStorage.removeItem(k));
  },

  // ============================================
  // OBTENER TOKEN
  // ============================================
  getToken() {
    return sessionStorage.getItem(this.KEYS.TOKEN);
  },

  // ============================================
  // OBTENER USUARIO
  // ============================================
  getUsuario() {
    const raw = sessionStorage.getItem(this.KEYS.USUARIO);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },

  // ============================================
  // OBTENER PERMISOS
  // ============================================
  getPermisos() {
    const raw = sessionStorage.getItem(this.KEYS.PERMISOS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  // ============================================
  // VERIFICAR PERMISO
  // ============================================
  tienePermiso(clave) {
    return this.getPermisos().includes(clave);
  },

  // ============================================
  // ¿HAY SESIÓN?
  // ============================================
  activa() {
    return !!this.getToken();
  },

  // ============================================
  // VERIFICAR CON EL SERVIDOR
  // ============================================
  async verificarConServidor(apiBase) {
    const token = this.getToken();
    if (!token) return false;

    try {
      const res = await fetch(`${apiBase}/auth.php?action=verificar`, {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) {
        this.limpiar();
        return false;
      }
      const data = await res.json();
      if (
        data.ok !== true ||
        !data.usuario ||
        typeof data.usuario !== "object" ||
        Array.isArray(data.usuario) ||
        !Array.isArray(data.permisos)
      ) {
        throw new Error("Respuesta inválida al verificar la sesión");
      }

      // Actualizar permisos y usuario por si cambiaron
      sessionStorage.setItem(this.KEYS.USUARIO, JSON.stringify(data.usuario));
      sessionStorage.setItem(this.KEYS.PERMISOS, JSON.stringify(data.permisos));
      return true;
    } catch (e) {
      console.error("Error verificando sesión:", e);
      return false;
    }
  },

  // ============================================
  // CERRAR SESIÓN (llama al backend también)
  // ============================================
  async cerrar(apiBase) {
    const token = this.getToken();
    if (token) {
      try {
        await fetch(`${apiBase}/auth.php?action=logout`, {
          method: "POST",
          headers: { Authorization: "Bearer " + token },
        });
      } catch (e) {
        /* ignorar errores de red al logout */
      }
    }
    this.limpiar();
    window.location.href = "login.html";
  },

  // ============================================
  // GUARDIA: redirige si no hay sesión válida
  // ============================================
  async exigir(apiBase) {
    if (!this.activa()) {
      window.location.href = "login.html";
      return false;
    }
    const valida = await this.verificarConServidor(apiBase);
    if (!valida) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  },
};
