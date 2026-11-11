(function () {
  "use strict";
  var app = document.getElementById("app");
  var tab = "products", prods = [], orders = [], edit = null;
  var CAT = { d: "Пристрій", l: "Рідина", p: "Витратник" };
  var ST = { "new": "Нове", confirmed: "Підтверджене", shipped: "Відправлене", done: "Виконане", cancelled: "Скасоване" };

  function $(s) { return document.querySelector(s); }
  function money(n) { return Number(n).toLocaleString("uk-UA") + " ₴"; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function when(s) { return new Date(s.replace(" ", "T") + "Z").toLocaleString("uk-UA"); }

  function api(url, opt) {
    opt = opt || {};
    if (opt.body && !(opt.body instanceof FormData)) {
      opt.headers = { "Content-Type": "application/json" };
      opt.body = JSON.stringify(opt.body);
    }
    opt.credentials = "same-origin";
    return fetch(url, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var e = new Error(d.error || "Помилка " + r.status); e.status = r.status; throw e; }
        return d;
      });
    });
  }

  function loadAll() {
    return Promise.all([api("/api/admin/products"), api("/api/admin/orders")]).then(function (r) {
      prods = r[0]; orders = r[1];
    });
  }

  function loginView(err) {
    app.innerHTML = '<div class="box login"><h2 style="font-size:22px;margin-bottom:12px">Вхід для власника</h2><form id="lf"><label for="pw">Пароль</label><input class="in" id="pw" type="password" autocomplete="current-password" autofocus><div class="err" id="le">' + esc(err || "") + '</div><button class="btn" style="width:100%;margin-top:8px">Увійти</button></form></div>';
  }

  function art(p) { return p.image ? '<img src="' + esc(p.image) + '" alt="">' : ""; }

  function pform() {
    var p = edit || { name: "", price: "", type: "d", tag: "", hue: 200, description: "", image: "" };
    return '<div class="box"><h3 style="font-size:18px">' + (edit ? "Редагувати товар" : "Додати товар") + '</h3><form id="pf"><div class="frm">' +
      '<div><label for="f-name">Назва</label><input class="in" id="f-name" maxlength="80" required value="' + esc(p.name) + '"></div>' +
      '<div><label for="f-price">Ціна, ₴</label><input class="in" id="f-price" type="number" min="0" required value="' + esc(p.price) + '"></div>' +
      '<div><label for="f-type">Тип</label><select class="in" id="f-type">' + Object.keys(CAT).map(function (k) { return '<option value="' + k + '"' + (p.type == k ? " selected" : "") + ">" + CAT[k] + "</option>"; }).join("") + '</select></div>' +
      '<div><label for="f-tag">Мітка (необов’язково)</label><input class="in" id="f-tag" maxlength="20" placeholder="Новинка" value="' + esc(p.tag) + '"></div>' +
      '<div><label for="f-hue">Колір, якщо немає фото</label><input id="f-hue" type="range" min="0" max="360" value="' + esc(p.hue) + '" style="width:100%"></div>' +
      '<div><label for="f-img">Фото (JPG, PNG, WebP до 3 МБ)</label><input class="in" id="f-img" type="file" accept="image/jpeg,image/png,image/webp"></div></div>' +
      '<label for="f-desc">Короткий опис</label><input class="in" id="f-desc" maxlength="200" value="' + esc(p.description) + '">' +
      (p.image ? '<label class="chk"><input type="checkbox" id="f-rm"> Прибрати поточне фото</label>' : "") +
      '<div class="err" id="f-err"></div><div class="quick"><button class="btn sm">' + (edit ? "Зберегти" : "Додати товар") + "</button>" +
      (edit ? '<button type="button" class="btn ghost sm" id="f-cancel">Скасувати</button>' : "") + "</div></form></div>";
  }
  function plist() {
    return '<div class="box"><h3 style="font-size:18px;margin-bottom:6px">Товари (' + prods.length + ")</h3>" +
      (prods.length ? prods.map(function (p) {
        return '<div class="arow' + (p.active ? "" : " off") + '"><div class="mini" style="--h:' + p.hue + '">' + art(p) + '</div><div class="t">' + esc(p.name) +
          '<small class="hint" style="display:block">' + CAT[p.type] + ", " + money(p.price) + (p.active ? "" : ", приховано") + "</small></div>" +
          '<button class="btn ghost sm" data-edit="' + p.id + '">Змінити</button><button class="btn ghost sm" data-vis="' + p.id + '">' + (p.active ? "Приховати" : "Показати") +
          '</button><button class="del" data-del="' + p.id + '">Видалити</button></div>';
      }).join("") : '<p class="hint">Товарів поки немає.</p>') + "</div>";
  }
  function olist() {
    var opts = function (cur) {
      return Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (cur == k ? " selected" : "") + ">" + ST[k] + "</option>"; }).join("");
    };
    return '<div class="box">' + (orders.length ? orders.map(function (o) {
      return '<div class="ord"><div class="top"><strong>№' + o.id + ", " + esc(o.name) + '</strong><span class="hint">' + when(o.created_at) + '</span></div><div class="hint">' +
        esc(o.phone) + ", " + esc(o.city) + "</div><ul>" +
        o.items.map(function (i) { return "<li>" + esc(i.name) + " × " + i.qty + " (" + money(i.price * i.qty) + ")</li>"; }).join("") +
        '</ul><div class="top" style="margin-top:10px"><strong>' + money(o.total) + '</strong><select class="in" style="width:auto" data-st="' + o.id + '" aria-label="Статус">' + opts(o.status) + "</select></div></div>";
    }).join("") : '<p class="hint">Замовлень поки немає.</p>') + "</div>";
  }

  function render() {
    var fresh = orders.filter(function (o) { return o.status == "new"; }).length;
    app.innerHTML = '<div style="display:flex;gap:12px;align-items:center;padding:18px 0 0;flex-wrap:wrap"><h1 style="font-size:24px;margin-right:auto">Туман, адмінка</h1><a class="btn ghost sm" href="/" style="text-decoration:none">Відкрити магазин</a><button class="btn ghost sm" id="lo">Вийти</button></div>' +
      '<div class="tabs"><button data-tab="products" aria-selected="' + (tab == "products") + '">Товари</button><button data-tab="orders" aria-selected="' + (tab == "orders") + '">Замовлення' + (fresh ? " (нових: " + fresh + ")" : "") + "</button></div>" +
      (tab == "products" ? pform() + plist() : olist());
  }

  function saveProduct() {
    var err = $("#f-err"), btn = $("#pf button"), file = $("#f-img").files[0];
    err.textContent = ""; btn.disabled = true;
    var image = edit ? edit.image : "";
    var step = Promise.resolve();
    if (file) {
      var fd = new FormData(); fd.append("image", file);
      step = api("/api/admin/upload", { method: "POST", body: fd }).then(function (d) { image = d.url; });
    } else if ($("#f-rm") && $("#f-rm").checked) image = "";
    step.then(function () {
      var body = {
        name: $("#f-name").value, price: $("#f-price").value, type: $("#f-type").value, tag: $("#f-tag").value,
        hue: $("#f-hue").value, description: $("#f-desc").value, image: image, active: edit ? edit.active : 1
      };
      return edit ? api("/api/admin/products/" + edit.id, { method: "PUT", body: body }) : api("/api/admin/products", { method: "POST", body: body });
    }).then(function () { edit = null; return loadAll(); }).then(render)
      .catch(function (e) { err.textContent = e.message; btn.disabled = false; });
  }
  function find(id) { return prods.filter(function (p) { return p.id == id; })[0]; }
  function fail(e) { if (e.status == 401) loginView("Сесію завершено, увійдіть знову."); else alert(e.message); }

  document.addEventListener("submit", function (e) {
    e.preventDefault();
    if (e.target.id == "lf") {
      api("/api/admin/login", { method: "POST", body: { password: $("#pw").value } })
        .then(loadAll).then(render).catch(function (er) { loginView(er.message); });
    }
    if (e.target.id == "pf") saveProduct();
  });
  document.addEventListener("click", function (e) {
    var t = e.target, d = t.dataset || {}, p;
    if (d.tab) {
      tab = d.tab;
      loadAll().then(render).catch(fail);
    }
    if (d.edit) { edit = find(d.edit); render(); window.scrollTo(0, 0); }
    if (t.id == "f-cancel") { edit = null; render(); }
    if (d.vis) {
      p = find(d.vis);
      api("/api/admin/products/" + p.id, { method: "PUT", body: { name: p.name, type: p.type, hue: p.hue, price: p.price, description: p.description, tag: p.tag, image: p.image, active: p.active ? 0 : 1 } })
        .then(loadAll).then(render).catch(fail);
    }
    if (d.del && confirm("Видалити товар остаточно? Це не можна скасувати.")) {
      api("/api/admin/products/" + d.del, { method: "DELETE" }).then(function () { if (edit && edit.id == d.del) edit = null; return loadAll(); }).then(render).catch(fail);
    }
    if (t.id == "lo") api("/api/admin/logout", { method: "POST" }).then(function () { loginView(); });
  });
  document.addEventListener("change", function (e) {
    var d = e.target.dataset || {};
    if (d.st) api("/api/admin/orders/" + d.st, { method: "PATCH", body: { status: e.target.value } }).then(loadAll).then(render).catch(fail);
  });

  loadAll().then(render).catch(function (e) { if (e.status == 401) loginView(); else app.innerHTML = '<div class="box login"><p class="err">' + esc(e.message) + "</p></div>"; });
})();
