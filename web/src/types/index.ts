export type MigrationStatus =
  | 'IMPORTED'
  | 'PREPARING'
  | 'ADDRESS_EXCEPTION'
  | 'NOT_VIABLE'
  | 'READY'
  | 'AUTHORIZED'
  | 'OS_CREATING'
  | 'OS_CREATED'
  | 'SCHEDULED'
  | 'IN_FIELD'
  | 'SERIAL_EXCEPTION'
  | 'ACTIVATING'
  | 'MIGRATED'
  | 'MIGRATION_FAILED'
  | 'ROLLBACK_REQUESTED'
  | 'ROLLBACK_IN_PROGRESS'
  | 'ROLLED_BACK';

export type ScheduleStatus =
  | 'AVAILABLE'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'BLOCKED';

export type BoxReleaseStatus =
  | 'NOT_READY'
  | 'PARTIALLY_MIGRATED'
  | 'READY_FOR_RELEASE'
  | 'BLOCKED_BY_ROLLBACK'
  | 'RELEASED';

export type MaStatus = 'ACTIVE' | 'NEGOTIATION' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';

export interface Ma {
  id: string;
  name: string;
  originProvider: string;
  description?: string;
  startDate: string;
  status: MaStatus;
  uf: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface Technician {
  id: string;
  maId: string;
  externalTechId: string;
  name: string;
  vendorCompany: string;
  city: string;
  uf: string;
  dailyCapacity: number;
  status: 'ACTIVE' | 'INACTIVE';
  joinedAt: string;
  leftAt?: string;
  createdAt: string;
}

export type LotStatus =
  | 'RECEIVED'
  | 'SANITIZING'
  | 'ANALYZING_VIABILITY'
  | 'OPENING_OS'
  | 'COMPLETED'
  | 'FAILED'
  | 'PENDING'
  | 'PROCESSING';

export interface MigrationLot {
  id: string;
  maId: string;
  fileName: string;
  totalRecords: number;
  validRecords: number;
  rejectedRecords: number;
  duplicateRecords: number;
  importStatus: LotStatus;
  importedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface MigrationItem {
  id: string;
  maId: string;
  lotId: string;
  batchId?: string;

  customerId: string;
  externalCustomerId: string;
  subscriptionId: string;
  customerName: string;

  rawAddress: string;
  cep: string;
  street?: string;
  streetNr?: string;
  complement?: string;
  neighborhood?: string;
  city: string;
  stateOrUf: string;
  geographicAddressId?: string;
  addressMatchScore?: number;
  viabilityId?: string;
  viabilityStatus?: string;

  originProvider: string;
  originAccessId?: string;
  originBoxId: string;

  targetInventoryId?: string;
  targetHcId?: string;
  targetBoxId?: string;
  targetBoxType?: 'CDO' | 'CDOI' | string;

  ontSerialOriginal: string;
  ontSerialEffective: string;

  crmOrderId?: string;
  osId?: string;
  saId?: string;
  osCreationStatus?: string;
  saCreationStatus?: string;

  migrationStatus: MigrationStatus;

  scheduledDate?: string;
  technicianId?: string;

  errorStage?: string;
  errorCode?: string;
  errorDescription?: string;

  createdAt: string;
  updatedAt: string;
  preparedAt?: string;
  scheduledAt?: string;
  migratedAt?: string;
}

export interface BoxSchedule {
  id: string;
  maId: string;
  targetBoxId: string;
  targetBoxType: 'CDO' | 'CDOI' | string;
  municipality: string;
  neighborhood: string;
  totalCustomers: number;
  totalOrders: number;
  scheduleStatus: ScheduleStatus;
  scheduledDate?: string;
  technicianId?: string;
  technicianName?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface DashboardMetrics {
  totalAcquired: number;
  totalInCrm: number;
  totalInOriginNetwork: number;
  totalSanitized: number;
  totalViable: number;
  totalOsCreated: number;
  totalOsOpen?: number;
  totalScheduled: number;
  totalInField: number;
  totalMigrated: number;
  totalExceptions: number;
  totalRollbacks: number;
  migrationPercentage: number;
  releasableOriginBoxes: number;
  monthlySavingsProjected: number;
  funnel: {
    imported: number;
    sanitized: number;
    viable: number;
    osCreated: number;
    scheduled: number;
    inField: number;
    migrated: number;
  };
}

export interface DecommissionBoxMetric {
  originBoxId: string;
  originProvider: string;
  maId: string;
  totalCustomers: number;
  migratedCustomers: number;
  pendingCustomers: number;
  rollbackCustomers: number;
  releaseStatus: BoxReleaseStatus;
}

export interface StrategicOverviewItem {
  maId: string;
  maName: string;
  originProvider: string;
  uf: string;
  status: string;
  startDate: string;
  ma?: Ma;
  totalCustomers: number;
  totalSanitized: number;
  totalViable: number;
  totalOsCreated: number;
  totalOsOpen?: number;
  totalScheduled: number;
  totalInField: number;
  totalMigrated: number;
  totalExceptions: number;
  migrationPercentage: number;
}
