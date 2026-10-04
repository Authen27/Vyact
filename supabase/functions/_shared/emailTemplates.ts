// Vyact v10.16 — reusable transactional email templates.
//
// One Aurora-styled layout (`renderEmail`) + per-scenario builders. Kept
// provider-agnostic: every builder returns `{ subject, html, text }`, which the
// send-* edge functions hand to whichever transport is configured
// (MailerSend / SMTP / Resend). Designed for app-wide reuse — add new scenarios
// as builders here rather than inlining HTML in a function.

export const esc = (s: string) =>
  s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const CUR_SYMBOL: Record<string, string> = { USD: '$', INR: '₹', EUR: '€', GBP: '£', JPY: '¥', AUD: 'A$', CAD: 'C$' };
export const money = (amt: number, cur: string) =>
  `${CUR_SYMBOL[cur] ?? ''}${amt}${CUR_SYMBOL[cur] ? '' : ' ' + cur}`;

const stripTags = (s: string) => s.replace(/<[^>]+>/g, '');

export interface EmailContent { subject: string; html: string; text: string; }

// Shared layout. `lines` may contain inline HTML (e.g. <strong>); the plaintext
// alternative strips tags. `cta` renders a coral button + a text link.
export function renderEmail(o: {
  heading: string;
  lines: string[];
  cta?: { label: string; url: string };
  footer?: string;
}): { html: string; text: string } {
  const body = o.lines
    .map(l => `<p style="margin:0 0 12px;color:#334155;font-size:15px;line-height:1.5">${l}</p>`)
    .join('');
  const cta = o.cta
    ? `<a href="${esc(o.cta.url)}" style="display:inline-block;margin-top:8px;background:#f97316;color:#fff;text-decoration:none;padding:10px 18px;border-radius:10px;font-size:14px;font-weight:600">${esc(o.cta.label)}</a>`
    : '';
  const footer = o.footer
    ? `<p style="margin:24px 0 0;color:#94a3b8;font-size:12px">${esc(o.footer)}</p>`
    : '';
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px">
    <h1 style="font-size:20px;color:#0f172a;margin:0 0 16px">${esc(o.heading)}</h1>
    ${body}${cta}${footer}
  </div>`;
  const text = `${o.heading}\n\n${o.lines.map(stripTags).join('\n')}`
    + (o.cta ? `\n\n${o.cta.label}: ${o.cta.url}` : '')
    + (o.footer ? `\n\n${o.footer}` : '');
  return { html, text };
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

function participantLines(d: SplitEmailData): string[] {
  const lines: string[] = [
    `Total ${money(d.total, d.currency)} · paid by ${esc(d.ownerName)} on ${esc(d.date)}.`,
    `<strong>Your share is ${money(d.recipientShare, d.currency)}.</strong>`,
  ];
  if (d.participants.length) {
    lines.push('Everyone in this split:');
    for (const p of d.participants) {
      lines.push(`• ${esc(p.name)}${p.isRecipient ? ' (you)' : ''} — ${money(p.share, d.currency)}`);
    }
  }
  return lines;
}

/** Member WITH a Vyact account — full split info + settle CTA. */
export function splitSharedEmail(d: SplitEmailData): EmailContent {
  const { html, text } = renderEmail({
    heading: `${d.ownerName} shared "${d.description}" with you`,
    lines: [...participantLines(d), 'Open Vyact to review and settle up.'],
    cta: { label: 'View split in Vyact', url: `${d.appUrl}/splits` },
    footer: "You're receiving this because someone shared a bill split with this email on Vyact.",
  });
  return { subject: `${d.ownerName} shared a split with you`, html, text };
}

/**
 * Member WITHOUT a Vyact account — an invitation (v10.59.0, owner): who sent it (name and
 * email), why (a bill to review and settle), the split itself, and one button to join.
 * The link pre-fills their email and lands them on Splits, where the split is waiting
 * (shares are keyed by email, so it appears as soon as they sign in with this address).
 */
export function splitInviteEmail(d: SplitEmailData): EmailContent {
  const signUp = `${d.appUrl}/auth/sign-up?email=${encodeURIComponent(d.recipientEmail)}&method=email&next=%2Fsplits&ref=split_invite`;
  const sender = d.ownerEmail ? `${esc(d.ownerName)} (${esc(d.ownerEmail)})` : esc(d.ownerName);
  const { html, text } = renderEmail({
    heading: `${d.ownerName} invited you to settle a shared bill`,
    lines: [
      `${sender} added you to <strong>"${esc(d.description)}"</strong> on Vyact, the family budget app, so you can see your share and settle it.`,
      ...participantLines(d),
      `Create your free Vyact account with <strong>${esc(d.recipientEmail)}</strong>. The split will be waiting in Splits when you sign in.`,
    ],
    cta: { label: 'Join Vyact to review and settle', url: signUp },
    footer: `You're receiving this because ${d.ownerName} shared a bill split with this email address on Vyact. If you don't know them, you can ignore this email.`,
  });
  return { subject: `${d.ownerName} invited you to settle "${d.description}" on Vyact`, html, text };
}

/** Owner-facing — a participant settled their share. */
export function splitSettledEmail(d: {
  settledLabel: string; amount: number; currency: string; description: string; appUrl: string;
}): EmailContent {
  const { html, text } = renderEmail({
    heading: `${d.settledLabel} settled their share`,
    lines: [`${esc(d.settledLabel)} settled <strong>${money(d.amount, d.currency)}</strong> on "${esc(d.description)}".`],
    cta: { label: 'View split', url: `${d.appUrl}/splits` },
  });
  return { subject: 'A split share was settled', html, text };
}

/** Member-facing — the owner closed the split. */
export function splitClosedEmail(d: {
  ownerName: string; description: string; appUrl: string;
}): EmailContent {
  const { html, text } = renderEmail({
    heading: `"${d.description}" was closed`,
    lines: [`${esc(d.ownerName)} marked this shared split as closed. Nothing more is owed.`],
    cta: { label: 'View split', url: `${d.appUrl}/splits` },
  });
  return { subject: 'A shared split was closed', html, text };
}
