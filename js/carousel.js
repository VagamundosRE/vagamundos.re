window.VagamundosCarousel = (() => {
  function create({ root, items, renderSlide, onSlideClick }) {
    root.innerHTML = "";
    root.classList.add("carrete");

    if (!items.length) {
      root.innerHTML = `<div class="empty-state">Sin contenido.</div>`;
      return { destroy() {} };
    }

    const viewport = document.createElement("div");
    viewport.className = "carrete-viewport";
    viewport.setAttribute("tabindex", "0");

    const track = document.createElement("div");
    track.className = "carrete-track";

    items.forEach((item, index) => {
      const slide = document.createElement("div");
      slide.className = "carrete-slide";
      slide.dataset.index = String(index);
      const content = renderSlide(item, index);
      if (typeof content === "string") slide.innerHTML = content;
      else if (content) slide.appendChild(content);
      if (onSlideClick) {
        slide.style.cursor = "zoom-in";
        slide.addEventListener("click", (event) => {
          if (event.target.closest("button, a, label, input")) return;
          onSlideClick(item, index);
        });
      }
      track.appendChild(slide);
    });

    viewport.appendChild(track);
    root.appendChild(viewport);

    let index = 0;
    let startX = 0;
    let deltaX = 0;
    let dragging = false;

    const dots = document.createElement("div");
    dots.className = "carrete-dots";

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "carrete-nav carrete-prev";
    prevBtn.setAttribute("aria-label", "Anterior");
    prevBtn.innerHTML = "‹";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "carrete-nav carrete-next";
    nextBtn.setAttribute("aria-label", "Siguiente");
    nextBtn.innerHTML = "›";

    function goTo(nextIndex, animate = true) {
      index = (nextIndex + items.length) % items.length;
      track.style.transition = animate ? "transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)" : "none";
      track.style.transform = `translateX(-${index * 100}%)`;
      [...dots.children].forEach((dot, i) => {
        dot.classList.toggle("is-active", i === index);
        dot.setAttribute("aria-current", i === index ? "true" : "false");
      });
      prevBtn.hidden = items.length < 2;
      nextBtn.hidden = items.length < 2;
      dots.hidden = items.length < 2;
    }

    if (items.length > 1) {
      items.forEach((_, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "carrete-dot";
        dot.setAttribute("aria-label", `Ir a imagen ${i + 1}`);
        dot.addEventListener("click", () => goTo(i));
        dots.appendChild(dot);
      });

      prevBtn.addEventListener("click", () => goTo(index - 1));
      nextBtn.addEventListener("click", () => goTo(index + 1));
      root.append(prevBtn, nextBtn, dots);
    }

    viewport.addEventListener(
      "pointerdown",
      (event) => {
        if (items.length < 2) return;
        dragging = true;
        startX = event.clientX;
        deltaX = 0;
        track.style.transition = "none";
        viewport.setPointerCapture(event.pointerId);
      },
      { passive: true }
    );

    viewport.addEventListener(
      "pointermove",
      (event) => {
        if (!dragging) return;
        deltaX = event.clientX - startX;
        const percent = (deltaX / viewport.offsetWidth) * 100;
        track.style.transform = `translateX(calc(-${index * 100}% + ${percent}%))`;
      },
      { passive: true }
    );

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      if (Math.abs(deltaX) > viewport.offsetWidth * 0.18) {
        goTo(deltaX < 0 ? index + 1 : index - 1);
      } else {
        goTo(index);
      }
      deltaX = 0;
    }

    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    viewport.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") goTo(index - 1);
      if (event.key === "ArrowRight") goTo(index + 1);
    });

    goTo(0, false);

    return {
      goTo,
      destroy() {
        root.innerHTML = "";
      },
    };
  }

  return { create };
})();
