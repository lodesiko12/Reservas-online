/**
 * embed.js — Cargador del widget de reservas.
 *
 * Uso en la web del negocio:
 *   <div id="reservas-widget" data-slug="barberia-demo"></div>
 *   <script src="https://TU_WIDGET_URL/embed.js" async></script>
 *
 * Opcionales en el <div>:
 *   data-view="mi-reserva"   -> abre directamente la consulta de reserva
 *   data-widget-url="..."    -> fuerza la URL del widget (por defecto, la de este script)
 *
 * El widget se carga en un <iframe> aislado para no heredar ni romper el CSS
 * del sitio anfitrión, y se autoajusta en altura de forma responsive.
 */
(function () {
  "use strict";

  // URL base = origen desde el que se sirvió este propio script.
  var current = document.currentScript;
  var scriptSrc = current && current.src ? current.src : "";
  var defaultBase = scriptSrc ? scriptSrc.replace(/\/embed\.js.*$/, "") : "";

  function mount(el) {
    if (el.getAttribute("data-reservas-mounted")) return;
    el.setAttribute("data-reservas-mounted", "1");

    var slug = el.getAttribute("data-slug");
    if (!slug) { console.error("[reservas] Falta data-slug en el contenedor del widget."); return; }
    var base = el.getAttribute("data-widget-url") || defaultBase;
    var view = el.getAttribute("data-view");

    var url = base + "/?slug=" + encodeURIComponent(slug);
    if (view) url += "&view=" + encodeURIComponent(view);

    var iframe = document.createElement("iframe");
    iframe.src = url;
    iframe.title = "Reservas";
    iframe.loading = "lazy";
    iframe.setAttribute("frameborder", "0");
    iframe.style.width = "100%";
    iframe.style.border = "0";
    iframe.style.overflow = "hidden";
    iframe.style.height = "620px"; // altura inicial; se ajusta con postMessage
    iframe.style.maxWidth = "520px";
    iframe.style.display = "block";
    iframe.style.margin = "0 auto";
    el.appendChild(iframe);

    // Escucha la altura reportada por el widget y ajusta el iframe.
    window.addEventListener("message", function (ev) {
      if (!ev.data || ev.data.type !== "reservas-widget:height") return;
      // Solo del iframe que montamos (misma URL base).
      if (base && ev.origin && url.indexOf(ev.origin) !== 0) return;
      var h = parseInt(ev.data.height, 10);
      if (h && h > 100) iframe.style.height = h + "px";
    });
  }

  function init() {
    var nodes = document.querySelectorAll("#reservas-widget, .reservas-widget");
    for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
