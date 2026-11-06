import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import SplitType from "split-type";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import "./effects.css";

/** Owns only effects created for this root. Static HTML/CSS remains the fallback. */
export function initStudioMotion(root) {
  if (
    !root ||
    typeof window === "undefined" ||
    !("IntersectionObserver" in window)
  )
    return () => {};
  gsap.registerPlugin(ScrollTrigger);
  const media = gsap.matchMedia();
  let disposed = false;

  media.add(
    {
      reduced: "(prefers-reduced-motion: reduce)",
      desktop: "(min-width: 1000px)",
      fine: "(hover: hover) and (pointer: fine)",
    },
    (context) => {
      if (disposed || context.conditions.reduced) return undefined;
      const { desktop, fine } = context.conditions;
      const ctx = gsap.context(() => {}, root);
      const splitRecords = [];
      const manualRestores = [];
      const listeners = [];
      const timers = [];
      let dead = false;
      let lenis;
      let ticker;
      let bodyObserver;
      let dialogObserver;
      let cursor;
      let scrollLocked = false;
      let refreshFrame;
      const all = (selector) => Array.from(root.querySelectorAll(selector));
      const listen = (target, event, handler, options) => {
        target.addEventListener(event, handler, options);
        listeners.push(() =>
          target.removeEventListener(event, handler, options),
        );
      };
      const refresh = () => {
        if (!dead && !disposed) ScrollTrigger.refresh();
      };
      const split = (element) => {
        const originalLabel = element.getAttribute("aria-label");
        const content = element.textContent.trim();
        const instance = new SplitType(element, {
          types: "words",
          tagName: "span",
        });
        // One accessible name, rather than every visually animated word being announced.
        element.setAttribute("aria-label", originalLabel || content);
        instance.words.forEach((word) =>
          word.setAttribute("aria-hidden", "true"),
        );
        splitRecords.push({ element, instance, originalLabel });
        return instance.words;
      };

      function cleanup() {
        if (dead) return;
        dead = true;
        cancelAnimationFrame(refreshFrame);
        timers.forEach(clearTimeout);
        listeners.forEach((remove) => remove());
        bodyObserver?.disconnect();
        dialogObserver?.disconnect();
        if (ticker) gsap.ticker.remove(ticker);
        if (lenis) {
          lenis.off("scroll", ScrollTrigger.update);
          lenis.destroy();
        }
        ctx.revert();
        splitRecords
          .reverse()
          .forEach(({ element, instance, originalLabel }) => {
            instance.revert();
            if (originalLabel === null) element.removeAttribute("aria-label");
            else element.setAttribute("aria-label", originalLabel);
          });
        manualRestores.reverse().forEach((restore) => restore());
        cursor?.remove();
      }

      try {
        ctx.add(() => {
          // The intro never hides hero content; it simply coordinates the first reveal.
          // Never hide a hero visitors have already seen on a slow connection.
          const introWasWaiting =
            document.documentElement.dataset.studioIntro !== "done" &&
            Boolean(document.querySelector(".studio-intro"));
          const titles = all("[data-split-title]");
          const titleWords =
            desktop && introWasWaiting ? titles.flatMap(split) : [];
          const heroAtoms = Array.from(
            new Set([
              ...all("[data-hero-reveal]").filter(
                (element) => !element.matches("[data-split-title]"),
              ),
              ...(!desktop ? titles : []),
            ]),
          );
          let heroStarted = false;
          const startHero = () => {
            if (dead || heroStarted) return;
            heroStarted = true;
            ctx.add(() => {
              const timeline = gsap.timeline({
                defaults: { ease: "expo.out" },
              });
              if (titleWords.length)
                timeline.fromTo(
                  titleWords,
                  { yPercent: 90, opacity: 0, rotate: 1.5 },
                  {
                    yPercent: 0,
                    opacity: 1,
                    rotate: 0,
                    duration: 1.05,
                    stagger: 0.06,
                  },
                  0,
                );
              if (heroAtoms.length)
                timeline.fromTo(
                  heroAtoms,
                  { y: 18, opacity: 0 },
                  { y: 0, opacity: 1, duration: 0.8, stagger: 0.08 },
                  0.1,
                );
            });
          };
          if (introWasWaiting) {
            listen(window, "sunrise:intro-complete", startHero, { once: true });
            timers.push(setTimeout(startHero, 1400));
          }

          all("[data-motion-reveal]").forEach((element) => {
            gsap.from(element, {
              y: desktop ? 35 : 18,
              opacity: 0,
              duration: 0.85,
              ease: "expo.out",
              scrollTrigger: { trigger: element, start: "top 91%", once: true },
            });
          });

          if (desktop) {
            all("[data-reveal-words]").forEach((element) => {
              const finalColor = getComputedStyle(element).color;
              const words = split(element);
              const section = element.closest(".studio-manifesto") || element;
              const grid = element.closest(".studio-manifesto-grid") || section;
              let tween;
              let previousFit;
              let resizeTimer;
              const updateReveal = () => {
                if (dead) return false;
                // Pin the statement's grid, not the section's decorative padding/label.
                // Short viewports keep ordinary scrolling so no part of the text is trapped.
                const fits =
                  grid.getBoundingClientRect().height <=
                  window.innerHeight * 0.82 - 24;
                if (tween && previousFit === fits) return false;
                previousFit = fits;
                tween?.scrollTrigger?.kill();
                tween?.kill();
                ctx.add(() => {
                  tween = gsap.fromTo(
                    words,
                    { color: "rgba(225, 226, 217, 0.24)" },
                    {
                      color: finalColor,
                      stagger: 0.15,
                      ease: "none",
                      scrollTrigger: {
                        trigger: grid,
                        start: fits ? "top 18%" : "top 85%",
                        end: fits
                          ? () => `+=${Math.round(window.innerHeight * 0.85)}`
                          : "bottom 35%",
                        scrub: 0.7,
                        pin: fits ? grid : false,
                        pinSpacing: true,
                        anticipatePin: fits ? 1 : 0,
                        invalidateOnRefresh: true,
                      },
                    },
                  );
                });
                return true;
              };
              updateReveal();
              listen(
                window,
                "resize",
                () => {
                  clearTimeout(resizeTimer);
                  resizeTimer = setTimeout(() => {
                    if (updateReveal()) refresh();
                  }, 120);
                },
                { passive: true },
              );
              manualRestores.push(() => clearTimeout(resizeTimer));
              document.fonts?.ready
                .then(() => {
                  if (updateReveal()) refresh();
                })
                .catch(() => {});
            });
          }

          all("[data-work-section]").forEach((section) => {
            const previews = Array.from(
              section.querySelectorAll("[data-work-preview]"),
            );
            const items = Array.from(
              section.querySelectorAll("[data-work-item]"),
            );
            const originalItems = items.map((element) => ({
              element,
              active: element.classList.contains("is-active"),
            }));
            manualRestores.push(() =>
              originalItems.forEach(({ element, active }) =>
                element.classList.toggle("is-active", active),
              ),
            );
            const original = previews.map((element) => ({
              element,
              active: element.classList.contains("is-active"),
              hidden: element.getAttribute("aria-hidden"),
            }));
            manualRestores.push(() =>
              original.forEach(({ element, active, hidden }) => {
                element.classList.toggle("is-active", active);
                if (hidden === null) element.removeAttribute("aria-hidden");
                else element.setAttribute("aria-hidden", hidden);
              }),
            );
            const activate = (value) => {
              previews.forEach((element) => {
                const active = element.dataset.workPreview === value;
                element.classList.toggle("is-active", active);
                element.setAttribute("aria-hidden", String(!active));
              });
              items.forEach((element) =>
                element.classList.toggle(
                  "is-active",
                  element.dataset.workItem === value,
                ),
              );
            };
            if (items[0]) activate(items[0].dataset.workItem);
            items.forEach((element) =>
              ScrollTrigger.create({
                trigger: element,
                start: "top 58%",
                end: "bottom 42%",
                onEnter: () => activate(element.dataset.workItem),
                onEnterBack: () => activate(element.dataset.workItem),
              }),
            );
          });

          if (desktop) {
            const cards = all("[data-stack-card]");
            cards.slice(0, -1).forEach((card, index) =>
              gsap.to(card, {
                scale: 0.94,
                opacity: 0.42,
                transformOrigin: "50% 0%",
                ease: "none",
                scrollTrigger: {
                  trigger: cards[index + 1],
                  start: "top 82%",
                  end: "top 25%",
                  scrub: 0.7,
                  invalidateOnRefresh: true,
                },
              }),
            );
            all("[data-parallax]").forEach((element) =>
              gsap.fromTo(
                element,
                { yPercent: -6, scale: 1.16 },
                {
                  yPercent: 6,
                  scale: 1.16,
                  ease: "none",
                  scrollTrigger: {
                    trigger: element.parentElement || element,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: 1,
                    invalidateOnRefresh: true,
                  },
                },
              ),
            );
          }

          all("[data-count-to]").forEach((element) => {
            const target = Number(element.dataset.countTo);
            if (!Number.isFinite(target)) return;
            const original = element.textContent;
            const suffix = element.dataset.suffix || "";
            const decimals = (
              String(element.dataset.countTo).split(".")[1] || ""
            ).length;
            const format = new Intl.NumberFormat("en", {
              minimumFractionDigits: Math.min(decimals, 3),
              maximumFractionDigits: Math.min(decimals, 3),
            });
            const state = { value: 0 };
            manualRestores.push(() => {
              element.textContent = original;
            });
            const tween = gsap.to(state, {
              value: target,
              duration: 1.65,
              ease: "power2.out",
              paused: true,
              onUpdate: () => {
                element.textContent = `${format.format(state.value)}${suffix}`;
              },
            });
            ScrollTrigger.create({
              trigger: element,
              start: "top 92%",
              once: true,
              onEnter: () => tween.play(),
            });
          });

          if (desktop) {
            lenis = new Lenis({
              autoRaf: false,
              duration: 1.05,
              smoothWheel: true,
              syncTouch: false,
              anchors: { offset: -100 },
              // Native overflow areas retain their own wheel/touch handling.
              prevent: (node) =>
                Boolean(
                  node.closest?.(
                    ".messages, .floating-chat, .voice-dialog, .studio-dialog, textarea, [data-lenis-prevent]",
                  ),
                ),
            });
            lenis.on("scroll", ScrollTrigger.update);
            ticker = (time) => lenis.raf(time * 1000);
            gsap.ticker.add(ticker);
            const syncScrollLock = () => {
              const overflow = getComputedStyle(document.body).overflowY;
              const locked =
                Boolean(document.querySelector('[aria-modal="true"]')) ||
                overflow === "hidden";
              if (locked === scrollLocked) return;
              scrollLocked = locked;
              if (locked) lenis.stop();
              else lenis.start();
              if (cursor && locked) cursor.style.opacity = "0";
            };
            bodyObserver = new MutationObserver(syncScrollLock);
            bodyObserver.observe(document.body, {
              attributes: true,
              attributeFilter: ["style", "class"],
            });
            // Ignore animation style mutations: only modal attributes and DOM insertions matter.
            const containsDialog = (node) =>
              node instanceof Element &&
              (node.matches("[aria-modal]") ||
                Boolean(node.querySelector("[aria-modal]")));
            dialogObserver = new MutationObserver((records) => {
              const dialogChanged = records.some(
                (record) =>
                  record.type === "attributes" ||
                  Array.from(record.addedNodes).some(containsDialog) ||
                  Array.from(record.removedNodes).some(containsDialog),
              );
              if (dialogChanged) syncScrollLock();
            });
            dialogObserver.observe(document.body, {
              subtree: true,
              childList: true,
              attributes: true,
              attributeFilter: ["aria-modal"],
            });
            syncScrollLock();
          }

          if (desktop && fine) {
            cursor = document.createElement("div");
            cursor.className = "studio-cursor";
            cursor.setAttribute("aria-hidden", "true");
            document.body.appendChild(cursor);
            gsap.set(cursor, { xPercent: -50, yPercent: -50 });
            const x = gsap.quickTo(cursor, "x", {
              duration: 0.18,
              ease: "power3.out",
            });
            const y = gsap.quickTo(cursor, "y", {
              duration: 0.18,
              ease: "power3.out",
            });
            const move = (event) => {
              if (event.pointerType && event.pointerType !== "mouse") return;
              x(event.clientX);
              y(event.clientY);
              cursor.style.opacity = scrollLocked ? "0" : "1";
              const target =
                event.target instanceof Element
                  ? event.target.closest("[data-cursor]")
                  : null;
              const label =
                target && root.contains(target) ? target.dataset.cursor : "";
              cursor.textContent = label || "";
              cursor.classList.toggle("is-hovering", Boolean(label));
            };
            const hide = () => {
              cursor.style.opacity = "0";
            };
            listen(root, "pointermove", move, { passive: true });
            listen(root, "pointerleave", hide, { passive: true });
            listen(window, "blur", hide);
          }
        });
        refreshFrame = requestAnimationFrame(refresh);
        document.fonts?.ready.then(refresh).catch(() => {});
        listen(window, "load", refresh, { once: true });
        all("img")
          .filter((image) => !image.complete)
          .forEach((image) => {
            listen(image, "load", refresh, { once: true });
            listen(image, "error", refresh, { once: true });
          });
      } catch {
        // A failed optional effect restores baseline content instead of trapping the page.
        cleanup();
      }
      return cleanup;
    },
    root,
  );

  return () => {
    disposed = true;
    media.revert();
  };
}
