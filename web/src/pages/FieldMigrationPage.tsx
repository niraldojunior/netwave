import React, { useEffect, useState } from 'react';
import Button from '../components/ui/Button';
import DataTable, { type DataTableColumn } from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import { MigrationApi } from '../services/api';
import type { BoxSchedule, MigrationItem } from '../types';
import {
  Zap,
  Edit2,
  RefreshCw,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface FieldMigrationPageProps {
  maId?: string;
}

export default function FieldMigrationPage({ maId }: FieldMigrationPageProps) {
  const [items, setItems] = useState<MigrationItem[]>([]);
  const [schedules, setSchedules] = useState<BoxSchedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [executingCutover, setExecutingCutover] = useState(false);
  const [selectedBox, setSelectedBox] = useState('');

  // Serial Override Modal
  const [serialModalItem, setSerialModalItem] = useState<MigrationItem | null>(null);
  const [newSerial, setNewSerial] = useState('');
  const [reason, setReason] = useState('SOURCE_DATA_MISMATCH');
  const [observation, setObservation] = useState('');
  const [savingSerial, setSavingSerial] = useState(false);

  // Rollback Modal
  const [rollbackItem, setRollbackItem] = useState<MigrationItem | null>(null);
  const [rollbackReason, setRollbackReason] = useState('FALHA_PERSISTENTE_OTICA');
  const [rollingBack, setRollingBack] = useState(false);

  const fetchData = async () => {
    if (!maId) return;
    setLoading(true);
    try {
      const [itemsRes, schedRes] = await Promise.all([
        MigrationApi.listItems({ maId, limit: 500, hasOs: true }),
        MigrationApi.listBoxSchedules({ maId, limit: 100 }),
      ]);

      // Filtrar apenas itens operacionais relevantes para o Dia D
      const list = itemsRes.items.filter((i) =>
        [
          'OS_CREATED',
          'SCHEDULED',
          'IN_FIELD',
          'SERIAL_EXCEPTION',
          'ACTIVATING',
          'MIGRATED',
          'MIGRATION_FAILED',
          'ROLLBACK_REQUESTED',
          'ROLLED_BACK',
        ].includes(i.migrationStatus),
      );
      setItems(list);

      // Filtrar apenas agendamentos programados pendentes (se todos os HCs já estiverem migrados ou status for COMPLETED, assumir como concluída e não listar)
      const programmedSchedules = (schedRes.schedules || []).filter((s) => {
        if (!s.scheduleStatus || s.scheduleStatus === 'AVAILABLE' || !s.scheduledDate) {
          return false;
        }
        if (s.scheduleStatus === 'COMPLETED') {
          return false;
        }

        const cdoItems = list.filter((i) => i.targetBoxId === s.targetBoxId);
        // Se todos os HCs já estiverem migrados, assumir como concluída e não listar na combo
        if (cdoItems.length > 0 && cdoItems.every((i) => i.migrationStatus === 'MIGRATED')) {
          return false;
        }

        return true;
      });

      setSchedules(programmedSchedules);

      // Se ainda não tiver CDO selecionada (ou a atual foi concluída), seleciona a primeira da lista de programadas pendentes
      const cdos = Array.from(
        new Set(programmedSchedules.map((s) => s.targetBoxId).filter(Boolean)),
      ).sort((a, b) => (a as string).localeCompare(b as string)) as string[];

      if (cdos.length > 0) {
        setSelectedBox((prev) => (prev && cdos.includes(prev) ? prev : cdos[0]));
      } else {
        setSelectedBox('');
      }
    } catch (e) {
      console.error('Falha ao carregar dados de campo:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedBox('');
    fetchData();
  }, [maId]);

  // Lista ordenada de CDOs programadas disponíveis para atividade em campo
  const uniqueBoxes = Array.from(
    new Set(schedules.map((s) => s.targetBoxId).filter(Boolean)),
  ).sort((a, b) => (a as string).localeCompare(b as string)) as string[];

  // Informações da CDO selecionada
  const selectedSchedule = schedules.find((s) => s.targetBoxId === selectedBox);
  const cdoAllItems = items.filter((i) => i.targetBoxId === selectedBox);
  const technicianName =
    selectedSchedule?.technicianName ||
    cdoAllItems[0]?.technicianId ||
    'Técnico Designado';
  const scheduledDate =
    selectedSchedule?.scheduledDate || cdoAllItems[0]?.scheduledDate || '';
  const cdoMigratedCount = cdoAllItems.filter((i) => i.migrationStatus === 'MIGRATED').length;
  const cdoPendingCount = cdoAllItems.filter((i) => i.migrationStatus !== 'MIGRATED').length;

  const openSerialModal = (item: MigrationItem) => {
    setSerialModalItem(item);
    setNewSerial(item.ontSerialEffective);
    setReason('SOURCE_DATA_MISMATCH');
    setObservation('');
  };

  const handleSaveSerial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serialModalItem || !newSerial.trim()) return;

    setSavingSerial(true);
    try {
      await MigrationApi.overrideSerial(serialModalItem.id, {
        newSerial: newSerial.trim().toUpperCase(),
        reason,
        observation,
      });
      alert(
        `Serial atualizado para "${newSerial.toUpperCase()}" com sucesso! Serial original preservado com registro em NW_SERIAL_CHANGE.`,
      );
      setSerialModalItem(null);
      await fetchData();
    } catch (err: any) {
      alert(`Erro ao atualizar serial: ${err.message}`);
    } finally {
      setSavingSerial(false);
    }
  };

  const handleExecuteCutover = async (targetBoxId?: string, itemId?: string) => {
    if (!maId) return;
    const confirmMsg = targetBoxId
      ? `Confirma a ativação massiva (cutover) para todos os clientes da CDO ${targetBoxId}? O sinal óptico será validado automaticamente.`
      : `Confirma a ativação individual deste cliente?`;
    if (!confirm(confirmMsg)) return;

    setExecutingCutover(true);
    try {
      const res = await MigrationApi.executeCutover({
        maId,
        targetBoxId: targetBoxId || undefined,
        itemIds: itemId ? [itemId] : undefined,
      });
      alert(
        `Ativação Massiva Concluída!\n\n` +
          `• Total de clientes avaliados: ${res.totalItems}\n` +
          `• Ativados com Sucesso (Óptica OK): ${res.successCount}\n` +
          `• Falhas: ${res.failedCount}\n` +
          `• Status: ${res.status}`,
      );
      await fetchData();
    } catch (err: any) {
      alert(`Erro na ativação: ${err.message}`);
    } finally {
      setExecutingCutover(false);
    }
  };

  const handleConfirmRollback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollbackItem) return;

    setRollingBack(true);
    try {
      await MigrationApi.rollbackItem(rollbackItem.id, rollbackReason);
      alert(`Rollback concluído para o cliente ${rollbackItem.customerName}. Drop revertido para a rede de origem.`);
      setRollbackItem(null);
      await fetchData();
    } catch (err: any) {
      alert(`Erro no rollback: ${err.message}`);
    } finally {
      setRollingBack(false);
    }
  };

  const columns: DataTableColumn<MigrationItem>[] = [
    {
      key: 'customer',
      header: 'Cliente / Endereço',
      render: (r) => (
        <div>
          <div className="font-semibold text-xs text-[#2E2D39]">{r.customerName}</div>
          <div className="text-[11px] text-[#514F66] truncate max-w-sm" title={r.rawAddress}>
            {r.rawAddress}
          </div>
        </div>
      ),
    },
    {
      key: 'serial',
      header: 'Serial',
      render: (r) => {
        const isChanged = r.ontSerialEffective !== r.ontSerialOriginal;
        return (
          <div>
            <span
              className={`font-mono text-xs font-semibold px-2 py-0.5 rounded ${
                isChanged
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {r.ontSerialEffective}
            </span>
            {isChanged && (
              <span className="block text-[10px] text-amber-700 font-bold mt-0.5">
                Alterado em campo (Orig: {r.ontSerialOriginal})
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        if (r.migrationStatus === 'MIGRATED') {
          return (
            <span className="inline-flex items-center text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
              <CheckCircle2 size={13} className="mr-1 text-emerald-600" />
              Migrado OK
            </span>
          );
        }
        if (['MIGRATION_FAILED', 'ROLLBACK_REQUESTED', 'ROLLED_BACK'].includes(r.migrationStatus)) {
          return (
            <span className="inline-flex items-center text-xs font-semibold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
              <AlertTriangle size={13} className="mr-1 text-rose-600" />
              Falha Cutover
            </span>
          );
        }
        return (
          <span className="inline-flex items-center text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
            A Realizar
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Ações',
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => openSerialModal(r)}
            disabled={r.migrationStatus === 'MIGRATED'}
            title="Corrigir serial da ONT verificado pelo técnico"
            className="text-xs p-1 px-2.5"
          >
            <Edit2 size={12} className="mr-1" />
            Editar Serial
          </Button>

          {r.migrationStatus !== 'MIGRATED' ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleExecuteCutover(undefined, r.id)}
              disabled={executingCutover}
              title="Cortar e ativar cliente individualmente"
              className="text-xs p-1 px-2.5"
            >
              <Zap size={12} className="mr-1" />
              Ativar
            </Button>
          ) : (
            <span className="text-[11px] text-emerald-700 font-semibold flex items-center px-1.5">
              <CheckCircle2 size={13} className="mr-1" /> Ativado
            </span>
          )}

          {r.migrationStatus === 'MIGRATION_FAILED' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRollbackItem(r);
                setRollbackReason('FALHA_PERSISTENTE_OTICA');
              }}
              title="Reverter drop para a rede de origem"
              className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50 p-1 px-2"
            >
              <RotateCcw size={12} className="mr-1" />
              Rollback
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (!maId) {
    return (
      <div className="p-8 text-center text-[#8A8899]">
        Selecione um M&A no topo para acessar a operação de migração em campo.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              Operacional
            </span>
            <h1 className="text-xl font-bold text-[#2E2D39]">Atividades em Campo & Cutover</h1>
          </div>
          <p className="text-xs text-[#8A8899] mt-1">
            Execução no Dia D: validação de serial da ONT e ativação por CDO
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} loading={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Painel Consolidado: Seleção da Programação do Dia + Informações Operacionais + Ativação Massiva */}
      <div className="bg-white rounded-xl border border-[#E9E8F2] p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
          <div className="flex items-center gap-2.5">
            <label className="text-xs font-bold text-[#2E2D39] whitespace-nowrap">
              Programação:
            </label>
            <select
              value={selectedBox}
              onChange={(e) => setSelectedBox(e.target.value)}
              className="text-xs font-semibold p-2 border border-[#D7D5E5] rounded-lg bg-[#FAFAFC] outline-none focus:border-[#FFD919] min-w-[240px] cursor-pointer"
            >
              {uniqueBoxes.length === 0 ? (
                <option value="">Todas as CDOs programadas foram concluídas</option>
              ) : (
                uniqueBoxes.map((b) => {
                  const sched = schedules.find((s) => s.targetBoxId === b);
                  const tech = sched?.technicianName || 'Técnico Designado';
                  return (
                    <option key={b} value={b}>
                      CDO {b} — {tech}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {selectedBox && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-[#514F66] md:border-l md:border-[#E9E8F2] md:pl-4">
              <div>
                <span className="text-[#8A8899]">Técnico: </span>
                <span className="font-semibold text-[#2E2D39]">{technicianName}</span>
              </div>
              {scheduledDate && (
                <div>
                  <span className="text-[#8A8899]">Data: </span>
                  <span className="font-medium text-[#2E2D39]">{scheduledDate}</span>
                </div>
              )}
              <div>
                <span className="text-[#8A8899]">Clientes: </span>
                <span className="font-bold text-[#2E2D39]">{cdoAllItems.length}</span>
                <span className="text-[#8A8899] ml-1">
                  ({cdoMigratedCount} migrado{cdoMigratedCount === 1 ? '' : 's'} / {cdoPendingCount} a realizar)
                </span>
              </div>
            </div>
          )}
        </div>

        {selectedBox && (
          <div className="flex items-center gap-3 self-end lg:self-center">
            <Button
              variant="primary"
              size="md"
              disabled={cdoAllItems.length === 0 || executingCutover || cdoPendingCount === 0}
              loading={executingCutover}
              onClick={() => handleExecuteCutover(selectedBox)}
              className="flex items-center gap-2 whitespace-nowrap shadow-sm font-bold text-sm py-2 px-4"
              title="Executa corte simultâneo e validação óptica de todos os clientes desta CDO"
            >
              <Zap size={16} />
              {cdoPendingCount === 0 ? 'CDO 100% Migrada' : 'Ativar Massivamente'}
            </Button>
          </div>
        )}
      </div>

      {/* Tabela da Programação */}
      {selectedBox ? (
        <DataTable
          columns={columns}
          rows={cdoAllItems}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="Nenhum cliente encontrado para esta CDO."
        />
      ) : (
        <div className="bg-white rounded-xl border border-[#E9E8F2] p-12 text-center text-[#8A8899] text-xs">
          {uniqueBoxes.length === 0
            ? 'Todas as CDOs programadas desta onda já foram 100% concluídas com sucesso!'
            : 'Nenhuma programação de CDO selecionada para este M&A.'}
        </div>
      )}

      {/* Serial Correction Modal */}
      {serialModalItem && (
        <Modal
          title={`Corrigir Serial da ONT — ${serialModalItem.customerName}`}
          onClose={() => setSerialModalItem(null)}
        >
          <form onSubmit={handleSaveSerial} className="space-y-4">
            <div className="p-3 bg-[#FAFAFB] border border-[#E8E8EE] rounded space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8A8899]">Serial Original (Recebido M&A):</span>
                <span className="font-mono font-bold text-slate-700">{serialModalItem.ontSerialOriginal}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8A8899]">Serial Atual no netWave:</span>
                <span className="font-mono font-bold text-indigo-700">{serialModalItem.ontSerialEffective}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8A8899]">CDO Alvo:</span>
                <span className="font-mono text-slate-700">{serialModalItem.targetBoxId}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1">
                Novo Serial Validado pelo Técnico em Campo
              </label>
              <input
                type="text"
                required
                value={newSerial}
                onChange={(e) => setNewSerial(e.target.value.toUpperCase())}
                placeholder="Ex: ALCLB998877"
                className="w-full text-xs font-mono font-bold p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1">
                Motivo da Divergência
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              >
                <option value="SOURCE_DATA_MISMATCH">Divergência de Cadastro da Base de Origem</option>
                <option value="EQUIPMENT_SWAP">Troca Prévia de Equipamento pelo Cliente</option>
                <option value="TYPO_IN_ORIGIN">Erro de Digitação no Arquivo CSV</option>
                <option value="FIELD_SWAP">Troca Emergencial de ONT por Defeito Técnico</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1">
                Observações de Auditoria
              </label>
              <textarea
                rows={2}
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Ex: Técnico Carlos validou o serial gravado na etiqueta física da ONT no local..."
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              />
            </div>

            <div className="p-2 bg-blue-50 border border-blue-200 rounded text-[11px] text-blue-800">
              O serial original <code className="font-mono">{serialModalItem.ontSerialOriginal}</code> nunca é apagado. Esta alteração será auditada e persistida em <code className="font-mono">NW_SERIAL_CHANGE</code>.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setSerialModalItem(null)}>
                Cancelar
              </Button>
              <Button variant="primary" type="submit" loading={savingSerial}>
                Salvar Novo Serial
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Rollback Modal */}
      {rollbackItem && (
        <Modal
          title={`Confirmar Rollback de Emergência — ${rollbackItem.customerName}`}
          onClose={() => setRollbackItem(null)}
        >
          <form onSubmit={handleConfirmRollback} className="space-y-4">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
              O rollback reverterá a conexão física para a rede regional de origem do M&A e cancelará o provisionamento na rede V.tal.
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1">
                Motivo do Rollback
              </label>
              <select
                value={rollbackReason}
                onChange={(e) => setRollbackReason(e.target.value)}
                className="w-full text-xs p-2 border border-[#E8E8EE] rounded bg-[#FAFAFB] focus:border-[#FFD919] outline-none"
              >
                <option value="FALHA_PERSISTENTE_OTICA">Falha Persistente de Atenuação Óptica</option>
                <option value="CLIENTE_SOLICITOU_CANCELAMENTO">Cliente Solicitou Interrupção</option>
                <option value="INCOMPATIBILIDADE_EQUIPAMENTO">Incompatibilidade Técnica de ONT</option>
                <option value="ROMPIMENTO_DROP">Rompimento de Drop em Campo</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" type="button" onClick={() => setRollbackItem(null)}>
                Cancelar
              </Button>
              <Button variant="danger" type="submit" loading={rollingBack}>
                Executar Rollback
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
