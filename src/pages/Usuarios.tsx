import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Tag } from '@/components/dashboard/statusTags'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { createUser, fetchUsers, removeUser, resendPasswordReset, updateUser, type LiveAppUser } from '@/lib/liveUsers'

interface OrgOption {
  id: string
  name: string
}

const EMPTY_FORM = { email: '', name: '', role: 'admin' as 'admin' | 'superadmin', organizationId: '' }

// Cadastro/gestão de usuário (login no app) — separado de "perfil de
// franquia". Cria/edita no Supabase Auth + nf_forneria.profiles via Edge
// Function (precisa de service_role, nunca exposta ao navegador — ver
// supabase/functions/manage-users). "Reenviar redefinição de senha" e o
// e-mail de "definir senha" no cadastro usam o SMTP próprio do app
// (Configurações → SMTP), não o do servidor Supabase.
export function Usuarios() {
  const { profile } = useAuth()
  const isSuper = profile?.role === 'superadmin'

  const [users, setUsers] = useState<LiveAppUser[]>([])
  const [orgs, setOrgs] = useState<OrgOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const [form, setForm] = useState(EMPTY_FORM)
  const [editing, setEditing] = useState<LiveAppUser | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [newOrgName, setNewOrgName] = useState('')
  const [creatingOrg, setCreatingOrg] = useState(false)

  function reload() {
    setLoading(true)
    Promise.all([fetchUsers(), supabase.from('organizations').select('id, name').order('name')])
      .then(([u, orgsResp]) => {
        setUsers(u)
        setOrgs((orgsResp.data as OrgOption[]) ?? [])
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Falha ao carregar usuários.'))
      .finally(() => setLoading(false))
  }

  useEffect(reload, []) // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function startEdit(u: LiveAppUser) {
    setEditing(u)
    setForm({ email: u.email, name: u.name ?? '', role: u.role, organizationId: u.organizationId ?? '' })
    setFormError(null)
    setNotice(null)
  }

  function cancelEdit() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  async function handleSubmit() {
    if (form.role === 'admin' && !form.organizationId) {
      setFormError('Admin precisa de uma organização.')
      return
    }
    setSaving(true)
    setFormError(null)
    setNotice(null)
    try {
      if (editing) {
        await updateUser(editing.id, {
          name: form.name,
          role: form.role,
          organizationId: form.organizationId || null,
        })
        setNotice(`Usuário "${editing.email}" atualizado.`)
        cancelEdit()
      } else {
        if (!form.email.trim()) return
        const { emailWarning } = await createUser({
          email: form.email.trim(),
          role: form.role,
          organizationId: form.organizationId || undefined,
          name: form.name.trim() || undefined,
        })
        setNotice(
          emailWarning
            ? `Usuário criado, mas o e-mail de senha não saiu: ${emailWarning}`
            : `Usuário criado — enviamos um e-mail pra "${form.email.trim()}" definir a senha.`,
        )
        setForm(EMPTY_FORM)
      }
      reload()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  async function handleResend(u: LiveAppUser) {
    setBusyId(u.id)
    setError(null)
    try {
      await resendPasswordReset(u.id)
      setNotice(`E-mail de redefinição reenviado pra "${u.email}".`)
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

  async function handleCreateOrg() {
    if (!newOrgName.trim()) return
    setCreatingOrg(true)
    setError(null)
    try {
      const { data, error } = await supabase.from('organizations').insert({ name: newOrgName.trim() }).select('id, name').single()
      if (error) throw error
      setOrgs((prev) => [...prev, data as OrgOption].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      setNewOrgName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar organização.')
    } finally {
      setCreatingOrg(false)
    }
  }

  return (
    <>
      <PageHeader title="Usuários" subtitle="Quem tem login nesse painel" />

      {error && <div className="mb-4 rounded-[11px] bg-red-soft p-3 text-[12.5px] font-semibold text-red">⚠ {error}</div>}
      {notice && <div className="mb-4 rounded-[11px] bg-green-soft p-3 text-[12.5px] font-semibold text-green">✓ {notice}</div>}

      {isSuper && (
        <section className="animate-rise mb-[18px] rounded-card border border-line bg-card p-5 shadow-panel">
          <h3 className="mb-3 text-[14.5px] font-bold text-navy">Organizações</h3>
          <div className="mb-3 flex flex-wrap gap-2">
            {orgs.map((o) => (
              <span key={o.id} className="rounded-[7px] bg-[#eef1f4] px-[10px] py-[5px] text-[11.5px] font-semibold text-navy">
                {o.name}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="Nome da nova organização"
              className="flex-1 rounded-[9px] border border-line bg-white px-[11px] py-[8px] text-[12.5px] text-navy placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-orange-soft"
            />
            <button
              onClick={handleCreateOrg}
              disabled={creatingOrg || !newOrgName.trim()}
              className="rounded-[9px] bg-navy px-4 py-[8px] text-[12px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingOrg ? 'Criando…' : '+ Nova organização'}
            </button>
          </div>
        </section>
      )}

      <section className="animate-rise mb-[18px] rounded-card border border-line bg-card p-5 shadow-panel">
        <h3 className="mb-4 text-[14.5px] font-bold text-navy">{editing ? `Editar ${editing.email}` : 'Novo usuário'}</h3>
        <div className="grid grid-cols-4 gap-3 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[.05em] text-faint">E-mail</span>
            <input
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="nome@exemplo.com"
              disabled={!!editing}
              className="rounded-[9px] border border-line bg-white px-[11px] py-[8px] text-[12.5px] text-navy placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-orange-soft disabled:bg-[#f3f4f6] disabled:text-faint"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[.05em] text-faint">Nome</span>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Nome de exibição"
              className="rounded-[9px] border border-line bg-white px-[11px] py-[8px] text-[12.5px] text-navy placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-orange-soft"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold uppercase tracking-[.05em] text-faint">Papel</span>
            <select
              value={form.role}
              onChange={(e) => set('role', e.target.value as 'admin' | 'superadmin')}
              className="rounded-[9px] border border-line bg-white px-[11px] py-[8px] text-[12.5px] font-semibold text-navy focus:outline-none"
            >
              <option value="admin">Admin</option>
              {isSuper && <option value="superadmin">Superadmin</option>}
            </select>
          </label>
          {isSuper && (
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-[.05em] text-faint">Organização</span>
              <select
                value={form.organizationId}
                onChange={(e) => set('organizationId', e.target.value)}
                className="rounded-[9px] border border-line bg-white px-[11px] py-[8px] text-[12.5px] font-semibold text-navy focus:outline-none"
              >
                <option value="">— Nenhuma —</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {formError && <p className="mt-3 text-[12px] font-semibold text-red">⚠ {formError}</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={saving || (!editing && !form.email.trim())}
            className="rounded-[11px] bg-orange px-5 py-[10px] text-[12.5px] font-bold text-white shadow-[0_6px_14px_rgba(233,78,27,.28)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar usuário'}
          </button>
          {editing && (
            <button onClick={cancelEdit} className="rounded-[11px] border border-line px-5 py-[10px] text-[12.5px] font-bold text-navy">
              Cancelar
            </button>
          )}
        </div>
      </section>

      <section className="animate-rise overflow-hidden rounded-card border border-line bg-card shadow-panel" style={{ animationDelay: '.05s' }}>
        <div className="flex items-center justify-between px-5 pb-[13px] pt-[17px]">
          <h3 className="text-[14.5px] font-bold text-navy">{loading ? 'Carregando…' : `${users.length} usuário${users.length === 1 ? '' : 's'}`}</h3>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Nome', 'E-mail', 'Papel', 'Organização', 'Ações'].map((h) => (
                <th key={h} className="border-y border-line bg-[#fafbfc] px-5 py-[11px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-line last:border-none hover:bg-[#fafbfc]">
                <td className="px-5 py-[13px] text-[13px] font-semibold text-navy">{u.name ?? '—'}</td>
                <td className="px-5 py-[13px] text-[12.5px] text-muted">{u.email}</td>
                <td className="px-5 py-[13px]">
                  <Tag tone={u.role === 'superadmin' ? 'b' : 'n'} label={u.role === 'superadmin' ? 'Superadmin' : 'Admin'} />
                </td>
                <td className="px-5 py-[13px] text-[12.5px] text-muted">{u.organizationName ?? '—'}</td>
                <td className="px-5 py-[13px]">
                  <div className="flex gap-[6px]">
                    <button
                      onClick={() => startEdit(u)}
                      className="rounded-[8px] border border-line px-[10px] py-[6px] text-[11px] font-bold text-navy"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleResend(u)}
                      disabled={busyId === u.id}
                      className="rounded-[8px] border border-line px-[10px] py-[6px] text-[11px] font-bold text-navy disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reenviar senha
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
