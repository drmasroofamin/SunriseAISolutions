import { useEffect, useRef, useState } from "react";
import "./effects.css";

/** A brief brand introduction, never a claim about downloads or application readiness. */
export default function StudioIntro({ brand = "SunriseAI" }) {
  const [visible, setVisible] = useState(
    () =>
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
      document.documentElement.dataset.studioIntro !== "done",
  );
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const completed = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame;
    let exitTimer;
    let finishTimer;
    let failsafe;
    let startedLeaving = false;
    const announce = () => {
      if (completed.current) return;
      completed.current = true;
      document.documentElement.dataset.studioIntro = "done";
      window.dispatchEvent(new Event("sunrise:intro-complete"));
    };
    const remove = () => {
      cancelAnimationFrame(frame);
      setProgress(100);
      setVisible(false);
      announce();
    };
    const finish = () => {
      if (startedLeaving) return;
      startedLeaving = true;
      cancelAnimationFrame(frame);
      setProgress(100);
      setLeaving(true);
      exitTimer = setTimeout(remove, 150);
    };
    if (!visible || media.matches) {
      remove();
      return undefined;
    }
    const started = performance.now();
    const tick = (now) => {
      const ratio = Math.min((now - started) / 900, 1);
      setProgress(Math.round(100 * (1 - Math.pow(1 - ratio, 2))));
      if (ratio < 1) frame = requestAnimationFrame(tick);
      else finish();
    };
    frame = requestAnimationFrame(tick);
    finishTimer = setTimeout(finish, 920);
    // Does not depend on fonts, images, promises, or the animation module loading.
    failsafe = setTimeout(remove, 1150);
    const onMotionChange = (event) => {
      if (event.matches) remove();
    };
    media.addEventListener("change", onMotionChange);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(exitTimer);
      clearTimeout(finishTimer);
      clearTimeout(failsafe);
      media.removeEventListener("change", onMotionChange);
      announce();
    };
    // This is a once-per-mount introduction. Changing progress must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;
  return (
    <div
      className={`studio-intro${leaving ? " is-leaving" : ""}`}
      aria-hidden="true"
    >
      <div className="studio-intro__top">
        <span>AI automation studio</span>
        <span>A brighter way forward</span>
      </div>
      <div className="studio-intro__brand">
        <svg viewBox="0 0 72 48" focusable="false">
          <path d="M11 35a25 25 0 0 1 50 0H11Z" fill="currentColor" />
          <path
            d="M3 40h66M36 1v7M8 12l6 6M64 12l-6 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
        <span>{brand}</span>
      </div>
      <div className="studio-intro__bottom">
        <span>From possibility to progress.</span>
        <div className="studio-intro__track">
          <span style={{ transform: `scaleX(${progress / 100})` }} />
        </div>
        <span className="studio-intro__number">
          {String(progress).padStart(3, "0")}
        </span>
      </div>
    </div>
  );
}
