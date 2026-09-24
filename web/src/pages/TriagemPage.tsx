import React, { useEffect, useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { MigrationApi } from '../services/api';
import type { MigrationItem } from '../types';
import {
  Filter,
  AlertTriangle,
  FileSpreadsheet,
  RefreshCw,
  Play,
  RotateCcw,
  Search,
  MapPin,
  Edit3,
  HelpCircle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Building2,
} from 'lucide-react';

interface TriagemPageProps {
  maId?: string;
  onNavigate: (tab: any) => void;
}

export default function TriagemPage({ maId, onNavigate }: TriagemPageProps) {
  const [items, setItems] = useState<MigrationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [reprocessing, setReprocessing] = useState(false);
  const [reprocessingItemId, setReprocessingItemId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ADDRESS_EXCEPTION' | 'NOT_VIABLE' | 'IMPORTED'>('ALL');
  const [search, setSearch] = useState('');

  // Modal de Edição de Endereço para Repescagem
  const [editingItem, setEditingItem] = useState<MigrationItem | null>(null);
  const [editForm, setEditForm] = useState({
    rawAddress: '',
    cep: '',
    city: '',
    stateOrUf: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchItems = async () => {
    if (!maId) return;
    setLoading(true);
    try {
      const res = await MigrationApi.listItems({ maId, limit: 500 });
      setItems(res.items);
    } catch (e) {
      console.error('Falha ao listar exceções de qualificação:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [maId]);

  // REGRA MANDATÓRIA: Esta página lista APENAS aquilo que NÃO foi carregado com sucesso (exceções).
  // Clientes que já geraram OS ou estão em etapas posteriores NÃO são exibidos nesta tela!
  const EXCLUDED_STATUSES = new Set([
    'OS_CREATED',
    'SCHEDULED',
    'IN_FIELD',
    'ACTIVATING',
    'MIGRATED',
    'RELEASED',
    'ROLLED_BACK',
  ]);

  const exceptionItems = items.filter(
    (item) => !EXCLUDED_STATUSES.has(item.migrationStatus) && !item.osId
  );

  // Contadores de Exceções
  const countAddressCritique = exceptionItems.filter((i) => i.migrationStatus === 'ADDRESS_EXCEPTION').length;
  const countNotViable = exceptionItems.filter((i) => i.migrationStatus === 'NOT_VIABLE').length;
  const countImported = exceptionItems.filter((i) => i.migrationStatus === 'IMPORTED').length;
  const countTotalExceptions = exceptionItems.length;

  // Itens filtrados por aba e busca
  const filteredItems = exceptionItems.filter((item) => {
    if (activeFilter === 'ADDRESS_EXCEPTION' && item.migrationStatus !== 'ADDRESS_EXCEPTION') return false;
    if (activeFilter === 'NOT_VIABLE' && item.migrationStatus !== 'NOT_VIABLE') return false;
    if (activeFilter === 'IMPORTED' && item.migrationStatus !== 'IMPORTED') return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = item.customerName.toLowerCase().includes(q);
      const matchDoc = item.externalCustomerId.toLowerCase().includes(q);
      const matchAddress = item.rawAddress.toLowerCase().includes(q);
      const matchCep = (item.cep || '').toLowerCase().includes(q);
      const matchError = (item.errorDescription || '').toLowerCase().includes(q);
      return matchName || matchDoc || matchAddress || matchCep || matchError;
    }
    return true;
  });

  // Repescar um item individual
  const handleRetryItem = async (itemId: string) => {
    if (!maId) return;
    setReprocessingItemId(itemId);
    try {
      const res = await MigrationApi.prepareItems({ maId, itemIds: [itemId] });
      if (res.ready > 0) {
        alert('Cliente qualificado com sucesso! A OS e SA foram geradas automaticamente (1:1:1) e o registro foi encaminhado para Ordens Abertas.');
      } else {
        alert('Repescagem executada. O cliente permaneceu em exceção. Verifique os dados de endereço ou viabilidade.');
      }
      await fetchItems();
    } catch (err: any) {
      alert(`Erro na repescagem: ${err.message}`);
    } finally {
      setReprocessingItemId(null);
    }
  };

  // Repescar todas as exceções elegíveis
  const handleRetryAll = async () => {
    if (!maId) return;
    if (exceptionItems.length === 0) return alert('Nenhuma exceção pendente de repescagem.');

    const confirmRun = window.confirm(
      `Deseja executar a repescagem para ${exceptionItems.length} cliente(s) em exceção? Aqueles que forem viabilizados terão OS e SA geradas automaticamente.`
    );
    if (!confirmRun) return;

    setReprocessing(true);
    try {
      const itemIds = exceptionItems.map((i) => i.id);
      const res = await MigrationApi.prepareItems({ maId, itemIds });
      alert(
        `Repescagem de Exceções concluída!\n\n` +
        `• Total reprocessados: ${res.processed}\n` +
        `• Viabilizados com OS Criada: ${res.ready}\n` +
        `• Mantidos com Crítica de Endereço: ${res.exceptions}\n` +
        `• Mantidos Inviáveis: ${res.notViable}`
      );
      await fetchItems();
    } catch (err: any) {
      alert(`Erro na repescagem em lote: ${err.message}`);
    } finally {
      setReprocessing(false);
    }
  };

  // Abrir modal de edição de endereço
  const handleOpenEditAddress = (item: MigrationItem) => {
    setEditingItem(item);
    setEditForm({
      rawAddress: item.rawAddress || '',
      cep: item.cep || '',
      city: item.city || '',
      stateOrUf: item.stateOrUf || 'RJ',
    });
  };

  // Salvar novo endereço e opcionalmente já repescar
  const handleSaveAndRetry = async (andRetry: boolean) => {
    if (!editingItem || !maId) return;
    setSavingEdit(true);
    try {
      await MigrationApi.updateItemAddress(editingItem.id, editForm);
      if (andRetry) {
        await MigrationApi.prepareItems({ maId, itemIds: [editingItem.id] });
      }
      setEditingItem(null);
      await fetchItems();
      if (andRetry) {
        alert('Endereço atualizado e repescagem executada com sucesso!');
      }
    } catch (err: any) {
      alert(`Erro ao atualizar endereço: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  if (!maId) {
    return (
      <div className="p-8 text-center text-[#8A8899]">
        Selecione uma onda de migração no topo para visualizar e tratar as exceções de clientes.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 w-full max-w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200">
              Operacional
            </span>
            <h1 className="text-xl font-bold text-[#2E2D39]">Qualificação de Exceções</h1>
          </div>
          <p className="text-xs text-[#8A8899] mt-1">
            Tratamento, saneamento cadastral e repescagem de clientes com inconsistência de endereço ou inviabilidade técnica.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchItems}
            loading={loading}
            title="Atualizar lista"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Atualizar
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={handleRetryAll}
            loading={reprocessing}
            disabled={exceptionItems.length === 0}
            className="flex items-center gap-1.5"
            title="Reprocessar geocodificação e viabilidade para todas as exceções da onda"
          >
            <RotateCcw size={14} />
            Repescar Todas as Exceções
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('orders')}
            className="flex items-center gap-1.5 border-[#D7D5E5] text-[#514F66]"
            title="Visualizar ordens de serviço já abertas no CRM"
          >
            <FileSpreadsheet size={14} className="text-indigo-600" />
            Ver Ordens
            <ArrowRight size={12} />
          </Button>
        </div>
      </div>

      {/* KPI Cards — Foco Exclusivo em Exceções e Repescagem */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div
          onClick={() => setActiveFilter('ALL')}
          className={`vt-card p-3.5 cursor-pointer transition-all border-2 ${
            activeFilter === 'ALL' ? 'border-[#2E2D39] bg-slate-50' : 'border-transparent'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8A8899]">Total Exceções</span>
            <AlertTriangle size={16} className="text-slate-600" />
          </div>
          <div className="text-2xl font-bold text-[#2E2D39] mt-1">{countTotalExceptions}</div>
          <span className="text-[10px] text-slate-500 font-medium">Aguardando repescagem na esteira</span>
        </div>

        <div
          onClick={() => setActiveFilter('ADDRESS_EXCEPTION')}
          className={`vt-card p-3.5 cursor-pointer transition-all border-2 ${
            activeFilter === 'ADDRESS_EXCEPTION' ? 'border-rose-400 bg-rose-50/30' : 'border-transparent'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8A8899]">Crítica de Endereço</span>
            <MapPin size={16} className="text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 mt-1">{countAddressCritique}</div>
          <span className="text-[10px] text-rose-500 font-medium">Logradouro / CEP não localizado</span>
        </div>

        <div
          onClick={() => setActiveFilter('NOT_VIABLE')}
          className={`vt-card p-3.5 cursor-pointer transition-all border-2 ${
            activeFilter === 'NOT_VIABLE' ? 'border-amber-400 bg-amber-50/30' : 'border-transparent'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8A8899]">Inviabilidade Técnica</span>
            <XCircle size={16} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-1">{countNotViable}</div>
          <span className="text-[10px] text-amber-600 font-medium">Sem CDO próxima ou capacidade</span>
        </div>

        <div
          onClick={() => setActiveFilter('IMPORTED')}
          className={`vt-card p-3.5 cursor-pointer transition-all border-2 ${
            activeFilter === 'IMPORTED' ? 'border-blue-400 bg-blue-50/30' : 'border-transparent'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#8A8899]">Pendentes de Carga</span>
            <Filter size={16} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-700 mt-1">{countImported}</div>
          <span className="text-[10px] text-blue-600 font-medium">Aguardando primeira validação</span>
        </div>
      </div>

      {/* Main Card — Tabela de Exceções */}
      <Card
        title="Fila de Repescagem de Clientes"
        subtitle="Registros com crítica de validação cadastral ou técnica pendentes de saneamento para abertura de OS"
        noPadding
      >
        {/* Filter Tabs and Search Bar */}
        <div className="p-4 border-b border-[#E9E8F2] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#FAFAFB]">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            <button
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                activeFilter === 'ALL'
                  ? 'bg-[#2E2D39] text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-[#E8E8EE]'
              }`}
            >
              Todas as Exceções ({countTotalExceptions})
            </button>
            <button
              onClick={() => setActiveFilter('ADDRESS_EXCEPTION')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                activeFilter === 'ADDRESS_EXCEPTION'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
              }`}
            >
              Críticas de Endereço ({countAddressCritique})
            </button>
            <button
              onClick={() => setActiveFilter('NOT_VIABLE')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                activeFilter === 'NOT_VIABLE'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-white text-amber-700 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              Inviabilidade Técnica ({countNotViable})
            </button>
            {countImported > 0 && (
              <button
                onClick={() => setActiveFilter('IMPORTED')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  activeFilter === 'IMPORTED'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white text-blue-700 hover:bg-blue-50 border border-blue-200'
                }`}
              >
                Pendentes ({countImported})
              </button>
            )}
          </div>

          <div className="relative w-full sm:w-80">
            <Search size={14} className="absolute left-3 top-2.5 text-[#8A8899]" />
            <input
              type="text"
              placeholder="Buscar por cliente, endereço, CEP ou erro..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8.5 pr-3 py-1.5 border border-[#D7D5E5] rounded-md bg-white focus:border-[#FFD919] outline-none"
            />
          </div>
        </div>

        {/* Tabela de Exceções */}
        <div className="overflow-x-auto w-full">
          <table className="vt-table w-full">
            <thead>
              <tr>
                <th className="min-w-[190px]">Cliente</th>
                <th className="min-w-[260px]">Endereço Declarado</th>
                <th className="whitespace-nowrap min-w-[130px]">Serial ONT</th>
                <th className="text-center whitespace-nowrap min-w-[160px]" style={{ textAlign: 'center' }}>Tipo de Exceção</th>
                <th className="min-w-[280px]">Motivo / Detalhes da Exceção</th>
                <th className="!text-center whitespace-nowrap min-w-[170px]" style={{ textAlign: 'center' }}>Ações de Repescagem</th>
              </tr>
            </thead>
            <tbody>
              {loading && exceptionItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-xs text-[#8A8899]">
                    Carregando fila de exceções...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-xs text-[#8A8899]">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <CheckCircle2 size={24} className="text-emerald-500" />
                      <span className="font-semibold text-[#2E2D39]">Nenhuma exceção pendente!</span>
                      <span className="text-[#8A8899]">Todos os clientes válidos já foram qualificados e tiveram suas OSs abertas com sucesso.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isReprocessing = reprocessingItemId === item.id;

                  return (
                    <tr key={item.id} className="hover:bg-[#F8F7FC] transition-colors">
                      {/* Cliente */}
                      <td>
                        <div className="font-semibold text-[#2E2D39] text-xs">{item.customerName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{item.externalCustomerId}</div>
                      </td>

                      {/* Endereço Declarado */}
                      <td>
                        <div className="text-xs text-[#2E2D39] font-medium" title={item.rawAddress}>
                          {item.rawAddress}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                          <MapPin size={10} className="text-[#8A8899]" />
                          <span>{item.city} - {item.stateOrUf}</span>
                          <span className="font-mono bg-[#F5F5F8] px-1 rounded">CEP: {item.cep}</span>
                        </div>
                      </td>

                      {/* Serial ONT */}
                      <td>
                        <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
                          {item.ontSerialOriginal}
                        </span>
                      </td>

                      {/* Tipo de Exceção */}
                      <td className="!text-center whitespace-nowrap" style={{ textAlign: 'center' }}>
                        {item.migrationStatus === 'ADDRESS_EXCEPTION' && (
                          <Badge tone="red" dot>Crítica de Endereço</Badge>
                        )}
                        {item.migrationStatus === 'NOT_VIABLE' && (
                          <Badge tone="amber" dot>Inviabilidade Técnica</Badge>
                        )}
                        {item.migrationStatus === 'IMPORTED' && (
                          <Badge tone="blue" dot>Pendente</Badge>
                        )}
                        {item.migrationStatus === 'MIGRATION_FAILED' && (
                          <Badge tone="red" dot>Falha na Migração</Badge>
                        )}
                        {!['ADDRESS_EXCEPTION', 'NOT_VIABLE', 'IMPORTED', 'MIGRATION_FAILED'].includes(item.migrationStatus) && (
                          <Badge tone="neutral" dot>{item.migrationStatus}</Badge>
                        )}
                      </td>

                      {/* Motivo / Detalhes */}
                      <td>
                        <div className="text-xs font-medium text-rose-700">
                          {item.errorDescription || 'Inconsistência cadastral na geocodificação ou rede.'}
                        </div>
                        {item.errorCode && (
                          <div className="text-[10px] text-[#8A8899] font-mono mt-0.5">
                            Código: {item.errorCode}
                          </div>
                        )}
                      </td>

                      {/* Ações de Repescagem */}
                      <td className="!text-center whitespace-nowrap" style={{ textAlign: 'center' }}>
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEditAddress(item)}
                            className="text-xs py-1 px-2.5 h-7 border-[#D7D5E5] text-[#514F66]"
                            title="Editar logradouro ou CEP do cliente para tentar viabilizar"
                          >
                            <Edit3 size={11} className="mr-1 text-slate-600" />
                            Editar Endereço
                          </Button>

                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleRetryItem(item.id)}
                            loading={isReprocessing}
                            className="text-xs py-1 px-2.5 h-7"
                            title="Reprocessar geocodificação e abrir OS no CRM se viabilizado"
                          >
                            <RotateCcw size={11} className="mr-1" />
                            Repescar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL DE SANEAMENTO / EDIÇÃO DE ENDEREÇO */}
      {editingItem && (
        <Modal
          title={
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-[#FFD919]" />
              <span>Saneamento de Endereço — Repescagem</span>
            </div>
          }
          width={580}
          onClose={() => {
            if (!savingEdit) setEditingItem(null);
          }}
          footer={
            <div className="flex items-center justify-between w-full">
              <Button
                variant="ghost"
                size="md"
                onClick={() => setEditingItem(null)}
                disabled={savingEdit}
              >
                Cancelar
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => handleSaveAndRetry(false)}
                  loading={savingEdit}
                  title="Salvar alterações de endereço sem reprocessar agora"
                >
                  Salvar
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleSaveAndRetry(true)}
                  loading={savingEdit}
                  title="Salvar dados corrigidos e disparar a repescagem para gerar OS"
                >
                  <RotateCcw size={14} className="mr-1" />
                  Salvar e Repescar
                </Button>
              </div>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="bg-[#FAFAFB] border border-[#E8E8EE] rounded-lg p-3 text-xs">
              <div className="font-semibold text-[#2E2D39]">{editingItem.customerName}</div>
              <div className="text-[11px] text-[#8A8899] font-mono">
                ID Externo: {editingItem.externalCustomerId} | Serial ONT: {editingItem.ontSerialOriginal}
              </div>
              <div className="text-xs text-rose-600 mt-1 font-medium">
                Motivo da Exceção: {editingItem.errorDescription || 'Inconsistência de endereço'}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#514F66] mb-1.5">
                Logradouro Completo (Rua, Número, Bairro)
              </label>
              <input
                type="text"
                value={editForm.rawAddress}
                onChange={(e) => setEditForm({ ...editForm, rawAddress: e.target.value })}
                placeholder="Ex: Rua Coronel Moreira Cesar, 102, Icaraí"
                className="w-full text-xs p-2.5 border border-[#D7D5E5] rounded-md bg-white focus:border-[#FFD919] outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#514F66] mb-1.5">
                  CEP
                </label>
                <input
                  type="text"
                  value={editForm.cep}
                  onChange={(e) => setEditForm({ ...editForm, cep: e.target.value })}
                  placeholder="24230-050"
                  className="w-full text-xs p-2.5 border border-[#D7D5E5] rounded-md bg-white focus:border-[#FFD919] outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#514F66] mb-1.5">
                  Município
                </label>
                <input
                  type="text"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  placeholder="Niterói"
                  className="w-full text-xs p-2.5 border border-[#D7D5E5] rounded-md bg-white focus:border-[#FFD919] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#514F66] mb-1.5">
                  UF
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={editForm.stateOrUf}
                  onChange={(e) => setEditForm({ ...editForm, stateOrUf: e.target.value.toUpperCase() })}
                  placeholder="RJ"
                  className="w-full text-xs p-2.5 border border-[#D7D5E5] rounded-md bg-white focus:border-[#FFD919] outline-none font-mono uppercase"
                />
              </div>
            </div>

            <p className="text-[11px] text-[#8A8899]">
              Ao clicar em <strong>Salvar e Repescar</strong>, o geocodificador V.tal reavaliará as coordenadas físicas e a viabilidade da CDO para geração automática de OS e SA (1:1:1).
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
