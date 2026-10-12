(function () {
  "use strict";

  var KEY = "oriel_cart_v1";
  var MAX_QTY = 20;

  var catalog = {};
  try { catalog = JSON.parse(document.getElementById("catalog").textContent); } catch (e) {}

  function money(n) { return "KES " + Number(n).toLocaleString("en-US"); }

  // ----- Storage (the server re-prices everything at checkout, so this only holds keys and quantities) -----
  function read() {
    var clean = {};
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || "{}");
      Object.keys(raw || {}).forEach(function (k) {
        var q = parseInt(raw[k], 10);
        if (catalog[k] && q > 0) clean[k] = Math.min(q, MAX_QTY);
      });
    } catch (e) {}
    return clean;
  }
  function write(cart) {
    try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) {}
    updateBadge();
    document.dispatchEvent(new Event("cart:change"));
  }
  function itemCount(cart) {
    return Object.keys(cart).reduce(function (n, k) { return n + cart[k]; }, 0);
  }
  function cartTotal(cart) {
    return Object.keys(cart).reduce(function (n, k) { return n + catalog[k].price * cart[k]; }, 0);
  }

  // ----- Header badge + toast -----
  function updateBadge() {
    var badge = document.getElementById("cart-count");
    if (!badge) return;
    var n = itemCount(read());
    badge.textContent = n;
    badge.hidden = n === 0;
    badge.parentNode.setAttribute("aria-label", "Cart, " + n + (n === 1 ? " item" : " items"));
  }
  var toastTimer;
  function toast(text) {
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }
  updateBadge();

  // ----- Add to cart buttons (wine list + menu) -----
  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-add]");
    if (!btn) return;
    var key = btn.getAttribute("data-add");
    if (!catalog[key]) return;
    var cart = read();
    cart[key] = Math.min((cart[key] || 0) + 1, MAX_QTY);
    write(cart);
    toast("Added " + catalog[key].name + " to your cart");
  });

  // ----- Cart page -----
  var itemsEl = document.getElementById("cart-items");
  if (!itemsEl) return;

  var totalWrap = document.getElementById("cart-total");
  var totalEl = document.getElementById("cart-total-amount");
  var emptyEl = document.getElementById("cart-empty");
  var checkout = document.getElementById("checkout");
  var form = document.getElementById("payform");
  var msg = document.getElementById("msg");
  var payBtn = document.getElementById("pay-btn");
  var paid = false;
  var paying = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function stepBtn(label, act, key, aria) {
    var b = el("button", "", label);
    b.type = "button";
    b.setAttribute("data-act", act);
    b.setAttribute("data-key", key);
    b.setAttribute("aria-label", aria);
    return b;
  }

  function render() {
    var cart = read();
    var keys = Object.keys(cart);
    itemsEl.textContent = "";

    keys.forEach(function (k) {
      var item = catalog[k];
      var line = el("div", "cart-line");

      var info = el("div");
      info.appendChild(el("span", "wname", item.name));
      info.appendChild(el("span", "wmeta", item.kind + ", " + money(item.price) + " each"));
      line.appendChild(info);
      line.appendChild(el("span", "price", money(item.price * cart[k])));

      var actions = el("div", "cart-actions");
      var qty = el("div", "qty");
      qty.setAttribute("role", "group");
      qty.setAttribute("aria-label", "Quantity of " + item.name);
      qty.appendChild(stepBtn("\u2212", "dec", k, "Remove one " + item.name));
      var out = el("output", "", String(cart[k]));
      qty.appendChild(out);
      qty.appendChild(stepBtn("+", "inc", k, "Add one " + item.name));
      actions.appendChild(qty);
      var rm = el("button", "link-btn", "Remove");
      rm.type = "button";
      rm.setAttribute("data-act", "rm");
      rm.setAttribute("data-key", k);
      rm.setAttribute("aria-label", "Remove " + item.name + " from cart");
      actions.appendChild(rm);
      line.appendChild(actions);

      itemsEl.appendChild(line);
    });

    totalWrap.hidden = keys.length === 0;
    totalEl.textContent = money(cartTotal(cart));
    emptyEl.hidden = keys.length > 0 || paid;
    checkout.hidden = keys.length === 0 && !paid;
    payBtn.textContent = keys.length ? "Pay " + money(cartTotal(cart)) + " with M-Pesa" : "Pay with M-Pesa";
  }

  itemsEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b || paying) return;
    var key = b.getAttribute("data-key");
    var act = b.getAttribute("data-act");
    var cart = read();
    if (!cart[key]) return;
    if (act === "inc") cart[key] = Math.min(cart[key] + 1, MAX_QTY);
    if (act === "dec") cart[key] -= 1;
    if (act === "rm" || cart[key] <= 0) delete cart[key];
    write(cart);
    render();
    // Keep keyboard focus useful after the list redraws.
    var again = itemsEl.querySelector('[data-key="' + key + '"][data-act="' + act + '"]');
    (again || document.getElementById("cart-empty").querySelector("a") || document.body).focus();
  });

  // ----- Payment -----
  function say(text, cls) { msg.className = cls || ""; msg.textContent = text; }

  function finish(order) {
    paid = true;
    paying = false;
    write({});
    document.getElementById("pay-panel").hidden = true;
    document.getElementById("done-order").textContent = "#" + order.order_id.toUpperCase();
    if (order.receipt) document.getElementById("done-receipt").textContent = order.receipt;
    document.getElementById("done").hidden = false;
    render();
    document.getElementById("done").scrollIntoView({ block: "center" });
  }

  function fail(text) {
    paying = false;
    payBtn.disabled = false;
    say(text, "err");
  }

  function poll(orderId, tries) {
    if (tries > 30) { // about 90 seconds
      fail("We have not heard back from M-Pesa yet. If money left your account, call us with order #" +
           orderId.toUpperCase() + ". Otherwise try again.");
      return;
    }
    setTimeout(function () {
      fetch("/api/order/" + encodeURIComponent(orderId))
        .then(function (res) { return res.json(); })
        .then(function (o) {
          if (o.status === "paid") finish(o);
          else if (o.status === "failed" || o.status === "cancelled") fail(o.message);
          else poll(orderId, tries + 1);
        })
        .catch(function () { poll(orderId, tries + 1); });
    }, 3000);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var cart = read();
    var keys = Object.keys(cart);
    if (!keys.length || paying) return;

    paying = true;
    payBtn.disabled = true;
    say("Sending the M-Pesa prompt to your phone\u2026");

    fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: document.getElementById("cname").value,
        phone: document.getElementById("cphone").value,
        note: document.getElementById("cnote").value,
        items: keys.map(function (k) { return { key: k, qty: cart[k] }; })
      })
    })
      .then(function (res) { return res.json().then(function (out) { return { ok: res.ok, out: out }; }); })
      .then(function (r) {
        if (!r.ok) { fail(r.out.message); return; }
        say(r.out.message + " Keep this page open.", "ok");
        poll(r.out.order_id, 0);
      })
      .catch(function () {
        fail("We could not reach the server. Check your connection and try again.");
      });
  });

  render();
})();
