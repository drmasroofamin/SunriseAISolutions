import { useRef, useState } from 'react';
import { ArrowUpRight, Check, Mail } from 'lucide-react';
import { buildEmailDraft, submitEnquiry } from '../enquiry';

const emptyFields = { name: '', email: '', company: '', service: '', message: '', website: '' };

export default function ContactForm({ email, calendly, services }) {
  const [fields, setFields] = useState(emptyFields);
  const [status, setStatus] = useState('idle');
  const inFlight = useRef(false);
  const draft = buildEmailDraft(email, fields);
  const sending = status === 'sending';

  function changeField(event) {
    setFields(previous => ({ ...previous, [event.target.name]: event.target.value }));
    // Editing after acceptance creates a new enquiry, without losing the draft.
    if (status === 'accepted') setStatus('idle');
  }

  async function send(event) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus('sending');
    try {
      await submitEnquiry(fields);
      setStatus('accepted');
    } catch (error) {
      // Preserve every field, including when the provider returns an HTML error page.
      setStatus(error.code === 'MAIL_NOT_CONFIGURED' ? 'unconfigured' : 'error');
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <form className="contact-form" onSubmit={send} aria-busy={sending}>
      <h3>Let's talk about your business.</h3>
      <fieldset disabled={sending}>
        <div className="enquiry-honeypot" aria-hidden="true">
          <label>Leave this empty
            <input name="website" tabIndex={-1} autoComplete="off" value={fields.website} onChange={changeField} />
          </label>
        </div>
        <div className="form-row">
          <label>Your name
            <input name="name" placeholder="Alex Morgan" required autoComplete="name"
              maxLength={120} value={fields.name} onChange={changeField} />
          </label>
          <label>Work email
            <input type="email" name="email" placeholder="alex@company.com" required autoComplete="email"
              maxLength={254} value={fields.email} onChange={changeField} />
          </label>
        </div>
        <label>Company
          <input name="company" placeholder="Your company name" required autoComplete="organization"
            maxLength={200} value={fields.company} onChange={changeField} />
        </label>
        <label>What can we help with?
          <select name="service" required value={fields.service} onChange={changeField}>
            <option value="" disabled>Select a service</option>
            {services.map(service => <option key={service.title}>{service.title}</option>)}
            <option>Help me find the right solution</option>
          </select>
        </label>
        <label>Tell us a little more
          <textarea name="message" placeholder="What's taking up too much of your time?" rows="3"
            required maxLength={5000} value={fields.message} onChange={changeField} />
        </label>
        <button className="button" type="submit" disabled={sending || status === 'accepted'}>
          {sending ? 'Sending…' : status === 'accepted' ? 'Enquiry Submitted' : status === 'error' || status === 'unconfigured' ? 'Try Again' : 'Send Enquiry'}
          {status === 'accepted' ? <Check size={16} /> : <ArrowUpRight size={16} />}
        </button>
      </fieldset>

      <div aria-live="polite" aria-atomic="true">
        {status === 'sending' && <p className="enquiry-status">Sending your enquiry. Please keep this page open.</p>}
        {status === 'accepted' && (
          <p className="enquiry-status enquiry-accepted">
            Your enquiry was accepted for email delivery. Prefer to arrange a time now?{' '}
            <a href={calendly}>Book your free strategy call.</a>
          </p>
        )}
        {status === 'unconfigured' && (
          <p className="enquiry-status enquiry-error">
            Online enquiry delivery is being set up. Your details are still here.
            Please email your enquiry below or <a href={calendly}>book a call directly</a>.
          </p>
        )}
        {status === 'error' && (
          <p className="enquiry-status enquiry-error">
            We couldn't confirm your enquiry was sent. Your details are still here.
            You can try again, email your enquiry below, or <a href={calendly}>book a call directly</a>.
          </p>
        )}
      </div>

      <div className="enquiry-alternatives">
        <span><Mail size={14} /> Prefer email?</span>
        <div className="enquiry-links">
          <a href={draft.gmail} target="_blank" rel="noopener noreferrer">Open in Gmail <ArrowUpRight size={12} /></a>
          <a href={draft.mailto}>Open email app <ArrowUpRight size={12} /></a>
        </div>
        <small>These links copy your details into an email draft. Review it and press Send to email {email}.</small>
      </div>
      <small>Your enquiry is sent privately to our team. You can also{' '}
        <a href={calendly}>choose a time on Calendly</a>.
      </small>
    </form>
  );
}
