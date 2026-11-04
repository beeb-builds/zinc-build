"use client";

import { useEffect } from "react";

export default function ScrollMotion({ route }: { route: string }) {
  useEffect(() => {
    const root = document.getElementById("zinc-content");
    if (!root || !window.matchMedia || !("IntersectionObserver" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;
    let mutations: MutationObserver | undefined;
    const prepared = new Set<HTMLElement>();
    const revealAll = () => {
      observer?.disconnect(); mutations?.disconnect();
      prepared.forEach((node) => node.classList.remove("zinc-reveal-pending"));
    };
    function start() {
      if (preference.matches) { revealAll(); return; }
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) if (entry.isIntersecting) {
          entry.target.classList.remove("zinc-reveal-pending");
          entry.target.classList.add("zinc-reveal-visible");
          observer?.unobserve(entry.target);
        }
      }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });
      function prepare() {
        const candidates = root!.querySelectorAll<HTMLElement>("section, article, [data-zinc-reveal]");
        candidates.forEach((node, index) => {
          if (prepared.has(node)) return;
          prepared.add(node);
          // Nested panels inherit the section's reveal; avoid stacked transforms.
          if (node.parentElement?.closest("[data-zinc-motion]")) return;
          node.dataset.zincMotion = "true";
          node.style.setProperty("--zinc-reveal-delay", `${Math.min(index % 4, 3) * 55}ms`);
          node.classList.add("zinc-reveal-surface");
          // Keep above-the-fold content and focused controls visible immediately.
          if (node.getBoundingClientRect().top < window.innerHeight - 24 || node.contains(document.activeElement)) return;
          node.classList.add("zinc-reveal-pending");
          observer?.observe(node);
        });
      }
      prepare();
      mutations = new MutationObserver(prepare);
      mutations.observe(root!, { childList: true, subtree: true });
    }
    function onPreference() { revealAll(); if (!preference.matches) start(); }
    function onFocus(event: FocusEvent) {
      if (event.target instanceof HTMLElement) event.target.closest(".zinc-reveal-pending")?.classList.remove("zinc-reveal-pending");
    }
    start();
    preference.addEventListener("change", onPreference);
    root.addEventListener("focusin", onFocus);
    return () => {
      revealAll();
      preference.removeEventListener("change", onPreference);
      root.removeEventListener("focusin", onFocus);
      prepared.forEach((node) => { delete node.dataset.zincMotion; node.classList.remove("zinc-reveal-surface", "zinc-reveal-visible"); node.style.removeProperty("--zinc-reveal-delay"); });
    };
  }, [route]);
  return null;
}
