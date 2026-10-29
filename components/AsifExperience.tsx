'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowRight, Coffee, RotateCcw } from 'lucide-react';
import { getAsifConfig } from '@/lib/config';
import { chooseEscapePosition, type Point, type Rect } from '@/lib/asif-movement';

const config = getAsifConfig();

export default function AsifExperience() {
  const stage = useRef<HTMLElement>(null);
  const prompt = useRef<HTMLHeadingElement>(null);
  const credit = useRef<HTMLParagraphElement>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const success = useRef<HTMLHeadingElement>(null);
  const sequence = useRef(0);
  const lastMove = useRef(0);
  const restoreFocus = useRef(false);
  const [positions, setPositions] = useState<[Point, Point]>([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
  const positionRef = useRef(positions);
  const [ready, setReady] = useState(false);
  const [fleeing, setFleeing] = useState(false);
  const [result, setResult] = useState<0 | 1 | null>(null);

  const resetPositions = useCallback(() => {
    if (!stage.current || !prompt.current) return;
    const bounds = stage.current.getBoundingClientRect();
    const heading = prompt.current.getBoundingClientRect();
    const width = bounds.width;
    const sizes = [0, 1].map(index => ({ width: buttons.current[index]?.offsetWidth ?? 192, height: buttons.current[index]?.offsetHeight ?? 58 }));
    const stacked = sizes[0].width + sizes[1].width + 24 > width - 40;
    const totalWidth = sizes[0].width + sizes[1].width + 20;
    const totalHeight = stacked ? sizes[0].height + sizes[1].height + 18 : Math.max(sizes[0].height, sizes[1].height);
    const bottom = credit.current ? credit.current.getBoundingClientRect().top - bounds.top - 28 : bounds.height - 72;
    const y = Math.max(16, Math.min(heading.bottom - bounds.top + 34, bottom - totalHeight));
    const next: [Point, Point] = stacked
      ? [{ x: (width - sizes[0].width) / 2, y }, { x: (width - sizes[1].width) / 2, y: y + sizes[0].height + 18 }]
      : [{ x: (width - totalWidth) / 2, y }, { x: (width - totalWidth) / 2 + sizes[0].width + 20, y }];
    positionRef.current = next;
    setFleeing(false);
    setPositions(next);
    setReady(true);
  }, []);

  useEffect(() => {
    document.title = config.pageTitle;
    resetPositions();
    const observer = new ResizeObserver(resetPositions);
    [stage.current, prompt.current, credit.current, ...buttons.current].forEach(element => { if (element) observer.observe(element); });
    window.addEventListener('resize', resetPositions);
    return () => { observer.disconnect(); window.removeEventListener('resize', resetPositions); };
  }, [resetPositions, result]);

  useEffect(() => {
    if (result !== null) success.current?.focus();
    else if (restoreFocus.current && ready) { buttons.current[0]?.focus(); restoreFocus.current = false; }
  }, [result, ready]);

  const evade = useCallback((pointer: Point) => {
    if (!stage.current || !buttons.current[1] || result !== null) return;
    if (performance.now() - lastMove.current < 70) return;
    const bounds = stage.current.getBoundingClientRect();
    const target = buttons.current[1];
    const visibleTarget = target.getBoundingClientRect();
    const asRect = (element: HTMLElement): Rect => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left - bounds.left, y: rect.top - bounds.top, width: rect.width, height: rect.height };
    };
    const obstacles = [prompt.current, buttons.current[0], credit.current].flatMap(element => element ? [asRect(element)] : []);
    const next = chooseEscapePosition({
      width: Math.min(bounds.width, window.innerWidth),
      height: Math.min(bounds.height, window.innerHeight),
      buttonWidth: target.offsetWidth,
      buttonHeight: target.offsetHeight,
      pointer: { x: pointer.x - bounds.left, y: pointer.y - bounds.top },
      current: { x: visibleTarget.left - bounds.left, y: visibleTarget.top - bounds.top },
      obstacles,
      sequence: sequence.current++,
    });
    if (!next) return;
    const nextPositions: [Point, Point] = [positionRef.current[0], next];
    positionRef.current = nextPositions;
    setFleeing(true);
    setPositions(nextPositions);
    lastMove.current = performance.now();
  }, [result]);

  useEffect(() => {
    if (result !== null) return;
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || !buttons.current[1]) return;
      const rect = buttons.current[1].getBoundingClientRect();
      const distance = Math.hypot(Math.max(rect.left - event.clientX, event.clientX - rect.right, 0), Math.max(rect.top - event.clientY, event.clientY - rect.bottom, 0));
      if (distance < 75) evade({ x: event.clientX, y: event.clientY });
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [evade, result]);

  return <div className="experience asif-fullscreen" style={{ '--page-bg': config.background, '--accent': config.accent } as CSSProperties}>
    <main className="asif-stage" ref={stage} aria-label="Asif bhai’s question">
      {result === null ? <>
        <h1 className="asif-question" ref={prompt}>{config.question}</h1>
        {config.buttons.map((button, index) => <button key={index}
          ref={element => { buttons.current[index] = element; }}
          className={`answer-button answer-${index} asif-answer${index === 1 && fleeing ? ' is-fleeing' : ''}`}
          style={{ left: positions[index].x, top: positions[index].y, visibility: ready ? 'visible' : 'hidden' }}
          onPointerEnter={event => { if (index === 1) evade({ x: event.clientX, y: event.clientY }); }}
          onPointerDown={event => { if (index === 1) { event.preventDefault(); evade({ x: event.clientX, y: event.clientY }); } }}
          onClick={event => { if (index === 1 && event.detail !== 0) { event.preventDefault(); return; } setResult(index as 0 | 1); }}
          aria-describedby={index === 1 ? 'asif-keyboard-help' : undefined}>
          <span>{button.label}</span>{index === 0 ? <ArrowRight size={18}/> : <span aria-hidden="true" className="button-spark">↗</span>}
        </button>)}
        <span id="asif-keyboard-help" className="sr-only">This button playfully moves across the page. Press Enter or Space to choose it with a keyboard.</span>
      </> : <section className="asif-result" aria-label="Your answer">
        <div className="asif-result-icon" aria-hidden="true"><Coffee size={38}/></div>
        <h1 ref={success} tabIndex={-1}>{result === 0 ? 'We knew it.' : 'A plot twist!'}</h1>
        <p>{config.buttons[result].result}</p>
        <button className="try-again" onClick={() => { restoreFocus.current = true; setReady(false); setResult(null); }}><RotateCcw size={16}/>Ask me again</button>
      </section>}
      <p ref={credit} className="creator-credit asif-credit">Made by <a href="https://abdullahnadim.vercel.app" target="_blank" rel="noopener noreferrer">Mir</a><span aria-hidden="true"> ↗</span></p>
    </main>
  </div>;
}
