import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { buildChatHistory, requestChatReply } from '../chat';

const ChatContext = createContext(null);
export function useChat() { return useContext(ChatContext); }

// Embedded and floating widgets share one conversation. No browser persistence.
export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [pendingMessage, setPendingMessage] = useState(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [availability, setAvailability] = useState('loading');
  const inFlight = useRef(false);
  const nextId = useRef(0);

  async function refreshStatus(signal) {
    setAvailability('loading');
    try {
      const response = await fetch('/api/chat/status', { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000) });
      const status = await response.json();
      if (!response.ok || typeof status?.configured !== 'boolean') throw Error();
      setAvailability(status.configured ? 'ready' : 'unconfigured');
    } catch {
      if (!signal?.aborted) setAvailability('unavailable');
    }
  }
  useEffect(() => {
    const controller = new AbortController();
    refreshStatus(controller.signal);
    return () => controller.abort();
  }, []);

  async function send(text) {
    const content = text.trim();
    if (inFlight.current || availability !== 'ready' || !content || content.length > 2000) return;
    inFlight.current = true;
    setPending(true);
    setError('');
    setDraft('');
    const user = { id: ++nextId.current, role: 'user', content };
    setPendingMessage(user);
    try {
      const reply = await requestChatReply(buildChatHistory(messages, content));
      setMessages(previous => [...previous.slice(-58), user, { id: ++nextId.current, role: 'assistant', content: reply }]);
      setPendingMessage(null);
    } catch (failure) {
      setDraft(content);
      setError(failure.code || 'AI_UNAVAILABLE');
      if (failure.code === 'AI_NOT_CONFIGURED') setAvailability('unconfigured');
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function reset() {
    if (inFlight.current) return;
    setMessages([]); setPendingMessage(null); setError(''); setDraft('');
  }

  return <ChatContext.Provider value={{ messages, draft, setDraft, pendingMessage, pending, error, availability, send, reset, refreshStatus }}>
    {children}
  </ChatContext.Provider>;
}
