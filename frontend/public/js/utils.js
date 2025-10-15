// Utility functions

// Normalize server URL (ws/wss/http/https)
function normalizeServer(raw) {
  let input = String(raw || "").trim();
  if (/^wss?:\/\//i.test(input)) {
    const wsProto = input.startsWith("wss://") ? "wss" : "ws";
    const host = input.replace(/^wss?:\/\//i, "").replace(/\/+$/, "");
    const originHttp = (wsProto === "wss" ? "https://" : "http://") + host;
    return { raw: input, host, wsProto, originHttp };
  }
  if (/^https?:\/\//i.test(input)) {
    const originHttp = input.replace(/\/+$/, "");
    const wsProto = originHttp.startsWith("https://") ? "wss" : "ws";
    const host = originHttp.replace(/^https?:\/\//i, "");
    return { raw: input, host, wsProto, originHttp };
  }
  const host = input.replace(/\/+$/, "");
  return { raw: input, host, wsProto: "wss", originHttp: "https://" + host };
}

// Logging utilities with timestamps
function now() {
  return new Date().toISOString();
}

function logDebug(...args) {
  console.log("[DEBUG]", now(), ...args);
}

function logInfo(...args) {
  console.info("[INFO]", now(), ...args);
}

function logWarn(...args) {
  console.warn("[WARN]", now(), ...args);
}

function logError(...args) {
  console.error("[ERROR]", now(), ...args);
}

// HTTP endpoint check
async function checkBackendHttp(endpoint = "/api/rooms") {
  try {
    const base = CONFIG.SERVER_URL
      ? normalizeServer(CONFIG.SERVER_URL).originHttp
      : "";
    const url = base.replace(/\/+$/, "") + endpoint;
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    logDebug(
      "HTTP check",
      url,
      "status=",
      res.status,
      "body=",
      text.slice(0, 1000)
    );
    return { ok: res.ok, status: res.status, body: text };
  } catch (err) {
    logError("HTTP check failed for", endpoint, err && err.message);
    return { ok: false, error: err };
  }
}

// Expose globally
window.Utils = {
  normalizeServer,
  now,
  logDebug,
  logInfo,
  logWarn,
  logError,
  checkBackendHttp,
};
