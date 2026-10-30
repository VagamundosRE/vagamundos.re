# Vagamundos — sitio web

Sitio estático del grupo **Vagamundos Himalayan · Royal Enfield · Cali**, listo para publicar en **GitHub Pages**.

## Qué incluye

- **Inicio** con video/logo de marca
- **Programación** de rodadas (1–2 imágenes trimestrales)
- **Convenios** (galería acumulativa)
- **Información relevante** (SOAT, taller, referencias Himalayan)
- **Panel admin** (`admin.html`) que sube archivos al repo vía GitHub API

Colores y tipografía tomados del manual de marca:

| Token | Hex |
| --- | --- |
| Naranja | `#E8541A` |
| Naranja claro | `#FD9B3A` |
| Dorado | `#F5B52E` |
| Ámbar | `#E78024` |
| Rojo oscuro | `#A22000` |
| Café | `#3B2415` |
| Negro | `#0A0A0A` |
| Papel | `#F9F9F9` |
| Tipografía | Montserrat |

## Vista local

Desde la carpeta `Pagina`:

```bash
# Python
python -m http.server 5500

# o con Node
npx --yes serve .
```

Abre `http://localhost:5500`.

> El admin necesita hablar con la API de GitHub; en local puedes ver el sitio público, pero para publicar imágenes usa el sitio ya desplegado (o local con la config del repo real).

## Publicar en GitHub Pages

### Opción A — el sitio en la raíz del repo

1. Crea un repo (ej. `vagamundos`).
2. Sube **el contenido de** `Pagina/` a la raíz del repo (`index.html`, `admin.html`, `assets/`, `css/`, `js/`, `data/`, `.nojekyll`).
3. En GitHub: **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**.
4. En el panel admin deja **Carpeta del sitio** vacía.

### Opción B — publicar la carpeta `Pagina`

1. Sube todo el proyecto (incluyendo `Multimedia/` y `Pagina/`).
2. En Pages elige la carpeta `/Pagina` si está disponible, **o** configura Actions / mueve el contenido.
3. En el admin, pon `Pagina` en **Carpeta del sitio en el repo**.

## Panel de publicación (simple)

URL: `https://TU-USUARIO.github.io/TU-REPO/admin.html`

Pensado para quien arma la programación del grupo: solo ve **contraseña**, **código** y dos acciones (programación / convenios).

### Lo configuras tú una vez

1. En `data/admin-config.json` completa:
   - `repoOwner` — tu usuario de GitHub
   - `repoName` — nombre del repo
   - `branch` — normalmente `main`
   - `siteRoot` — vacío si el sitio está en la raíz; `Pagina` si aplica
2. Crea un [token fine-grained](https://github.com/settings/tokens?type=beta) solo para ese repo, permiso **Contents: Read and write**.
3. Comparte en privado a la persona del grupo:
   - Contraseña del sitio (por defecto `vagamundos`)
   - El token, diciéndole que es el **código de publicación**

### Lo que hace la persona del grupo

1. Entra a `admin.html`
2. Escribe contraseña + código
3. **Programación:** sube 1–2 fotos → reemplazan las viejas
4. **Convenios:** sube una imagen nueva (las anteriores se quedan); puede quitar una si quiere

La info relevante del sitio se sigue editando en `data/content.json` (tú). No hace falta que esa persona toque el repo.

## Archivos clave

- `data/content.json` — programación, convenios e info
- `data/admin-config.json` — hash de contraseña y datos del repo
- `assets/programacion/` — posters trimestrales
- `assets/convenios/` — flyers de convenios
- `assets/logos/` — logos del manual / isologo hexagonal
- `assets/media/hero.mp4` — video de portada (~9 MB)

## Nota sobre el video

Si quieres un Pages más liviano, puedes borrar `assets/media/hero.mp4`; la portada seguirá mostrando el poster del isologo.
