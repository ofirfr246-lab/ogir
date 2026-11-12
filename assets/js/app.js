/* Norway Kitchen — site logic (vanilla JS) */
(function () {
  "use strict";
  var P = window.NK_PRODUCTS || [], C = window.NK_CATEGORIES || [];
  var FREE_SHIP = 75, SHIP_FEE = 7.99, KEY = "nk_cart_us_v1";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ils = function (n) { n = Number(n); var whole = Math.abs(n % 1) < 0.005; return "$" + n.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 }); };
  var byId = function (id) { return P.find(function (p) { return p.id === id; }); };
  var catName = function (id) { var c = C.find(function (x) { return x.id === id; }); return c ? c.name : ""; };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (m) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]; }); };
  var ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  };

  /* ---------- Cart store ---------- */
  var Cart = {
    get: function () { try { var c = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(c) ? c.filter(function (i) { return byId(i.id); }) : []; } catch (e) { return []; } },
    set: function (items) { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} render(); },
    add: function (id, qty, color) {
      var items = Cart.get(), key = id + "|" + (color || "");
      var ex = items.find(function (i) { return i.key === key; });
      if (ex) ex.qty = Math.min(99, ex.qty + qty); else items.push({ key: key, id: id, qty: qty, color: color || "" });
      Cart.set(items);
    },
    update: function (key, qty) { var items = Cart.get(); items.forEach(function (i) { if (i.key === key) i.qty = Math.max(1, Math.min(99, qty)); }); Cart.set(items); },
    remove: function (key) { Cart.set(Cart.get().filter(function (i) { return i.key !== key; })); },
    clear: function () { Cart.set([]); },
    count: function () { return Cart.get().reduce(function (s, i) { return s + i.qty; }, 0); },
    subtotal: function () { return Cart.get().reduce(function (s, i) { return s + byId(i.id).price * i.qty; }, 0); }
  };
  var coupon = (function () { try { return sessionStorage.getItem("nk_coupon") || ""; } catch (e) { return ""; } })();
  function totals() {
    var sub = Cart.subtotal(), disc = coupon === "NORDIC10" ? Math.round(sub * 10) / 100 : 0;
    var ship = sub === 0 || sub - disc >= FREE_SHIP ? 0 : SHIP_FEE;
    return { sub: sub, disc: disc, ship: ship, total: Math.round((sub - disc + ship) * 100) / 100 };
  }

  /* ---------- Toast ---------- */
  function toast(msg) {
    var w = $(".toast-wrap"); if (!w) return;
    var t = document.createElement("div"); t.className = "toast"; t.innerHTML = ICON.check + "<span>" + esc(msg) + "</span>";
    w.appendChild(t); setTimeout(function () { t.style.transition = "opacity .4s"; t.style.opacity = "0"; setTimeout(function () { t.remove(); }, 400); }, 2400);
  }

  /* ---------- Shared render ---------- */
  function shipProgress(sub) {
    var left = Math.max(0, FREE_SHIP - sub), pct = Math.min(100, (sub / FREE_SHIP) * 100);
    var txt = left > 0 ? "You're <b>" + ils(Math.round(left * 100) / 100) + "</b> away from free shipping" : "<b>Complimentary shipping</b> unlocked";
    return '<div class="ship-progress" aria-live="polite">' + txt + '<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + Math.round(pct) + '" aria-label="Progress to free shipping"><i style="width:' + pct + '%"></i></div></div>';
  }
  function lineItem(i, big) {
    var p = byId(i.id);
    return '<div class="line-item" data-key="' + esc(i.key) + '">' +
      '<a href="product.html?id=' + p.id + '"><img src="' + p.image + '" alt="' + esc(p.name) + '" loading="lazy" width="110" height="130"></a>' +
      '<div><h3><a href="product.html?id=' + p.id + '">' + esc(p.name) + '</a></h3><div class="meta">' + esc(catName(p.cat)) + (i.color ? " · " + esc(i.color) : "") + '</div>' +
      (big ? '<div class="meta">' + ils(p.price) + ' each</div>' : '<div class="qty sm" style="margin-top:.5rem">' + qtyCtl(i) + '</div>') + '</div>' +
      (big ? '<div class="qty-cell"><div class="qty">' + qtyCtl(i) + '</div></div>' : '') +
      '<div class="end"><b>' + ils(p.price * i.qty) + '</b><button class="remove" data-remove="' + esc(i.key) + '" aria-label="Remove ' + esc(p.name) + ' from bag">Remove</button></div></div>';
  }
  function qtyCtl(i) {
    return '<button type="button" data-dec="' + esc(i.key) + '" aria-label="Decrease quantity">−</button><input type="number" min="1" max="99" value="' + i.qty + '" data-qty="' + esc(i.key) + '" aria-label="Quantity"><button type="button" data-inc="' + esc(i.key) + '" aria-label="Increase quantity">+</button>';
  }
  function render() {
    var n = Cart.count();
    $$(".cart-count").forEach(function (el) { el.textContent = n; el.classList.toggle("has", n > 0); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); });
    $$("[data-cart-label]").forEach(function (el) { el.setAttribute("aria-label", "Shopping bag, " + n + " items"); });
    renderDrawer(); renderCartPage(); renderCheckoutSummary();
  }
  function renderDrawer() {
    var body = $("#drawer-body"), foot = $("#drawer-foot"); if (!body) return;
    var items = Cart.get(), t = totals();
    if (!items.length) {
      body.innerHTML = '<div class="empty">' + ICON.bag + '<p>Your bag is empty</p><a class="btn btn-outline" href="shop.html">Shop the collection</a></div>';
      foot.hidden = true; return;
    }
    foot.hidden = false;
    body.innerHTML = shipProgress(t.sub - t.disc) + items.map(function (i) { return lineItem(i, false); }).join("");
    foot.innerHTML = '<div class="row"><span>Subtotal</span><b>' + ils(t.sub) + '</b></div><p class="small muted" style="margin:0">Shipping and discounts calculated at checkout</p><a class="btn btn-primary btn-block" href="checkout.html">Checkout</a><a class="btn btn-outline btn-block" href="cart.html">View bag</a>';
  }
  function renderCartPage() {
    var wrap = $("#cart-page"); if (!wrap) return;
    var items = Cart.get(), t = totals();
    if (!items.length) {
      wrap.innerHTML = '<div class="empty" style="padding:5rem 1rem">' + ICON.bag + '<h2>Your bag is empty</h2><p>A beautiful kitchen begins with a single piece.</p><a class="btn btn-primary" href="shop.html">Explore the collection</a></div>';
      return;
    }
    wrap.innerHTML = '<div class="cart-layout"><div><div style="margin-bottom:1rem">' + shipProgress(t.sub - t.disc) + '</div><div class="cart-table">' + items.map(function (i) { return lineItem(i, true); }).join("") +
      '</div><div style="display:flex;justify-content:space-between;margin-top:1.4rem;flex-wrap:wrap;gap:1rem"><a class="link-arrow" href="shop.html">← Continue shopping</a><button class="btn-ghost btn" type="button" id="clear-cart">Clear bag</button></div></div>' +
      '<aside class="summary" aria-label="Order summary"><h2>Order summary</h2>' + summaryRows(t) +
      '<form class="coupon" id="coupon-form"><label for="coupon" class="sr-only">Promo code</label><input class="input" id="coupon" placeholder="Promo code" value="' + esc(coupon) + '"><button class="btn btn-outline" type="submit">Apply</button></form>' +
      '<p class="small muted" style="margin:0">Demo tip: try code <b>NORDIC10</b></p>' +
      '<a class="btn btn-primary btn-block" href="checkout.html">Proceed to checkout</a><p class="small muted" style="margin:0;text-align:center">Free shipping over ' + ils(FREE_SHIP) + ' · 30-day returns</p></aside></div>';
  }
  function summaryRows(t) {
    return '<div class="row"><span>Subtotal</span><span>' + ils(t.sub) + '</span></div>' +
      (t.disc ? '<div class="row" style="color:var(--forest)"><span>Promo NORDIC10 (10%)</span><span>−' + ils(t.disc) + '</span></div>' : '') +
      '<div class="row"><span>Shipping</span><span>' + (t.ship ? ils(t.ship) : "Free") + '</span></div>' +
      '<div class="row total"><span>Total</span><span>' + ils(t.total) + '</span></div><p class="small muted" style="margin:0">Taxes calculated at checkout</p>';
  }
  function renderCheckoutSummary() {
    var el = $("#checkout-summary"); if (!el) return;
    var items = Cart.get(), t = totals();
    if (!items.length) { el.innerHTML = '<h2>Your bag is empty</h2><p class="muted">Add a few pieces to see your order summary.</p><a class="btn btn-outline" href="shop.html">Shop now</a>'; return; }
    el.innerHTML = '<h2>Your order</h2>' + items.map(function (i) { var p = byId(i.id);
      return '<div class="row" style="gap:.8rem;align-items:center"><span style="display:flex;gap:.8rem;align-items:center"><span style="position:relative"><img src="' + p.image + '" alt="" width="54" height="64" style="width:54px;height:64px;object-fit:cover;border-radius:8px"><span class="cart-count has" style="top:-6px;inset-inline-end:-6px">' + i.qty + '</span></span><span class="small">' + esc(p.name) + '</span></span><span class="small">' + ils(p.price * i.qty) + '</span></div>'; }).join("") + summaryRows(t);
  }

  /* ---------- Product card ---------- */
  function stars(r) { var f = Math.round(r); return '<span class="stars" aria-hidden="true">' + "★★★★★".slice(0, f) + "☆☆☆☆☆".slice(0, 5 - f) + "</span>"; }
  function card(p) {
    var badge = p.badge ? '<span class="badge ' + (p.badge === "Sale" ? "sale" : p.badge === "New" ? "new" : "") + '">' + esc(p.badge) + "</span>" : "";
    return '<article class="product-card reveal">' +
      '<div class="media">' + badge + '<img src="' + p.image + '" alt="' + esc(p.name) + '" loading="lazy" width="450" height="560">' +
      '<div class="quick-add"><button class="btn" type="button" data-add="' + p.id + '" aria-label="Add ' + esc(p.name) + ' to bag">' + ICON.plus + 'Add to bag</button></div></div>' +
      '<div class="info"><span class="cat">' + esc(catName(p.cat)) + '</span><h3><a href="product.html?id=' + p.id + '">' + esc(p.name) + '</a></h3>' +
      '<div class="price"><span class="now">' + ils(p.price) + '</span>' + (p.was ? '<span class="was"><span class="sr-only">was </span>' + ils(p.was) + "</span>" : "") + "</div>" +
      '<span class="rating">' + stars(p.rating) + '<span>' + p.rating + ' (' + p.reviews + ')</span><span class="sr-only">Rated ' + p.rating + ' out of 5</span></span>' +
      (p.colors && p.colors.length > 1 ? '<div class="swatches" aria-label="' + p.colors.length + ' colors">' + p.colors.map(function (c) { return '<span class="swatch" style="background:' + c[1] + '" title="' + esc(c[0]) + '"></span>'; }).join("") + "</div>" : "") +
      "</div></article>";
  }

  /* ---------- Pages ---------- */
  function initHome() {
    var g = $("#bestsellers"); if (g) {
      var best = P.slice().sort(function (a, b) { return b.reviews - a.reviews; }).slice(0, 8);
      g.innerHTML = best.map(card).join("");
    }
    var cg = $("#home-cats"); if (cg) {
      cg.innerHTML = C.map(function (c) {
        var n = P.filter(function (p) { return p.cat === c.id; }).length;
        return '<a class="cat-tile reveal" href="shop.html?cat=' + c.id + '"><img src="' + c.image + '" alt="" loading="lazy"><div class="cat-label"><div><b>' + esc(c.name) + '</b><span>' + esc(c.desc) + ' · ' + n + ' pieces</span></div><span class="arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></span></div></a>';
      }).join("");
    }
  }

  function initShop() {
    var grid = $("#shop-grid"); if (!grid) return;
    var params = new URLSearchParams(location.search);
    var state = { cat: params.get("cat") || "all", q: params.get("q") || "", sort: params.get("sort") || "featured", max: 1500 };
    if (state.cat !== "all" && !C.some(function (c) { return c.id === state.cat; })) state.cat = "all";
    var maxPrice = Math.ceil(Math.max.apply(null, P.map(function (p) { return p.price; })) / 50) * 50; state.max = maxPrice;
    var all = [{ id: "all", name: "All products" }].concat(C);
    $("#cat-list").innerHTML = all.map(function (c) { var n = c.id === "all" ? P.length : P.filter(function (p) { return p.cat === c.id; }).length;
      return '<li><button type="button" data-cat="' + c.id + '" aria-pressed="false"><span>' + esc(c.name) + '</span><span class="n">' + n + "</span></button></li>"; }).join("");
    $("#chips").innerHTML = all.map(function (c) { return '<button class="chip" type="button" data-cat="' + c.id + '" aria-pressed="false">' + esc(c.name) + "</button>"; }).join("");
    var search = $("#shop-search"), sort = $("#shop-sort"), range = $("#price-range"), out = $("#price-out");
    search.value = state.q; sort.value = state.sort; range.max = maxPrice; range.value = maxPrice; out.textContent = "Up to " + ils(maxPrice);
    function apply() {
      $$("[data-cat]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.cat === state.cat)); });
      var q = state.q.trim().toLowerCase();
      var list = P.filter(function (p) {
        return (state.cat === "all" || p.cat === state.cat) && p.price <= state.max &&
          (!q || (p.name + " " + p.short + " " + catName(p.cat)).toLowerCase().indexOf(q) > -1);
      });
      var s = { "price-asc": function (a, b) { return a.price - b.price; }, "price-desc": function (a, b) { return b.price - a.price; }, rating: function (a, b) { return b.rating - a.rating; }, popular: function (a, b) { return b.reviews - a.reviews; } }[state.sort];
      if (s) list.sort(s);
      grid.innerHTML = list.length ? list.map(card).join("") : '<div class="empty" style="grid-column:1/-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><p>No pieces match your search.</p><button class="btn btn-outline" type="button" id="reset-filters">Reset filters</button></div>';
      $("#result-count").textContent = list.length + (list.length === 1 ? " product" : " products");
      $("#shop-title").textContent = state.cat === "all" ? "The Collection" : catName(state.cat);
      var u = new URLSearchParams(); if (state.cat !== "all") u.set("cat", state.cat); if (state.q) u.set("q", state.q); if (state.sort !== "featured") u.set("sort", state.sort);
      history.replaceState(null, "", location.pathname + (u.toString() ? "?" + u : ""));
      observe();
    }
    document.addEventListener("click", function (e) {
      var b = e.target.closest("[data-cat]"); if (b) { state.cat = b.dataset.cat; apply(); }
      if (e.target.closest("#reset-filters")) { state = { cat: "all", q: "", sort: "featured", max: maxPrice }; search.value = ""; sort.value = "featured"; range.value = maxPrice; out.textContent = "Up to " + ils(maxPrice); apply(); }
    });
    var tmr; search.addEventListener("input", function () { clearTimeout(tmr); tmr = setTimeout(function () { state.q = search.value; apply(); }, 150); });
    sort.addEventListener("change", function () { state.sort = sort.value; apply(); });
    range.addEventListener("input", function () { state.max = +range.value; out.textContent = "Up to " + ils(state.max); apply(); });
    apply();
  }

  function initProduct() {
    var root = $("#pdp"); if (!root) return;
    var id = new URLSearchParams(location.search).get("id"), p = byId(id) || P[0];
    document.title = p.name + " | Norway Kitchen";
    var md = $('meta[name="description"]'); if (md) md.setAttribute("content", p.short);
    $("#bc-cat").innerHTML = '<a href="shop.html?cat=' + p.cat + '">' + esc(catName(p.cat)) + "</a>";
    $("#bc-name").textContent = p.name;
    var views = [["", "Main image"], ["view-detail", "Close-up"], ["view-detail-2", "Detail"]];
    var color = p.colors && p.colors[0] ? p.colors[0][0] : "";
    root.innerHTML =
      '<div class="gallery"><div class="thumbs" role="group" aria-label="Product images">' + views.map(function (v, i) {
        return '<button class="thumb ' + v[0] + '" type="button" data-view="' + v[0] + '" aria-current="' + (i === 0) + '" aria-label="' + v[1] + '"><img src="' + p.image + '" alt="" width="84" height="84"></button>'; }).join("") +
      '</div><div class="main-img" id="main-img" role="button" tabindex="0" aria-label="Zoom image"><img src="' + p.image + '" alt="' + esc(p.name) + '" width="700" height="875"></div></div>' +
      '<div class="pdp-info"><span class="cat">' + esc(catName(p.cat)) + '</span><h1>' + esc(p.name) + '</h1>' +
      '<span class="rating">' + stars(p.rating) + "<span>" + p.rating + " · " + p.reviews + " reviews</span></span>" +
      '<div class="pdp-price price"><span class="now">' + ils(p.price) + "</span>" + (p.was ? '<span class="was">' + ils(p.was) + '</span><span class="save">Save ' + ils(p.was - p.price) + "</span>" : "") + "</div>" +
      '<p class="lead" style="font-size:1.05rem">' + esc(p.short) + "</p>" +
      (p.colors && p.colors.length ? '<div class="option-group"><div class="label">Color: <b id="color-name">' + esc(color) + '</b></div><div class="color-opts" role="group" aria-label="Choose color">' + p.colors.map(function (c, i) {
        return '<button class="color-opt" type="button" style="background:' + c[1] + '" data-color="' + esc(c[0]) + '" aria-pressed="' + (i === 0) + '" aria-label="' + esc(c[0]) + '"></button>'; }).join("") + "</div></div>" : "") +
      '<span class="stock">In stock · Ships in 1–3 business days</span>' +
      '<div class="buy-row"><div class="qty"><button type="button" id="q-dec" aria-label="Decrease quantity">−</button><input id="q-val" type="number" min="1" max="99" value="1" aria-label="Quantity"><button type="button" id="q-inc" aria-label="Increase quantity">+</button></div>' +
      '<button class="btn btn-primary" type="button" id="pdp-add">' + ICON.bag + "Add to bag · " + ils(p.price) + "</button></div>" +
      '<div class="perks"><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>Free shipping on orders over ' + ils(FREE_SHIP) + '</div><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>Free returns within 30 days</div><div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z"/></svg>Secure checkout & manufacturer warranty</div></div>' +
      '<div class="accordion"><details open><summary>Description</summary><div class="content"><p>' + esc(p.desc) + '</p></div></details>' +
      '<details><summary>Specifications</summary><div class="content"><table class="specs"><tbody>' + Object.keys(p.specs).map(function (k) { return "<tr><th scope=\"row\">" + esc(k) + "</th><td>" + esc(p.specs[k]) + "</td></tr>"; }).join("") + "</tbody></table></div></details>" +
      '<details><summary>Shipping & returns</summary><div class="content"><p>Delivered to your door in 1–3 business days across the contiguous US. Unused items may be returned within 30 days. <a class="link-arrow" href="shipping.html">Full policy</a></p></div></details></div></div>';
    // gallery
    var main = $("#main-img");
    root.addEventListener("click", function (e) {
      var t = e.target.closest(".thumb"); if (t) { $$(".thumb", root).forEach(function (x) { x.setAttribute("aria-current", String(x === t)); }); main.className = "main-img " + t.dataset.view; }
      var c = e.target.closest(".color-opt"); if (c) { $$(".color-opt", root).forEach(function (x) { x.setAttribute("aria-pressed", String(x === c)); }); color = c.dataset.color; $("#color-name").textContent = color; }
    });
    function zoom() { main.classList.toggle("zoom"); }
    main.addEventListener("click", zoom); main.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); zoom(); } });
    var qv = $("#q-val"); var clamp = function (v) { return Math.max(1, Math.min(99, parseInt(v, 10) || 1)); };
    $("#q-dec").onclick = function () { qv.value = clamp(+qv.value - 1); }; $("#q-inc").onclick = function () { qv.value = clamp(+qv.value + 1); };
    qv.onchange = function () { qv.value = clamp(qv.value); };
    $("#pdp-add").onclick = function () { Cart.add(p.id, clamp(qv.value), color); toast(p.name + " added to bag"); openDrawer(); };
    var rel = $("#related"); if (rel) {
      var r = P.filter(function (x) { return x.cat === p.cat && x.id !== p.id; });
      r = r.concat(P.filter(function (x) { return x.cat !== p.cat; }).sort(function (a, b) { return b.reviews - a.reviews; })).slice(0, 4);
      rel.innerHTML = r.map(card).join("");
    }
    // structured data
    var ld = document.createElement("script"); ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: p.name, image: p.image, description: p.short, brand: { "@type": "Brand", name: "Norway Kitchen" },
      aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.reviews }, offers: { "@type": "Offer", priceCurrency: "USD", price: p.price, availability: "https://schema.org/InStock" } });
    document.head.appendChild(ld);
  }

  function initCheckout() {
    var f = $("#checkout-form"); if (!f) return;
    f.addEventListener("change", function () { renderCheckoutSummary(); });
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate(f)) return;
      if (!Cart.count()) { toast("Your bag is empty. Add a piece first."); return; }
      var num = "NK-" + Math.floor(100000 + Math.random() * 899999);
      Cart.clear();
      $("#checkout-wrap").innerHTML = '<div class="success"><div class="ic">' + ICON.check + '</div><h1 style="font-size:2.6rem">Thank you. Your demo order is placed.</h1><p class="lead">Sample order number: <b>' + num + '</b></p><p class="muted">This is a demo store: no payment was taken, no details were stored and nothing will ship.</p><a class="btn btn-primary" href="index.html">Return home</a></div>';
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  /* ---------- Forms ---------- */
  function validate(form) {
    var ok = true;
    $$("[required]", form).forEach(function (el) {
      var bad = !el.value.trim() || (el.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)) || (el.type === "tel" && !/^[0-9+\-\s]{9,}$/.test(el.value));
      el.classList.toggle("invalid", bad); el.setAttribute("aria-invalid", String(bad)); if (bad && ok) { el.focus(); ok = false; }
    });
    return ok;
  }
  function initForms() {
    $$("form[data-demo]").forEach(function (f) {
      f.addEventListener("submit", function (e) {
        e.preventDefault(); if (!validate(f)) return;
        var msg = $(".msg", f.parentNode) || $(".msg", f);
        if (msg) msg.textContent = f.dataset.demo; toast(f.dataset.demo); f.reset();
      });
    });
    $$("input[required],textarea[required]").forEach(function (el) { el.addEventListener("input", function () { el.classList.remove("invalid"); }); });
  }

  /* ---------- Drawer / nav ---------- */
  var lastFocus;
  function openDrawer() { var d = $("#cart-drawer"); if (!d) return; lastFocus = document.activeElement; d.classList.add("open"); d.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; setTimeout(function () { $(".drawer-head button", d).focus(); }, 50); }
  function closeDrawer() { var d = $("#cart-drawer"); if (!d || !d.classList.contains("open")) return; d.classList.remove("open"); d.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; if (lastFocus) lastFocus.focus(); }
  function toggleNav(open) { var n = $("#mobile-nav"); if (!n) return; n.classList.toggle("open", open); n.setAttribute("aria-hidden", String(!open)); $("#menu-toggle").setAttribute("aria-expanded", String(open)); document.body.style.overflow = open ? "hidden" : ""; if (open) $("a", n).focus(); }

  function initGlobal() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest("[data-add]"); if (a) { e.preventDefault(); var p = byId(a.dataset.add); Cart.add(p.id, 1, p.colors && p.colors[0] ? p.colors[0][0] : ""); toast(p.name + " added to bag"); openDrawer(); return; }
      if (e.target.closest("[data-open-cart]")) { e.preventDefault(); openDrawer(); return; }
      if (e.target.closest("[data-close-cart]")) { closeDrawer(); return; }
      var inc = e.target.closest("[data-inc]"), dec = e.target.closest("[data-dec]"), rm = e.target.closest("[data-remove]");
      if (inc || dec) { var k = (inc || dec).dataset[inc ? "inc" : "dec"], it = Cart.get().find(function (i) { return i.key === k; }); if (it) Cart.update(k, it.qty + (inc ? 1 : -1)); return; }
      if (rm) { Cart.remove(rm.dataset.remove); toast("Removed from bag"); return; }
      if (e.target.closest("#clear-cart")) { Cart.clear(); return; }
      if (e.target.closest("#menu-toggle")) { toggleNav(true); return; }
      if (e.target.closest("[data-close-nav]")) { toggleNav(false); return; }
      if (e.target.closest("#search-toggle")) { var s = $("#header-search"); s.classList.toggle("open"); $("#search-toggle").setAttribute("aria-expanded", String(s.classList.contains("open"))); if (s.classList.contains("open")) $("input", s).focus(); }
    });
    document.addEventListener("change", function (e) { var q = e.target.closest("[data-qty]"); if (q) Cart.update(q.dataset.qty, parseInt(q.value, 10) || 1); });
    document.addEventListener("submit", function (e) {
      if (e.target.id === "coupon-form") { e.preventDefault(); var v = $("#coupon").value.trim().toUpperCase(); coupon = v === "NORDIC10" ? v : ""; try { sessionStorage.setItem("nk_coupon", coupon); } catch (x) {} toast(coupon ? "NORDIC10 applied: 10% off" : "That code isn't valid"); render(); }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") { closeDrawer(); toggleNav(false); } });
    var h = $(".site-header"); var onS = function () { if (h) h.classList.toggle("scrolled", window.scrollY > 10); }; window.addEventListener("scroll", onS, { passive: true }); onS();
    window.addEventListener("storage", function (e) { if (e.key === KEY) render(); });
    var y = $("#year"); if (y) y.textContent = new Date().getFullYear();
  }

  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }); }, { rootMargin: "0px 0px -8% 0px" }) : null;
  function observe() { $$(".reveal:not(.in)").forEach(function (el) { if (io) io.observe(el); else el.classList.add("in"); }); }

  document.addEventListener("DOMContentLoaded", function () {
    initGlobal(); initHome(); initShop(); initProduct(); initCheckout(); initForms(); render(); observe();
  });
  window.NK = { Cart: Cart, toast: toast };
})();
