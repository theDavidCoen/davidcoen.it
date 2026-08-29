document.addEventListener("DOMContentLoaded", function () {
  const searchButton = document.getElementById("searchButton");
  const orderInput = document.getElementById("orderID");
  const resultsDiv = document.getElementById("results");

  // Shapes from Intercom Data Connectors (Fin swap/ramp partners).
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const TXID_RE = /^(0x)?[0-9a-f]{64}$/i;
  const HEX24_RE = /^[0-9a-f]{24}$/i;
  const ALNUM6_RE = /^[a-z0-9]{6}$/i;
  const ALNUM20_RE = /^[a-z0-9]{20}$/i;
  const ALNUM_10_20_RE = /^[a-z0-9]{10,20}$/i;
  const NON_HEX_RE = /[g-z]/i;

  const PARTNERS = [
    {
      slug: "nexchange",
      name: "Nexchange",
      aliases: ["nexchange", "n.exchange"],
      kind: "Crypto swap (CEX)",
      shape: "~6 alphanumeric uppercase (e.g. OLSJ2O)",
      unique: true,
      matchesId: function (id) {
        return ALNUM6_RE.test(id) && /[a-z]/i.test(id);
      },
      statusUrl: function (id) {
        return "https://n.exchange/order/" + id;
      },
      email: "support@n.exchange",
      supportUrl: "mailto:support@n.exchange"
    },
    {
      slug: "changenow",
      name: "ChangeNOW",
      aliases: ["changenow", "change now", "change NOW"],
      kind: "Crypto swap (CEX)",
      shape: "~24 lowercase hex",
      unique: true,
      matchesId: function (id) {
        return HEX24_RE.test(id);
      },
      statusUrl: function (id) {
        return "https://changenow.io/exchange/txs/" + id;
      },
      email: "support@changenow.io",
      supportUrl: "mailto:support@changenow.io"
    },
    {
      slug: "sideshift",
      name: "SideShift",
      aliases: ["sideshift", "sideshift.ai", "sideshift.ai"],
      kind: "Crypto swap (CEX)",
      shape: "~20 alphanumeric (e.g. dda3867168da23927b62)",
      unique: true,
      matchesId: function (id) {
        return ALNUM20_RE.test(id);
      },
      statusUrl: function (id) {
        return "https://sideshift.ai/orders/" + id;
      },
      email: "help@sideshift.ai",
      supportUrl: "https://help.sideshift.ai"
    },
    {
      slug: "swapuz",
      name: "Swapuz",
      aliases: ["swapuz"],
      kind: "Crypto swap (CEX)",
      shape: "UUID with hyphens",
      unique: false,
      matchesId: function (id) {
        return UUID_RE.test(id);
      },
      statusUrl: function (id) {
        return "https://swapuz.com/order/" + id;
      },
      email: "support@swapuz.com",
      supportUrl: "https://swapuz.com/contact"
    },
    {
      slug: "moonpay",
      name: "MoonPay",
      aliases: ["moonpay", "moonpay"],
      kind: "Buy/sell ramp",
      shape: "UUID",
      unique: false,
      matchesId: function (id) {
        return UUID_RE.test(id);
      },
      statusUrl: function (id) {
        return (
          "https://buy.moonpay.com/transaction_receipt?transactionId=" + id
        );
      },
      extraUrls: function (id) {
        return [
          {
            label: "Sell receipt",
            href:
              "https://sell.moonpay.com/transaction_receipt?transactionId=" +
              id
          }
        ];
      },
      email: "support@moonpay.com",
      supportUrl: "https://support.moonpay.com/hc/en-gb/requests/new"
    },
    {
      slug: "simplex",
      name: "Simplex",
      aliases: ["simplex"],
      kind: "Buy/sell ramp",
      shape: "UUID",
      unique: false,
      matchesId: function (id) {
        return UUID_RE.test(id);
      },
      statusUrl: function (id) {
        return "https://payment-status.simplex.com/#/payment/" + id;
      },
      email: "support@simplex.com",
      supportUrl: "https://support.simplex.com/hc/en-gb/requests/new"
    },
    {
      slug: "changehero",
      name: "ChangeHero",
      aliases: ["changehero"],
      kind: "Crypto swap (CEX)",
      shape: "Short alphanumeric, often starts with ch (e.g. ch9a8b7c6d5e4f3)",
      unique: false,
      matchesId: function (id) {
        return (
          ALNUM_10_20_RE.test(id) &&
          id.length !== 20 &&
          /^ch/i.test(id)
        );
      },
      statusUrl: function (id) {
        return "https://changehero.io/transaction/" + id;
      },
      email: "support@changehero.io",
      supportUrl: "https://changehero.io/mrkt/support"
    },
    {
      slug: "godex",
      name: "Godex",
      aliases: ["godex"],
      kind: "Crypto swap (CEX)",
      shape: "Alphanumeric transaction_id (e.g. gd…)",
      unique: false,
      matchesId: function (id) {
        return (
          ALNUM_10_20_RE.test(id) &&
          id.length !== 20 &&
          /^gd/i.test(id)
        );
      },
      statusUrl: function (id) {
        return "https://godex.io/exchange/waiting/" + id;
      },
      email: "support@godex.io",
      supportUrl: "https://godex.io/contact"
    },
    {
      slug: "xgram",
      name: "Xgram",
      aliases: ["xgram"],
      kind: "Crypto swap (CEX)",
      shape: "10–20 alphanumeric (e.g. qeq6r5qa999th0)",
      unique: false,
      matchesId: function (id) {
        return (
          ALNUM_10_20_RE.test(id) &&
          id.length !== 20 &&
          NON_HEX_RE.test(id) &&
          !/^gd/i.test(id) &&
          !/^ch/i.test(id) &&
          !/^ex/i.test(id)
        );
      },
      statusUrl: function (id) {
        return "https://xgram.io/exchange/order?id=" + id;
      },
      email: "support@xgram.io",
      supportUrl: "mailto:support@xgram.io"
    },
    {
      slug: "exolix",
      name: "Exolix",
      aliases: ["exolix"],
      kind: "Crypto swap (CEX)",
      shape: "10–20 alphanumeric (e.g. 9332d2408bd7c1)",
      unique: false,
      matchesId: function (id) {
        return (
          ALNUM_10_20_RE.test(id) &&
          id.length !== 20 &&
          (!NON_HEX_RE.test(id) || /^ex/i.test(id))
        );
      },
      statusUrl: function (id) {
        return "https://exolix.com/transaction/" + id;
      },
      email: "support@exolix.com",
      supportUrl: "https://exolix.com/contact"
    },
    {
      slug: "letsexchange",
      name: "LetsExchange",
      aliases: ["letsexchange", "lets exchange"],
      kind: "Crypto swap (CEX)",
      shape: "10–20 alphanumeric Swap ID (e.g. 599cd4bb4d4a5)",
      unique: false,
      matchesId: function (id) {
        return (
          ALNUM_10_20_RE.test(id) &&
          id.length !== 20 &&
          !NON_HEX_RE.test(id)
        );
      },
      statusUrl: function (id) {
        return "https://letsexchange.io/?transactionId=" + id;
      },
      email: "support@letsexchange.io",
      supportUrl: "https://letsexchange.io/transaction-status"
    }
  ];

  const DEX = [
    {
      slug: "maya",
      name: "Maya Protocol",
      aliases: ["maya", "maya protocol"],
      kind: "DEX swap — lookup by inbound txid, not order ID",
      statusLabel: "Mayascan",
      statusUrl: function (id) {
        return "https://www.mayascan.org/tx/" + strip0x(id);
      },
      extraUrls: function (id) {
        return [
          {
            label: "Midgard API",
            href:
              "https://midgard.mayachain.info/v2/actions?txid=" + strip0x(id)
          }
        ];
      }
    },
    {
      slug: "thorchain",
      name: "THORChain",
      aliases: ["thorchain", "thor chain"],
      kind: "DEX swap — lookup by inbound txid, not order ID",
      statusLabel: "Runescan",
      statusUrl: function (id) {
        return "https://runescan.io/tx/" + strip0x(id);
      },
      extraUrls: function (id) {
        return [
          {
            label: "viewblock.io",
            href: "https://viewblock.io/thorchain/tx/" + strip0x(id)
          }
        ];
      }
    }
  ];

  function strip0x(id) {
    return id.replace(/^0x/i, "");
  }

  function matchField(text, labels) {
    for (var i = 0; i < labels.length; i++) {
      var label = labels[i];
      var colon = new RegExp(
        label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[:\\-–]\\s*(\\S+)",
        "i"
      );
      var m = text.match(colon);
      if (m) return m[1].trim();
      var nl = new RegExp(
        label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[\\n\\r]+\\s*(\\S+)",
        "i"
      );
      var n = text.match(nl);
      if (n) return n[1].trim();
    }
    return null;
  }

  function parseInput(raw) {
    var text = raw.trim();
    if (!text) return null;

    var service = matchField(text, ["Exchange Service", "Service"]);
    var orderId = matchField(text, ["Order ID", "Order Id", "Swap ID"]);
    var txid = matchField(text, [
      "Transaction ID",
      "Transaction Id",
      "Txid",
      "Tx ID"
    ]);

    if (service || orderId || txid) {
      return { service: service, orderId: orderId, txid: txid };
    }

    var first = text.split(/\s+/)[0];
    if (TXID_RE.test(first)) {
      return { service: null, orderId: null, txid: first };
    }
    return { service: null, orderId: first, txid: null };
  }

  function partnersByService(service) {
    if (!service) return [];
    var needle = service.toLowerCase().replace(/\s+/g, " ").trim();
    function inList(list) {
      var found = [];
      for (var i = 0; i < list.length; i++) {
        var aliases = list[i].aliases;
        for (var j = 0; j < aliases.length; j++) {
          if (needle.indexOf(aliases[j].toLowerCase()) !== -1) {
            found.push(list[i]);
            break;
          }
        }
      }
      return found;
    }
    var cex = inList(PARTNERS);
    if (cex.length) return cex;
    return inList(DEX);
  }

  function partnersById(id) {
    var hits = [];
    for (var i = 0; i < PARTNERS.length; i++) {
      if (PARTNERS[i].matchesId(id)) hits.push(PARTNERS[i]);
    }
    return hits;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function addLink(parent, href, text) {
    var a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = text;
    parent.appendChild(a);
    return a;
  }

  function addActionButton(parent, href, label) {
    var a = document.createElement("a");
    a.className = "button result-link";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = label;
    parent.appendChild(a);
    return a;
  }

  function setHasResults(has) {
    var wrap = document.querySelector(".wrap");
    if (wrap) {
      if (has) wrap.classList.add("has-results");
      else wrap.classList.remove("has-results");
    }
  }

  function renderPartnerCard(partner, id, opts) {
    opts = opts || {};
    var card = el("div", "result-card");
    card.appendChild(el("h2", null, partner.name));
    card.appendChild(el("p", "result-kind", partner.kind));
    if (partner.shape) {
      card.appendChild(el("p", "shape", "Order ID shape: " + partner.shape));
    }

    if (id && partner.statusUrl && !opts.skipStatus) {
      var actions = el("p", "result-actions");
      addActionButton(
        actions,
        partner.statusUrl(id),
        partner.statusLabel || "Open status page"
      );
      if (typeof partner.extraUrls === "function") {
        var extras = partner.extraUrls(id);
        for (var i = 0; i < extras.length; i++) {
          addActionButton(actions, extras[i].href, extras[i].label);
        }
      }
      card.appendChild(actions);
    }

    if (partner.email) {
      var mailP = el("p");
      mailP.appendChild(document.createTextNode("Support: "));
      addLink(mailP, "mailto:" + partner.email, partner.email);
      if (partner.supportUrl && partner.supportUrl.indexOf("mailto:") !== 0) {
        mailP.appendChild(document.createTextNode(" · "));
        addLink(mailP, partner.supportUrl, "support form");
      }
      card.appendChild(mailP);
    }

    if (partner.supportNote) {
      card.appendChild(el("p", "shape", partner.supportNote));
    }

    return card;
  }

  function renderMessage(text, warn) {
    var p = el("p", warn ? "status-msg warn" : "status-msg", text);
    resultsDiv.appendChild(p);
  }

  function search() {
    resultsDiv.innerHTML = "";
    setHasResults(false);
    var parsed = parseInput(orderInput.value);
    if (!parsed) return;

    try {
      runSearch(parsed);
    } finally {
      setHasResults(resultsDiv.childNodes.length > 0);
    }
  }

  function appendDexNote() {
    renderMessage(
      "Do not send the customer to Maya/THORChain Discord or third-party DEX support. Edge handles DEX swaps on-chain."
    );
  }

  function runSearch(parsed) {
    var named = partnersByService(parsed.service);

    if (parsed.txid && TXID_RE.test(parsed.txid) && !parsed.orderId) {
      renderMessage(
        "This is a blockchain transaction hash, not a CEX partner order ID. CEX APIs return 404 if you pass a txid.",
        true
      );
      var dexList = named.length ? named : DEX;
      var onlyDex = true;
      for (var d = 0; d < dexList.length; d++) {
        if (dexList[d].kind.indexOf("DEX") === -1) onlyDex = false;
      }
      if (!named.length || onlyDex) {
        renderMessage(
          parsed.service
            ? "DEX Exchange Service detected. Lookup uses the inbound Transaction ID."
            : "If this was a DEX swap (Maya Protocol or THORChain), Order ID is often empty — use these explorers:"
        );
        var show = named.length ? named : DEX;
        for (var i = 0; i < show.length; i++) {
          resultsDiv.appendChild(renderPartnerCard(show[i], parsed.txid));
        }
        appendDexNote();
      }
      return;
    }

    if (parsed.txid && TXID_RE.test(parsed.txid) && parsed.orderId) {
      renderMessage(
        "Transaction ID is an on-chain hash (deposit leg). Partner status uses Order ID only.",
        true
      );
    }

    var id = parsed.orderId;
    if (!id) {
      renderMessage("No Order ID found. CEX swaps need the Order ID from Exchange Details.");
      return;
    }

    if (TXID_RE.test(id)) {
      renderMessage(
        "This looks like a blockchain txid, not a partner order ID.",
        true
      );
      for (var t = 0; t < DEX.length; t++) {
        resultsDiv.appendChild(renderPartnerCard(DEX[t], id));
      }
      appendDexNote();
      return;
    }

    var shapeHits = partnersById(id);

    if (named.length) {
      var namedCex = [];
      var namedDex = [];
      for (var n = 0; n < named.length; n++) {
        if (named[n].kind.indexOf("DEX") !== -1) namedDex.push(named[n]);
        else namedCex.push(named[n]);
      }

      if (namedDex.length && parsed.txid) {
        for (var x = 0; x < namedDex.length; x++) {
          resultsDiv.appendChild(
            renderPartnerCard(namedDex[x], parsed.txid)
          );
        }
        appendDexNote();
        return;
      }

      if (namedCex.length) {
        var matching = [];
        var mismatch = [];
        for (var c = 0; c < namedCex.length; c++) {
          if (namedCex[c].matchesId(id)) matching.push(namedCex[c]);
          else mismatch.push(namedCex[c]);
        }
        if (mismatch.length && !matching.length) {
          renderMessage(
            "Exchange Service and Order ID shape do not match. Ask for a fresh copy-paste of Exchange Details — do not guess the partner.",
            true
          );
          resultsDiv.appendChild(
            renderPartnerCard(mismatch[0], id, { skipStatus: true })
          );
          if (shapeHits.length) {
            renderMessage("Shape instead matches:");
            for (var s = 0; s < shapeHits.length; s++) {
              resultsDiv.appendChild(renderPartnerCard(shapeHits[s], id));
            }
          }
          return;
        }
        if (matching.length) {
          renderMessage("Matched Exchange Service + order ID shape.");
          for (var m = 0; m < matching.length; m++) {
            resultsDiv.appendChild(renderPartnerCard(matching[m], id));
          }
          return;
        }
      }
    }

    if (!shapeHits.length) {
      renderMessage("No Edge partner matches this ID shape.");
      return;
    }

    if (shapeHits.length > 1) {
      renderMessage(
        "Several partners share this ID shape. Use Exchange Service from Edge Exchange Details to pick one."
      );
    }

    for (var p = 0; p < shapeHits.length; p++) {
      resultsDiv.appendChild(renderPartnerCard(shapeHits[p], id));
    }
  }

  searchButton.addEventListener("click", search);
  orderInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      search();
    }
  });
});
