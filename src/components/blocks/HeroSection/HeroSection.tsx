"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { HeroBlockConfig } from "@/lib/types/blocks";

export interface HeroSectionProps {
  config: HeroBlockConfig;
}

const overlayClass = "absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent";

const FullWidthHero = ({ config }: { config: Extract<HeroBlockConfig, { variant: "fullWidth" }> }) => (
  <div className="relative h-[48vh] w-full overflow-hidden rounded-3xl md:h-[56vh]">
    <Image
      src={config.background.src}
      alt={config.background.alt}
      fill
      priority
      className="object-cover"
      sizes="100vw"
    />
    <div className={overlayClass} style={{ opacity: config.overlay ?? 0.35 }} />
    <div className="absolute inset-x-6 bottom-6 text-white md:inset-x-10" style={{ textAlign: config.textAlign }}>
      <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-3xl font-bold md:text-5xl">
        {config.title}
      </motion.h1>
      {config.subtitle ? (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="mt-2 text-white/90">
          {config.subtitle}
        </motion.p>
      ) : null}
      {config.cta ? (
        <div className="mt-4 flex flex-wrap justify-center gap-3 md:justify-start">
          <Button className="rounded-xl" variant={config.cta.style ?? "primary"}>
            {config.cta.text}
          </Button>
        </div>
      ) : null}
    </div>
  </div>
);

const SplitHero = ({ config }: { config: Extract<HeroBlockConfig, { variant: "split" }> }) => (
  <div className="grid items-stretch gap-4 overflow-hidden rounded-3xl md:grid-cols-2 md:gap-6">
    <div className="flex flex-col justify-center rounded-3xl border bg-card p-6 md:p-10">
      <h1 className="text-3xl font-bold md:text-5xl">{config.title}</h1>
      {config.subtitle ? <p className="mt-3 text-muted-foreground">{config.subtitle}</p> : null}
      {config.cta ? (
        <div className="mt-5 flex gap-3">
          <Button className="rounded-xl" variant={config.cta.style ?? "primary"}>
            {config.cta.text}
          </Button>
        </div>
      ) : null}
    </div>
    <div className="relative overflow-hidden rounded-3xl" style={{ backgroundColor: config.backgroundColor }}>
      <Image src={config.image} alt={config.title} fill className="object-cover" sizes="(min-width:768px) 50vw, 100vw" />
    </div>
  </div>
);

const CarouselHero = ({ config }: { config: Extract<HeroBlockConfig, { variant: "carousel" }> }) => {
  const [index, setIndex] = useState(0);
  const slides = useMemo(() => config.slides, [config.slides]);

  useEffect(() => {
    if (!config.autoplay) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, config.interval ?? 5000);
    return () => window.clearInterval(id);
  }, [config.autoplay, config.interval, slides.length]);

  const active = slides[index];

  return (
    <div className="relative h-[42vh] overflow-hidden rounded-3xl md:h-[56vh]">
      <motion.div
        key={active.image}
        initial={{ opacity: 0, scale: 1.03 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.5 }}
        className="absolute inset-0"
      >
        <Image src={active.image} alt={active.title} fill className="object-cover" sizes="100vw" />
        <div className={overlayClass} />
      </motion.div>
      <div className="absolute bottom-6 left-6 text-white md:left-10">
        <div className="text-2xl font-bold md:text-4xl">{active.title}</div>
        {active.subtitle ? <p className="mt-2 max-w-xl text-white/80">{active.subtitle}</p> : null}
        {active.cta ? (
          <div className="mt-3">
            <Button variant={active.cta.style ?? "primary"}>{active.cta.text}</Button>
          </div>
        ) : null}
      </div>
      {config.showDots ? (
        <div className="absolute bottom-4 right-4 flex gap-2">
          {slides.map((_, slideIndex) => (
            <button
              key={slideIndex}
              onClick={() => setIndex(slideIndex)}
              className={`h-2 w-6 rounded-full ${slideIndex === index ? "bg-white" : "bg-white/50"}`}
              aria-label={`Go to slide ${slideIndex + 1}`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export const HeroSection = ({ config }: HeroSectionProps) => {
  switch (config.variant) {
    case "fullWidth":
      return <FullWidthHero config={config} />;
    case "split":
      return <SplitHero config={config} />;
    case "carousel":
      return <CarouselHero config={config} />;
    default:
      return null;
  }
};
