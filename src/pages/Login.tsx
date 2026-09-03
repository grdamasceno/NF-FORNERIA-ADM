import { useState, type FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { BrandMarkIcon } from '@/components/icons'
import logoOnChannel from '@/assets/logo-onchannel.jpeg'

export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(email, password)
    if (error) setError(error)
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[380px] rounded-card border border-line bg-card p-8 shadow-panel">
        <div className="mb-6 flex flex-col items-center gap-[11px] text-center">
          <div className="h-[38px] w-[38px] flex-shrink-0 overflow-hidden rounded-[11px] bg-white shadow-[0_6px_14px_rgba(233,78,27,.22)]">
            <img src={logoOnChannel} alt="OnChannel" className="h-full w-full object-cover" />
          </div>
          <div>
            <b className="font-display text-[16px] font-extrabold leading-[1.05] tracking-[.01em] text-navy">OnChannel</b>
            <small className="mt-0.5 block text-[10.5px] font-semibold tracking-[.14em] text-faint">ALL IN ONE</small>
          </div>
        </div>

        <h1 className="mb-5 text-[18px] font-bold text-navy">Entrar</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-[9px] border border-line bg-white px-[11px] py-[9px] text-[13px] text-navy focus:outline-none focus:ring-2 focus:ring-orange-soft"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">Senha</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-[9px] border border-line bg-white px-[11px] py-[9px] text-[13px] text-navy focus:outline-none focus:ring-2 focus:ring-orange-soft"
            />
          </label>

          {error && <p className="text-[12px] font-semibold text-red">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-[11px] bg-orange px-4 py-[10px] text-[13px] font-bold text-white shadow-[0_6px_14px_rgba(233,78,27,.28)] disabled:opacity-50"
          >
            <BrandMarkIcon className="h-4 w-4" />
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
