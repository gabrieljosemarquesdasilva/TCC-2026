/* =====================================================================
   ACESSIBILIDADE — Beach Tennis ETEC
   Widget de acessibilidade para pessoas com deficiência (PCD).
   Basta incluir <script src="acessibilidade.js"></script> antes do
   fechamento do </body> em qualquer página do site.
   Recursos:
     - Aumentar / diminuir / redefinir tamanho da fonte
     - Alto contraste
     - Destacar links (sublinhado)
     - Fonte para leitura facilitada (dislexia)
     - Pausar animações e efeitos de movimento
     - Modo escala de cinza (baixa visão / daltonismo)
     - Cursor ampliado
     - Leitor de texto em voz alta (TTS / Web Speech API)
     - Modo "toque no texto para ouvir" (lê só o trecho clicado)
     - Widget VLibras (tradução em Língua Brasileira de Sinais)
   As preferências ficam salvas no navegador (localStorage) e valem
   para todas as páginas do site.
===================================================================== */
(function () {
  "use strict";

  var STORAGE_KEY = "beachtennis-acessibilidade";
  var FONT_STEPS = [1, 1.1, 1.2, 1.3]; // multiplicadores de fonte
  var root = document.documentElement;

  var estadoPadrao = {
    fonteIndex: 0,
    contraste: false,
    links: false,
    leitura: false,
    semAnimacao: false,
    cinza: false,
    cursorGrande: false
  };

  function carregarEstado() {
    try {
      var salvo = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Object.assign({}, estadoPadrao, salvo || {});
    } catch (e) {
      return Object.assign({}, estadoPadrao);
    }
  }

  function salvarEstado(estado) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
    } catch (e) { /* ignora se localStorage indisponível */ }
  }

  var estado = carregarEstado();

  /* ---------- Leitor de voz (TTS) ---------- */
  var falando = false;
  var pausado = false;
  var TTS_SUPORTADO = "speechSynthesis" in window;

  function pegarTextoPrincipal() {
    var alvo = document.querySelector("main") || document.body;
    // Ignora o próprio widget de acessibilidade e o widget do VLibras
    var clone = alvo.cloneNode(true);
    clone.querySelectorAll(".acc-widget, [vw]").forEach(function (el) { el.remove(); });
    var texto = clone.textContent || "";
    return texto.replace(/\s+/g, " ").trim();
  }

  function escolherVozPtBr() {
    var vozes = window.speechSynthesis.getVoices();
    return vozes.find(function (v) { return v.lang === "pt-BR"; }) ||
           vozes.find(function (v) { return v.lang && v.lang.indexOf("pt") === 0; }) ||
           null;
  }

  function pararLeitura() {
    if (!TTS_SUPORTADO) return;
    window.speechSynthesis.cancel();
    falando = false;
    pausado = false;
    atualizarBotaoLeitor();
  }

  function alternarPausaLeitura() {
    if (!TTS_SUPORTADO || !falando) return;
    if (pausado) {
      window.speechSynthesis.resume();
      pausado = false;
    } else {
      window.speechSynthesis.pause();
      pausado = true;
    }
    atualizarBotaoLeitor();
  }

  function iniciarLeitura() {
    if (!TTS_SUPORTADO) {
      alert("Seu navegador não é compatível com o leitor de voz.");
      return;
    }
    window.speechSynthesis.cancel();
    var texto = pegarTextoPrincipal();
    if (!texto) return;
    var utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "pt-BR";
    var voz = escolherVozPtBr();
    if (voz) utterance.voice = voz;
    utterance.rate = 1;
    utterance.onend = function () {
      falando = false;
      pausado = false;
      atualizarBotaoLeitor();
    };
    utterance.onerror = function () {
      falando = false;
      pausado = false;
      atualizarBotaoLeitor();
    };
    window.speechSynthesis.speak(utterance);
    falando = true;
    pausado = false;
    atualizarBotaoLeitor();
  }

  function atualizarBotaoLeitor() {
    var btn = document.getElementById("acc-toggle-leitor-voz");
    var btnPausa = document.getElementById("acc-leitor-pausar");
    if (btn) {
      btn.classList.toggle("acc-ativo", falando);
      btn.setAttribute("aria-pressed", falando ? "true" : "false");
      var label = btn.querySelector(".acc-leitor-label");
      if (label) label.textContent = falando ? "Parar leitura" : "Ouvir página";
    }
    if (btnPausa) {
      btnPausa.hidden = !falando;
      btnPausa.textContent = pausado ? "Continuar" : "Pausar";
    }
  }

  /* ---------- Modo "toque no texto para ouvir" ---------- */
  var modoToqueAtivo = false;
  // Elementos considerados "texto clicável" nesse modo
  var SELETOR_TEXTO = "p, span, li, a, button, h1, h2, h3, h4, h5, h6, label, td, th, figcaption, strong, em, small, blockquote";

  function falarTexto(texto) {
    if (!TTS_SUPORTADO || !texto) return;
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = "pt-BR";
    var voz = escolherVozPtBr();
    if (voz) utterance.voice = voz;
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  function pegarTextoDoClique(alvo) {
    // Sobe até achar um elemento "de texto" reconhecido, sem passar do <main>/<body>
    var el = alvo;
    while (el && el !== document.body) {
      if (el.matches && el.matches(SELETOR_TEXTO)) {
        return (el.textContent || "").replace(/\s+/g, " ").trim();
      }
      el = el.parentElement;
    }
    return "";
  }

  function aoClicarNoTexto(e) {
    // Ignora cliques dentro do próprio widget de acessibilidade e do VLibras
    if (e.target.closest(".acc-widget") || e.target.closest("[vw]")) return;
    var texto = pegarTextoDoClique(e.target);
    if (!texto) return;
    e.preventDefault();
    e.stopPropagation();
    falarTexto(texto);
  }

  function ativarModoToque() {
    if (!TTS_SUPORTADO) {
      alert("Seu navegador não é compatível com o leitor de voz.");
      return;
    }
    modoToqueAtivo = true;
    root.classList.add("acc-modo-toque");
    document.addEventListener("click", aoClicarNoTexto, true);
    atualizarBotaoModoToque();
  }

  function desativarModoToque() {
    modoToqueAtivo = false;
    root.classList.remove("acc-modo-toque");
    document.removeEventListener("click", aoClicarNoTexto, true);
    if (TTS_SUPORTADO) window.speechSynthesis.cancel();
    atualizarBotaoModoToque();
  }

  function atualizarBotaoModoToque() {
    var btn = document.getElementById("acc-toggle-modo-toque");
    if (btn) {
      btn.classList.toggle("acc-ativo", modoToqueAtivo);
      btn.setAttribute("aria-pressed", modoToqueAtivo ? "true" : "false");
      var label = btn.querySelector(".acc-toque-label");
      if (label) label.textContent = modoToqueAtivo ? "Desativar toque para ouvir" : "Toque no texto para ouvir";
    }
  }

  function aplicarEstado() {
    root.style.fontSize = (16 * FONT_STEPS[estado.fonteIndex]) + "px";
    root.classList.toggle("acc-contraste", estado.contraste);
    root.classList.toggle("acc-links", estado.links);
    root.classList.toggle("acc-leitura", estado.leitura);
    root.classList.toggle("acc-sem-animacao", estado.semAnimacao);
    root.classList.toggle("acc-cinza", estado.cinza);
    root.classList.toggle("acc-cursor-grande", estado.cursorGrande);
    atualizarBotoesAtivos();
  }

  function atualizarBotoesAtivos() {
    var mapa = {
      "acc-toggle-contraste": estado.contraste,
      "acc-toggle-links": estado.links,
      "acc-toggle-leitura": estado.leitura,
      "acc-toggle-animacao": estado.semAnimacao,
      "acc-toggle-cinza": estado.cinza,
      "acc-toggle-cursor": estado.cursorGrande
    };
    Object.keys(mapa).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) {
        el.classList.toggle("acc-ativo", mapa[id]);
        el.setAttribute("aria-pressed", mapa[id] ? "true" : "false");
      }
    });
    var fonteLabel = document.getElementById("acc-fonte-nivel");
    if (fonteLabel) fonteLabel.textContent = Math.round(FONT_STEPS[estado.fonteIndex] * 100) + "%";
  }

  /* ---------- Construção do HTML do widget ---------- */
  function criarWidget() {
    var wrapper = document.createElement("div");
    wrapper.className = "acc-widget";
    wrapper.innerHTML =
      '<button type="button" id="acc-abrir" class="acc-btn-flutuante" aria-haspopup="true" aria-expanded="false" aria-controls="acc-painel" aria-label="Abrir opções de acessibilidade">' +
        '<i class="fa-solid fa-universal-access" aria-hidden="true"></i>' +
      '</button>' +
      '<div id="acc-painel" class="acc-painel" role="dialog" aria-modal="false" aria-label="Opções de acessibilidade" hidden>' +
        '<div class="acc-painel-header">' +
          '<span><i class="fa-solid fa-universal-access" aria-hidden="true"></i> Acessibilidade</span>' +
          '<button type="button" id="acc-fechar" class="acc-fechar" aria-label="Fechar painel de acessibilidade">&times;</button>' +
        '</div>' +
        '<div class="acc-painel-body">' +
          '<div class="acc-linha acc-fonte-controle">' +
            '<span class="acc-label"><i class="fa-solid fa-text-height" aria-hidden="true"></i> Tamanho do texto</span>' +
            '<div class="acc-fonte-botoes">' +
              '<button type="button" id="acc-fonte-menos" aria-label="Diminuir tamanho do texto">A-</button>' +
              '<span id="acc-fonte-nivel" aria-live="polite">100%</span>' +
              '<button type="button" id="acc-fonte-mais" aria-label="Aumentar tamanho do texto">A+</button>' +
            '</div>' +
          '</div>' +
          '<div class="acc-linha acc-leitor-controle">' +
            '<button type="button" id="acc-toggle-leitor-voz" class="acc-opcao" aria-pressed="false">' +
              '<i class="fa-solid fa-volume-high" aria-hidden="true"></i> <span class="acc-leitor-label">Ouvir página</span>' +
            '</button>' +
            '<button type="button" id="acc-leitor-pausar" class="acc-opcao acc-leitor-pausar" hidden>Pausar</button>' +
          '</div>' +
          '<button type="button" id="acc-toggle-modo-toque" class="acc-opcao" aria-pressed="false">' +
            '<i class="fa-solid fa-hand-pointer" aria-hidden="true"></i> <span class="acc-toque-label">Toque no texto para ouvir</span>' +
          '</button>' +
          '<button type="button" id="acc-toggle-contraste" class="acc-opcao" aria-pressed="false">' +
            '<i class="fa-solid fa-circle-half-stroke" aria-hidden="true"></i> Alto contraste' +
          '</button>' +
          '<button type="button" id="acc-toggle-links" class="acc-opcao" aria-pressed="false">' +
            '<i class="fa-solid fa-link" aria-hidden="true"></i> Destacar links' +
          '</button>' +
          '<button type="button" id="acc-toggle-leitura" class="acc-opcao" aria-pressed="false">' +
            '<i class="fa-solid fa-book-open-reader" aria-hidden="true"></i> Fonte de leitura fácil' +
          '</button>' +
          '<button type="button" id="acc-toggle-animacao" class="acc-opcao" aria-pressed="false">' +
            '<i class="fa-solid fa-hand" aria-hidden="true"></i> Pausar animações' +
          '</button>' +
          '<button type="button" id="acc-toggle-cinza" class="acc-opcao" aria-pressed="false">' +
            '<i class="fa-solid fa-droplet-slash" aria-hidden="true"></i> Escala de cinza' +
          '</button>' +
          '<button type="button" id="acc-toggle-cursor" class="acc-opcao" aria-pressed="false">' +
            '<i class="fa-solid fa-arrow-pointer" aria-hidden="true"></i> Cursor ampliado' +
          '</button>' +
          '<button type="button" id="acc-resetar" class="acc-opcao acc-resetar">' +
            '<i class="fa-solid fa-rotate-left" aria-hidden="true"></i> Redefinir tudo' +
          '</button>' +
        '</div>' +
        '<div class="acc-painel-footer">Feito para todas as pessoas &mdash; inclusive PCD.</div>' +
      '</div>';
    document.body.appendChild(wrapper);
    ligarEventos();
  }

  function abrirPainel() {
    document.getElementById("acc-painel").hidden = false;
    document.getElementById("acc-abrir").setAttribute("aria-expanded", "true");
    document.getElementById("acc-fechar").focus();
    document.addEventListener("keydown", fecharComEsc);
  }

  function fecharPainel() {
    document.getElementById("acc-painel").hidden = true;
    document.getElementById("acc-abrir").setAttribute("aria-expanded", "false");
    document.getElementById("acc-abrir").focus();
    document.removeEventListener("keydown", fecharComEsc);
  }

  function fecharComEsc(e) {
    if (e.key === "Escape") fecharPainel();
  }

  window.addEventListener("beforeunload", function () {
    if (TTS_SUPORTADO) window.speechSynthesis.cancel();
  });

  function ligarEventos() {
    document.getElementById("acc-abrir").addEventListener("click", function () {
      var painel = document.getElementById("acc-painel");
      painel.hidden ? abrirPainel() : fecharPainel();
    });
    document.getElementById("acc-fechar").addEventListener("click", fecharPainel);

    document.getElementById("acc-fonte-mais").addEventListener("click", function () {
      estado.fonteIndex = Math.min(estado.fonteIndex + 1, FONT_STEPS.length - 1);
      salvarEstado(estado); aplicarEstado();
    });
    document.getElementById("acc-fonte-menos").addEventListener("click", function () {
      estado.fonteIndex = Math.max(estado.fonteIndex - 1, 0);
      salvarEstado(estado); aplicarEstado();
    });

    document.getElementById("acc-toggle-leitor-voz").addEventListener("click", function () {
      if (falando) {
        pararLeitura();
      } else {
        iniciarLeitura();
      }
    });
    document.getElementById("acc-leitor-pausar").addEventListener("click", alternarPausaLeitura);

    document.getElementById("acc-toggle-modo-toque").addEventListener("click", function () {
      if (modoToqueAtivo) {
        desativarModoToque();
      } else {
        pararLeitura(); // evita ler a página inteira e o modo toque ao mesmo tempo
        ativarModoToque();
      }
    });

    var toggles = {
      "acc-toggle-contraste": "contraste",
      "acc-toggle-links": "links",
      "acc-toggle-leitura": "leitura",
      "acc-toggle-animacao": "semAnimacao",
      "acc-toggle-cinza": "cinza",
      "acc-toggle-cursor": "cursorGrande"
    };
    Object.keys(toggles).forEach(function (id) {
      document.getElementById(id).addEventListener("click", function () {
        var chave = toggles[id];
        estado[chave] = !estado[chave];
        salvarEstado(estado); aplicarEstado();
      });
    });

    document.getElementById("acc-resetar").addEventListener("click", function () {
      estado = Object.assign({}, estadoPadrao);
      salvarEstado(estado); aplicarEstado();
      pararLeitura();
      desativarModoToque();
    });
  }

  /* ---------- VLibras (tradução em Libras) ---------- */
  function carregarVLibras() {
    if (document.querySelector("[vw]")) return; // já existe
    var container = document.createElement("div");
    container.setAttribute("vw", "");
    container.className = "enabled";
    container.innerHTML =
      '<div vw-access-button class="active"></div>' +
      '<div vw-plugin-wrapper><div class="vw-plugin-top-wrapper"></div></div>';
    document.body.appendChild(container);

    var script = document.createElement("script");
    script.src = "https://vlibras.gov.br/app/vlibras-plugin.js";
    script.onload = function () {
      if (window.VLibras) new window.VLibras.Widget("https://vlibras.gov.br/app");
    };
    document.body.appendChild(script);
  }

  /* ---------- Inicialização ---------- */
  function iniciar() {
    criarWidget();
    aplicarEstado();
    carregarVLibras();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
