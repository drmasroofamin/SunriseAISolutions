import { Component, createRef } from 'react';

/** A failed optional panel must not clear the rest of the website. */
export default class LoadBoundary extends Component {
  state = { failed: false };
  action = createRef();
  opener = typeof document !== 'undefined' ? document.activeElement : null;
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.action.current?.focus(); }
  componentWillUnmount() {
    if (this.props.voice && this.opener?.isConnected) this.opener.focus();
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const voice = this.props.voice;
    return <div className={voice ? 'modal-backdrop' : 'load-error-page'}>
      <section className="load-error-card" role={voice ? 'dialog' : 'alert'} aria-modal={voice || undefined} aria-label={voice ? 'Voice assistant could not load' : 'Page could not load'} onKeyDown={event => {
        if (voice && event.key === 'Escape') this.props.onClose?.();
        if (voice && event.key === 'Tab') {
          const controls = [...event.currentTarget.querySelectorAll('button, a[href]')];
          if (event.shiftKey && document.activeElement === controls[0]) { event.preventDefault(); controls.at(-1)?.focus(); }
          else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
        }
      }}>
        <span className="eyebrow">SUNRISE AI</span>
        <h2>{voice ? 'The voice assistant couldn’t open.' : 'We couldn’t load this page.'}</h2>
        <p>{voice ? 'Please reload the page to try again. You can keep browsing or book a free strategy call.' : 'Please reload the page. You can also book a free strategy call or email our team.'}</p>
        <div className="load-error-actions">
          <button ref={this.action} className="button" onClick={() => window.location.reload()}>Reload page</button>
          {voice && <button className="button secondary" onClick={this.props.onClose}>Back to website</button>}
          <a href="https://calendly.com/sunrisesolution93/30min">Book a free call ↗</a>
          {!voice && <a href="mailto:sunrisesolution93@gmail.com">Email our team</a>}
        </div>
      </section>
    </div>;
  }
}
