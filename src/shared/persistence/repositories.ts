export type * from '../domain/types.js';
import type {
  AuditLog,
  BoxReleaseStatus,
  BoxSchedule,
  BoxScheduleHistory,
  CutoverBatch,
  CutoverItem,
  DashboardMetrics,
  DecommissionBoxMetric,
  Ma,
  MigrationItem,
  MigrationLot,
  MigrationStatus,
  OsBatch,
  Rollback,
  SerialChange,
  StrategicOverviewItem,
  Technician,
} from '../domain/types.js';

export interface ItemFilterOptions {
  maId?: string;
  lotId?: string;
  status?: MigrationStatus | string;
  targetBoxId?: string;
  originBoxId?: string;
  municipality?: string;
  neighborhood?: string;
  search?: string;
  limit?: number;
  offset?: number;
  hasOs?: boolean;
}

export interface BoxFilterOptions {
  maId?: string;
  municipality?: string;
  neighborhood?: string;
  search?: string;
  status?: string;
  limit?: number;
  offset?: number;
}


export interface MigrationRepository {
  // M&A
  createMa(ma: Ma): Promise<Ma>;
  getMaById(id: string): Promise<Ma | undefined>;
  listMas(): Promise<Ma[]>;
  updateMa(id: string, update: Partial<Ma>): Promise<Ma>;
  deleteMa(id: string): Promise<boolean>;

  // Technicians (vinculados ao M&A)
  createTechnician(tech: Technician): Promise<Technician>;
  listTechnicians(maId: string): Promise<Technician[]>;
  getTechnicianById(id: string): Promise<Technician | undefined>;
  updateTechnician(id: string, update: Partial<Technician>): Promise<Technician>;

  // Lots
  createLot(lot: MigrationLot): Promise<MigrationLot>;
  getLotById(id: string): Promise<MigrationLot | undefined>;
  listLots(maId?: string): Promise<MigrationLot[]>;
  updateLot(id: string, update: Partial<MigrationLot>): Promise<MigrationLot>;

  // Migration Items
  createItem(item: MigrationItem): Promise<MigrationItem>;
  createItems(items: MigrationItem[]): Promise<number>;
  getItemById(id: string): Promise<MigrationItem | undefined>;
  getItemByExternalId(maId: string, externalCustomerId: string): Promise<MigrationItem | undefined>;
  listItems(options: ItemFilterOptions): Promise<{ items: MigrationItem[]; total: number }>;
  updateItem(id: string, update: Partial<MigrationItem>): Promise<MigrationItem>;
  getItemsByBox(targetBoxId: string): Promise<MigrationItem[]>;
  getItemsByOriginBox(originBoxId: string): Promise<MigrationItem[]>;

  // Schedules (CDO/CDOI)
  getBoxSchedule(maId: string, targetBoxId: string): Promise<BoxSchedule | undefined>;
  getBoxScheduleById(id: string): Promise<BoxSchedule | undefined>;
  saveBoxSchedule(schedule: BoxSchedule): Promise<BoxSchedule>;
  listBoxSchedules(options: BoxFilterOptions): Promise<{ schedules: BoxSchedule[]; total: number }>;
  cancelBoxSchedule(id: string): Promise<BoxSchedule>;
  addScheduleHistory(history: BoxScheduleHistory): Promise<void>;
  getScheduleHistory(scheduleId: string): Promise<BoxScheduleHistory[]>;

  // Serial Change Audit
  recordSerialChange(change: SerialChange): Promise<void>;
  listSerialChanges(itemId: string): Promise<SerialChange[]>;

  // Batches
  createOsBatch(batch: OsBatch): Promise<OsBatch>;
  getOsBatch(id: string): Promise<OsBatch | undefined>;
  updateOsBatch(id: string, update: Partial<OsBatch>): Promise<OsBatch>;

  createCutoverBatch(batch: CutoverBatch): Promise<CutoverBatch>;
  getCutoverBatch(id: string): Promise<CutoverBatch | undefined>;
  updateCutoverBatch(id: string, update: Partial<CutoverBatch>): Promise<CutoverBatch>;
  createCutoverItem(item: CutoverItem): Promise<CutoverItem>;
  listCutoverItems(batchId: string): Promise<CutoverItem[]>;

  // Rollback
  createRollback(rollback: Rollback): Promise<Rollback>;
  getRollbackByItemId(itemId: string): Promise<Rollback | undefined>;
  listRollbacks(originBoxId?: string): Promise<Rollback[]>;

  // Audit
  recordAudit(log: AuditLog): Promise<void>;
  listAuditLogs(entityType?: string, entityId?: string): Promise<AuditLog[]>;

  // Metrics & Aggregations
  getDashboardMetrics(maId?: string): Promise<DashboardMetrics>;
  getStrategicOverview(): Promise<StrategicOverviewItem[]>;
  listDecommissionBoxes(maId?: string): Promise<DecommissionBoxMetric[]>;
}
