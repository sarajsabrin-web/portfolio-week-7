// Shared site behaviour
document.addEventListener("DOMContentLoaded", function () {
  // --- Mobile navigation toggle ---
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
    });
    // Close the menu after tapping a link
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") links.classList.remove("open");
    });
  }

  // --- Dark-mode toggle ---
  var themeBtn = document.getElementById("theme-toggle");
  if (themeBtn) {
    function syncThemeIcon() {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      themeBtn.textContent = dark ? "\u2600\uFE0F" : "\uD83C\uDF19"; // ☀️ / 🌙
      themeBtn.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      themeBtn.title = dark ? "Switch to light mode" : "Switch to dark mode";
    }
    syncThemeIcon();
    themeBtn.addEventListener("click", function () {
      var dark = document.documentElement.getAttribute("data-theme") === "dark";
      if (dark) {
        document.documentElement.removeAttribute("data-theme");
        localStorage.setItem("theme", "light");
      } else {
        document.documentElement.setAttribute("data-theme", "dark");
        localStorage.setItem("theme", "dark");
      }
      syncThemeIcon();
    });
  }

  // --- Current year in footer ---
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // --- Contact form (Supabase integration) ---
  var CONTACT_SUPABASE_URL = "https://zvueyktasnfxkyyztlsu.supabase.co";
  var CONTACT_SUPABASE_KEY = "sb_publishable_A0cOAvPrc9kWvI-kOCnMkQ_0gacP_Bx";
  var contactSupabase = null;
  if (window.supabase && typeof window.supabase.createClient === "function") {
    try {
      contactSupabase = window.supabase.createClient(CONTACT_SUPABASE_URL, CONTACT_SUPABASE_KEY);
    } catch (e) { console.error("Supabase init failed", e); }
  }

  var form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var submitBtn = form.querySelector('button[type="submit"]');
      var name = document.getElementById("cf-name").value.trim();
      var email = document.getElementById("cf-email").value.trim();
      var message = document.getElementById("cf-message").value.trim();
      var success = document.getElementById("form-success");

      if (!name || !email || !message) return;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }

      try {
        if (!contactSupabase) throw new Error("Supabase client not available");

        var { error } = await contactSupabase
          .from('contacts')
          .insert([{ name: name, email: email, message: message }]);

        if (error) throw error;

        if (success) {
          success.textContent = "Thanks, " + name + "! Your message has been sent successfully. I will respond within the next two days.";
          success.classList.remove("error");
          success.classList.add("show");
        }
        form.reset();
      } catch (err) {
        console.warn("Supabase insert failed:", err);
        if (success) {
          success.textContent = "Sorry, there was an error sending your message. Please try again.";
          success.classList.add("error");
          success.classList.add("show");
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Send message";
        }
      }
    });
  }

  // --- To-do app (projects page, backed by Supabase with localStorage fallback) ---
  var SUPABASE_URL = "https://mktflawgasfotcpbxzht.supabase.co";
  var SUPABASE_KEY = "sb_publishable_9LIBELYCh58-6FNXDCOOiw_4eFKHwl7";
  var STORAGE_KEY = "sabrin-todos-v1";
  var TABLE = "To-dos";

  var todoForm = document.getElementById("todo-form");
  var todoList = document.getElementById("todo-list");
  var todoEmpty = document.getElementById("todo-empty");
  var todoText = document.getElementById("todo-text");
  var todoDate = document.getElementById("todo-date");
  var todoAddBtn = document.getElementById("todo-add-btn");
  var todoStatus = document.getElementById("todo-status");

  var supabase = null;
  if (window.supabase && typeof window.supabase.createClient === "function") {
    try {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) { supabase = null; }
  }

  // --- Priority + emoji pickers ---
  var selectedPriority = "medium";
  var selectedEmoji = null;
  var priorityChips = document.querySelectorAll(".pri-chip");
  var emojiChips = document.querySelectorAll(".emoji-chip");
  priorityChips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      priorityChips.forEach(function (c) {
        c.classList.remove("is-selected");
        c.setAttribute("aria-checked", "false");
      });
      chip.classList.add("is-selected");
      chip.setAttribute("aria-checked", "true");
      selectedPriority = chip.dataset.priority;
    });
  });
  emojiChips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      emojiChips.forEach(function (c) {
        c.classList.remove("is-selected");
        c.setAttribute("aria-checked", "false");
      });
      chip.classList.add("is-selected");
      chip.setAttribute("aria-checked", "true");
      var val = chip.dataset.emoji;
      selectedEmoji = (val === "none") ? null : val;
    });
  });

  if (todoForm && todoList && todoText && todoDate) {
    function setStatus(msg, kind) {
      if (!todoStatus) return;
      todoStatus.textContent = msg || "";
      todoStatus.classList.remove("info", "error");
      if (!msg) return;
      if (kind === "error") todoStatus.classList.add("error");
      else if (kind === "info") todoStatus.classList.add("info");
    }

    function setBusy(busy) {
      if (!todoAddBtn) return;
      todoAddBtn.disabled = !!busy;
      todoAddBtn.textContent = busy ? "Saving…" : "Add";
    }

    function todayISO() {
      var d = new Date();
      return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
    }
    if (!todoDate.value) todoDate.value = todayISO();

    // ---------- LocalStorage fallback ----------
    function lsLoad() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
      catch (e) { return []; }
    }
    function lsSave(todos) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    }

    function formatDate(iso) {
      if (!iso) return "";
      var d = new Date(String(iso).slice(0, 10) + "T00:00:00");
      if (isNaN(d.getTime())) return iso;
      return d.toLocaleDateString(undefined, {
        weekday: "short", month: "short", day: "numeric"
      });
    }

    // ---------- Cloud-first data layer ----------
    async function fetchTodos() {
      if (!supabase) return { todos: lsLoad(), cloud: false };
      try {
        var { data, error } = await supabase
          .from(TABLE)
          .select("*")
          .order("created_at", { ascending: true });
        if (error) throw error;
        if (data && Array.isArray(data)) {
          return { todos: data.map(normalizeRow), cloud: true };
        }
        return { todos: [], cloud: true };
      } catch (err) {
        console.warn("[todo] Supabase read failed, falling back to localStorage:", err);
        return { todos: lsLoad(), cloud: false };
      }
    }

    function normalizeRow(r) {
      return {
        id: r.id,
        text: r.task || "",
        date: (r.date || "").slice ? r.date.slice(0, 10) : (r.date || ""),
        done: !!r.is_complete,
        priority: r.priority || "medium",
        emoji: r.emoji || null,
        created_at: r.created_at
      };
    }

    async function insertTodo(row) {
      if (supabase) {
        try {
          var payload = {
            task: row.text,
            date: row.date,
            is_complete: false,
            priority: row.priority || "medium"
          };
          if (row.emoji) payload.emoji = row.emoji;
          var { data, error } = await supabase.from(TABLE).insert([payload]).select();
          if (error) throw error;
          if (data && data[0]) return normalizeRow(data[0]);
        } catch (err) {
          console.warn("[todo] Supabase insert failed:", err);
        }
      }
      // Fallback
      var localId = "t_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      var local = {
        id: localId,
        text: row.text,
        date: row.date,
        done: false,
        priority: row.priority || "medium",
        emoji: row.emoji || null,
        created_at: new Date().toISOString()
      };
      var all = lsLoad();
      all.push(local);
      lsSave(all);
      return local;
    }

    async function updateDone(id, done) {
      if (supabase) {
        try {
          var { error } = await supabase.from(TABLE).update({ is_complete: done }).eq("id", id);
          if (error) throw error;
          return true;
        } catch (err) {
          console.warn("[todo] Supabase update failed:", err);
        }
      }
      var all = lsLoad();
      var item = all.find(function (x) { return x.id === id; });
      if (item) { item.done = done; lsSave(all); }
      return true;
    }

    async function updateText(id, text) {
      if (supabase) {
        try {
          var { error } = await supabase.from(TABLE).update({ task: text }).eq("id", id);
          if (error) throw error;
          return true;
        } catch (err) {
          console.warn("[todo] Supabase update failed:", err);
        }
      }
      var all = lsLoad();
      var item = all.find(function (x) { return x.id === id; });
      if (item) { item.text = text; lsSave(all); }
      return true;
    }

    async function deleteTodo(id) {
      if (supabase) {
        try {
          var { error } = await supabase.from(TABLE).delete().eq("id", id);
          if (error) throw error;
          return true;
        } catch (err) {
          console.warn("[todo] Supabase delete failed:", err);
        }
      }
      var all = lsLoad().filter(function (x) { return x.id !== id; });
      lsSave(all);
      return true;
    }

    // ---------- Rendering ----------
    var counterEl = document.getElementById("todo-counter");

    function renderCounter(todos) {
      if (!counterEl) return;
      var total = todos.length;
      var done = todos.filter(function (t) { return t.done; }).length;
      var pct = total === 0 ? 0 : Math.round((done / total) * 100);
      counterEl.innerHTML =
        '<span class="count-nums">' + done + ' of ' + total + '</span>' +
        '<span>tasks completed</span>' +
        '<div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + done + '">' +
          '<div class="progress-fill" style="width:' + pct + '%"></div>' +
        '</div>';
    }

    function renderList(todos) {
      todos = todos.slice().sort(function (a, b) {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (a.created_at || "").localeCompare(b.created_at || "");
      });

      todoList.innerHTML = "";
      if (todos.length === 0) {
        todoEmpty.classList.remove("hidden");
        renderCounter(todos);
        return;
      }
      renderCounter(todos);
      todoEmpty.classList.add("hidden");

      todos.forEach(function (t) {
        var li = document.createElement("li");
        li.className = "todo-item" + (t.done ? " done" : "");
        li.dataset.id = t.id;

        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "todo-checkbox";
        cb.checked = !!t.done;
        cb.setAttribute("aria-label", "Mark '" + t.text + "' as done");
        cb.addEventListener("change", async function () {
          var prev = li.classList.contains("done");
          li.classList.toggle("done");
          cb.checked = !prev;
          t.done = cb.checked;
          renderCounter(todos);
          await updateDone(t.id, cb.checked);
        });

        var body = document.createElement("div");
        body.className = "todo-body";

        var spanText = document.createElement("span");
        spanText.className = "todo-text";
        spanText.textContent = t.text;
        spanText.setAttribute("role", "button");
        spanText.setAttribute("tabindex", "0");
        spanText.setAttribute("aria-label", "Click to edit task: " + t.text);

        function enterEditMode() {
          if (li.classList.contains("editing")) return;
          li.classList.add("editing");
          var input = document.createElement("input");
          input.type = "text";
          input.className = "todo-text-input";
          input.value = t.text;
          input.maxLength = 120;

          function exitEdit(save) {
            var newVal = input.value.trim();
            if (save && newVal && newVal !== t.text) {
              t.text = newVal;
              spanText.textContent = newVal;
              spanText.setAttribute("aria-label", "Click to edit task: " + newVal);
              updateText(t.id, newVal);
            }
            li.classList.remove("editing");
            input.replaceWith(spanText);
          }

          input.addEventListener("keydown", function (e) {
            if (e.key === "Enter") { e.preventDefault(); exitEdit(true); }
            else if (e.key === "Escape") { e.preventDefault(); exitEdit(false); }
          });
          input.addEventListener("blur", function () { exitEdit(true); });

          spanText.replaceWith(input);
          input.focus();
          input.select();
        }

        spanText.addEventListener("click", enterEditMode);
        spanText.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enterEditMode(); }
        });

        body.appendChild(spanText);

        if (t.emoji) {
          var spanEmoji = document.createElement("span");
          spanEmoji.className = "todo-emoji-prefix";
          spanEmoji.textContent = t.emoji;
          body.insertBefore(spanEmoji, spanText);
        }

        if (t.date) {
          var spanDate = document.createElement("span");
          spanDate.className = "todo-date-badge";
          spanDate.textContent = formatDate(t.date);
          body.appendChild(spanDate);
        }

        if (t.priority && t.priority !== "medium") {
          var spanPri = document.createElement("span");
          spanPri.className = "todo-prio-badge " + t.priority;
          spanPri.textContent = t.priority;
          body.appendChild(spanPri);
        }

        var del = document.createElement("button");
        del.type = "button";
        del.className = "todo-delete";
        del.textContent = "×";
        del.setAttribute("aria-label", "Delete '" + t.text + "'");
        del.addEventListener("click", async function () {
          li.style.opacity = "0.45";
          await deleteTodo(t.id);
          await loadAndRender();
        });

        li.appendChild(cb);
        li.appendChild(body);
        li.appendChild(del);
        todoList.appendChild(li);
      });
    }

    var currentTodos = [];
    var cloudConnected = false;

    async function loadAndRender() {
      setStatus("Loading…", "info");
      setBusy(true);
      var result = await fetchTodos();
      currentTodos = result.todos;
      cloudConnected = result.cloud;
      renderList(currentTodos);
      setBusy(false);
      if (!supabase) {
        setStatus("Running in offline mode (Supabase SDK not loaded).", "info");
      } else if (!result.cloud) {
        setStatus("Offline — can't reach Supabase right now. Data saved locally until the connection is back.", "error");
      } else {
        setStatus("");
      }
    }

    // ---------- Submit ----------
    todoForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var text = todoText.value.trim();
      var date = todoDate.value;
      if (!text || !date) return;
      setBusy(true);
      var row = await insertTodo({
        text: text, date: date,
        priority: selectedPriority, emoji: selectedEmoji
      });
      todoText.value = "";
      todoText.focus();
      currentTodos.push(row);
      renderList(currentTodos);
      setBusy(false);
      if (!cloudConnected) {
        setStatus("Saved locally (can't reach Supabase). Will sync when reconnected.", "error");
      }
    });

    // Initial load
    loadAndRender();
  }

  // --- Weather app (projects page, Open-Meteo API) ---
  var weatherForm = document.getElementById("weather-form");
  var weatherCity = document.getElementById("weather-city");
  var weatherStatus = document.getElementById("weather-status");
  var weatherResult = document.getElementById("weather-result");
  var weatherIcon = document.getElementById("weather-icon");
  var weatherCityName = document.getElementById("weather-city-name");
  var weatherTemp = document.getElementById("weather-temp");
  var weatherCondition = document.getElementById("weather-condition");
  var weatherSearchBtn = document.getElementById("weather-search-btn");
  var weatherForecast = document.getElementById("weather-forecast");

  var GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
  var FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

  // WMO weather interpretation codes -> { icon, text }
  function describeWeather(code) {
    var c = Number(code);
    if (c === 0) return { icon: "☀️", text: "Clear sky" };
    if (c === 1) return { icon: "🌤️", text: "Mainly clear" };
    if (c === 2) return { icon: "⛅", text: "Partly cloudy" };
    if (c === 3) return { icon: "☁️", text: "Overcast" };
    if (c === 45 || c === 48) return { icon: "🌫️", text: "Fog" };
    if (c >= 51 && c <= 57) return { icon: "🌦️", text: "Drizzle" };
    if (c >= 56 && c <= 57) return { icon: "🌧️", text: "Freezing drizzle" };
    if (c >= 61 && c <= 65) return { icon: "🌧️", text: "Rain" };
    if (c >= 66 && c <= 67) return { icon: "🌧️", text: "Freezing rain" };
    if (c >= 71 && c <= 77) return { icon: "🌨️", text: "Snow" };
    if (c >= 80 && c <= 82) return { icon: "🌦️", text: "Rain showers" };
    if (c >= 85 && c <= 86) return { icon: "🌨️", text: "Snow showers" };
    if (c >= 95 && c <= 99) return { icon: "⛈️", text: "Thunderstorm" };
    return { icon: "🌡️", text: "Weather" };
  }

  if (weatherForm && weatherCity) {
    function setWeatherStatus(msg, kind) {
      weatherStatus.textContent = msg || "";
      weatherStatus.classList.remove("info", "error");
      if (!msg) return;
      if (kind === "error") weatherStatus.classList.add("error");
      else weatherStatus.classList.add("info");
    }
    function setWeatherBusy(busy) {
      if (!weatherSearchBtn) return;
      weatherSearchBtn.disabled = !!busy;
      weatherSearchBtn.textContent = busy ? "Searching…" : "Search";
    }
    var selectedUnit = "c";     // "c" = Celsius, "f" = Fahrenheit
    var lastTempC = null;       // last Celsius reading from the API
    var lastDaily = null;       // last 3-day forecast (Celsius max/min) from the API

    function formatTemp(c) {
      if (c === null || c === undefined || isNaN(c)) return "—";
      if (selectedUnit === "f") return Math.round(c * 9 / 5 + 32) + "°F";
      return Math.round(c) + "°C";
    }
    function renderTemp() {
      if (weatherTemp) weatherTemp.textContent = formatTemp(lastTempC);
    }

    // Label for a forecast day: "Today", "Tomorrow", or a weekday name
    function dayLabel(dateStr, idx) {
      if (idx === 0) return "Today";
      if (idx === 1) return "Tomorrow";
      var d = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString(undefined, { weekday: "short" });
      }
      return dateStr;
    }

    function renderForecast() {
      if (!weatherForecast) return;
      if (!lastDaily || !lastDaily.length) {
        weatherForecast.hidden = true;
        weatherForecast.innerHTML = "";
        return;
      }
      weatherForecast.innerHTML = "";
      lastDaily.forEach(function (day, i) {
        var w = describeWeather(day.code);
        var card = document.createElement("div");
        card.className = "forecast-day";
        card.innerHTML =
          '<span class="forecast-day-name">' + dayLabel(day.date, i) + '</span>' +
          '<span class="forecast-day-icon" aria-hidden="true">' + w.icon + '</span>' +
          '<span class="forecast-day-temps">' +
            '<span class="forecast-high">' + formatTemp(day.max) + '</span>' +
            '<span class="forecast-low">' + formatTemp(day.min) + '</span>' +
          '</span>';
        weatherForecast.appendChild(card);
      });
      weatherForecast.hidden = false;
    }

    function showResult(icon, name, tempC, condition, daily) {
      weatherIcon.textContent = icon;
      weatherCityName.textContent = name;
      lastTempC = tempC;
      renderTemp();
      weatherCondition.textContent = condition;
      weatherResult.hidden = false;
      lastDaily = daily || null;
      renderForecast();
    }
    function clearResult() {
      weatherResult.hidden = true;
      lastTempC = null;
      lastDaily = null;
      renderForecast();
    }

    // Unit toggle — switches the display only, no extra API call
    var unitChips = document.querySelectorAll(".unit-chip");
    unitChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        unitChips.forEach(function (c) {
          c.classList.remove("is-selected");
          c.setAttribute("aria-pressed", "false");
        });
        chip.classList.add("is-selected");
        chip.setAttribute("aria-pressed", "true");
        selectedUnit = chip.dataset.unit;
        renderTemp();
        renderForecast();
      });
    });

    weatherForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      var city = weatherCity.value.trim();

      // Empty input -> don't call the API
      if (!city) {
        clearResult();
        setWeatherStatus("Enter a city first.", "info");
        weatherCity.focus();
        return;
      }

      setWeatherBusy(true);
      setWeatherStatus("Loading…", "info");
      clearResult();

      try {
        // 1) Geocode the city name -> latitude/longitude
        var geoRes = await fetch(GEOCODE_URL + "?name=" + encodeURIComponent(city) + "&count=1&language=en&format=json");
        if (!geoRes.ok) throw new Error("geocode");
        var geo = await geoRes.json();
        if (!geo.results || !geo.results.length) {
          throw { code: "NOT_FOUND" };
        }
        var loc = geo.results[0];

        // 2) Fetch current weather + 3-day forecast for those coordinates
        var q = "?latitude=" + loc.latitude + "&longitude=" + loc.longitude +
          "&current=temperature_2m,weather_code" +
          "&daily=weather_code,temperature_2m_max,temperature_2m_min&forecast_days=3&timezone=auto";
        var wxRes = await fetch(FORECAST_URL + q);
        if (!wxRes.ok) throw new Error("forecast");
        var wx = await wxRes.json();
        if (!wx.current) throw new Error("forecast");

        var tempC = wx.current.temperature_2m;
        var code = wx.current.weather_code;
        var w = describeWeather(code);
        var placeName = loc.name + (loc.country ? ", " + loc.country : "");

        // Build the 3-day forecast array from the daily response (Celsius)
        var daily = null;
        if (wx.daily && wx.daily.time && wx.daily.time.length) {
          daily = wx.daily.time.map(function (d, i) {
            return {
              date: d,
              code: wx.daily.weather_code ? wx.daily.weather_code[i] : 0,
              max: wx.daily.temperature_2m_max ? wx.daily.temperature_2m_max[i] : null,
              min: wx.daily.temperature_2m_min ? wx.daily.temperature_2m_min[i] : null
            };
          });
        }

        showResult(w.icon, placeName, tempC, w.text, daily);
        setWeatherStatus("");
      } catch (err) {
        if (err && err.code === "NOT_FOUND") {
          setWeatherStatus("Couldn't find that city — check the spelling.", "error");
        } else {
          console.warn("[weather] request failed:", err);
          setWeatherStatus("Couldn't load weather right now — try again in a moment.", "error");
        }
        clearResult();
      } finally {
        setWeatherBusy(false);
      }
    });
  }
});
