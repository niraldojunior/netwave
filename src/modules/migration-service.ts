import { randomUUID } from 'node:crypto';
import type {
  AddressService,
  DiagnosticsService,
  FulfillmentService,
  InventoryService,
  SalesforceOrderService,
  ViabilityService,
  WorkforceService,
} from '../shared/adapters/external-services.js';
import {
  DefaultAddressService,
  DefaultDiagnosticsService,
  DefaultFulfillmentService,
  DefaultInventoryService,
  DefaultSalesforceOrderService,
  DefaultViabilityService,
  DefaultWorkforceService,
} from '../shared/adapters/external-services.js';
import { AppError, NotFoundError, ValidationError } from '../shared/errors/app-error.js';
import { createLogger, type Logger } from '../shared/logging/logger.js';
import type {
  BoxSchedule,
  DashboardMetrics,
  DecommissionBoxMetric,
  LotStatus,
  Ma,
  MaStatus,
  MigrationItem,
  MigrationLot,
  MigrationRepository,
  OsBatch,
  SerialChangeReason,
  StrategicOverviewItem,
  Technician,
} from '../shared/persistence/repositories.js';

export interface MigrationServiceDependencies {
  repository: MigrationRepository;
  addressService?: AddressService;
  viabilityService?: ViabilityService;
  salesforceOrderService?: SalesforceOrderService;
  fulfillmentService?: FulfillmentService;
  workforceService?: WorkforceService;
  inventoryService?: InventoryService;
  diagnosticsService?: DiagnosticsService;
  logger?: Logger;
}

export class MigrationService {
  private repo: MigrationRepository;
  private addressService: AddressService;
  private viabilityService: ViabilityService;
  private salesforceOrderService: SalesforceOrderService;
  private fulfillmentService: FulfillmentService;
  private workforceService: WorkforceService;
  private inventoryService: InventoryService;
  private diagnosticsService: DiagnosticsService;
  private logger: Logger;

  public constructor(deps: MigrationServiceDependencies) {
    this.repo = deps.repository;
    this.addressService = deps.addressService ?? new DefaultAddressService();
    this.viabilityService = deps.viabilityService ?? new DefaultViabilityService();
    this.salesforceOrderService = deps.salesforceOrderService ?? new DefaultSalesforceOrderService();
    this.fulfillmentService = deps.fulfillmentService ?? new DefaultFulfillmentService();
    this.workforceService = deps.workforceService ?? new DefaultWorkforceService();
    this.inventoryService = deps.inventoryService ?? new DefaultInventoryService();
    this.diagnosticsService = deps.diagnosticsService ?? new DefaultDiagnosticsService();
    this.logger = deps.logger ?? createLogger('info');
  }

  // -------------------------------------------------------------------
  // Setup & M&A
  // -------------------------------------------------------------------
  public async createMa(input: {
    name: string;
    originProvider: string;
    description?: string;
    startDate: string;
    uf: string;
    status?: MaStatus;
    actor?: string;
  }): Promise<Ma> {
    const ma: Ma = {
      id: `MA-${randomUUID().substring(0, 8).toUpperCase()}`,
      name: input.name,
      originProvider: input.originProvider,
      description: input.description,
      startDate: input.startDate,
      status: input.status || 'NEGOTIATION',
      uf: input.uf.toUpperCase(),
      createdAt: new Date().toISOString(),
      createdBy: input.actor || 'SYSTEM',
      updatedAt: new Date().toISOString(),
    };

    await this.repo.createMa(ma);
    await this.repo.recordAudit({
      id: randomUUID(),
      correlationId: randomUUID(),
      actor: input.actor || 'SYSTEM',
      action: 'CREATE_MA',
      entityType: 'NW_MA',
      entityId: ma.id,
      afterState: JSON.stringify(ma),
      createdAt: new Date().toISOString(),
    });

    return ma;
  }

  public async listMas(): Promise<Ma[]> {
    return this.repo.listMas();
  }

  public async getMaById(maId: string): Promise<Ma | undefined> {
    return this.repo.getMaById(maId);
  }

  public async updateMa(id: string, input: Partial<Ma>, actor: string = 'SYSTEM'): Promise<Ma> {
    const updated = await this.repo.updateMa(id, input);
    await this.repo.recordAudit({
      id: randomUUID(),
      correlationId: randomUUID(),
      actor,
      action: 'UPDATE_MA',
      entityType: 'NW_MA',
      entityId: id,
      afterState: JSON.stringify(updated),
      createdAt: new Date().toISOString(),
    });
    return updated;
  }

  public async deleteMa(id: string, actor: string = 'SYSTEM'): Promise<boolean> {
    const res = await this.repo.deleteMa(id);
    await this.repo.recordAudit({
      id: randomUUID(),
      correlationId: randomUUID(),
      actor,
      action: 'DELETE_MA',
      entityType: 'NW_MA',
      entityId: id,
      afterState: JSON.stringify({ deleted: true }),
      createdAt: new Date().toISOString(),
    });
    return res;
  }

  public async createTechnician(input: {
    maId: string;
    externalTechId: string;
    name: string;
    vendorCompany: string;
    city?: string;
    uf?: string;
    dailyCapacity?: number;
    actor?: string;
  }): Promise<Technician> {
    const ma = await this.repo.getMaById(input.maId);
    if (!ma) throw new NotFoundError(`M&A ${input.maId} não encontrado.`);

    const tech: Technician = {
      id: `TECH-${randomUUID().substring(0, 8).toUpperCase()}`,
      maId: input.maId,
      externalTechId: input.externalTechId,
      name: input.name,
      vendorCompany: input.vendorCompany,
      city: input.city || '-',
      uf: (input.uf || ma.uf || 'BR').toUpperCase(),
      dailyCapacity: input.dailyCapacity ?? 8,
      status: 'ACTIVE',
      joinedAt: new Date().toISOString().substring(0, 10),
      createdAt: new Date().toISOString(),
    };

    await this.repo.createTechnician(tech);
    return tech;
  }

  public async listTechnicians(maId: string): Promise<Technician[]> {
    return this.repo.listTechnicians(maId);
  }

  public async updateTechnician(
    id: string,
    input: Partial<Pick<Technician, 'externalTechId' | 'name' | 'vendorCompany' | 'city' | 'uf' | 'dailyCapacity' | 'status'>>,
    actor: string = 'SYSTEM'
  ): Promise<Technician> {
    const existing = await this.repo.getTechnicianById(id);
    if (!existing) throw new NotFoundError(`Técnico ${id} não encontrado.`);

    const updateData: Partial<Technician> = { ...input };
    if (updateData.uf) {
      updateData.uf = updateData.uf.toUpperCase();
    }

    const updated = await this.repo.updateTechnician(id, updateData);
    await this.repo.recordAudit({
      id: randomUUID(),
      correlationId: randomUUID(),
      actor,
      action: 'UPDATE_TECHNICIAN',
      entityType: 'NW_TECHNICIAN',
      entityId: id,
      afterState: JSON.stringify(updated),
      createdAt: new Date().toISOString(),
    });
    return updated;
  }

  // -------------------------------------------------------------------
  // Importação de Lotes (CSV / Dados)
  // -------------------------------------------------------------------
  public async importCustomerLot(input: {
    maId: string;
    fileName: string;
    actor: string;
    rows: Array<{
      externalCustomerId: string;
      customerId?: string;
      subscriptionId?: string;
      customerName: string;
      rawAddress: string;
      cep: string;
      street?: string;
      number?: string;
      complement?: string;
      neighborhood?: string;
      city: string;
      state: string;
      ontSerial: string;
      originProvider: string;
      originAccessId?: string;
      originBoxId: string;
    }>;
  }): Promise<MigrationLot> {
    const ma = await this.repo.getMaById(input.maId);
    if (!ma) throw new NotFoundError(`M&A ${input.maId} não encontrado.`);

    const lotId = `LOT-${randomUUID().substring(0, 8).toUpperCase()}`;
    const lot: MigrationLot = {
      id: lotId,
      maId: input.maId,
      fileName: input.fileName,
      totalRecords: input.rows.length,
      validRecords: 0,
      rejectedRecords: 0,
      duplicateRecords: 0,
      importStatus: 'PROCESSING',
      importedBy: input.actor,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await this.repo.createLot(lot);

    const itemsToInsert: MigrationItem[] = [];
    const seenExternalIds = new Set<string>();

    for (const row of input.rows) {
      if (!row.externalCustomerId || !row.customerName || !row.ontSerial || !row.originBoxId) {
        lot.rejectedRecords++;
        continue;
      }

      if (seenExternalIds.has(row.externalCustomerId)) {
        lot.duplicateRecords++;
        continue;
      }

      const existing = await this.repo.getItemByExternalId(input.maId, row.externalCustomerId);
      if (existing) {
        lot.duplicateRecords++;
        continue;
      }

      seenExternalIds.add(row.externalCustomerId);

      const item: MigrationItem = {
        id: `MIG-${randomUUID().substring(0, 10).toUpperCase()}`,
        maId: input.maId,
        lotId: lot.id,
        customerId: row.customerId || `CUST-${row.externalCustomerId}`,
        externalCustomerId: row.externalCustomerId,
        subscriptionId: row.subscriptionId || `SUB-${row.externalCustomerId}`,
        customerName: row.customerName,
        rawAddress: row.rawAddress,
        cep: row.cep,
        street: row.street,
        streetNr: row.number,
        complement: row.complement,
        neighborhood: row.neighborhood,
        city: row.city,
        stateOrUf: row.state.toUpperCase(),
        originProvider: row.originProvider,
        originAccessId: row.originAccessId,
        originBoxId: row.originBoxId,
        ontSerialOriginal: row.ontSerial,
        ontSerialEffective: row.ontSerial,
        migrationStatus: 'IMPORTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      itemsToInsert.push(item);
      lot.validRecords++;
    }

    if (itemsToInsert.length > 0) {
      await this.repo.createItems(itemsToInsert);
    }

    lot.importStatus = 'RECEIVED';
    await this.repo.updateLot(lot.id, {
      validRecords: lot.validRecords,
      rejectedRecords: lot.rejectedRecords,
      duplicateRecords: lot.duplicateRecords,
      importStatus: 'RECEIVED',
    });

    await this.repo.recordAudit({
      id: randomUUID(),
      correlationId: randomUUID(),
      actor: input.actor,
      action: 'IMPORT_LOT',
      entityType: 'NW_MIGRATION_LOT',
      entityId: lot.id,
      afterState: JSON.stringify({
        total: lot.totalRecords,
        valid: lot.validRecords,
        rejected: lot.rejectedRecords,
        duplicates: lot.duplicateRecords,
      }),
      createdAt: new Date().toISOString(),
    });

    return lot;
  }

  public async listLots(maId?: string): Promise<MigrationLot[]> {
    const rawLots = await this.repo.listLots(maId);
    const enrichedLots: MigrationLot[] = [];

    for (const lot of rawLots) {
      let status: LotStatus = lot.importStatus;

      if ((status as string) === 'PENDING') status = 'RECEIVED';
      else if ((status as string) === 'PROCESSING') status = 'SANITIZING';

      if (status === 'RECEIVED' || status === 'COMPLETED') {
        const { items } = await this.repo.listItems({ maId: lot.maId, lotId: lot.id, limit: 100 });
        if (items.length > 0) {
          const allCompleted = items.every((i) =>
            ['OS_CREATED', 'SCHEDULED', 'IN_FIELD', 'ACTIVATING', 'MIGRATED', 'ADDRESS_EXCEPTION', 'NOT_VIABLE'].includes(i.migrationStatus)
          );
          const allImported = items.every((i) => i.migrationStatus === 'IMPORTED');
          const hasPreparing = items.some((i) => i.migrationStatus === 'PREPARING');
          const hasReadyOrCreating = items.some((i) => ['READY', 'AUTHORIZED', 'OS_CREATING'].includes(i.migrationStatus));

          if (hasPreparing) status = 'SANITIZING';
          else if (hasReadyOrCreating) status = 'OPENING_OS';
          else if (allCompleted) status = 'COMPLETED';
          else if (allImported) status = 'RECEIVED';
        }
      }

      enrichedLots.push({
        ...lot,
        importStatus: status,
      });
    }

    return enrichedLots;
  }

  // -------------------------------------------------------------------
  // Preparação e Viabilidade Técnica (Job Pipeline)
  // -------------------------------------------------------------------
  public async prepareItems(input: {
    maId: string;
    itemIds?: string[];
    lotId?: string;
  }): Promise<{ processed: number; ready: number; exceptions: number; notViable: number }> {
    let items: MigrationItem[];
    if (input.itemIds && input.itemIds.length > 0) {
      items = [];
      for (const id of input.itemIds) {
        const item = await this.repo.getItemById(id);
        if (item) items.push(item);
      }
    } else {
      const res = await this.repo.listItems({
        maId: input.maId,
        lotId: input.lotId,
        status: 'IMPORTED',
        limit: 1000,
      });
      items = res.items;
    }

    const affectedLotIds = new Set<string>();
    for (const item of items) {
      if (item.lotId) affectedLotIds.add(item.lotId);
    }

    for (const lotId of affectedLotIds) {
      try {
        await this.repo.updateLot(lotId, { importStatus: 'SANITIZING' });
      } catch {}
    }

    let readyCount = 0;
    let exceptionCount = 0;
    let notViableCount = 0;

    for (const item of items) {
      if (!['IMPORTED', 'ADDRESS_EXCEPTION', 'NOT_VIABLE'].includes(item.migrationStatus)) {
        continue;
      }

      await this.repo.updateItem(item.id, { migrationStatus: 'PREPARING' });

      // Step 1: Higienização e Normalização de Endereço
      const addrResult = await this.addressService.normalizeAndMatch(
        item.rawAddress,
        item.cep,
        item.city,
        item.stateOrUf,
      );

      if (!addrResult.matched) {
        await this.repo.updateItem(item.id, {
          migrationStatus: 'ADDRESS_EXCEPTION',
          errorStage: 'ADDRESS_MATCH',
          errorCode: addrResult.errorCode || 'ADDRESS_NOT_FOUND',
          errorDescription: 'Endereço não localizado ou ambíguo na base geográfica V.tal',
        });
        exceptionCount++;
        continue;
      }

      // Step 2: Viabilidade Técnica
      const viabResult = await this.viabilityService.checkViability(addrResult.geographicAddressId);
      if (!viabResult.viable) {
        await this.repo.updateItem(item.id, {
          migrationStatus: 'NOT_VIABLE',
          geographicAddressId: addrResult.geographicAddressId,
          addressMatchScore: addrResult.score,
          errorStage: 'VIABILITY',
          errorCode: viabResult.errorCode || 'NO_NETWORK_COVERAGE',
          errorDescription: 'Sem viabilidade técnica de rede na infraestrutura V.tal',
        });
        notViableCount++;
        continue;
      }

      // Step 3: Pronto para Abertura de OS & Abertura Automática Individual (1:1:1)
      try {
        const osResult = await this.salesforceOrderService.createMigrationOrder({
          customerId: item.customerId,
          subscriptionId: item.subscriptionId,
          targetHcId: viabResult.targetHcId || '',
          reuseOnt: true,
          orderJourney: 'CHANGE_ADDRESS',
          migrationType: 'MASS_MIGRATION',
          migrationReason: 'M_AND_A',
        });

        if (osResult.status !== 'SUCCESS') {
          await this.repo.updateItem(item.id, {
            migrationStatus: 'READY',
            geographicAddressId: addrResult.geographicAddressId,
            addressMatchScore: addrResult.score,
            viabilityId: viabResult.viabilityId,
            viabilityStatus: 'VIABLE',
            targetInventoryId: viabResult.targetInventoryId,
            targetHcId: viabResult.targetHcId,
            targetBoxId: viabResult.targetBoxId,
            targetBoxType: viabResult.targetBoxType,
            preparedAt: new Date().toISOString(),
            errorStage: 'OS_CREATION',
            errorCode: osResult.errorCode || 'OS_CREATION_FAILED',
            errorDescription: osResult.errorDescription || 'Falha ao criar OS individual no Salesforce',
            osCreationStatus: 'FAILED',
          });
          continue;
        }

        const saResult = await this.fulfillmentService.createAndEnrichSa({
          osId: osResult.osId,
          customerId: item.customerId,
          ontSerial: item.ontSerialEffective,
          targetBoxId: viabResult.targetBoxId || '',
        });

        if (saResult.status !== 'SUCCESS') {
          await this.repo.updateItem(item.id, {
            migrationStatus: 'READY',
            crmOrderId: osResult.crmOrderId,
            osId: osResult.osId,
            osCreationStatus: 'SUCCESS',
            saCreationStatus: 'FAILED',
            errorStage: 'SA_CREATION',
            errorCode: saResult.errorCode || 'SA_CREATION_FAILED',
            errorDescription: saResult.errorDescription || 'Falha ao enriquecer SA individual no Fulfillment',
          });
          continue;
        }

        // Conclui criação da OS/SA: status OS_CREATED (aguarda programação por CDO)
        await this.repo.updateItem(item.id, {
          crmOrderId: osResult.crmOrderId,
          osId: osResult.osId,
          saId: saResult.saId,
          osCreationStatus: 'SUCCESS',
          saCreationStatus: 'SUCCESS',
          migrationStatus: 'OS_CREATED',
          geographicAddressId: addrResult.geographicAddressId,
          addressMatchScore: addrResult.score,
          viabilityId: viabResult.viabilityId,
          viabilityStatus: 'VIABLE',
          targetInventoryId: viabResult.targetInventoryId,
          targetHcId: viabResult.targetHcId,
          targetBoxId: viabResult.targetBoxId,
          targetBoxType: viabResult.targetBoxType,
          preparedAt: new Date().toISOString(),
          technicianId: undefined,
          errorStage: undefined,
          errorCode: undefined,
          errorDescription: undefined,
        });

        readyCount++;
        await this.ensureBoxSchedule(item.maId, viabResult.targetBoxId, viabResult.targetBoxType, item.city, item.neighborhood || '');
      } catch (err: any) {
        await this.repo.updateItem(item.id, {
          migrationStatus: 'READY',
          errorStage: 'ORDER_ORCHESTRATION',
          errorCode: 'UNHANDLED_EXCEPTION',
          errorDescription: err.message,
        });
      }
    }

    for (const lotId of affectedLotIds) {
      try {
        await this.repo.updateLot(lotId, { importStatus: 'COMPLETED' });
      } catch {}
    }

    return {
      processed: items.length,
      ready: readyCount,
      exceptions: exceptionCount,
      notViable: notViableCount,
    };
  }

  // -------------------------------------------------------------------
  // Abertura Massiva de OS (Regra Mandatória 1 Cliente = 1 OS = 1 SA)
  // -------------------------------------------------------------------
  public async authorizeAndCreateOrders(input: {
    maId: string;
    itemIds?: string[];
    actor: string;
  }): Promise<OsBatch> {
    const ma = await this.repo.getMaById(input.maId);
    if (!ma) throw new NotFoundError(`M&A ${input.maId} não encontrado.`);

    let itemsToProcess: MigrationItem[] = [];
    if (input.itemIds && input.itemIds.length > 0) {
      for (const id of input.itemIds) {
        const item = await this.repo.getItemById(id);
        if (item && item.migrationStatus === 'READY') {
          itemsToProcess.push(item);
        }
      }
    } else {
      const res = await this.repo.listItems({
        maId: input.maId,
        status: 'READY',
        limit: 10000,
      });
      itemsToProcess = res.items;
    }

    if (itemsToProcess.length === 0) {
      throw new AppError('Nenhum cliente elegível (status READY) para abertura de OS.', 400);
    }

    const batch: OsBatch = {
      id: `BATCH-${randomUUID().substring(0, 8).toUpperCase()}`,
      maId: input.maId,
      totalCustomers: itemsToProcess.length,
      successCount: 0,
      failedCount: 0,
      status: 'PROCESSING',
      createdBy: input.actor,
      createdAt: new Date().toISOString(),
    };
    await this.repo.createOsBatch(batch);

    // Processamento individual de cada item (1 cliente = 1 OS = 1 SA)
    for (const item of itemsToProcess) {
      try {
        await this.repo.updateItem(item.id, {
          batchId: batch.id,
          migrationStatus: 'AUTHORIZED',
        });

        await this.repo.updateItem(item.id, {
          migrationStatus: 'OS_CREATING',
        });

        // 1. Criar OS no Salesforce (Individual)
        const osResult = await this.salesforceOrderService.createMigrationOrder({
          customerId: item.customerId,
          subscriptionId: item.subscriptionId,
          targetHcId: item.targetHcId || '',
          reuseOnt: true,
          orderJourney: 'CHANGE_ADDRESS',
          migrationType: 'MASS_MIGRATION',
          migrationReason: 'M_AND_A',
        });

        if (osResult.status !== 'SUCCESS') {
          await this.repo.updateItem(item.id, {
            migrationStatus: 'READY',
            errorStage: 'OS_CREATION',
            errorCode: osResult.errorCode || 'OS_CREATION_FAILED',
            errorDescription: osResult.errorDescription || 'Falha ao criar OS individual no Salesforce',
            osCreationStatus: 'FAILED',
          });
          batch.failedCount++;
          continue;
        }

        // 2. Criar e Enriquecer SA no Fulfillment (Individual, SA sem técnico atribuído inicialmente)
        const saResult = await this.fulfillmentService.createAndEnrichSa({
          osId: osResult.osId,
          customerId: item.customerId,
          ontSerial: item.ontSerialEffective,
          targetBoxId: item.targetBoxId || '',
        });

        if (saResult.status !== 'SUCCESS') {
          await this.repo.updateItem(item.id, {
            migrationStatus: 'READY',
            crmOrderId: osResult.crmOrderId,
            osId: osResult.osId,
            osCreationStatus: 'SUCCESS',
            saCreationStatus: 'FAILED',
            errorStage: 'SA_CREATION',
            errorCode: saResult.errorCode || 'SA_CREATION_FAILED',
            errorDescription: saResult.errorDescription || 'Falha ao enriquecer SA individual no Fulfillment',
          });
          batch.failedCount++;
          continue;
        }

        // 3. Concluir criação da OS/SA: status OS_CREATED (aguarda programação por caixa CDO)
        await this.repo.updateItem(item.id, {
          crmOrderId: osResult.crmOrderId,
          osId: osResult.osId,
          saId: saResult.saId,
          osCreationStatus: 'SUCCESS',
          saCreationStatus: 'SUCCESS',
          migrationStatus: 'OS_CREATED',
          technicianId: undefined,
          errorStage: undefined,
          errorCode: undefined,
          errorDescription: undefined,
        });

        batch.successCount++;
      } catch (err: any) {
        batch.failedCount++;
        await this.repo.updateItem(item.id, {
          migrationStatus: 'READY',
          errorStage: 'ORDER_ORCHESTRATION',
          errorCode: 'UNHANDLED_EXCEPTION',
          errorDescription: err.message,
        });
      }
    }

    batch.status = batch.failedCount > 0 && batch.successCount === 0 ? 'FAILED' : 'COMPLETED';
    batch.completedAt = new Date().toISOString();
    await this.repo.updateOsBatch(batch.id, {
      successCount: batch.successCount,
      failedCount: batch.failedCount,
      status: batch.status,
      completedAt: batch.completedAt,
    });

    await this.repo.recordAudit({
      id: randomUUID(),
      correlationId: randomUUID(),
      actor: input.actor,
      action: 'AUTHORIZE_OS_BATCH',
      entityType: 'NW_OS_BATCH',
      entityId: batch.id,
      afterState: JSON.stringify({
        total: batch.totalCustomers,
        success: batch.successCount,
        failed: batch.failedCount,
      }),
      createdAt: new Date().toISOString(),
    });

    return batch;
  }

  // -------------------------------------------------------------------
  // Programação de Campo por CDO/CDOI
  // -------------------------------------------------------------------
  public async scheduleBox(input: {
    maId: string;
    targetBoxId: string;
    scheduledDate: string;
    technicianId: string;
    actor: string;
  }): Promise<BoxSchedule> {
    const schedule = await this.repo.getBoxSchedule(input.maId, input.targetBoxId);
    if (!schedule) throw new NotFoundError(`CDO/CDOI ${input.targetBoxId} não encontrada para programação.`);

    const tech = await this.repo.getTechnicianById(input.technicianId);
    if (!tech) throw new NotFoundError(`Técnico ${input.technicianId} não encontrado.`);
    if (tech.status !== 'ACTIVE') {
      throw new ValidationError(`Técnico "${tech.name}" possui status "${tech.status}". Apenas técnicos com status ATIVO podem receber agendamento de CDO.`);
    }

    // Se já estiver agendada, trata-se de reprogramação
    const isReschedule = schedule.scheduleStatus === 'SCHEDULED';
    if (isReschedule) {
      await this.repo.addScheduleHistory({
        id: randomUUID(),
        scheduleId: schedule.id,
        oldDate: schedule.scheduledDate,
        newDate: input.scheduledDate,
        oldTechnicianId: schedule.technicianId,
        newTechnicianId: input.technicianId,
        reason: 'REPROGRAMAÇÃO_MANUAL_VIA_COCKPIT',
        changedBy: input.actor,
        changedAt: new Date().toISOString(),
      });
    }

    schedule.scheduleStatus = 'SCHEDULED';
    schedule.scheduledDate = input.scheduledDate;
    schedule.technicianId = tech.id;
    schedule.technicianName = tech.name;
    schedule.updatedAt = new Date().toISOString();
    schedule.updatedBy = input.actor;
    await this.repo.saveBoxSchedule(schedule);

    // Atualiza todos os itens vinculados a esta CDO que estão aguardando programação (OS_CREATED) ou já agendados
    const items = await this.repo.getItemsByBox(input.targetBoxId);
    for (const item of items) {
      if (['OS_CREATED', 'SCHEDULED'].includes(item.migrationStatus)) {
        await this.repo.updateItem(item.id, {
          migrationStatus: 'SCHEDULED',
          scheduledDate: input.scheduledDate,
          technicianId: tech.id,
          scheduledAt: new Date().toISOString(),
        });

        if (item.saId) {
          await this.workforceService.assignToTechnician(
            item.saId,
            tech.externalTechId,
            input.scheduledDate,
          );
        }
      }
    }

    await this.repo.recordAudit({
      id: randomUUID(),
      correlationId: randomUUID(),
      actor: input.actor,
      action: isReschedule ? 'RESCHEDULE_BOX' : 'SCHEDULE_BOX',
      entityType: 'NW_BOX_SCHEDULE',
      entityId: schedule.id,
      afterState: JSON.stringify({
        boxId: input.targetBoxId,
        date: input.scheduledDate,
        technician: tech.name,
      }),
      createdAt: new Date().toISOString(),
    });

    return schedule;
  }

  public async cancelBoxSchedule(input: {
    scheduleId: string;
    actor: string;
  }): Promise<BoxSchedule> {
    const schedule = await this.repo.getBoxScheduleById(input.scheduleId);
    if (!schedule) throw new NotFoundError(`Agendamento de CDO ${input.scheduleId} não encontrado.`);

    await this.repo.addScheduleHistory({
      id: randomUUID(),
      scheduleId: schedule.id,
      oldDate: schedule.scheduledDate,
      newDate: undefined,
      oldTechnicianId: schedule.technicianId,
      newTechnicianId: undefined,
      reason: 'CANCELAMENTO_DE_AGENDAMENTO',
      changedBy: input.actor,
      changedAt: new Date().toISOString(),
    });

    const cancelled = await this.repo.cancelBoxSchedule(input.scheduleId);

    await this.repo.recordAudit({
      id: randomUUID(),
      correlationId: randomUUID(),
      actor: input.actor,
      action: 'CANCEL_BOX_SCHEDULE',
      entityType: 'NW_BOX_SCHEDULE',
      entityId: schedule.id,
      afterState: JSON.stringify(cancelled),
      createdAt: new Date().toISOString(),
    });

    return cancelled;
  }

  // -------------------------------------------------------------------
  // Correção de Serial de ONT em Campo
  // -------------------------------------------------------------------
  public async overrideSerial(input: {
    itemId: string;
    newSerial: string;
    reason: SerialChangeReason;
    observation?: string;
    actor: string;
  }): Promise<MigrationItem> {
    const item = await this.repo.getItemById(input.itemId);
    if (!item) throw new NotFoundError(`MigrationItem ${input.itemId} não encontrado.`);

    const oldSerial = item.ontSerialEffective;
    if (oldSerial === input.newSerial) {
      throw new AppError('O novo serial informado é idêntico ao serial atual.', 400);
    }

    await this.repo.recordSerialChange({
      id: randomUUID(),
      itemId: item.id,
      originalSerial: item.ontSerialOriginal,
      newSerial: input.newSerial,
      reason: input.reason,
      observation: input.observation,
      changedBy: input.actor,
      changedAt: new Date().toISOString(),
    });

    const updated = await this.repo.updateItem(item.id, {
      ontSerialEffective: input.newSerial,
    });

    await this.repo.recordAudit({
      id: randomUUID(),
      correlationId: randomUUID(),
      actor: input.actor,
      action: 'OVERRIDE_SERIAL',
      entityType: 'NW_MIGRATION_ITEM',
      entityId: item.id,
      beforeState: JSON.stringify({ effectiveSerial: oldSerial }),
      afterState: JSON.stringify({ effectiveSerial: input.newSerial, reason: input.reason }),
      createdAt: new Date().toISOString(),
    });

    return updated;
  }

  // -------------------------------------------------------------------
  // Cutover Massivo (Comando Massivo, Execução Individual em 13 Etapas)
  // -------------------------------------------------------------------
  public async executeCutover(input: {
    maId: string;
    targetBoxId?: string;
    itemIds?: string[];
    actor: string;
  }) {
    let itemsToMigrate: MigrationItem[] = [];
    if (input.itemIds && input.itemIds.length > 0) {
      for (const id of input.itemIds) {
        const it = await this.repo.getItemById(id);
        if (it) itemsToMigrate.push(it);
      }
    } else if (input.targetBoxId) {
      itemsToMigrate = await this.repo.getItemsByBox(input.targetBoxId);
      itemsToMigrate = itemsToMigrate.filter((i) => ['OS_CREATED', 'SCHEDULED', 'IN_FIELD'].includes(i.migrationStatus));
    }

    if (itemsToMigrate.length === 0) {
      throw new AppError('Nenhum cliente elegível para cutover encontrado.', 400);
    }

    const batch = await this.repo.createCutoverBatch({
      id: `CUT-${randomUUID().substring(0, 8).toUpperCase()}`,
      maId: input.maId,
      targetBoxId: input.targetBoxId,
      totalItems: itemsToMigrate.length,
      successCount: 0,
      failedCount: 0,
      status: 'PROCESSING',
      executedBy: input.actor,
      createdAt: new Date().toISOString(),
    });

    for (const item of itemsToMigrate) {
      const cutoverItem = await this.repo.createCutoverItem({
        id: randomUUID(),
        cutoverBatchId: batch.id,
        itemId: item.id,
        executionStage: 'VALIDATING_PRECONDITIONS',
        status: 'IN_PROGRESS',
        startedAt: new Date().toISOString(),
      });

      try {
        await this.repo.updateItem(item.id, { migrationStatus: 'ACTIVATING' });

        // Etapa 1 a 4: Validação do item, OS, SA e serial efetivo
        if (!item.osId || !item.saId) {
          throw new AppError('OS ou SA ausente para o cliente.', 400, 'MISSING_ORDER');
        }
        if (!item.ontSerialEffective) {
          throw new AppError('Serial efetivo da ONT não definido.', 400, 'MISSING_SERIAL');
        }

        // Etapa 5: Associar ONT ao recurso V.tal
        cutoverItem.executionStage = 'ASSOCIATING_PORT';
        await this.inventoryService.associateOntToPort({
          ontSerial: item.ontSerialEffective,
          targetBoxId: item.targetBoxId || '',
          targetHcId: item.targetHcId || '',
        });

        // Etapa 6 a 9: Diagnóstico óptico e validação de descoberta
        cutoverItem.executionStage = 'DIAGNOSING_ONT';
        const diag = await this.diagnosticsService.diagnoseOnt(
          item.ontSerialEffective,
          item.targetBoxId || '',
        );

        cutoverItem.opticalPowerRx = diag.opticalPowerRx;
        cutoverItem.opticalPowerTx = diag.opticalPowerTx;
        cutoverItem.diagnosticsResult = diag.details;

        if (!diag.discovered || !diag.parametersValid) {
          throw new AppError(
            diag.errorDescription || 'ONT não sincronizou ou parâmetros ópticos fora da faixa.',
            400,
            diag.errorCode || 'DIAGNOSTICS_FAILED',
          );
        }

        // Etapa 10: Encerrar atividade WFM
        cutoverItem.executionStage = 'CLOSING_WFM';
        await this.workforceService.closeActivity(item.saId);

        // Etapa 11 e 12: Encerrar SA e OS
        cutoverItem.executionStage = 'CLOSING_ORDERS';
        await this.fulfillmentService.closeSa(item.saId);
        await this.fulfillmentService.closeOs(item.osId);

        // Etapa 13: Marcar MIGRATED
        cutoverItem.executionStage = 'COMPLETED';
        cutoverItem.status = 'SUCCESS';
        cutoverItem.completedAt = new Date().toISOString();

        await this.repo.updateItem(item.id, {
          migrationStatus: 'MIGRATED',
          migratedAt: new Date().toISOString(),
          errorStage: undefined,
          errorCode: undefined,
          errorDescription: undefined,
        });

        batch.successCount++;
      } catch (err: any) {
        cutoverItem.status = 'FAILED';
        cutoverItem.errorCode = err.code || 'CUTOVER_ERROR';
        cutoverItem.errorDescription = err.message;
        cutoverItem.completedAt = new Date().toISOString();

        await this.repo.updateItem(item.id, {
          migrationStatus: 'MIGRATION_FAILED',
          errorStage: cutoverItem.executionStage,
          errorCode: cutoverItem.errorCode,
          errorDescription: cutoverItem.errorDescription,
        });

        batch.failedCount++;
      }
    }

    batch.status =
      batch.failedCount === 0
        ? 'COMPLETED'
        : batch.successCount > 0
          ? 'PARTIALLY_FAILED'
          : 'FAILED';
    batch.completedAt = new Date().toISOString();
    await this.repo.updateCutoverBatch(batch.id, {
      successCount: batch.successCount,
      failedCount: batch.failedCount,
      status: batch.status,
      completedAt: batch.completedAt,
    });

    // Se todos os itens da CDO estiverem migrados, atualizar BoxSchedule para COMPLETED
    const affectedBoxes = new Set<string>();
    if (input.targetBoxId) affectedBoxes.add(input.targetBoxId);
    for (const it of itemsToMigrate) {
      if (it.targetBoxId) affectedBoxes.add(it.targetBoxId);
    }

    for (const boxId of affectedBoxes) {
      const allBoxItems = await this.repo.getItemsByBox(boxId);
      if (allBoxItems.length > 0 && allBoxItems.every((i) => i.migrationStatus === 'MIGRATED')) {
        const boxSchedule = await this.repo.getBoxSchedule(input.maId, boxId);
        if (boxSchedule && boxSchedule.scheduleStatus !== 'COMPLETED') {
          boxSchedule.scheduleStatus = 'COMPLETED';
          boxSchedule.updatedAt = new Date().toISOString();
          boxSchedule.updatedBy = input.actor || 'SYSTEM';
          await this.repo.saveBoxSchedule(boxSchedule);
        }
      }
    }

    return batch;
  }

  // -------------------------------------------------------------------
  // Atualização Cadastral de Endereço (Saneamento / Repescagem)
  // -------------------------------------------------------------------
  public async updateItemAddress(input: {
    itemId: string;
    rawAddress: string;
    cep: string;
    city: string;
    stateOrUf: string;
    actor?: string;
  }): Promise<MigrationItem> {
    const item = await this.repo.getItemById(input.itemId);
    if (!item) throw new NotFoundError(`MigrationItem ${input.itemId} não encontrado.`);

    const updated = await this.repo.updateItem(input.itemId, {
      rawAddress: input.rawAddress,
      cep: input.cep,
      city: input.city,
      stateOrUf: input.stateOrUf.toUpperCase(),
      updatedAt: new Date().toISOString(),
    });

    await this.repo.recordAudit({
      id: randomUUID(),
      correlationId: randomUUID(),
      actor: input.actor || 'OPERATOR',
      action: 'UPDATE_ITEM_ADDRESS',
      entityType: 'NW_MIGRATION_ITEM',
      entityId: input.itemId,
      afterState: JSON.stringify({
        rawAddress: input.rawAddress,
        cep: input.cep,
        city: input.city,
        stateOrUf: input.stateOrUf,
      }),
      createdAt: new Date().toISOString(),
    });

    return updated;
  }

  // -------------------------------------------------------------------
  // Retentativa / Repescagem Individual de Item com Exceção ou Falha
  // -------------------------------------------------------------------
  public async retryItem(itemId: string, actor: string = 'OPERATOR') {
    const item = await this.repo.getItemById(itemId);
    if (!item) throw new NotFoundError(`MigrationItem ${itemId} não encontrado.`);

    if (['ADDRESS_EXCEPTION', 'NOT_VIABLE', 'IMPORTED', 'READY'].includes(item.migrationStatus)) {
      return this.prepareItems({
        maId: item.maId,
        itemIds: [item.id],
      });
    }

    if (item.migrationStatus !== 'MIGRATION_FAILED') {
      throw new AppError(`Apenas itens com exceção cadastral ou status MIGRATION_FAILED podem ser retentados (status atual: ${item.migrationStatus}).`, 400);
    }

    return this.executeCutover({
      maId: item.maId,
      itemIds: [item.id],
      actor,
    });
  }

  // -------------------------------------------------------------------
  // Rollback Formal
  // -------------------------------------------------------------------
  public async requestRollback(input: {
    itemId: string;
    reason: string;
    actor: string;
  }) {
    const item = await this.repo.getItemById(input.itemId);
    if (!item) throw new NotFoundError(`MigrationItem ${input.itemId} não encontrado.`);

    const rollback = {
      id: `RB-${randomUUID().substring(0, 8).toUpperCase()}`,
      itemId: item.id,
      originBoxId: item.originBoxId,
      reason: input.reason,
      status: 'ROLLED_BACK' as const,
      requestedBy: input.actor,
      requestedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    await this.repo.createRollback(rollback);
    await this.repo.updateItem(item.id, {
      migrationStatus: 'ROLLED_BACK',
      errorStage: 'ROLLBACK',
      errorCode: 'ROLLED_BACK_TO_ORIGIN',
      errorDescription: input.reason,
    });

    await this.repo.recordAudit({
      id: randomUUID(),
      correlationId: randomUUID(),
      actor: input.actor,
      action: 'ROLLBACK_ITEM',
      entityType: 'NW_MIGRATION_ITEM',
      entityId: item.id,
      afterState: JSON.stringify(rollback),
      createdAt: new Date().toISOString(),
    });

    return rollback;
  }

  // -------------------------------------------------------------------
  // Métricas do Dashboard e Desmobilização de Caixas de Origem
  // -------------------------------------------------------------------
  public async getDashboardMetrics(maId?: string): Promise<DashboardMetrics> {
    return this.repo.getDashboardMetrics(maId);
  }

  public async getStrategicOverview(): Promise<StrategicOverviewItem[]> {
    return this.repo.getStrategicOverview();
  }

  public async listDecommissionBoxes(maId?: string): Promise<DecommissionBoxMetric[]> {
    return this.repo.listDecommissionBoxes(maId);
  }

  private async ensureBoxSchedule(
    maId: string,
    targetBoxId: string,
    boxType: string,
    municipality: string,
    neighborhood: string,
  ): Promise<void> {
    const existing = await this.repo.getBoxSchedule(maId, targetBoxId);
    if (existing) {
      existing.totalCustomers++;
      existing.totalOrders = existing.totalCustomers;
      await this.repo.saveBoxSchedule(existing);
    } else {
      await this.repo.saveBoxSchedule({
        id: `SCHED-${randomUUID().substring(0, 8).toUpperCase()}`,
        maId,
        targetBoxId,
        targetBoxType: boxType,
        municipality,
        neighborhood,
        totalCustomers: 1,
        totalOrders: 1,
        scheduleStatus: 'AVAILABLE',
        createdAt: new Date().toISOString(),
        createdBy: 'SYSTEM',
        updatedAt: new Date().toISOString(),
        updatedBy: 'SYSTEM',
      });
    }
  }
}
