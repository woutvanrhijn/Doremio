import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center"
      style={{ backgroundColor: '#F3E7DD' }}>

      <div className="w-20 h-20 rounded-2xl mb-6 mx-auto flex items-center justify-center"
        style={{ backgroundColor: '#0766C6' }}>
        <span className="text-white text-4xl">♪</span>
      </div>

      <h1 className="text-4xl font-bold mb-2" style={{ color: '#0766C6' }}>
        Doremio
      </h1>
      <p className="text-lg mb-12" style={{ color: '#666' }}>
        Jouw muzikale leeromgeving
      </p>

      <div className="flex flex-col gap-4 w-full max-w-sm px-6">
        <Link href="/auth/login">
          <button className="w-full py-4 px-6 rounded-2xl text-white font-semibold text-lg transition-transform hover:scale-105"
            style={{ backgroundColor: '#0766C6' }}>
            Inloggen
          </button>
        </Link>

        <Link href="/auth/registreren">
          <button className="w-full py-4 px-6 rounded-2xl text-white font-semibold text-lg transition-transform hover:scale-105"
            style={{ backgroundColor: '#FF560D' }}>
            Registreren
          </button>
        </Link>
      </div>

      <p className="mt-12 text-sm" style={{ color: '#999' }}>
        Deeltijds Kunstonderwijs Vlaanderen
      </p>

    </main>
  )
}