(() => {
  const gallery = document.getElementById("programacion-gallery");
  const conveniosGrid = document.getElementById("convenios-grid");
  const infoGrid = document.getElementById("info-grid");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const header = document.querySelector(".site-header");
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.getElementById("site-nav");

  function openLightbox(src, alt) {
    lightboxImg.src = src;
    lightboxImg.alt = alt || "";
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImg.src = "";
    document.body.style.overflow = "";
  }

  lightbox?.querySelector(".lightbox-close")?.addEventListener("click", closeLightbox);
  lightbox?.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !lightbox.hidden) closeLightbox();
  });

  navToggle?.addEventListener("click", () => {
    const open = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });

  siteNav?.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      siteNav.classList.remove("is-open");
      navToggle?.setAttribute("aria-expanded", "false");
    });
  });

  window.addEventListener(
    "scroll",
    () => {
      header?.classList.toggle("is-scrolled", window.scrollY > 24);
    },
    { passive: true }
  );

  function renderProgramacion(data) {
    const prog = data.programacion || {};
    const title = document.getElementById("prog-title");
    const lead = document.getElementById("prog-lead");
    const updated = document.getElementById("prog-updated");

    if (title && prog.titulo) title.textContent = prog.titulo;
    if (lead && prog.subtitulo) lead.textContent = prog.subtitulo;

    if (updated && prog.updatedAt) {
      const date = new Date(`${prog.updatedAt}T12:00:00`);
      updated.hidden = false;
      updated.textContent = `Actualizado · ${date.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "long",
      })}`;
    }

    const images = Array.isArray(prog.images) ? prog.images : [];
    gallery.innerHTML = "";

    if (!images.length) {
      gallery.innerHTML = `<div class="empty-state">Aún no hay programación publicada.</div>`;
      return;
    }

    gallery.classList.toggle("has-two", images.length > 1);

    images.forEach((item) => {
      const img = document.createElement("img");
      img.className = "prog-shot";
      img.src = item.path;
      img.alt = item.alt || "Programación de rodadas";
      img.loading = "lazy";
      img.addEventListener("click", () => openLightbox(item.path, img.alt));
      gallery.appendChild(img);
    });
  }

  function renderConvenios(data) {
    const list = Array.isArray(data.convenios) ? data.convenios : [];
    conveniosGrid.innerHTML = "";

    if (!list.length) {
      conveniosGrid.innerHTML = `<div class="empty-state">No hay convenios publicados todavía.</div>`;
      return;
    }

    list.forEach((item) => {
      const figure = document.createElement("figure");
      figure.className = "convenio-item";

      const img = document.createElement("img");
      img.className = "convenio-shot";
      img.src = item.path;
      img.alt = item.alt || item.titulo || "Convenio";
      img.loading = "lazy";
      img.addEventListener("click", () => openLightbox(item.path, img.alt));

      const caption = document.createElement("figcaption");
      caption.textContent = item.titulo || "Convenio";

      figure.append(img, caption);
      conveniosGrid.appendChild(figure);
    });
  }

  function renderInfo(data) {
    const info = data.info || {};
    const title = document.getElementById("info-title");
    const lead = document.getElementById("info-lead");
    if (title && info.titulo) title.textContent = info.titulo;
    if (lead && info.subtitulo) lead.textContent = info.subtitulo;

    const bloques = Array.isArray(info.bloques) ? info.bloques : [];
    infoGrid.innerHTML = "";

    bloques.forEach((block) => {
      const article = document.createElement("article");
      article.className = "info-block";

      const h3 = document.createElement("h3");
      h3.textContent = block.titulo || "Detalle";
      article.appendChild(h3);

      if (block.texto) {
        const p = document.createElement("p");
        p.textContent = block.texto;
        article.appendChild(p);
      }

      if (Array.isArray(block.items) && block.items.length) {
        const ul = document.createElement("ul");
        block.items.forEach((text) => {
          const li = document.createElement("li");
          li.textContent = text;
          ul.appendChild(li);
        });
        article.appendChild(ul);
      }

      if (Array.isArray(block.links) && block.links.length) {
        const links = document.createElement("div");
        links.className = "links";
        block.links.forEach((link) => {
          const a = document.createElement("a");
          a.href = link.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = link.label || link.url;
          links.appendChild(a);
        });
        article.appendChild(links);
      }

      infoGrid.appendChild(article);
    });
  }

  function setupReveals() {
    const nodes = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) {
      nodes.forEach((node) => node.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );

    nodes.forEach((node) => observer.observe(node));
  }

  async function loadContent() {
    // En file:// el fetch a JSON falla por CORS; usamos el JS embebido.
    // En http/https (local server o GitHub Pages) preferimos content.json actualizado.
    if (window.location.protocol.startsWith("http")) {
      try {
        const response = await fetch(`data/content.json?ts=${Date.now()}`);
        if (response.ok) return response.json();
      } catch (error) {
        console.warn("No se pudo leer content.json, usando respaldo local.", error);
      }
    }

    if (window.VAGAMUNDOS_CONTENT) return window.VAGAMUNDOS_CONTENT;
    throw new Error("No hay contenido disponible");
  }

  async function boot() {
    try {
      const data = await loadContent();
      renderProgramacion(data);
      renderConvenios(data);
      renderInfo(data);
    } catch (error) {
      console.error(error);
      gallery.innerHTML = `<div class="empty-state">Error cargando el contenido.</div>`;
    } finally {
      setupReveals();
    }
  }

  boot();
})();
