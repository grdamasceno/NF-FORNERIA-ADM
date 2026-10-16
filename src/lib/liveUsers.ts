import { supabase } from '@/lib/supabase'

export interface LiveAppUser {
  id: string
  email: string
  name: string | null
  role: 'admin' | 'superadmin'
  organizationId: string | null
  organizationName: string | null
  createdAt: string
}

async function callManageUsers(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Sessão expirada — faça login de novo.')

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const body = await resp.json().catch(() => null)
  if (!resp.ok) {
    throw new Error((body?.message as string) ?? (body?.error as string) ?? `Falha (HTTP ${resp.status}).`)
  }
  return body ?? {}
}

export async function fetchUsers(): Promise<LiveAppUser[]> {
  const body = await callManageUsers({ action: 'list' })
  return (body.users as LiveAppUser[]) ?? []
}

export async function createUser(params: {
  email: string
  role: 'admin' | 'superadmin'
  organizationId?: string
  name?: string
}): Promise<{ emailWarning: string | null }> {
  const body = await callManageUsers({ action: 'create', ...params, redirectTo: `${window.location.origin}/redefinir-senha` })
  return { emailWarning: (body.emailWarning as string | null) ?? null }
}

export async function updateUser(
  userId: string,
  params: { role?: 'admin' | 'superadmin'; organizationId?: string | null; name?: string },
): Promise<void> {
  await callManageUsers({ action: 'update', userId, ...params })
}

export async function resendPasswordReset(userId: string): Promise<void> {
  await callManageUsers({ action: 'reset_password', userId, redirectTo: `${window.location.origin}/redefinir-senha` })
}

export async function setUserPassword(userId: string, password: string): Promise<void> {
  await callManageUsers({ action: 'set_password', userId, password })
}

export async function removeUser(userId: string): Promise<void> {
  await callManageUsers({ action: 'remove', userId })
}
