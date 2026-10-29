"use strict";

// Explicit asset-only fixture: avoid Google Fonts network in isolated browser tests.
// No Partners, payment, financial or business response is replaced.
module.exports = new Proxy({}, {
  get(_target, url) {
    if (typeof url !== "string" || !url.startsWith("https://fonts.googleapis.com/css2?family=")) return undefined;
    const family = url.includes("family=Montserrat") ? "Montserrat" : url.includes("family=Poppins") ? "Poppins" : null;
    if (!family) return undefined;
    return `@font-face { font-family: '${family}'; src: local("Arial"); font-style: normal; font-weight: 100 900; font-display: swap; }`;
  },
});
