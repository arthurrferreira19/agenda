// public/assets/js/icons.js
// Centraliza a inicialização dos ícones (evita script inline e melhora compatibilidade com CSP)
(function () {
  function safeCreate() {
    try {
      if (window.lucide && typeof window.lucide.createIcons === "function") {
        window.lucide.createIcons();
      }
    } catch (_) {}
  }

  // expõe helper para páginas que trocam ícones dinamicamente
  window.MHIcons = {
    refresh: safeCreate
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", safeCreate);
  } else {
    safeCreate();
  }
})();
