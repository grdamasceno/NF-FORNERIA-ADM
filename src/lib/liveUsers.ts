import { supabase } from '@/lib/supabase'

export interface LiveAppUser {
  id: string
  email: string
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

export async function createUser(params: { email: string; role: 'admin' | 'superadmin'; organizationId?: string }): Promise<void> {
  await callManageUsers({ action: 'create', ...params })
}

export async function resendPasswordReset(userId: string): Promise<void> {
  await callManageUsers({ action: 'reset_password', userId })
}

export async function removeUser(userId: string): Promise<void> {
  await callManageUsers({ action: 'remove', userId })
}
