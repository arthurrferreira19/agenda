const API = {
  getToken() {
    return localStorage.getItem("mh_token");
  },
  setToken(token) {
    localStorage.setItem("mh_token", token);
  },
  clearToken() {
    localStorage.removeItem("mh_token");
  },
  async request(path, { method = "GET", body = null, auth = false } = {}) {
    const headers = { "Content-Type": "application/json" };

    if (auth) {
      const token = this.getToken();
      if (!token) {
        const e = new Error("Sem token (faça login novamente).");
        e.status = 401;
        e.data = null;
        throw e;
      }
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; }
    catch { data = { message: text }; }

    if (!res.ok) {
      const e = new Error(data.message || `Erro HTTP ${res.status}`);
      e.status = res.status;
      e.data = data;
      throw e;
    }

    return data;
  }
};