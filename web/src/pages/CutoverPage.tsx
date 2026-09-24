import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import DataTable, { type DataTableColumn } from '../components/ui/DataTable';
import StatusPill from '../components/ui/StatusPill';
import Modal from '../components/ui/Modal';
import { MigrationApi } from '../services/api';
import type { MigrationItem } from '../types';
import { Zap, RotateCcw, CheckCircle, RefreshCw, Undo2 } from 'lucide-react';

export default function CutoverPage({ maId }: { maId?: string }) {
  const [items, setItems] = useState<MigrationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [targetBoxInput, setTargetBoxInput] = useState('');

  // Rollback Modal
  const [rollbackItem, setRollbackItem] = useState<MigrationItem | null>(null);
  const [rollbackReason, setRollbackReason] = useState('FALHA_PERSISTENTE_OTICA');
  const [rollingBack, setRollingBack] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await MigrationApi.listItems({
        maId,
        limit: 100,
      });
      // Show items ready for cutover, in progress, failed or migrated
      const cutoverList = data.items.filter((i) =>
        ['OS_CREATED', 'SCHEDULED', 'IN_FIELD', 'ACTIVATING', 'MIGRATION_FAILED', 'MIGRATED', 'ROLLED_BACK'].includes(
          i.migrationStatus,
        ),
      );
      setItems(cutoverList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [maId]);

  const handleExecuteCutover = async (targetBoxId?: string, itemId?: string) => {
    if (!maId) return alert('Selecione um M&A no topo.');

    setExecuting(true);
    try {
      const res = await MigrationApi.executeCutover({
        maId,
        targetBoxId: targetBoxId || undefined,
        itemIds: itemId ? [itemId] : undefined,
      });

      alert(
        `Cutover finalizado!\nTotal: ${res.totalItems}\nMigrados com Sucesso: ${res.successCount}\nFalhas: ${res.failedCount}\nStatus: ${res.status}`,
      );
      fetchItems();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setExecuting(false);
    }
  };

  const handleRetryItem = async (itemId: string) => {
    try {
      await MigrationApi.retryItem(itemId);
      alert('Retentativa individual executada com sucesso!');
      fetchItems();
    } catch (err: any) {
      alert(`Falha na retentativa: ${err.message}`);
    }
  };

  const handleConfirmRollback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollbackItem) return;

    setRollingBack(true);
    try {
      await MigrationApi.rollbackItem(rollbackItem.id, rollbackReason);
      alert(`Rollback concluído para o cliente ${rollbackItem.customerName}. Drop revertido para a rede origem.`);
      setRollbackItem(null);
      fetchItems();
    } catch (err: any) {
      alert(`Erro no rollback: ${err.message}`);
    } finally {
      setRollingBack(false);
    }
  };

  const columns: DataTableColumn<MigrationItem>[] = [
    {
      key: 'customer',
      header: 'Cliente / CRM ID',
      render: (r) => (
        <div>
          <div className="font-semibold text-xs text-[#2E2D39]">{r.customerName}</div>
          <div className="text-[11px] font-mono text-[#8A8899]">{r.customerId}</div>
        </div>
      ),
    },
    {
      key: 'cdo',
      header: 'CDO Alvo',
      render: (r) => <span className="font-mono text-xs font-bold text-[#2E2D39]">{r.targetBoxId}</span>,
    },
    {
      key: 'serial',
      header: 'Serial Efetivo ONT',
      render: (r) => <span className="font-mono text-xs text-[#514F66]">{r.ontSerialEffective}</span>,
    },
    {
      key: 'status',
      header: 'Status Cutover',
      render: (r) => <StatusPill status={r.migrationStatus} />,
    },
    {
      key: 'diag',
      header: 'Diagnóstico Óptico / Erro',
      render: (r) =>
        r.errorCode ? (
          <div className="text-xs text-red-600">
            <span className="font-semibold">{r.errorCode}</span>
            <div className="text-[10px] text-[#8A8899] truncate max-w-[200px]">{r.errorDescription}</div>
          </div>
        ) : r.migrationStatus === 'MIGRATED' ? (
          <div className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
            <CheckCircle size={13} /> Sincronismo GPON OK
          </div>
        ) : (
          <span className="text-xs text-[#8A8899]">Aguardando disparo</span>
        ),
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          {r.migrationStatus === 'MIGRATION_FAILED' && (
            <>
              <Button variant="primary" size="sm" onClick={() => handleRetryItem(r.id)}>
                <RotateCcw size={12} /> Retentar
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRollbackItem(r)}>
                <Undo2 size={12} /> Rollback
              </Button>
            </>
          )}

          {['OS_CREATED', 'SCHEDULED', 'IN_FIELD'].includes(r.migrationStatus) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExecuteCutover(undefined, r.id)}
              loading={executing}
            >
              <Zap size={12} /> Cutover
            </Button>
          )}

          {r.migrationStatus === 'MIGRATED' && (
            <span className="text-xs text-emerald-600 font-semibold">Ativo V.tal</span>
          )}

          {r.migrationStatus === 'ROLLED_BACK' && (
            <span className="text-xs text-[#8A8899]">Revertido</span>
          )}
        </div>
      ),
      cellClassName: 'text-right',
      headerClassName: 'text-right',
    },
  ];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#2E2D39]">Cutover Massivo & Resiliência</h1>
          <p className="text-xs text-[#8A8899]">
            Acionamento de ativação com máquina de estados individual (13 etapas) e retentativa isolada
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Código da CDO (ex: CDO-VT-001)..."
            value={targetBoxInput}
            onChange={(e) => setTargetBoxInput(e.target.value.toUpperCase())}
            className="text-xs p-2 border border-[#E8E8EE] rounded bg-white outline-none w-56 font-mono"
          />
          <Button
            variant="primary"
            size="md"
            disabled={!targetBoxInput.trim()}
            loading={executing}
            onClick={() => handleExecuteCutover(targetBoxInput)}
          >
            <Zap size={14} /> Cutover da CDO
          </Button>
        </div>
      </div>

      {/* Info Card */}
      <div className="p-4 bg-white border border-[#E8E8EE] rounded-lg shadow-sm grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <div className="font-semibold text-[#2E2D39]">Execução Granular</div>
          <p className="text-[#514F66] mt-0.5">
            O comando pode ser disparado para a CDO inteira, mas a transposição física executa cliente a cliente em
            transações curtas e independentes.
          </p>
        </div>
        <div>
          <div className="font-semibold text-[#2E2D39]">Preservação de Sucessos</div>
          <p className="text-[#514F66] mt-0.5">
            Se 7 clientes migrarem e 1 falhar, os 7 migrados são consolidados definitivamente na V.tal e a falha fica
            isolada para saneamento.
          </p>
        </div>
        <div>
          <div className="font-semibold text-[#2E2D39]">Rollback de Drop</div>
          <p className="text-[#514F66] mt-0.5">
            Falha irrecuperável em campo permite o retorno formal à caixa de origem registrando auditoria em
            NW_ROLLBACK.
          </p>
        </div>
      </div>

      {/* Table */}
      <Card
        title="Fila de Clientes para Cutover"
        subtitle="Progresso etapa a etapa na ativação do acesso de fibra"
        actions={
          <Button variant="ghost" size="sm" onClick={fetchItems}>
            <RefreshCw size={14} />
          </Button>
        }
        noPadding
      >
        <DataTable
          columns={columns}
          rows={items}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="Nenhum cliente disponível para cutover no momento."
        />
      </Card>

      {/* Rollback Modal */}
      {rollbackItem && (
        <Modal
          title={`Rollback para Caixa de Origem: ${rollbackItem.customerName}`}
          onClose={() => setRollbackItem(null)}
        >
          <form onSubmit={handleConfirmRollback} className="space-y-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs space-y-1 text-red-800">
              <div className="font-bold">Atenção — Ação de Contingência de Campo:</div>
              <div>
                O drop óptico do cliente será reconectado à infraestrutura original (Caixa:{' '}
                <b>{rollbackItem.originBoxId}</b> - {rollbackItem.originProvider}).
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1">
                Motivo Técnico do Rollback
              </label>
              <select
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              >
                <option value="FALHA_PERSISTENTE_OTICA">Atenuação Óptica Crítica Fora da Faixa de Operação</option>
                <option value="ONT_INCOMPATIVEL">Incompatibilidade Insuperável de Firmware da ONT em Campo</option>
                <option value="ROMPIMENTO_DROP_SEM_REPARO">Rompimento Físico de Drop sem Condições Imediatas de Reparo</option>
                <option value="SOLICITACAO_CLIENTE">Interrupção por Solicitação Externa do Assinante</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setRollbackItem(null)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" loading={rollingBack} className="bg-red-600 hover:bg-red-700 text-white">
                Confirmar Rollback
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
