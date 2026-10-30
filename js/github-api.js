window.VagamundosGit = (() => {
  const API = "https://api.github.com";

  function headers(token) {
    return {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  function encodePath(path) {
    return path
      .split("/")
      .map((part) => encodeURIComponent(part))
      .join("/");
  }

  async function getFile({ owner, repo, path, branch, token }) {
    const url = `${API}/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(branch)}`;
    const response = await fetch(url, { headers: headers(token) });
    if (response.status === 404) return null;
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`GitHub GET ${path}: ${response.status} ${detail}`);
    }
    return response.json();
  }

  async function putFile({ owner, repo, path, branch, token, contentBase64, message, sha }) {
    const url = `${API}/repos/${owner}/${repo}/contents/${encodePath(path)}`;
    const body = {
      message,
      content: contentBase64,
      branch,
    };
    if (sha) body.sha = sha;

    const response = await fetch(url, {
      method: "PUT",
      headers: headers(token),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`GitHub PUT ${path}: ${response.status} ${detail}`);
    }
    return response.json();
  }

  async function deleteFile({ owner, repo, path, branch, token, sha, message }) {
    const url = `${API}/repos/${owner}/${repo}/contents/${encodePath(path)}`;
    const response = await fetch(url, {
      method: "DELETE",
      headers: headers(token),
      body: JSON.stringify({ message, sha, branch }),
    });

    // Ya no existe: no es error para el flujo de publicación
    if (response.status === 404) return null;

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`GitHub DELETE ${path}: ${response.status} ${detail}`);
    }
    return response.json();
  }

  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      const slice = bytes.subarray(i, i + chunk);
      binary += String.fromCharCode.apply(null, slice);
    }
    return btoa(binary);
  }

  async function fileToBase64(file) {
    const buffer = await file.arrayBuffer();
    return arrayBufferToBase64(buffer);
  }

  function textToBase64(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  function decodeBase64Utf8(content) {
    return decodeURIComponent(escape(atob(content.replace(/\n/g, ""))));
  }

  function extensionFromFile(file) {
    const name = file.name || "";
    const match = name.match(/\.([a-z0-9]+)$/i);
    if (match) return match[1].toLowerCase();
    if (file.type === "image/png") return "png";
    if (file.type === "image/webp") return "webp";
    if (file.type === "image/gif") return "gif";
    return "jpeg";
  }

  function slugify(value) {
    return String(value || "archivo")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48);
  }

  return {
    getFile,
    putFile,
    deleteFile,
    fileToBase64,
    textToBase64,
    decodeBase64Utf8,
    extensionFromFile,
    slugify,
  };
})();
