import { useState, useRef, useEffect, useMemo } from 'react';
import { Send, MessageCircle, ShieldCheck, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { Panel } from '../components/ui/Card';
import Button from '../components/ui/Button';
import {
  buildSafeSummary, StubChatBackend, type ChatMessage,
} from '../lib/aiSummary';

const SUGGESTED = [
  'How much did I spend this month?',
  "What's my Pulse Score and why?",
  "What's my net worth?",
  'How am I doing on my emergency fund?',
  'Any budget warnings?',
  'Tell me about my debts',
];

const backend = new StubChatBackend();

export default function Chat() {
  const txns    = useStore(s => s.transactions);
  const budgets = useStore(s => s.budgets);
  const goals   = useStore(s => s.goals);
  const debts   = useStore(s => s.debts);
  const assets  = useStore(s => s.assets);
  const profile = useStore(s => s.profile);
  const rates   = useStore(s => s.rates);
  const members = useStore(s => s.members);

  const [history, setHistory] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(localStorage.getItem('ff_chat_history') || '[]'); }
    catch { return []; }
  });
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Privacy-safe summary built from current state — never includes merchant names or descriptions
  const summary = useMemo(() => {
    const s = buildSafeSummary(txns, budgets, goals, debts, assets, profile, rates);
    s.household.members = members.length;
    return s;
  }, [txns, budgets, goals, debts, assets, profile, rates, members.length]);

  useEffect(() => {
    localStorage.setItem('ff_chat_history', JSON.stringify(history));
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [history]);

  async function send(question: string) {
    if (!question.trim() || thinking) return;
    const userMsg: ChatMessage = { role: 'user', content: question };
    setHistory(h => [...h, userMsg]);
    setInput('');
    setThinking(true);

    try {
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
    localStorage.removeItem('ff_chat_history');
  }

  return (
    <div>
      <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="display-italic text-4xl text-ink mb-1.5 flex items-center gap-2.5">
            <MessageCircle className="text-coral" /> Chat
          </h1>
          <p className="font-mono text-[0.6rem] tracking-[0.14em] uppercase text-ink-dim">
            Ask questions about your finances · Privacy-first
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
          {history.length === 0 && (
            <div className="text-center py-8">
              <div className="text-3xl mb-3 opacity-60">💬</div>
              <div className="font-mono text-[0.66rem] tracking-wider uppercase text-ink-dim mb-4">Try asking</div>
              <div className="grid sm:grid-cols-2 gap-2 max-w-lg mx-auto">
                {SUGGESTED.map(q => (
                  <button key={q} onClick={() => send(q)}
                    className="text-left p-3 bg-bg3 border border-line rounded-md hover:border-coral hover:bg-coral-tint transition text-[0.82rem] text-ink">
                    {q}
                  </button>
                ))}
              </div>
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
