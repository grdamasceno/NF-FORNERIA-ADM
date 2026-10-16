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
  // true enquanto o perfil (nf_forneria.profiles) ainda está sendo buscado
  // depois que a sessão já existe — precisa ser um estado à parte de
  // `loading`, senão uma sessão válida SEM perfil (ex: conta de outro app
  // que compartilha esse mesmo Supabase Auth, mas nunca foi cadastrada
  // aqui) fica indistinguível de "ainda carregando" e vaza pro app com
  // profile null (achado real, 2026-10-16: usuário de outro sistema
  // conseguiu logar e via um painel com dado incorreto/vazio).
  profileLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

// Sessão real do Supabase Auth (migration 0007) — sem isto, RLS bloqueia
// tudo (`units`, `service_eligibility`, `tenants`, `emitters`,
// `emitter_mapping` exigem `authenticated` + organização batendo). Perfil
// (`profiles`) é quem diz se o usuário é `admin` (só a própria organização)
// ou `superadmin` (todas).
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  // `onAuthStateChange` é a ÚNICA fonte da sessão (não soma com um
  // `getSession()` separado) — ele já dispara sozinho com o evento
  // `INITIAL_SESSION` assim que alguém se inscreve, então cobre tanto a
  // carga inicial da página quanto login/logout depois.
  //
  // ACHADO REAL (2026-09-02): reload/URL direta travava em "Carregando..."
  // — causa raiz era um bug conhecido do supabase-js v2 (bug tracker deles,
  // issue #2013/#2111): fazer `await` de chamada assíncrona DIRETO dentro
  // do callback do `onAuthStateChange` trava um lock interno da lib
  // (Web Locks API), e qualquer chamada supabase seguinte fica pendurada
  // até o lock "vazar" sozinho (por isso o app às vezes destravava sozinho
  // depois de alguns segundos). O callback abaixo agora só faz atualização
  // de estado síncrona — o carregamento do perfil roda à parte, no efeito
  // logo depois, que só reage a `session` mudar.
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoading(false)
    })
    return () => subscription.subscription.unsubscribe()
  }, [])

  // Depende só do id do usuário, NÃO do objeto `session`: ao voltar pra aba o
  // supabase-js renova o token e emite um objeto de sessão novo (mesmo
  // usuário) — reagir a isso religava `profileLoading`, o Gate voltava pra
  // "Carregando..." e desmontava a tela toda (perdia modal de edição aberto).
  const userId = session?.user.id ?? null
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    let cancelled = false
    setProfileLoading(true)
    async function loadProfile() {
      try {
        const { data, error } = await supabase.from('profiles').select('role, organization_id').eq('id', userId).single()
        if (cancelled) return
        if (error || !data) {
          setProfile(null)
          return
        }
        setProfile({ role: data.role as UserRole, organizationId: data.organization_id })
      } catch (err) {
        if (cancelled) return
        console.error('Falha ao carregar perfil do usuário:', err)
        setProfile(null)
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    }
    loadProfile()
    return () => {
      cancelled = true
    }
  }, [userId])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, profileLoading, signIn, signOut }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return ctx
}
