/* ══════════════════════════════════════════
   BEAUTY BLACK ROOM — GSAP SCROLL ANIMATIONS
   ══════════════════════════════════════════ */

function initScrollAnimations() {
  if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  const ease = 'power3.out';

  /* ═══════ HERO ═══════ */
  /* left text */
  gsap.from('.hero-left .h1-word', {
    x: -80, opacity: 0,
    duration: 1.1, ease: 'power4.out',
    stagger: .15, delay: .2
  });
  gsap.from('.hero-tag', { opacity: 0, y: 16, duration: .6, delay: .1 });

  /* giraffe: scale + rotate in */
  gsap.from('.hero-giraffe', {
    scale: .5, opacity: 0, rotation: -10,
    duration: 1.4, ease: 'power4.out', delay: .3
  });

  /* right text */
  gsap.from('.hero-right .h1-word', {
    x: 80, opacity: 0,
    duration: 1.1, ease: 'power4.out',
    stagger: .15, delay: .5
  });
  gsap.from('#heroSub', { opacity: 0, y: 16, duration: .7, delay: .9 });

  /* bottom */
  gsap.from('.hero-bottom', { opacity: 0, y: 20, duration: .7, delay: 1.1 });

  /* ═══════ MARQUEE ═══════ */
  gsap.to('.marquee-text-track', {
    scrollTrigger: { trigger: '.marquee-text', start: 'top bottom', end: 'bottom top', scrub: 1 },
    x: -120
  });

  /* ═══════ BENEFITS — stagger ═══════ */
  gsap.from('.b-item', {
    opacity: 0, y: 40,
    duration: .7, stagger: .1, ease,
    scrollTrigger: { trigger: '.benefits', start: 'top 80%' }
  });

  /* ═══════ PRODUCTS — stagger ═══════ */
  gsap.from('.p-card', {
    opacity: 0, y: 50, scale: .96,
    duration: .8, ease, stagger: .08,
    scrollTrigger: { trigger: '.products', start: 'top 75%' }
  });

  /* ═══════ CATEGORIES — from left/right ═══════ */
  document.querySelectorAll('.cat-card').forEach(card => {
    const from = card.dataset.from === 'right' ? 80 : -80;
    gsap.from(card, {
      x: from, opacity: 0, duration: .9, ease,
      scrollTrigger: { trigger: card, start: 'top 85%' }
    });
  });

  /* ═══════ SHOWCASE — 3D REVEAL (alternating left/right) ═══════ */
  document.querySelectorAll('.show-row').forEach(row => {
    const dir = row.dataset.dir;
    const img = row.querySelector('.show-img');
    const info = row.querySelector('.show-info');

    /* image: 3D rotation in */
    gsap.from(img, {
      rotateY: dir === 'left' ? -25 : 25,
      x: dir === 'left' ? -100 : 100,
      opacity: 0,
      duration: 1.2,
      ease: 'power4.out',
      scrollTrigger: { trigger: row, start: 'top 80%' }
    });

    /* info: slide from opposite side */
    gsap.from(info, {
      x: dir === 'left' ? 60 : -60,
      opacity: 0,
      duration: 1,
      delay: .2,
      ease,
      scrollTrigger: { trigger: row, start: 'top 80%' }
    });

    /* tag line animate */
    const tag = info.querySelector('.tag');
    if (tag) {
      gsap.from(tag, {
        width: 0, opacity: 0,
        duration: .6, delay: .4,
        scrollTrigger: { trigger: row, start: 'top 80%' }
      });
    }
  });

  /* ═══════ INSTAGRAM — stagger ═══════ */
  gsap.from('.ig-item', {
    opacity: 0, y: 60,
    duration: .7, stagger: .1, ease,
    scrollTrigger: { trigger: '.instagram', start: 'top 80%' }
  });

  /* ═══════ CTA — scale words ═══════ */
  gsap.from('.cta-h2 span', {
    scale: 1.5, opacity: 0,
    duration: 1, stagger: .2, ease: 'power4.out',
    scrollTrigger: { trigger: '.cta', start: 'top 70%' }
  });
  gsap.from('.cta-in .tag', { opacity: 0, y: 20, duration: .6, scrollTrigger: { trigger: '.cta', start: 'top 75%' } });
  gsap.from('.cta-in p', { opacity: 0, y: 20, duration: .7, scrollTrigger: { trigger: '.cta', start: 'top 65%' } });
  gsap.from('.cta-btns', { opacity: 0, y: 20, duration: .7, scrollTrigger: { trigger: '.cta', start: 'top 60%' } });

  /* ═══════ CONTACTS — left/right ═══════ */
  gsap.from('.c-info', { x: -60, opacity: 0, duration: .9, ease, scrollTrigger: { trigger: '.contacts', start: 'top 75%' } });
  gsap.from('.map-box', { x: 60, opacity: 0, duration: .9, ease, scrollTrigger: { trigger: '.contacts', start: 'top 75%' } });

  /* ═══════ SECTION HEADS ═══════ */
  document.querySelectorAll('.sec-head').forEach(head => {
    const tag = head.querySelector('.tag');
    const h2 = head.querySelector('h2');
    if (tag) gsap.from(tag, { opacity: 0, y: 16, duration: .5, scrollTrigger: { trigger: head, start: 'top 85%' } });
    if (h2) gsap.from(h2, { opacity: 0, y: 30, duration: .7, delay: .1, scrollTrigger: { trigger: head, start: 'top 85%' } });
  });
}

/* if preloader already done */
if (document.getElementById('pre')?.classList.contains('gone')) {
  initScrollAnimations();
}
