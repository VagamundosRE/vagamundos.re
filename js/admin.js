(() => {
  const Git = window.VagamundosGit;
  const STORAGE_KEY = "vagamundos-admin-session";
  const PROG_DIR = "assets/programacion";

  const loginPanel = document.getElementById("login-panel");
  const dashboard = document.getElementById("dashboard");
  const loginStatus = document.getElementById("login-status");
  const globalStatus = document.getElementById("global-status");
  const sessionInfo = document.getElementById("session-info");
  const progSlots = document.getElementById("prog-slots");
  const conveniosList = document.getElementById("convenios-list");

  let config = null;
  let session = null;
  let content = null;
  let contentSha = null;
  let coaching = [];
  let coachingSha = null;
  let programacionImages = [];
  let programacionPeriodo = "";

  function showStatus(el, message, type) {
    el.classList.remove("hidden", "ok", "err");
    el.classList.add(type);
    el.textContent = message;
  }

  function clearStatus(el) {
    el.classList.add("hidden");
    el.textContent = "";
  }

  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function withRoot(path) {
    const root = (session.siteRoot || "").replace(/^\/+|\/+$/g, "");
    return root ? `${root}/${path}` : path;
  }

  function repoArgs() {
    return {
      owner: session.owner,
      repo: session.repo,
      branch: session.branch,
      token: session.token,
    };
  }

  function saveSession() {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        owner: session.owner,
        repo: session.repo,
        branch: session.branch,
        siteRoot: session.siteRoot,
        token: session.token,
      })
    );
  }

  function loadSession() {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setBusy(busy) {
    document.querySelectorAll(".btn, .file-btn").forEach((btn) => {
      btn.disabled = busy;
      if (busy) btn.setAttribute("aria-disabled", "true");
      else btn.removeAttribute("aria-disabled");
    });
    document.querySelectorAll('input[type="file"]').forEach((input) => {
      input.disabled = busy;
    });
  }

  async function loadLocalConfig() {
    const response = await fetch(`data/admin-config.json?ts=${Date.now()}`);
    if (!response.ok) throw new Error("No se pudo leer la configuración del sitio");
    config = await response.json();

    if (!config.repoOwner || !config.repoName) {
      throw new Error(
        "Falta configurar el repositorio en data/admin-config.json (repoOwner y repoName)."
      );
    }
  }

  async function fetchContent() {
    const path = withRoot("data/content.json");
    const file = await Git.getFile({ ...repoArgs(), path });
    if (!file) throw new Error("No se encontró el contenido del sitio en GitHub");
    content = JSON.parse(Git.decodeBase64Utf8(file.content));
    contentSha = file.sha;
    content.programacion = content.programacion || {
      titulo: "Programación de rodadas",
      subtitulo: "Calendario trimestral del grupo",
    };
    // Las imágenes de programación viven en la carpeta, no en content.json
    delete content.programacion.images;
    delete content.programacion.updatedAt;

    content.info = content.info || {
      titulo: "Información relevante",
      subtitulo: "Referencias útiles",
      bloques: [],
    };
    if (!Array.isArray(content.info.bloques)) content.info.bloques = [];

    await fetchCoaching();
    await loadProgramacionState();
    renderProgramacionAdmin();
    renderConveniosAdmin();
    renderCoachingAdmin();
    renderInfoAdmin();
    sessionInfo.textContent = coaching.length
      ? `Conectado · ${coaching.length} servicios listos para editar`
      : "Conectado · puedes publicar cambios";
  }

  function normalizeCoachingList(parsed) {
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.servicios)) return parsed.servicios;
    if (Array.isArray(parsed?.items)) return parsed.items;
    return [];
  }

  async function fetchCoachingFromUrl(url) {
    const response = await fetch(url);
    if (!response.ok) return null;
    return normalizeCoachingList(await response.json());
  }

  async function fetchCoaching() {
    const path = withRoot("data/coaching_vagamundos.json");
    coaching = [];
    coachingSha = null;

    try {
      const file = await Git.getFile({ ...repoArgs(), path });
      if (file?.sha) coachingSha = file.sha;

      if (file?.content) {
        coaching = normalizeCoachingList(JSON.parse(Git.decodeBase64Utf8(file.content)));
        if (coaching.length) return;
      }

      if (file?.download_url) {
        const fromDownload = await fetchCoachingFromUrl(`${file.download_url}${file.download_url.includes("?") ? "&" : "?"}ts=${Date.now()}`);
        if (fromDownload?.length) {
          coaching = fromDownload;
          return;
        }
      }
    } catch (error) {
      console.warn("No se pudo leer coaching desde la API de GitHub.", error);
    }

    const rawUrl = `https://raw.githubusercontent.com/${session.owner}/${session.repo}/${encodeURIComponent(
      session.branch
    )}/${path}?ts=${Date.now()}`;

    try {
      const fromRaw = await fetchCoachingFromUrl(rawUrl);
      if (fromRaw?.length) {
        coaching = fromRaw;
        return;
      }
    } catch (error) {
      console.warn("No se pudo leer coaching desde raw.githubusercontent.", error);
    }

    try {
      const fromLocal = await fetchCoachingFromUrl(`data/coaching_vagamundos.json?ts=${Date.now()}`);
      if (fromLocal?.length) {
        coaching = fromLocal;
        return;
      }
    } catch (error) {
      console.warn("No se pudo leer coaching local.", error);
    }
  }

  async function refreshCoachingSha() {
    const path = withRoot("data/coaching_vagamundos.json");
    const file = await Git.getFile({ ...repoArgs(), path });
    coachingSha = file?.sha || null;
  }

  async function commitCoaching(message) {
    await refreshCoachingSha();
    const jsonText = `${JSON.stringify(coaching, null, 2)}\n`;
    const path = withRoot("data/coaching_vagamundos.json");
    const result = await Git.putFile({
      ...repoArgs(),
      path,
      contentBase64: Git.textToBase64(jsonText),
      message,
      sha: coachingSha,
    });
    coachingSha = result.content.sha;

    const dataJsPath = withRoot("js/coaching-data.js");
    const existingJs = await Git.getFile({ ...repoArgs(), path: dataJsPath });
    const dataJs = `window.VAGAMUNDOS_COACHING = ${JSON.stringify(coaching, null, 2)};\n`;
    await Git.putFile({
      ...repoArgs(),
      path: dataJsPath,
      contentBase64: Git.textToBase64(dataJs),
      message: `${message} (respaldo local)`,
      sha: existingJs?.sha,
    });
  }

  function rawAssetUrl(path) {
    const root = (session.siteRoot || "").replace(/^\/+|\/+$/g, "");
    const fullPath = root ? `${root}/${path}` : path;
    return `https://raw.githubusercontent.com/${session.owner}/${session.repo}/${encodeURIComponent(
      session.branch
    )}/${fullPath}?t=${Date.now()}`;
  }

  function syncPeriodoInput() {
    const input = document.getElementById("prog-periodo");
    if (input) input.value = programacionPeriodo || "";
  }

  function readPeriodoInput() {
    const input = document.getElementById("prog-periodo");
    programacionPeriodo = input ? input.value.trim() : programacionPeriodo;
    return programacionPeriodo;
  }

  function renderProgramacionAdmin() {
    const images = programacionImages;
    const carreteRoot = document.getElementById("prog-carrete");
    progSlots.innerHTML = "";
    syncPeriodoInput();

    if (carreteRoot) {
      if (!images.length) {
        carreteRoot.innerHTML = `<p class="empty-note">Todavía no hay programación. Usa “Agregar imagen”.</p>`;
      } else {
        window.VagamundosCarousel.create({
          root: carreteRoot,
          items: images,
          renderSlide(item, index) {
            const wrap = document.createElement("div");
            wrap.className = "admin-carrete-slide";
            const img = document.createElement("img");
            img.src = rawAssetUrl(item.path);
            img.alt = item.alt || `Programación ${index + 1}`;
            img.draggable = false;
            const label = document.createElement("div");
            label.className = "prog-slot-title";
            label.textContent = `Imagen ${index + 1}`;
            wrap.append(label, img);
            return wrap;
          },
        });
      }
    }

    if (!images.length) {
      progSlots.innerHTML = "";
    }

    images.forEach((item, index) => {
      const wrap = document.createElement("div");
      wrap.className = "prog-slot";

      const title = document.createElement("div");
      title.className = "prog-slot-title";
      const fileName = String(item.path || "").split("/").pop() || `imagen-${index + 1}`;
      title.textContent = `${index + 1}. ${fileName}`;

      const actions = document.createElement("div");
      actions.className = "actions";

      const replaceLabel = document.createElement("label");
      replaceLabel.className = "btn btn-ghost file-btn";
      replaceLabel.textContent = "Cambiar";
      const replaceInput = document.createElement("input");
      replaceInput.type = "file";
      replaceInput.accept = "image/*";
      replaceInput.hidden = true;
      replaceInput.addEventListener("change", () => {
        const file = replaceInput.files?.[0];
        if (file) replaceProgramacionImage(index, file);
        replaceInput.value = "";
      });
      replaceLabel.appendChild(replaceInput);

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-danger";
      del.textContent = "Quitar";
      del.addEventListener("click", () => deleteProgramacionImage(index));

      actions.append(replaceLabel, del);
      wrap.append(title, actions);
      progSlots.appendChild(wrap);
    });
  }

  function toPublicAssetPath(entry) {
    let path = entry.path && entry.path.includes("/") ? entry.path : `${PROG_DIR}/${entry.name}`;
    const root = (session.siteRoot || "").replace(/^\/+|\/+$/g, "");
    if (root && path.startsWith(`${root}/`)) path = path.slice(root.length + 1);
    return path;
  }

  function padProgIndex(n) {
    return String(n).padStart(2, "0");
  }

  function progFileName(index, ext) {
    return `programa-${padProgIndex(index)}.${ext}`;
  }

  function imagesFromFolderListing(entries) {
    return (entries || [])
      .filter((entry) => entry.type === "file" && Git.isImagePath(entry.name || entry.path))
      .sort((a, b) => String(a.name).localeCompare(String(b.name), "es", { numeric: true }))
      .map((entry, index) => ({
        path: toPublicAssetPath(entry),
        alt: `Programación de rodadas ${index + 1}`,
      }));
  }

  async function rebuildProgramacionFromFolder() {
    const entries = await Git.listDir({
      ...repoArgs(),
      path: withRoot(PROG_DIR),
    });
    programacionImages = imagesFromFolderListing(entries);
  }

  async function loadProgramacionState() {
    programacionPeriodo = "";
    try {
      const manifestPath = withRoot("data/programacion-manifest.json");
      const file = await Git.getFile({ ...repoArgs(), path: manifestPath });
      if (file?.content) {
        const manifest = JSON.parse(Git.decodeBase64Utf8(file.content));
        programacionPeriodo = String(manifest.periodo || "").trim();
      }
    } catch (error) {
      console.warn("No se pudo leer el manifiesto de programación.", error);
    }

    await rebuildProgramacionFromFolder();
    syncPeriodoInput();
  }

  async function publishProgramacionManifest(message) {
    readPeriodoInput();
    await rebuildProgramacionFromFolder();

    const manifest = {
      updatedAt: new Date().toISOString().slice(0, 10),
      periodo: programacionPeriodo,
      images: programacionImages,
    };

    const manifestPath = withRoot("data/programacion-manifest.json");
    const existingManifest = await Git.getFile({ ...repoArgs(), path: manifestPath });
    await Git.putFile({
      ...repoArgs(),
      path: manifestPath,
      contentBase64: Git.textToBase64(`${JSON.stringify(manifest, null, 2)}\n`),
      message,
      sha: existingManifest?.sha,
    });

    const dataJsPath = withRoot("js/programacion-data.js");
    const existingJs = await Git.getFile({ ...repoArgs(), path: dataJsPath });
    const dataJs = `window.VAGAMUNDOS_PROGRAMACION = ${JSON.stringify(manifest, null, 2)};\n`;
    await Git.putFile({
      ...repoArgs(),
      path: dataJsPath,
      contentBase64: Git.textToBase64(dataJs),
      message: `${message} (respaldo local)`,
      sha: existingJs?.sha,
    });
  }

  async function saveProgramacionPeriodo() {
    setBusy(true);
    clearStatus(globalStatus);
    try {
      await publishProgramacionManifest("Actualizar periodo de programación");
      showStatus(
        globalStatus,
        programacionPeriodo
          ? `Periodo guardado: ${programacionPeriodo}`
          : "Periodo vaciado. En el sitio no se mostrará etiqueta.",
        "ok"
      );
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  function renderConveniosAdmin() {
    conveniosList.innerHTML = "";
    const list = content.convenios || [];
    if (!list.length) {
      conveniosList.innerHTML = `<p class="empty-note">No hay convenios todavía.</p>`;
      return;
    }

    list.forEach((item) => {
      const wrap = document.createElement("div");
      wrap.className = "convenio-admin";

      const img = document.createElement("img");
      img.src = rawAssetUrl(item.path);
      img.alt = item.alt || item.titulo || "Convenio";

      const title = document.createElement("strong");
      title.textContent = item.titulo || "Convenio";

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn-danger";
      del.textContent = "Quitar";
      del.addEventListener("click", () => deleteConvenio(item.id));

      wrap.append(img, title, del);
      conveniosList.appendChild(wrap);
    });
  }

  async function refreshContentSha() {
    const path = withRoot("data/content.json");
    const file = await Git.getFile({ ...repoArgs(), path });
    contentSha = file?.sha || null;
  }

  async function commitContent(message) {
    // Nunca guardar imágenes de programación aquí: viven en la carpeta + manifest
    if (content?.programacion) {
      delete content.programacion.images;
      delete content.programacion.updatedAt;
    }

    await refreshContentSha();
    const jsonText = `${JSON.stringify(content, null, 2)}\n`;
    const path = withRoot("data/content.json");
    const result = await Git.putFile({
      ...repoArgs(),
      path,
      contentBase64: Git.textToBase64(jsonText),
      message,
      sha: contentSha,
    });
    contentSha = result.content.sha;

    const dataJsPath = withRoot("js/content-data.js");
    const existingJs = await Git.getFile({ ...repoArgs(), path: dataJsPath });
    const dataJs = `window.VAGAMUNDOS_CONTENT = ${JSON.stringify(content, null, 2)};\n`;
    await Git.putFile({
      ...repoArgs(),
      path: dataJsPath,
      contentBase64: Git.textToBase64(dataJs),
      message: `${message} (respaldo local)`,
      sha: existingJs?.sha,
    });
  }

  async function uploadBinary(path, file, message) {
    const existing = await Git.getFile({ ...repoArgs(), path });
    return Git.putFile({
      ...repoArgs(),
      path,
      contentBase64: await Git.fileToBase64(file),
      message,
      sha: existing?.sha,
    });
  }

  async function removeRepoFile(relativePath) {
    const path = withRoot(relativePath);
    const existing = await Git.getFile({ ...repoArgs(), path });
    if (!existing) return;
    try {
      await Git.deleteFile({
        ...repoArgs(),
        path,
        sha: existing.sha,
        message: `Quitar archivo ${relativePath}`,
      });
    } catch (error) {
      if (!String(error.message).includes("404")) throw error;
    }
  }

  async function addProgramacionImages(fileList) {
    const files = [...fileList].filter(Boolean);
    if (!files.length) {
      showStatus(globalStatus, "Elige una o más imágenes.", "err");
      return;
    }

    setBusy(true);
    clearStatus(globalStatus);
    showStatus(globalStatus, `Agregando ${files.length} imagen(es)…`, "ok");

    try {
      await rebuildProgramacionFromFolder();
      const start = programacionImages.length + 1;

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const ext = Git.extensionFromFile(file);
        const relative = `${PROG_DIR}/${progFileName(start + i, ext)}`;
        await uploadBinary(withRoot(relative), file, `Agregar programación ${start + i}`);
      }

      await publishProgramacionManifest(`Agregar ${files.length} imagen(es) de programación`);
      renderProgramacionAdmin();
      showStatus(
        globalStatus,
        `${files.length} imagen(es) agregada(s) como programa-${padProgIndex(start)}… El sitio puede tardar 1–2 min.`,
        "ok"
      );
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function replaceProgramacionImage(index, file) {
    const current = programacionImages[index];
    if (!current) return;

    setBusy(true);
    clearStatus(globalStatus);
    showStatus(globalStatus, `Cambiando imagen ${index + 1}…`, "ok");

    try {
      const ext = Git.extensionFromFile(file);
      const relative = `${PROG_DIR}/${progFileName(index + 1, ext)}`;
      await uploadBinary(withRoot(relative), file, `Cambiar programación ${index + 1}`);

      const oldPath = current.path;
      if (oldPath && oldPath !== relative) await removeRepoFile(oldPath);

      await publishProgramacionManifest(`Cambiar imagen de programación ${index + 1}`);
      renderProgramacionAdmin();
      showStatus(globalStatus, `Imagen ${index + 1} actualizada (${progFileName(index + 1, ext)}).`, "ok");
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProgramacionImage(index) {
    const current = programacionImages[index];
    if (!current) return;
    if (!confirm(`¿Quitar la imagen ${index + 1} de la programación?`)) return;

    setBusy(true);
    clearStatus(globalStatus);
    showStatus(globalStatus, "Quitando imagen…", "ok");

    try {
      await removeRepoFile(current.path);
      await publishProgramacionManifest(`Quitar imagen de programación ${index + 1}`);
      renderProgramacionAdmin();
      showStatus(
        globalStatus,
        "Imagen eliminada. Si el orden quedó raro, usa “Reemplazar todas” y súbelas numeradas.",
        "ok"
      );
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function replaceAllProgramacion(files) {
    const selected = [...files].filter(Boolean);
    if (!selected.length) {
      showStatus(globalStatus, "Elige una o más imágenes.", "err");
      return;
    }

    const currentCount = programacionImages.length;
    const confirmMsg =
      currentCount > 0
        ? `Esto borrará las ${currentCount} imagen(es) actuales y subirá ${selected.length} como programa-01, 02… en el orden elegido. ¿Continuar?`
        : `Se publicarán ${selected.length} imagen(es) como programa-01, 02… ¿Continuar?`;
    if (!confirm(confirmMsg)) return;

    setBusy(true);
    clearStatus(globalStatus);
    showStatus(globalStatus, "Reemplazando programación…", "ok");

    try {
      const oldImages = [...programacionImages];
      const keepNames = new Set();

      for (let i = 0; i < selected.length; i += 1) {
        const file = selected[i];
        const ext = Git.extensionFromFile(file);
        const name = progFileName(i + 1, ext);
        const relative = `${PROG_DIR}/${name}`;
        keepNames.add(name);
        await uploadBinary(withRoot(relative), file, `Reemplazar programación ${i + 1}`);
      }

      for (const old of oldImages) {
        if (!old?.path) continue;
        const oldName = old.path.split("/").pop();
        if (keepNames.has(oldName)) continue;
        await removeRepoFile(old.path);
      }

      const entries = await Git.listDir({ ...repoArgs(), path: withRoot(PROG_DIR) });
      for (const entry of entries) {
        if (entry.type !== "file" || !Git.isImagePath(entry.name)) continue;
        if (keepNames.has(entry.name)) continue;
        await removeRepoFile(toPublicAssetPath(entry));
      }

      await publishProgramacionManifest("Reemplazar programación de rodadas");
      renderProgramacionAdmin();
      showStatus(
        globalStatus,
        `${selected.length} imagen(es) como programa-01…${padProgIndex(selected.length)}. El sitio puede tardar 1–2 min.`,
        "ok"
      );
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function syncProgramacionFolder() {
    setBusy(true);
    clearStatus(globalStatus);
    showStatus(globalStatus, "Sincronizando carpeta de programación…", "ok");
    try {
      await loadProgramacionState();
      await publishProgramacionManifest("Sincronizar programación desde carpeta");
      renderProgramacionAdmin();
      showStatus(
        globalStatus,
        `Carpeta sincronizada · ${programacionImages.length} imagen(es) ordenadas por nombre.`,
        "ok"
      );
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function clearAllProgramacion() {
    const currentCount = programacionImages.length;
    if (!currentCount) {
      showStatus(globalStatus, "No hay imágenes para borrar.", "err");
      return;
    }
    if (!confirm(`¿Borrar las ${currentCount} imagen(es) de programación?`)) return;

    setBusy(true);
    clearStatus(globalStatus);
    showStatus(globalStatus, "Borrando programación…", "ok");
    try {
      const entries = await Git.listDir({ ...repoArgs(), path: withRoot(PROG_DIR) });
      for (const entry of entries) {
        if (entry.type !== "file" || !Git.isImagePath(entry.name)) continue;
        await removeRepoFile(toPublicAssetPath(entry));
      }
      programacionImages = [];
      await publishProgramacionManifest("Borrar toda la programación");
      renderProgramacionAdmin();
      showStatus(globalStatus, "Programación vaciada.", "ok");
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function login() {
    clearStatus(loginStatus);
    const password = document.getElementById("site-password").value.trim();
    const token = document.getElementById("github-token").value.trim();

    if (!password || !token) {
      showStatus(loginStatus, "Escribe la contraseña y el código de publicación.", "err");
      return;
    }

    const hash = await sha256(password);
    if (hash !== config.passwordHash) {
      showStatus(loginStatus, "Contraseña incorrecta.", "err");
      return;
    }

    session = {
      owner: config.repoOwner,
      repo: config.repoName,
      branch: config.branch || "main",
      siteRoot: config.siteRoot || "",
      token,
    };

    setBusy(true);
    try {
      await fetchContent();
      saveSession();
      loginPanel.classList.add("hidden");
      dashboard.classList.remove("hidden");
      showStatus(globalStatus, "Listo. Los cambios se verán en la web en uno o dos minutos.", "ok");
    } catch (error) {
      session = null;
      showStatus(
        loginStatus,
        "No se pudo conectar. Revisa el código de publicación o avisa a quien administra el sitio.\n" +
          error.message,
        "err"
      );
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    session = null;
    content = null;
    contentSha = null;
    dashboard.classList.add("hidden");
    loginPanel.classList.remove("hidden");
    document.getElementById("github-token").value = "";
    document.getElementById("site-password").value = "";
    clearStatus(globalStatus);
  }

  async function addConvenio() {
    const file = document.getElementById("convenio-file").files[0];
    const titulo = document.getElementById("convenio-titulo").value.trim() || "Convenio";
    if (!file) {
      showStatus(globalStatus, "Elige la imagen del convenio.", "err");
      return;
    }

    setBusy(true);
    clearStatus(globalStatus);
    try {
      const ext = Git.extensionFromFile(file);
      const id = `convenio-${Git.slugify(titulo)}-${Date.now()}`;
      const relative = `assets/convenios/${id}.${ext}`;
      await uploadBinary(withRoot(relative), file, `Agregar convenio ${titulo}`);

      content.convenios = content.convenios || [];
      content.convenios.push({
        id,
        path: relative,
        alt: titulo,
        titulo,
      });

      await commitContent(`Agregar convenio ${titulo}`);
      document.getElementById("convenio-file").value = "";
      document.getElementById("convenio-titulo").value = "";
      renderConveniosAdmin();
      showStatus(
        globalStatus,
        "Convenio agregado. El sitio público puede tardar 1–2 minutos en actualizarse.",
        "ok"
      );
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function deleteConvenio(id) {
    const item = (content.convenios || []).find((c) => c.id === id);
    if (!item) return;
    if (!confirm(`¿Quitar el convenio "${item.titulo || id}"?`)) return;

    setBusy(true);
    clearStatus(globalStatus);
    try {
      await removeRepoFile(item.path);
      content.convenios = content.convenios.filter((c) => c.id !== id);
      await commitContent(`Quitar convenio ${item.titulo || id}`);
      renderConveniosAdmin();
      showStatus(globalStatus, "Convenio eliminado.", "ok");
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  function parseCoachingForm() {
    const nombre_piloto = document.getElementById("coaching-piloto").value.trim();
    const nombre_negocio = document.getElementById("coaching-negocio").value.trim();
    const actividad_economica = document.getElementById("coaching-actividad").value.trim();
    const celular = document.getElementById("coaching-celular").value.trim();
    const mailRaw = document.getElementById("coaching-mail").value.trim();
    const redes_sociales = document.getElementById("coaching-redes").value.trim() || null;
    const descuento = document.getElementById("coaching-descuento").value.trim() || null;

    return {
      nombre_piloto,
      nombre_negocio,
      actividad_economica,
      celular,
      mail: mailRaw || null,
      redes_sociales,
      descuento,
    };
  }

  function fillCoachingForm(item, index) {
    document.getElementById("coaching-edit-index").value = String(index);
    document.getElementById("coaching-piloto").value = item.nombre_piloto || "";
    document.getElementById("coaching-negocio").value = item.nombre_negocio || "";
    document.getElementById("coaching-actividad").value = item.actividad_economica || "";
    document.getElementById("coaching-celular").value = item.celular || "";
    document.getElementById("coaching-mail").value = item.mail || "";
    document.getElementById("coaching-redes").value = item.redes_sociales || "";
    document.getElementById("coaching-descuento").value = item.descuento || "";
    document.getElementById("btn-cancel-coaching").classList.remove("hidden");
    document.getElementById("btn-save-coaching").textContent = "Actualizar servicio";
    document.getElementById("coaching-piloto").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearCoachingForm() {
    document.getElementById("coaching-edit-index").value = "";
    document.getElementById("coaching-piloto").value = "";
    document.getElementById("coaching-negocio").value = "";
    document.getElementById("coaching-actividad").value = "";
    document.getElementById("coaching-celular").value = "";
    document.getElementById("coaching-mail").value = "";
    document.getElementById("coaching-redes").value = "";
    document.getElementById("coaching-descuento").value = "";
    document.getElementById("btn-cancel-coaching").classList.add("hidden");
    document.getElementById("btn-save-coaching").textContent = "Guardar servicio";
  }

  function renderCoachingAdmin() {
    const listEl = document.getElementById("coaching-list");
    const countEl = document.getElementById("coaching-count");
    if (!listEl) return;

    listEl.innerHTML = "";
    if (countEl) {
      countEl.textContent = coaching.length
        ? `${coaching.length} servicio${coaching.length === 1 ? "" : "s"} publicado${coaching.length === 1 ? "" : "s"}`
        : "";
    }

    if (!coaching.length) {
      listEl.innerHTML = `<p class="empty-note">No hay servicios todavía. Crea el primero abajo.</p>`;
      return;
    }

    coaching.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = "info-admin-card";

      const h4 = document.createElement("h4");
      h4.textContent = item.nombre_negocio || `Servicio ${index + 1}`;
      card.appendChild(h4);

      const pilot = document.createElement("p");
      pilot.textContent = item.nombre_piloto || "Sin piloto";
      card.appendChild(pilot);

      if (item.actividad_economica) {
        const activity = document.createElement("p");
        activity.textContent = item.actividad_economica;
        card.appendChild(activity);
      }

      if (item.celular) {
        const phone = document.createElement("p");
        phone.textContent = `Cel. ${item.celular}`;
        card.appendChild(phone);
      }

      if (item.descuento) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = `Dto: ${item.descuento}`;
        card.appendChild(badge);
      }

      const actions = document.createElement("div");
      actions.className = "actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-ghost";
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", () => fillCoachingForm(item, index));

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-danger";
      delBtn.textContent = "Quitar";
      delBtn.addEventListener("click", () => deleteCoachingItem(index));

      actions.append(editBtn, delBtn);
      card.appendChild(actions);
      listEl.appendChild(card);
    });
  }

  async function saveCoachingItem() {
    const item = parseCoachingForm();
    if (!item.nombre_piloto || !item.nombre_negocio) {
      showStatus(globalStatus, "Completa el nombre del piloto y del negocio.", "err");
      return;
    }
    if (!item.actividad_economica) {
      showStatus(globalStatus, "Describe la actividad económica.", "err");
      return;
    }
    if (!item.celular) {
      showStatus(globalStatus, "Agrega un celular de contacto.", "err");
      return;
    }

    setBusy(true);
    clearStatus(globalStatus);
    try {
      const editIndex = document.getElementById("coaching-edit-index").value;
      if (editIndex === "") {
        coaching.push(item);
        await commitCoaching(`Agregar servicio: ${item.nombre_negocio}`);
        showStatus(globalStatus, "Servicio agregado.", "ok");
      } else {
        const index = Number(editIndex);
        coaching[index] = item;
        await commitCoaching(`Actualizar servicio: ${item.nombre_negocio}`);
        showStatus(globalStatus, "Servicio actualizado.", "ok");
      }

      clearCoachingForm();
      renderCoachingAdmin();
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCoachingItem(index) {
    const item = coaching[index];
    if (!item) return;
    if (!confirm(`¿Quitar el servicio "${item.nombre_negocio || index}"?`)) return;

    setBusy(true);
    clearStatus(globalStatus);
    try {
      coaching.splice(index, 1);
      await commitCoaching(`Quitar servicio: ${item.nombre_negocio || index}`);
      if (document.getElementById("coaching-edit-index").value === String(index)) clearCoachingForm();
      renderCoachingAdmin();
      showStatus(globalStatus, "Servicio eliminado.", "ok");
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  function parseInfoForm() {
    const titulo = document.getElementById("info-titulo").value.trim();
    const texto = document.getElementById("info-texto").value.trim();
    const items = document
      .getElementById("info-items")
      .value.split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const links = document
      .getElementById("info-links")
      .value.split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("|").map((part) => part.trim());
        if (parts.length >= 2) {
          return { label: parts[0], url: parts.slice(1).join("|") };
        }
        return { label: parts[0], url: parts[0] };
      })
      .filter((link) => link.url);

    const wide = document.getElementById("info-wide").checked;
    const block = { titulo };
    if (texto) block.texto = texto;
    if (items.length) block.items = items;
    if (links.length) block.links = links;
    if (wide) block.wide = true;
    return block;
  }

  function fillInfoForm(block, index) {
    document.getElementById("info-edit-index").value = String(index);
    document.getElementById("info-titulo").value = block.titulo || "";
    document.getElementById("info-texto").value = block.texto || "";
    document.getElementById("info-items").value = (block.items || []).join("\n");
    document.getElementById("info-links").value = (block.links || [])
      .map((link) => `${link.label || link.url} | ${link.url}`)
      .join("\n");
    document.getElementById("info-wide").checked = Boolean(block.wide);
    document.getElementById("btn-cancel-info").classList.remove("hidden");
    document.getElementById("btn-save-info").textContent = "Actualizar bloque";
    document.getElementById("info-titulo").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearInfoForm() {
    document.getElementById("info-edit-index").value = "";
    document.getElementById("info-titulo").value = "";
    document.getElementById("info-texto").value = "";
    document.getElementById("info-items").value = "";
    document.getElementById("info-links").value = "";
    document.getElementById("info-wide").checked = false;
    document.getElementById("btn-cancel-info").classList.add("hidden");
    document.getElementById("btn-save-info").textContent = "Guardar bloque";
  }

  function renderInfoAdmin() {
    const listEl = document.getElementById("info-list");
    if (!listEl) return;

    const bloques = Array.isArray(content?.info?.bloques) ? content.info.bloques : [];
    listEl.innerHTML = "";

    if (!bloques.length) {
      listEl.innerHTML = `<p class="empty-note">No hay bloques todavía. Crea el primero abajo.</p>`;
      return;
    }

    bloques.forEach((block, index) => {
      const card = document.createElement("div");
      card.className = "info-admin-card";

      const h4 = document.createElement("h4");
      h4.textContent = block.titulo || `Bloque ${index + 1}`;
      card.appendChild(h4);

      if (block.wide) {
        const badge = document.createElement("span");
        badge.className = "badge";
        badge.textContent = "Ancho completo";
        card.appendChild(badge);
      }

      if (block.texto) {
        const p = document.createElement("p");
        p.textContent = block.texto;
        card.appendChild(p);
      }

      if (Array.isArray(block.items) && block.items.length) {
        const ul = document.createElement("ul");
        block.items.slice(0, 4).forEach((text) => {
          const li = document.createElement("li");
          li.textContent = text;
          ul.appendChild(li);
        });
        if (block.items.length > 4) {
          const li = document.createElement("li");
          li.textContent = `… y ${block.items.length - 4} más`;
          ul.appendChild(li);
        }
        card.appendChild(ul);
      }

      if (Array.isArray(block.links) && block.links.length) {
        const p = document.createElement("p");
        p.textContent = `${block.links.length} enlace(s)`;
        card.appendChild(p);
      }

      const actions = document.createElement("div");
      actions.className = "actions";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-ghost";
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", () => fillInfoForm(block, index));

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "btn btn-danger";
      delBtn.textContent = "Quitar";
      delBtn.addEventListener("click", () => deleteInfoBlock(index));

      actions.append(editBtn, delBtn);
      card.appendChild(actions);
      listEl.appendChild(card);
    });
  }

  async function saveInfoBlock() {
    const block = parseInfoForm();
    if (!block.titulo) {
      showStatus(globalStatus, "Escribe un título para el bloque.", "err");
      return;
    }
    if (!block.texto && !(block.items && block.items.length) && !(block.links && block.links.length)) {
      showStatus(globalStatus, "Agrega al menos un texto, una lista o un enlace.", "err");
      return;
    }

    setBusy(true);
    clearStatus(globalStatus);
    try {
      content.info = content.info || {
        titulo: "Información relevante",
        subtitulo: "Referencias útiles",
        bloques: [],
      };
      content.info.bloques = content.info.bloques || [];

      const editIndex = document.getElementById("info-edit-index").value;
      if (editIndex === "") {
        content.info.bloques.push(block);
        await commitContent(`Agregar info: ${block.titulo}`);
        showStatus(globalStatus, "Bloque agregado.", "ok");
      } else {
        const index = Number(editIndex);
        content.info.bloques[index] = block;
        await commitContent(`Actualizar info: ${block.titulo}`);
        showStatus(globalStatus, "Bloque actualizado.", "ok");
      }

      clearInfoForm();
      renderInfoAdmin();
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function deleteInfoBlock(index) {
    const block = content.info?.bloques?.[index];
    if (!block) return;
    if (!confirm(`¿Quitar el bloque "${block.titulo || index}"?`)) return;

    setBusy(true);
    clearStatus(globalStatus);
    try {
      content.info.bloques.splice(index, 1);
      await commitContent(`Quitar info: ${block.titulo || index}`);
      if (document.getElementById("info-edit-index").value === String(index)) clearInfoForm();
      renderInfoAdmin();
      showStatus(globalStatus, "Bloque eliminado.", "ok");
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  document.getElementById("btn-login").addEventListener("click", login);
  document.getElementById("btn-logout").addEventListener("click", logout);
  document.getElementById("btn-add-convenio").addEventListener("click", addConvenio);
  document.getElementById("btn-save-coaching").addEventListener("click", saveCoachingItem);
  document.getElementById("btn-cancel-coaching").addEventListener("click", clearCoachingForm);
  document.getElementById("btn-save-info").addEventListener("click", saveInfoBlock);
  document.getElementById("btn-cancel-info").addEventListener("click", clearInfoForm);
  document.getElementById("prog-add-file").addEventListener("change", (event) => {
    const files = event.target.files;
    event.target.value = "";
    if (files?.length) addProgramacionImages(files);
  });

  document.getElementById("prog-replace-all").addEventListener("change", (event) => {
    const files = event.target.files;
    event.target.value = "";
    if (files?.length) replaceAllProgramacion(files);
  });

  document.getElementById("btn-sync-prog").addEventListener("click", syncProgramacionFolder);
  document.getElementById("btn-clear-prog").addEventListener("click", clearAllProgramacion);
  document.getElementById("btn-save-periodo").addEventListener("click", saveProgramacionPeriodo);

  document.getElementById("site-password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });
  document.getElementById("github-token").addEventListener("keydown", (e) => {
    if (e.key === "Enter") login();
  });

  (async () => {
    try {
      await loadLocalConfig();
      const saved = loadSession();
      if (saved?.token && config.repoOwner && config.repoName) {
        session = {
          owner: config.repoOwner,
          repo: config.repoName,
          branch: config.branch || "main",
          siteRoot: config.siteRoot || "",
          token: saved.token,
        };
        setBusy(true);
        await fetchContent();
        loginPanel.classList.add("hidden");
        dashboard.classList.remove("hidden");
        showStatus(globalStatus, "Sesión restaurada.", "ok");
      }
    } catch (error) {
      showStatus(loginStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  })();
})();
