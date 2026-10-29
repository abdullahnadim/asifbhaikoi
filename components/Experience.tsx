'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowDownRight, ArrowRight, Check, Coffee, Heart, Link2, RotateCcw, Sparkles, X } from 'lucide-react';
import Customizer from '@/components/Customizer';
import AsifExperience from '@/components/AsifExperience';
import { Scene } from '@/components/Scene';
import { getThemeDefault, getAsifConfig, loadConfig, saveConfig, parseConfig, type SiteConfig } from '@/lib/config';

type Point = { x: number; y: number };
const themeCopy = {
  office: { label: 'THE OFFICE EDITION', pre: 'A very serious question.', sub: 'Your honest opinion is needed. HR is definitely not watching.', foot: 'Some decisions are harder than they look.', stamp: 'OFFICIALLY\nUNPRODUCTIVE', note: 'Just a quick work-related survey.', success: 'We knew it.', after: 'Another mystery solved. Back to “work”.', tag: 'A little office mischief' },
  romance: { label: 'THE LOVE EDITION', pre: 'A question from the heart.', sub: 'No pressure. Just the most important question in the universe.', foot: 'Some answers are written in the stars.', stamp: 'HOPELESSLY\nROMANTIC', note: 'Be honest. My heart can take it. Probably.', success: 'It’s a yes!', after: 'Okay, that just made my whole day.', tag: 'A little love, a lot of butterflies' },
  friends: { label: 'THE BESTIE EDITION', pre: 'Friendship is on the line.', sub: 'One small question. A very big test of our friendship.', foot: 'Best friends. Questionable decisions.', stamp: 'CERTIFIED\nBESTIE TEST', note: 'Your answer may affect our friendship.', success: 'That’s my bestie!', after: 'A true friend always understood the assignment.', tag: 'Good friends. Great mischief.' },
};

export default function Experience({ edition = 'customizable' }: { edition?: 'customizable' | 'asif' }) {
  return edition === 'asif' ? <AsifExperience /> : <CustomizableExperience />;
}

function CustomizableExperience({ edition = 'customizable' }: { edition?: 'customizable' | 'asif' }) {
  const isAsifEdition = edition === 'asif';
  const [config, setConfig] = useState<SiteConfig>(() => isAsifEdition ? getAsifConfig() : getThemeDefault('office'));
  const [saved, setSaved] = useState<SiteConfig>(() => isAsifEdition ? getAsifConfig() : getThemeDefault('office'));
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [hops, setHops] = useState(0);
  const [toast, setToast] = useState('');
  const [positions, setPositions] = useState<[Point, Point]>([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  const [magnets, setMagnets] = useState<[Point, Point]>([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  const arena = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const positionRef = useRef(positions);
  const lastHop = useRef(0);
  const hopSequence = useRef(0);
  const touchTapCount = useRef(0);
  const lastLogoTap = useRef(0);
  const successRef = useRef<HTMLHeadingElement>(null);
  const retryFocus = useRef(false);
  const copy = themeCopy[config.theme];

  useEffect(() => {
    if (isAsifEdition) { setReady(true); return; }
    let restored = loadConfig();
    try {
      const shared = new URLSearchParams(window.location.hash.slice(1)).get('c');
      if (shared) restored = parseConfig(JSON.parse(decodeURIComponent(escape(atob(shared)))));
    } catch { setToast('That shared configuration could not be loaded. Using your saved settings.'); }
    setConfig(restored); setSaved(restored); setReady(true);
  }, [isAsifEdition]);

  useEffect(() => {
    document.title = config.pageTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', config.description);
    const themeMeta = document.querySelector('meta[name="theme-color"]') ?? document.createElement('meta');
    themeMeta.setAttribute('name', 'theme-color'); themeMeta.setAttribute('content', config.background);
    document.head.appendChild(themeMeta);
  }, [config]);

  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4500); return () => clearTimeout(t); }, [toast]);

  const openEditor = useCallback(() => { if (isAsifEdition) return; setResult(null); setEditing(true); }, [isAsifEdition]);
  useEffect(() => {
    if (isAsifEdition) return;
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault(); if (!editing) openEditor();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [editing, openEditor, isAsifEdition]);
  useEffect(() => { if (result !== null) successRef.current?.focus(); }, [result]);
  useEffect(() => { if (result === null && retryFocus.current) { buttonRefs.current[0]?.focus(); retryFocus.current = false; } }, [result]);

  const resetPositions = useCallback(() => {
    const region = arena.current;
    if (!region) return;
    const w = region.clientWidth;
    const widths = [0, 1].map(i => buttonRefs.current[i]?.offsetWidth ?? 180);
    const heights = [0, 1].map(i => buttonRefs.current[i]?.offsetHeight ?? 58);
    const stacked = widths[0] + widths[1] + 24 > w - 24;
    region.style.minHeight = stacked ? `${heights[0] + heights[1] + 100}px` : '';
    const h = region.clientHeight;
    const total = widths[0] + widths[1] + 20;
    const next: [Point, Point] = stacked
      ? [{ x: (w - widths[0]) / 2, y: 24 }, { x: (w - widths[1]) / 2, y: h - heights[1] - 24 }]
      : [{ x: (w - total) / 2, y: (h - heights[0]) / 2 }, { x: (w - total) / 2 + widths[0] + 20, y: (h - heights[1]) / 2 }];
    positionRef.current = next; setPositions(next); setMagnets([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  }, []);

  useEffect(() => {
    resetPositions();
    const observer = new ResizeObserver(resetPositions);
    if (arena.current) observer.observe(arena.current);
    buttonRefs.current.forEach(button => { if (button) observer.observe(button); });
    return () => observer.disconnect();
  }, [resetPositions, config, result]);

  const escapeButton = useCallback((index: number, pointer: Point) => {
    const region = arena.current, button = buttonRefs.current[index];
    if (!region || !button) return;
    const now = performance.now();
    if (now - lastHop.current < 110) return;
    const rect = region.getBoundingClientRect();
    const bw = button.offsetWidth, bh = button.offsetHeight;
    const minX = Math.max(8, 8 - rect.left), minY = Math.max(8, 8 - rect.top);
    const maxX = Math.min(rect.width - bw - 8, window.innerWidth - rect.left - bw - 8);
    const maxY = Math.min(rect.height - bh - 8, window.innerHeight - rect.top - bh - 8);
    // Only jump into the visible part of the arena. Scrolling always stays free.
    if (maxX < minX || maxY < minY) return;
    const other = buttonRefs.current[1 - index];
    const op = positionRef.current[1 - index];
    const ow = other?.offsetWidth ?? 180, oh = other?.offsetHeight ?? 58;
    const px = pointer.x - rect.left, py = pointer.y - rect.top;
    const current = positionRef.current[index];
    const candidates: Point[] = [];
    for (let row = 0; row < 5; row++) for (let col = 0; col < 7; col++) {
      const x = minX + (maxX - minX) * col / 6, y = minY + (maxY - minY) * row / 4;
      const gap = config.buttons[1 - index].behavior === 'magnetic' ? 30 : 12;
      if (x < op.x + ow + gap && x + bw + gap > op.x && y < op.y + oh + gap && y + bh + gap > op.y) continue;
      candidates.push({ x, y });
    }
    candidates.sort((a, b) => {
      const score = (p: Point) => Math.hypot(p.x + bw / 2 - px, p.y + bh / 2 - py) + Math.hypot(p.x - current.x, p.y - current.y) * .15;
      return score(b) - score(a);
    });
    if (!candidates.length) return;
    const choice = candidates[hopSequence.current++ % Math.min(2, candidates.length)];
    const next: [Point, Point] = [...positionRef.current]; next[index] = choice;
    positionRef.current = next; setPositions(next); lastHop.current = now; setHops(n => n + 1);
  }, [config.buttons]);

  useEffect(() => {
    if (result !== null || editing) return;
    const pointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      config.buttons.forEach((button, index) => {
        const el = buttonRefs.current[index]; if (!el) return;
        const rect = el.getBoundingClientRect();
        const dx = e.clientX - (rect.left + rect.width / 2), dy = e.clientY - (rect.top + rect.height / 2);
        const edgeDistance = Math.hypot(Math.max(0, Math.abs(dx) - rect.width / 2), Math.max(0, Math.abs(dy) - rect.height / 2));
        if (button.behavior === 'escape' && edgeDistance < 55) escapeButton(index, { x: e.clientX, y: e.clientY });
        if (button.behavior === 'magnetic') {
          const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          const power = config.intensity === 'playful' ? .22 : config.intensity === 'balanced' ? .16 : .09;
          const next = !reduced && edgeDistance < 95 ? { x: Math.max(-14, Math.min(14, dx * power)), y: Math.max(-12, Math.min(12, dy * power)) } : { x: 0, y: 0 };
          setMagnets(old => { const values: [Point, Point] = [...old]; values[index] = next; return values; });
        }
      });
    };
    const leave = () => setMagnets([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
    window.addEventListener('pointermove', pointerMove); document.addEventListener('pointerleave', leave);
    return () => { window.removeEventListener('pointermove', pointerMove); document.removeEventListener('pointerleave', leave); };
  }, [config, editing, result, escapeButton]);

  const apply = (next: SiteConfig) => {
    setConfig(next); setSaved(next); setResult(null); setHops(0);
    try { saveConfig(next); setToast('Your mischief is saved.'); } catch { setToast('Preview applied. Browser storage is unavailable; export a backup to keep it.'); }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setEditing(false);
  };

  const share = async () => {
    try {
      const url = new URL(window.location.href);
      url.hash = isAsifEdition ? '' : 'c=' + encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(config)))));
      await navigator.clipboard.writeText(url.toString()); setToast('Link copied. Go make someone’s day.');
    } catch { setToast(isAsifEdition ? 'Copying is unavailable in this browser. Copy the address from your browser to share.' : 'Copying is unavailable in this browser. You can export your question from the customization panel.'); }
  };

  const logoTap = () => {
    if (isAsifEdition) return;
    const now = Date.now(); touchTapCount.current = now - lastLogoTap.current < 650 ? touchTapCount.current + 1 : 1;
    lastLogoTap.current = now;
    if (touchTapCount.current >= 5) { touchTapCount.current = 0; openEditor(); }
  };
  const vars = { '--page-bg': config.background, '--accent': config.accent } as CSSProperties;
  const brand = <><span className="brand-symbol"><span/><span/></span>choose<span className="wordmark-light">one</span><span className="brand-period">.</span></>;

  return <div className={`experience theme-${config.theme} font-${config.font} intensity-${config.intensity}${editing ? ' is-editing' : ''}`} style={vars}>
    <div inert={editing} className="public-experience">
      <header className="site-header">
        {isAsifEdition ? <span className="wordmark" aria-label="Choose One">{brand}</span> : <button className="wordmark" onClick={logoTap} aria-label="Choose One home">{brand}</button>}
        <div className="header-note"><span className="status-dot"/> SMALL QUESTIONS. BIG PERSONALITIES.</div>
      </header>

      <main className="main-content" aria-busy={!ready}>
        <div className="edition-pill"><span className="edition-dot"/>{copy.label}<span className="edition-number">NO. 0{config.theme === 'office' ? '1' : config.theme === 'romance' ? '2' : '3'}</span></div>
        <p className="intro">{copy.pre}</p>
        <section className={`question-card ${result !== null ? 'is-success' : ''}`} aria-label="Interactive question">
          <div className="card-grain"/>
          <div className="card-topline"><span><span className="tiny-dot"/> {config.theme === 'office' ? 'QUICK TEAM CHECK-IN' : config.theme === 'romance' ? 'A LITTLE HEART CHECK' : 'THE FRIENDSHIP CHECK'}</span><span className="time-label">TAKES 5 SECONDS. MAYBE.</span></div>
          {result === null ? <>
            <div className="question-art"><Scene theme={config.theme}/><span className="hand-note">{config.theme === 'office' ? 'on a little break...' : config.theme === 'romance' ? 'asking for a friend ♡' : 'fries before guys'}<svg viewBox="0 0 57 35" aria-hidden="true"><path d="M2 2c3 20 29 29 49 20m-10-7 12 6-7 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></span></div>
            <h1 className="question-title">{config.question}</h1>
            <p className="question-subtitle">{copy.sub}</p>
            <div className="answer-arena" ref={arena}>
              {config.buttons.map((button, index) => <button key={index} ref={el => { buttonRefs.current[index] = el; }}
                className={`answer-button answer-${index} behavior-${button.behavior}`}
                style={{ left: positions[index].x, top: positions[index].y, transform: `translate(${magnets[index].x}px, ${magnets[index].y}px)`, visibility: ready ? 'visible' : 'hidden' }}
                onPointerEnter={e => { if (button.behavior === 'escape') escapeButton(index, { x: e.clientX, y: e.clientY }); }}
                onPointerDown={e => { if (button.behavior === 'escape') { e.preventDefault(); escapeButton(index, { x: e.clientX, y: e.clientY }); } }}
                onClick={e => { if (button.behavior === 'escape' && e.detail !== 0) { e.preventDefault(); return; } setResult(index); }}
                aria-describedby={button.behavior === 'escape' ? 'escape-help' : undefined}>
                <span>{button.label}</span>{index === 0 ? <ArrowRight size={18}/> : <span className="button-spark">↗</span>}
              </button>)}
            </div>
            <p className="arena-caption" aria-live="polite">{hops > 0 ? [ 'Hmm. That one seems a little shy.', 'Nice try. It has places to be.', 'You’re committed. We respect that.' ][Math.min(2, Math.floor((hops - 1) / 3))] : <><span className="caption-star">✳</span> {copy.note}</>}</p>
            <span id="escape-help" className="sr-only">This playful button moves away from pointers. Keyboard users can press Enter or Space to choose it.</span>
          </> : <div className="success-content">
            <div className="confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--i': i, '--r': `${i * 20}deg`, '--d': `${85 + (i % 4) * 25}px` } as CSSProperties}/>)}</div>
            <div className="success-medallion">{config.theme === 'romance' ? <Heart size={42} fill="currentColor"/> : config.theme === 'friends' ? <Sparkles size={42}/> : <Coffee size={42}/>}</div>
            <span className="success-eyebrow">{result === 0 ? 'EXCELLENT CHOICE' : 'THE UNEXPECTED ANSWER'}</span>
            <h1 ref={successRef} tabIndex={-1} className="success-title">{result === 0 ? copy.success : 'A plot twist!'}</h1>
            <p className="result-message">{config.buttons[result].result}</p>
            <p className="success-after">{copy.after}</p>
            <button className="try-again" onClick={() => { retryFocus.current = true; setResult(null); setHops(0); }}><RotateCcw size={16}/> Ask me again</button>
          </div>}
          <div className="card-bottomline"><span className="little-faces"><span>◡</span><span>◡</span><span>◡</span></span><span>NO WRONG ANSWERS<span className="fine-print"> (allegedly).</span></span><span className="card-corner-mark">↳</span></div>
        </section>
        <div className="below-card"><span className="below-text"><ArrowDownRight size={15}/>{copy.foot}</span><button className="share-button" onClick={share}><Link2 size={15}/> Pass it on <ArrowRight size={14}/></button></div>
        <div className="bottom-doodle" aria-hidden="true"><span className="doodle-line"/><Sparkles size={17}/><span className="doodle-line"/></div>
        <p className="made-for">Made for a laugh. Shared with love.</p>
        <p className="creator-credit">Made by <a href="https://abdullahnadim.vercel.app" target="_blank" rel="noopener noreferrer">Mir</a><span aria-hidden="true"> ↗</span></p>
      </main>

      <footer className="site-footer"><span>© {new Date().getFullYear()} Choose One</span><span className="footer-center">{copy.tag}</span><span>100% harmless. <span className="footer-muted">0% productivity.</span></span></footer>
    </div>
    {!isAsifEdition && editing && <Customizer config={saved} onPreview={next => { setConfig(next); setResult(null); setHops(0); }} onApply={apply} onClose={() => { setConfig(saved); setEditing(false); }}/ >}
    {toast && <div role="status" className="toast"><Check size={17}/><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={15}/></button></div>}
  </div>;
}
