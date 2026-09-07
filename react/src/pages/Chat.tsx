import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, MessageCircle, Trash2, ChevronLeft, Mic } from 'lucide-react';
import { useStore } from '../store';
import { Panel } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Chip from '../components/ui/Chip';
import {
  buildSafeSummary, type ChatMessage,
} from '../lib/aiSummary';
import type { AssistantChip } from '../lib/askVyactResponses';
import { logAiUsage } from '../lib/aiUsage';
import ls from '../lib/localStorageCompat';
import {
  INTENTS, BUCKET_LABEL, intentsByBucket, type Bucket, type Intent, type IntentAction,
} from '../lib/askVyactIntents';
import { isAskVyactEnabled, FEATURES } from '../config/features';
import {
  runAssistant, proactiveInsight, selectAssistantBackend, type AssistantContext,
} from '../lib/askVyactBackend';

// Minimal Web Speech API shapes (lib.dom doesn't ship these in all TS configs).
interface SpeechRecognitionEventLike {
  results: { [i: number]: { [j: number]: { transcript: string }; isFinal?: boolean } };
  resultIndex: number;
}
interface SpeechRecognitionErrorLike { error: string; }
interface SpeechRecognitionLike {
  lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number;
  onresult: (e: SpeechRecognitionEventLike) => void;
  onerror: (e: SpeechRecognitionErrorLike) => void;
  onend: () => void;
  start: () => void; stop: () => void;
}

const BUCKETS: Bucket[] = ['capture', 'inquire', 'plan'];

// Both backends are resolved PER TURN inside `send()`, never memoised here.
// Module-scope resolution froze the choice at first import, so any config change
// (feature flag, env, and soon a DB-driven model row) could not take effect
// without a full page reload. Both factories are cheap and stateless.

/** `embedded` — rendered inside the Ask Vyact drawer, which supplies its own
 *  board-spec header, so the page title block is suppressed to avoid showing
 *  two headings. The /chat route renders it standalone (embedded=false). */
export default function Chat({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const txns    = useStore(s => s.transactions);
  const budgets = useStore(s => s.budgets);
  const goals   = useStore(s => s.goals);
  const debts   = useStore(s => s.debts);
  const assets  = useStore(s => s.assets);
  const profile = useStore(s => s.profile);
  const rates   = useStore(s => s.rates);
  const members = useStore(s => s.members);
  const recurring = useStore(s => s.recurringSchedules);
  const householdId = useStore(s => s.currentHouseholdId);
  const openAddTxn    = useStore(s => s.openAddTxn);
  const openAddBudget = useStore(s => s.openAddBudget);
  const openAddDebt   = useStore(s => s.openAddDebt);
  const openAddAsset  = useStore(s => s.openAddAsset);
  const toast         = useStore(s => s.toast);

  const [history, setHistory] = useState<ChatMessage[]>(() => {
    try { return ls.readJson<ChatMessage[]>('chat_history') || []; }
    catch { return []; }
  });
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  // v7.4.5 — when an intent has secondary chips, hold it here so the
  // empty-state grid swaps to the tap-2 row.
  const [expanded, setExpanded] = useState<Intent | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Skip the very first history-effect run (mount/hydration) so opening Ask
  // Vyact stays scrolled to the TOP showing the intent options, instead of
  // auto-jumping to the bottom of the list.
  const didMountScroll = useRef(false);

  // Proactive "what to know" card (spec §5) — at most one per session, dismissible,
  // only when the flag + bucket + proactiveInsight are on.
  const [proactive, setProactive] = useState<{ text: string; chipPrompt?: string } | null>(null);

  // Privacy-safe summary built from current state — never includes merchant names or descriptions
  const summary = useMemo(() => {
    const s = buildSafeSummary(txns, budgets, goals, debts, assets, profile, rates);
    s.household.members = members.length;
    return s;
  }, [txns, budgets, goals, debts, assets, profile, rates, members.length]);

  useEffect(() => {
    ls.setJson('chat_history', history);
    // Only auto-scroll to the newest message on a real turn — never on open.
    if (!didMountScroll.current) { didMountScroll.current = true; return; }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history]);

  // Surface one proactive insight on open (rate-limited to one per session).
  useEffect(() => {
    if (!isAskVyactEnabled() || !FEATURES.askVyact.proactiveInsight) return;
    try { if (sessionStorage.getItem('askvyact_proactive_shown') === '1') return; } catch { /* noop */ }
    const ctx: AssistantContext = {
      summary, transactions: txns, budgets, goals, debts, assets, recurring,
      profile, rates, baseCurrency: profile.baseCurrency,
    };
    const insight = proactiveInsight(ctx);
    if (insight) {
      setProactive(insight);
      try { sessionStorage.setItem('askvyact_proactive_shown', '1'); } catch { /* noop */ }
    }
    // Run once on mount; summary is stable enough for a first-open insight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dispatchAction(action: IntentAction, intentId: string, taps: 1 | 2) {
    // Telemetry: privacy-safe — only the chip id + bucket + tap depth.
    // eslint-disable-next-line no-console
    console.debug('[ask-vyact-intent]', { id: intentId, taps });
    if (action.kind === 'open-modal') {
      switch (action.modal) {
        case 'addTxn':    openAddTxn(action.seed); break;
        case 'addBudget': openAddBudget(); break;
        case 'addDebt':   openAddDebt();   break;
        case 'addAsset':  openAddAsset();  break;
      }
      setExpanded(null);
    } else if (action.kind === 'navigate') {
      navigate(action.to);
    } else if (action.kind === 'ask') {
      void send(action.prompt);
      setExpanded(null);
    }
  }

  function pickIntent(intent: Intent) {
    if (intent.secondary && intent.secondary.length) {
      setExpanded(intent);
      return;
    }
    if (intent.action) dispatchAction(intent.action, intent.id, 1);
  }

  async function send(question: string) {
    if (!question.trim() || thinking) return;
    const userMsg: ChatMessage = { role: 'user', content: question };
    setHistory(h => [...h, userMsg]);
    setInput('');
    setThinking(true);

    // AI-P0 — telemetry is logged AFTER the turn so it can carry which engine
    // answered and the outcome. Still privacy-safe: intent + sentiment + length
    // + call metadata only, never the message text.
    const startedAt = Date.now();

    try {
      // Ask Vyact assistant (spec §3). When the flag is OFF this whole branch is
      // skipped and the launcher behaves exactly as it did in v7.4.5.
      if (isAskVyactEnabled()) {
        const assistantBackend = selectAssistantBackend();
        const ctx: AssistantContext = {
          summary, transactions: txns, budgets, goals, debts, assets, recurring,
          profile, rates, baseCurrency: profile.baseCurrency,
        };
        // A null backend means no model is configured. runAssistant turns that
        // into an explicit "unavailable" turn rather than a fabricated answer.
        const turn = await runAssistant(question, ctx, assistantBackend);
        void logAiUsage({
          householdId, text: question, surface: 'chat',
          backend: assistantBackend?.id ?? 'llm',
          tier: 't1',
          outcome: turn.intentId === 'unavailable' ? 'error'
            : turn.clarify ? 'clarify'
            : turn.intentId === 'fallback' ? 'fallback' : 'ok',
          latencyMs: Date.now() - startedAt,
        });
        // Capture intents seed the EXISTING TransactionFormModal — no parallel path.
        if (turn.seed) openAddTxn(turn.seed);
        // #4 — human-like: a brief "thinking" pause, then stream word-by-word.
        await new Promise(r => setTimeout(r, 600));
        setThinking(false);
        await streamReply(turn.reply, turn.chips);
        return;
      }
      // Ask Vyact is the ONLY assistant (v10.20). With the feature flag off there
      // is no second engine to fall through to — the old ChatBackend path was
      // removed with its browser-side key. Say so plainly rather than routing the
      // user to something they were never told about.
      void logAiUsage({
        householdId, text: question, surface: 'chat',
        outcome: 'error', latencyMs: Date.now() - startedAt,
      });
      setHistory(h => [...h, {
        role: 'assistant',
        content: 'The assistant is turned off right now.',
      }]);
    } catch (e) {
      void logAiUsage({
        householdId, text: question, surface: 'chat',
        outcome: 'error', latencyMs: Date.now() - startedAt,
      });
      setHistory(h => [...h, { role: 'assistant', content: `Error: ${(e as Error).message}` }]);
    } finally {
      setThinking(false);
    }
  }

  // #4 — stream an assistant reply word-by-word (resolves when complete).
  //
  // `chips` are attached only once the last word lands (#62). Showing follow-ups
  // beside a half-written sentence invites a tap before the answer is legible,
  // and the tap would discard a reply the user never finished reading.
  function streamReply(text: string, chips?: AssistantChip[]): Promise<void> {
    return new Promise(resolve => {
      const words = text.split(' ');
      setHistory(h => [...h, { role: 'assistant', content: '' }]);
      let i = 0;
      const id = setInterval(() => {
        i += 1;
        const partial = words.slice(0, i).join(' ');
        const done = i >= words.length;
        setHistory(h => {
          const c = h.slice();
          c[c.length - 1] = { role: 'assistant', content: partial, ...(done && chips ? { chips } : {}) };
          return c;
        });
        if (done) { clearInterval(id); resolve(); }
      }, 40);
    });
  }

  // #6 — voice input via the Web Speech API (feature-detected; hidden if absent).
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const retryCount = useRef(0);
  const SpeechRec = typeof window !== 'undefined'
    ? (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    : undefined;

  function stopVoice() {
    if (recRef.current) {
      try { recRef.current.stop(); } catch { /* already stopped */ }
      recRef.current = null;
    }
    setListening(false);
    setInterimText('');
    retryCount.current = 0;
  }

  function startVoice() {
    if (!SpeechRec) return;
    if (listening) { stopVoice(); return; }
    try {
      const rec = new (SpeechRec as new () => SpeechRecognitionLike)();
      rec.lang = navigator.language || 'en-US';
      rec.interimResults = true;
      rec.continuous = true;
      rec.maxAlternatives = 1;
      recRef.current = rec;
      retryCount.current = 0;
      setListening(true);
      setInterimText('');

      rec.onresult = (ev: SpeechRecognitionEventLike) => {
        let interim = '';
        let final = '';
        for (let i = ev.resultIndex; i < Object.keys(ev.results).length; i++) {
          const result = ev.results[i];
          const transcript = result?.[0]?.transcript ?? '';
          if (result?.isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }
        if (final) {
          setInput(prev => (prev ? prev + ' ' : '') + final.trim());
          setInterimText('');
        } else {
          setInterimText(interim);
        }
      };

      rec.onerror = (ev: SpeechRecognitionErrorLike) => {
        if (ev.error === 'no-speech' && retryCount.current < 2) {
          retryCount.current += 1;
          return;
        }
        const messages: Record<string, string> = {
          'no-speech': 'No speech detected — tap the mic to try again',
          'audio-capture': 'Microphone not available',
          'not-allowed': 'Microphone permission denied — enable it in browser settings',
          'aborted': '',
        };
        const msg = messages[ev.error] ?? `Voice error: ${ev.error}`;
        if (msg) toast(msg, 'error');
        stopVoice();
      };

      rec.onend = () => {
        setListening(false);
        setInterimText('');
        recRef.current = null;
      };

      rec.start();
    } catch {
      toast('Voice input not supported in this browser', 'error');
      setListening(false);
    }
  }

  function clearHistory() {
    if (!confirm('Clear all chat history?')) return;
    setHistory([]);
    ls.removeBoth('chat_history');
  }

  return (
    <div className={embedded ? 'flex flex-col flex-1 min-h-0' : undefined}>
      {!embedded && (
        <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
          <div>
            <h1 className="display-italic text-4xl text-ink mb-1.5 flex items-center gap-2.5">
              <MessageCircle className="text-coral" /> Ask Vyact
            </h1>
            {/* v10.20 — "On-device" was retired with RulesBackend; see the
                privacy block below. Ask Vyact still captures, inquires and
                plans in two taps, which is what this line is actually for. */}
            <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
              Two taps to capture, inquire, or plan
            </p>
          </div>
          {history.length > 0 && (
            <Button variant="ghost" onClick={clearHistory}>
              <Trash2 size={14} /> Clear history
            </Button>
          )}
        </div>
      )}
      {embedded && history.length > 0 && (
        <div className="flex justify-end mb-2.5">
          <button onClick={clearHistory}
            className="font-mono text-[0.62rem] tracking-wider uppercase text-ink-dim hover:text-ink">
            Clear
          </button>
        </div>
      )}

      {/* Board D M6 — the privacy line is a REASSURANCE, so it reads in sage
          (good), not coral/terra. Crit is reserved for genuine failures; saying
          where an answer is computed is not an alarm. Keep the claim scoped to
          how Ask Vyact answers today — no forever-promises about egress.

          CORRECTED IN v10.20. This block used to read "Answered on this device
          … no model involved." That stopped being true the moment RulesBackend
          was removed: a question now goes to the ask-vyact Edge Function and on
          to a model provider. The old copy was a false statement about egress
          on a finance app's chat screen, which is the worst place to leave one.

          What IS still true, and is the more useful reassurance anyway, is that
          the model never touches the arithmetic — `resolve()` computes every
          figure and `assertNoInventedFigures` discards a reply carrying a number
          no calculation produced. Claim that, because it is enforced. */}
      <div className="flex items-start gap-2.5 rounded-r2 px-3 py-2.5 mb-3.5"
        style={{ background: 'color-mix(in srgb, hsl(var(--sage)) 14%, transparent)' }}>
        <span className="text-[13px] leading-5 flex-shrink-0" aria-hidden>🔒</span>
        <p className="text-[11.5px] text-ink-mid leading-[1.4]">
          <strong className="text-ink">Your numbers are calculated, never guessed.</strong> Ask Vyact uses a model to
          understand your question and word the answer — every figure in it comes from your own data, computed here.
        </p>
      </div>

      <Panel className={embedded ? 'flex-1 min-h-0 flex flex-col' : ''}>
        <div ref={scrollRef} className={`px-4 py-4 space-y-3 overflow-y-auto ${embedded ? 'flex-1 min-h-0' : 'max-h-[28rem] min-h-[20rem]'}`}>
          {history.length === 0 && proactive && (
            <div className="mb-4 bg-coral-tint border border-coral/30 rounded-md p-3 flex items-start gap-3">
              <div className="flex-1 text-[0.84rem] text-ink leading-snug">{proactive.text}</div>
              <div className="flex items-center gap-2 shrink-0">
                {proactive.chipPrompt && (
                  <button
                    onClick={() => { const p = proactive.chipPrompt!; setProactive(null); void send(p); }}
                    className="text-[0.72rem] font-semibold text-coral hover:underline"
                  >
                    Show me
                  </button>
                )}
                <button onClick={() => setProactive(null)} className="text-ink-dim hover:text-ink text-[0.72rem]">
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {history.length === 0 && (
            <div className="py-2">
              {!expanded ? (
                <>
                  <div className="font-mono text-[0.66rem] tracking-wider uppercase text-ink-dim mb-3 text-center">
                    Pick one — type a question, or tap to act
                  </div>
                  {/* Board D M6 §.intent — the empty state IS the hero: intent
                      rows in the four production buckets, each an inset icon
                      tile beside its label. */}
                  <div className="space-y-3">
                    {BUCKETS.map(b => {
                      const items = intentsByBucket(b);
                      if (!items.length) return null;
                      return (
                        <div key={b}>
                          <div className="font-mono text-[0.58rem] tracking-[0.16em] uppercase text-ink-dim mb-2 px-1">
                            {BUCKET_LABEL[b]}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {items.map(intent => (
                              <button
                                key={intent.id}
                                onClick={() => pickIntent(intent)}
                                className="flex items-center gap-2.5 px-3 py-2.5 rounded-r2 border-none cursor-pointer text-left text-[12.5px] font-medium text-ink transition-[box-shadow,transform] hover:-translate-y-0.5"
                                style={{ background: 'var(--canvas)', boxShadow: 'var(--neu-sm)' }}
                              >
                                <span className="w-[30px] h-[30px] rounded-r2 flex items-center justify-center text-[15px] flex-shrink-0"
                                  style={{ background: 'var(--sunken)', boxShadow: 'var(--neu-inset)' }} aria-hidden>
                                  {intent.icon}
                                </span>
                                <span className="min-w-0">{intent.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => setExpanded(null)}
                      className="row-action"
                      aria-label="Back to intents"
                      title="Back"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <div className="font-mono text-[0.66rem] tracking-wider uppercase text-ink-dim">
                      {expanded.label} — pick a category
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {expanded.secondary!.map((sub, i) => (
                      <button
                        key={i}
                        onClick={() => dispatchAction(sub.action, expanded.id, 2)}
                        className="text-[0.82rem] px-3.5 py-2 bg-bg3 border border-line rounded-md hover:border-coral hover:bg-coral-tint hover:text-ink transition text-ink"
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          {history.map((m, i) => (
            <div key={i}>
              <div className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {/* Board D — .bub: user coral + accent-ink, AI neu canvas. */}
                <div className="max-w-[85%] px-4 py-2.5 text-[0.86rem] leading-relaxed"
                  style={m.role === 'user'
                    ? { background: 'var(--accent)', color: 'var(--accent-ink)', borderRadius: '18px 18px 6px 18px', boxShadow: 'var(--neu-sm)' }
                    : { background: 'var(--canvas)', color: 'var(--ff-ink)', borderRadius: '18px 18px 18px 6px', boxShadow: 'var(--neu-sm)' }}>
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
              {/* Follow-up chips (#62) — the deck's response anatomy part 4.
                  Only under the LAST turn: a chip is "the next question", and
                  the next question only makes sense after the newest answer.
                  Older turns keep their chips in the transcript (they are part
                  of what was said) but stop being tappable, so scrolling back
                  cannot silently re-ask something from ten turns ago. */}
              {m.role === 'assistant' && m.chips && m.chips.length > 0 && i === history.length - 1 && !thinking && (
                <div className="flex flex-wrap gap-1.5 mt-2 ml-1" data-testid="ask-vyact-chips">
                  {m.chips.map((c, ci) => (
                    <Chip key={ci} onClick={() => void send(c.prompt)} testId={`ask-vyact-chip-${ci}`}>
                      {c.label}
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-4 py-2.5" style={{ background: 'var(--canvas)', color: 'var(--ff-ink-3)', borderRadius: '18px 18px 18px 6px', boxShadow: 'var(--neu-sm)' }}>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--ff-ink-3)', animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--ff-ink-3)', animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--ff-ink-3)', animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-line p-3 flex gap-2 flex-shrink-0">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={listening ? (interimText || 'Listening…') : 'Ask about your spending, goals, debts…'}
            className="flex-1 bg-bg3 border border-line rounded-md px-3 py-2.5 outline-none focus:border-coral text-[0.86rem]"
          />
          {Boolean(SpeechRec) && (
            <button
              type="button" onClick={listening ? stopVoice : startVoice} aria-label={listening ? 'Stop listening' : 'Voice input'}
              title={listening ? 'Stop' : 'Speak'}
              className={`px-2.5 rounded-md border transition-all ${listening ? 'border-coral text-coral bg-coral/10 shadow-[0_0_0_3px_rgba(229,115,115,0.25)] animate-pulse' : 'border-line text-ink-mid hover:text-ink hover:border-coral'}`}>
              <Mic size={16} />
            </button>
          )}
          <Button onClick={() => send(input)} disabled={!input.trim() || thinking}>
            <Send size={14} /> Send
          </Button>
        </div>
      </Panel>
    </div>
  );
}
