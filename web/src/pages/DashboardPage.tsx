import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { MigrationApi } from '../services/api';
import type { DashboardMetrics } from '../types';
import {
  Users,
  CheckCircle,
  Clock,
  ArrowRight,
  AlertTriangle,
  Building,
  DollarSign,
  RefreshCw,
} from 'lucide-react';

export default function DashboardPage({
  maId,
  onNavigate,
}: {
  maId?: string;
  onNavigate: (tab: any) => void;
}) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const data = await MigrationApi.getDashboardMetrics(maId);
      setMetrics(data);
    } catch (e) {
      console.error('Falha ao buscar métricas', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [maId]);

  if (!metrics) {
    return (
      <div className="p-8 text-center text-[#8A8899]">
        Carregando painel executivo netWave...
      </div>
    );
  }

  const funnelSteps = [
    { label: 'Importado', count: metrics.funnel.imported, color: 'bg-slate-400' },
    { label: 'Higienizado', count: metrics.funnel.sanitized, color: 'bg-blue-500' },
    { label: 'Viável', count: metrics.funnel.viable, color: 'bg-emerald-500' },
    { label: 'OS Criada', count: metrics.funnel.osCreated, color: 'bg-amber-400' },
    { label: 'Programado', count: metrics.funnel.scheduled, color: 'bg-purple-500' },
    { label: 'Em Campo', count: metrics.funnel.inField, color: 'bg-indigo-500' },
    { label: 'Migrado OK', count: metrics.funnel.migrated, color: 'bg-emerald-600' },
  ];

  const pendingScheduling = Math.max(0, metrics.funnel.osCreated - metrics.funnel.scheduled);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#2E2D39]">Cockpit Executivo de Migração</h1>
          <p className="text-xs text-[#8A8899]">
            Acompanhamento em tempo real da transposição física de clientes M&A para a rede neutra V.tal
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchMetrics} loading={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </Button>
          <Button variant="primary" size="sm" onClick={() => onNavigate('scheduling')}>
            Programar CDO
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="vt-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8A8899]">Clientes Adquiridos</span>
            <Users size={16} className="text-[#514F66]" />
          </div>
          <div className="text-2xl font-bold text-[#2E2D39] mt-2">
            {metrics.totalAcquired.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-[#10B981] mt-1 flex items-center gap-1 font-medium">
            <span>100% integrados ao CRM Nio</span>
          </div>
        </div>

        <div className="vt-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8A8899]">Migrados para V.tal</span>
            <CheckCircle size={16} className="text-[#10B981]" />
          </div>
          <div className="text-2xl font-bold text-[#10B981] mt-2">
            {metrics.totalMigrated.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-[#514F66] mt-1 font-medium">
            Progresso Global: <b>{metrics.migrationPercentage}%</b>
          </div>
        </div>

        <div className="vt-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8A8899]">Na Rede Origem</span>
            <Clock size={16} className="text-[#F59E0B]" />
          </div>
          <div className="text-2xl font-bold text-[#F59E0B] mt-2">
            {metrics.totalInOriginNetwork.toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-[#8A8899] mt-1">
            Aluguel ativo de infraestrutura
          </div>
        </div>

        <div className="vt-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8A8899]">Exceções & Rollbacks</span>
            <AlertTriangle size={16} className="text-[#DC2626]" />
          </div>
          <div className="text-2xl font-bold text-[#DC2626] mt-2">
            {(metrics.totalExceptions + metrics.totalRollbacks).toLocaleString('pt-BR')}
          </div>
          <div className="text-[11px] text-[#8A8899] mt-1">
            {metrics.totalExceptions} exceções · {metrics.totalRollbacks} rollbacks
          </div>
        </div>
      </div>

      {/* Origin Infrastructure Savings Banner */}
      <div className="bg-gradient-to-r from-[#2E2D39] to-[#514F66] rounded-lg p-5 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-[#FFD919] text-[#181919] flex items-center justify-center font-bold">
            <Building size={24} />
          </div>
          <div>
            <div className="text-sm uppercase tracking-wider text-[#FFD919] font-bold">
              Desmobilização de Infraestrutura Alugada
            </div>
            <div className="text-xl font-bold mt-0.5">
              {metrics.releasableOriginBoxes} Caixas de Origem (CDO/CDOI) Prontas para Devolução
            </div>
            <div className="text-xs text-white/80 mt-1">
              Clientes 100% transpostos. A liberação cancela o contrato de aluguel dos ativos com o provedor de origem.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-[11px] text-white/70">Economia Mensal Estimada</div>
            <div className="text-xl font-bold text-[#FFD919] flex items-center justify-end">
              <DollarSign size={18} />
              R$ {metrics.monthlySavingsProjected.toLocaleString('pt-BR')},00 / mês
            </div>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={() => onNavigate('decommission')}
          >
            Ver Caixas Liberáveis
          </Button>
        </div>
      </div>

      {/* Funnel Section */}
      <Card title="Funil da Jornada de Migração Física" subtitle="Conversão etapa por etapa desde a importação do lote até a confirmação do cutover">
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {funnelSteps.map((step, idx) => (
              <div
                key={step.label}
                className="bg-[#FAFAFB] border border-[#E8E8EE] rounded-lg p-3 text-center relative group hover:border-[#FFD919] transition-all"
              >
                <div className="text-[11px] font-semibold text-[#8A8899] mb-1">
                  {step.label}
                </div>
                <div className="text-lg font-bold text-[#2E2D39]">
                  {step.count.toLocaleString('pt-BR')}
                </div>
                <div className="w-full bg-[#E8E8EE] h-1.5 rounded-full mt-2.5 overflow-hidden">
                  <div
                    className={`h-full ${step.color}`}
                    style={{
                      width: `${metrics.funnel.imported > 0 ? (step.count / metrics.funnel.imported) * 100 : 0}%`,
                    }}
                  />
                </div>
                {idx < funnelSteps.length - 1 && (
                  <ArrowRight
                    size={12}
                    className="hidden lg:block absolute -right-2.5 top-1/2 -translate-y-1/2 text-[#8A8899] z-10"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Operational Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Card title="Aguardando Programação" subtitle="SAs abertas aguardando rota por CDO">
          <div className="space-y-3">
            <div className="text-3xl font-bold text-[#2E2D39]">{pendingScheduling}</div>
            <p className="text-xs text-[#514F66]">
              Ordens com OS e SA geradas sem atribuição técnica. Aguardam loteamento por CDO para os técnicos dedicados.
            </p>
            <Button variant="outline" size="sm" onClick={() => onNavigate('scheduling')}>
              Ir para Programação de Campo
            </Button>
          </div>
        </Card>

        <Card title="Programados & Em Campo" subtitle="Operações em andamento hoje">
          <div className="space-y-3">
            <div className="text-3xl font-bold text-[#2E2D39]">{metrics.totalScheduled + metrics.totalInField}</div>
            <p className="text-xs text-[#514F66]">
              {metrics.totalScheduled} em agendamento futuro e {metrics.totalInField} com equipe atuando na rota hoje.
            </p>
            <Button variant="outline" size="sm" onClick={() => onNavigate('execution')}>
              Acompanhar Execução do Dia
            </Button>
          </div>
        </Card>

        <Card title="Prontos para Abertura de OS" subtitle="Clientes viabilizados em status READY">
          <div className="space-y-3">
            <div className="text-3xl font-bold text-[#10B981]">{Math.max(0, metrics.totalViable - metrics.totalOsCreated)}</div>
            <p className="text-xs text-[#514F66]">
              Endereços higienizados e porta V.tal alocada. Autorize a geração massiva individual 1:1:1.
            </p>
            <Button variant="primary" size="sm" onClick={() => onNavigate('orders')}>
              Autorizar Abertura Massiva
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
