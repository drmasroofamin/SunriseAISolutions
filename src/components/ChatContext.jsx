import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { buildChatHistory, requestChatReply } from '../chat';
import { getChatHandoff } from '../../shared/chat-handoff';
import { submitEnquiry } from '../enquiry';

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
  const [leadRequest, setLeadRequest] = useState('');
  const [leadFields, setLeadFields] = useState({ name: '', email: '', company: '' });
  const [leadStatus, setLeadStatus] = useState('idle');
  const leadInFlight = useRef(false);
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
    if (inFlight.current || leadInFlight.current || !content || content.length > 2000) return;
    const history = buildChatHistory(messages, content);
    const localHandoff = getChatHandoff(history);
    if (availability !== 'ready' && !localHandoff) { setError('AI_NOT_CONFIGURED'); return; }
    inFlight.current = true;
    setPending(true);
    setError('');
    setDraft('');
    const user = { id: ++nextId.current, role: 'user', content };
    setPendingMessage(user);
    try {
      const result = localHandoff || await requestChatReply(history);
      setMessages(previous => [...previous.slice(-58), user, { id: ++nextId.current, role: 'assistant', content: result.reply }]);
      if (result.showLeadForm) { setLeadRequest(result.request || content); setLeadStatus('idle'); }
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

  async function sendLead(event) {
    event.preventDefault();
    if (leadInFlight.current || !leadRequest || leadStatus === 'accepted') return;
    leadInFlight.current = true;
    setLeadStatus('sending');
    try {
      await submitEnquiry({
        name: leadFields.name.trim() || 'Chat visitor',
        email: leadFields.email.trim(), company: leadFields.company.trim(),
        service: 'AI consultation',
        message: `Consultation requested through Sunrise assistant.\nRequested solution: ${leadRequest}`,
        website: '',
      });
      setLeadStatus('accepted');
    } catch (failure) {
      setLeadStatus(failure.code === 'MAIL_NOT_CONFIGURED' ? 'unconfigured' : 'error');
    } finally { leadInFlight.current = false; }
  }

  function reset() {
    if (inFlight.current || leadInFlight.current) return;
    setMessages([]); setPendingMessage(null); setError(''); setDraft('');
    setLeadRequest(''); setLeadFields({ name: '', email: '', company: '' }); setLeadStatus('idle');
  }

  return <ChatContext.Provider value={{ messages, draft, setDraft, pendingMessage, pending, error, availability, send, reset, refreshStatus, leadRequest, leadFields, setLeadFields, leadStatus, sendLead }}>
    {children}
  </ChatContext.Provider>;
}
