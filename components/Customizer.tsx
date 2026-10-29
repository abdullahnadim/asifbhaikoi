"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, Eye, RotateCcw, Settings2, Upload, X } from "lucide-react";
import {
  ButtonBehavior,
  FONT_OPTIONS,
  getThemeDefault,
  parseConfig,
  SiteConfig,
  THEME_INFO,
  ThemeId,
} from "@/lib/config";

interface CustomizerProps {
  config: SiteConfig;
  onPreview: (config: SiteConfig) => void;
  onApply: (config: SiteConfig) => void;
  onClose: () => void;
}

const behaviorLabels: Record<ButtonBehavior, string> = {
  normal: "Normal · standard button",
  clickable: "Always clickable · stays put",
  escape: "Escape · catch me if you can",
  magnetic: "Magnetic · follows your cursor",
};

export default function Customizer({ config, onPreview, onApply, onClose }: CustomizerProps) {
  const [draft, setDraft] = useState<SiteConfig>(() => ({ ...config, buttons: [{ ...config.buttons[0] }, { ...config.buttons[1] }] }));
  const [tab, setTab] = useState<"content" | "style" | "settings">("content");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [previewOnly, setPreviewOnly] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previewButton = useRef<HTMLButtonElement>(null);
  const previewReturn = useRef<HTMLButtonElement>(null);
  const previewWasOpened = useRef(false);
  const previewOnlyRef = useRef(false);
  const previousOverflowRef = useRef("");
  const fileInput = useRef<HTMLInputElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  previewOnlyRef.current = previewOnly;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    previousOverflowRef.current = previousOverflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (previewOnlyRef.current) setPreviewOnly(false);
        else closeRef.current();
      }
      if (event.key !== "Tab" || !panel.current) return;
      const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]')).filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.current.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.current.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKey, true);
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = previewOnly ? previousOverflowRef.current : "hidden";
    if (previewOnly) {
      previewWasOpened.current = true;
      previewReturn.current?.focus();
    } else if (previewWasOpened.current) {
      previewButton.current?.focus();
    }
  }, [previewOnly]);

  function update(next: SiteConfig) {
    setDraft(next);
    setNotice("");
    setError("");
    onPreview(next);
  }

  function updateButton(index: 0 | 1, field: "label" | "result" | "behavior", value: string) {
    const buttons: SiteConfig["buttons"] = [{ ...draft.buttons[0] }, { ...draft.buttons[1] }];
    if (field === "behavior") {
      buttons[index].behavior = value as ButtonBehavior;
      // A challenge always needs a possible answer.
      if (value === "escape" && buttons[index === 0 ? 1 : 0].behavior === "escape") buttons[index === 0 ? 1 : 0].behavior = "clickable";
    } else buttons[index][field] = value;
    update({ ...draft, buttons });
  }

  function reset(theme: ThemeId) {
    update(getThemeDefault(theme));
    setNotice("Defaults restored in preview. Apply changes to save them.");
  }

  function apply() {
    try {
      const valid = parseConfig(draft);
      onApply(valid);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your changes could not be saved. Please try again.");
    }
  }

  function exportConfig() {
    try {
      const valid = parseConfig(draft);
      const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(valid, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `choose-one-${valid.theme}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setNotice("Configuration exported. Your next good joke is portable.");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please check your settings before exporting.");
    }
  }

  async function importConfig(file?: File) {
    if (!file) return;
    try {
      if (file.size > 32_768) throw new Error("That file is too large. Choose a configuration smaller than 32 KB.");
      let parsed: unknown;
      try { parsed = JSON.parse(await file.text()); } catch { throw new Error("That file isn't valid JSON. Choose an exported Choose One configuration."); }
      const valid = parseConfig(parsed);
      update(valid);
      setNotice("Configuration imported into preview. Apply changes to keep it.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That configuration could not be imported.");
      setNotice("");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  return (
    <div className={`admin-overlay${previewOnly ? " preview-mode" : ""}`} onPointerDown={(event) => { if (!previewOnly && event.target === event.currentTarget) onClose(); }}>
      <aside className="admin-panel" role="dialog" aria-modal="true" aria-labelledby="customizer-title" ref={panel}>
        {previewOnly && <button ref={previewReturn} className="admin-preview-return" onClick={() => setPreviewOnly(false)}><Settings2 size={16} />Back to editing</button>}
        <header className="admin-header">
          <div className="admin-heading-icon"><Settings2 size={21} /></div>
          <div><span className="admin-eyebrow">YOUR LITTLE CONTROL ROOM</span><h2 id="customizer-title">Make it yours.</h2></div>
          <button className="admin-icon-button" onClick={onClose} aria-label="Close customization panel" ref={closeButton}><X size={21} /></button>
        </header>
        <div className="admin-preview-badge"><span /><Eye size={14} /> Live preview <small>Changes appear as you type</small><button ref={previewButton} className="admin-preview-toggle" onClick={() => setPreviewOnly(true)}>Preview page</button></div>
        <nav className="admin-tabs" aria-label="Customization sections">
          {(["content", "style", "settings"] as const).map((name) => <button key={name} className={tab === name ? "active" : ""} aria-pressed={tab === name} onClick={() => setTab(name)}>{name === "content" ? "The question" : name === "style" ? "Look & feel" : "Settings"}</button>)}
        </nav>
        <div className="admin-body">
          {tab === "content" && <>
            <section className="admin-section">
              <div className="admin-section-heading"><span className="admin-number">01</span><h3>Set the scene</h3></div>
              <div className="admin-theme-grid">
                {(Object.keys(THEME_INFO) as ThemeId[]).map((theme) => <button key={theme} className={`admin-theme-card ${draft.theme === theme ? "selected" : ""}`} onClick={() => update(getThemeDefault(theme))} aria-pressed={draft.theme === theme}>
                  <span className={`admin-theme-swatch admin-theme-${theme}`}>{THEME_INFO[theme].emoji}</span><strong>{THEME_INFO[theme].name}</strong>{draft.theme === theme && <Check size={13} className="admin-theme-check" />}
                </button>)}
              </div>
              <p className="admin-help">Selecting a scene loads its question, colors, and playful behaviors.</p>
              <label className="admin-field">Your big question<textarea rows={3} maxLength={180} value={draft.question} onChange={(event) => update({ ...draft, question: event.target.value })} /><span className="admin-character-count">{draft.question.length}/180</span></label>
            </section>
            <section className="admin-section">
              <div className="admin-section-heading"><span className="admin-number">02</span><h3>Two choices. Your rules.</h3></div>
              {([0, 1] as const).map((index) => <div className="admin-button-card" key={index}>
                <span className="admin-eyebrow">BUTTON {index + 1}</span>
                <label className="admin-field">Label<input maxLength={50} value={draft.buttons[index].label} onChange={(event) => updateButton(index, "label", event.target.value)} /></label>
                <label className="admin-field">Personality<select value={draft.buttons[index].behavior} onChange={(event) => updateButton(index, "behavior", event.target.value)}>{Object.entries(behaviorLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                <label className="admin-field">What happens when clicked?<textarea rows={3} maxLength={400} value={draft.buttons[index].result} onChange={(event) => updateButton(index, "result", event.target.value)} /></label>
              </div>)}
              <p className="admin-help">Escaping buttons stay reachable with a keyboard. At least one choice always stays clickable.</p>
            </section>
          </>}
          {tab === "style" && <>
            <section className="admin-section">
              <div className="admin-section-heading"><span className="admin-number">01</span><h3>A little color</h3></div>
              <div className="admin-color-grid">
                <label className="admin-color-field"><span>Background</span><div><input type="color" value={draft.background} onChange={(event) => update({ ...draft, background: event.target.value })} /><code>{draft.background.toUpperCase()}</code></div></label>
                <label className="admin-color-field"><span>Accent</span><div><input type="color" value={draft.accent} onChange={(event) => update({ ...draft, accent: event.target.value })} /><code>{draft.accent.toUpperCase()}</code></div></label>
              </div>
            </section>
            <section className="admin-section">
              <div className="admin-section-heading"><span className="admin-number">02</span><h3>Find your type</h3></div>
              <label className="admin-field">Question font<select value={draft.font} onChange={(event) => update({ ...draft, font: event.target.value as SiteConfig["font"] })}>{FONT_OPTIONS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}</select></label>
              <div className={`admin-font-preview font-${draft.font}`}>A very good question.</div>
            </section>
            <section className="admin-section">
              <div className="admin-section-heading"><span className="admin-number">03</span><h3>Set the energy</h3></div>
              <label className="admin-field">Animation intensity<select value={draft.intensity} onChange={(event) => update({ ...draft, intensity: event.target.value as SiteConfig["intensity"] })}><option value="subtle">Subtle · just a little wiggle</option><option value="balanced">Balanced · a healthy dose of mischief</option><option value="playful">Playful · big bestie energy</option></select></label>
              <p className="admin-help">Your visitors’ reduced-motion preferences are always respected.</p>
            </section>
          </>}
          {tab === "settings" && <>
            <section className="admin-section">
              <div className="admin-section-heading"><span className="admin-number">01</span><h3>The finishing touches</h3></div>
              <label className="admin-field">Browser page title<input maxLength={120} value={draft.pageTitle} onChange={(event) => update({ ...draft, pageTitle: event.target.value })} /></label>
              <label className="admin-field">Page description<textarea maxLength={300} rows={3} value={draft.description} onChange={(event) => update({ ...draft, description: event.target.value })} /></label>
            </section>
            <section className="admin-section">
              <div className="admin-section-heading"><span className="admin-number">02</span><h3>Take your joke with you</h3></div>
              <p className="admin-help">Save a copy of your settings, or bring back a configuration you exported earlier.</p>
              <div className="admin-action-row"><button className="admin-secondary-button" onClick={exportConfig}><Download size={16} />Export JSON</button><button className="admin-secondary-button" onClick={() => fileInput.current?.click()}><Upload size={16} />Import JSON</button></div>
              <input ref={fileInput} type="file" accept="application/json,.json" aria-label="Import configuration JSON" hidden onChange={(event) => void importConfig(event.target.files?.[0])} />
            </section>
            <section className="admin-section">
              <div className="admin-section-heading"><span className="admin-number">03</span><h3>Fresh start?</h3></div>
              <button className="admin-reset-button" onClick={() => reset(draft.theme)}><RotateCcw size={15} />Reset this theme to default</button>
              <button className="admin-reset-button" onClick={() => reset("office")}><RotateCcw size={15} />Reset everything to office defaults</button>
            </section>
            <div className="admin-local-note"><strong>A little local secret.</strong><p>This shortcut is a convenience, not authentication. Settings are saved only in this browser. No accounts, servers, or secret credentials.</p></div>
          </>}
          <div className="admin-feedback" aria-live="polite">{error ? <p className="admin-error" role="alert">{error}</p> : notice ? <p className="admin-notice">{notice}</p> : null}</div>
        </div>
        <footer className="admin-footer"><div className="admin-footer-actions"><button className="admin-secondary-button" onClick={() => reset(draft.theme)} title="Preview the current theme's defaults"><RotateCcw size={15} />Reset</button><button className="admin-apply-button" onClick={apply}>Apply changes<Check size={17} /></button></div><p>Saved in this browser. Close to discard unapplied changes.</p></footer>
      </aside>
    </div>
  );
}
