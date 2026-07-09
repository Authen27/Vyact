/* global React */

// ════════════════════════════════════════════════════════════════
//   Locale + currency formatter helpers
//   Used by the prototype + design-system tab.
// ════════════════════════════════════════════════════════════════

const LOCALES = {
  "en-US": { name: "English (US)", flag: "🇺🇸", sample: "April 28, 2026", numSep: "1,234.56", textDir: "ltr" },
  "en-IN": { name: "English (India)", flag: "🇮🇳", sample: "28 April 2026", numSep: "1,23,456.78", textDir: "ltr" },
  "es-ES": { name: "Español (ES)", flag: "🇪🇸", sample: "28 de abril de 2026", numSep: "1.234,56", textDir: "ltr" },
  "ja-JP": { name: "日本語", flag: "🇯🇵", sample: "2026年4月28日", numSep: "1,234.56", textDir: "ltr" },
  "ar-AE": { name: "العربية", flag: "🇦🇪", sample: "٢٨ أبريل ٢٠٢٦", numSep: "١٬٢٣٤٫٥٦", textDir: "rtl" },
  "pt-BR": { name: "Português (BR)", flag: "🇧🇷", sample: "28 de abril de 2026", numSep: "1.234,56", textDir: "ltr" },
};

const CURRENCIES = {
  USD: { symbol: "$", name: "US Dollar", code: "USD", decimals: 2, fxToUSD: 1.00 },
  EUR: { symbol: "€", name: "Euro", code: "EUR", decimals: 2, fxToUSD: 1.08 },
  GBP: { symbol: "£", name: "British Pound", code: "GBP", decimals: 2, fxToUSD: 1.27 },
  INR: { symbol: "₹", name: "Indian Rupee", code: "INR", decimals: 0, fxToUSD: 0.012 },
  JPY: { symbol: "¥", name: "Japanese Yen", code: "JPY", decimals: 0, fxToUSD: 0.0067 },
  BRL: { symbol: "R$", name: "Brazilian Real", code: "BRL", decimals: 2, fxToUSD: 0.20 },
  AED: { symbol: "د.إ", name: "UAE Dirham", code: "AED", decimals: 2, fxToUSD: 0.27 },
};

// Format a USD-base amount into the user's chosen currency + locale.
const fmt = (usdAmount, opts = {}) => {
  const { currency = "USD", locale = "en-US", abbrev = false, sign = false } = opts;
  const c = CURRENCIES[currency] || CURRENCIES.USD;
  const native = usdAmount / c.fxToUSD;
  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: c.code,
      minimumFractionDigits: c.decimals,
      maximumFractionDigits: c.decimals,
      notation: abbrev && Math.abs(native) >= 10000 ? "compact" : "standard",
    });
    const out = formatter.format(Math.abs(native));
    if (sign) return (native >= 0 ? "+" : "−") + out;
    return native < 0 ? "−" + out : out;
  } catch (e) {
    return c.symbol + Math.round(native).toLocaleString();
  }
};

window.LOCALES = LOCALES;
window.CURRENCIES = CURRENCIES;
window.fmt = fmt;
