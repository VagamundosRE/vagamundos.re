(() => {
  const Git = window.VagamundosGit;
  const STORAGE_KEY = "vagamundos-admin-session";
  const MAX_PROG = 2;

  const loginPanel = document.getElementById("login-panel");
  const dashboard = document.getElementById("dashboard");
  const loginStatus = document.getElementById("login-status");
  const globalStatus = document.getElementById("global-status");
  const sessionInfo = document.getElementById("session-info");
  const progSlots = document.getElementById("prog-slots");
  const progAddWrap = document.getElementById("prog-add-wrap");
  const conveniosList = document.getElementById("convenios-list");

  let config = null;
  let session = null;
  let content = null;
  let contentSha = null;

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
    if (!Array.isArray(content.programacion?.images)) {
      content.programacion = content.programacion || {};
      content.programacion.images = [];
    }
    renderProgramacionAdmin();
    renderConveniosAdmin();
    sessionInfo.textContent = "Conectado · puedes publicar cambios";
  }

  function rawAssetUrl(path) {
    const root = (session.siteRoot || "").replace(/^\/+|\/+$/g, "");
    const fullPath = root ? `${root}/${path}` : path;
    return `https://raw.githubusercontent.com/${session.owner}/${session.repo}/${encodeURIComponent(
      session.branch
    )}/${fullPath}?t=${Date.now()}`;
  }

  function renderProgramacionAdmin() {
    const images = content.programacion?.images || [];
    progSlots.innerHTML = "";

    if (!images.length) {
      progSlots.innerHTML = `<p class="empty-note">Todavía no hay programación. Usa “Agregar imagen”.</p>`;
    }

    images.forEach((item, index) => {
      const wrap = document.createElement("div");
      wrap.className = "prog-slot";

      const title = document.createElement("div");
      title.className = "prog-slot-title";
      title.textContent = `Imagen ${index + 1}`;

      const img = document.createElement("img");
      img.src = rawAssetUrl(item.path);
      img.alt = item.alt || `Programación ${index + 1}`;

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
      wrap.append(title, img, actions);
      progSlots.appendChild(wrap);
    });

    progAddWrap.classList.toggle("hidden", images.length >= MAX_PROG);
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

  function touchProgramacionMeta() {
    content.programacion = {
      ...content.programacion,
      titulo: content.programacion?.titulo || "Programación de rodadas",
      subtitulo: content.programacion?.subtitulo || "Calendario trimestral del grupo",
      images: content.programacion?.images || [],
      updatedAt: new Date().toISOString().slice(0, 10),
    };
  }

  async function addProgramacionImage(file) {
    const images = content.programacion?.images || [];
    if (images.length >= MAX_PROG) {
      showStatus(globalStatus, "Ya hay 2 imágenes. Quita una o cámbiala.", "err");
      return;
    }

    setBusy(true);
    clearStatus(globalStatus);
    showStatus(globalStatus, "Agregando imagen…", "ok");

    try {
      const ext = Git.extensionFromFile(file);
      const relative = `assets/programacion/programa-${Date.now()}.${ext}`;
      await uploadBinary(withRoot(relative), file, "Agregar imagen de programación");

      images.push({
        path: relative,
        alt: `Programación de rodadas ${images.length + 1}`,
      });
      content.programacion.images = images;
      touchProgramacionMeta();
      await commitContent("Agregar imagen de programación");
      renderProgramacionAdmin();
      showStatus(
        globalStatus,
        "Imagen agregada. La otra (si había) se mantuvo. El sitio puede tardar 1–2 min.",
        "ok"
      );
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function replaceProgramacionImage(index, file) {
    const images = content.programacion?.images || [];
    const current = images[index];
    if (!current) return;

    setBusy(true);
    clearStatus(globalStatus);
    showStatus(globalStatus, `Cambiando imagen ${index + 1}…`, "ok");

    try {
      const ext = Git.extensionFromFile(file);
      const relative = `assets/programacion/programa-${Date.now()}.${ext}`;
      await uploadBinary(withRoot(relative), file, `Cambiar programación ${index + 1}`);

      const oldPath = current.path;
      images[index] = {
        path: relative,
        alt: `Programación de rodadas ${index + 1}`,
      };
      content.programacion.images = images;
      touchProgramacionMeta();

      if (oldPath && oldPath !== relative) await removeRepoFile(oldPath);

      await commitContent(`Cambiar imagen de programación ${index + 1}`);
      renderProgramacionAdmin();
      showStatus(
        globalStatus,
        `Imagen ${index + 1} actualizada. Las demás no se tocaron.`,
        "ok"
      );
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProgramacionImage(index) {
    const images = content.programacion?.images || [];
    const current = images[index];
    if (!current) return;
    if (!confirm(`¿Quitar la imagen ${index + 1} de la programación?`)) return;

    setBusy(true);
    clearStatus(globalStatus);
    showStatus(globalStatus, "Quitando imagen…", "ok");

    try {
      await removeRepoFile(current.path);
      images.splice(index, 1);
      images.forEach((img, i) => {
        img.alt = `Programación de rodadas ${i + 1}`;
      });
      content.programacion.images = images;
      touchProgramacionMeta();
      await commitContent(`Quitar imagen de programación ${index + 1}`);
      renderProgramacionAdmin();
      showStatus(globalStatus, "Imagen eliminada.", "ok");
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

  document.getElementById("btn-login").addEventListener("click", login);
  document.getElementById("btn-logout").addEventListener("click", logout);
  document.getElementById("btn-add-convenio").addEventListener("click", addConvenio);
  document.getElementById("prog-add-file").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) addProgramacionImage(file);
  });

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
