'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Sparkles, Send, X } from './ui-icons';

type Msg = { role: 'user' | 'model'; text: string };

const SUGGESTIONS = ['Comment pointer ma journée ?', 'Comment poser un congé ?', 'Où voir les réunions ?', 'Comment marche le GPS du pointage ?'];

function renderText(text: string) {
  return text.split('\n').map((line, i) => (
    <span key={i}>{line}<br /></span>
  ));
}

export default function AIAssistant({ userName, isAdmin }: { userName: string; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'model', text: `Bonjour${userName ? ' ' + userName : ''} ! 👋 Je suis l'assistant Mar-ci Flow. Comment puis-je vous aider aujourd'hui${isAdmin ? ' (vue administrateur)' : ''} ?` }]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy]);

  async function ask(question: string) {
    const trimmed = question.trim();
    if (!trimmed || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: trimmed }]);
    setBusy(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-8).map((m2) => ({ role: m2.role, text: m2.text })),
        }),
      });
      const json = await res.json();
      const warning = typeof json.warning === 'string' && json.warning ? `\n\n(ℹ️ ${json.warning})` : '';
      setMessages((m) => [...m, { role: 'model', text: (json.reply ?? json.error ?? 'Désolé, une erreur est survenue.') + warning }]);
    } catch {
      setMessages((m) => [...m, { role: 'model', text: '⚠️ Connexion impossible. Réessayez dans un instant.' }]);
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    ask(input);
  }

  return (
    <>
      {!open && (
        <button className="ai-fab" onClick={() => setOpen(true)} aria-label="Assistant intelligent" title="Assistant intelligent">
          <Sparkles size={22} />
        </button>
      )}

      {open && (
        <div className="ai-panel" role="dialog" aria-label="Assistant Mar-ci Flow">
          <header className="ai-head">
            <span className="ai-avatar"><Sparkles size={17} /></span>
            <div>
              <strong>Assistant Mar-ci Flow</strong>
              <small>Réponses instantanées sur l’application</small>
            </div>
            <button className="icon-button ai-close" onClick={() => setOpen(false)} aria-label="Fermer l’assistant"><X size={16} /></button>
          </header>

          <div className="ai-messages" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={'ai-bubble ' + (m.role === 'user' ? 'me' : 'bot')}>{renderText(m.text)}</div>
            ))}
            {busy && <div className="ai-bubble bot ai-typing"><span /><span /><span /></div>}
          </div>

          {messages.length <= 1 && (
            <div className="ai-suggest">
              {SUGGESTIONS.map((s) => <button key={s} type="button" onClick={() => ask(s)}>{s}</button>)}
            </div>
          )}

          <form className="ai-input" onSubmit={submit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question…"
              maxLength={2000}
              disabled={busy}
            />
            <button type="submit" className="primary-button" disabled={busy || !input.trim()} aria-label="Envoyer"><Send size={16} /></button>
          </form>
        </div>
      )}
    </>
  );
}