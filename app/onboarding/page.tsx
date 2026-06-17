"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const SLIDES = [
  {
    tekst: "Welkom bij het deeltijdskunstonderwijs‑muziek en welkom bij Doremio!",
  },
  {
    tekst: "Doremio is er om met jou te leren oefenen. Samen gaan we op zoek naar hoe jij de allerbeste muzikant kan worden!",
  },
  {
    tekst: "We gaan jouw band vormen, muziek maken tijdens jam‑sessies en vooral heel veel plezier hebben! Ben jij er klaar voor?",
  },
];

export default function OnboardingIntroPage() {
  const router = useRouter();
  const [stap, setStap] = useState(0);

  function volgende() {
    if (stap < SLIDES.length - 1) {
      setStap(stap + 1);
    } else {
      router.push("/auth/account-type");
    }
  }

  return (
    <main className="min-h-dvh bg-warm-white flex flex-col items-center justify-center px-6 select-none">

      {/* Illustratie */}
      <div
        className="w-full max-w-sm rounded-3xl mb-10"
        style={{
          aspectRatio: "1 / 1",
          background: "radial-gradient(ellipse at 15% 85%, #0766C6 0%, #FF560D 100%)",
        }}
      />

      {/* Tekst */}
      <p
        className="text-center font-apercu font-bold text-heading-lg mb-12 max-w-xs"
        style={{ color: "#0766C6" }}
      >
        {SLIDES[stap].tekst}
      </p>

      {/* Pijlknop */}
      <button
        onClick={volgende}
        className="mb-8 flex items-center justify-center rounded-full active:scale-95 transition-transform duration-100"
        style={{
          backgroundColor: "#FFD100",
          width: 120,
          height: 56,
        }}
        aria-label="Volgende"
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>

      {/* Puntjesindicator */}
      <div className="flex items-center gap-3">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setStap(i)}
            aria-label={`Stap ${i + 1}`}
            className="rounded-full transition-all duration-200"
            style={{
              width: i === stap ? 10 : 10,
              height: 10,
              backgroundColor: i === stap ? "#0D1B2A" : "transparent",
              border: "2px solid #0D1B2A",
            }}
          />
        ))}
      </div>

    </main>
  );
}
