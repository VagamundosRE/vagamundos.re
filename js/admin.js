(() => {
  const Git = window.VagamundosGit;
  const STORAGE_KEY = "vagamundos-admin-session";

  const loginPanel = document.getElementById("login-panel");
  const dashboard = document.getElementById("dashboard");
  const loginStatus = document.getElementById("login-status");
  const globalStatus = document.getElementById("global-status");
  const sessionInfo = document.getElementById("session-info");
  const progPreview = document.getElementById("prog-preview");
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
    document.querySelectorAll(".btn").forEach((btn) => {
      btn.disabled = busy;
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
    showCurrentProgramacion();
    renderConveniosAdmin();
    sessionInfo.textContent = "Conectado · puedes publicar cambios";
  }

  function showCurrentProgramacion() {
    progPreview.innerHTML = "";
    const images = content.programacion?.images || [];
    if (!images.length) {
      progPreview.innerHTML = `<p class="empty-note">Todavía no hay programación publicada.</p>`;
      return;
    }
    images.forEach((img) => {
      const el = document.createElement("img");
      el.src = img.path;
      el.alt = img.alt || "Programación actual";
      progPreview.appendChild(el);
    });
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
      img.src = item.path;
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
      // Si ya no está, seguimos; no bloquea la publicación
      if (!String(error.message).includes("404")) throw error;
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

  async function publishProgramacion() {
    const files = [...document.getElementById("prog-files").files];
    if (!files.length) {
      showStatus(globalStatus, "Elige 1 o 2 imágenes de la nueva programación.", "err");
      return;
    }
    if (files.length > 2) {
      showStatus(globalStatus, "Solo se permiten máximo 2 imágenes.", "err");
      return;
    }

    setBusy(true);
    clearStatus(globalStatus);
    showStatus(globalStatus, "Subiendo programación…", "ok");

    try {
      const oldImages = [...(content.programacion?.images || [])];
      const published = [];

      // Nombres fijos: se reemplazan en el mismo archivo (evita errores al borrar)
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const ext = Git.extensionFromFile(file);
        const relative = `assets/programacion/programa-${i + 1}.${ext}`;
        await uploadBinary(withRoot(relative), file, `Actualizar programación ${i + 1}`);
        published.push({
          path: relative,
          alt: `Programación de rodadas ${i + 1}`,
        });
      }

      // Limpia rutas viejas distintas a las nuevas (si existen)
      const keep = new Set(published.map((img) => img.path));
      for (const old of oldImages) {
        if (!old?.path || keep.has(old.path)) continue;
        await removeRepoFile(old.path);
      }

      // Si ahora hay 1 imagen y antes había programa-2.*, quitarla
      if (files.length === 1) {
        for (const orphan of [
          "assets/programacion/programa-2.jpeg",
          "assets/programacion/programa-2.jpg",
          "assets/programacion/programa-2.png",
          "assets/programacion/programa-2.webp",
        ]) {
          if (!keep.has(orphan)) await removeRepoFile(orphan);
        }
      }

      content.programacion = {
        ...content.programacion,
        titulo: content.programacion?.titulo || "Programación de rodadas",
        subtitulo: content.programacion?.subtitulo || "Calendario trimestral del grupo",
        images: published,
        updatedAt: new Date().toISOString().slice(0, 10),
      };

      await commitContent("Actualizar programación de rodadas");
      document.getElementById("prog-files").value = "";
      showCurrentProgramacion();
      showStatus(globalStatus, "Programación guardada. En 1–2 minutos se verá en la web.", "ok");
    } catch (error) {
      showStatus(globalStatus, error.message, "err");
    } finally {
      setBusy(false);
    }
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
      showStatus(globalStatus, "Convenio agregado. En 1–2 minutos se verá en la web.", "ok");
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
  document.getElementById("btn-save-prog").addEventListener("click", publishProgramacion);
  document.getElementById("btn-add-convenio").addEventListener("click", addConvenio);

  document.getElementById("prog-files").addEventListener("change", (event) => {
    const files = [...event.target.files].slice(0, 2);
    progPreview.innerHTML = "";
    files.forEach((file) => {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.alt = file.name;
      progPreview.appendChild(img);
    });
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
