import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-neutral-950 text-white p-8">
      <div className="max-w-xl text-center space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight">
          2<span className="text-amber-500">Mangos</span>
        </h1>
        <p className="text-neutral-400 text-lg">
          O seu controle financeiro inteligente de forma simples e segura.
        </p>
        <div className="flex items-center justify-center gap-4 pt-4">
          <Link
            href="/login"
            className="px-6 py-3 bg-white text-black font-semibold rounded-xl hover:bg-neutral-200 transition-colors"
          >
            Acessar Sistema
          </Link>
        </div>
      </div>
    </main>
  )
}