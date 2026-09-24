import oracledb from 'oracledb';
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
import { AppError, NotFoundError } from '../errors/app-error.js';

export interface OracleConfig {
  connectString: string;
  user: string;
  password: string;
  prefix?: string;
  poolMin?: number;
  poolMax?: number;
}

export class OracleMigrationRepository implements MigrationRepository {
  private pool: oracledb.Pool | null = null;
  private readonly config: OracleConfig;
  private readonly prefix: string;

  constructor(config: OracleConfig) {
    this.config = config;
    this.prefix = config.prefix || 'NW_';
  }

  private table(name: string): string {
    return `${this.prefix}${name}`;
  }

  private async getPool(): Promise<oracledb.Pool> {
    if (this.pool) return this.pool;
    this.pool = await oracledb.createPool({
      connectString: this.config.connectString,
      user: this.config.user,
      password: this.config.password,
      poolMin: this.config.poolMin || 1,
      poolMax: this.config.poolMax || 5,
    });
    return this.pool;
  }

  private async withConnection<T>(fn: (conn: oracledb.Connection) => Promise<T>): Promise<T> {
    const pool = await this.getPool();
    const conn = await pool.getConnection();
    try {
      return await fn(conn);
    } finally {
      await conn.close();
    }
  }

  // M&A
  public async createMa(ma: Ma): Promise<Ma> {
    return this.withConnection(async (conn) => {
      const sql = `
        INSERT INTO ${this.table('MA')} (
          ID, NAME, ORIGIN_PROVIDER, DESCRIPTION, START_DATE, STATUS, UF, CREATED_AT, CREATED_BY, UPDATED_AT
        ) VALUES (
          :id, :name, :originProvider, :description, TO_DATE(:startDate, 'YYYY-MM-DD'), :status, :uf, CURRENT_TIMESTAMP, :createdBy, CURRENT_TIMESTAMP
        )`;
      await conn.execute(sql, {
        id: ma.id,
        name: ma.name,
        originProvider: ma.originProvider,
        description: ma.description ?? null,
        startDate: ma.startDate.substring(0, 10),
        status: ma.status,
        uf: ma.uf,
        createdBy: ma.createdBy,
      }, { autoCommit: true });
      return ma;
    });
  }

  public async getMaById(id: string): Promise<Ma | undefined> {
    return this.withConnection(async (conn) => {
      const result = await conn.execute<any>(
        `SELECT ID, NAME, ORIGIN_PROVIDER, DESCRIPTION, TO_CHAR(START_DATE, 'YYYY-MM-DD') AS START_DATE, STATUS, UF, TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT, CREATED_BY, TO_CHAR(UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT FROM ${this.table('MA')} WHERE ID = :id`,
        [id],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const row = result.rows?.[0];
      if (!row) return undefined;
      return {
        id: row.ID,
        name: row.NAME,
        originProvider: row.ORIGIN_PROVIDER,
        description: row.DESCRIPTION,
        startDate: row.START_DATE,
        status: row.STATUS,
        uf: row.UF,
        createdAt: row.CREATED_AT,
        createdBy: row.CREATED_BY,
        updatedAt: row.UPDATED_AT,
      };
    });
  }

  public async listMas(): Promise<Ma[]> {
    return this.withConnection(async (conn) => {
      const result = await conn.execute<any>(
        `SELECT ID, NAME, ORIGIN_PROVIDER, DESCRIPTION, TO_CHAR(START_DATE, 'YYYY-MM-DD') AS START_DATE, STATUS, UF, TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT, CREATED_BY, TO_CHAR(UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT FROM ${this.table('MA')} ORDER BY CREATED_AT DESC`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return (result.rows || []).map((row) => ({
        id: row.ID,
        name: row.NAME,
        originProvider: row.ORIGIN_PROVIDER,
        description: row.DESCRIPTION,
        startDate: row.START_DATE,
        status: row.STATUS,
        uf: row.UF,
        createdAt: row.CREATED_AT,
        createdBy: row.CREATED_BY,
        updatedAt: row.UPDATED_AT,
      }));
    });
  }

  public async updateMa(id: string, update: Partial<Ma>): Promise<Ma> {
    const existing = await this.getMaById(id);
    if (!existing) throw new NotFoundError(`M&A ${id} não encontrado.`);

    return this.withConnection(async (conn) => {
      await conn.execute(
        `UPDATE ${this.table('MA')}
         SET NAME = NVL(:name, NAME),
             ORIGIN_PROVIDER = NVL(:originProvider, ORIGIN_PROVIDER),
             DESCRIPTION = NVL(:description, DESCRIPTION),
             UF = NVL(:uf, UF),
             STATUS = NVL(:status, STATUS),
             UPDATED_AT = CURRENT_TIMESTAMP
         WHERE ID = :id`,
        {
          id,
          name: update.name ?? null,
          originProvider: update.originProvider ?? null,
          description: update.description ?? null,
          uf: update.uf ?? null,
          status: update.status ?? null,
        },
        { autoCommit: true }
      );
      return (await this.getMaById(id))!;
    });
  }

  public async deleteMa(id: string): Promise<boolean> {
    const existing = await this.getMaById(id);
    if (!existing) throw new NotFoundError(`M&A ${id} não encontrado.`);

    return this.withConnection(async (conn) => {
      await conn.execute(
        `UPDATE ${this.table('MA')} SET STATUS = 'CANCELLED', UPDATED_AT = CURRENT_TIMESTAMP WHERE ID = :id`,
        { id },
        { autoCommit: true }
      );
      return true;
    });
  }

  // Technicians
  public async createTechnician(tech: Technician): Promise<Technician> {
    return this.withConnection(async (conn) => {
      const sql = `
        INSERT INTO ${this.table('TECHNICIAN')} (
          ID, MA_ID, EXTERNAL_TECH_ID, NAME, VENDOR_COMPANY, CITY, UF, DAILY_CAPACITY, STATUS, JOINED_AT, CREATED_AT
        ) VALUES (
          :id, :maId, :externalTechId, :name, :vendor, :city, :uf, :capacity, :status, TO_DATE(:joinedAt, 'YYYY-MM-DD'), CURRENT_TIMESTAMP
        )`;
      await conn.execute(sql, {
        id: tech.id,
        maId: tech.maId,
        externalTechId: tech.externalTechId,
        name: tech.name,
        vendor: tech.vendorCompany,
        city: tech.city,
        uf: tech.uf,
        capacity: tech.dailyCapacity,
        status: tech.status,
        joinedAt: tech.joinedAt.substring(0, 10),
      }, { autoCommit: true });
      return tech;
    });
  }

  public async getTechnicianById(id: string): Promise<Technician | undefined> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT ID, MA_ID, EXTERNAL_TECH_ID, NAME, VENDOR_COMPANY, CITY, UF, DAILY_CAPACITY, STATUS, TO_CHAR(JOINED_AT, 'YYYY-MM-DD') AS JOINED_AT, TO_CHAR(LEFT_AT, 'YYYY-MM-DD') AS LEFT_AT, TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT FROM ${this.table('TECHNICIAN')} WHERE ID = :id`,
        [id],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const r = res.rows?.[0];
      if (!r) return undefined;
      return {
        id: r.ID,
        maId: r.MA_ID,
        externalTechId: r.EXTERNAL_TECH_ID,
        name: r.NAME,
        vendorCompany: r.VENDOR_COMPANY,
        city: r.CITY,
        uf: r.UF,
        dailyCapacity: r.DAILY_CAPACITY,
        status: r.STATUS,
        joinedAt: r.JOINED_AT,
        leftAt: r.LEFT_AT,
        createdAt: r.CREATED_AT,
      };
    });
  }

  public async listTechnicians(maId: string): Promise<Technician[]> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT ID, MA_ID, EXTERNAL_TECH_ID, NAME, VENDOR_COMPANY, CITY, UF, DAILY_CAPACITY, STATUS, TO_CHAR(JOINED_AT, 'YYYY-MM-DD') AS JOINED_AT, TO_CHAR(LEFT_AT, 'YYYY-MM-DD') AS LEFT_AT, TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT FROM ${this.table('TECHNICIAN')} WHERE MA_ID = :maId ORDER BY NAME ASC`,
        [maId],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return (res.rows || []).map((r) => ({
        id: r.ID,
        maId: r.MA_ID,
        externalTechId: r.EXTERNAL_TECH_ID,
        name: r.NAME,
        vendorCompany: r.VENDOR_COMPANY,
        city: r.CITY,
        uf: r.UF,
        dailyCapacity: r.DAILY_CAPACITY,
        status: r.STATUS,
        joinedAt: r.JOINED_AT,
        leftAt: r.LEFT_AT,
        createdAt: r.CREATED_AT,
      }));
    });
  }

  public async updateTechnician(id: string, update: Partial<Technician>): Promise<Technician> {
    const existing = await this.getTechnicianById(id);
    if (!existing) throw new NotFoundError(`Técnico ${id} não encontrado.`);

    return this.withConnection(async (conn) => {
      await conn.execute(
        `UPDATE ${this.table('TECHNICIAN')}
            SET EXTERNAL_TECH_ID = NVL(:externalTechId, EXTERNAL_TECH_ID),
                NAME = NVL(:name, NAME),
                VENDOR_COMPANY = NVL(:vendorCompany, VENDOR_COMPANY),
                CITY = NVL(:city, CITY),
                UF = NVL(:uf, UF),
                DAILY_CAPACITY = NVL(:dailyCapacity, DAILY_CAPACITY),
                STATUS = NVL(:status, STATUS)
          WHERE ID = :id`,
        {
          id,
          externalTechId: update.externalTechId ?? null,
          name: update.name ?? null,
          vendorCompany: update.vendorCompany ?? null,
          city: update.city ?? null,
          uf: update.uf ?? null,
          dailyCapacity: update.dailyCapacity ?? null,
          status: update.status ?? null,
        },
        { autoCommit: true }
      );
      return (await this.getTechnicianById(id))!;
    });
  }

  // Lots
  public async createLot(lot: MigrationLot): Promise<MigrationLot> {
    return this.withConnection(async (conn) => {
      const sql = `
        INSERT INTO ${this.table('MIGRATION_LOT')} (
          ID, MA_ID, FILE_NAME, TOTAL_RECORDS, VALID_RECORDS, REJECTED_RECORDS, DUPLICATE_RECORDS, IMPORT_STATUS, IMPORTED_BY, CREATED_AT, UPDATED_AT
        ) VALUES (
          :id, :maId, :fileName, :total, :valid, :rejected, :dup, :status, :importedBy, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`;
      await conn.execute(sql, {
        id: lot.id,
        maId: lot.maId,
        fileName: lot.fileName,
        total: lot.totalRecords,
        valid: lot.validRecords,
        rejected: lot.rejectedRecords,
        dup: lot.duplicateRecords,
        status: lot.importStatus,
        importedBy: lot.importedBy,
      }, { autoCommit: true });
      return lot;
    });
  }

  public async getLotById(id: string): Promise<MigrationLot | undefined> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT ID, MA_ID, FILE_NAME, TOTAL_RECORDS, VALID_RECORDS, REJECTED_RECORDS, DUPLICATE_RECORDS, IMPORT_STATUS, IMPORTED_BY, TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT, TO_CHAR(UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT FROM ${this.table('MIGRATION_LOT')} WHERE ID = :id`,
        [id],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const r = res.rows?.[0];
      if (!r) return undefined;
      return {
        id: r.ID,
        maId: r.MA_ID,
        fileName: r.FILE_NAME,
        totalRecords: r.TOTAL_RECORDS,
        validRecords: r.VALID_RECORDS,
        rejectedRecords: r.REJECTED_RECORDS,
        duplicateRecords: r.DUPLICATE_RECORDS,
        importStatus: r.IMPORT_STATUS,
        importedBy: r.IMPORTED_BY,
        createdAt: r.CREATED_AT,
        updatedAt: r.UPDATED_AT,
      };
    });
  }

  public async listLots(maId?: string): Promise<MigrationLot[]> {
    return this.withConnection(async (conn) => {
      const sql = maId
        ? `SELECT ID, MA_ID, FILE_NAME, TOTAL_RECORDS, VALID_RECORDS, REJECTED_RECORDS, DUPLICATE_RECORDS, IMPORT_STATUS, IMPORTED_BY, TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT, TO_CHAR(UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT FROM ${this.table('MIGRATION_LOT')} WHERE MA_ID = :maId ORDER BY CREATED_AT DESC`
        : `SELECT ID, MA_ID, FILE_NAME, TOTAL_RECORDS, VALID_RECORDS, REJECTED_RECORDS, DUPLICATE_RECORDS, IMPORT_STATUS, IMPORTED_BY, TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT, TO_CHAR(UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT FROM ${this.table('MIGRATION_LOT')} ORDER BY CREATED_AT DESC`;
      const binds = maId ? [maId] : [];
      const res = await conn.execute<any>(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (res.rows || []).map((r) => ({
        id: r.ID,
        maId: r.MA_ID,
        fileName: r.FILE_NAME,
        totalRecords: r.TOTAL_RECORDS,
        validRecords: r.VALID_RECORDS,
        rejectedRecords: r.REJECTED_RECORDS,
        duplicateRecords: r.DUPLICATE_RECORDS,
        importStatus: r.IMPORT_STATUS,
        importedBy: r.IMPORTED_BY,
        createdAt: r.CREATED_AT,
        updatedAt: r.UPDATED_AT,
      }));
    });
  }

  public async updateLot(id: string, update: Partial<MigrationLot>): Promise<MigrationLot> {
    return this.withConnection(async (conn) => {
      const sets: string[] = ['UPDATED_AT = CURRENT_TIMESTAMP'];
      const binds: Record<string, any> = { id };
      if (update.validRecords !== undefined) { sets.push('VALID_RECORDS = :valid'); binds.valid = update.validRecords; }
      if (update.rejectedRecords !== undefined) { sets.push('REJECTED_RECORDS = :rejected'); binds.rejected = update.rejectedRecords; }
      if (update.duplicateRecords !== undefined) { sets.push('DUPLICATE_RECORDS = :dup'); binds.dup = update.duplicateRecords; }
      if (update.importStatus !== undefined) { sets.push('IMPORT_STATUS = :status'); binds.status = update.importStatus; }

      await conn.execute(
        `UPDATE ${this.table('MIGRATION_LOT')} SET ${sets.join(', ')} WHERE ID = :id`,
        binds,
        { autoCommit: true }
      );
      const lot = await this.getLotById(id);
      if (!lot) throw new NotFoundError(`Lot ${id} not found`);
      return lot;
    });
  }

  // Items
  public async createItem(item: MigrationItem): Promise<MigrationItem> {
    await this.createItems([item]);
    return item;
  }

  public async createItems(items: MigrationItem[]): Promise<number> {
    if (items.length === 0) return 0;
    return this.withConnection(async (conn) => {
      const sql = `
        INSERT INTO ${this.table('MIGRATION_ITEM')} (
          ID, MA_ID, LOT_ID, BATCH_ID,
          CUSTOMER_ID, EXTERNAL_CUSTOMER_ID, SUBSCRIPTION_ID, CUSTOMER_NAME,
          RAW_ADDRESS, CEP, STREET, STREET_NR, COMPLEMENT, NEIGHBORHOOD, CITY, STATE_OR_UF,
          GEOGRAPHIC_ADDRESS_ID, ADDRESS_MATCH_SCORE, VIABILITY_ID, VIABILITY_STATUS,
          ORIGIN_PROVIDER, ORIGIN_ACCESS_ID, ORIGIN_BOX_ID,
          TARGET_INVENTORY_ID, TARGET_HC_ID, TARGET_BOX_ID, TARGET_BOX_TYPE,
          ONT_SERIAL_ORIGINAL, ONT_SERIAL_EFFECTIVE,
          CRM_ORDER_ID, OS_ID, SA_ID, OS_CREATION_STATUS, SA_CREATION_STATUS,
          MIGRATION_STATUS, SCHEDULED_DATE, TECHNICIAN_ID,
          ERROR_STAGE, ERROR_CODE, ERROR_DESCRIPTION,
          CREATED_AT, UPDATED_AT
        ) VALUES (
          :id, :maId, :lotId, :batchId,
          :customerId, :externalCustomerId, :subscriptionId, :customerName,
          :rawAddress, :cep, :street, :streetNr, :complement, :neighborhood, :city, :stateOrUf,
          :geographicAddressId, :addressMatchScore, :viabilityId, :viabilityStatus,
          :originProvider, :originAccessId, :originBoxId,
          :targetInventoryId, :targetHcId, :targetBoxId, :targetBoxType,
          :ontSerialOriginal, :ontSerialEffective,
          :crmOrderId, :osId, :saId, :osCreationStatus, :saCreationStatus,
          :migrationStatus, :scheduledDate, :technicianId,
          :errorStage, :errorCode, :errorDescription,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`;

      for (const item of items) {
        await conn.execute(sql, {
          id: item.id,
          maId: item.maId,
          lotId: item.lotId,
          batchId: item.batchId ?? null,
          customerId: item.customerId,
          externalCustomerId: item.externalCustomerId,
          subscriptionId: item.subscriptionId,
          customerName: item.customerName,
          rawAddress: item.rawAddress,
          cep: item.cep,
          street: item.street ?? null,
          streetNr: item.streetNr ?? null,
          complement: item.complement ?? null,
          neighborhood: item.neighborhood ?? null,
          city: item.city,
          stateOrUf: item.stateOrUf,
          geographicAddressId: item.geographicAddressId ?? null,
          addressMatchScore: item.addressMatchScore ?? null,
          viabilityId: item.viabilityId ?? null,
          viabilityStatus: item.viabilityStatus ?? null,
          originProvider: item.originProvider,
          originAccessId: item.originAccessId ?? null,
          originBoxId: item.originBoxId,
          targetInventoryId: item.targetInventoryId ?? null,
          targetHcId: item.targetHcId ?? null,
          targetBoxId: item.targetBoxId ?? null,
          targetBoxType: item.targetBoxType ?? null,
          ontSerialOriginal: item.ontSerialOriginal,
          ontSerialEffective: item.ontSerialEffective,
          crmOrderId: item.crmOrderId ?? null,
          osId: item.osId ?? null,
          saId: item.saId ?? null,
          osCreationStatus: item.osCreationStatus ?? null,
          saCreationStatus: item.saCreationStatus ?? null,
          migrationStatus: item.migrationStatus,
          scheduledDate: item.scheduledDate ? new Date(item.scheduledDate) : null,
          technicianId: item.technicianId ?? null,
          errorStage: item.errorStage ?? null,
          errorCode: item.errorCode ?? null,
          errorDescription: item.errorDescription ?? null,
        }, { autoCommit: false });
      }
      await conn.commit();
      return items.length;
    });
  }

  public async getItemById(id: string): Promise<MigrationItem | undefined> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT * FROM ${this.table('MIGRATION_ITEM')} WHERE ID = :id`,
        [id],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const r = res.rows?.[0];
      if (!r) return undefined;
      return this.mapItemRow(r);
    });
  }

  public async getItemByExternalId(maId: string, externalCustomerId: string): Promise<MigrationItem | undefined> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT * FROM ${this.table('MIGRATION_ITEM')} WHERE MA_ID = :maId AND EXTERNAL_CUSTOMER_ID = :extId`,
        { maId, extId: externalCustomerId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const r = res.rows?.[0];
      if (!r) return undefined;
      return this.mapItemRow(r);
    });
  }

  public async listItems(options: ItemFilterOptions): Promise<{ items: MigrationItem[]; total: number }> {
    return this.withConnection(async (conn) => {
      const conditions: string[] = ['1=1'];
      const binds: Record<string, any> = {};

      if (options.maId) {
        conditions.push('MA_ID = :maId');
        binds.maId = options.maId;
      }
      if (options.lotId) {
        conditions.push('LOT_ID = :lotId');
        binds.lotId = options.lotId;
      }
      if (options.status) {
        if (options.status === 'UNSCHEDULED') {
          conditions.push("(MIGRATION_STATUS = 'OS_CREATED' OR (OS_ID IS NOT NULL AND SCHEDULED_DATE IS NULL))");
        } else {
          conditions.push('MIGRATION_STATUS = :status');
          binds.status = options.status;
        }
      }
      if (options.targetBoxId) {
        conditions.push('TARGET_BOX_ID = :targetBoxId');
        binds.targetBoxId = options.targetBoxId;
      }
      if (options.originBoxId) {
        conditions.push('ORIGIN_BOX_ID = :originBoxId');
        binds.originBoxId = options.originBoxId;
      }
      if (options.municipality) {
        conditions.push('LOWER(CITY) = LOWER(:city)');
        binds.city = options.municipality;
      }
      if (options.neighborhood) {
        conditions.push('LOWER(NEIGHBORHOOD) LIKE LOWER(:neighborhood)');
        binds.neighborhood = `%${options.neighborhood}%`;
      }
      if (options.search) {
        conditions.push(`(
          LOWER(CUSTOMER_NAME) LIKE LOWER(:q) OR
          LOWER(EXTERNAL_CUSTOMER_ID) LIKE LOWER(:q) OR
          LOWER(ONT_SERIAL_EFFECTIVE) LIKE LOWER(:q) OR
          LOWER(RAW_ADDRESS) LIKE LOWER(:q) OR
          LOWER(OS_ID) LIKE LOWER(:q)
        )`);
        binds.q = `%${options.search}%`;
      }
      if (options.hasOs !== undefined) {
        if (options.hasOs) {
          conditions.push("(OS_ID IS NOT NULL OR CRM_ORDER_ID IS NOT NULL) AND MIGRATION_STATUS NOT IN ('ADDRESS_EXCEPTION', 'NOT_VIABLE', 'IMPORTED', 'PREPARING')");
        } else {
          conditions.push("(OS_ID IS NULL AND CRM_ORDER_ID IS NULL)");
        }
      }

      const whereClause = conditions.join(' AND ');

      // Total count
      const countRes = await conn.execute<any>(
        `SELECT COUNT(*) AS TOTAL FROM ${this.table('MIGRATION_ITEM')} WHERE ${whereClause}`,
        binds,
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const total = countRes.rows?.[0]?.TOTAL || 0;

      // Paged records
      const offset = options.offset || 0;
      const limit = options.limit || 50;

      const pagedSql = `
        SELECT * FROM ${this.table('MIGRATION_ITEM')}
        WHERE ${whereClause}
        ORDER BY CREATED_AT DESC
        OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;

      const pagedBinds = { ...binds, offset, limit };
      const itemsRes = await conn.execute<any>(pagedSql, pagedBinds, { outFormat: oracledb.OUT_FORMAT_OBJECT });

      const items = (itemsRes.rows || []).map((r) => this.mapItemRow(r));
      return { items, total };
    });
  }

  public async updateItem(id: string, update: Partial<MigrationItem>): Promise<MigrationItem> {
    return this.withConnection(async (conn) => {
      const sets: string[] = ['UPDATED_AT = CURRENT_TIMESTAMP'];
      const binds: Record<string, any> = { id };

      if (update.migrationStatus) { sets.push('MIGRATION_STATUS = :st'); binds.st = update.migrationStatus; }
      if (update.geographicAddressId !== undefined) { sets.push('GEOGRAPHIC_ADDRESS_ID = :geoId'); binds.geoId = update.geographicAddressId; }
      if (update.addressMatchScore !== undefined) { sets.push('ADDRESS_MATCH_SCORE = :score'); binds.score = update.addressMatchScore; }
      if (update.viabilityId !== undefined) { sets.push('VIABILITY_ID = :viabId'); binds.viabId = update.viabilityId; }
      if (update.viabilityStatus !== undefined) { sets.push('VIABILITY_STATUS = :viabSt'); binds.viabSt = update.viabilityStatus; }
      if (update.targetInventoryId !== undefined) { sets.push('TARGET_INVENTORY_ID = :tInv'); binds.tInv = update.targetInventoryId; }
      if (update.targetHcId !== undefined) { sets.push('TARGET_HC_ID = :tHc'); binds.tHc = update.targetHcId; }
      if (update.targetBoxId !== undefined) { sets.push('TARGET_BOX_ID = :tBox'); binds.tBox = update.targetBoxId; }
      if (update.targetBoxType !== undefined) { sets.push('TARGET_BOX_TYPE = :tType'); binds.tType = update.targetBoxType; }
      if (update.ontSerialEffective !== undefined) { sets.push('ONT_SERIAL_EFFECTIVE = :effSer'); binds.effSer = update.ontSerialEffective; }
      if (update.crmOrderId !== undefined) { sets.push('CRM_ORDER_ID = :crmOrd'); binds.crmOrd = update.crmOrderId; }
      if (update.osId !== undefined) { sets.push('OS_ID = :osId'); binds.osId = update.osId; }
      if (update.saId !== undefined) { sets.push('SA_ID = :saId'); binds.saId = update.saId; }
      if (update.osCreationStatus !== undefined) { sets.push('OS_CREATION_STATUS = :osSt'); binds.osSt = update.osCreationStatus; }
      if (update.saCreationStatus !== undefined) { sets.push('SA_CREATION_STATUS = :saSt'); binds.saSt = update.saCreationStatus; }
      if (update.batchId !== undefined) { sets.push('BATCH_ID = :batchId'); binds.batchId = update.batchId; }
      if (update.scheduledDate !== undefined) { sets.push('SCHEDULED_DATE = :schedDt'); binds.schedDt = update.scheduledDate ? new Date(update.scheduledDate) : null; }
      if (update.technicianId !== undefined) { sets.push('TECHNICIAN_ID = :techId'); binds.techId = update.technicianId; }
      if (update.errorStage !== undefined) { sets.push('ERROR_STAGE = :errStage'); binds.errStage = update.errorStage; }
      if (update.errorCode !== undefined) { sets.push('ERROR_CODE = :errCode'); binds.errCode = update.errorCode; }
      if (update.errorDescription !== undefined) { sets.push('ERROR_DESCRIPTION = :errDesc'); binds.errDesc = update.errorDescription; }
      if (update.preparedAt !== undefined) { sets.push('PREPARED_AT = CURRENT_TIMESTAMP'); }
      if (update.scheduledAt !== undefined) { sets.push('SCHEDULED_AT = CURRENT_TIMESTAMP'); }
      if (update.migratedAt !== undefined) { sets.push('MIGRATED_AT = CURRENT_TIMESTAMP'); }

      await conn.execute(
        `UPDATE ${this.table('MIGRATION_ITEM')} SET ${sets.join(', ')} WHERE ID = :id`,
        binds,
        { autoCommit: true }
      );

      const item = await this.getItemById(id);
      if (!item) throw new NotFoundError(`Item ${id} not found`);
      return item;
    });
  }

  public async getItemsByBox(targetBoxId: string): Promise<MigrationItem[]> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT * FROM ${this.table('MIGRATION_ITEM')} WHERE TARGET_BOX_ID = :targetBoxId ORDER BY CREATED_AT ASC`,
        [targetBoxId],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return (res.rows || []).map((r) => this.mapItemRow(r));
    });
  }

  public async getItemsByOriginBox(originBoxId: string): Promise<MigrationItem[]> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT * FROM ${this.table('MIGRATION_ITEM')} WHERE ORIGIN_BOX_ID = :originBoxId ORDER BY CREATED_AT ASC`,
        [originBoxId],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return (res.rows || []).map((r) => this.mapItemRow(r));
    });
  }

  // Schedules (CDO/CDOI)
  public async getBoxSchedule(maId: string, targetBoxId: string): Promise<BoxSchedule | undefined> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT ID, MA_ID, TARGET_BOX_ID, TARGET_BOX_TYPE, MUNICIPALITY, NEIGHBORHOOD,
                TOTAL_CUSTOMERS, TOTAL_ORDERS, SCHEDULE_STATUS,
                TO_CHAR(SCHEDULED_DATE, 'YYYY-MM-DD') AS SCHEDULED_DATE,
                TECHNICIAN_ID,
                TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                CREATED_BY,
                TO_CHAR(UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT,
                UPDATED_BY
         FROM ${this.table('BOX_SCHEDULE')}
         WHERE MA_ID = :maId AND TARGET_BOX_ID = :boxId`,
        { maId, boxId: targetBoxId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const r = res.rows?.[0];
      if (!r) return undefined;
      return this.mapBoxScheduleRow(r);
    });
  }

  public async getBoxScheduleById(id: string): Promise<BoxSchedule | undefined> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT ID, MA_ID, TARGET_BOX_ID, TARGET_BOX_TYPE, MUNICIPALITY, NEIGHBORHOOD,
                TOTAL_CUSTOMERS, TOTAL_ORDERS, SCHEDULE_STATUS,
                TO_CHAR(SCHEDULED_DATE, 'YYYY-MM-DD') AS SCHEDULED_DATE,
                TECHNICIAN_ID,
                TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
                CREATED_BY,
                TO_CHAR(UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT,
                UPDATED_BY
         FROM ${this.table('BOX_SCHEDULE')}
         WHERE ID = :id`,
        [id],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const r = res.rows?.[0];
      if (!r) return undefined;
      return this.mapBoxScheduleRow(r);
    });
  }

  public async saveBoxSchedule(schedule: BoxSchedule): Promise<BoxSchedule> {
    return this.withConnection(async (conn) => {
      const existing = await this.getBoxSchedule(schedule.maId, schedule.targetBoxId);
      if (existing) {
        await conn.execute(
          `UPDATE ${this.table('BOX_SCHEDULE')}
           SET SCHEDULE_STATUS = :st, SCHEDULED_DATE = :dt, TECHNICIAN_ID = :tech, UPDATED_AT = CURRENT_TIMESTAMP, UPDATED_BY = :updatedBy
           WHERE ID = :id`,
          {
            st: schedule.scheduleStatus,
            dt: schedule.scheduledDate ? new Date(schedule.scheduledDate) : null,
            tech: schedule.technicianId ?? null,
            updatedBy: schedule.updatedBy,
            id: schedule.id,
          },
          { autoCommit: true }
        );
      } else {
        await conn.execute(
          `INSERT INTO ${this.table('BOX_SCHEDULE')} (
            ID, MA_ID, TARGET_BOX_ID, TARGET_BOX_TYPE, MUNICIPALITY, NEIGHBORHOOD,
            TOTAL_CUSTOMERS, TOTAL_ORDERS, SCHEDULE_STATUS, SCHEDULED_DATE, TECHNICIAN_ID,
            CREATED_AT, CREATED_BY, UPDATED_AT, UPDATED_BY
          ) VALUES (
            :id, :maId, :boxId, :boxType, :muni, :neigh,
            :cust, :orders, :st, :dt, :tech,
            CURRENT_TIMESTAMP, :cBy, CURRENT_TIMESTAMP, :uBy
          )`,
          {
            id: schedule.id,
            maId: schedule.maId,
            boxId: schedule.targetBoxId,
            boxType: schedule.targetBoxType,
            muni: schedule.municipality || null,
            neigh: schedule.neighborhood || null,
            cust: schedule.totalCustomers,
            orders: schedule.totalOrders,
            st: schedule.scheduleStatus,
            dt: schedule.scheduledDate ? new Date(schedule.scheduledDate) : null,
            tech: schedule.technicianId ?? null,
            cBy: schedule.createdBy,
            uBy: schedule.updatedBy,
          },
          { autoCommit: true }
        );
      }
      return schedule;
    });
  }

  public async listBoxSchedules(options: BoxFilterOptions): Promise<{ schedules: BoxSchedule[]; total: number }> {
    return this.withConnection(async (conn) => {
      const conditions: string[] = ['1=1'];
      const binds: Record<string, any> = {};

      if (options.maId) {
        conditions.push('MA_ID = :maId');
        binds.maId = options.maId;
      }
      if (options.status) {
        conditions.push('SCHEDULE_STATUS = :st');
        binds.st = options.status;
      }
      if (options.municipality) {
        conditions.push('LOWER(MUNICIPALITY) = LOWER(:muni)');
        binds.muni = options.municipality;
      }
      if (options.neighborhood) {
        conditions.push('LOWER(NEIGHBORHOOD) LIKE LOWER(:neigh)');
        binds.neigh = `%${options.neighborhood}%`;
      }
      if (options.search) {
        conditions.push('(LOWER(TARGET_BOX_ID) LIKE LOWER(:q) OR LOWER(NEIGHBORHOOD) LIKE LOWER(:q))');
        binds.q = `%${options.search}%`;
      }

      const whereClause = conditions.join(' AND ');

      const countRes = await conn.execute<any>(
        `SELECT COUNT(*) AS TOTAL FROM ${this.table('BOX_SCHEDULE')} WHERE ${whereClause}`,
        binds,
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const total = countRes.rows?.[0]?.TOTAL || 0;

      const offset = options.offset || 0;
      const limit = options.limit || 50;

      const sql = `
        SELECT ID, MA_ID, TARGET_BOX_ID, TARGET_BOX_TYPE, MUNICIPALITY, NEIGHBORHOOD,
               TOTAL_CUSTOMERS, TOTAL_ORDERS, SCHEDULE_STATUS,
               TO_CHAR(SCHEDULED_DATE, 'YYYY-MM-DD') AS SCHEDULED_DATE,
               TECHNICIAN_ID,
               TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT,
               CREATED_BY,
               TO_CHAR(UPDATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS UPDATED_AT,
               UPDATED_BY
        FROM ${this.table('BOX_SCHEDULE')}
        WHERE ${whereClause}
        ORDER BY TARGET_BOX_ID ASC
        OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;

      const res = await conn.execute<any>(sql, { ...binds, offset, limit }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const schedules = (res.rows || []).map((r) => this.mapBoxScheduleRow(r));
      return { schedules, total };
    });
  }

  public async cancelBoxSchedule(id: string): Promise<BoxSchedule> {
    const sched = await this.getBoxScheduleById(id);
    if (!sched) throw new NotFoundError(`Agendamento ${id} não encontrado.`);

    return this.withConnection(async (conn) => {
      await conn.execute(
        `UPDATE ${this.table('BOX_SCHEDULE')}
         SET SCHEDULE_STATUS = 'AVAILABLE',
             SCHEDULED_DATE = NULL,
             TECHNICIAN_ID = NULL,
             UPDATED_AT = CURRENT_TIMESTAMP,
             UPDATED_BY = 'OPERATOR'
         WHERE ID = :id`,
        { id },
        { autoCommit: true }
      );

      await conn.execute(
        `UPDATE ${this.table('MIGRATION_ITEM')}
         SET MIGRATION_STATUS = 'OS_CREATED',
             SCHEDULED_DATE = NULL,
             TECHNICIAN_ID = NULL,
             UPDATED_AT = CURRENT_TIMESTAMP
         WHERE TARGET_BOX_ID = :targetBoxId AND MIGRATION_STATUS = 'SCHEDULED'`,
        { targetBoxId: sched.targetBoxId },
        { autoCommit: true }
      );

      const updated = await this.getBoxScheduleById(id);
      return updated!;
    });
  }

  public async addScheduleHistory(history: BoxScheduleHistory): Promise<void> {
    return this.withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO ${this.table('BOX_SCHEDULE_HISTORY')} (
          ID, SCHEDULE_ID, OLD_DATE, NEW_DATE, OLD_TECHNICIAN_ID, NEW_TECHNICIAN_ID, REASON, CHANGED_BY, CHANGED_AT
        ) VALUES (
          :id, :schedId, :oldDate, :newDate, :oldTech, :newTech, :reason, :changedBy, CURRENT_TIMESTAMP
        )`,
        {
          id: history.id,
          schedId: history.scheduleId,
          oldDate: history.oldDate ? new Date(history.oldDate) : null,
          newDate: history.newDate ? new Date(history.newDate) : null,
          oldTech: history.oldTechnicianId ?? null,
          newTech: history.newTechnicianId ?? null,
          reason: history.reason ?? null,
          changedBy: history.changedBy,
        },
        { autoCommit: true }
      );
    });
  }

  public async getScheduleHistory(scheduleId: string): Promise<BoxScheduleHistory[]> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT ID, SCHEDULE_ID, TO_CHAR(OLD_DATE, 'YYYY-MM-DD') AS OLD_DATE, TO_CHAR(NEW_DATE, 'YYYY-MM-DD') AS NEW_DATE, OLD_TECHNICIAN_ID, NEW_TECHNICIAN_ID, REASON, CHANGED_BY, TO_CHAR(CHANGED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CHANGED_AT FROM ${this.table('BOX_SCHEDULE_HISTORY')} WHERE SCHEDULE_ID = :schedId ORDER BY CHANGED_AT DESC`,
        [scheduleId],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return (res.rows || []).map((r) => ({
        id: r.ID,
        scheduleId: r.SCHEDULE_ID,
        oldDate: r.OLD_DATE,
        newDate: r.NEW_DATE,
        oldTechnicianId: r.OLD_TECHNICIAN_ID,
        newTechnicianId: r.NEW_TECHNICIAN_ID,
        reason: r.REASON,
        changedBy: r.CHANGED_BY,
        changedAt: r.CHANGED_AT,
      }));
    });
  }

  // Serial Change Audit
  public async recordSerialChange(change: SerialChange): Promise<void> {
    return this.withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO ${this.table('SERIAL_CHANGE')} (
          ID, ITEM_ID, ORIGINAL_SERIAL, NEW_SERIAL, REASON, OBSERVATION, CHANGED_BY, CHANGED_AT
        ) VALUES (
          :id, :itemId, :orig, :newSer, :reason, :obs, :changedBy, CURRENT_TIMESTAMP
        )`,
        {
          id: change.id,
          itemId: change.itemId,
          orig: change.originalSerial,
          newSer: change.newSerial,
          reason: change.reason,
          obs: change.observation ?? null,
          changedBy: change.changedBy,
        },
        { autoCommit: true }
      );
    });
  }

  public async listSerialChanges(itemId: string): Promise<SerialChange[]> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT ID, ITEM_ID, ORIGINAL_SERIAL, NEW_SERIAL, REASON, OBSERVATION, CHANGED_BY, TO_CHAR(CHANGED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CHANGED_AT FROM ${this.table('SERIAL_CHANGE')} WHERE ITEM_ID = :itemId ORDER BY CHANGED_AT DESC`,
        [itemId],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return (res.rows || []).map((r) => ({
        id: r.ID,
        itemId: r.ITEM_ID,
        originalSerial: r.ORIGINAL_SERIAL,
        newSerial: r.NEW_SERIAL,
        reason: r.REASON,
        observation: r.OBSERVATION,
        changedBy: r.CHANGED_BY,
        changedAt: r.CHANGED_AT,
      }));
    });
  }

  // Batches
  public async createOsBatch(batch: OsBatch): Promise<OsBatch> {
    return this.withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO ${this.table('OS_BATCH')} (
          ID, MA_ID, TOTAL_CUSTOMERS, SUCCESS_COUNT, FAILED_COUNT, STATUS, CREATED_BY, CREATED_AT
        ) VALUES (
          :id, :maId, :tot, :suc, :fail, :st, :createdBy, CURRENT_TIMESTAMP
        )`,
        {
          id: batch.id,
          maId: batch.maId,
          tot: batch.totalCustomers,
          suc: batch.successCount,
          fail: batch.failedCount,
          st: batch.status,
          createdBy: batch.createdBy,
        },
        { autoCommit: true }
      );
      return batch;
    });
  }

  public async getOsBatch(id: string): Promise<OsBatch | undefined> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT ID, MA_ID, TOTAL_CUSTOMERS, SUCCESS_COUNT, FAILED_COUNT, STATUS, CREATED_BY, TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT, TO_CHAR(COMPLETED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS COMPLETED_AT FROM ${this.table('OS_BATCH')} WHERE ID = :id`,
        [id],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const r = res.rows?.[0];
      if (!r) return undefined;
      return {
        id: r.ID,
        maId: r.MA_ID,
        totalCustomers: r.TOTAL_CUSTOMERS,
        successCount: r.SUCCESS_COUNT,
        failedCount: r.FAILED_COUNT,
        status: r.STATUS,
        createdBy: r.CREATED_BY,
        createdAt: r.CREATED_AT,
        completedAt: r.COMPLETED_AT,
      };
    });
  }

  public async updateOsBatch(id: string, update: Partial<OsBatch>): Promise<OsBatch> {
    return this.withConnection(async (conn) => {
      const sets: string[] = [];
      const binds: Record<string, any> = { id };
      if (update.successCount !== undefined) { sets.push('SUCCESS_COUNT = :suc'); binds.suc = update.successCount; }
      if (update.failedCount !== undefined) { sets.push('FAILED_COUNT = :fail'); binds.fail = update.failedCount; }
      if (update.status !== undefined) { sets.push('STATUS = :st'); binds.st = update.status; }
      if (update.completedAt !== undefined) { sets.push('COMPLETED_AT = CURRENT_TIMESTAMP'); }

      await conn.execute(
        `UPDATE ${this.table('OS_BATCH')} SET ${sets.join(', ')} WHERE ID = :id`,
        binds,
        { autoCommit: true }
      );
      const b = await this.getOsBatch(id);
      if (!b) throw new NotFoundError(`OsBatch ${id} not found`);
      return b;
    });
  }

  public async createCutoverBatch(batch: CutoverBatch): Promise<CutoverBatch> {
    return this.withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO ${this.table('CUTOVER_BATCH')} (
          ID, MA_ID, TARGET_BOX_ID, TOTAL_ITEMS, SUCCESS_COUNT, FAILED_COUNT, STATUS, EXECUTED_BY, CREATED_AT
        ) VALUES (
          :id, :maId, :boxId, :tot, :suc, :fail, :st, :executedBy, CURRENT_TIMESTAMP
        )`,
        {
          id: batch.id,
          maId: batch.maId,
          boxId: batch.targetBoxId ?? null,
          tot: batch.totalItems,
          suc: batch.successCount,
          fail: batch.failedCount,
          st: batch.status,
          executedBy: batch.executedBy,
        },
        { autoCommit: true }
      );
      return batch;
    });
  }

  public async getCutoverBatch(id: string): Promise<CutoverBatch | undefined> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT ID, MA_ID, TARGET_BOX_ID, TOTAL_ITEMS, SUCCESS_COUNT, FAILED_COUNT, STATUS, EXECUTED_BY, TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT, TO_CHAR(COMPLETED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS COMPLETED_AT FROM ${this.table('CUTOVER_BATCH')} WHERE ID = :id`,
        [id],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const r = res.rows?.[0];
      if (!r) return undefined;
      return {
        id: r.ID,
        maId: r.MA_ID,
        targetBoxId: r.TARGET_BOX_ID,
        totalItems: r.TOTAL_ITEMS,
        successCount: r.SUCCESS_COUNT,
        failedCount: r.FAILED_COUNT,
        status: r.STATUS,
        executedBy: r.EXECUTED_BY,
        createdAt: r.CREATED_AT,
        completedAt: r.COMPLETED_AT,
      };
    });
  }

  public async updateCutoverBatch(id: string, update: Partial<CutoverBatch>): Promise<CutoverBatch> {
    return this.withConnection(async (conn) => {
      const sets: string[] = [];
      const binds: Record<string, any> = { id };
      if (update.successCount !== undefined) { sets.push('SUCCESS_COUNT = :suc'); binds.suc = update.successCount; }
      if (update.failedCount !== undefined) { sets.push('FAILED_COUNT = :fail'); binds.fail = update.failedCount; }
      if (update.status !== undefined) { sets.push('STATUS = :st'); binds.st = update.status; }
      if (update.completedAt !== undefined) { sets.push('COMPLETED_AT = CURRENT_TIMESTAMP'); }

      await conn.execute(
        `UPDATE ${this.table('CUTOVER_BATCH')} SET ${sets.join(', ')} WHERE ID = :id`,
        binds,
        { autoCommit: true }
      );
      const b = await this.getCutoverBatch(id);
      if (!b) throw new NotFoundError(`CutoverBatch ${id} not found`);
      return b;
    });
  }

  public async createCutoverItem(item: CutoverItem): Promise<CutoverItem> {
    return this.withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO ${this.table('CUTOVER_ITEM')} (
          ID, CUTOVER_BATCH_ID, ITEM_ID, EXECUTION_STAGE, STATUS, DISCOVERY_STATUS, OPTICAL_POWER_RX, OPTICAL_POWER_TX, DIAGNOSTICS_RESULT, ERROR_CODE, ERROR_DESCRIPTION, STARTED_AT, COMPLETED_AT
        ) VALUES (
          :id, :batchId, :itemId, :stage, :status, :disc, :rx, :tx, :diag, :errCode, :errDesc, CURRENT_TIMESTAMP, :compAt
        )`,
        {
          id: item.id,
          batchId: item.cutoverBatchId,
          itemId: item.itemId,
          stage: item.executionStage,
          status: item.status,
          disc: item.discoveryStatus ?? null,
          rx: item.opticalPowerRx ?? null,
          tx: item.opticalPowerTx ?? null,
          diag: item.diagnosticsResult ?? null,
          errCode: item.errorCode ?? null,
          errDesc: item.errorDescription ?? null,
          compAt: item.completedAt ? new Date(item.completedAt) : null,
        },
        { autoCommit: true }
      );
      return item;
    });
  }

  public async listCutoverItems(batchId: string): Promise<CutoverItem[]> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT ID, CUTOVER_BATCH_ID, ITEM_ID, EXECUTION_STAGE, STATUS, DISCOVERY_STATUS, OPTICAL_POWER_RX, OPTICAL_POWER_TX, DIAGNOSTICS_RESULT, ERROR_CODE, ERROR_DESCRIPTION, TO_CHAR(STARTED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS STARTED_AT, TO_CHAR(COMPLETED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS COMPLETED_AT FROM ${this.table('CUTOVER_ITEM')} WHERE CUTOVER_BATCH_ID = :batchId ORDER BY STARTED_AT ASC`,
        [batchId],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return (res.rows || []).map((r) => ({
        id: r.ID,
        cutoverBatchId: r.CUTOVER_BATCH_ID,
        itemId: r.ITEM_ID,
        executionStage: r.EXECUTION_STAGE,
        status: r.STATUS,
        discoveryStatus: r.DISCOVERY_STATUS,
        opticalPowerRx: r.OPTICAL_POWER_RX,
        opticalPowerTx: r.OPTICAL_POWER_TX,
        diagnosticsResult: r.DIAGNOSTICS_RESULT,
        errorCode: r.ERROR_CODE,
        errorDescription: r.ERROR_DESCRIPTION,
        startedAt: r.STARTED_AT,
        completedAt: r.COMPLETED_AT,
      }));
    });
  }

  // Rollback
  public async createRollback(rollback: Rollback): Promise<Rollback> {
    return this.withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO ${this.table('ROLLBACK')} (
          ID, ITEM_ID, ORIGIN_BOX_ID, REASON, STATUS, REQUESTED_BY, REQUESTED_AT
        ) VALUES (
          :id, :itemId, :boxId, :reason, :st, :requestedBy, CURRENT_TIMESTAMP
        )`,
        {
          id: rollback.id,
          itemId: rollback.itemId,
          boxId: rollback.originBoxId,
          reason: rollback.reason,
          st: rollback.status,
          requestedBy: rollback.requestedBy,
        },
        { autoCommit: true }
      );
      return rollback;
    });
  }

  public async getRollbackByItemId(itemId: string): Promise<Rollback | undefined> {
    return this.withConnection(async (conn) => {
      const res = await conn.execute<any>(
        `SELECT ID, ITEM_ID, ORIGIN_BOX_ID, REASON, STATUS, REQUESTED_BY, TO_CHAR(REQUESTED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS REQUESTED_AT, TO_CHAR(COMPLETED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS COMPLETED_AT FROM ${this.table('ROLLBACK')} WHERE ITEM_ID = :itemId`,
        [itemId],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const r = res.rows?.[0];
      if (!r) return undefined;
      return {
        id: r.ID,
        itemId: r.ITEM_ID,
        originBoxId: r.ORIGIN_BOX_ID,
        reason: r.REASON,
        status: r.STATUS,
        requestedBy: r.REQUESTED_BY,
        requestedAt: r.REQUESTED_AT,
        completedAt: r.COMPLETED_AT,
      };
    });
  }

  public async listRollbacks(originBoxId?: string): Promise<Rollback[]> {
    return this.withConnection(async (conn) => {
      const sql = originBoxId
        ? `SELECT ID, ITEM_ID, ORIGIN_BOX_ID, REASON, STATUS, REQUESTED_BY, TO_CHAR(REQUESTED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS REQUESTED_AT, TO_CHAR(COMPLETED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS COMPLETED_AT FROM ${this.table('ROLLBACK')} WHERE ORIGIN_BOX_ID = :boxId ORDER BY REQUESTED_AT DESC`
        : `SELECT ID, ITEM_ID, ORIGIN_BOX_ID, REASON, STATUS, REQUESTED_BY, TO_CHAR(REQUESTED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS REQUESTED_AT, TO_CHAR(COMPLETED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS COMPLETED_AT FROM ${this.table('ROLLBACK')} ORDER BY REQUESTED_AT DESC`;
      const binds = originBoxId ? [originBoxId] : [];
      const res = await conn.execute<any>(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (res.rows || []).map((r) => ({
        id: r.ID,
        itemId: r.ITEM_ID,
        originBoxId: r.ORIGIN_BOX_ID,
        reason: r.REASON,
        status: r.STATUS,
        requestedBy: r.REQUESTED_BY,
        requestedAt: r.REQUESTED_AT,
        completedAt: r.COMPLETED_AT,
      }));
    });
  }

  // Audit
  public async recordAudit(log: AuditLog): Promise<void> {
    return this.withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO ${this.table('AUDIT_LOG')} (
          ID, CORRELATION_ID, ACTOR, ACTION, ENTITY_TYPE, ENTITY_ID, BEFORE_STATE, AFTER_STATE, CREATED_AT
        ) VALUES (
          :id, :corr, :actor, :action, :entityType, :entId, :before, :after, CURRENT_TIMESTAMP
        )`,
        {
          id: log.id,
          corr: log.correlationId,
          actor: log.actor,
          action: log.action,
          entityType: log.entityType,
          entId: log.entityId,
          before: log.beforeState ?? null,
          after: log.afterState ?? null,
        },
        { autoCommit: true }
      );
    });
  }

  public async listAuditLogs(entityType?: string, entityId?: string): Promise<AuditLog[]> {
    return this.withConnection(async (conn) => {
      const conditions: string[] = ['1=1'];
      const binds: Record<string, any> = {};
      if (entityType) { conditions.push('ENTITY_TYPE = :type'); binds.type = entityType; }
      if (entityId) { conditions.push('ENTITY_ID = :entId'); binds.entId = entityId; }

      const sql = `
        SELECT ID, CORRELATION_ID, ACTOR, ACTION, ENTITY_TYPE, ENTITY_ID, BEFORE_STATE, AFTER_STATE, TO_CHAR(CREATED_AT, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS CREATED_AT
        FROM ${this.table('AUDIT_LOG')}
        WHERE ${conditions.join(' AND ')}
        ORDER BY CREATED_AT DESC`;

      const res = await conn.execute<any>(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return (res.rows || []).map((r) => ({
        id: r.ID,
        correlationId: r.CORRELATION_ID,
        actor: r.ACTOR,
        action: r.ACTION,
        entityType: r.ENTITY_TYPE,
        entityId: r.ENTITY_ID,
        beforeState: r.BEFORE_STATE,
        afterState: r.AFTER_STATE,
        createdAt: r.CREATED_AT,
      }));
    });
  }

  // Metrics & Aggregations
  public async getDashboardMetrics(maId?: string): Promise<DashboardMetrics> {
    return this.withConnection(async (conn) => {
      const sql = maId
        ? `SELECT * FROM ${this.table('VW_MIGRATION_FUNNEL')} WHERE MA_ID = :maId`
        : `SELECT
            NVL(SUM(TOTAL_IMPORTED), 0) AS TOTAL_IMPORTED,
            NVL(SUM(TOTAL_SANITIZED), 0) AS TOTAL_SANITIZED,
            NVL(SUM(TOTAL_VIABLE), 0) AS TOTAL_VIABLE,
            NVL(SUM(TOTAL_OS_CREATED), 0) AS TOTAL_OS_CREATED,
            NVL(SUM(TOTAL_SCHEDULED), 0) AS TOTAL_SCHEDULED,
            NVL(SUM(TOTAL_IN_FIELD), 0) AS TOTAL_IN_FIELD,
            NVL(SUM(TOTAL_MIGRATED), 0) AS TOTAL_MIGRATED,
            NVL(SUM(TOTAL_EXCEPTIONS), 0) AS TOTAL_EXCEPTIONS,
            NVL(SUM(TOTAL_ROLLBACKS), 0) AS TOTAL_ROLLBACKS
           FROM ${this.table('VW_MIGRATION_FUNNEL')}`;

      const binds = maId ? [maId] : [];
      const res = await conn.execute<any>(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      const row = res.rows?.[0] || {};

      const totalAcquired = Number(row.TOTAL_IMPORTED || 0);
      const totalSanitized = Number(row.TOTAL_SANITIZED || 0);
      const totalViable = Number(row.TOTAL_VIABLE || 0);
      const totalOsCreated = Number(row.TOTAL_OS_CREATED || 0);
      const totalOsOpen = Number(row.TOTAL_OS_OPEN || row.TOTAL_OS_CREATED || 0);
      const totalScheduled = Number(row.TOTAL_SCHEDULED || 0);
      const totalInField = Number(row.TOTAL_IN_FIELD || 0);
      const totalMigrated = Number(row.TOTAL_MIGRATED || 0);
      const totalExceptions = Number(row.TOTAL_EXCEPTIONS || 0);
      const totalRollbacks = Number(row.TOTAL_ROLLBACKS || 0);

      const migrationPercentage = totalAcquired > 0 ? Math.round((totalMigrated / totalAcquired) * 100) : 0;

      const decommissionBoxes = await this.listDecommissionBoxes(maId);
      const releasableOriginBoxes = decommissionBoxes.filter((b) => b.releaseStatus === 'READY_FOR_RELEASE').length;
      const monthlySavingsProjected = releasableOriginBoxes * 180.0;

      return {
        totalAcquired,
        totalInCrm: totalAcquired,
        totalInOriginNetwork: totalAcquired,
        totalSanitized,
        totalViable,
        totalOsCreated: totalOsOpen,
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
    });
  }

  public async getStrategicOverview(): Promise<StrategicOverviewItem[]> {
    const mas = await this.listMas();
    const list: StrategicOverviewItem[] = [];
    for (const ma of mas) {
      const metrics = await this.getDashboardMetrics(ma.id);
      list.push({
        maId: ma.id,
        maName: ma.name,
        originProvider: ma.originProvider,
        uf: ma.uf,
        status: ma.status,
        startDate: ma.startDate,
        ma,
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

  public async listDecommissionBoxes(maId?: string): Promise<DecommissionBoxMetric[]> {
    return this.withConnection(async (conn) => {
      const sql = maId
        ? `SELECT ORIGIN_BOX_ID, ORIGIN_PROVIDER, MA_ID, TOTAL_CUSTOMERS, MIGRATED_CUSTOMERS, PENDING_CUSTOMERS, ROLLBACK_CUSTOMERS, RELEASE_STATUS FROM ${this.table('VW_ORIGIN_BOX_RELEASE')} WHERE MA_ID = :maId ORDER BY RELEASE_STATUS DESC, ORIGIN_BOX_ID ASC`
        : `SELECT ORIGIN_BOX_ID, ORIGIN_PROVIDER, MA_ID, TOTAL_CUSTOMERS, MIGRATED_CUSTOMERS, PENDING_CUSTOMERS, ROLLBACK_CUSTOMERS, RELEASE_STATUS FROM ${this.table('VW_ORIGIN_BOX_RELEASE')} ORDER BY RELEASE_STATUS DESC, ORIGIN_BOX_ID ASC`;

      const binds = maId ? [maId] : [];
      const res = await conn.execute<any>(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });

      return (res.rows || []).map((r) => {
        const releaseStatus = r.RELEASE_STATUS as BoxReleaseStatus;
        return {
          originBoxId: r.ORIGIN_BOX_ID,
          originProvider: r.ORIGIN_PROVIDER,
          totalCustomers: Number(r.TOTAL_CUSTOMERS || 0),
          migratedCustomers: Number(r.MIGRATED_CUSTOMERS || 0),
          pendingCustomers: Number(r.PENDING_CUSTOMERS || 0),
          releaseStatus,
          monthlyRentalCostSaved: releaseStatus === 'READY_FOR_RELEASE' ? 180.0 : 0,
        };
      });
    });
  }

  // Row Mappers
  private mapItemRow(r: any): MigrationItem {
    return {
      id: r.ID,
      maId: r.MA_ID,
      lotId: r.LOT_ID,
      batchId: r.BATCH_ID,
      customerId: r.CUSTOMER_ID,
      externalCustomerId: r.EXTERNAL_CUSTOMER_ID,
      subscriptionId: r.SUBSCRIPTION_ID,
      customerName: r.CUSTOMER_NAME,
      rawAddress: r.RAW_ADDRESS,
      cep: r.CEP,
      street: r.STREET,
      streetNr: r.STREET_NR,
      complement: r.COMPLEMENT,
      neighborhood: r.NEIGHBORHOOD,
      city: r.CITY,
      stateOrUf: r.STATE_OR_UF,
      geographicAddressId: r.GEOGRAPHIC_ADDRESS_ID,
      addressMatchScore: r.ADDRESS_MATCH_SCORE,
      viabilityId: r.VIABILITY_ID,
      viabilityStatus: r.VIABILITY_STATUS,
      originProvider: r.ORIGIN_PROVIDER,
      originAccessId: r.ORIGIN_ACCESS_ID,
      originBoxId: r.ORIGIN_BOX_ID,
      targetInventoryId: r.TARGET_INVENTORY_ID,
      targetHcId: r.TARGET_HC_ID,
      targetBoxId: r.TARGET_BOX_ID,
      targetBoxType: r.TARGET_BOX_TYPE,
      ontSerialOriginal: r.ONT_SERIAL_ORIGINAL,
      ontSerialEffective: r.ONT_SERIAL_EFFECTIVE,
      crmOrderId: r.CRM_ORDER_ID,
      osId: r.OS_ID,
      saId: r.SA_ID,
      osCreationStatus: r.OS_CREATION_STATUS,
      saCreationStatus: r.SA_CREATION_STATUS,
      migrationStatus: r.MIGRATION_STATUS,
      scheduledDate: r.SCHEDULED_DATE ? new Date(r.SCHEDULED_DATE).toISOString().substring(0, 10) : undefined,
      technicianId: r.TECHNICIAN_ID,
      errorStage: r.ERROR_STAGE,
      errorCode: r.ERROR_CODE,
      errorDescription: r.ERROR_DESCRIPTION,
      createdAt: r.CREATED_AT ? new Date(r.CREATED_AT).toISOString() : new Date().toISOString(),
      updatedAt: r.UPDATED_AT ? new Date(r.UPDATED_AT).toISOString() : new Date().toISOString(),
      preparedAt: r.PREPARED_AT ? new Date(r.PREPARED_AT).toISOString() : undefined,
      scheduledAt: r.SCHEDULED_AT ? new Date(r.SCHEDULED_AT).toISOString() : undefined,
      migratedAt: r.MIGRATED_AT ? new Date(r.MIGRATED_AT).toISOString() : undefined,
    };
  }

  private mapBoxScheduleRow(r: any): BoxSchedule {
    return {
      id: r.ID,
      maId: r.MA_ID,
      targetBoxId: r.TARGET_BOX_ID,
      targetBoxType: r.TARGET_BOX_TYPE,
      municipality: r.MUNICIPALITY,
      neighborhood: r.NEIGHBORHOOD,
      totalCustomers: r.TOTAL_CUSTOMERS,
      totalOrders: r.TOTAL_ORDERS,
      scheduleStatus: r.SCHEDULE_STATUS,
      scheduledDate: r.SCHEDULED_DATE,
      technicianId: r.TECHNICIAN_ID,
      createdAt: r.CREATED_AT,
      createdBy: r.CREATED_BY,
      updatedAt: r.UPDATED_AT,
      updatedBy: r.UPDATED_BY,
    };
  }
}
