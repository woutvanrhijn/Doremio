"use client";

import Link from "next/link";
import Image from "next/image";

export default function SplashPage() {
  return (
    <main className="min-h-dvh bg-warm-white flex flex-col items-center justify-center px-6">

      {/* Logo */}
      <div className="mb-20">
        <Image
          src="/images/doremio-logo2.png"
          alt="Doremio"
          width={220}
          height={160}
          priority
        />
      </div>

      {/* Actions */}
      <div className="flex flex-col items-center gap-4 w-full max-w-xs">
        <Link
          href="/onboarding"
          className="w-full flex items-center justify-center bg-yellow text-navy font-apercu font-bold text-lg rounded-full py-4 px-8 active:scale-95 transition-transform duration-100"
        >
          START
        </Link>

        <Link
          href="/auth/login"
          className="font-apercu font-bold text-sm text-primary tracking-widest uppercase"
        >
          IK HEB AL EEN ACCOUNT
        </Link>
      </div>

    </main>
  );
}
