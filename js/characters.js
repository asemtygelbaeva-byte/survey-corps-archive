"use strict";

/*
 * Character database: loads Attack on Titan characters from public APIs with fetch().
 * Two sources are requested at the same time and the first valid answer is used:
 *   1. Jikan (unofficial MyAnimeList API)  GET https://api.jikan.moe/v4/anime/16498/characters
 *   2. AniList GraphQL API                 POST https://graphql.anilist.co
 * Both return JSON, which is converted to one common shape by normalizeJikan / normalizeAniList.
 */
(function () {
  const JIKAN_URL = "https://api.jikan.moe/v4/anime/16498/characters";
  const ANILIST_URL = "https://graphql.anilist.co";
  const ANILIST_QUERY = "query { Media(idMal: 16498, type: ANIME) { characters(sort: FAVOURITES_DESC, perPage: 50) { edges { role node { id name { full } image { large } siteUrl favourites } voiceActors { name { full } languageV2 } } } } }";
  const CACHE_KEY = "sca-characters-cache";
  const CACHE_MS = 10 * 60 * 1000; // reuse a saved response for 10 minutes
  const TIMEOUT_MS = 20000; // each source gets 20 seconds
  const PAGE_SIZE = 24;

  const store = window.SCA.store;
  const grid = $("#char-grid");
  const dialog = document.querySelector("#char-dialog");

  let characters = [];
  let updatedAt = 0;
  let loading = false;
  let role = "all";
  let query = "";
  let sortBy = "favorites";
  let visible = PAGE_SIZE;
  let openId = null;
  let offline = false; // true while the built-in backup list is shown
  let slowTimer = null;
  let sourceName = "";

  /* ----- Errors ----- */
  function ApiError(kind, status) {
    this.kind = kind;
    this.status = status || 0;
  }
  function describe(error) {
    switch (error.kind) {
      case "rate": return "The API is receiving too many requests right now. Wait a few seconds and try again.";
      case "server": return "The character service is temporarily unavailable (error " + error.status + "). Please try again later.";
      case "http": return "The API could not answer this request (error " + error.status + ").";
      case "timeout": return "The API took too long to respond. Check your connection and try again.";
      case "data": return "The API sent data in an unexpected format, so it cannot be shown.";
      case "empty": return "The API returned no characters.";
      default: return "Could not reach the API. Check your internet connection and try again.";
    }
  }
  function wait(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function retryDelay(response, attempt) {
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      const retryAt = seconds > 0 ? Date.now() + seconds * 1000 : Date.parse(retryAfter);
      if (Number.isFinite(retryAt) && retryAt > Date.now()) {
        return Math.min(retryAt - Date.now(), 15000);
      }
    }
    return response.status === 429 ? 3000 * (attempt + 1) : 1500 * (attempt + 1);
  }

  /* ----- fetch() with timeout and one backoff retry ----- */
  async function requestJson(url, init) {
    let lastError = new ApiError("network");
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);
      let delay = 0;
      try {
        const options = Object.assign({}, init, { signal: controller.signal });
        options.headers = Object.assign({ Accept: "application/json" }, init && init.headers);
        const response = await fetch(url, options);
        if (response.status === 429 || response.status >= 500) {
          lastError = new ApiError(response.status === 429 ? "rate" : "server", response.status);
          delay = retryDelay(response, attempt);
        } else if (!response.ok) {
          throw new ApiError("http", response.status);
        } else {
          return await response.json();
        }
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (error instanceof SyntaxError) throw new ApiError("data");
        lastError = new ApiError(error && error.name === "AbortError" ? "timeout" : "network");
      } finally {
        clearTimeout(timer);
      }
      if (attempt === 0 && lastError.kind !== "timeout") await wait(delay || 1500);
      else if (lastError.kind === "timeout") break;
    }
    throw lastError;
  }

  /* ----- Process the JSON ----- */
  function formatName(name) {
    const parts = String(name).split(",");
    return parts.length === 2 ? parts[1].trim() + " " + parts[0].trim() : String(name).trim();
  }
  function safeUrl(value, host) {
    try {
      const url = new URL(value);
      const domainMatches = url.hostname === host || url.hostname.endsWith("." + host);
      return url.protocol === "https:" && domainMatches ? url.href : "";
    } catch (error) { return ""; }
  }
  function nameKey(name) { return String(name).toLowerCase().replace(/\s+/g, " ").trim(); }
  function unique(items) {
    const seen = Object.create(null);
    return items.filter(function (item) {
      if (seen[item.key]) return false;
      seen[item.key] = true;
      return true;
    });
  }
  function pickVoices(list, nameOf, languageOf) {
    return (Array.isArray(list) ? list : []).filter(function (v) {
      return nameOf(v) && (languageOf(v) === "Japanese" || languageOf(v) === "English");
    }).map(function (v) { return { name: formatName(nameOf(v)), language: languageOf(v) }; });
  }
  // Jikan: { data: [ { character: { mal_id, name, images, url }, role, favorites, voice_actors } ] }
  function normalizeJikan(json) {
    if (!json || !Array.isArray(json.data)) throw new ApiError("data");
    return unique(json.data.map(function (item) {
      const c = item && item.character;
      if (!c || !c.name) return null;
      const images = c.images || {};
      const image = (images.jpg && images.jpg.image_url) || (images.webp && images.webp.image_url) || "";
      const name = formatName(c.name);
      return {
        key: nameKey(name),
        name: name,
        role: item.role === "Main" ? "Main" : "Supporting",
        favorites: Number(item.favorites) || 0,
        image: safeUrl(image, "myanimelist.net"),
        url: safeUrl(c.url, "myanimelist.net"),
        voices: pickVoices(item.voice_actors,
          function (v) { return v && v.person && v.person.name; },
          function (v) { return v.language; })
      };
    }).filter(Boolean));
  }
  // AniList: { data: { Media: { characters: { edges: [ { role, node, voiceActors } ] } } } }
  function normalizeAniList(json) {
    if (json && json.errors) throw new ApiError("data");
    const edges = json && json.data && json.data.Media && json.data.Media.characters && json.data.Media.characters.edges;
    if (!Array.isArray(edges)) throw new ApiError("data");
    return unique(edges.map(function (edge) {
      const node = edge && edge.node;
      if (!node || !node.name || !node.name.full) return null;
      const name = formatName(node.name.full);
      return {
        key: nameKey(name),
        name: name,
        role: edge.role === "MAIN" ? "Main" : "Supporting",
        favorites: Number(node.favourites) || 0,
        image: safeUrl(node.image && node.image.large, "anilist.co"),
        url: safeUrl(node.siteUrl, "anilist.co"),
        voices: pickVoices(edge.voiceActors,
          function (v) { return v && v.name && v.name.full; },
          function (v) { return v.languageV2; })
      };
    }).filter(Boolean));
  }
  function fromJikan() {
    return requestJson(JIKAN_URL).then(function (json) { return { source: "Jikan", items: normalizeJikan(json) }; });
  }
  function fromAniList() {
    return requestJson(ANILIST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: ANILIST_QUERY })
    }).then(function (json) { return { source: "AniList", items: normalizeAniList(json) }; });
  }
  // Ask both APIs at once. The first one with a non-empty list wins; if both fail, report Jikan's error.
  function fetchFirst() {
    const attempts = [fromJikan(), fromAniList()];
    return new Promise(function (resolve, reject) {
      const errors = [];
      let left = attempts.length;
      attempts.forEach(function (attempt, index) {
        attempt.then(function (result) {
          if (!result.items.length) throw new ApiError("empty");
          resolve(result);
        }).catch(function (error) {
          errors[index] = error instanceof ApiError ? error : new ApiError("network");
          left--;
          if (left === 0) reject(errors[0]);
        });
      });
    });
  }

  /* ----- Cache (also used as a fallback when the API is down) ----- */
  function readCache() {
    try {
      const saved = JSON.parse(store.get(CACHE_KEY));
      if (!saved || saved.version !== 2 || !Number.isFinite(saved.time) || saved.time <= 0) return null;
      if (!Array.isArray(saved.items) || !saved.items.length) return null;
      const valid = saved.items.every(function (item) {
        return item && typeof item.key === "string" && typeof item.name === "string" &&
          typeof item.role === "string" && Number.isFinite(item.favorites) &&
          typeof item.image === "string" && typeof item.url === "string" &&
          Array.isArray(item.voices) && item.voices.every(function (voice) {
            return voice && typeof voice.name === "string" && typeof voice.language === "string";
          });
      });
      if (valid) return saved;
    } catch (error) { /* no usable cache */ }
    return null;
  }

  /* ----- Loading ----- */
  async function load(force) {
    if (loading) return;
    loading = true;
    $("#char-refresh, #char-retry").prop("disabled", true);
    $("#char-error, #char-notice").prop("hidden", true);
    const cached = readCache();
    clearTimeout(slowTimer);
    try {
      if (!force && cached && Date.now() - cached.time < CACHE_MS) {
        characters = cached.items;
        updatedAt = cached.time;
        sourceName = cached.source || "";
      } else {
        showSkeleton();
        slowTimer = setTimeout(function () {
          $("#char-status").text("Still loading… the API can be slow. Please wait a little longer.");
        }, 6000);
        const result = await fetchFirst();
        characters = result.items;
        offline = false;
        sourceName = result.source;
        updatedAt = Date.now();
        store.set(CACHE_KEY, JSON.stringify({ version: 2, time: updatedAt, source: sourceName, items: characters }));
      }
      render();
    } catch (error) {
      if (cached) {
        characters = cached.items;
        offline = false;
        sourceName = cached.source || "";
        updatedAt = cached.time;
        $("#char-notice").text(describe(error) + " Showing the data saved on " + new Date(updatedAt).toLocaleString() + ".").prop("hidden", false);
        render();
      } else {
        // Nothing saved: show the error and a short built-in list so the page is still usable
        $("#char-error-text").text(describe(error));
        $("#char-error").prop("hidden", false);
        if (Array.isArray(window.SCA_FALLBACK) && window.SCA_FALLBACK.length) {
          characters = window.SCA_FALLBACK;
          offline = true;
          updatedAt = 0;
          $("#char-notice").text("Showing a short offline list (names and roles only). Use “Try again” to load live data.").prop("hidden", false);
          render();
        } else {
          characters = [];
          grid.empty().attr("aria-busy", "false");
          $("#char-more, #char-empty").prop("hidden", true);
          $("#char-status").text("Characters could not be loaded.");
          $("#char-random").prop("disabled", true);
        }
      }
    } finally {
      clearTimeout(slowTimer);
      loading = false;
      $("#char-refresh, #char-retry").prop("disabled", false);
    }
  }
  function showSkeleton() {
    grid.empty().attr("aria-busy", "true");
    for (let i = 0; i < 8; i++) grid.append($("<div>").addClass("char-skeleton").attr("aria-hidden", "true"));
    $("#char-status").text("Loading characters…");
    $("#char-more, #char-empty").prop("hidden", true);
  }

  /* ----- Filter, sort, show ----- */
  function filtered() {
    const favorites = window.SCA.getFavorites();
    const text = query.trim().toLowerCase();
    return characters.filter(function (c) {
      if (role === "favorites") { if (favorites.indexOf(c.key) === -1) return false; }
      else if (role !== "all" && c.role !== role) return false;
      if (!text) return true;
      return (c.name + " " + c.voices.map(function (v) { return v.name; }).join(" ")).toLowerCase().indexOf(text) !== -1;
    }).sort(function (a, b) {
      return sortBy === "name" ? a.name.localeCompare(b.name) : b.favorites - a.favorites;
    });
  }
  function render() {
    const list = filtered();
    const favorites = window.SCA.getFavorites();
    const signedIn = !!window.SCA.getUser();
    grid.empty().attr("aria-busy", "false");
    list.slice(0, visible).forEach(function (c) {
      const card = $("<article>").addClass("char-card");
      const open = $("<button>").attr({ type: "button", "aria-label": "Open profile of " + c.name }).addClass("char-open").attr("data-key", c.key);
      const photo = $("<span>").addClass("char-photo").css("display", "block");
      photo.append($("<img>").attr({ src: c.image || "assets/crest.svg", alt: "", loading: "lazy", width: 225, height: 350 })
        .on("error", function () { $(this).off("error").attr("src", "assets/crest.svg"); }));
      const info = $("<span>").addClass("char-info");
      info.append($("<span>").addClass("char-name").text(c.name));
      info.append($("<span>").addClass("char-sub").text(offline ? c.role : c.role + " · ♥ " + c.favorites.toLocaleString()));
      card.append(open.append(photo, info));
      if (signedIn) {
        const on = favorites.indexOf(c.key) !== -1;
        card.append($("<button>").attr({ type: "button", "aria-pressed": on, "aria-label": (on ? "Remove " : "Add ") + c.name + (on ? " from favourites" : " to favourites") })
          .addClass("fav-btn").attr("data-key", c.key).text(on ? "★" : "☆"));
      }
      grid.append(card);
    });
    $("#char-more").prop("hidden", list.length <= visible);
    $("#char-empty").prop("hidden", list.length !== 0);
    $("#char-random").prop("disabled", list.length === 0);
    const time = updatedAt ? " · Updated " + new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + (sourceName ? " · Source: " + sourceName : "") : "";
    $("#char-status").text("Showing " + Math.min(visible, list.length) + " of " + list.length + " characters" + (offline ? " · Offline list" : time));
  }

  /* ----- Profile dialog ----- */
  function openProfile(key) {
    const c = characters.find(function (item) { return item.key === key; });
    if (!c) return;
    openId = key;
    $("#char-dialog-img").attr({ src: c.image || "assets/crest.svg", alt: c.name })
      .off("error").on("error", function () { $(this).off("error").attr("src", "assets/crest.svg"); });
    $("#char-dialog-name").text(c.name);
    $("#char-dialog-meta").text(offline ? c.role + " character" : c.role + " character · ♥ " + c.favorites.toLocaleString() + " favourites");
    const voices = $("#char-dialog-voices").empty();
    if (!c.voices.length) voices.append($("<li>").text(offline ? "Voice actors load with live data." : "No voice actors listed."));
    c.voices.forEach(function (v) { voices.append($("<li>").text(v.name + " ").append($("<span>").text("(" + v.language + ")"))); });
    $("#char-dialog-link").attr("href", c.url || "#").prop("hidden", !c.url);
    syncDialogFavorite();
    dialog.showModal();
  }
  function syncDialogFavorite() {
    const on = window.SCA.getFavorites().indexOf(openId) !== -1;
    $("#char-dialog-fav").attr("aria-pressed", on).text(on ? "★ In your favourites" : "☆ Add to favourites");
  }
  function toggleFavorite(key) {
    if (!window.SCA.getUser()) return;
    const list = window.SCA.getFavorites();
    const index = list.indexOf(key);
    if (index === -1) list.push(key); else list.splice(index, 1);
    window.SCA.setFavorites(list);
    render();
    syncDialogFavorite();
  }

  /* ----- User interaction ----- */
  grid.on("click", ".char-open", function () { openProfile($(this).attr("data-key")); });
  grid.on("click", ".fav-btn", function () {
    const key = $(this).attr("data-key");
    toggleFavorite(key);
    grid.find(".fav-btn").filter(function () { return $(this).attr("data-key") === key; }).trigger("focus");
  });
  $("#char-search").on("input", function () { query = this.value; visible = PAGE_SIZE; render(); });
  $("#char-sort").on("change", function () { sortBy = this.value; render(); });
  $("[data-role]").on("click", function () {
    role = $(this).data("role");
    visible = PAGE_SIZE;
    $("[data-role]").removeClass("active").attr("aria-pressed", false);
    $(this).addClass("active").attr("aria-pressed", true);
    render();
  });
  $("#char-more").on("click", function () { visible += PAGE_SIZE; render(); });
  $("#char-refresh").on("click", function () { load(true); });
  $("#char-retry").on("click", function () { load(true); });
  $("#char-random").on("click", function () {
    const list = filtered();
    if (list.length) openProfile(list[Math.floor(Math.random() * list.length)].key);
  });
  $("#char-close").on("click", function () { dialog.close(); });
  $("#char-dialog-fav").on("click", function () { toggleFavorite(openId); });
  $(dialog).on("click", function (event) {
    if (event.target === dialog) dialog.close();
  });
  // Signing in or out changes what can be shown (favourites)
  $(document).on("sca:auth", function () {
    if (!window.SCA.getUser() && role === "favorites") {
      role = "all";
      $("[data-role]").removeClass("active").attr("aria-pressed", false);
      $("[data-role='all']").addClass("active").attr("aria-pressed", true);
    }
    if (characters.length) render();
  });

  load(false);
})();
