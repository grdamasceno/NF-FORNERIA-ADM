import { supabase } from '@/lib/supabase'

export interface SmtpSettings {
  host: string
  port: number
  username: string
  fromEmail: string
  fromName: string | null
  useTls: boolean
  enabled: boolean
  hasPassword: boolean
  updatedAt: string
}

export interface SaveSmtpParams {
  host: string
  port: number
  username: string
  password?: string
  fromEmail: string
  fromName?: string
  useTls: boolean
  enabled: boolean
}

async function callSmtpSettings(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data: sessionData } = await supabase.auth.getSession()
  const accessToken = sessionData.session?.access_token
  if (!accessToken) throw new Error('Sessão expirada — faça login de novo.')

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smtp-settings`, {
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

export async function fetchSmtpSettings(): Promise<SmtpSettings | null> {
  const body = await callSmtpSettings({ action: 'get' })
  return (body.settings as SmtpSettings) ?? null
}

export async function saveSmtpSettings(params: SaveSmtpParams): Promise<void> {
  await callSmtpSettings({ action: 'save', ...params })
}
