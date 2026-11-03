import { ArrowUpRight, LoaderCircle } from 'lucide-react';
import { useChat } from './ChatContext';

const booking = 'https://calendly.com/sunrisesolution93/30min';
export default function ChatLeadForm() {
  const chat = useChat();
  const sending = chat.leadStatus === 'sending';
  const accepted = chat.leadStatus === 'accepted';
  function change(event) {
    chat.setLeadFields(previous => ({ ...previous, [event.target.name]: event.target.value }));
  }
  return <div className="chat-handoff">
    <a className="button chat-book-button" href={booking} target="_blank" rel="noopener noreferrer">Choose a time in our calendar <ArrowUpRight size={14} /></a>
    <form className="chat-lead-form" aria-label="Request team follow-up" onSubmit={chat.sendLead}>
      <h4>Or let our team contact you</h4>
      <fieldset disabled={sending || accepted}>
        <label>Your name <span>(optional)</span><input name="name" value={chat.leadFields.name} onChange={change} maxLength={120} autoComplete="name" /></label>
        <label>Contact email<input name="email" type="email" value={chat.leadFields.email} onChange={change} required maxLength={254} autoComplete="email" /></label>
        <label>Company or niche<input name="company" value={chat.leadFields.company} onChange={change} required maxLength={200} placeholder="e.g. Sunrise Clinic or real estate" /></label>
        <button type="submit" className="button">{sending ? 'Sending details…' : accepted ? 'Details submitted' : 'Send contact details'}{sending ? <LoaderCircle size={14} className="chat-spinner" /> : <ArrowUpRight size={14} />}</button>
      </fieldset>
      <p className="chat-lead-consent">By sending, you ask SunriseAI to contact you about your enquiry. These fields are sent to our team by email, not to OpenAI.</p>
      <div role="status" aria-live="polite">
        {accepted && <p className="chat-lead-success">Thank you—your details were accepted for email delivery to our team. You can also choose a meeting time above.</p>}
        {chat.leadStatus === 'error' && <p className="chat-lead-error">We couldn’t confirm your details were sent. They’re still here. Please try again, email us, or book a time above.</p>}
        {chat.leadStatus === 'unconfigured' && <p className="chat-lead-error">Email follow-up is temporarily unavailable. Please book a time above or email sunrisesolution93@gmail.com.</p>}
      </div>
    </form>
  </div>;
}
