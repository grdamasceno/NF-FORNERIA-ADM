import type { Brand } from '@/types'

// Cliente da Edge Function `public-fill-values` — usado pela página pública
// /preencher-publico/:token (sem login, sem sessão Supabase). Só manda o
// `apikey` (anon, já é público no bundle) pra passar pelo gateway; a
// autorização de verdade é o token do link, validado na própria function.

export interface PublicFillUnit {
  id: string
  name: string
  marca: Brand
  callCenter: number
  royalties: number
  marketing: number
}

export interface PublicFillData {
  organizationName: string
  competencia: string
  units: PublicFillUnit[]
}

async function callPublicFillFunction(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-fill-values`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    body: JSON.stringify(payload),
  })
  const body = await resp.json().catch(() => null)
  if (!resp.ok) {
    throw new Error((body?.message as string) ?? (body?.error as string) ?? `Falha ao carregar (HTTP ${resp.status}).`)
  }
  return body ?? {}
}

export async function fetchPublicFillData(token: string): Promise<PublicFillData> {
  return (await callPublicFillFunction({ token })) as unknown as PublicFillData
}

export async function savePublicFillValues(
  token: string,
  values: Array<{ unitId: string; callCenter: number; royalties: number; marketing: number }>,
): Promise<void> {
  await callPublicFillFunction({ token, action: 'save', values })
}
