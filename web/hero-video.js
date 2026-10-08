// Decorative, local-only hero footage. Sources stay inert until preferences
// permit playback; an ordinary image remains available without JavaScript.
export function initHeroVideo(video, { motion, connection, page, events }) {
  if (!video) return () => {};
  const sources = [...video.querySelectorAll('source[data-src]')];
  const frame = video.closest('.hero-media');
  let attached = false;
  let failed = false;
  let active = true;
  let attempt = 0;
  const blocked = () => motion.matches || connection?.saveData === true;
  const unload = () => {
    attempt += 1;
    video.autoplay = false;
    video.pause();
    frame.classList.remove('is-playing');
    if (attached) {
      sources.forEach((source) => source.removeAttribute('src'));
      video.removeAttribute('src');
      attached = false;
      video.load();
    }
  };
  const start = async () => {
    if (!active || blocked() || failed || page.hidden) return;
    if (attached && !video.paused) return;
    if (!attached) {
      video.muted = true;
      video.autoplay = true;
      sources.forEach((source) => source.setAttribute('src', source.dataset.src));
      attached = true;
      video.load();
    }
    const currentAttempt = ++attempt;
    try {
      await video.play();
      if (currentAttempt !== attempt) return;
      if (!active || blocked() || page.hidden) {
        video.pause();
        return;
      }
      frame.classList.add('is-playing');
    } catch {
      if (currentAttempt !== attempt) return;
      // Autoplay can be denied by the browser. Keep the static poster.
      unload();
    }
  };
  const sync = () => {
    if (!active || blocked() || failed) {
      unload();
      return;
    }
    if (page.hidden) {
      attempt += 1;
      video.pause();
    } else {
      void start();
    }
  };
  const onPlaying = () => {
    if (!active || blocked() || page.hidden) {
      video.pause();
      return;
    }
    frame.classList.add('is-playing');
  };
  const onError = () => { failed = true; unload(); };
  const onPageHide = () => { active = false; unload(); };
  const onPageShow = () => { active = true; sync(); };
  const listeners = [
    [video, 'playing', onPlaying],
    [video, 'error', onError],
    [motion, 'change', sync],
    [connection, 'change', sync],
    [page, 'visibilitychange', sync],
    [events, 'pagehide', onPageHide],
    [events, 'pageshow', onPageShow],
  ];
  listeners.forEach(([target, type, fn]) => target?.addEventListener?.(type, fn));
  sync();
  return () => {
    active = false;
    listeners.forEach(([target, type, fn]) => target?.removeEventListener?.(type, fn));
    unload();
  };
}

if (typeof document !== 'undefined') {
  const video = document.getElementById('hero-video');
  if (video && window.matchMedia) {
    initHeroVideo(video, {
      motion: window.matchMedia('(prefers-reduced-motion: reduce)'),
      connection: navigator.connection,
      page: document,
      events: window,
    });
  }
}
