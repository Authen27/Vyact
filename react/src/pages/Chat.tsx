import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, MessageCircle, ShieldCheck, Trash2, ChevronLeft } from 'lucide-react';
import { useStore } from '../store';
import { Panel } from '../components/ui/Card';
import Button from '../components/ui/Button';
import {
  buildSafeSummary, selectChatBackend, type ChatMessage,
} from '../lib/aiSummary';
import { logAiUsage } from '../lib/aiUsage';
import ls from '../lib/localStorageCompat';
import {
  INTENTS, BUCKET_LABEL, intentsByBucket, type Bucket, type Intent, type IntentAction,
} from '../lib/askVyactIntents';
import { isAskVyactEnabled, FEATURES } from '../config/features';
import {
  runAssistant, proactiveInsight, selectAssistantBackend, type AssistantContext,
} from '../lib/askVyactBackend';

const BUCKETS: Bucket[] = ['capture', 'inquire', 'plan', 'manage'];

const backend = selectChatBackend();
const assistantBackend = selectAssistantBackend();

export default function Chat() {
  const navigate = useNavigate();
  const txns    = useStore(s => s.transactions);
  const budgets = useStore(s => s.budgets);
  const goals   = useStore(s => s.goals);
  const debts   = useStore(s => s.debts);
  const assets  = useStore(s => s.assets);
  const profile = useStore(s => s.profile);
  const rates   = useStore(s => s.rates);
  const members = useStore(s => s.members);
  const householdId = useStore(s => s.currentHouseholdId);
  const openAddTxn    = useStore(s => s.openAddTxn);
  const openAddGoal   = useStore(s => s.openAddGoal);
  const openAddBudget = useStore(s => s.openAddBudget);
  const openAddDebt   = useStore(s => s.openAddDebt);
  const openAddAsset  = useStore(s => s.openAddAsset);

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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history]);

  // Surface one proactive insight on open (rate-limited to one per session).
  useEffect(() => {
    if (!isAskVyactEnabled() || !FEATURES.askVyact.proactiveInsight) return;
    try { if (sessionStorage.getItem('askvyact_proactive_shown') === '1') return; } catch { /* noop */ }
    const ctx: AssistantContext = {
      summary, transactions: txns, budgets, goals, debts, assets,
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
        case 'addGoal':   openAddGoal();   break;
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

    // Privacy-safe usage metric (intent + sentiment only, no message text).
    void logAiUsage({ householdId, text: question, surface: 'chat' });

    try {
      // Ask Vyact assistant (spec §3). When the flag is OFF this whole branch is
      // skipped and the launcher behaves exactly as it did in v7.4.5.
      if (isAskVyactEnabled()) {
        const ctx: AssistantContext = {
          summary, transactions: txns, budgets, goals, debts, assets,
          profile, rates, baseCurrency: profile.baseCurrency,
        };
        const turn = runAssistant(question, ctx, assistantBackend);
        // Capture intents seed the EXISTING TransactionFormModal — no parallel path.
        if (turn.seed) openAddTxn(turn.seed);
        setHistory(h => [...h, { role: 'assistant', content: turn.reply }]);
        return;
      }
      const answer = await backend.ask(question, summary, history);
      setHistory(h => [...h, { role: 'assistant', content: answer }]);
    } catch (e) {
      setHistory(h => [...h, { role: 'assistant', content: `Error: ${(e as Error).message}` }]);
    } finally {
      setThinking(false);
    }
  }

  function clearHistory() {
    if (!confirm('Clear all chat history?')) return;
    setHistory([]);
    ls.removeBoth('chat_history');
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5 flex items-center gap-2.5">
            <MessageCircle className="text-coral" /> Chat
            {!backend.isReal() && (
              <span className="inline-block text-[0.55rem] font-mono tracking-[0.14em] uppercase text-coral border border-coral/40 bg-coral-tint rounded px-1.5 py-0.5 align-middle" title="Beta — stub backend (TD-07). Set VITE_GEMINI_API_KEY to enable Gemini.">Beta</span>
            )}
            {backend.isReal() && (
              <span className="inline-block text-[0.55rem] font-mono tracking-[0.14em] uppercase text-sage border border-sage/40 bg-sage/10 rounded px-1.5 py-0.5 align-middle" title="Powered by Google Gemini 1.5 Flash (free tier)">Gemini</span>
            )}
          </h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            Ask Vyact · Two taps to capture, inquire, plan, or navigate
          </p>
        </div>
        {history.length > 0 && (
          <Button variant="ghost" onClick={clearHistory}>
            <Trash2 size={14} /> Clear history
          </Button>
        )}
      </div>

      {/* Privacy notice */}
      <div className="bg-coral-tint border border-coral/30 rounded-md p-4 mb-3.5 flex items-start gap-3">
        <ShieldCheck size={20} className="text-terra flex-shrink-0 mt-0.5" />
        <div className="text-[0.84rem] text-ink-mid leading-relaxed">
          <strong className="text-ink">Privacy by design.</strong> Only aggregated summaries leave your device — never merchant names,
          transaction descriptions, or notes. {!backend.isReal() && (
            <span className="block mt-2 font-mono text-[0.7rem] tracking-wide text-ink-dim">
              Currently in <strong>stub mode</strong> — answers come from a local pattern-matcher. v8 wires Anthropic Claude via Supabase Edge Function with rate limiting.
            </span>
          )}
        </div>
      </div>

      <Panel>
        <div ref={scrollRef} className="px-4 py-4 space-y-3 max-h-[28rem] min-h-[20rem] overflow-y-auto">
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
                  <div className="space-y-3">
                    {BUCKETS.map(b => {
                      const items = intentsByBucket(b);
                      if (!items.length) return null;
                      return (
                        <div key={b}>
                          <div className="font-mono text-[0.58rem] tracking-[0.16em] uppercase text-ink-dim mb-1.5 px-1">
                            {BUCKET_LABEL[b]}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {items.map(intent => (
                              <button
                                key={intent.id}
                                onClick={() => pickIntent(intent)}
                                className="text-[0.78rem] px-3 py-1.5 bg-bg3 border border-line rounded-full hover:border-coral hover:bg-coral-tint hover:text-ink transition text-ink-mid"
                              >
                                {intent.label}
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
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] px-4 py-2.5 rounded-lg ${
                m.role === 'user'
                  ? 'bg-coral text-white rounded-br-sm'
                  : 'bg-bg3 text-ink border border-line rounded-bl-sm'
              }`}>
                <div className="text-[0.86rem] leading-relaxed whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-4 py-2.5 rounded-lg bg-bg3 text-ink-dim border border-line">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-ink-dim rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-ink-dim rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-ink-dim rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-line p-3 flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about your spending, goals, debts…"
            className="flex-1 bg-bg3 border border-line rounded-md px-3 py-2.5 outline-none focus:border-coral text-[0.86rem]"
          />
          <Button onClick={() => send(input)} disabled={!input.trim() || thinking}>
            <Send size={14} /> Send
          </Button>
        </div>
      </Panel>
    </div>
  );
}
