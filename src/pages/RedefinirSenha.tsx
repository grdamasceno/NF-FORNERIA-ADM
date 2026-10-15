import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { BrandMarkIcon } from '@/components/icons'
import logoOnChannel from '@/assets/logo-onchannel.jpeg'

// Página de destino do link de "redefinir senha" (e-mail do Supabase Auth,
// disparado em Login.tsx ou em Usuários ao criar usuário novo). Fica fora
// do AuthProvider/Gate de propósito — o supabase-js já detecta e aplica a
// sessão de recuperação sozinho a partir do token na URL (#access_token=…),
// antes mesmo de qualquer componente montar; só precisamos checar se ela
// existe e deixar a pessoa definir a senha nova.
export function RedefinirSenha() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session)
      setChecking(false)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('A senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }
    setSaving(true)
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (error) {
      setError(error.message)
      return
    }
    setDone(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-[380px] rounded-card border border-line bg-card p-8 shadow-panel">
        <div className="mb-6 flex flex-col items-center gap-[11px] text-center">
          <div className="h-[38px] w-[38px] flex-shrink-0 overflow-hidden rounded-full border border-faint bg-white">
            <img src={logoOnChannel} alt="OnChannel" className="h-full w-full object-cover" />
          </div>
          <div>
            <b className="font-display text-[16px] font-extrabold leading-[1.05] tracking-[.01em] text-navy">OnChannel</b>
            <small className="mt-0.5 block text-[10.5px] font-semibold tracking-[.14em] text-faint">ALL IN ONE</small>
          </div>
        </div>

        <h1 className="mb-5 text-[18px] font-bold text-navy">Definir nova senha</h1>

        {checking ? (
          <p className="text-[13px] text-muted">Verificando o link…</p>
        ) : done ? (
          <>
            <p className="mb-4 text-[13px] text-muted">Senha atualizada. Pode entrar normalmente.</p>
            <button
              onClick={() => navigate('/')}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[11px] bg-orange px-4 py-[10px] text-[13px] font-bold text-white shadow-[0_6px_14px_rgba(233,78,27,.28)]"
            >
              <BrandMarkIcon className="h-4 w-4" />
              Ir pro painel
            </button>
          </>
        ) : !hasSession ? (
          <p className="text-[13px] text-muted">
            Esse link é inválido ou já expirou. Volta pra tela de login e pede "Perdeu acesso? Redefinir senha" de novo.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">Nova senha</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-[9px] border border-line bg-white px-[11px] py-[9px] text-[13px] text-navy focus:outline-none focus:ring-2 focus:ring-orange-soft"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">Confirmar senha</span>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="rounded-[9px] border border-line bg-white px-[11px] py-[9px] text-[13px] text-navy focus:outline-none focus:ring-2 focus:ring-orange-soft"
              />
            </label>
            {error && <p className="text-[12px] font-semibold text-red">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="mt-2 rounded-[11px] bg-orange px-4 py-[10px] text-[13px] font-bold text-white shadow-[0_6px_14px_rgba(233,78,27,.28)] disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
