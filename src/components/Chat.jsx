import { useEffect, useId, useRef } from 'react';
import { ArrowUpRight, LoaderCircle, RotateCcw, Send, Sparkles } from 'lucide-react';
import { useChat } from './ChatContext';
import ChatLeadForm from './ChatLeadForm';

const booking = 'https://calendly.com/sunrisesolution93/30min';
const errors = {
  AI_MODEL_UNAVAILABLE: 'AI chat is temporarily unavailable. Please contact our team or book a free call.',
  AI_AUTH_FAILED: 'AI chat is temporarily unavailable. Please contact our team or book a free call.',
  AI_QUOTA_EXCEEDED: 'AI chat is temporarily unavailable. Please contact our team or book a free call.',
  AI_BUSY: 'The AI request limit has been reached. Please try again later or book a free call.',
  RATE_LIMITED: 'You’ve reached the chat limit for now. Please try again later or book a free call.',
  AI_TIMEOUT: 'That reply took too long. Your message is ready to retry.',
  AI_UNAVAILABLE: 'We couldn’t get an AI reply. Your message is ready to retry, or you can book a call below.',
};

export default function Chat({ compact = false }) {
  const chat = useChat();
  const messageBox = useRef(null);
  const id = useId();
  const ready = chat.availability === 'ready';
  const unavailable = ['unconfigured', 'unavailable'].includes(chat.availability);
  useEffect(() => {
    if (messageBox.current) messageBox.current.scrollTop = messageBox.current.scrollHeight;
  }, [chat.messages, chat.pendingMessage, chat.pending, chat.error]);

  return <div className={`chat-widget live-chat ${chat.leadRequest ? 'has-handoff' : ''} ${compact ? 'compact' : ''}`}>
    <div className="chat-head">
      <span className="chat-avatar"><Sparkles size={20} /></span>
      <div><strong>Sunrise assistant</strong><small>
        {chat.pending ? 'Thinking…' : ready ? 'AI assistant · Powered by OpenAI' : chat.availability === 'loading' ? 'Checking AI connection…' : 'AI chat unavailable'}
      </small></div>
      <button className="chat-reset" onClick={chat.reset} disabled={chat.pending || chat.leadStatus === 'sending'} aria-label="Start a new conversation" title="Start a new conversation"><RotateCcw size={15} /></button>
    </div>
    <div ref={messageBox} className="messages" role="log" aria-label="Chat conversation" aria-live="polite" aria-relevant="additions">
      <p className="bot">Hi there! ☀️ I’m SunriseAI’s AI assistant. What would you love to take off your to-do list?</p>
      {chat.messages.map(message => <p key={message.id} className={message.role === 'user' ? 'user' : 'bot'}>{message.content}</p>)}
      {chat.pendingMessage && <p className="user">{chat.pendingMessage.content}</p>}
      {chat.pending && <p className="bot chat-thinking"><LoaderCircle size={14} className="chat-spinner" /> Thinking about your business…</p>}
    </div>
    {unavailable && !chat.leadRequest && <div className="chat-notice" role="status">
      <p>{chat.availability === 'unconfigured' ? 'AI chat isn’t connected yet. You can still book a free call or email our team.' : 'AI chat is temporarily unavailable. Please reconnect or book a call.'}</p>
      <button onClick={() => chat.refreshStatus()}>Retry connection</button>
    </div>}
    {chat.error && ready && <div className="chat-notice" role="status">
      <p>{errors[chat.error] || errors.AI_UNAVAILABLE}</p>
      <button disabled={chat.pending} onClick={() => chat.send(chat.pendingMessage?.content || chat.draft)}>Retry message</button>
    </div>}
    {!chat.messages.length && !chat.pendingMessage && <div className="quick-replies">
      {['Build an AI bot', 'Automate my workflow', 'Discuss my goals'].map(text => <button key={text} disabled={chat.pending} onClick={() => chat.send(text)}>{text}</button>)}
    </div>}
    {chat.leadRequest ? <ChatLeadForm /> : <form aria-label="Message Sunrise assistant" onSubmit={event => { event.preventDefault(); chat.send(chat.draft); }}>
      <input aria-label="Message the AI assistant" aria-describedby={id + '-privacy'} placeholder={ready ? 'Tell us about your business…' : 'AI chat is unavailable'} value={chat.draft} onChange={event => chat.setDraft(event.target.value)} maxLength={2000} disabled={!ready || chat.pending} autoComplete="off" />
      <button aria-label="Send message" disabled={!ready || chat.pending || !chat.draft.trim()}>{chat.pending ? <LoaderCircle size={17} className="chat-spinner" /> : <Send size={17} />}</button>
    </form>}
    <div className="chat-links"><a href={booking}>Book a free strategy call <ArrowUpRight size={12} /></a><a href="mailto:sunrisesolution93@gmail.com">Email us</a></div>
    <small id={id + '-privacy'} className="chat-privacy">General questions are processed by OpenAI. AI can make mistakes; avoid sharing sensitive information.</small>
  </div>;
}
