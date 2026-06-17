"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";

export default function AccountTypePage() {
  const router = useRouter();

  function kiesRol(rol: "student" | "leraar") {
    router.push(`/auth/registreren?rol=${rol}`);
  }

  return (
    <main className="min-h-dvh flex flex-col" style={{ backgroundColor: "#0D1B2A" }}>

      {/* Logo top-right */}
      <div className="absolute top-5 right-5 z-10">
        <Image
          src="/images/doremio-logo2.png"
          alt="Doremio"
          width={90}
          height={65}
          priority
        />
      </div>

      {/* Gradient illustratie — edge-to-edge, afgeronde onderhoeken */}
      <div
        className="w-full flex-shrink-0"
        style={{
          height: "56vh",
          background: "radial-gradient(ellipse at 80% 10%, #FF560D 0%, #0766C6 70%)",
          borderBottomLeftRadius: 32,
          borderBottomRightRadius: 32,
        }}
      />

      {/* Actiegedeelte */}
      <div className="flex flex-col items-center justify-center flex-1 px-6 gap-4 pb-10">

        <button
          onClick={() => kiesRol("student")}
          className="w-full max-w-sm py-4 rounded-full font-apercu font-bold text-white text-body-lg active:scale-95 transition-transform duration-100"
          style={{ backgroundColor: "#0766C6" }}
        >
          Ik ben een student DKO
        </button>

        <button
          onClick={() => kiesRol("leraar")}
          className="w-full max-w-sm py-4 rounded-full font-apercu font-bold text-white text-body-lg active:scale-95 transition-transform duration-100"
          style={{ backgroundColor: "#FF560D" }}
        >
          Ik ben een docent of ouder
        </button>

        <p
          className="mt-6 font-apercu text-body-sm"
          style={{ color: "#8FA3B8" }}
        >
          Help &amp; Doremio
        </p>

      </div>
    </main>
  );
}
