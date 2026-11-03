import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronLeft, Edit3, LoaderCircle, Mic, MicOff, Phone, Volume2, VolumeX, X } from 'lucide-react';
import { VOICE_STEPS, normalizeSpokenEmail, validateVoiceField } from '../../shared/voice-flow';
import { requestVoiceSolution } from '../voice';
import { submitEnquiry } from '../enquiry';
import './VoiceAgent.css';

const BOOKING_URL = 'https://calendly.com/sunrisesolution93/30min';
const EMPTY_FIELDS = { requirement: '', name: '', email: '', niche: '' };
const LIMITS = { requirement: 2000, name: 120, email: 254, niche: 200 };
const AI_ERRORS = {
  AI_NOT_CONFIGURED: 'AI guidance is not connected yet. You can still book a free discussion with our team.',
  AI_AUTH_FAILED: 'AI guidance is temporarily unavailable. Please book a free discussion or try again later.',
  AI_QUOTA_EXCEEDED: 'AI guidance is temporarily unavailable. Please book a free discussion or try again later.',
  AI_MODEL_UNAVAILABLE: 'AI guidance is temporarily unavailable. Please book a free discussion or try again later.',
  AI_BUSY: 'The AI request limit has been reached. Please wait before retrying, or book a free discussion.',
  RATE_LIMITED: 'You have reached the consultation limit for now. Please try again later or book a free call.',
  AI_TIMEOUT: 'Your suggestion took too long. Your answers are still here; you can try again or book a call.',
};

export default function VoiceAgent({ onClose }) {
  const id = useId();
  const [stage, setStage] = useState('intro');
  const [stepIndex, setStepIndex] = useState(0);
  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [draft, setDraft] = useState('');
  const [answerError, setAnswerError] = useState('');
  const [reviewErrors, setReviewErrors] = useState({});
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [spokenEnabled, setSpokenEnabled] = useState(true);
  const [speechNotice, setSpeechNotice] = useState('');
  const [generating, setGenerating] = useState(false);
  const [solution, setSolution] = useState('');
  const [solutionError, setSolutionError] = useState('');
  const [leadStatus, setLeadStatus] = useState('idle');
  const dialogRef = useRef(null);
  const contentRef = useRef(null);
  const closeRef = useRef(null);
  const answerRef = useRef(null);
  const reviewRefs = useRef({});
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const requestRef = useRef(null);
  const mountedRef = useRef(false);
  const busyRef = useRef(false);
  const cachedRequestRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const Recognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const canSpeak = typeof window !== 'undefined' && Boolean(window.speechSynthesis && typeof window.speechSynthesis.speak === 'function' && typeof window.SpeechSynthesisUtterance === 'function');
  const step = VOICE_STEPS[stepIndex];

  function stopListening() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.abort(); } catch { /* Already stopped. */ }
    }
    if (mountedRef.current) setListening(false);
  }

  function stopSpeaking() {
    const utterance = utteranceRef.current;
    utteranceRef.current = null;
    if (utterance) {
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
    }
    if (canSpeak) window.speechSynthesis.cancel();
    if (mountedRef.current) setSpeaking(false);
  }

  function speak(text) {
    stopListening();
    stopSpeaking();
    if (!spokenEnabled || !canSpeak) return;
    try {
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.98;
      const voice = window.speechSynthesis.getVoices?.().find(item => item.lang?.startsWith('en'));
      if (voice) utterance.voice = voice;
      utterance.onstart = () => { if (mountedRef.current) setSpeaking(true); };
      utterance.onend = () => { if (mountedRef.current) setSpeaking(false); utteranceRef.current = null; };
      utterance.onerror = event => {
        if (!mountedRef.current || ['interrupted', 'canceled'].includes(event.error)) return;
        setSpeaking(false);
        setSpeechNotice('Spoken replies are unavailable right now. Every response is shown on screen, and you can continue by typing.');
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    } catch {
      if (mountedRef.current) setSpeechNotice('Spoken replies are unavailable. You can read each response and continue by typing.');
    }
  }

  function close() {
    requestRef.current?.abort();
    stopListening();
    stopSpeaking();
    onCloseRef.current();
  }

  useEffect(() => {
    mountedRef.current = true;
    const opener = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function trapFocus(event) {
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key !== 'Tab') return;
      const focusable = [...(dialogRef.current?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex="0"]') || [])]
        .filter(element => element.getClientRects().length && !element.matches(':disabled'));
      const first = focusable[0], last = focusable.at(-1);
      if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener('keydown', trapFocus);
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
      stopListening();
      stopSpeaking();
      document.removeEventListener('keydown', trapFocus);
      document.body.style.overflow = previousOverflow;
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
    // This modal owns these resources for its entire mounted lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
    if (stage === 'questions') answerRef.current?.focus();
  }, [stage, stepIndex]);

  function start() {
    setStage('questions');
    setStepIndex(0);
    setDraft(fields.requirement);
    speak(VOICE_STEPS[0].prompt);
  }

  function listen() {
    if (!Recognition || busyRef.current) return;
    if (listening) { stopListening(); return; }
    stopSpeaking();
    stopListening();
    setSpeechNotice('');
    try {
      const recognition = new Recognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onresult = event => {
        if (!mountedRef.current) return;
        const transcript = Array.from(event.results).map(result => result[0]?.transcript || '').join(' ').trim();
        setDraft(step.key === 'email' ? normalizeSpokenEmail(transcript) : transcript);
        setAnswerError('');
        setSpeechNotice(step.key === 'email' ? 'Please check the email address on screen, correct it if needed, and choose Continue.' : 'Your answer is ready. Review it, then choose Continue.');
      };
      recognition.onerror = event => {
        if (!mountedRef.current || event.error === 'aborted') return;
        const notices = {
          'not-allowed': 'Microphone permission was denied. Allow microphone access in your browser, or type your answer below.',
          'service-not-allowed': 'This browser blocked voice input. You can type your answer below.',
          'audio-capture': 'No microphone is available. Connect one or type your answer below.',
          'no-speech': 'No speech was detected. Try the microphone again or type your answer below.',
          network: 'The browser speech service could not connect. You can continue by typing.',
        };
        stopListening();
        setSpeechNotice(notices[event.error] || 'Voice input did not complete. Please try again or type your answer below.');
      };
      recognition.onend = () => {
        if (recognitionRef.current === recognition) recognitionRef.current = null;
        if (mountedRef.current) setListening(false);
      };
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setSpeechNotice('Voice input could not start. Check microphone permissions or type your answer below.');
    }
  }

  function continueStep(event) {
    event.preventDefault();
    const value = draft.trim();
    const error = validateVoiceField(step.key, value);
    if (error) { setAnswerError(error); answerRef.current?.focus(); return; }
    stopListening();
    setFields(previous => ({ ...previous, [step.key]: value }));
    setAnswerError(''); setSpeechNotice('');
    if (stepIndex === VOICE_STEPS.length - 1) {
      setStage('review');
      speak('Thank you. Please review your details, then choose Hear my solution. I’ll explain how automation could support your business.');
    } else {
      const nextIndex = stepIndex + 1;
      setStepIndex(nextIndex);
      setDraft(fields[VOICE_STEPS[nextIndex].key]);
      speak(VOICE_STEPS[nextIndex].prompt);
    }
  }

  function goBack() {
    stopListening(); stopSpeaking();
    const previousIndex = stepIndex - 1;
    setStepIndex(previousIndex);
    setDraft(fields[VOICE_STEPS[previousIndex].key]);
    setAnswerError(''); setSpeechNotice('');
    speak(VOICE_STEPS[previousIndex].prompt);
  }

  function changeReview(key, value) {
    setFields(previous => ({ ...previous, [key]: value }));
    setReviewErrors(previous => ({ ...previous, [key]: '' }));
    setLeadStatus('idle');
    setSolutionError('');
    if (key === 'requirement' || key === 'niche') setSolution('');
  }

  async function generateSolution(event) {
    event.preventDefault();
    if (busyRef.current) return;
    const errors = Object.fromEntries(VOICE_STEPS.map(({ key }) => [key, validateVoiceField(key, fields[key])]));
    setReviewErrors(errors);
    const invalid = VOICE_STEPS.find(({ key }) => errors[key]);
    if (invalid) { reviewRefs.current[invalid.key]?.focus(); return; }
    stopListening(); stopSpeaking();
    const requirement = fields.requirement.trim(), niche = fields.niche.trim();
    if (solution && cachedRequestRef.current?.requirement === requirement && cachedRequestRef.current?.niche === niche) {
      setStage('result'); speak(solution); return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    busyRef.current = true;
    setGenerating(true); setSolutionError(''); setLeadStatus('idle');
    try {
      // Contact details never enter the AI request.
      const reply = await requestVoiceSolution({ requirement, niche }, { signal: controller.signal });
      if (!mountedRef.current) return;
      cachedRequestRef.current = { requirement, niche };
      setSolution(reply); setStage('result'); speak(reply);
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted) return;
      setSolutionError(AI_ERRORS[error.code] || 'We couldn’t prepare an AI suggestion. Your answers are still here. Please try again or book a free discussion.');
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      busyRef.current = false;
      if (mountedRef.current) setGenerating(false);
    }
  }

  async function sendDetails() {
    if (busyRef.current || !solution || leadStatus === 'accepted') return;
    const controller = new AbortController();
    requestRef.current = controller;
    busyRef.current = true;
    setLeadStatus('sending');
    try {
      const messagePrefix = `Goal: ${fields.requirement.trim()}\nSuggested approach: `;
      const enquiryMessage = messagePrefix + solution.slice(0, Math.max(0, 5000 - messagePrefix.length));
      await submitEnquiry({
        name: fields.name.trim(), email: fields.email.trim(), company: fields.niche.trim(),
        service: 'AI voice consultation',
        message: enquiryMessage,
        website: '',
      }, { signal: controller.signal });
      if (!mountedRef.current) return;
      setLeadStatus('accepted');
      speak('Thank you. Your details were accepted for email delivery to our team. You can also choose a time in our calendar for a detailed discussion.');
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted) return;
      setLeadStatus(error.code === 'MAIL_NOT_CONFIGURED' ? 'unconfigured' : 'error');
    } finally {
      if (requestRef.current === controller) requestRef.current = null;
      busyRef.current = false;
    }
  }

  function toggleSpokenReplies() {
    if (spokenEnabled) stopSpeaking();
    setSpokenEnabled(previous => !previous);
  }

  return <div className="voice-backdrop" onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <section ref={dialogRef} className="voice-dialog" role="dialog" aria-modal="true" aria-labelledby={id + '-title'} aria-describedby={id + '-privacy'} tabIndex={-1}>
      <div className="voice-header">
        <div className="voice-brand"><span><Phone size={18} /></span><div><strong id={id + '-title'}>Sunrise voice assistant</strong><small>Website voice consultation</small></div></div>
        <button ref={closeRef} type="button" className="voice-icon-button" aria-label="Close voice consultation" onClick={close}><X size={19} /></button>
      </div>
      <div ref={contentRef} className="voice-content">
        <div className={`voice-orb ${listening || speaking ? 'voice-orb-active' : ''}`} aria-hidden="true"><Mic size={30} /><div className="voice-bars">{[0, 1, 2, 3, 4].map(item => <i key={item} style={{ animationDelay: `${item * 110}ms` }} />)}</div></div>
        <div className="voice-state" role="status" aria-live="polite">{listening ? 'Listening…' : speaking ? 'Speaking…' : generating ? 'Preparing your suggestion…' : stage === 'intro' ? 'Ready when you are' : 'Your consultation, at your pace'}</div>

        {stage === 'intro' && <div className="voice-intro">
          <h2>A brighter way to talk business.</h2>
          <p>Tell us what you need, share a few details, and hear how AI could help your business. You can speak or type every answer.</p>
          <button type="button" className="button voice-primary" onClick={start}>Start consultation <ArrowUpRight size={15} /></button>
          <small>Your microphone only starts when you tap the microphone button.</small>
        </div>}

        {stage === 'questions' && <div className="voice-question">
          <div className="voice-progress"><span>Step {stepIndex + 1} of {VOICE_STEPS.length}</span><div>{VOICE_STEPS.map(({ key }, index) => <i key={key} className={index <= stepIndex ? 'voice-progress-done' : ''} />)}</div></div>
          <p className="voice-prompt">{step.prompt}</p>
          <form noValidate onSubmit={continueStep}>
            <label htmlFor={id + '-answer'}>{step.label}</label>
            {step.key === 'requirement' ? <textarea ref={answerRef} id={id + '-answer'} name={step.key} required value={draft} onChange={event => { setDraft(event.target.value); setAnswerError(''); }} maxLength={LIMITS[step.key]} rows={3} aria-invalid={Boolean(answerError)} aria-describedby={answerError ? id + '-answer-error' : undefined} placeholder="e.g. I need a bot to answer WhatsApp enquiries" /> : <input ref={answerRef} id={id + '-answer'} name={step.key} required type={step.key === 'email' ? 'email' : 'text'} value={draft} onChange={event => { setDraft(event.target.value); setAnswerError(''); }} maxLength={LIMITS[step.key]} autoComplete={step.key === 'name' ? 'name' : step.key === 'email' ? 'email' : 'organization'} aria-invalid={Boolean(answerError)} aria-describedby={answerError ? id + '-answer-error' : undefined} />}
            {answerError && <p className="voice-error" id={id + '-answer-error'} role="alert">{answerError}</p>}
            <div className="voice-answer-actions">
              <button type="button" className={`voice-mic-button ${listening ? 'voice-listening' : ''}`} disabled={!Recognition} aria-pressed={listening} onClick={listen}>{listening ? <MicOff size={17} /> : <Mic size={17} />}{listening ? 'Stop listening' : 'Tap to speak'}</button>
              <button type="submit" className="button">Continue <ArrowUpRight size={15} /></button>
            </div>
            {stepIndex > 0 && <button type="button" className="voice-text-button" onClick={goBack}><ChevronLeft size={13} /> Previous answer</button>}
          </form>
        </div>}

        {stage === 'review' && <form className="voice-review" noValidate onSubmit={generateSolution} aria-busy={generating}>
          <h2>Check your details.</h2><p>Make sure your email is right. Only your goal and business niche are sent to OpenAI for the suggestion.</p>
          <fieldset disabled={generating}>
            {VOICE_STEPS.map(({ key, label }) => <label key={key} htmlFor={id + '-review-' + key}>{label}
              {key === 'requirement' ? <textarea ref={element => { reviewRefs.current[key] = element; }} id={id + '-review-' + key} name={key} required value={fields[key]} onChange={event => changeReview(key, event.target.value)} maxLength={LIMITS[key]} rows={2} aria-invalid={Boolean(reviewErrors[key])} /> : <input ref={element => { reviewRefs.current[key] = element; }} id={id + '-review-' + key} name={key} required type={key === 'email' ? 'email' : 'text'} value={fields[key]} onChange={event => changeReview(key, event.target.value)} maxLength={LIMITS[key]} autoComplete={key === 'name' ? 'name' : key === 'email' ? 'email' : 'organization'} aria-invalid={Boolean(reviewErrors[key])} />}
              {reviewErrors[key] && <span className="voice-error">{reviewErrors[key]}</span>}
            </label>)}
            <button type="submit" className="button voice-primary">{generating ? <><LoaderCircle className="voice-spinner" size={16} /> Preparing your suggestion…</> : <>Hear my solution <Volume2 size={16} /></>}</button>
          </fieldset>
          {solutionError && <p className="voice-error voice-error-panel" role="alert">{solutionError}</p>}
        </form>}

        {stage === 'result' && <div className="voice-result">
          <span className="voice-eyebrow">A PRACTICAL STARTING POINT</span><h2>Here’s how AI could help.</h2>
          <p className="voice-solution">{solution}</p>
          <div className="voice-replay-actions"><button type="button" className="voice-text-button" disabled={!canSpeak} onClick={() => speak(solution)}><Volume2 size={14} /> Hear it again</button><button type="button" className="voice-text-button" disabled={leadStatus === 'sending'} onClick={() => { stopSpeaking(); setStage('review'); }}><Edit3 size={14} /> Edit details</button></div>
          <div className="voice-next-step"><h3>Let’s discuss the details.</h3><p>A free strategy call gives us time to understand your workflow and recommend the right solution.</p><a className="button voice-primary" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">Choose a time in our calendar <ArrowUpRight size={15} /></a></div>
          <div className="voice-contact-summary"><h3>Or ask our team to contact you</h3><dl><div><dt>Name</dt><dd>{fields.name}</dd></div><div><dt>Email</dt><dd>{fields.email}</dd></div><div><dt>Company/niche</dt><dd>{fields.niche}</dd></div></dl><p>Clicking below sends these contact details, your goal, and the suggested approach to SunriseAI by email so our team can follow up.</p><button type="button" className="button secondary voice-primary" onClick={sendDetails} disabled={leadStatus === 'sending' || leadStatus === 'accepted'}>{leadStatus === 'sending' ? <><LoaderCircle className="voice-spinner" size={15} /> Sending details…</> : leadStatus === 'accepted' ? <><Check size={15} /> Details submitted</> : <>Send my details to SunriseAI <ArrowUpRight size={15} /></>}</button>
            <div aria-live="polite" role="status">{leadStatus === 'accepted' && <p className="voice-success">Your details were accepted for email delivery to our team. No appointment has been booked; choose a calendar time above if you’d like one.</p>}{leadStatus === 'error' && <p className="voice-error voice-error-panel">We couldn’t confirm your details were sent. They’re still here. You can try again, book a call, or email sunrisesolution93@gmail.com.</p>}{leadStatus === 'unconfigured' && <p className="voice-error voice-error-panel">Email follow-up is temporarily unavailable. Please use the calendar or email sunrisesolution93@gmail.com.</p>}</div>
          </div>
        </div>}

        {speechNotice && <p className="voice-speech-notice" role="status">{speechNotice}</p>}
        {!Recognition && stage === 'questions' && <p className="voice-speech-notice">Voice input isn’t supported by this browser. Type your answers below; spoken replies may still be available.</p>}
        {!canSpeak && <p className="voice-speech-notice">Spoken replies aren’t supported by this browser. All questions and suggestions are available as text.</p>}
      </div>
      <footer className="voice-footer">
        <div className="voice-audio-controls"><button type="button" className="voice-text-button" disabled={!canSpeak} onClick={toggleSpokenReplies}>{spokenEnabled ? <VolumeX size={14} /> : <Volume2 size={14} />}{spokenEnabled ? 'Mute spoken replies' : 'Enable spoken replies'}</button>{speaking && <button type="button" className="voice-text-button" onClick={stopSpeaking}>Stop audio</button>}<a href={BOOKING_URL} target="_blank" rel="noopener noreferrer">Book a call <ArrowUpRight size={12} /></a></div>
        <p id={id + '-privacy'}>Voice input may be processed by your browser’s speech service. Your goal and niche go to OpenAI when you request a suggestion. Name and email fields are not sent to OpenAI. Nothing is emailed until you click Send my details. AI suggestions can be inaccurate.</p>
      </footer>
    </section>
  </div>;
}
