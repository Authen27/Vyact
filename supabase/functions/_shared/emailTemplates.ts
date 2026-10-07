// Vyact v10.16 — reusable transactional email templates.
//
// One Aurora-styled layout (`renderEmail`) + per-scenario builders. Kept
// provider-agnostic: every builder returns `{ subject, html, text }`, which the
// send-* edge functions hand to whichever transport is configured
// (MailerSend / SMTP / Resend). Designed for app-wide reuse — add new scenarios
// as builders here rather than inlining HTML in a function.
//
// W1c (v10.64.0, audit 2026-10-04 BE-FN-06): every value is escaped BY CONSTRUCTION. A line is
// either plain text (escaped whole) or built with the `html` tag, which escapes each value it
// interpolates. Before this, `money()` wrote an unknown currency code raw into the HTML, so a
// split with currency `<a href=…>` put a live link in an email signed by vyact.app.

export const esc = (s: string) =>
  s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** A fragment whose markup is ours and whose values were escaped: only `html` builds one. */
export class SafeHtml {
  constructor(readonly html: string, readonly text: string) {}
  toString() { return this.html; }
}

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '');

/** Tagged template: the literal parts are trusted markup, every `${value}` is escaped. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let h = strings[0];
  let t = stripTags(strings[0]);
  values.forEach((v, i) => {
    if (v instanceof SafeHtml) { h += v.html; t += v.text; }
    else { h += esc(String(v)); t += String(v); }
    h += strings[i + 1];
    t += stripTags(strings[i + 1]);
  });
  return new SafeHtml(h, t);
}

const isControl = (c: number) => c < 0x20 || c === 0x7f || c === 0x2028 || c === 0x2029;

/**
 * A person-supplied label (a display name, a split description) as it may appear in a subject
 * or heading: no control characters (no header folding), whitespace collapsed, length capped.
 */
export function label(s: string | null | undefined, max = 80): string {
  const clean = Array.from(String(s ?? ''), ch => (isControl(ch.charCodeAt(0)) ? ' ' : ch))
    .join('').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

const CUR_SYMBOL: Record<string, string> = { USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$' };
/** Plain text. A code that is not three capital letters is dropped, never echoed. */
export const money = (amt: number, cur: string) => {
  const n = Number.isFinite(amt) ? String(amt) : '0';
  if (CUR_SYMBOL[cur]) return `${CUR_SYMBOL[cur]}${n}`;
  return /^[A-Z]{3}$/.test(cur) ? `${n} ${cur}` : n;
};

export interface EmailContent { subject: string; html: string; text: string; }

type Line = string | SafeHtml;

// Shared layout. A plain-string line is escaped whole; a SafeHtml line keeps its markup
// (e.g. <strong>) and the plaintext alternative uses its text. `cta` renders a coral button + a
// text link.
export function renderEmail(o: {
  heading: string;
  lines: Line[];
  cta?: { label: string; url: string };
  footer?: string;
}): { html: string; text: string } {
  const lineHtml = (l: Line) => (l instanceof SafeHtml ? l.html : esc(l));
  const lineText = (l: Line) => (l instanceof SafeHtml ? l.text : l);
  const body = o.lines
    .map(l => `<p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.5">${lineHtml(l)}</p>`)
    .join('');
  const cta = o.cta
    ? `<a href="${esc(o.cta.url)}" style="display:inline-block;margin-top:8px;background:#f97316;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600">${esc(o.cta.label)}</a>`
    : '';
  const footer = o.footer
    ? `<p style="margin:24px 0 0;color:#94a3b8;font-size:12px">${esc(o.footer)}</p>`
    : '';
  const page = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px">${esc(o.heading)}</h1>
    ${body}${cta}${footer}
  </div>`;
  const text = `${o.heading}\n\n${o.lines.map(lineText).join('\n')}`
    + (o.cta ? `\n\n${o.cta.label}: ${o.cta.url}` : '')
    + (o.footer ? `\n\n${o.footer}` : '');
  return { html: page, text };
}

export interface SplitEmailData {
  ownerName: string;
  /** v10.59.0 — shown in the invitation so the recipient knows exactly who sent it. */
  ownerEmail?: string;
  description: string;      // human label, already defaulted if blank
  date: string;
  currency: string;
  total: number;
  recipientShare: number;
  // Every participant (the non-owner shares), name-resolved where possible.
  participants: { name: string; share: number; isRecipient: boolean }[];
  appUrl: string;
  recipientEmail: string;
}

function participantLines(d: SplitEmailData): Line[] {
  const lines: Line[] = [
    `Total ${money(d.total, d.currency)} · paid by ${label(d.ownerName)} on ${d.date}.`,
    html`<strong>Your share is ${money(d.recipientShare, d.currency)}.</strong>`,
  ];
  if (d.participants.length) {
    lines.push('Everyone in this split:');
    for (const p of d.participants) {
      lines.push(`• ${label(p.name)}${p.isRecipient ? ' (you)' : ''} — ${money(p.share, d.currency)}`);
    }
  }
  return lines;
}

/** Member WITH a Vyact account — full split info + settle CTA. */
export function splitSharedEmail(d: SplitEmailData): EmailContent {
  const owner = label(d.ownerName);
  const { html: page, text } = renderEmail({
    heading: `${owner} shared "${label(d.description)}" with you`,
    lines: [...participantLines(d), 'Open Vyact to review and settle up.'],
    cta: { label: 'View split in Vyact', url: `${d.appUrl}/splits` },
    footer: "You're receiving this because someone shared a bill split with this email on Vyact.",
  });
  return { subject: `${owner} shared a split with you`, html: page, text };
}

/**
 * Member WITHOUT a Vyact account — an invitation (v10.59.0, owner): who sent it (name and
 * email), why (a bill to review and settle), the split itself, and one button to join.
 * The link pre-fills their email and lands them on Splits, where the split is waiting
 * (shares are keyed by email, so it appears as soon as they sign in with this address).
 */
export function splitInviteEmail(d: SplitEmailData): EmailContent {
  const owner = label(d.ownerName);
  const description = label(d.description);
  const signUp = `${d.appUrl}/auth/sign-up?email=${encodeURIComponent(d.recipientEmail)}&method=email&next=%2Fsplits&ref=split_invite`;
  const sender = d.ownerEmail ? `${owner} (${label(d.ownerEmail, 254)})` : owner;
  const { html: page, text } = renderEmail({
    heading: `${owner} invited you to settle a shared bill`,
    lines: [
      html`${sender} added you to <strong>"${description}"</strong> on Vyact, the family budget app, so you can see your share and settle it.`,
      ...participantLines(d),
      html`Create your free Vyact account with <strong>${d.recipientEmail}</strong>. The split will be waiting in Splits when you sign in.`,
    ],
    cta: { label: 'Join Vyact to review and settle', url: signUp },
    footer: `You're receiving this because ${owner} shared a bill split with this email address on Vyact. If you don't know them, you can ignore this email.`,
  });
  return { subject: `${owner} invited you to settle "${description}" on Vyact`, html: page, text };
}

/** Owner-facing — a participant settled their share. */
export function splitSettledEmail(d: {
  settledLabel: string; amount: number; currency: string; description: string; appUrl: string;
}): EmailContent {
  const who = label(d.settledLabel);
  const { html: page, text } = renderEmail({
    heading: `${who} settled their share`,
    lines: [html`${who} settled <strong>${money(d.amount, d.currency)}</strong> on "${label(d.description)}".`],
    cta: { label: 'View split', url: `${d.appUrl}/splits` },
  });
  return { subject: 'A split share was settled', html: page, text };
}

/** Member-facing — the owner closed the split. */
export function splitClosedEmail(d: {
  ownerName: string; description: string; appUrl: string;
}): EmailContent {
  const { html: page, text } = renderEmail({
    heading: `"${label(d.description)}" was closed`,
    lines: [`${label(d.ownerName)} marked this shared split as closed. Nothing more is owed.`],
    cta: { label: 'View split', url: `${d.appUrl}/splits` },
  });
  return { subject: 'A shared split was closed', html: page, text };
}
