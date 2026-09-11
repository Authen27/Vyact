import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, MessageCircle, Trash2, Mic, PencilLine, Plus, List } from 'lucide-react';
import { useStore } from '../store';
import { Panel } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
  buildSafeSummary, type ChatMessage,
} from '../lib/aiSummary';
import type { AssistantChip } from '../lib/askVyactResponses';
import { logAiUsage } from '../lib/aiUsage';
import ls from '../lib/localStorageCompat';
import {
  BUCKET_LABEL, intentsByBucket, intentExample, type Bucket, type IntentAction,
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
  const accounts = useStore(s => s.accounts);
  const budgetAllocations = useStore(s => s.budgetAllocations);
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
    // Audit S5 — the transcript is household-scoped. One global 'chat_history'
    // key used to share a conversation across every household (and, on a shared
    // device, across users until the cache epoch purge). One-time: the legacy
    // global key seeds THIS household's transcript, then is removed.
    const key = `chat_history_${householdId}`;
    try {
      const scoped = ls.readJson<ChatMessage[]>(key);
      if (scoped) return scoped;
      const legacy = ls.readJson<ChatMessage[]>('chat_history');
      if (legacy) {
        try { ls.setJson(key, legacy); } catch { /* noop */ }
        try { localStorage.removeItem('vt_chat_history'); localStorage.removeItem('chat_history'); } catch { /* noop */ }
        return legacy;
      }
      return [];
    }
    catch { return []; }
  });
  const [input, setInput] = useState('');
  // Audit 6.5 — an ACTIVE TURN, not a boolean. `thinking` was a bare flag that
  // cleared before the simulated stream finished, and the stream rewrote the
  // LAST history item — so a new message sent mid-stream corrupted the prior
  // reply. A turn carries its own id and a cancel handle; the stream appends
  // by id and can never clobber another turn's row.
  const [activeTurn, setActiveTurn] = useState<{ id: string; cancel: () => void } | null>(null);
  const thinking = activeTurn !== null;
  // v7.4.5 — when an intent has secondary chips, hold it here so the
  // empty-state grid swaps to the tap-2 row.
  const [showExamples, setShowExamples] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
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
    // Audit F3/F5 — the assistant sees the same account-aware net worth and
    // allocation-derived budget lines the UI renders.
    const s = buildSafeSummary(txns, budgets, goals, debts, assets, profile, rates, accounts, budgetAllocations);
    s.household.members = members.length;
    return s;
  }, [txns, budgets, goals, debts, assets, profile, rates, accounts, budgetAllocations, members.length]);

  useEffect(() => {
    // Audit S5 — persist under the household-scoped key (matches the init).
    ls.setJson(`chat_history_${householdId}`, history);
    // Only auto-scroll to the newest message on a real turn — never on open.
    if (!didMountScroll.current) { didMountScroll.current = true; return; }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history, householdId]);

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
    console.debug('[ask-vyact-intent]', { id: intentId, taps });
    if (action.kind === 'open-modal') {
      switch (action.modal) {
        case 'addTxn':    openAddTxn(action.seed); break;
        case 'addBudget': openAddBudget(); break;
        case 'addDebt':   openAddDebt();   break;
        case 'addAsset':  openAddAsset();  break;
      }
      setShowExamples(false);
    } else if (action.kind === 'navigate') {
      navigate(action.to);
    } else if (action.kind === 'ask') {
      prepareQuestion(action.prompt);
    }
  }

  function prepareQuestion(question: string) {
    setInput(question);
    inputRef.current?.focus();
  }

  async function send(question: string) {
    // Audit 6.5 — one turn at a time. `thinking` === activeTurn !== null, so a
    // send during an in-flight stream is refused and can never interleave rows.
    if (!question.trim() || activeTurn) return;
    const userMsg: ChatMessage = { role: 'user', content: question };
    setHistory(h => [...h, userMsg]);
    setInput('');
    // Mark the turn active immediately (streamReply replaces this with the
    // cancellable record once the reply row exists). An id of 'pending' keeps
    // the finally-block guard from clearing it early.
    setActiveTurn({ id: 'pending', cancel: () => {} });

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
        // Audit 6.5 — the turn's reply row is created NOW (its id is the turn's
        // anchor) and the stream writes THAT row by id. The turn stays active
        // until the stream resolves, so a concurrent send is blocked by
        // `thinking` (activeTurn) and can never clobber this row.
        await streamReply(turn.reply, turn.chips);
        setActiveTurn(null);
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
      // The stream path clears activeTurn itself after the reply settles; the
      // off / error paths never started a stream, so clear any pending marker.
      setActiveTurn(t => (t && t.id === 'pending' ? null : t));
    }
  }

  // #4 — stream an assistant reply word-by-word (resolves when complete).
  //
  // Audit 6.5 — the reply row carries a unique `turnId` and the interval writes
  // THAT row, matched by id, never "the last item". A new message arriving
  // mid-stream appends its own rows; this stream keeps writing its own row and
  // cannot corrupt it. `chips` attach only once the last word lands (#62).
  function streamReply(text: string, chips?: AssistantChip[]): Promise<void> {
    return new Promise(resolve => {
      const turnId = `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const words = text.split(' ');
      // The reply row is appended with its id. From here every update targets
      // this id — immune to anything appended after it.
      setHistory(h => [...h, { role: 'assistant', content: '', turnId } as ChatMessage]);
      let i = 0;
      const id = setInterval(() => {
        i += 1;
        const partial = words.slice(0, i).join(' ');
        const done = i >= words.length;
        setHistory(h => h.map(msg =>
          (msg as ChatMessage & { turnId?: string }).turnId === turnId
            ? { ...msg, content: partial, ...(done && chips ? { chips } : {}) }
            : msg,
        ));
        if (done) { clearInterval(id); resolve(); }
      }, 40);
      // Register the cancellable turn so the UI can stop it and `thinking`
      // (activeTurn) stays true until the stream settles.
      setActiveTurn({
        id: turnId,
        cancel: () => { clearInterval(id); resolve(); },
      });
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
    <div className={`ui-pilot reading-surface ${embedded ? 'flex flex-col flex-1 min-h-0' : ''}`}>
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
              Record money · understand your household · explore a decision
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
        {/* v10.20.1 — softened from "Your numbers are calculated, never guessed."
            That claimed the guard proves every figure correct. It does not: it
            checks numeric tokens against the computed values, exempts small
            counts, and cannot see sign, unit or framing. Describe the DIVISION
            OF LABOUR, which is true and is the reassurance that actually
            matters, rather than a guarantee the code does not make. */}
        <p className="text-[11.5px] text-ink-mid leading-[1.4]">
          <strong className="text-ink">Vyact does the maths, not the model.</strong> Every amount comes from your own
          data, calculated here. The model reads your question and puts the answer into words.
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
                    onClick={() => { const p = proactive.chipPrompt!; setProactive(null); prepareQuestion(p); }}
                    className="text-[0.72rem] font-semibold text-coral hover:underline"
                  >
                    Use question
                  </button>
                )}
                <button onClick={() => setProactive(null)} className="text-ink-dim hover:text-ink text-[0.72rem]">
                  Dismiss
                </button>
              </div>
            </div>
          )}
          {(history.length === 0 || showExamples) && (
            <div className="py-2">
                <>
                  <div className="text-sm text-ink-mid mb-3 leading-relaxed">
                    Use an example, replace its details, then Send. Form shortcuts open an editor without asking the model or saving a record.
                  </div>
                  <p className="text-xs text-ink-dim mb-4">Examples use your household currency. Check accounts, dates and amounts before saving a proposed transaction. Answers need a reachable model service.</p>
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
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2">
                            {items.map(intent => {
                              const example = intentExample(intent);
                              return <div key={intent.id} className="min-w-0 border-b border-line py-3" data-testid={`ask-intent-${intent.id}`}>
                                <div className="flex items-center gap-1 min-w-0">
                                  <h3 className="text-sm text-ink flex items-center gap-2 min-w-0"><span aria-hidden>{intent.icon}</span>{intent.label}</h3>
                                  {example && <button type="button" aria-label={`Use example: ${intent.label}`} title={`Use example: ${intent.label}`}
                                    onClick={() => prepareQuestion(example)} disabled={thinking}
                                    className="inline-flex items-center justify-center w-11 h-11 shrink-0 rounded-md text-ink-dim hover:text-coral hover:bg-bg3 disabled:opacity-50 disabled:cursor-not-allowed">
                                    <PencilLine size={16} aria-hidden />
                                  </button>}
                                </div>
                                {example && <p className="text-sm text-ink-mid mt-2 leading-relaxed [overflow-wrap:anywhere]">{example}</p>}
                                {intent.inputHint && <p className="text-xs text-ink-dim mt-2 leading-relaxed">{intent.inputHint}</p>}
                                {intent.action?.kind === 'open-modal' && <div className="flex items-center gap-2 flex-wrap mt-2">
                                  <Button variant="ghost" aria-label={`Open form: ${intent.label}`}
                                    onClick={() => dispatchAction(intent.action!, intent.id, 1)} disabled={thinking}>
                                    <Plus size={14} aria-hidden /> Open form
                                  </Button>
                                </div>}
                              </div>;
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
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
                <div className="flex flex-col gap-2 mt-2 min-w-0" data-testid="ask-vyact-chips">
                  {m.chips.map((c, ci) => (
                    <Button key={ci} variant="ghost" onClick={() => prepareQuestion(c.prompt)} data-testid={`ask-vyact-chip-${ci}`}
                      className="w-full text-left justify-start" aria-label={`Use question: ${c.prompt}`}>
                      <PencilLine size={14} className="shrink-0" aria-hidden />
                      <span className="min-w-0 [overflow-wrap:anywhere]"><span className="block">{c.prompt}</span><span className="block text-xs text-ink-dim mt-1">Use question</span></span>
                    </Button>
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

        {history.length > 0 && <Button variant="ghost" onClick={() => setShowExamples(value => !value)} aria-expanded={showExamples}>
          <List size={14} aria-hidden /> {showExamples ? 'Hide examples' : 'Show examples'}
        </Button>}
        <div className="border-t border-line p-3 flex gap-2 flex-shrink-0 flex-wrap">
          <label htmlFor={embedded ? 'ask-drawer-input' : 'ask-page-input'} className="w-full text-xs text-ink-dim">Your question or entry</label>
          <Input ref={inputRef} id={embedded ? 'ask-drawer-input' : 'ask-page-input'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={listening ? (interimText || 'Listening…') : 'e.g. How much did I spend this month?'}
            className="flex-1 min-w-0"
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
