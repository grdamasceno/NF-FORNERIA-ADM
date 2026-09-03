import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SimBadge } from '@/components/SimBadge'
import { useSettings, emitterKey, type EligibleServiceType, type SendChannel } from '@/context/SettingsContext'
import { franchiseBrands } from '@/data/units'

const SERVICE_LABEL: Record<EligibleServiceType, string> = {
  call_center: 'Call Center',
  marketing: 'Marketing',
  royalties: 'Royalties',
}

// As quatro primeiras seções são funcionais de verdade (afetam a tela
// Faturamento, via SettingsContext). "Emissão de NFS-e por serviço", "CNPJs
// emissores" e "Emissão por marca e serviço" persistem no Supabase
// (nf_forneria.service_eligibility/emitters/emitter_mapping, RLS por
// organização). Só "Canal de envio" continua em memória — reseta ao
// recarregar. As demais seções são só exibição, ver
// TODO.md → "Inventário de dados fixos/fictícios".
export function Configuracoes() {
  const {
    serviceEligibility,
    toggleServiceEligibility,
    sendChannel,
    setSendChannel,
    emitters,
    addEmitter,
    removeEmitter,
    updateEmitterFiscalData,
    emitterMapping,
    setEmitterMapping,
    setEmitterItemListaServico,
    setEmitterCodigoTributarioMunicipio,
    setEmitterIssRetido,
  } = useSettings()

  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')

  function handleAddEmitter() {
    if (!razaoSocial.trim() || !cnpj.trim()) return
    addEmitter(razaoSocial, cnpj)
    setRazaoSocial('')
    setCnpj('')
  }

  return (
    <>
      <PageHeader title="Configurações" subtitle="Parâmetros gerais da plataforma" />

      <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
        <section className="animate-rise rounded-card border border-line bg-card p-5 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14.5px] font-bold text-navy">Emissão de NFS-e por serviço</h3>
            <SimBadge label="AFETA O EMITIR" />
          </div>
          <p className="mb-4 text-[11.5px] text-faint">
            Só os serviços habilitados aqui recebem NFS-e ao clicar em "Emitir" na tela Faturamento — os desabilitados continuam
            cobrados no boleto, só não geram nota.
          </p>
          <div className="flex flex-col gap-3">
            {(Object.keys(SERVICE_LABEL) as EligibleServiceType[]).map((service) => (
              <ToggleRow
                key={service}
                label={SERVICE_LABEL[service]}
                checked={serviceEligibility[service]}
                onClick={() => toggleServiceEligibility(service)}
              />
            ))}
          </div>
        </section>

        <section className="animate-rise rounded-card border border-line bg-card p-5 shadow-card" style={{ animationDelay: '.05s' }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14.5px] font-bold text-navy">Canal de envio</h3>
            <SimBadge label="AFETA O ENVIAR" />
          </div>
          <p className="mb-4 text-[11.5px] text-faint">Por qual canal o botão "Enviar" da tela Faturamento dispara a cobrança.</p>
          <div className="inline-flex overflow-hidden rounded-[9px] border border-line">
            <ChannelButton label="WhatsApp" value="whatsapp" current={sendChannel} onClick={setSendChannel} />
            <ChannelButton label="E-mail" value="email" current={sendChannel} onClick={setSendChannel} />
          </div>
        </section>

        <section className="animate-rise col-span-2 rounded-card border border-line bg-card p-5 shadow-card max-[900px]:col-span-1" style={{ animationDelay: '.08s' }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14.5px] font-bold text-navy">CNPJs emissores</h3>
            <SimBadge label="AFETA O EMITIR" />
          </div>
          <p className="mb-4 text-[11.5px] text-faint">
            Cadastre os CNPJs que podem emitir NFS-e. Depois relacione cada um a um serviço por marca na tabela abaixo.
            Inscrição municipal, código do município e regime tributário são exigidos pela Focus NFe pra emitir de
            verdade — preencha assim que tiver essa informação.
          </p>

          <div className="flex flex-col gap-3">
            {emitters.map((e) => (
              <div key={e.id} className="rounded-[9px] border border-line px-3 py-3">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[13px] font-semibold text-navy">{e.razaoSocial}</div>
                    <div className="font-display text-[11.5px] font-bold text-faint">{e.cnpj}</div>
                  </div>
                  <button
                    onClick={() => removeEmitter(e.id)}
                    className="flex-shrink-0 rounded-[7px] border border-line px-[10px] py-[5px] text-[11px] font-bold text-red"
                  >
                    Remover
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-[600px]:grid-cols-1">
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-[.06em] text-faint">Inscrição municipal</span>
                    <input
                      value={e.inscricaoMunicipal ?? ''}
                      onChange={(ev) => updateEmitterFiscalData(e.id, { inscricaoMunicipal: ev.target.value || null })}
                      placeholder="Ex: 1.184.947-4"
                      className="rounded-[8px] border border-line bg-white px-[9px] py-[6px] text-[12px] text-navy placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-orange-soft"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-[.06em] text-faint">Código do município (IBGE)</span>
                    <input
                      value={e.codigoMunicipio ?? ''}
                      onChange={(ev) => updateEmitterFiscalData(e.id, { codigoMunicipio: ev.target.value || null })}
                      placeholder="Ex: 3304557"
                      className="rounded-[8px] border border-line bg-white px-[9px] py-[6px] text-[12px] text-navy placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-orange-soft"
                    />
                  </label>
                </div>
                <label className="mt-2 flex items-center gap-[6px] text-[11px] font-semibold text-faint">
                  <input
                    type="checkbox"
                    checked={e.optanteSimplesNacional}
                    onChange={(ev) => updateEmitterFiscalData(e.id, { optanteSimplesNacional: ev.target.checked })}
                    className="h-[13px] w-[13px] accent-orange"
                  />
                  Optante do Simples Nacional
                </label>
              </div>
            ))}
            {emitters.length === 0 && <p className="text-[12px] text-faint">Nenhum CNPJ cadastrado ainda.</p>}
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-line pt-4">
            <div className="flex-1" style={{ minWidth: 220 }}>
              <label className="text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">Razão social</label>
              <input
                value={razaoSocial}
                onChange={(e) => setRazaoSocial(e.target.value)}
                placeholder="Ex: Forneria Original Franquias LTDA"
                className="mt-1 w-full rounded-[9px] border border-line bg-white px-[11px] py-[8px] text-[12.5px] text-navy placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-orange-soft"
              />
            </div>
            <div style={{ minWidth: 180 }}>
              <label className="text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">CNPJ</label>
              <input
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
                className="mt-1 w-full rounded-[9px] border border-line bg-white px-[11px] py-[8px] text-[12.5px] text-navy placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-orange-soft"
              />
            </div>
            <button
              onClick={handleAddEmitter}
              disabled={!razaoSocial.trim() || !cnpj.trim()}
              className="rounded-[9px] bg-orange px-[16px] py-[9px] text-[12.5px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Adicionar
            </button>
          </div>
        </section>

        <section className="animate-rise col-span-2 rounded-card border border-line bg-card p-5 shadow-card max-[900px]:col-span-1" style={{ animationDelay: '.11s' }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14.5px] font-bold text-navy">Emissão por marca e serviço</h3>
            <SimBadge label="AFETA O EMITIR" />
          </div>
          <p className="mb-4 text-[11.5px] text-faint">
            Qual CNPJ emite a nota de cada serviço, por marca. Um serviço pode usar CNPJs diferentes por marca (ex: Royalties) ou o
            mesmo CNPJ pras duas (ex: Call Center, quando é uma operação compartilhada). O item da lista nacional, o código
            tributário municipal e a retenção de ISS dependem do contador/prefeitura — preencha conforme a orientação recebida.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr>
                  <th className="border-y border-line bg-[#fafbfc] px-4 py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">
                    Serviço
                  </th>
                  {franchiseBrands.map((marca) => (
                    <th
                      key={marca}
                      className="border-y border-line bg-[#fafbfc] px-4 py-[10px] text-left text-[10.5px] font-bold uppercase tracking-[.06em] text-faint"
                    >
                      {marca}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(SERVICE_LABEL) as EligibleServiceType[]).map((service) => (
                  <tr key={service} className="border-b border-line last:border-none">
                    <td className="px-4 py-[10px] text-[13px] font-semibold text-navy">{SERVICE_LABEL[service]}</td>
                    {franchiseBrands.map((marca) => {
                      const entry = emitterMapping[emitterKey(marca, service)]
                      return (
                        <td key={marca} className="px-4 py-[10px] align-top">
                          <div className="flex min-w-[200px] flex-col gap-2">
                            <EmitterSelect
                              value={entry?.emitterId ?? null}
                              onChange={(id) => setEmitterMapping(marca, service, id)}
                            />
                            <input
                              value={entry?.itemListaServico ?? ''}
                              onChange={(e) => setEmitterItemListaServico(marca, service, e.target.value)}
                              placeholder="Item lista nacional (ex: 170801)"
                              className="w-full rounded-[8px] border border-line bg-white px-[9px] py-[6px] text-[11.5px] text-navy placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-orange-soft"
                            />
                            <input
                              value={entry?.codigoTributarioMunicipio ?? ''}
                              onChange={(e) => setEmitterCodigoTributarioMunicipio(marca, service, e.target.value)}
                              placeholder="Código tributário municipal"
                              className="w-full rounded-[8px] border border-line bg-white px-[9px] py-[6px] text-[11.5px] text-navy placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-orange-soft"
                            />
                            <label className="flex items-center gap-[6px] text-[11px] font-semibold text-faint">
                              <input
                                type="checkbox"
                                checked={entry?.issRetido ?? false}
                                onChange={(e) => setEmitterIssRetido(marca, service, e.target.checked)}
                                className="h-[13px] w-[13px] accent-orange"
                              />
                              ISS retido na fonte
                            </label>
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="animate-rise rounded-card border border-line bg-card p-5 shadow-card" style={{ animationDelay: '.15s' }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14.5px] font-bold text-navy">Cobrança</h3>
            <SimBadge label="SÓ EXIBIÇÃO" />
          </div>
          <div className="flex flex-col gap-4">
            <SettingField label="Dias para vencimento do boleto" value="10 dias corridos após a emissão" />
            <SettingField label="Método de cobrança padrão" value="Boleto (upload manual) + PIX" />
            <SettingField label="Prestador de NFS-e" value="Focus NFe (integração pendente)" />
          </div>
        </section>

        <section className="animate-rise rounded-card border border-line bg-card p-5 shadow-card" style={{ animationDelay: '.18s' }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14.5px] font-bold text-navy">Rede ativa</h3>
            <SimBadge label="SÓ EXIBIÇÃO" />
          </div>
          <div className="flex flex-col gap-4">
            <SettingField label="Marca / tenant" value="Forneria Original" />
            <SettingField label="Logo do cliente" value="Definido via variável --client-logo (whitelabel)" />
            <SettingField label="Cor primária" value="#E94E1B" swatch="#E94E1B" />
          </div>
        </section>

        <section className="animate-rise rounded-card border border-line bg-card p-5 shadow-card" style={{ animationDelay: '.22s' }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14.5px] font-bold text-navy">Acesso</h3>
            <SimBadge label="SÓ EXIBIÇÃO" />
          </div>
          <div className="flex flex-col gap-4">
            <SettingField label="Perfil atual" value="Diretor / Admin (perfil único no MVP)" />
            <SettingField label="Autenticação" value="Supabase Auth (aguardando credenciais)" />
          </div>
        </section>
      </div>
    </>
  )
}

function SettingField({ label, value, swatch }: { label: string; value: string; swatch?: string }) {
  return (
    <div>
      <div className="text-[10.5px] font-bold uppercase tracking-[.06em] text-faint">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-[13px] font-semibold text-navy">
        {swatch && <span className="h-3 w-3 rounded-full" style={{ background: swatch }} />}
        {value}
      </div>
    </div>
  )
}

function ToggleRow({ label, checked, onClick }: { label: string; checked: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick} className="flex items-center justify-between text-left disabled:cursor-default">
      <span className="text-[13px] font-medium text-navy">{label}</span>
      <span
        className={`inline-flex h-6 w-11 items-center rounded-full px-[3px] transition-colors ${checked ? 'bg-orange justify-end' : 'bg-[#eef1f4] justify-start'}`}
      >
        <span className="h-[18px] w-[18px] rounded-full bg-white shadow" />
      </span>
    </button>
  )
}

function ChannelButton({
  label,
  value,
  current,
  onClick,
}: {
  label: string
  value: SendChannel
  current: SendChannel
  onClick: (value: SendChannel) => void
}) {
  const active = current === value
  return (
    <button
      onClick={() => onClick(value)}
      className={`px-[14px] py-[9px] text-[12.5px] font-bold ${active ? 'bg-orange text-white' : 'bg-white text-navy'}`}
    >
      {label}
    </button>
  )
}

function EmitterSelect({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const { emitters } = useSettings()
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className="w-full rounded-[8px] border border-line bg-white px-[9px] py-[6px] text-[12px] font-semibold text-navy focus:outline-none"
    >
      <option value="">— nenhum —</option>
      {emitters.map((e) => (
        <option key={e.id} value={e.id}>
          {e.razaoSocial}
        </option>
      ))}
    </select>
  )
}
