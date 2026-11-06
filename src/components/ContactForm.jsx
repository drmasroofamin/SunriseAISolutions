import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, Mail } from "lucide-react";
import { buildEmailDraft, submitEnquiry } from "../enquiry";
import "./ContactForm.css";

const emptyFields = {
  name: "",
  email: "",
  company: "",
  service: "",
  message: "",
  website: "",
};
const stepNames = ["About you", "Your goals", "The details"];
const stepTitles = [
  "First, a little about you.",
  "What would make work easier?",
  "Tell us what you have in mind.",
];
const stepDescriptions = [
  "Let’s start with the people behind the business.",
  "Choose the service you’re interested in. We’ll work out the right approach together.",
  "Share your goal or a task you’d love to take off your plate.",
];

export default function ContactForm({
  email,
  calendly,
  services = [],
  stepped = false,
}) {
  const id = useId();
  const [fields, setFields] = useState(emptyFields);
  const [status, setStatus] = useState("idle");
  const [step, setStep] = useState(0);
  const formRef = useRef(null);
  const stepHeadingRef = useRef(null);
  const previousStep = useRef(0);
  const inFlight = useRef(false);
  const draft = buildEmailDraft(email, fields);
  const sending = status === "sending";
  const serviceOptions = [
    ...new Set([
      ...services.map((service) => service.title),
      "Help me find the right solution",
    ]),
  ];

  useEffect(() => {
    // Announce each new step without pulling focus to the form on page load.
    if (stepped && previousStep.current !== step)
      stepHeadingRef.current?.focus();
    previousStep.current = step;
  }, [step, stepped]);

  function changeField(event) {
    setFields((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
    // Editing after acceptance creates a new enquiry, without losing the draft.
    if (status === "accepted") setStatus("idle");
  }

  async function send(event) {
    event.preventDefault();
    if (inFlight.current) return;
    if (stepped) {
      // Inactive fields are unmounted; native validation checks only this step.
      if (!formRef.current?.reportValidity()) return;
      if (step < 2) {
        setStep((previous) => previous + 1);
        return;
      }
      // Advancing with Enter never sends an enquiry. Only the final Send button does.
      if (event.nativeEvent.submitter?.dataset.enquirySubmit !== "true") return;
    }
    inFlight.current = true;
    setStatus("sending");
    try {
      await submitEnquiry(fields);
      setStatus("accepted");
    } catch (error) {
      // Preserve every field, including when the provider returns an HTML error page.
      setStatus(
        error.code === "MAIL_NOT_CONFIGURED" ? "unconfigured" : "error",
      );
    } finally {
      inFlight.current = false;
    }
  }

  const detailsFields = (
    <>
      <div className="form-row">
        <label>
          Your name
          <input
            name="name"
            placeholder="Alex Morgan"
            required
            autoComplete="name"
            maxLength={120}
            value={fields.name}
            onChange={changeField}
          />
        </label>
        <label>
          Work email
          <input
            type="email"
            name="email"
            placeholder="alex@company.com"
            required
            autoComplete="email"
            maxLength={254}
            value={fields.email}
            onChange={changeField}
          />
        </label>
      </div>
      <label>
        Company
        <input
          name="company"
          placeholder="Your company name"
          required
          autoComplete="organization"
          maxLength={200}
          value={fields.company}
          onChange={changeField}
        />
      </label>
    </>
  );

  const messageField = (
    <label>
      Tell us a little more
      <textarea
        name="message"
        placeholder="What's taking up too much of your time?"
        rows={stepped ? 5 : 3}
        required
        maxLength={5000}
        value={fields.message}
        onChange={changeField}
      />
    </label>
  );

  const sendLabel = sending
    ? "Sending…"
    : status === "accepted"
      ? "Enquiry Submitted"
      : status === "error" || status === "unconfigured"
        ? "Try Again"
        : "Send Enquiry";

  return (
    <form
      ref={formRef}
      className={`contact-form${stepped ? " contact-form-stepped" : ""}`}
      onSubmit={send}
      noValidate={stepped}
      aria-busy={sending}
      aria-labelledby={id + "-title"}
    >
      <h3 id={id + "-title"}>Let's talk about your business.</h3>
      {stepped && (
        <div className="contact-step-progress">
          <span
            className="contact-step-count"
            aria-live="polite"
            aria-atomic="true"
          >
            Step {step + 1} of 3
          </span>
          <ol aria-label="Enquiry steps">
            {stepNames.map((name, index) => (
              <li
                key={name}
                aria-current={step === index ? "step" : undefined}
                className={index <= step ? "contact-step-reached" : ""}
              >
                <span className="contact-step-marker" aria-hidden="true">
                  {index < step ? <Check size={12} /> : index + 1}
                </span>
                <span>{name}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <fieldset disabled={sending}>
        <div className="enquiry-honeypot" aria-hidden="true">
          <label>
            Leave this empty
            <input
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={fields.website}
              onChange={changeField}
            />
          </label>
        </div>
        {stepped ? (
          <>
            <section
              className="contact-step-panel"
              aria-labelledby={id + "-step-title"}
            >
              <h4 ref={stepHeadingRef} tabIndex={-1} id={id + "-step-title"}>
                {stepTitles[step]}
              </h4>
              <p className="contact-step-description">
                {stepDescriptions[step]}
              </p>
              {step === 0 && detailsFields}
              {step === 1 && (
                <fieldset className="contact-step-services">
                  <legend>What can we help with?</legend>
                  <div className="contact-step-service-grid">
                    {serviceOptions.map((service) => (
                      <label key={service} className="contact-step-service">
                        <input
                          type="radio"
                          name="service"
                          required
                          value={service}
                          checked={fields.service === service}
                          onChange={changeField}
                        />
                        <span className="contact-step-service-surface">
                          <span>{service}</span>
                          <span
                            className="contact-step-service-check"
                            aria-hidden="true"
                          >
                            {fields.service === service && <Check size={12} />}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {step === 2 && (
                <>
                  <dl className="contact-step-summary">
                    <div>
                      <dt>Your details</dt>
                      <dd>
                        <strong>{fields.name}</strong>
                        <span>{fields.email}</span>
                        <span>{fields.company}</span>
                      </dd>
                    </div>
                    <div>
                      <dt>Interested in</dt>
                      <dd>{fields.service}</dd>
                    </div>
                  </dl>
                  {messageField}
                </>
              )}
            </section>
            <div className="contact-step-actions">
              {step > 0 ? (
                <button
                  className="contact-step-back"
                  type="button"
                  onClick={() => setStep((previous) => previous - 1)}
                  disabled={sending}
                >
                  <ArrowLeft size={16} /> Back
                </button>
              ) : (
                <span className="contact-step-save-note">
                  Nothing is sent until the final step.
                </span>
              )}
              {step < 2 ? (
                <button
                  className="button contact-step-continue"
                  type="submit"
                  disabled={sending}
                >
                  Continue <ArrowUpRight size={16} />
                </button>
              ) : (
                <button
                  className="button contact-step-send"
                  type="submit"
                  data-enquiry-submit="true"
                  disabled={sending || status === "accepted"}
                >
                  {sendLabel}
                  {status === "accepted" ? (
                    <Check size={16} />
                  ) : (
                    <ArrowUpRight size={16} />
                  )}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            {detailsFields}
            <label>
              What can we help with?
              <select
                name="service"
                required
                value={fields.service}
                onChange={changeField}
              >
                <option value="" disabled>
                  Select a service
                </option>
                {serviceOptions.map((service) => (
                  <option key={service}>{service}</option>
                ))}
              </select>
            </label>
            {messageField}
            <button
              className="button"
              type="submit"
              disabled={sending || status === "accepted"}
            >
              {sendLabel}
              {status === "accepted" ? (
                <Check size={16} />
              ) : (
                <ArrowUpRight size={16} />
              )}
            </button>
          </>
        )}
      </fieldset>

      <div aria-live="polite" aria-atomic="true">
        {status === "sending" && (
          <p className="enquiry-status">
            Sending your enquiry. Please keep this page open.
          </p>
        )}
        {status === "accepted" && (
          <p className="enquiry-status enquiry-accepted">
            Your enquiry was accepted for email delivery. Prefer to arrange a
            time now? <a href={calendly}>Book your free strategy call.</a>
          </p>
        )}
        {status === "unconfigured" && (
          <p className="enquiry-status enquiry-error">
            Online enquiry delivery is being set up. Your details are still
            here. Please email your enquiry below or{" "}
            <a href={calendly}>book a call directly</a>.
          </p>
        )}
        {status === "error" && (
          <p className="enquiry-status enquiry-error">
            We couldn't confirm your enquiry was sent. Your details are still
            here. You can try again, email your enquiry below, or{" "}
            <a href={calendly}>book a call directly</a>.
          </p>
        )}
      </div>

      <div className="enquiry-alternatives">
        <span>
          <Mail size={14} /> Prefer email?
        </span>
        <div className="enquiry-links">
          <a href={draft.gmail} target="_blank" rel="noopener noreferrer">
            Open in Gmail <ArrowUpRight size={12} />
          </a>
          <a href={draft.mailto}>
            Open email app <ArrowUpRight size={12} />
          </a>
        </div>
        <small>
          These links copy your details into an email draft. Review it and press
          Send to email {email}.
        </small>
      </div>
      <small>
        Your enquiry is sent privately to our team. You can also{" "}
        <a href={calendly}>choose a time on Calendly</a>.
      </small>
    </form>
  );
}
