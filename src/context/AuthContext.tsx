import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type UserRole = 'admin' | 'superadmin'

export interface Profile {
  role: UserRole
  organizationId: string | null
}

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

// Sessão real do Supabase Auth (migration 0007) — sem isto, RLS bloqueia
// tudo (`units`, `service_eligibility`, `tenants`, `emitters`,
// `emitter_mapping` exigem `authenticated` + organização batendo). Perfil
// (`profiles`) é quem diz se o usuário é `admin` (só a própria organização)
// ou `superadmin` (todas).
const AuthContext = createContext<AuthContextValue | null>(null)

// TEMPORÁRIO (2026-09-02): investigando reload/URL direta travando em
// "Carregando..." — timeout forçado em cada etapa (nunca deixa o app preso
// de verdade, mesmo se algo abaixo travar de verdade) + log com tempo
// decorrido pra achar exatamente qual chamada está lenta. Remover depois que
// a causa raiz for confirmada e corrigida (ver TODO.md).
function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout de ${ms}ms em: ${label}`)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      },
    )
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const t0 = performance.now()
    const log = (msg: string) => console.log(`[Auth ${(performance.now() - t0).toFixed(0)}ms]`, msg)

    // Se essa busca falhar (rede instável, backend fora do ar por um
    // instante, etc.), NUNCA deve deixar o app travado em "Carregando..."
    // pra sempre — por isso o try/catch aqui dentro cobre os dois pontos
    // que chamam esta função, com timeout de 8s.
    async function loadProfile(userId: string) {
      log('loadProfile: início')
      try {
        const { data, error } = await withTimeout<{
          data: { role: string; organization_id: string | null } | null
          error: { message: string } | null
        }>(supabase.from('profiles').select('role, organization_id').eq('id', userId).single(), 8000, 'select profiles')
        log('loadProfile: resolvido')
        if (cancelled) return
        if (error || !data) {
          setProfile(null)
          return
        }
        setProfile({ role: data.role as UserRole, organizationId: data.organization_id })
      } catch (err) {
        log('loadProfile: erro/timeout — ' + String(err))
        if (cancelled) return
        console.error('Falha ao carregar perfil do usuário:', err)
        setProfile(null)
      }
    }

    log('effect: chamando getSession()')
    withTimeout(supabase.auth.getSession(), 8000, 'getSession()')
      .then(async ({ data }) => {
        log('getSession: resolvido, tem sessão = ' + !!data.session)
        if (cancelled) return
        setSession(data.session)
        if (data.session) await loadProfile(data.session.user.id)
      })
      .catch((err) => {
        log('getSession: erro/timeout — ' + String(err))
        console.error('Falha ao obter sessão:', err)
      })
      .finally(() => {
        log('finally: setLoading(false)')
        if (!cancelled) setLoading(false)
      })

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      log('onAuthStateChange: evento = ' + _event)
      if (cancelled) return
      setSession(newSession)
      if (newSession) {
        await loadProfile(newSession.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      cancelled = true
      subscription.subscription.unsubscribe()
    }
  }, [])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return <AuthContext.Provider value={{ session, profile, loading, signIn, signOut }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
