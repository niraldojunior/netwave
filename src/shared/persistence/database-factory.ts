import type { MigrationRepository } from './repositories.js';
import { InMemoryMigrationRepository } from './in-memory-migration-repository.js';
import { OracleMigrationRepository } from './oracle-migration-repository.js';
import { createLogger } from '../logging/logger.js';
import { randomUUID } from 'node:crypto';

const logger = createLogger('info');

let repositoryInstance: MigrationRepository | null = null;

const seedInMemoryData = async (repo: InMemoryMigrationRepository): Promise<void> => {
  // 1. Loviz - Fazenda Rio Grande (PR) [ACTIVE]
  const ma1 = await repo.createMa({
    id: 'MA-FIBRASUL-RJ',
    name: 'Loviz - Fazenda Rio Grande',
    originProvider: 'Loviz',
    description: 'Aquisição da base regional de Fazenda Rio Grande e região metropolitana',
    startDate: '2026-07-01',
    status: 'ACTIVE',
    uf: 'PR',
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM_SEED',
    updatedAt: new Date().toISOString(),
  });

  // 2. Onitel - Brasília (DF) [ACTIVE]
  const ma2 = await repo.createMa({
    id: 'MA-CONECTA-SP',
    name: 'Onitel - Brasília',
    originProvider: 'Onitel',
    description: 'Aquisição da base regional de Brasília e entorno',
    startDate: '2026-08-01',
    status: 'ACTIVE',
    uf: 'DF',
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM_SEED',
    updatedAt: new Date().toISOString(),
  });

  // 3. Tapi - Rio de Janeiro (RJ) [NEGOTIATION]
  await repo.createMa({
    id: 'MA-07B7797C',
    name: 'Tapi - Rio de Janeiro',
    originProvider: 'Tapi',
    description: 'Operação regional da base Rio de Janeiro',
    startDate: '2026-09-23',
    status: 'NEGOTIATION',
    uf: 'RJ',
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM_SEED',
    updatedAt: new Date().toISOString(),
  });

  // 4. Domina - Sinop (MT) [NEGOTIATION]
  await repo.createMa({
    id: 'MA-8630F18B',
    name: 'Domina - Sinop',
    originProvider: 'Domina',
    description: 'Operação regional de Sinop',
    startDate: '2026-09-23',
    status: 'NEGOTIATION',
    uf: 'MT',
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM_SEED',
    updatedAt: new Date().toISOString(),
  });

  // 5. SIM Digital - Florianópolis (SC) [NEGOTIATION]
  await repo.createMa({
    id: 'MA-1331D5D5',
    name: 'SIM Digital - Florianópolis',
    originProvider: 'SIM Digital',
    description: 'Operação regional de Florianópolis',
    startDate: '2026-09-23',
    status: 'NEGOTIATION',
    uf: 'SC',
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM_SEED',
    updatedAt: new Date().toISOString(),
  });

  // 6. Peaple Telecom - Caxias do Sul (RS) [NEGOTIATION]
  await repo.createMa({
    id: 'MA-6780EF05',
    name: 'Peaple Telecom - Caxias do Sul',
    originProvider: 'Peaple Telecom',
    description: 'Operação regional de Caxias do Sul',
    startDate: '2026-09-23',
    status: 'NEGOTIATION',
    uf: 'RS',
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM_SEED',
    updatedAt: new Date().toISOString(),
  });

  // 7. Tenonet - Belém (PA) [NEGOTIATION]
  await repo.createMa({
    id: 'MA-D06B415A',
    name: 'Tenonet - Belém',
    originProvider: 'Tenonet',
    description: 'Operação regional de Belém',
    startDate: '2026-09-23',
    status: 'NEGOTIATION',
    uf: 'PA',
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM_SEED',
    updatedAt: new Date().toISOString(),
  });

  // 8. 8G - Águas Lindas de Goiás (GO) [NEGOTIATION]
  await repo.createMa({
    id: 'MA-562B6545',
    name: '8G - Águas Lindas de Goiás',
    originProvider: '8G',
    description: 'Operação regional de Águas Lindas de Goiás',
    startDate: '2026-09-23',
    status: 'NEGOTIATION',
    uf: 'GO',
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM_SEED',
    updatedAt: new Date().toISOString(),
  });

  // Technicians (Loviz - Fazenda Rio Grande)
  const t1 = await repo.createTechnician({
    id: 'TECH-001',
    maId: ma1.id,
    externalTechId: 'MAT-4091',
    name: 'Carlos Mendes',
    vendorCompany: 'Conecta Telecom',
    city: 'Fazenda Rio Grande',
    uf: 'PR',
    dailyCapacity: 8,
    status: 'ACTIVE',
    joinedAt: '2026-09-01T08:00:00Z',
    createdAt: new Date().toISOString(),
  });

  const t2 = await repo.createTechnician({
    id: 'TECH-002',
    maId: ma1.id,
    externalTechId: 'MAT-4092',
    name: 'Bruno Souza',
    vendorCompany: 'Rede Mais',
    city: 'Fazenda Rio Grande',
    uf: 'PR',
    dailyCapacity: 8,
    status: 'ACTIVE',
    joinedAt: '2026-09-01T08:00:00Z',
    createdAt: new Date().toISOString(),
  });

  // Technician (Onitel - Brasília)
  await repo.createTechnician({
    id: 'TECH-003',
    maId: ma2.id,
    externalTechId: 'MAT-5011',
    name: 'Marcos Oliveira',
    vendorCompany: 'V.tal Parceiros',
    city: 'Brasília',
    uf: 'DF',
    dailyCapacity: 8,
    status: 'ACTIVE',
    joinedAt: '2026-09-01T08:00:00Z',
    createdAt: new Date().toISOString(),
  });

  // Lot
  const lot1 = await repo.createLot({
    id: 'LOT-RJ-001',
    maId: ma1.id,
    fileName: 'lote_icarai_clientes.csv',
    totalRecords: 12,
    validRecords: 10,
    rejectedRecords: 1,
    duplicateRecords: 1,
    importStatus: 'COMPLETED',
    importedBy: 'OPERATOR',
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Seed Items
  const items = [
    {
      id: 'ITEM-01',
      maId: ma1.id,
      lotId: lot1.id,
      customerId: 'CRM-101',
      externalCustomerId: 'CUST-RJ-901',
      subscriptionId: 'SUB-101',
      customerName: 'Maria Aparecida Silva',
      rawAddress: 'Rua Coronel Moreira Cesar, 102, Icaraí',
      cep: '24230-050',
      street: 'Rua Coronel Moreira Cesar',
      streetNr: '102',
      neighborhood: 'Icaraí',
      city: 'Niterói',
      stateOrUf: 'RJ',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-01',
      targetBoxId: 'CDO-VTAL-NIT-01',
      targetBoxType: 'CDO',
      targetHcId: 'HC-01',
      ontSerialOriginal: 'ALCLB440192',
      ontSerialEffective: 'ALCLB440192',
      crmOrderId: 'ORD-NIO-901',
      osId: 'OS-VT-00901',
      saId: 'SA-VT-00901',
      migrationStatus: 'SCHEDULED' as const,
      scheduledDate: '2026-09-25',
      technicianId: t1.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ITEM-02',
      maId: ma1.id,
      lotId: lot1.id,
      customerId: 'CRM-102',
      externalCustomerId: 'CUST-RJ-902',
      subscriptionId: 'SUB-102',
      customerName: 'João Pedro Santos',
      rawAddress: 'Rua Coronel Moreira Cesar, 104, Icaraí',
      cep: '24230-050',
      street: 'Rua Coronel Moreira Cesar',
      streetNr: '104',
      neighborhood: 'Icaraí',
      city: 'Niterói',
      stateOrUf: 'RJ',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-01',
      targetBoxId: 'CDO-VTAL-NIT-01',
      targetBoxType: 'CDO',
      targetHcId: 'HC-02',
      ontSerialOriginal: 'ALCLB440193',
      ontSerialEffective: 'ALCLB440193',
      crmOrderId: 'ORD-NIO-902',
      osId: 'OS-VT-00902',
      saId: 'SA-VT-00902',
      migrationStatus: 'SCHEDULED' as const,
      scheduledDate: '2026-09-25',
      technicianId: t1.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ITEM-03',
      maId: ma1.id,
      lotId: lot1.id,
      customerId: 'CRM-103',
      externalCustomerId: 'CUST-RJ-903',
      subscriptionId: 'SUB-103',
      customerName: 'Ana Claudia Oliveira',
      rawAddress: 'Rua Coronel Moreira Cesar, 110, Icaraí',
      cep: '24230-050',
      street: 'Rua Coronel Moreira Cesar',
      streetNr: '110',
      neighborhood: 'Icaraí',
      city: 'Niterói',
      stateOrUf: 'RJ',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-01',
      targetBoxId: 'CDO-VTAL-NIT-01',
      targetBoxType: 'CDO',
      targetHcId: 'HC-03',
      ontSerialOriginal: 'ALCLB440194',
      ontSerialEffective: 'ALCLB440999',
      crmOrderId: 'ORD-NIO-903',
      osId: 'OS-VT-00903',
      saId: 'SA-VT-00903',
      migrationStatus: 'IN_FIELD' as const,
      scheduledDate: '2026-09-25',
      technicianId: t1.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ITEM-04',
      maId: ma1.id,
      lotId: lot1.id,
      customerId: 'CRM-104',
      externalCustomerId: 'CUST-RJ-904',
      subscriptionId: 'SUB-104',
      customerName: 'Carlos Eduardo Rocha',
      rawAddress: 'Rua Coronel Moreira Cesar, 118, Icaraí',
      cep: '24230-050',
      street: 'Rua Coronel Moreira Cesar',
      streetNr: '118',
      neighborhood: 'Icaraí',
      city: 'Niterói',
      stateOrUf: 'RJ',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-01',
      targetBoxId: 'CDO-VTAL-NIT-01',
      targetBoxType: 'CDO',
      targetHcId: 'HC-04',
      ontSerialOriginal: 'ALCLB440195',
      ontSerialEffective: 'ALCLB440195',
      crmOrderId: 'ORD-NIO-904',
      osId: 'OS-VT-00904',
      saId: 'SA-VT-00904',
      migrationStatus: 'MIGRATED' as const,
      scheduledDate: '2026-09-23',
      technicianId: t1.name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ITEM-05',
      maId: ma1.id,
      lotId: lot1.id,
      customerId: 'CRM-105',
      externalCustomerId: 'CUST-RJ-905',
      subscriptionId: 'SUB-105',
      customerName: 'Fernanda Costa Lima',
      rawAddress: 'Rua Gavião Peixoto, 45, Icaraí',
      cep: '24230-100',
      street: 'Rua Gavião Peixoto',
      streetNr: '45',
      neighborhood: 'Icaraí',
      city: 'Niterói',
      stateOrUf: 'RJ',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-02',
      targetBoxId: 'CDO-VTAL-NIT-02',
      targetBoxType: 'CDO',
      targetHcId: 'HC-05',
      ontSerialOriginal: 'ALCLB440196',
      ontSerialEffective: 'ALCLB440196',
      crmOrderId: 'ORD-NIO-905',
      osId: 'OS-VT-00905',
      saId: 'SA-VT-00905',
      migrationStatus: 'OS_CREATED' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ITEM-06',
      maId: ma1.id,
      lotId: lot1.id,
      customerId: 'CRM-106',
      externalCustomerId: 'CUST-RJ-906',
      subscriptionId: 'SUB-106',
      customerName: 'Roberto Mendes Souza',
      rawAddress: 'Rua Sem Nome S/N, Morro do Estado',
      cep: '99999-999',
      city: 'Niterói',
      stateOrUf: 'RJ',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-99',
      ontSerialOriginal: 'ALCLB440197',
      ontSerialEffective: 'ALCLB440197',
      migrationStatus: 'ADDRESS_EXCEPTION' as const,
      errorStage: 'TRIAGEM',
      errorCode: 'ERR_ADDRESS_NOT_FOUND',
      errorDescription: 'Logradouro não localizado no geocodificador V.tal.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'ITEM-07',
      maId: ma1.id,
      lotId: lot1.id,
      customerId: 'CRM-107',
      externalCustomerId: 'CUST-RJ-907',
      subscriptionId: 'SUB-107',
      customerName: 'Juliana Martins Dias',
      rawAddress: 'Estrada Caetano Monteiro, 8000, Pendotiba',
      cep: '24320-570',
      city: 'Niterói',
      stateOrUf: 'RJ',
      originProvider: 'Fibrasul',
      originBoxId: 'CDO-FIBRASUL-88',
      ontSerialOriginal: 'ALCLB440198',
      ontSerialEffective: 'ALCLB440198',
      migrationStatus: 'NOT_VIABLE' as const,
      errorStage: 'TRIAGEM',
      errorCode: 'ERR_NO_OPTICAL_VIABILITY',
      errorDescription: 'Distância da CDO V.tal excede 450 metros do drop óptico.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  await repo.createItems(items);

  // Box Schedules
  await repo.saveBoxSchedule({
    id: 'SCHED-NIT-01',
    maId: ma1.id,
    targetBoxId: 'CDO-VTAL-NIT-01',
    targetBoxType: 'CDO',
    municipality: 'Niterói',
    neighborhood: 'Icaraí',
    totalCustomers: 4,
    totalOrders: 4,
    scheduleStatus: 'SCHEDULED',
    scheduledDate: '2026-09-25',
    technicianId: t1.id,
    technicianName: t1.name,
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM_SEED',
    updatedAt: new Date().toISOString(),
    updatedBy: 'SYSTEM_SEED',
  });

  await repo.saveBoxSchedule({
    id: 'SCHED-NIT-02',
    maId: ma1.id,
    targetBoxId: 'CDO-VTAL-NIT-02',
    targetBoxType: 'CDO',
    municipality: 'Niterói',
    neighborhood: 'Icaraí',
    totalCustomers: 1,
    totalOrders: 1,
    scheduleStatus: 'AVAILABLE',
    createdAt: new Date().toISOString(),
    createdBy: 'SYSTEM_SEED',
    updatedAt: new Date().toISOString(),
    updatedBy: 'SYSTEM_SEED',
  });
};

export const getMigrationRepository = (): MigrationRepository => {
  if (repositoryInstance) return repositoryInstance;

  const provider = process.env.DATABASE_PROVIDER || 'in-memory';
  const connString = process.env.ORACLE_CONNECTION_STRING;
  const user = process.env.ORACLE_USER;
  const password = process.env.ORACLE_PASSWORD;

  if (provider === 'oracle' && connString && user && password) {
    logger.info({ provider: 'oracle', connectString: connString }, 'Inicializando repositório Oracle netWave');
    repositoryInstance = new OracleMigrationRepository({
      connectString: connString,
      user,
      password,
      prefix: process.env.ORACLE_OBJECT_PREFIX || 'NW_',
      poolMin: parseInt(process.env.ORACLE_POOL_MIN || '1', 10),
      poolMax: parseInt(process.env.ORACLE_POOL_MAX || '5', 10),
    });
  } else {
    logger.info({ provider: 'in-memory' }, 'Inicializando repositório em memória para netWave com dados de demonstração');
    const inMemRepo = new InMemoryMigrationRepository();
    seedInMemoryData(inMemRepo).catch((e) => logger.error({ err: e }, 'Falha ao semear dados em memória'));
    repositoryInstance = inMemRepo;
  }

  return repositoryInstance;
};

export const setMigrationRepository = (repo: MigrationRepository): void => {
  repositoryInstance = repo;
};
