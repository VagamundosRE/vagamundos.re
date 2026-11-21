(() => {
  const gallery = document.getElementById("programacion-gallery");
  const conveniosGrid = document.getElementById("convenios-grid");
  const coachingGrid = document.getElementById("coaching-grid");
  const talleresFilters = document.getElementById("talleres-filters");
  const talleresGrid = document.getElementById("talleres-grid");
  const infoGrid = document.getElementById("info-grid");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const header = document.querySelector(".site-header");
  const navToggle = document.querySelector(".nav-toggle");
  const siteNav = document.getElementById("site-nav");
  let talleresState = { regiones: [], ciudad: "todas" };

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

  function renderProgramacionMeta(data) {
    const prog = data.programacion || {};
    const title = document.getElementById("prog-title");
    const lead = document.getElementById("prog-lead");
    if (title && prog.titulo) title.textContent = prog.titulo;
    if (lead && prog.subtitulo) lead.textContent = prog.subtitulo;
  }

  function renderProgramacionGallery(manifest) {
    const updated = document.getElementById("prog-updated");
    const images = Array.isArray(manifest?.images) ? manifest.images : [];
    const periodo = String(manifest?.periodo || "").trim();

    if (updated) {
      if (periodo) {
        updated.hidden = false;
        updated.textContent = periodo;
      } else {
        updated.hidden = true;
        updated.textContent = "";
      }
    }

    gallery.innerHTML = "";
    gallery.classList.remove("has-two");

    if (!images.length) {
      gallery.innerHTML = `<div class="empty-state">Aún no hay programación publicada.</div>`;
      return;
    }

    window.VagamundosCarousel.create({
      root: gallery,
      items: images,
      renderSlide(item) {
        const img = document.createElement("img");
        img.className = "prog-shot";
        img.src = item.path;
        img.alt = item.alt || "Programación de rodadas";
        img.draggable = false;
        return img;
      },
      onSlideClick(item) {
        openLightbox(item.path, item.alt || "Programación de rodadas");
      },
    });
  }

  async function loadProgramacionManifest() {
    if (window.location.protocol.startsWith("http")) {
      try {
        const response = await fetch(`data/programacion-manifest.json?ts=${Date.now()}`);
        if (response.ok) return response.json();
      } catch (error) {
        console.warn("No se pudo leer programacion-manifest.json", error);
      }

      // Respaldo: listar carpeta pública en GitHub
      try {
        const cfgRes = await fetch(`data/admin-config.json?ts=${Date.now()}`);
        if (cfgRes.ok) {
          const cfg = await cfgRes.json();
          const owner = cfg.repoOwner;
          const repo = cfg.repoName;
          const branch = cfg.branch || "main";
          if (owner && repo) {
            const api = `https://api.github.com/repos/${owner}/${repo}/contents/assets/programacion?ref=${encodeURIComponent(branch)}`;
            const dirRes = await fetch(api, {
              headers: { Accept: "application/vnd.github+json" },
            });
            if (dirRes.ok) {
              const entries = await dirRes.json();
              const images = (Array.isArray(entries) ? entries : [])
                .filter((e) => e.type === "file" && /\.(jpe?g|png|webp|gif)$/i.test(e.name))
                .sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }))
                .map((e, i) => ({
                  path: e.path,
                  alt: `Programación de rodadas ${i + 1}`,
                }));
              return { updatedAt: new Date().toISOString().slice(0, 10), images };
            }
          }
        }
      } catch (error) {
        console.warn("No se pudo listar programación en GitHub", error);
      }
    }

    return window.VAGAMUNDOS_PROGRAMACION || { images: [] };
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

  function cleanText(value) {
    return String(value || "")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function phoneLink(celular) {
    const digits = String(celular || "").replace(/\D/g, "");
    if (!digits) return null;
    const withCountry = digits.length === 10 ? `57${digits}` : digits;
    return `https://wa.me/${withCountry}`;
  }

  function socialLinks(raw) {
    if (!raw) return [];
    const links = [];
    const text = String(raw);

    text.split(/\n|;/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const urlMatch = trimmed.match(/https?:\/\/\S+/i);
      if (urlMatch) {
        links.push({ label: "Ver red", url: urlMatch[0] });
        return;
      }

      const ig = trimmed.match(/@([a-z0-9._]+)/i);
      if (/instagram|ig\s*:/i.test(trimmed) && ig) {
        links.push({ label: `IG @${ig[1]}`, url: `https://instagram.com/${ig[1]}` });
        return;
      }
      if (/tiktok/i.test(trimmed) && ig) {
        links.push({ label: `TikTok @${ig[1]}`, url: `https://tiktok.com/@${ig[1]}` });
        return;
      }
      if (/facebook|fb\s*:/i.test(trimmed) && ig) {
        links.push({ label: `FB @${ig[1]}`, url: `https://facebook.com/${ig[1]}` });
        return;
      }
      if (ig && !/linkedin/i.test(trimmed)) {
        links.push({ label: `@${ig[1]}`, url: `https://instagram.com/${ig[1]}` });
      }
    });

    return links;
  }

  function renderCoaching(list) {
    coachingGrid.innerHTML = "";
    if (!Array.isArray(list) || !list.length) {
      coachingGrid.innerHTML = `<div class="empty-state">Aún no hay servicios publicados.</div>`;
      return;
    }

    list.forEach((item) => {
      const card = document.createElement("article");
      card.className = "coaching-card";

      const business = cleanText(item.nombre_negocio) || "Servicio";
      const pilot = cleanText(item.nombre_piloto) || "Piloto";

      const h3 = document.createElement("h3");
      h3.textContent = business;
      card.appendChild(h3);

      const pilotEl = document.createElement("p");
      pilotEl.className = "coaching-pilot";
      pilotEl.textContent = pilot;
      card.appendChild(pilotEl);

      if (item.actividad_economica) {
        const activity = document.createElement("p");
        activity.className = "coaching-activity";
        activity.textContent = cleanText(item.actividad_economica);
        card.appendChild(activity);
      }

      if (item.descuento) {
        const discount = document.createElement("p");
        discount.className = "coaching-discount";
        discount.textContent = `Descuento Vagamundos: ${cleanText(item.descuento)}`;
        card.appendChild(discount);
      }

      const contacts = document.createElement("div");
      contacts.className = "coaching-contacts";

      const wa = phoneLink(item.celular);
      if (wa) {
        const a = document.createElement("a");
        a.href = wa;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = `WhatsApp ${item.celular}`;
        contacts.appendChild(a);
      }

      if (item.mail) {
        const a = document.createElement("a");
        a.href = `mailto:${item.mail}`;
        a.textContent = item.mail;
        contacts.appendChild(a);
      }

      socialLinks(item.redes_sociales).forEach((link) => {
        const a = document.createElement("a");
        a.href = link.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = link.label;
        contacts.appendChild(a);
      });

      if (contacts.childNodes.length) card.appendChild(contacts);
      coachingGrid.appendChild(card);
    });
  }

  function formatRegionLabel(region) {
    const raw = String(region || "").trim();
    if (!raw) return "Sin ciudad";
    const labels = {
      CALI: "Cali",
      "EJE CAFETERO": "Eje cafetero",
      POPAYAN: "Popayán",
      PASTO: "Pasto",
      BOGOTA: "Bogotá",
      MEDELLIN: "Medellín",
    };
    if (labels[raw.toUpperCase()]) return labels[raw.toUpperCase()];
    return raw
      .toLowerCase()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  function extractUrls(text) {
    return String(text || "").match(/https?:\/\/[^\s)]+/gi) || [];
  }

  function extractPhones(text) {
    const matches = String(text || "").match(/(?:\+?\d[\d\s().-]{7,}\d)/g) || [];
    const phones = [];
    matches.forEach((match) => {
      const digits = match.replace(/\D/g, "");
      if (digits.length >= 10 && !phones.includes(digits)) phones.push(digits);
    });
    return phones;
  }

  function stripPhonesAndContactLabels(text) {
    return cleanText(
      String(text || "")
        .replace(/https?:\/\/[^\s)]+/gi, "")
        .replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "")
        .replace(/\b(?:whatsapp|wa|cel\.?|tel\.?|celular|telefono|teléfono)\s*:?\s*/gi, "")
        .replace(/^📍\s*/g, "")
        .replace(/\(\s*\)/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\s*([,;:.\-–—])\s*(?=[,;:.\-–—]|$)/g, "")
        .replace(/^[,;:.\-–—\s]+|[,;:.\-–—\s]+$/g, "")
    );
  }

  function parseTallerDetalle(lines, nombre) {
    const details = Array.isArray(lines) ? lines.map((line) => String(line || "").trim()).filter(Boolean) : [];
    const blob = [nombre, ...details].join("\n");
    const urls = extractUrls(blob);
    const phones = extractPhones(blob);
    const texts = details
      .map((line) => stripPhonesAndContactLabels(line))
      .filter(Boolean);

    return {
      nombre: stripPhonesAndContactLabels(nombre) || "Taller",
      texts,
      urls,
      phones,
    };
  }

  function renderTalleresFilters() {
    if (!talleresFilters) return;
    talleresFilters.innerHTML = "";

    const options = [{ id: "todas", label: "Todas" }].concat(
      talleresState.regiones.map((region) => ({
        id: region.region,
        label: formatRegionLabel(region.region),
      }))
    );

    options.forEach((option) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "talleres-filter";
      button.textContent = option.label;
      button.setAttribute("aria-pressed", String(talleresState.ciudad === option.id));
      if (talleresState.ciudad === option.id) button.classList.add("is-active");
      button.addEventListener("click", () => {
        talleresState.ciudad = option.id;
        renderTalleresFilters();
        renderTalleresList();
      });
      talleresFilters.appendChild(button);
    });
  }

  function renderTalleresList() {
    if (!talleresGrid) return;
    talleresGrid.innerHTML = "";

    const regions = talleresState.regiones.filter((region) => {
      if (talleresState.ciudad === "todas") return true;
      return region.region === talleresState.ciudad;
    });

    const entries = [];
    regions.forEach((region) => {
      (Array.isArray(region.talleres) ? region.talleres : []).forEach((taller) => {
        entries.push({ region: region.region, taller });
      });
    });

    if (!entries.length) {
      talleresGrid.innerHTML = `<div class="empty-state">No hay talleres para esta ciudad.</div>`;
      return;
    }

    entries.forEach(({ region, taller }) => {
      const article = document.createElement("article");
      article.className = "taller-card";

      const city = document.createElement("p");
      city.className = "taller-city";
      city.textContent = formatRegionLabel(region);
      article.appendChild(city);

      const parsed = parseTallerDetalle(taller.detalles, taller.nombre);

      const h3 = document.createElement("h3");
      h3.textContent = parsed.nombre;
      article.appendChild(h3);

      if (parsed.texts.length) {
        const ul = document.createElement("ul");
        ul.className = "taller-details";
        parsed.texts.forEach((text) => {
          const li = document.createElement("li");
          li.textContent = text;
          ul.appendChild(li);
        });
        article.appendChild(ul);
      }

      const contacts = document.createElement("div");
      contacts.className = "taller-contacts";

      parsed.phones.forEach((digits) => {
        const display = digits.length === 12 && digits.startsWith("57") ? digits.slice(2) : digits;
        const a = document.createElement("a");
        a.href = phoneLink(digits);
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = `WhatsApp ${display}`;
        contacts.appendChild(a);
      });

      parsed.urls.forEach((url) => {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = /maps\.google|goo\.gl\/maps|maps\.app/i.test(url) ? "Ver en Maps" : "Sitio web";
        contacts.appendChild(a);
      });

      if (contacts.childNodes.length) article.appendChild(contacts);
      talleresGrid.appendChild(article);
    });
  }

  function renderTalleres(data) {
    const regiones = Array.isArray(data?.regiones) ? data.regiones : [];
    talleresState = {
      regiones,
      ciudad: talleresState.ciudad === "todas" || regiones.some((r) => r.region === talleresState.ciudad)
        ? talleresState.ciudad
        : "todas",
    };
    renderTalleresFilters();
    renderTalleresList();
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
      article.className = block.wide ? "info-block info-block-wide" : "info-block";

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
    const nodes = [...document.querySelectorAll(".reveal")];
    if (!nodes.length) return;

    const show = (node) => node.classList.add("is-visible");

    if (!("IntersectionObserver" in window)) {
      nodes.forEach(show);
      return;
    }

    // Solo títulos de sección usan .reveal (las grillas altas ya no).
    // threshold 0 + margen amplio: se activa apenas el bloque se acerca al viewport.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            show(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0, rootMargin: "10% 0px 10% 0px" }
    );

    nodes.forEach((node) => observer.observe(node));

    // Failsafe: si algo quedó oculto, mostrarlo al interactuar o tras un momento.
    const revealPending = () => {
      nodes.forEach((node) => {
        if (!node.classList.contains("is-visible")) show(node);
      });
    };
    window.setTimeout(revealPending, 2500);
    window.addEventListener("scroll", revealPending, { once: true, passive: true });
    window.addEventListener("touchstart", revealPending, { once: true, passive: true });
  }

  async function loadContent() {
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

  async function loadCoaching() {
    if (window.location.protocol.startsWith("http")) {
      try {
        const response = await fetch(`data/coaching_vagamundos.json?ts=${Date.now()}`);
        if (response.ok) return response.json();
      } catch (error) {
        console.warn("No se pudo leer coaching_vagamundos.json, usando respaldo local.", error);
      }
    }
    return window.VAGAMUNDOS_COACHING || [];
  }

  async function loadTalleres() {
    if (window.location.protocol.startsWith("http")) {
      try {
        const response = await fetch(`data/talleres.json?ts=${Date.now()}`);
        if (response.ok) return response.json();
      } catch (error) {
        console.warn("No se pudo leer talleres.json, usando respaldo local.", error);
      }
    }
    return window.VAGAMUNDOS_TALLERES || { regiones: [] };
  }

  async function boot() {
    try {
      const [data, coaching, programacion, talleres] = await Promise.all([
        loadContent(),
        loadCoaching(),
        loadProgramacionManifest(),
        loadTalleres(),
      ]);
      renderProgramacionMeta(data);
      renderProgramacionGallery(programacion);
      renderConvenios(data);
      renderCoaching(coaching);
      renderTalleres(talleres);
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
