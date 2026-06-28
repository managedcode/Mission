/* =================================================================
   MISSION · client interactivity. Progressive, reduced-motion-safe.
   ================================================================= */

import { createMascotGame } from './game';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

/* ---------- Scroll reveal ---------- */
function initReveal() {
  const items = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  items.forEach((el) => io.observe(el));
}

/* ---------- Animated counters ---------- */
function animateCounter(el: HTMLElement) {
  const target = Number(el.dataset.count ?? '0');
  const prefix = el.dataset.prefix ?? '';
  const suffix = el.dataset.suffix ?? '';
  const dur = 1400;
  const start = performance.now();
  const useGrouping = target >= 1000;
  function frame(now: number) {
    const t = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = Math.round(target * eased);
    el.textContent = prefix + val.toLocaleString(useGrouping ? 'en-US' : undefined) + suffix;
    if (t < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function initCounters() {
  const counters = document.querySelectorAll<HTMLElement>('[data-count]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    counters.forEach((el) => {
      const prefix = el.dataset.prefix ?? '';
      const suffix = el.dataset.suffix ?? '';
      const target = Number(el.dataset.count ?? '0');
      el.textContent = prefix + target.toLocaleString('en-US') + suffix;
    });
    return;
  }
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCounter(entry.target as HTMLElement);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  counters.forEach((el) => io.observe(el));
}

/* ---------- Theme toggle ---------- */
function initTheme() {
  const toggles = document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');
  const sync = () => {
    const current = document.documentElement.getAttribute('data-theme') ?? 'light';
    const isDark = current === 'dark';
    toggles.forEach((b) => {
      b.setAttribute('aria-pressed', String(isDark));
      b.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    });
  };
  toggles.forEach((btn) =>
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') ?? 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try {
        localStorage.setItem('mission-theme', next);
      } catch {
        /* ignore */
      }
      sync();
    })
  );
  sync();
}

/* ---------- Mobile nav ---------- */
function initNav() {
  const toggle = document.querySelector<HTMLButtonElement>('[data-nav-toggle]');
  const menu = document.querySelector<HTMLElement>('[data-nav-menu]');
  if (!toggle || !menu) return;
  const firstLink = () => menu.querySelector<HTMLAnchorElement>('a');
  const close = (returnFocus = false) => {
    toggle.setAttribute('aria-expanded', 'false');
    menu.dataset.open = 'false';
    document.body.style.removeProperty('overflow');
    if (returnFocus) toggle.focus();
  };
  const open = () => {
    toggle.setAttribute('aria-expanded', 'true');
    menu.dataset.open = 'true';
    document.body.style.overflow = 'hidden';
    // wait a frame so the menu is visible before moving focus into it
    requestAnimationFrame(() => firstLink()?.focus());
  };
  toggle.addEventListener('click', () => {
    if (toggle.getAttribute('aria-expanded') === 'true') close();
    else open();
  });
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => close()));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') close(true);
  });
}

/* ---------- Hero terminal typewriter (the hero's signature beat) ---------- */
function initTerminal() {
  const code = document.querySelector<HTMLElement>('.terminal__body code');
  if (!code) return;
  const spans = Array.from(code.querySelectorAll<HTMLElement>('span'));
  if (spans.length === 0) return;
  const lines = spans.map((el) => ({ el, text: el.textContent ?? '' }));
  const lastEl = spans[spans.length - 1];
  const setCaret = (el: HTMLElement) => {
    spans.forEach((s) => s.classList.remove('caret'));
    el.classList.add('caret');
  };

  let done = false;
  // Instant-finish hook — used by reduced-motion and the visual test harness
  // so screenshots are deterministic.
  const finish = () => {
    done = true;
    lines.forEach(({ el, text }) => {
      el.textContent = text;
    });
    setCaret(lastEl);
  };
  (window as Window & { __finishTerminal?: () => void }).__finishTerminal = finish;

  if (reduceMotion) return; // keep the static, fully-typed terminal

  const typeAll = () => {
    if (done) return;
    spans.forEach((el) => {
      el.textContent = '';
      el.classList.remove('caret');
    });
    let li = 0;
    const typeLine = () => {
      if (done || li >= lines.length) return;
      const { el, text } = lines[li];
      const hasNL = text.endsWith('\n');
      const body = hasNL ? text.slice(0, -1) : text;
      setCaret(el);
      let ci = 0;
      const typeChar = () => {
        if (done) return;
        if (ci < body.length) {
          ci += 1;
          el.textContent = body.slice(0, ci);
          window.setTimeout(typeChar, 16 + Math.random() * 26);
        } else {
          el.textContent = body + (hasNL ? '\n' : '');
          li += 1;
          if (li >= lines.length) setCaret(lastEl);
          else window.setTimeout(typeLine, 200);
        }
      };
      typeChar();
    };
    typeLine();
  };

  if (!('IntersectionObserver' in window)) {
    typeAll();
    return;
  }
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          typeAll();
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.35 }
  );
  io.observe(code);
}

/* ---------- Header shrink on scroll ---------- */
function initHeader() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;
  const onScroll = () => {
    header.dataset.scrolled = String(window.scrollY > 24);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* ---------- Scroll progress (chunky pixel bar) ---------- */
function initScrollProgress() {
  const bar = document.querySelector<HTMLElement>('.scroll-progress');
  if (!bar) return;
  let ticking = false;
  const update = () => {
    const doc = document.documentElement;
    const max = doc.scrollHeight - doc.clientHeight;
    const p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
    bar.style.setProperty('--scroll', p.toFixed(4));
    ticking = false;
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', update, { passive: true });
}

/* ---------- Analytics: once-per-section scroll events ---------- */
let analyticsScrollCleanup: (() => void) | undefined;

function normalizeAnalyticsId(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'section'
  );
}

function getSectionId(el: HTMLElement, index: number) {
  const labelledBy = el.getAttribute('aria-labelledby') ?? '';
  const sectionClass = Array.from(el.classList).find(
    (cls) => cls !== 'section' && cls !== 'invert' && cls !== 'grain'
  );
  const raw =
    el.id || labelledBy.replace(/-(heading|h)$/i, '') || sectionClass || `section-${index + 1}`;
  return normalizeAnalyticsId(raw);
}

function getSectionName(el: HTMLElement, fallback: string) {
  const labelledBy = el.getAttribute('aria-labelledby');
  const heading =
    (labelledBy ? document.getElementById(labelledBy) : null) ??
    el.querySelector<HTMLElement>('h1, h2, h3');
  return heading?.textContent?.replace(/\s+/g, ' ').trim() || fallback;
}

function initAnalyticsScrollTracking() {
  analyticsScrollCleanup?.();
  analyticsScrollCleanup = undefined;

  if (document.documentElement.dataset.analytics !== 'production') return;
  if (navigator.webdriver) return;

  const sections = Array.from(document.querySelectorAll<HTMLElement>('main > section')).map(
    (el, index) => {
      const id = getSectionId(el, index);
      return {
        el,
        id,
        name: getSectionName(el, id),
      };
    }
  );
  if (sections.length === 0) return;

  const seen = new Set<string>();
  const track = (section: (typeof sections)[number]) => {
    if (seen.has(section.id)) return;
    seen.add(section.id);

    const payload = {
      section_id: section.id,
      section_name: section.name,
      page_path: window.location.pathname,
      page_title: document.title,
    };

    window.gtag?.('event', 'section_scroll', payload);
    window.clarity?.('event', `section_scroll_${section.id}`);
  };

  const findActiveSection = () => {
    const probeY = window.scrollY + window.innerHeight * 0.48;
    let current = sections[0];

    for (const section of sections) {
      const rect = section.el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const bottom = top + Math.max(rect.height, 1);

      if (probeY >= top && probeY < bottom) return section;
      if (top <= probeY) current = section;
    }

    return current;
  };

  let ticking = false;
  const update = () => {
    ticking = false;
    track(findActiveSection());
  };
  const requestUpdate = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };

  requestUpdate();
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  analyticsScrollCleanup = () => {
    window.removeEventListener('scroll', requestUpdate);
    window.removeEventListener('resize', requestUpdate);
  };
}

/* ---------- Konami easter egg ---------- */
function initKonami() {
  const seq = [
    'ArrowUp',
    'ArrowUp',
    'ArrowDown',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'ArrowLeft',
    'ArrowRight',
    'b',
    'a',
  ];
  let idx = 0;
  document.addEventListener('keydown', (e) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === seq[idx]) {
      idx += 1;
      if (idx === seq.length) {
        document.documentElement.classList.toggle('konami');
        (window as Window & { __missionArpeggio?: () => void }).__missionArpeggio?.();
        idx = 0;
      }
    } else {
      idx = key === seq[0] ? 1 : 0;
    }
  });
}

/* The custom pixel cursor was intentionally removed: it hid the native cursor
   (cursor:none) and its amber dot vanished over the amber CTAs, so the mouse
   appeared to "disappear" on buttons. We now keep the normal OS cursor. */

/* ---------- Magnetic hero / CTA buttons ---------- */
function initMagnetic() {
  if (reduceMotion) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.querySelectorAll<HTMLElement>('.hero__cta .btn, .final-cta__cta .btn').forEach((el) => {
    let rect = el.getBoundingClientRect();
    el.addEventListener('pointerenter', () => {
      rect = el.getBoundingClientRect();
    });
    el.addEventListener('mousemove', (e) => {
      const x = e.clientX - (rect.left + rect.width / 2);
      const y = e.clientY - (rect.top + rect.height / 2);
      el.style.transform = `translate(${x * 0.25}px, ${y * 0.32}px)`;
    });
    el.addEventListener('mouseleave', () => {
      el.style.transform = '';
    });
  });
}

/* ---------- Team/contact CTAs ----------
   These buttons used to rely on mailto as the primary action. On browsers
   without a mail handler that feels like a dead click, so the button now always
   lands on the contact block and shows the exact subject line. */
function initJoinContact() {
  const panel = document.querySelector<HTMLElement>('[data-join-contact-panel]');
  const status = document.querySelector<HTMLElement>('[data-join-contact-status]');
  if (!panel || !status) return;

  const email = panel.dataset.contactEmail ?? '';
  const selectedPrefix = status.dataset.selectedPrefix ?? 'Email subject:';
  const copiedPrefix = status.dataset.copiedPrefix ?? 'Copied email and subject:';
  const fallbackPrefix = status.dataset.copyFallbackPrefix ?? 'Use email and subject:';

  document.querySelectorAll<HTMLAnchorElement>('[data-join-contact-cta]').forEach((link) => {
    if (link.dataset.joinContactReady === 'true') return;
    link.dataset.joinContactReady = 'true';
    link.addEventListener('click', () => {
      const subject = link.dataset.contactSubject ?? '';
      const copyText = [email, subject ? `Subject: ${subject}` : ''].filter(Boolean).join('\n');

      panel.dataset.selected = 'true';
      status.textContent = subject
        ? `${selectedPrefix} ${subject}`
        : status.dataset.defaultStatus || '';

      window.requestAnimationFrame(() => {
        panel.focus({ preventScroll: true });
      });

      if (!copyText || !navigator.clipboard?.writeText) return;
      void navigator.clipboard
        .writeText(copyText)
        .then(() => {
          status.textContent = subject
            ? `${copiedPrefix} ${email} — ${subject}`
            : `${copiedPrefix} ${email}`;
        })
        .catch(() => {
          status.textContent = subject
            ? `${fallbackPrefix} ${email} — ${subject}`
            : `${fallbackPrefix} ${email}`;
        });
    });
  });
}

/* ---------- Console easter egg (our audience opens devtools) ---------- */
function initConsoleEgg() {
  try {
    console.log(
      '%c ◂▸ ManagedCode · MISSION ',
      'background:#df5f27;color:#23100a;font-weight:700;padding:6px 12px;font-family:monospace;font-size:13px;'
    );
    console.log(
      "%cYou opened the console. Of course you did.\n%cThat one dependency holding up your entire prod? Maintained by one burnt-out dev, for $0.\n%cWe're hiring maintainers → https://github.com/managedcode\n%c↑ ↑ ↓ ↓ ← → ← → B A — start",
      'color:#1a9b4b;font-weight:600;',
      'color:#888;',
      'color:#888;',
      'color:#888;'
    );
  } catch {
    /* ignore */
  }
}

/* ---------- Intro loader (CRT power-on, once per session) ----------
   Prints a few boot lines + a 0→100 counter, then a CRT power-on wipe reveals
   the (already-painted) page. Hard-guarded so it NEVER runs under automation. */
function initIntro() {
  const intro = document.querySelector<HTMLElement>('[data-intro]');
  if (!intro) return;

  const cleanup = () => {
    intro.remove();
    document.documentElement.classList.remove('intro-run');
    document.documentElement.classList.add('mascot-ready');
  };

  // 1) Never in automated runs — Playwright sets navigator.webdriver === true.
  //    Remove instantly so it can't appear in any screenshot or block tests.
  if (navigator.webdriver) {
    cleanup();
    return;
  }
  // 2) Reduced-motion or already-shown-this-session → skip, reveal page at once.
  let seen = false;
  try {
    seen = sessionStorage.getItem('mc-intro') === '1';
  } catch {
    /* ignore */
  }
  if (reduceMotion || seen) {
    cleanup();
    return;
  }
  try {
    sessionStorage.setItem('mc-intro', '1');
  } catch {
    /* ignore */
  }

  // 3) Run the boot sequence. Total budget ≤ 800ms, then wipe + remove.
  document.documentElement.classList.add('intro-run');
  const log = intro.querySelector<HTMLElement>('.intro__log');
  const pct = intro.querySelector<HTMLElement>('[data-intro-pct]');
  const lines = ['> mounting commons.fs … ', '> waking the keepers … ', '> linking maintainers … '];

  let li = 0;
  const printLine = () => {
    if (!log) return;
    if (li < lines.length) {
      log.insertAdjacentText('beforeend', lines[li]);
      log.insertAdjacentHTML('beforeend', '<span class="ok">[OK]</span>\n');
      li += 1;
      window.setTimeout(printLine, 150);
    } else {
      rampMeter();
    }
  };

  const startCount = performance.now();
  const countDur = 320;
  const rampMeter = () => {
    const tick = (now: number) => {
      const t = Math.min((now - startCount) / countDur, 1);
      const val = Math.round(t * 100);
      if (pct) pct.textContent = String(val).padStart(2, '0');
      if (t < 1) requestAnimationFrame(tick);
      else window.setTimeout(leave, 90);
    };
    requestAnimationFrame(tick);
  };

  const leave = () => {
    intro.classList.add('is-leaving');
    const done = () => {
      intro.removeEventListener('animationend', done);
      cleanup();
    };
    intro.addEventListener('animationend', done);
    // Fallback in case animationend never fires.
    window.setTimeout(cleanup, 420);
  };

  window.setTimeout(printLine, 60);
}

/* ---------- Sound layer (square-wave blips, default OFF) ----------
   A pixel-speaker toggle wires WebAudio blips on CTA hover/click + theme toggle,
   and a rising arpeggio when Konami fires. User-initiated only; state persists
   in localStorage('mission-sound'); default OFF so it never affects tests. */
function initSound() {
  // Guard against double-injection on Astro view-transition re-inits.
  if (document.querySelector('[data-sound-toggle]')) return;

  let on = false;
  try {
    on = localStorage.getItem('mission-sound') === 'on';
  } catch {
    /* ignore */
  }

  // --- toggle button (injected; top-right, near theme controls) ---
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'sound-toggle';
  btn.setAttribute('data-sound-toggle', '');
  btn.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' +
    '<path d="M2 6h2l3-3v10L4 10H2z"/>' +
    '<g class="sound-toggle__wave"><path d="M10 5v6h1V5z"/><path d="M12 3v10h1V3z"/></g>' +
    '<g class="sound-toggle__mute"><path d="M10 6l4 4M14 6l-4 4" stroke="currentColor" stroke-width="1.4" fill="none"/></g>' +
    '</svg>';
  const syncBtn = () => {
    btn.dataset.on = String(on);
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? 'Mute pixel sound effects' : 'Enable pixel sound effects');
  };
  syncBtn();
  document.body.appendChild(btn);

  // --- WebAudio (lazy; created on first user gesture) ---
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let ctx: AudioContext | null = null;
  const ensureCtx = () => {
    if (!AudioCtor) return null;
    if (!ctx) ctx = new AudioCtor();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  };

  const blip = (freq: number, when = 0, dur = 0.08, gain = 0.05) => {
    if (!on) return;
    const ac = ensureCtx();
    if (!ac) return;
    const t = ac.currentTime + when;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  const arpeggio = () => {
    if (!on) return;
    [523, 659, 784, 1047].forEach((f, i) => blip(f, i * 0.07, 0.1, 0.05));
  };
  // Expose so the Konami egg can fanfare when it fires.
  (window as Window & { __missionArpeggio?: () => void }).__missionArpeggio = arpeggio;

  btn.addEventListener('click', () => {
    on = !on;
    try {
      localStorage.setItem('mission-sound', on ? 'on' : 'off');
    } catch {
      /* ignore */
    }
    syncBtn();
    if (on) {
      ensureCtx();
      blip(880, 0, 0.09, 0.06); // confirmation chirp
    }
  });

  // --- attach hover/click blips to CTAs + theme toggle ---
  const ctas = document.querySelectorAll<HTMLElement>(
    '.btn--accent, .hero__cta .btn, .final-cta__cta .btn'
  );
  ctas.forEach((el) => {
    el.addEventListener('mouseenter', () => blip(660, 0, 0.06, 0.035));
    el.addEventListener('click', () => blip(990, 0, 0.09, 0.05));
  });
  document.querySelectorAll<HTMLElement>('[data-theme-toggle]').forEach((el) => {
    el.addEventListener('click', () => blip(740, 0, 0.07, 0.045));
  });
}

/* ---------- Mascot — a little RPG-style maintainer ----------
   On a capable desktop it roams the foot of the page, walks toward your cursor,
   hops, flips to face where it's going, and occasionally pipes up. Click it for
   a 1-UP. Roaming is motion-safe and NEVER runs under automation, so it can't
   touch visual baselines (the test helper also hides [data-mascot] outright).
   Under reduced-motion / touch it falls back to the static corner + click egg. */
function initMascot() {
  const mascot = document.querySelector<HTMLElement>('[data-mascot]');
  if (!mascot) return;
  const sprite = mascot.querySelector<HTMLElement>('.mascot__sprite');

  // the sprite is decorative (pointer-events:none) — make it clickable
  mascot.style.pointerEvents = 'auto';
  mascot.style.cursor = 'pointer';

  // Roams on a capable desktop (the hero runs around the foot of the page, chasing
  // the cursor and piping up). Still hard-gated off under automation, touch, and
  // reduced-motion so it never touches visual baselines.
  const canRoam =
    !reduceMotion &&
    !navigator.webdriver &&
    window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  const IDLE_QUIPS = [
    'new project?',
    'rewrite it in rust?',
    'who maintains this?',
    'still unpaid.',
    'someone has to.',
    'closing as wontfix',
    'just one more refactor',
    'ship it',
  ];

  // --- speech bubble (roam mode only) ---
  let bubble: HTMLElement | null = null;
  let bubbleT = 0;
  const speak = (text: string) => {
    if (!canRoam) return;
    if (!bubble) {
      bubble = document.createElement('span');
      bubble.className = 'mascot__say font-pixel';
      mascot.appendChild(bubble);
    }
    bubble.textContent = text;
    bubble.dataset.show = 'true';
    window.clearTimeout(bubbleT);
    bubbleT = window.setTimeout(() => {
      if (bubble) bubble.dataset.show = 'false';
    }, 2600);
  };

  // --- click launches the MISSION RUN mini-game (with a little hop) ---
  let hopStart = -1;
  const triggerHop = () => {
    if (canRoam) {
      hopStart = performance.now(); // JS-driven hop (composes with roaming x)
    } else if (sprite?.animate) {
      sprite.animate(
        [
          { transform: 'translateY(0)' },
          { transform: 'translateY(-12px)', offset: 0.35 },
          { transform: 'translateY(0)' },
        ],
        { duration: 450, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
      );
    } else {
      mascot.classList.remove('is-hop');
      mascot.classList.add('is-hop');
      window.setTimeout(() => mascot.classList.remove('is-hop'), 500);
    }
  };
  // The game DOM is built lazily on first launch() — never on load — so it can
  // never surface in screenshots/tests unless a real user clicks the mascot.
  const game = createMascotGame();
  mascot.addEventListener('click', () => {
    triggerHop();
    game.launch();
  });

  if (!canRoam) return; // static corner companion + click egg only

  // --- roaming companion ---
  mascot.classList.add('mascot--roaming');
  const mascotWidth = 52;
  const margin = 10;
  const minX = margin;
  const maxX = () => Math.max(minX, window.innerWidth - mascotWidth - margin);

  let x = Math.min(maxX(), 48);
  let target = x;
  let face = 1;
  let walking = false;
  let pointerX = -1;
  let lastPointer = -1e9;

  window.addEventListener(
    'pointermove',
    (e) => {
      pointerX = e.clientX;
      lastPointer = performance.now();
    },
    { passive: true }
  );

  let nextWander = 0;
  let last = performance.now();
  const loop = (now: number) => {
    if (document.hidden) {
      last = now;
      requestAnimationFrame(loop);
      return;
    }
    const dt = Math.min(now - last, 48);
    last = now;

    // chase the cursor while it's recently active; otherwise stroll somewhere
    if (now - lastPointer < 2600 && pointerX >= 0) {
      target = Math.max(minX, Math.min(maxX(), pointerX - mascotWidth / 2));
    } else if (now > nextWander) {
      target = minX + Math.random() * (maxX() - minX);
      nextWander = now + 5000 + Math.random() * 8000;
    }

    const d = target - x;
    if (Math.abs(d) > 1.5) {
      face = d < 0 ? -1 : 1;
      x += Math.sign(d) * Math.min(Math.abs(d), 0.14 * dt);
      walking = true;
    } else {
      walking = false;
    }

    // vertical = walk-bob + click-hop, both via --my (no CSS-animation clash)
    let my = 0;
    if (walking) my += -Math.abs(Math.sin(now / 110)) * 3;
    if (hopStart >= 0) {
      const ht = (now - hopStart) / 430;
      if (ht >= 1) hopStart = -1;
      else my += -Math.sin(ht * Math.PI) * 14;
    }

    mascot.style.setProperty('--mx', x.toFixed(1));
    mascot.style.setProperty('--my', my.toFixed(1));
    if (sprite) sprite.style.setProperty('--face', String(face));
    mascot.classList.toggle('is-walking', walking);

    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // perk up (and sometimes nudge) when the cursor hits a patron CTA
  document.querySelectorAll<HTMLElement>('.btn--accent').forEach((b) =>
    b.addEventListener('mouseenter', () => {
      triggerHop();
      if (Math.random() < 0.5) speak('fund me?');
    })
  );

  // an occasional idle line so it feels alive without nagging
  window.setInterval(() => {
    if (!walking && Math.random() < 0.45) speak(pick(IDLE_QUIPS));
  }, 17000);

  window.addEventListener(
    'resize',
    () => {
      x = Math.min(x, maxX());
    },
    { passive: true }
  );
}

/* ---------- Tab-title egg — a quiet note when you leave ---------- */
function initTabEgg() {
  if (navigator.webdriver) return; // never under test automation
  const original = document.title;
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden ? '// come back — the commons needs you' : original;
  });
}

function init() {
  initIntro();
  initReveal();
  initCounters();
  initTheme();
  initNav();
  initTerminal();
  initHeader();
  initScrollProgress();
  initAnalyticsScrollTracking();
  initMagnetic();
  initJoinContact();
  initKonami();
  initSound();
  initMascot();
  initTabEgg();
  initConsoleEgg();
  // Safety net: ensure the mascot reveals even if the intro overlay was absent.
  window.setTimeout(() => document.documentElement.classList.add('mascot-ready'), 50);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* re-init after Astro view transitions / swaps */
document.addEventListener('astro:after-swap', init);
