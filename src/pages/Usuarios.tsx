import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tag } from '@/components/dashboard/statusTags'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { createUser, fetchUsers, removeUser, resendPasswordReset, type LiveAppUser } from '@/lib/liveUsers'

interface OrgOption {
  id: string
  name: string
}

// Cadastro/gestão de usuário (login no app) — separado de "perfil de
// franquia". Cria no Supabase Auth + nf_forneria.profiles via Edge Function
// (precisa de service_role, nunca exposta ao navegador — ver
// supabase/functions/manage-users). "Reenviar redefinição de senha" dispara
// o mesmo e-mail de recuperação do Supabase Auth; só chega de verdade se o
// SMTP do GoTrue estiver configurado (ver TODO.md).
export function Usuarios() {
  const { profile } = useAuth()
  const isSuper = profile?.role === 'superadmin'

  const [users, setUsers] = useState<LiveAppUser[]>([])
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'superadmin'>('admin')
  const [organizationId, setOrganizationId] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createdNotice, setCreatedNotice] = useState<string | null>(null)

  function reload() {
    setLoading(true)
    Promise.all([fetchUsers(), supabase.from('organizations').select('id, name').order('name')])
      .then(([u, orgsResp]) => {
        setUsers(u)
        setOrgs((orgsResp.data as OrgOption[]) ?? [])
        if (!organizationId && orgsResp.data?.[0]) setOrganizationId(orgsResp.data[0].id)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar usuários.'))
      .finally(() => setLoading(false))
  }

  useEffect(reload, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate() {
    if (!email.trim()) return
    setCreating(true)
    setCreateError(null)
    setCreatedNotice(null)
    try {
      const { emailWarning } = await createUser({ email: email.trim(), role, organizationId: isSuper ? organizationId || undefined : undefined })
      setCreatedNotice(
        emailWarning
          ? `Usuário criado, mas o e-mail de senha não saiu: ${emailWarning}`
          : `Usuário criado — enviamos um e-mail pra "${email.trim()}" definir a senha.`,
      )
      setEmail('')
      reload()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Falha ao criar usuário.')
    } finally {
      setCreating(false)
    }
  }

  async function handleResend(u: LiveAppUser) {
    setBusyId(u.id)
    setError(null)
    try {
      await resendPasswordReset(u.id)
      setCreatedNotice(`E-mail de redefinição reenviado pra "${u.email}".`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao reenviar e-mail.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRemove(u: LiveAppUser) {
    if (!confirm(`Remover o acesso de "${u.email}"? Essa ação não pode ser desfeita.`)) return
    setBusyId(u.id)
    setError(null)
    try {
      await removeUser(u.id)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao remover usuário.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader title="Usuários" subtitle="Quem tem login nesse painel" />

      {error && <div className="mb-4 rounded-[11px] bg-red-soft p-3 text-[12.5px] font-semibold text-red">⚠ {error}</div>}
      {createdNotice && (
        <div className="mb-4 rounded-[11px] bg-green-soft p-3 text-[12.5px] font-semibold text-green">✓ {createdNotice}</div>
      )}

      <section className="animate-rise mb-[18px] rounded-card border border-line bg-card p-5 shadow-panel">
        <h3 className="mb-4 text-[14.5px] font-bold text-navy">Novo usuário</h3>
        <div className="grid grid-cols-3 gap-3 max-[700px]:grid-cols-1">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[.05em] text-faint">E-mail</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@exemplo.com"
              className="rounded-[9px] border border-line bg-white px-[11px] py-[8px] text-[12.5px] text-navy placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-orange-soft"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[.05em] text-faint">Papel</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'admin' | 'superadmin')}
              className="rounded-[9px] border border-line bg-white px-[11px] py-[8px] text-[12.5px] font-semibold text-navy focus:outline-none"
            >
              <option value="admin">Admin</option>
              {isSuper && <option value="superadmin">Superadmin</option>}
            </select>
          </label>
          {isSuper && role === 'admin' && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-[.05em] text-faint">Organização</span>
              <select
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="rounded-[9px] border border-line bg-white px-[11px] py-[8px] text-[12.5px] font-semibold text-navy focus:outline-none"
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {createError && <p className="mt-3 text-[12px] font-semibold text-red">⚠ {createError}</p>}
        <button
          onClick={handleCreate}
          disabled={creating || !email.trim()}
          className="mt-4 rounded-[11px] bg-orange px-5 py-[10px] text-[12.5px] font-bold text-white shadow-[0_6px_14px_rgba(233,78,27,.28)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? 'Criando…' : 'Criar usuário'}
        </button>
      </section>

      <section className="animate-rise overflow-hidden rounded-card border border-line bg-card shadow-panel" style={{ animationDelay: '.05s' }}>
        <div className="flex items-center justify-between px-5 pb-[13px] pt-[17px]">
          <h3 className="text-[14.5px] font-bold text-navy">{loading ? 'Carregando…' : `${users.length} usuário${users.length === 1 ? '' : 's'}`}</h3>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['E-mail', 'Papel', 'Organização', 'Ações'].map((h) => (
                <th key={h} className="border-y border-line bg-[#fafbfc] px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-none hover:bg-[#fafbfc]">
                <td className="px-5 py-[13px] text-[13px] font-semibold text-navy">{u.email}</td>
                <td className="px-5 py-[13px]">
                  <Tag tone={u.role === 'superadmin' ? 'b' : 'n'} label={u.role === 'superadmin' ? 'Superadmin' : 'Admin'} />
                </td>
                <td className="px-5 py-[13px] text-[12.5px] text-muted">{u.organizationName ?? '—'}</td>
                <td className="px-5 py-[13px]">
                  <div className="flex gap-[6px]">
                    <button
                      onClick={() => handleResend(u)}
                      disabled={busyId === u.id}
                      className="rounded-[8px] border border-line px-[10px] py-[6px] text-[11px] font-bold text-navy disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reenviar redefinição de senha
                    </button>
                    <button
                      onClick={() => handleRemove(u)}
                      disabled={busyId === u.id}
                      className="rounded-[8px] border border-line px-[10px] py-[6px] text-[11px] font-bold text-red disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Remover
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && users.length === 0 && <div className="px-5 py-10 text-center text-[13px] text-muted">Nenhum usuário.</div>}
      </section>
    </>
  )
}
