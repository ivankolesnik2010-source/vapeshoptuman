(function () {
  "use strict";
  var P = [], cart = {}, cat = "Усі", term = "";
  var CAT = { d: "Пристрої", l: "Рідини", p: "Витратники" };

  function $(s) { return document.querySelector(s); }
  function money(n) { return Number(n).toLocaleString("uk-UA") + " ₴"; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function save() { try { localStorage.setItem("cart", JSON.stringify(cart)); } catch (e) {} }

  function art(p) {
    if (p.image) return '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">';
    var c = "hsl(" + p.hue + " 70% 55%)", k = "hsl(" + p.hue + " 70% 40%)", s = '<svg viewBox="0 0 120 120" aria-hidden="true">';
    if (p.type == "d") s += '<rect x="38" y="16" width="44" height="98" rx="18" fill="' + c + '"/><rect x="50" y="6" width="20" height="16" rx="6" fill="' + k + '"/><rect x="47" y="34" width="26" height="24" rx="8" fill="#fff" opacity=".8"/><circle cx="60" cy="84" r="6" fill="#fff" opacity=".9"/>';
    else if (p.type == "l") s += '<rect x="42" y="42" width="36" height="72" rx="11" fill="' + c + '"/><rect x="52" y="26" width="16" height="18" rx="2" fill="' + k + '"/><rect x="49" y="14" width="22" height="13" rx="4" fill="' + k + '"/><rect x="47" y="66" width="26" height="30" rx="5" fill="#fff" opacity=".85"/>';
    else s += '<rect x="42" y="34" width="36" height="66" rx="10" fill="' + c + '"/><rect x="50" y="20" width="20" height="16" rx="5" fill="' + k + '"/><rect x="49" y="52" width="22" height="24" rx="6" fill="#fff" opacity=".75"/>';
    return s + "</svg>";
  }

  function feat() {
    var p = P.filter(function (x) { return x.tag == "Хіт"; })[0] || P[0], f = $("#feat");
    if (!p) { f.innerHTML = ""; return; }
    f.innerHTML = '<div class="pic" style="--h:' + p.hue + '">' + art(p) + '</div><div class="fb"><div class="hint">Популярне</div><h3>' + esc(p.name) + '</h3><ul>' +
      p.description.split(", ").filter(Boolean).map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") +
      '</ul><div class="buy"><span class="price">' + money(p.price) + '</span><button class="add" data-a="' + p.id + '">У кошик</button></div></div>';
  }
  function chips() {
    $("#chips").innerHTML = ["Усі", "Пристрої", "Рідини", "Витратники"].map(function (c) {
      return '<button class="chip" aria-pressed="' + (c == cat) + '" data-c="' + c + '">' + c + "</button>";
    }).join("");
  }
  function grid() {
    feat();
    var l = P.filter(function (p) {
      return (cat == "Усі" || CAT[p.type] == cat) && (p.name + " " + p.description).toLowerCase().indexOf(term) > -1;
    });
    $("#grid").innerHTML = l.length ? l.map(function (p) {
      return '<article class="card"><div class="pic" style="--h:' + p.hue + '">' + (p.tag ? '<span class="tag">' + esc(p.tag) + "</span>" : "") + art(p) +
        '</div><div class="info"><h3>' + esc(p.name) + "</h3><p>" + esc(p.description) + '</p><div class="buy"><span class="price">' + money(p.price) +
        '</span><button class="add" data-a="' + p.id + '">У кошик</button></div></div></article>';
    }).join("") : '<div class="empty">Нічого не знайшли. Спробуйте інший запит або категорію.</div>';
  }

  function items() { return P.filter(function (p) { return cart[p.id]; }); }
  function total() { return items().reduce(function (s, p) { return s + p.price * cart[p.id]; }, 0); }
  function sync() { $("#cnt").textContent = items().reduce(function (s, p) { return s + cart[p.id]; }, 0); }
  function show(on) {
    $("#drawer").classList.toggle("on", on);
    $("#veil").classList.toggle("on", on);
    if (on) view();
  }

  function view() {
    var it = items(), t = total();
    $("#dt").textContent = "Кошик";
    if (!it.length) {
      $("#db").innerHTML = '<div class="empty" style="padding:60px 0">У кошику порожньо. Додайте щось із каталогу.</div>';
      $("#df").innerHTML = "";
      return;
    }
    $("#db").innerHTML = it.map(function (p) {
      return '<div class="row"><div class="mini" style="--h:' + p.hue + '">' + art(p) + '</div><div class="t">' + esc(p.name) + "<small>" + money(p.price) +
        '</small></div><div class="qty"><button data-m="' + p.id + '" aria-label="Менше">−</button><span>' + cart[p.id] + '</span><button data-p="' + p.id + '" aria-label="Більше">+</button></div></div>';
    }).join("");
    var left = Math.max(0, 1500 - t);
    $("#df").innerHTML = '<div class="sum"><span>Разом</span><span>' + money(t) + '</span></div><div class="ship">' +
      (left ? "До безкоштовної доставки Новою поштою: " + money(left) : "Доставка безкоштовна") +
      '<div class="meter"><i style="width:' + Math.min(100, t / 15) + '%"></i></div></div><button class="btn" id="go">Оформити замовлення</button>';
  }
  function form() {
    $("#dt").textContent = "Оформлення";
    $("#db").innerHTML = '<label for="n">Ім’я</label><input class="in" id="n" autocomplete="name" maxlength="60"><label for="ph">Телефон</label><input class="in" id="ph" type="tel" placeholder="+380" autocomplete="tel" maxlength="20"><label for="ct">Місто та відділення Нової пошти</label><input class="in" id="ct" placeholder="Дніпро, відділення 12" maxlength="120"><label class="chk"><input type="checkbox" id="age"> Мені виповнилося 18 років</label><div class="err" id="er"></div>';
    $("#df").innerHTML = '<div class="sum"><span>До сплати при отриманні</span><span>' + money(total()) + '</span></div><button class="btn" id="send">Підтвердити замовлення</button><button class="btn ghost" id="back" style="margin-top:8px">Назад до кошика</button>';
  }
  function send() {
    var n = $("#n").value.trim(), ph = $("#ph").value.trim(), ct = $("#ct").value.trim(), e = $("#er"), b = $("#send");
    if (!n || ph.replace(/\D/g, "").length < 10 || !ct) { e.textContent = "Заповніть ім’я, телефон і місто з відділенням."; return; }
    if (!$("#age").checked) { e.textContent = "Замовлення можливе лише з 18 років. Підтвердьте вік."; return; }
    b.disabled = true; e.textContent = "";
    fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n, phone: ph, city: ct, age: true, items: Object.keys(cart).map(function (id) { return { id: +id, qty: cart[id] }; }) })
    }).then(function (r) {
      return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || "Помилка"); return d; });
    }).then(function (d) {
      cart = {}; save(); sync();
      $("#dt").textContent = "Готово";
      $("#db").innerHTML = '<div class="ok"><svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="var(--acc)"/><path d="M18 33l9 9 19-20" stroke="var(--acc-ink)" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg><h2>Замовлення №' + d.id + ' прийнято</h2><p style="color:var(--mute)">Менеджер зателефонує вам, щоб підтвердити доставку. Оплата при отриманні.</p></div>';
      $("#df").innerHTML = '<button class="btn" id="fin">Продовжити покупки</button>';
    }).catch(function (er) {
      e.textContent = er.message || "Не вдалося відправити замовлення. Спробуйте ще раз.";
      b.disabled = false;
    });
  }

  document.addEventListener("click", function (e) {
    var t = e.target, d = t.dataset || {};
    if (d.c) { cat = d.c; chips(); grid(); }
    if (d.go) { cat = d.go; chips(); grid(); $("#shop").scrollIntoView({ behavior: "smooth" }); }
    if (d.a) { cart[d.a] = (cart[d.a] || 0) + 1; save(); sync(); t.textContent = "Додано"; setTimeout(function () { t.textContent = "У кошик"; }, 900); }
    if (d.p) { cart[d.p]++; save(); sync(); view(); }
    if (d.m) { cart[d.m]--; if (!cart[d.m]) delete cart[d.m]; save(); sync(); view(); }
    if (t.id == "open") show(true);
    if (t.id == "close" || t.id == "veil" || t.id == "fin") show(false);
    if (t.id == "go") form();
    if (t.id == "back") view();
    if (t.id == "send") send();
    if (t.id == "yes") { $("#gate").hidden = true; try { sessionStorage.setItem("ok", "1"); } catch (x) {} }
    if (t.id == "no") {
      $("#gt").textContent = "Доступ закрито";
      $("#gp").textContent = "Показ і продаж цього товару лише для осіб віком від 18 років.";
      $("#gb").innerHTML = "";
    }
  });
  $("#q").addEventListener("input", function (e) { term = e.target.value.toLowerCase().trim(); grid(); });
  document.addEventListener("keydown", function (e) { if (e.key == "Escape") show(false); });

  try { if (sessionStorage.getItem("ok")) $("#gate").hidden = true; } catch (x) {}
  try { cart = JSON.parse(localStorage.getItem("cart") || "{}") || {}; } catch (x) { cart = {}; }
  chips();
  fetch("/api/products").then(function (r) { return r.json(); }).then(function (l) {
    P = l;
    Object.keys(cart).forEach(function (id) { if (!P.some(function (p) { return p.id == id; })) delete cart[id]; });
    save(); grid(); sync();
  }).catch(function () {
    $("#grid").innerHTML = '<div class="empty">Не вдалося завантажити каталог. Оновіть сторінку.</div>';
  });
})();
