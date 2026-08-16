import { PageHeader } from '@/components/layout/PageHeader'
import { SimBadge } from '@/components/SimBadge'

// Formulário estático — nenhum campo é persistido ainda. Valores exibidos são
// fictícios (ver TODO.md → "Inventário de dados fixos/fictícios").
export function Configuracoes() {
  return (
    <>
      <PageHeader title="Configurações" subtitle="Parâmetros gerais da plataforma">
        <SimBadge label="FORMULÁRIO NÃO FUNCIONAL" />
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 max-[900px]:grid-cols-1">
        <section className="animate-rise rounded-card bg-card p-5 shadow-card">
          <h3 className="mb-4 text-[14.5px] font-bold text-navy">Cobrança</h3>
          <div className="flex flex-col gap-4">
            <SettingField label="Dias para vencimento do boleto/PIX" value="10 dias corridos após a emissão" />
            <SettingField label="Método de cobrança padrão" value="Boleto + PIX" />
            <SettingField label="Prestador de NFS-e" value="Focus NFe (integração pendente)" />
          </div>
        </section>

        <section className="animate-rise rounded-card bg-card p-5 shadow-card" style={{ animationDelay: '.05s' }}>
          <h3 className="mb-4 text-[14.5px] font-bold text-navy">Rede ativa</h3>
          <div className="flex flex-col gap-4">
            <SettingField label="Marca / tenant" value="Forneria Original" />
            <SettingField label="Logo do cliente" value="Definido via variável --client-logo (whitelabel)" />
            <SettingField label="Cor primária" value="#E94E1B" swatch="#E94E1B" />
          </div>
        </section>

        <section className="animate-rise rounded-card bg-card p-5 shadow-card" style={{ animationDelay: '.1s' }}>
          <h3 className="mb-4 text-[14.5px] font-bold text-navy">Notificações</h3>
          <div className="flex flex-col gap-3">
            <ToggleRow label="Envio automático por WhatsApp" checked />
            <ToggleRow label="Envio automático por e-mail" checked />
            <ToggleRow label="Alerta de inadimplência ao diretor" checked={false} />
          </div>
        </section>

        <section className="animate-rise rounded-card bg-card p-5 shadow-card" style={{ animationDelay: '.15s' }}>
          <h3 className="mb-4 text-[14.5px] font-bold text-navy">Acesso</h3>
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

function ToggleRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] font-medium text-navy">{label}</span>
      <span
        className={`inline-flex h-6 w-11 items-center rounded-full px-[3px] transition-colors ${checked ? 'bg-orange justify-end' : 'bg-[#eef1f4] justify-start'}`}
      >
        <span className="h-[18px] w-[18px] rounded-full bg-white shadow" />
      </span>
    </div>
  )
}
