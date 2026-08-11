"use client";

import { ArrowUpRight, CalendarDays, Check, ChevronLeft, CircleHelp, CircleUserRound, Euro, Leaf, Layers3, Palette, Sparkles, Target } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type DesignId = "dawn" | "moss" | "indigo" | "mono";

type DesignOption = {
  id: DesignId;
  index: string;
  name: string;
  descriptor: string;
  summary: string;
  bestFor: string;
  icon: typeof Sparkles;
};

const designOptions: DesignOption[] = [
  {
    id: "dawn",
    index: "01 · warm",
    name: "Morgenlicht",
    descriptor: "warm, menschlich, ruhig",
    summary: "Eine helle, warme Richtung mit Terrakotta-Akzent und großen, weichen Flächen.",
    bestFor: "Wenn Clear sich wie ein freundlicher Neustart anfühlen soll.",
    icon: Sparkles,
  },
  {
    id: "moss",
    index: "02 · grounded",
    name: "Moos & Ruhe",
    descriptor: "erdig, organisch, geschützt",
    summary: "Ein dunkles Moos-Grün mit unregelmäßigen Rundungen — nah an Natur, ohne Wellness-Kitsch.",
    bestFor: "Wenn die App geborgen und weniger technisch wirken soll.",
    icon: Leaf,
  },
  {
    id: "indigo",
    index: "03 · focused",
    name: "Indigo Focus",
    descriptor: "klar, präzise, dunkel",
    summary: "Ein dunkles Indigo-System mit klaren Zahlen, präzisen Flächen und dem bestehenden Clear-Türkis als Akzent.",
    bestFor: "Wenn Fortschritt und Übersicht im Vordergrund stehen sollen.",
    icon: Target,
  },
  {
    id: "mono",
    index: "04 · editorial",
    name: "Schwarz / Weiß",
    descriptor: "direkt, mutig, zeitlos",
    summary: "Eine fast druckartige Editorial-Optik mit starken Linien, Serifenschrift und einem einzigen Signalrot.",
    bestFor: "Wenn Clear eine eigenständige, unverwechselbare Haltung bekommen soll.",
    icon: Layers3,
  },
];

export default function DesignGalleryPage() {
  const [selected, setSelected] = useState<DesignId | null>(null);
  const selectedOption = designOptions.find((option) => option.id === selected);

  return (
    <main className="design-gallery">
      <div className="design-gallery-shell">
        <header className="design-gallery-header">
          <Link className="design-back-link" href="/"><ChevronLeft size={17} /> Zur App</Link>
          <div className="design-gallery-brand"><span className="brand-mark"><span /></span><span>clear</span></div>
          <span className="design-gallery-status"><Palette size={14} /> Design-Atelier</span>
        </header>

        <section className="design-gallery-hero" aria-labelledby="design-gallery-title">
          <span className="design-gallery-kicker">Vier neue Richtungen</span>
          <h1 id="design-gallery-title">Welche Stimmung soll Clear haben?</h1>
          <p>Indigo Focus ist jetzt als dunkle Variante aktiv. Vergleiche die vier visuellen Richtungen und merke dir eine andere vor, wenn du später wechseln möchtest.</p>
        </section>

        {selectedOption && (
          <div className="design-selection" role="status">
            <span><Check size={16} /> Vorgemerkt: <strong>{selectedOption.name}</strong></span>
            <small>Schick mir danach einfach den Namen — ich übertrage die Richtung auf die gesamte App.</small>
          </div>
        )}

        <section className="design-grid" aria-label="Design-Vorlagen">
          {designOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = selected === option.id;
            return (
              <article className={`design-option design-option-${option.id}`} key={option.id}>
                <div className="design-option-meta">
                  <span>{option.index}</span>
                  <Icon size={17} />
                </div>
                <div className="design-preview-frame">
                  <DesignPreview variant={option.id} />
                </div>
                <div className="design-option-copy">
                  <span className="design-option-descriptor">{option.descriptor}</span>
                  <h2>{option.name}</h2>
                  <p>{option.summary}</p>
                  <div className="design-option-best"><strong>Passt zu dir, wenn …</strong><span>{option.bestFor}</span></div>
                  <button className={`design-select-button ${isSelected ? "is-selected" : ""}`} type="button" onClick={() => setSelected(isSelected ? null : option.id)}>
                    {isSelected ? <><Check size={16} /> Vorgemerkt</> : <>Diese Vorlage merken <ArrowUpRight size={16} /></>}
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        <footer className="design-gallery-footer">
          <span><CircleUserRound size={15} /> Die Vorlagen zeigen dieselbe Profil-Information in vier unterschiedlichen visuellen Sprachen.</span>
          <Link href="/">Zurück zu Clear <ArrowUpRight size={14} /></Link>
        </footer>
      </div>
    </main>
  );
}

function DesignPreview({ variant }: { variant: DesignId }) {
  return (
    <div className={`design-device design-preview-${variant}`}>
      <div className="design-device-topbar">
        <span className="design-device-logo"><span /> clear</span>
        <span>ICH</span>
        <CircleUserRound size={18} />
      </div>
      <div className="design-device-heading">
        <span>DEIN RAUM</span>
        <h3>Ich</h3>
        <p>Ein ruhiger Blick auf deinen Weg.</p>
      </div>
      <div className="design-device-identity">
        <div className="design-device-avatar">c</div>
        <div><strong>Cannabis</strong><small>seit 2. August 2026</small></div>
        <span className="design-device-streak"><Sparkles size={13} /> 8</span>
      </div>
      <div className="design-device-data">
        <div><span className="design-device-data-icon"><CircleHelp size={12} /></span><span><small>Substanz</small><strong>Cannabis</strong></span><b>Bearbeiten</b></div>
        <div><span className="design-device-data-icon"><CalendarDays size={12} /></span><span><small>Clean-Startdatum</small><strong>2. August 2026</strong></span><b>Bearbeiten</b></div>
        <div><span className="design-device-data-icon"><Euro size={12} /></span><span><small>Tageskosten</small><strong>20 €</strong></span><b>Bearbeiten</b></div>
      </div>
      <div className="design-device-motivation"><small>DEIN WARUM</small><strong>„Ich will wieder bei mir ankommen.“</strong><span>Bearbeiten <ArrowUpRight size={13} /></span></div>
      <div className="design-device-nav"><span className="is-active">Heute</span><span>Fortschritt</span><span>Ich</span></div>
    </div>
  );
}
