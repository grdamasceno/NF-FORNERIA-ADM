import type { Invoice } from '@/types'

// Funções simuladas descritas na seção 8 do MD. As assinaturas já refletem
// o que a integração real provavelmente vai exigir, para reduzir retrabalho
// quando os pontos abaixo forem plugados.

export interface NfseEmissionResult {
  nfseNumber: string
  status: 'simulada' | 'falha'
}

// Quem está do outro lado da operação — só o essencial que a Focus NFe (ou o
// disparo de WhatsApp/e-mail) vai precisar. Deliberadamente menor que
// `Invoice`: usado também antes de a fatura existir de fato (fila de
// emissão — ver src/data/pendingEmissions.ts).
export interface SimulationTarget {
  unitId: string
  unitName: string
}

// Gera 1 NFS-e simulada. Chamada 1x por invoice_item — em tenant
// `consolidado` isso é 1x por fatura; em `separado_por_servico`, até 3x
// (seção 4 do MD v2). O item específico (valor, service_code) fica a cargo
// de quem chama.
// TODO: INTEGRAÇÃO FUTURA — trocar corpo por chamada à API da Focus NFe.
export async function simulateNfseEmission(_target: SimulationTarget): Promise<NfseEmissionResult> {
  await delay(300)
  const sequential = Math.floor(100000 + Math.random() * 900000)
  return { nfseNumber: `NFS-e ${sequential}`, status: 'simulada' }
}

export interface BoletoGenerationResult {
  boletoCode: string
  pixCopiaCola: string
  dueDate: string
}

// TODO: INTEGRAÇÃO FUTURA — trocar corpo pela chamada ao gateway de boleto/PIX escolhido.
export async function simulateBoletoGeneration(invoice: Invoice, dueInDays = 10): Promise<BoletoGenerationResult> {
  await delay(300)
  const due = new Date()
  due.setDate(due.getDate() + dueInDays)
  return {
    boletoCode: fakeBoletoCode(),
    pixCopiaCola: fakePixCopiaCola(invoice.totalValue),
    dueDate: due.toISOString().slice(0, 10),
  }
}

// TODO: INTEGRAÇÃO FUTURA — disparar via n8n/Chatwoot (Baileys).
export async function simulateWhatsappSend(_target: SimulationTarget): Promise<{ sent: boolean }> {
  await delay(150)
  return { sent: true }
}

// TODO: INTEGRAÇÃO FUTURA — integrar com provedor de e-mail.
export async function simulateEmailSend(_target: SimulationTarget): Promise<{ sent: boolean }> {
  await delay(150)
  return { sent: true }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fakeBoletoCode(): string {
  const groups = Array.from({ length: 5 }, () => Math.floor(10000 + Math.random() * 90000))
  return groups.join('.')
}

function fakePixCopiaCola(value: number): string {
  const rand = Math.random().toString(36).slice(2, 10).toUpperCase()
  return `00020126580014BR.GOV.BCB.PIX0136${rand}5204000053039865406${value.toFixed(2)}5802BR6009SIMULADO`
}
