/* ArtiVerse – vanilla JavaScript interactions (no libraries). */
(function () {
  "use strict";
  document.documentElement.classList.add("js");
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const csrf = () => ($('meta[name="csrf"]') || {}).content || "";
  const inr = (n) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  /* ---------- toasts ---------- */
  function toast(msg, type = "success") {
    let box = $(".messages");
    if (!box) { box = document.createElement("div"); box.className = "messages"; document.body.appendChild(box); }
    const t = document.createElement("div");
    t.className = "toast " + type;
    t.setAttribute("role", "status");
    t.innerHTML = '<span></span><button aria-label="Close">×</button>';
    t.firstChild.textContent = msg;
    box.appendChild(t);
    const kill = () => { t.classList.add("hide"); setTimeout(() => t.remove(), 300); };
    t.querySelector("button").onclick = kill;
    setTimeout(kill, 4200);
  }
  window.toast = toast;
  $$(".messages .toast").forEach((t) => {
    t.querySelector("button").onclick = () => t.remove();
    setTimeout(() => { t.classList.add("hide"); setTimeout(() => t.remove(), 300); }, 4800);
  });

  /* ---------- AJAX helper ---------- */
  async function post(url, data) {
    const body = data instanceof FormData ? data : new URLSearchParams(data || {});
    const res = await fetch(url, { method: "POST", body, credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest", "X-CSRFToken": csrf() } });
    let json = {};
    try { json = await res.json(); } catch (e) { json = { ok: false, message: "Something went wrong. Please try again." }; }
    if (res.status === 401 && json.login) { location.href = json.login; return null; }
    return json;
  }

  function setCartCount(n) {
    const b = $("#cart-badge"); if (!b) return;
    b.textContent = n; b.hidden = !n; b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
  }

  /* ---------- mobile menu + search toggle ---------- */
  const menu = $("#nav-links"), menuBtn = $("#menu-toggle");
  const setMenu = (open) => {
    menu.classList.toggle("open", open); document.body.classList.toggle("no-scroll", open);
    menuBtn.setAttribute("aria-expanded", open); menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  };
  if (menu && menuBtn) {
    menuBtn.onclick = () => setMenu(!menu.classList.contains("open"));
    document.addEventListener("click", (e) => { if (menu.classList.contains("open") && !menu.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  }
  const searchRow = $("#search-row"), searchBtn = $("#search-toggle");
  if (searchRow && searchBtn) {
    searchBtn.onclick = () => {
      const open = searchRow.classList.toggle("open");
      searchBtn.setAttribute("aria-expanded", open);
      if (open) $("#search-input").focus();
    };
    if ($("#search-input").value) searchRow.classList.add("open");
  }

  /* ---------- drop-down menu: caret buttons (mobile drawer + touch + keyboard) ---------- */
  $$(".has-mega").forEach((item) => {
    const caret = $(".nav-caret", item);
    if (!caret) return;
    caret.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = !item.classList.contains("open");
      $$(".has-mega.open").forEach((x) => { if (x !== item) { x.classList.remove("open"); $(".nav-caret", x).setAttribute("aria-expanded", "false"); } });
      item.classList.toggle("open", open); caret.setAttribute("aria-expanded", open);
    });
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".has-mega")) $$(".has-mega.open").forEach((x) => x.classList.remove("open")); });

  /* ---------- announcement bar (gentle rotation, off for reduced motion) ---------- */
  const msgs = $$(".announce-msg");
  if (msgs.length > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    let m = 0;
    setInterval(() => { msgs[m].classList.remove("is-on"); m = (m + 1) % msgs.length; msgs[m].classList.add("is-on"); }, 4000);
  }

  /* ---------- broken image fallback ---------- */
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img.tagName === "IMG" && !img.dataset.failed) { img.dataset.failed = "1"; img.src = "/static/img/placeholder.svg"; }
  }, true);

  /* ---------- live search suggestions ---------- */
  const sInput = $("#search-input"), sBox = $("#suggest");
  if (sInput && sBox) {
    let timer, idx = -1;
    const close = () => { sBox.classList.remove("open"); idx = -1; };
    sInput.addEventListener("input", () => {
      clearTimeout(timer);
      const q = sInput.value.trim();
      if (q.length < 2) return close();
      timer = setTimeout(async () => {
        const r = await fetch(sInput.dataset.url + "?q=" + encodeURIComponent(q));
        const d = await r.json();
        sBox.innerHTML = d.results.length
          ? d.results.map((p) => `<a href="${p.url}"><img src="${p.image}" alt=""><span><b>${p.name.replace(/</g, "&lt;")}</b><small>${p.category} · ${inr(p.price)}</small></span></a>`).join("")
          : '<div class="none">No matches – try “saree”, “necklace” or “heels”.</div>';
        sBox.classList.add("open"); idx = -1;
      }, 200);
    });
    sInput.addEventListener("keydown", (e) => {
      const items = $$("a", sBox);
      if (!items.length || !sBox.classList.contains("open")) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
        items.forEach((a, i) => a.classList.toggle("active", i === idx));
      } else if (e.key === "Enter" && idx >= 0) { e.preventDefault(); location.href = items[idx].href; }
      else if (e.key === "Escape") close();
    });
    document.addEventListener("click", (e) => { if (!sBox.contains(e.target) && e.target !== sInput) close(); });
  }

  /* ---------- homepage category buttons (filter the product shelf) ---------- */
  const shelf = $("#shelf");
  if (shelf) {
    const pills = $$(".pill[data-filter]");
    pills.forEach((p) => p.addEventListener("click", (e) => {
      e.preventDefault();
      const f = p.dataset.filter;
      pills.forEach((x) => x.classList.toggle("on", x === p));
      $$(".card", shelf).forEach((c) => { c.hidden = f !== "all" && c.dataset.group !== f && c.dataset.family !== f; });
      const more = $("#shelf-more"); if (more) more.href = p.href;
    }));
  }

  /* ---------- add to cart (AJAX) ---------- */
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest(".js-add-cart");
    if (!f) return;
    e.preventDefault();
    const btn = f.querySelector('button[type="submit"]');
    if (f.dataset.needsSize && !f.querySelector('input[name="size"]:checked')) {
      toast("Please select a size first.", "error");
      const sz = $(".sizes"); if (sz) { sz.scrollIntoView({ behavior: "smooth", block: "center" }); sz.animate([{ transform: "translateX(-6px)" }, { transform: "translateX(6px)" }, { transform: "none" }], { duration: 300, iterations: 2 }); }
      return;
    }
    const old = btn.textContent; btn.classList.add("loading"); btn.textContent = "Adding…";
    const d = await post(f.action, new FormData(f));
    btn.classList.remove("loading");
    if (!d) return;
    if (d.ok) { toast(d.message); setCartCount(d.cart_count); btn.textContent = "Added ✓"; setTimeout(() => (btn.textContent = old), 1400); }
    else { toast(d.message, "error"); btn.textContent = old; }
  });

  /* ---------- wishlist hearts ---------- */
  document.addEventListener("click", async (e) => {
    const b = e.target.closest(".wish");
    if (!b) return;
    e.preventDefault();
    const d = await post(b.dataset.url);
    if (!d) return;
    $$(`.wish[data-url="${b.dataset.url}"]`).forEach((x) => x.classList.toggle("on", d.added));
    toast(d.message, d.added ? "success" : "info");
    const wb = $("#wish-badge"); if (wb) { wb.textContent = d.count; wb.hidden = !d.count; }
    const card = b.closest("[data-wish-card]");
    if (card && !d.added) { card.style.transition = ".3s"; card.style.opacity = 0; card.style.transform = "scale(.9)"; setTimeout(() => { card.remove(); if (!$("[data-wish-card]")) location.reload(); }, 300); }
  });

  /* ---------- quantity steppers (product page) ---------- */
  $$(".qty[data-stepper]").forEach((q) => {
    const input = $("input", q), max = +input.max || 10;
    const set = (v) => { input.value = Math.min(Math.max(v, 1), max); };
    $$("button", q)[0].onclick = () => set(+input.value - 1);
    $$("button", q)[1].onclick = () => { if (+input.value >= max) toast("Only " + max + " available in stock.", "info"); set(+input.value + 1); };
    input.onchange = () => set(+input.value || 1);
  });

  /* ---------- image zoom ---------- */
  const z = $(".zoom");
  if (z) {
    const img = $("img", z);
    z.addEventListener("mousemove", (e) => { const r = z.getBoundingClientRect(); z.classList.add("zooming"); img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`; });
    z.addEventListener("mouseleave", () => z.classList.remove("zooming"));
  }

  /* ---------- cart page ---------- */
  const cartBox = $("#cart-items");
  if (cartBox) {
    const sum = (id, v) => { const el = $(id); if (el) el.textContent = v; };
    function refresh(d) {
      sum("#sum-subtotal", inr(d.subtotal));
      sum("#sum-shipping", +d.shipping ? inr(d.shipping) : "FREE");
      sum("#sum-total", inr(d.total));
      const left = +d.free_left, bar = $("#free-bar"), note = $("#free-note");
      if (bar) { const goal = +bar.dataset.goal; bar.style.width = Math.min(100, ((goal - left) / goal) * 100) + "%"; }
      if (note) note.textContent = left > 0 ? `Add ${inr(left)} more for FREE shipping!` : "You've unlocked FREE shipping!";
      if (d.empty) location.reload();
    }
    cartBox.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const row = btn.closest(".cart-item");
      const act = btn.dataset.act;
      if (act === "remove") {
        row.classList.add("removing");
        const d = await post(row.dataset.remove);
        if (d && d.ok) { setTimeout(() => row.remove(), 300); toast(d.message, "info"); setCartCount(d.cart_count); refresh(d); } else row.classList.remove("removing");
        return;
      }
      btn.disabled = true;
      const d = await post(row.dataset.update, { action: act });
      btn.disabled = false;
      if (!d) return;
      if (!d.ok) toast(d.message, "error");
      else if (d.empty !== undefined) {
        setCartCount(d.cart_count);
        if (d.quantity === undefined) { row.remove(); } else { $(".qty-val", row).textContent = d.quantity; $(".item-sub", row).textContent = inr(d.item_subtotal); }
      }
      if (d.subtotal !== undefined) refresh(d);
    });
  }

  /* ---------- filters drawer ---------- */
  const fp = $("#filters"), ft = $("#filter-toggle");
  if (fp && ft) {
    ft.onclick = () => fp.classList.add("open");
    $("#filter-close").onclick = () => fp.classList.remove("open");
    fp.addEventListener("click", (e) => { if (e.target === fp) fp.classList.remove("open"); });
  }
  $$("[data-autosubmit]").forEach((el) => el.addEventListener("change", () => el.form.submit()));

  /* ---------- forms: password toggle, strength, double-submit ---------- */
  $$(".pw-wrap").forEach((w) => {
    const input = $("input", w), b = document.createElement("button");
    b.type = "button"; b.textContent = "👁"; b.setAttribute("aria-label", "Show password");
    b.onclick = () => { input.type = input.type === "password" ? "text" : "password"; };
    w.appendChild(b);
  });
  const strengthIn = $("#id_password[data-strength]"), bar = $("#strength i");
  if (strengthIn && bar) strengthIn.addEventListener("input", () => {
    const v = strengthIn.value; let s = 0;
    if (v.length >= 6) s++; if (v.length >= 10) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) s++;
    bar.style.width = (s / 4) * 100 + "%"; bar.style.background = ["#c0392b", "#c0392b", "#e2a21b", "#8cbf3f", "#1d8a5a"][s];
  });
  $$("form[data-once]").forEach((f) => f.addEventListener("submit", () => {
    const b = $('button[type="submit"]', f);
    setTimeout(() => { if (b) { b.disabled = true; b.textContent = "Please wait…"; } }, 0);
  }));

  /* ---------- checkout payment note ---------- */
  const demo = $("#demo-note");
  $$('input[name="payment_method"]').forEach((r) => r.addEventListener("change", () => { if (demo) demo.style.display = r.value === "demo" && r.checked ? "block" : "none"; }));
  const checked = $('input[name="payment_method"]:checked'); if (checked && demo) demo.style.display = checked.value === "demo" ? "block" : "none";

  /* ---------- reveal on scroll + back to top ---------- */
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((ents) => ents.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }), { threshold: .12 });
    $$(".reveal").forEach((el) => io.observe(el));
  } else $$(".reveal").forEach((el) => el.classList.add("in"));
  const top = $("#to-top");
  if (top) { addEventListener("scroll", () => top.classList.toggle("show", scrollY > 500), { passive: true }); top.onclick = () => scrollTo({ top: 0, behavior: "smooth" }); }
})();
