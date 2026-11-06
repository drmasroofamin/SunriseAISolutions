import React, {
  lazy,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Building2,
  Check,
  ChevronDown,
  Code2,
  GraduationCap,
  HeartPulse,
  Menu,
  MessageSquare,
  Mic,
  Phone,
  Plus,
  ShoppingBag,
  Sparkles,
  Store,
  Workflow,
  X,
  Zap,
  ChartNoAxesCombined,
  Megaphone,
} from "lucide-react";
import "./styles.css";
import "./theme.css";
import "./studio.css";
import ContactForm from "./components/ContactForm";
import Chat from "./components/Chat";
import { ChatProvider } from "./components/ChatContext";
import LoadBoundary from "./components/LoadBoundary";
import StudioIntro from "./effects/StudioIntro";
import {
  site,
  navItems,
  hero,
  about,
  services,
  capabilities,
  work,
  processSteps,
  industries,
  stats,
  testimonials,
  faqs,
} from "./content/site";

const VoiceAgent = lazy(() => import("./components/VoiceAgent"));
const icons = {
  Phone,
  MessageSquare,
  BrainCircuit,
  Workflow,
  Zap,
  Code2,
  ChartNoAxesCombined,
  Building2,
  HeartPulse,
  ShoppingBag,
  GraduationCap,
  Megaphone,
  Store,
  Sparkles,
};

function RollLink({ children, href, className = "", onClick }) {
  return (
    <a
      href={href}
      className={`roll-link ${className}`}
      onClick={onClick}
      aria-label={children}
    >
      <span className="roll-link-window" aria-hidden="true">
        <span>{children}</span>
        <span>{children}</span>
      </span>
    </a>
  );
}
function Brand({ footer = false }) {
  return (
    <a
      href="#top"
      className={`studio-brand ${footer ? "studio-brand-footer" : ""}`}
      aria-label="SunriseAI home"
    >
      <span className="sun-logo" aria-hidden="true">
        <i />
        <b />
        <em />
      </span>
      <strong>
        Sunrise<span>AI</span>
      </strong>
    </a>
  );
}
function BookingLink({
  children = "Start a conversation",
  pale = false,
  className = "",
}) {
  return (
    <a
      href={site.booking}
      className={`studio-button ${pale ? "is-pale" : ""} ${className}`}
    >
      <span>{children}</span>
      <ArrowUpRight size={18} />
    </a>
  );
}
function SectionLabel({ number, children, light = false }) {
  return (
    <p className={`studio-label ${light ? "is-light" : ""}`}>
      <span>{number}</span>
      <span>{children}</span>
    </p>
  );
}

/** Dialogs own focus and scrolling, independently of the decorative motion layer. */
function DetailDialog({ detail, onClose }) {
  const id = useId(),
    ref = useRef(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current.querySelector("button")?.focus();
    function keydown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
      }
      if (event.key === "Tab") {
        const controls = [
          ...ref.current.querySelectorAll(
            "button:not(:disabled),a[href],input:not(:disabled)",
          ),
        ];
        if (event.shiftKey && document.activeElement === controls[0]) {
          event.preventDefault();
          controls.at(-1)?.focus();
        }
        if (!event.shiftKey && document.activeElement === controls.at(-1)) {
          event.preventDefault();
          controls[0]?.focus();
        }
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", keydown);
      opener?.isConnected && opener.focus();
    };
  }, []);
  const item = detail.item;
  return (
    <div
      className="studio-dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        className="studio-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
      >
        <button
          className="studio-dialog-close"
          aria-label="Close details"
          onClick={onClose}
        >
          <X size={21} />
        </button>
        <span className="studio-kicker">
          {detail.kind === "work"
            ? "ILLUSTRATIVE CONCEPT STUDY"
            : "BUILT AROUND YOUR BUSINESS"}
        </span>
        <h2 id={id}>{item.title}</h2>
        {item.image && (
          <img src={item.image} alt={item.alt} width="1000" height="750" />
        )}
        {detail.kind === "work" ? (
          <div className="studio-dialog-copy">
            <h3>The challenge</h3>
            <p>{item.problem}</p>
            <h3>The approach</h3>
            <p>{item.solution}</p>
            <h3>The possibility</h3>
            <p>{item.result}</p>
            <p className="studio-disclosure">
              A concept scenario, not a verified client project or performance
              claim.
            </p>
          </div>
        ) : (
          <p>{item.detail || item.description}</p>
        )}
        <BookingLink>Discuss your project</BookingLink>
      </section>
    </div>
  );
}

function App() {
  const root = useRef(null);
  const [menu, setMenu] = useState(false),
    [voice, setVoice] = useState(false),
    [chat, setChat] = useState(false);
  const [detail, setDetail] = useState(null),
    [newsletter, setNewsletter] = useState(false);

  useEffect(() => {
    let disposed = false,
      cleanup;
    // Motion is optional. Failed downloads leave the complete page visible.
    import("./effects/studioMotion")
      .then(({ initStudioMotion }) => {
        if (!disposed && root.current) cleanup = initStudioMotion(root.current);
      })
      .catch(() => {
        document.documentElement.dataset.motion = "unavailable";
      });
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, []);
  function openVoice() {
    setMenu(false);
    setChat(false);
    setVoice(true);
  }
  function openWhatsApp() {
    if (site.whatsapp)
      window.open(
        `https://wa.me/${site.whatsapp}`,
        "_blank",
        "noopener,noreferrer",
      );
    else
      document.getElementById("contact").scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div ref={root} className="studio-shell" id="top">
      <StudioIntro brand={site.name} />
      <a className="studio-skip" href="#main-content">
        Skip to content
      </a>
      <header className="studio-nav">
        <Brand />
        <nav
          className={`studio-navigation ${menu ? "is-open" : ""}`}
          aria-label="Main navigation"
        >
          {navItems.map((link) => (
            <RollLink
              key={link.href}
              href={link.href}
              onClick={() => setMenu(false)}
            >
              {link.label}
            </RollLink>
          ))}
        </nav>
        <a href={site.booking} className="studio-nav-cta">
          Let’s talk <ArrowUpRight size={16} />
        </a>
        <button
          className="studio-menu"
          aria-label={menu ? "Close menu" : "Open menu"}
          aria-expanded={menu}
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
      </header>

      <main id="main-content" className="studio-main">
        <section className="studio-hero studio-container">
          <div className="studio-hero-meta" data-hero-reveal>
            <span>
              <i /> {hero.eyebrow}
            </span>
            <span>Human ambition. Intelligent systems.</span>
          </div>
          <div className="studio-hero-title-wrap">
            <h1 data-split-title>
              {hero.title.map((line, index) => (
                <React.Fragment key={line}>
                  {index > 0 && <br />}
                  {line}
                </React.Fragment>
              ))}
            </h1>
            <span className="studio-hero-spark" aria-hidden="true">
              <svg
                viewBox="0 0 100 100"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeLinecap="round"
              >
                <path d="M50 8v84M8 50h84M20 20l60 60M20 80l60-60" />
              </svg>
            </span>
          </div>
          <div className="studio-hero-bottom">
            <div className="studio-hero-intro" data-hero-reveal>
              <p>{hero.description}</p>
              <div className="studio-hero-actions">
                <BookingLink>Book a free strategy call</BookingLink>
                <a href="#case-studies" className="studio-inline-link">
                  Explore our work <ArrowDown size={16} />
                </a>
              </div>
              <button
                className="studio-voice-hero"
                onClick={openVoice}
                aria-haspopup="dialog"
              >
                <span>
                  <Mic size={18} />
                </span>
                Talk to our AI voice agent <ArrowUpRight size={15} />
              </button>
            </div>
            <button
              className="studio-feature"
              data-hero-reveal
              data-cursor="View"
              onClick={() => setDetail({ kind: "work", item: work[0] })}
              aria-label="Explore our illustrative AI agent concept"
            >
              <span className="studio-feature-image">
                <img
                  src="/assets/images/hero-studio.svg"
                  alt="Abstract sculptural sunrise and connected intelligent systems"
                  width="1000"
                  height="750"
                  fetchPriority="high"
                />
              </span>
              <span className="studio-feature-caption">
                <span>Designed to work together.</span>
                <ArrowUpRight size={16} />
              </span>
            </button>
          </div>
          <div className="studio-hero-foot" data-hero-reveal>
            <span>
              SCROLL TO EXPLORE <ArrowDown size={12} />
            </span>
            <span>Built for your next chapter.</span>
            <span>01 — 08</span>
          </div>
        </section>

        <section id="about" className="studio-manifesto studio-container">
          <SectionLabel number="01">A SIMPLE BELIEF</SectionLabel>
          <div className="studio-manifesto-grid">
            <p data-reveal-words className="studio-statement">
              {about.statement}
            </p>
            <div className="studio-about-note">
              <span className="studio-kicker">THE HUMAN BEHIND THE AI</span>
              <h3>Dr. Masroof Amin</h3>
              <p>{about.founderBio}</p>
              <p>{about.mission}</p>
              <ul>
                {about.values.map((value) => (
                  <li key={value}>
                    <Check size={14} />
                    {value}
                  </li>
                ))}
              </ul>
              <RollLink href="#contact">
                Let’s build something meaningful
              </RollLink>
            </div>
          </div>
        </section>

        <section
          id="case-studies"
          className="studio-work studio-container"
          data-work-section
        >
          <div className="studio-section-top">
            <SectionLabel number="02">SELECTED POSSIBILITIES</SectionLabel>
            <span className="studio-disclosure">
              Illustrative concept studies
            </span>
          </div>
          <h2 className="studio-section-title" data-motion-reveal>
            Real problems.
            <br />
            <span>Thoughtful solutions.</span>
          </h2>
          <div className="studio-work-grid">
            <div className="studio-work-visual" aria-hidden="true">
              {work.map((project, index) => (
                <figure
                  key={project.id}
                  data-work-preview={index}
                  className={`studio-work-preview ${index === 0 ? "is-active" : ""}`}
                >
                  <img
                    src={project.image}
                    alt=""
                    width="1000"
                    height="750"
                    loading="lazy"
                  />
                  <figcaption>
                    <span>{project.category}</span>
                    <span>{project.number}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="studio-work-list">
              {work.map((project, index) => (
                <article
                  key={project.id}
                  data-work-item={index}
                  className={`studio-work-item ${index === 0 ? "is-active" : ""}`}
                >
                  <span className="studio-project-number">
                    {project.number} / CONCEPT STUDY
                  </span>
                  <img
                    className="studio-work-mobile"
                    src={project.image}
                    alt={project.alt}
                    width="1000"
                    height="750"
                    loading="lazy"
                  />
                  <button
                    className="studio-project-title"
                    data-cursor="View"
                    onClick={() => setDetail({ kind: "work", item: project })}
                  >
                    <span>{project.title}</span>
                    <ArrowUpRight size={34} />
                  </button>
                  <p>{project.description}</p>
                  <div className="studio-tags">
                    {project.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <button
                    className="studio-inline-link"
                    onClick={() => setDetail({ kind: "work", item: project })}
                  >
                    Explore the approach <ArrowUpRight size={15} />
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="services" className="studio-capabilities studio-container">
          <SectionLabel number="03">OUR CAPABILITIES</SectionLabel>
          <div className="studio-capabilities-title">
            <h2 data-motion-reveal>
              From an idea.
              <br />
              To your advantage.
            </h2>
            <p>
              One thoughtful partner for the systems that move your business
              forward.
            </p>
          </div>
          <div className="studio-stack">
            {capabilities.map((capability, index) => (
              <article
                data-stack-card
                className={`studio-capability capability-${index}`}
                key={capability.number}
              >
                <div className="studio-capability-head">
                  <span>{capability.number}</span>
                  <span>STRATEGY. ENGINEERING. IMPACT.</span>
                  <ArrowUpRight size={25} />
                </div>
                <div className="studio-capability-grid">
                  <div>
                    <h3>{capability.title}</h3>
                    <p>{capability.description}</p>
                    <BookingLink pale>Find your starting point</BookingLink>
                  </div>
                  <div className="studio-service-list">
                    {capability.serviceIds.map((id) => {
                      const service = services.find((item) => item.id === id);
                      if (!service) return null;
                      const Icon = icons[service.icon] || Sparkles;
                      return (
                        <button
                          key={id}
                          onClick={() =>
                            setDetail({ kind: "service", item: service })
                          }
                        >
                          <Icon size={20} />
                          <span>
                            <strong>{service.title}</strong>
                            <small>{service.description}</small>
                          </span>
                          <Plus size={18} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="studio-process">
          <div className="studio-process-media" aria-hidden="true">
            <img
              data-parallax
              src="/assets/images/process-studio.svg"
              alt=""
              width="1800"
              height="1100"
              loading="lazy"
            />
          </div>
          <div className="studio-container studio-process-content">
            <SectionLabel number="04">HOW WE GET THERE</SectionLabel>
            <h2 data-motion-reveal>
              Clarity first.
              <br />
              Momentum follows.
            </h2>
            <div className="studio-process-grid">
              {processSteps.map((step) => (
                <article data-motion-reveal key={step.number}>
                  <span>{step.number}</span>
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="solutions" className="studio-sectors studio-container">
          <SectionLabel number="05">BUILT AROUND YOU</SectionLabel>
          <div className="studio-sectors-grid">
            <h2 data-motion-reveal>
              Different businesses.
              <br />
              Brighter possibilities.
            </h2>
            <div>
              {industries.map((industry) => {
                const Icon = icons[industry.icon] || Building2;
                return (
                  <a href="#contact" key={industry.name}>
                    <Icon size={21} />
                    <span>{industry.name}</span>
                    <ArrowUpRight size={18} />
                  </a>
                );
              })}
            </div>
          </div>
          <div className="studio-stats-heading">
            <span>MEASURABLE AMBITION</span>
            <small>
              Editable sample figures · illustrative, not verified client
              results
            </small>
          </div>
          <div className="studio-stats">
            {stats.map((stat) => (
              <div key={stat.label}>
                <strong>
                  <span data-count-to={stat.value} data-suffix={stat.suffix}>
                    {Number(stat.value).toLocaleString()}
                    {stat.suffix}
                  </span>
                </strong>
                <span>{stat.label.replace(/sample\s*/i, "")}</span>
              </div>
            ))}
          </div>
        </section>

        <section id="demo" className="studio-demo studio-container">
          <div>
            <SectionLabel number="06">A CONVERSATION STARTER</SectionLabel>
            <h2 data-motion-reveal>
              Meet your next
              <br />
              <span>team member.</span>
            </h2>
            <p>
              Ask a question. Explore an idea. See where intelligent automation
              could take your business.
            </p>
            <button
              className="studio-button"
              onClick={openVoice}
              aria-haspopup="dialog"
            >
              <Mic size={18} />
              <span>Talk to our AI voice agent</span>
              <ArrowUpRight size={18} />
            </button>
            <small className="studio-disclosure">
              A guided website consultation. Speak or type.
            </small>
          </div>
          <div className="studio-chat-frame" data-motion-reveal>
            <Chat />
          </div>
        </section>

        <section className="studio-testimonials studio-container">
          <SectionLabel number="07">GOOD WORK IS A PARTNERSHIP</SectionLabel>
          <div className="studio-testimonial-top">
            <h2 data-motion-reveal>
              Technology with
              <br />a human side.
            </h2>
            <p className="studio-disclosure">
              Sample testimonials for layout preview. Replace with verified
              client quotes.
            </p>
          </div>
          <div className="studio-quote-list">
            {testimonials.map((item, index) => (
              <figure data-motion-reveal key={`${item.name}-${index}`}>
                <span>00{index + 1}</span>
                <blockquote>{item.quote}</blockquote>
                <figcaption>
                  <strong>{item.name}</strong>
                  <small>{item.role}</small>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="studio-faq studio-container">
          <div>
            <span className="studio-kicker">BEFORE WE BEGIN</span>
            <h2 data-motion-reveal>
              Good questions.
              <br />
              Clear answers.
            </h2>
          </div>
          <div className="studio-faq-list">
            {faqs.map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <Plus size={19} />
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="contact" className="studio-contact">
          <div className="studio-contact-media" aria-hidden="true">
            <img
              data-parallax
              src="/assets/images/process-studio.svg"
              alt=""
              width="1800"
              height="1100"
              loading="lazy"
            />
          </div>
          <div className="studio-container">
            <SectionLabel number="08">LET’S MAKE WHAT’S NEXT</SectionLabel>
            <div className="studio-contact-grid">
              <div className="studio-contact-intro">
                <h2 data-motion-reveal>
                  Your next chapter
                  <br />
                  starts with
                  <br />
                  <em>hello.</em>
                </h2>
                <a
                  href={`mailto:${site.email}`}
                  className="studio-contact-email"
                >
                  {site.email}
                  <ArrowUpRight size={20} />
                </a>
                <p>
                  No pressure. No jargon. Just a practical conversation about
                  what could work better.
                </p>
                <a href={site.booking} className="studio-inline-link">
                  Prefer to book a free call? <ArrowUpRight size={17} />
                </a>
              </div>
              <div className="studio-contact-paper">
                <ContactForm
                  email={site.email}
                  calendly={site.booking}
                  services={services}
                  stepped
                />
              </div>
            </div>
            <details className="studio-calendar">
              <summary>
                Choose a meeting time here <ChevronDown size={18} />
              </summary>
              <iframe
                title="Book a SunriseAI strategy call"
                src={site.booking + "?hide_gdpr_banner=0"}
                loading="lazy"
              />
            </details>
          </div>
        </section>
      </main>

      <footer className="studio-footer">
        <div className="studio-container">
          <div className="studio-footer-top">
            <div>
              <Brand footer />
              <p>
                Human ambition.
                <br />
                Intelligent possibilities.
              </p>
            </div>
            <div>
              <span className="studio-kicker">EXPLORE</span>
              {navItems.map((link) => (
                <RollLink key={link.href} href={link.href}>
                  {link.label}
                </RollLink>
              ))}
            </div>
            <div>
              <span className="studio-kicker">ELSEWHERE</span>
              <RollLink href={site.github}>GitHub</RollLink>
              {site.linkedin && (
                <RollLink href={site.linkedin}>LinkedIn</RollLink>
              )}
              <a href={`mailto:${site.email}`} className="studio-inline-link">
                Email us <ArrowUpRight size={14} />
              </a>
              <button className="studio-inline-link" onClick={openWhatsApp}>
                {site.whatsapp ? "WhatsApp" : "Contact us"}{" "}
                <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="studio-footer-notes">
              <span className="studio-kicker">NOTES FROM SUNRISE</span>
              <p>Practical ideas for a brighter way to work.</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setNewsletter(true);
                }}
              >
                <label className="sr-only" htmlFor="studio-newsletter">
                  Email for future newsletter
                </label>
                <input
                  id="studio-newsletter"
                  type="email"
                  placeholder="Your email address"
                  required
                />
                <button aria-label="Join newsletter preview">
                  <ArrowRight size={18} />
                </button>
              </form>
              <small role="status">
                {newsletter
                  ? "The newsletter is not connected yet. Please email us to stay in touch."
                  : "Newsletter preview · subscriptions opening soon"}
              </small>
            </div>
          </div>
          <a
            className="studio-footer-wordmark"
            href="#top"
            aria-label="SunriseAI — back to top"
          >
            Sunrise<span>AI</span>
            <ArrowUpRight />
          </a>
          <div className="studio-footer-bottom">
            <span>© {new Date().getFullYear()} SunriseAI</span>
            <span>Thoughtfully built. Ready for what’s next.</span>
            <a href="#top">Back to top ↑</a>
          </div>
        </div>
      </footer>

      <div className="floating-actions studio-floating">
        <button
          className="voice-launcher"
          aria-label="Talk to our AI voice agent"
          aria-haspopup="dialog"
          aria-expanded={voice}
          onClick={openVoice}
        >
          <Mic size={18} />
          <span>Voice AI</span>
        </button>
        <button
          className="whatsapp-button"
          aria-label={
            site.whatsapp ? "Contact on WhatsApp" : "Go to contact form"
          }
          onClick={openWhatsApp}
        >
          <Phone size={18} />
        </button>
        <button
          className="chat-button"
          aria-label={chat ? "Close assistant" : "Open assistant"}
          aria-expanded={chat}
          onClick={() => setChat(!chat)}
        >
          {chat ? <X size={21} /> : <MessageSquare size={21} />}
        </button>
      </div>
      {chat && (
        <div className="floating-chat">
          <Chat compact />
        </div>
      )}
      {detail && (
        <DetailDialog detail={detail} onClose={() => setDetail(null)} />
      )}
      {voice && (
        <LoadBoundary voice onClose={() => setVoice(false)}>
          <Suspense
            fallback={
              <div className="modal-backdrop" role="status">
                Opening voice consultation…
              </div>
            }
          >
            <VoiceAgent onClose={() => setVoice(false)} />
          </Suspense>
        </LoadBoundary>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <LoadBoundary>
    <ChatProvider>
      <App />
    </ChatProvider>
  </LoadBoundary>,
);
