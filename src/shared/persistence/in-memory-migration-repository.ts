import type {
  AuditLog,
  BoxFilterOptions,
  BoxReleaseStatus,
  BoxSchedule,
  BoxScheduleHistory,
  CutoverBatch,
  CutoverItem,
  DashboardMetrics,
  DecommissionBoxMetric,
  ItemFilterOptions,
  Ma,
  MigrationItem,
  MigrationLot,
  MigrationRepository,
  OsBatch,
  Rollback,
  SerialChange,
  StrategicOverviewItem,
  Technician,
} from './repositories.js';
import { NotFoundError } from '../errors/app-error.js';

export class InMemoryMigrationRepository implements MigrationRepository {
  private mas = new Map<string, Ma>();
  private technicians = new Map<string, Technician>();
  private lots = new Map<string, MigrationLot>();
  private items = new Map<string, MigrationItem>();
  private schedules = new Map<string, BoxSchedule>();
  private scheduleHistories: BoxScheduleHistory[] = [];
  private serialChanges: SerialChange[] = [];
  private osBatches = new Map<string, OsBatch>();
  private cutoverBatches = new Map<string, CutoverBatch>();
  private cutoverItems: CutoverItem[] = [];
  private rollbacks = new Map<string, Rollback>();
  private auditLogs: AuditLog[] = [];

  // M&A
  public async createMa(ma: Ma): Promise<Ma> {
    this.mas.set(ma.id, { ...ma });
    return { ...ma };
  }

  public async getMaById(id: string): Promise<Ma | undefined> {
    const ma = this.mas.get(id);
    return ma ? { ...ma } : undefined;
  }

  public async listMas(): Promise<Ma[]> {
    return Array.from(this.mas.values()).map((m) => ({ ...m }));
  }

  public async updateMa(id: string, update: Partial<Ma>): Promise<Ma> {
    const ma = this.mas.get(id);
    if (!ma) throw new NotFoundError(`M&A ${id} não encontrado.`);
    const updated = { ...ma, ...update, updatedAt: new Date().toISOString() };
    this.mas.set(id, updated);
    return { ...updated };
  }

  public async deleteMa(id: string): Promise<boolean> {
    const ma = this.mas.get(id);
    if (!ma) throw new NotFoundError(`M&A ${id} não encontrado.`);
    ma.status = 'CANCELLED';
    ma.updatedAt = new Date().toISOString();
    return true;
  }

  // Technicians
  public async createTechnician(tech: Technician): Promise<Technician> {
    this.technicians.set(tech.id, { ...tech });
    return { ...tech };
  }

  public async listTechnicians(maId: string): Promise<Technician[]> {
    return Array.from(this.technicians.values())
      .filter((t) => t.maId === maId)
      .map((t) => ({ ...t }));
  }

  public async getTechnicianById(id: string): Promise<Technician | undefined> {
    const t = this.technicians.get(id);
    return t ? { ...t } : undefined;
  }

  public async updateTechnician(id: string, update: Partial<Technician>): Promise<Technician> {
    const tech = this.technicians.get(id);
    if (!tech) throw new NotFoundError(`Técnico ${id} não encontrado.`);
    const updated = { ...tech, ...update };
    this.technicians.set(id, updated);
    return { ...updated };
  }

  // Lots
  public async createLot(lot: MigrationLot): Promise<MigrationLot> {
    this.lots.set(lot.id, { ...lot });
    return { ...lot };
  }

  public async getLotById(id: string): Promise<MigrationLot | undefined> {
    const l = this.lots.get(id);
    return l ? { ...l } : undefined;
  }

  public async listLots(maId?: string): Promise<MigrationLot[]> {
    const all = Array.from(this.lots.values());
    return (maId ? all.filter((l) => l.maId === maId) : all).map((l) => ({ ...l }));
  }

  public async updateLot(id: string, update: Partial<MigrationLot>): Promise<MigrationLot> {
    const lot = this.lots.get(id);
    if (!lot) throw new NotFoundError(`Lote ${id} não encontrado.`);
    const updated = { ...lot, ...update, updatedAt: new Date().toISOString() };
    this.lots.set(id, updated);
    return { ...updated };
  }

  // Items
  public async createItem(item: MigrationItem): Promise<MigrationItem> {
    this.items.set(item.id, { ...item });
    return { ...item };
  }

  public async createItems(items: MigrationItem[]): Promise<number> {
    for (const item of items) {
      this.items.set(item.id, { ...item });
    }
    return items.length;
  }

  public async getItemById(id: string): Promise<MigrationItem | undefined> {
    const item = this.items.get(id);
    return item ? { ...item } : undefined;
  }

  public async getItemByExternalId(maId: string, externalCustomerId: string): Promise<MigrationItem | undefined> {
    for (const item of this.items.values()) {
      if (item.maId === maId && item.externalCustomerId === externalCustomerId) {
        return { ...item };
      }
    }
    return undefined;
  }

  public async listItems(options: ItemFilterOptions): Promise<{ items: MigrationItem[]; total: number }> {
    let list = Array.from(this.items.values());

    if (options.maId) {
      list = list.filter((i) => i.maId === options.maId);
    }
    if (options.lotId) {
      list = list.filter((i) => i.lotId === options.lotId);
    }
    if (options.status) {
      if (options.status === 'UNSCHEDULED') {
        list = list.filter((i) => i.migrationStatus === 'OS_CREATED' || (!i.scheduledDate && !!i.osId));
      } else {
        list = list.filter((i) => i.migrationStatus === options.status);
      }
    }
    if (options.targetBoxId) {
      list = list.filter((i) => i.targetBoxId === options.targetBoxId);
    }
    if (options.originBoxId) {
      list = list.filter((i) => i.originBoxId === options.originBoxId);
    }
    if (options.municipality) {
      list = list.filter((i) => i.city.toLowerCase() === options.municipality!.toLowerCase());
    }
    if (options.neighborhood) {
      list = list.filter((i) => (i.neighborhood || '').toLowerCase().includes(options.neighborhood!.toLowerCase()));
    }
    if (options.search) {
      const q = options.search.toLowerCase();
      list = list.filter(
        (i) =>
          i.customerName.toLowerCase().includes(q) ||
          i.externalCustomerId.toLowerCase().includes(q) ||
          i.ontSerialEffective.toLowerCase().includes(q) ||
          i.rawAddress.toLowerCase().includes(q) ||
          (i.osId && i.osId.toLowerCase().includes(q))
      );
    }

    if (options.hasOs !== undefined) {
      if (options.hasOs) {
        list = list.filter(
          (i) =>
            (!!i.osId || !!i.crmOrderId) &&
            !['ADDRESS_EXCEPTION', 'NOT_VIABLE', 'IMPORTED', 'PREPARING'].includes(i.migrationStatus)
        );
      } else {
        list = list.filter((i) => !i.osId && !i.crmOrderId);
      }
    }

    const total = list.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    const paged = list.slice(offset, offset + limit).map((i) => ({ ...i }));

    return { items: paged, total };
  }

  public async updateItem(id: string, update: Partial<MigrationItem>): Promise<MigrationItem> {
    const item = this.items.get(id);
    if (!item) throw new NotFoundError(`Item ${id} não encontrado.`);
    const updated = { ...item, ...update, updatedAt: new Date().toISOString() };
    this.items.set(id, updated);
    return { ...updated };
  }

  public async getItemsByBox(targetBoxId: string): Promise<MigrationItem[]> {
    return Array.from(this.items.values())
      .filter((i) => i.targetBoxId === targetBoxId)
      .map((i) => ({ ...i }));
  }

  public async getItemsByOriginBox(originBoxId: string): Promise<MigrationItem[]> {
    return Array.from(this.items.values())
      .filter((i) => i.originBoxId === originBoxId)
      .map((i) => ({ ...i }));
  }

  // Schedules (CDO/CDOI)
  public async getBoxSchedule(maId: string, targetBoxId: string): Promise<BoxSchedule | undefined> {
    const key = `${maId}:${targetBoxId}`;
    const s = this.schedules.get(key);
    return s ? { ...s } : undefined;
  }

  public async getBoxScheduleById(id: string): Promise<BoxSchedule | undefined> {
    for (const s of this.schedules.values()) {
      if (s.id === id) return { ...s };
    }
    return undefined;
  }

  public async saveBoxSchedule(schedule: BoxSchedule): Promise<BoxSchedule> {
    const key = `${schedule.maId}:${schedule.targetBoxId}`;
    this.schedules.set(key, { ...schedule });
    return { ...schedule };
  }

  public async listBoxSchedules(options: BoxFilterOptions): Promise<{ schedules: BoxSchedule[]; total: number }> {
    let list = Array.from(this.schedules.values());

    if (options.maId) {
      list = list.filter((s) => s.maId === options.maId);
    }
    if (options.status) {
      list = list.filter((s) => s.scheduleStatus === options.status);
    }
    if (options.municipality) {
      list = list.filter((s) => s.municipality.toLowerCase() === options.municipality!.toLowerCase());
    }
    if (options.neighborhood) {
      list = list.filter((s) => s.neighborhood.toLowerCase().includes(options.neighborhood!.toLowerCase()));
    }
    if (options.search) {
      const q = options.search.toLowerCase();
      list = list.filter((s) => s.targetBoxId.toLowerCase().includes(q) || s.neighborhood.toLowerCase().includes(q));
    }

    const total = list.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    const paged = list.slice(offset, offset + limit).map((s) => ({ ...s }));

    return { schedules: paged, total };
  }

  public async cancelBoxSchedule(id: string): Promise<BoxSchedule> {
    let targetSched: BoxSchedule | undefined;
    for (const s of this.schedules.values()) {
      if (s.id === id) {
        targetSched = s;
        break;
      }
    }
    if (!targetSched) throw new NotFoundError(`Agendamento de CDO ${id} não encontrado.`);

    targetSched.scheduleStatus = 'AVAILABLE';
    targetSched.scheduledDate = undefined;
    targetSched.technicianId = undefined;
    targetSched.technicianName = undefined;
    targetSched.updatedAt = new Date().toISOString();
    targetSched.updatedBy = 'OPERATOR';

    for (const item of this.items.values()) {
      if (item.targetBoxId === targetSched.targetBoxId && item.migrationStatus === 'SCHEDULED') {
        item.migrationStatus = 'OS_CREATED';
        item.scheduledDate = undefined;
        item.technicianId = undefined;
        item.updatedAt = new Date().toISOString();
      }
    }

    return { ...targetSched };
  }

  public async addScheduleHistory(history: BoxScheduleHistory): Promise<void> {
    this.scheduleHistories.push({ ...history });
  }

  public async getScheduleHistory(scheduleId: string): Promise<BoxScheduleHistory[]> {
    return this.scheduleHistories.filter((h) => h.scheduleId === scheduleId).map((h) => ({ ...h }));
  }

  // Serial Change Audit
  public async recordSerialChange(change: SerialChange): Promise<void> {
    this.serialChanges.push({ ...change });
  }

  public async listSerialChanges(itemId: string): Promise<SerialChange[]> {
    return this.serialChanges.filter((sc) => sc.itemId === itemId).map((sc) => ({ ...sc }));
  }

  // Batches
  public async createOsBatch(batch: OsBatch): Promise<OsBatch> {
    this.osBatches.set(batch.id, { ...batch });
    return { ...batch };
  }

  public async getOsBatch(id: string): Promise<OsBatch | undefined> {
    const b = this.osBatches.get(id);
    return b ? { ...b } : undefined;
  }

  public async updateOsBatch(id: string, update: Partial<OsBatch>): Promise<OsBatch> {
    const b = this.osBatches.get(id);
    if (!b) throw new NotFoundError(`Batch ${id} não encontrado.`);
    const updated = { ...b, ...update };
    this.osBatches.set(id, updated);
    return { ...updated };
  }

  public async createCutoverBatch(batch: CutoverBatch): Promise<CutoverBatch> {
    this.cutoverBatches.set(batch.id, { ...batch });
    return { ...batch };
  }

  public async getCutoverBatch(id: string): Promise<CutoverBatch | undefined> {
    const b = this.cutoverBatches.get(id);
    return b ? { ...b } : undefined;
  }

  public async updateCutoverBatch(id: string, update: Partial<CutoverBatch>): Promise<CutoverBatch> {
    const b = this.cutoverBatches.get(id);
    if (!b) throw new NotFoundError(`CutoverBatch ${id} não encontrado.`);
    const updated = { ...b, ...update };
    this.cutoverBatches.set(id, updated);
    return { ...updated };
  }

  public async createCutoverItem(item: CutoverItem): Promise<CutoverItem> {
    this.cutoverItems.push({ ...item });
    return { ...item };
  }

  public async listCutoverItems(batchId: string): Promise<CutoverItem[]> {
    return this.cutoverItems.filter((i) => i.cutoverBatchId === batchId).map((i) => ({ ...i }));
  }

  // Rollback
  public async createRollback(rollback: Rollback): Promise<Rollback> {
    this.rollbacks.set(rollback.id, { ...rollback });
    return { ...rollback };
  }

  public async getRollbackByItemId(itemId: string): Promise<Rollback | undefined> {
    for (const rb of this.rollbacks.values()) {
      if (rb.itemId === itemId) return { ...rb };
    }
    return undefined;
  }

  public async listRollbacks(originBoxId?: string): Promise<Rollback[]> {
    const all = Array.from(this.rollbacks.values());
    return (originBoxId ? all.filter((r) => r.originBoxId === originBoxId) : all).map((r) => ({ ...r }));
  }

  // Audit
  public async recordAudit(log: AuditLog): Promise<void> {
    this.auditLogs.push({ ...log });
  }

  public async listAuditLogs(entityType?: string, entityId?: string): Promise<AuditLog[]> {
    let logs = this.auditLogs;
    if (entityType) logs = logs.filter((l) => l.entityType === entityType);
    if (entityId) logs = logs.filter((l) => l.entityId === entityId);
    return logs.map((l) => ({ ...l }));
  }

  // Metrics
  public async getDashboardMetrics(maId?: string): Promise<DashboardMetrics> {
    let allItems = Array.from(this.items.values());
    if (maId) {
      allItems = allItems.filter((i) => i.maId === maId);
    }

    const totalAcquired = allItems.length;
    const totalInCrm = allItems.filter((i) => !!i.crmOrderId).length;
    const totalInOriginNetwork = totalAcquired;
    const totalSanitized = allItems.filter((i) => !['IMPORTED', 'PREPARING', 'ADDRESS_EXCEPTION'].includes(i.migrationStatus)).length;
    const totalViable = allItems.filter((i) => !['IMPORTED', 'PREPARING', 'ADDRESS_EXCEPTION', 'NOT_VIABLE'].includes(i.migrationStatus)).length;
    const totalOsOpen = allItems.filter((i) => ['OS_CREATED', 'SCHEDULED', 'IN_FIELD', 'ACTIVATING', 'SERIAL_EXCEPTION'].includes(i.migrationStatus)).length;
    const totalOsCreated = totalOsOpen;
    const todayStr = new Date().toISOString().substring(0, 10);
    const totalInField = allItems.filter((i) =>
      ['IN_FIELD', 'ACTIVATING'].includes(i.migrationStatus) ||
      (i.migrationStatus === 'SCHEDULED' && i.scheduledDate === todayStr)
    ).length;
    const totalScheduled = allItems.filter((i) =>
      i.migrationStatus === 'SCHEDULED' && (!i.scheduledDate || i.scheduledDate !== todayStr)
    ).length;
    const totalMigrated = allItems.filter((i) => i.migrationStatus === 'MIGRATED').length;
    const totalExceptions = allItems.filter((i) => ['ADDRESS_EXCEPTION', 'NOT_VIABLE', 'SERIAL_EXCEPTION', 'MIGRATION_FAILED'].includes(i.migrationStatus)).length;
    const totalRollbacks = allItems.filter((i) => ['ROLLBACK_REQUESTED', 'ROLLBACK_IN_PROGRESS', 'ROLLED_BACK'].includes(i.migrationStatus)).length;

    const migrationPercentage = totalAcquired > 0 ? Math.round((totalMigrated / totalAcquired) * 100) : 0;

    // Caixas liberadas (100% migradas)
    const decommissionBoxes = await this.listDecommissionBoxes(maId);
    const releasableOriginBoxes = decommissionBoxes.filter((b) => b.releaseStatus === 'READY_FOR_RELEASE').length;
    const monthlySavingsProjected = releasableOriginBoxes * 180.0;

    return {
      totalAcquired,
      totalInCrm,
      totalInOriginNetwork,
      totalSanitized,
      totalViable,
      totalOsCreated,
      totalOsOpen,
      totalScheduled,
      totalInField,
      totalMigrated,
      totalExceptions,
      totalRollbacks,
      migrationPercentage,
      releasableOriginBoxes,
      monthlySavingsProjected,
      funnel: {
        imported: totalAcquired,
        sanitized: totalSanitized,
        viable: totalViable,
        osCreated: totalOsCreated,
        scheduled: totalScheduled,
        inField: totalInField,
        migrated: totalMigrated,
      },
    };
  }

  public async listDecommissionBoxes(maId?: string): Promise<DecommissionBoxMetric[]> {
    let allItems = Array.from(this.items.values());
    if (maId) {
      allItems = allItems.filter((i) => i.maId === maId);
    }

    const boxMap = new Map<string, { originBoxId: string; originProvider: string; items: MigrationItem[] }>();

    for (const item of allItems) {
      if (!boxMap.has(item.originBoxId)) {
        boxMap.set(item.originBoxId, {
          originBoxId: item.originBoxId,
          originProvider: item.originProvider,
          items: [],
        });
      }
      boxMap.get(item.originBoxId)!.items.push(item);
    }

    const result: DecommissionBoxMetric[] = [];

    for (const group of boxMap.values()) {
      const total = group.items.length;
      const migrated = group.items.filter((i) => i.migrationStatus === 'MIGRATED').length;
      const rollbacks = group.items.filter((i) => ['ROLLBACK_REQUESTED', 'ROLLBACK_IN_PROGRESS', 'ROLLED_BACK'].includes(i.migrationStatus)).length;
      const pending = group.items.filter((i) => !['MIGRATED', 'ROLLED_BACK', 'ROLLBACK_REQUESTED', 'ROLLBACK_IN_PROGRESS'].includes(i.migrationStatus)).length;

      let releaseStatus: BoxReleaseStatus = 'NOT_READY';
      if (rollbacks > 0) {
        releaseStatus = 'BLOCKED_BY_ROLLBACK';
      } else if (migrated === total && total > 0) {
        releaseStatus = 'READY_FOR_RELEASE';
      } else if (migrated > 0) {
        releaseStatus = 'PARTIALLY_MIGRATED';
      }

      result.push({
        originBoxId: group.originBoxId,
        originProvider: group.originProvider,
        totalCustomers: total,
        migratedCustomers: migrated,
        pendingCustomers: pending,
        releaseStatus,
        monthlyRentalCostSaved: releaseStatus === 'READY_FOR_RELEASE' ? 180.0 : 0,
      });
    }

    return result;
  }

  public async getStrategicOverview(): Promise<StrategicOverviewItem[]> {
    const list: StrategicOverviewItem[] = [];
    for (const ma of this.mas.values()) {
      const metrics = await this.getDashboardMetrics(ma.id);
      list.push({
        maId: ma.id,
        maName: ma.name,
        originProvider: ma.originProvider,
        uf: ma.uf,
        status: ma.status,
        startDate: ma.startDate,
        ma: { ...ma },
        totalCustomers: metrics.totalAcquired,
        totalSanitized: metrics.totalSanitized,
        totalViable: metrics.totalViable,
        totalOsCreated: metrics.totalOsOpen ?? metrics.totalOsCreated,
        totalOsOpen: metrics.totalOsOpen ?? metrics.totalOsCreated,
        totalScheduled: metrics.totalScheduled,
        totalInField: metrics.totalInField,
        totalMigrated: metrics.totalMigrated,
        totalExceptions: metrics.totalExceptions,
        totalRollbacks: metrics.totalRollbacks,
        migrationPercentage: metrics.migrationPercentage,
        releasableBoxes: metrics.releasableOriginBoxes,
        monthlySavings: metrics.monthlySavingsProjected,
      });
    }
    return list;
  }
}
