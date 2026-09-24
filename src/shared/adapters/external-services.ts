export interface AddressMatchResult {
  geographicAddressId: string;
  normalizedStreet: string;
  normalizedNumber: string;
  normalizedCity: string;
  normalizedUf: string;
  score: number;
  matched: boolean;
  errorCode?: 'ADDRESS_NOT_FOUND' | 'ADDRESS_AMBIGUOUS' | 'INVALID_CEP';
}

export interface AddressService {
  normalizeAndMatch(rawAddress: string, cep: string, city: string, uf: string): Promise<AddressMatchResult>;
}

export interface ViabilityCheckResult {
  viable: boolean;
  viabilityId: string;
  targetInventoryId: string;
  targetHcId: string;
  targetBoxId: string;
  targetBoxType: 'CDO' | 'CDOI';
  errorCode?: 'NO_NETWORK_COVERAGE' | 'NO_AVAILABLE_PORT' | 'NO_HC' | 'INVALID_INVENTORY' | 'BLOCKED_AREA';
}

export interface ViabilityService {
  checkViability(geographicAddressId: string): Promise<ViabilityCheckResult>;
}

export interface SalesforceOrderResult {
  crmOrderId: string;
  osId: string;
  status: 'SUCCESS' | 'FAILED';
  errorCode?: string;
  errorDescription?: string;
}

export interface SalesforceOrderService {
  createMigrationOrder(params: {
    customerId: string;
    subscriptionId: string;
    targetHcId: string;
    reuseOnt: boolean;
    orderJourney: 'CHANGE_ADDRESS';
    migrationType: 'MASS_MIGRATION';
    migrationReason: 'M_AND_A';
  }): Promise<SalesforceOrderResult>;
}

export interface FulfillmentSaResult {
  saId: string;
  status: 'SUCCESS' | 'FAILED';
  parkedToBuffer: boolean;
  errorCode?: string;
  errorDescription?: string;
}

export interface FulfillmentService {
  createAndEnrichSa(params: {
    osId: string;
    customerId: string;
    ontSerial: string;
    targetBoxId: string;
  }): Promise<FulfillmentSaResult>;
  closeSa(saId: string): Promise<boolean>;
  closeOs(osId: string): Promise<boolean>;
}

export interface WorkforceService {
  assignToTechnician(saId: string, technicianId: string, scheduledDate: string): Promise<boolean>;
  closeActivity(saId: string): Promise<boolean>;
}

export interface InventoryService {
  associateOntToPort(params: {
    ontSerial: string;
    targetBoxId: string;
    targetHcId: string;
  }): Promise<{ success: boolean; portId: string }>;
}

export interface DiagnosticsResult {
  discovered: boolean;
  opticalPowerRx: number;
  opticalPowerTx: number;
  parametersValid: boolean;
  details?: string;
  errorCode?: string;
  errorDescription?: string;
}

export interface DiagnosticsService {
  diagnoseOnt(ontSerial: string, targetBoxId: string): Promise<DiagnosticsResult>;
}

// ---------------------------------------------------------------------
// Default / Mock Adapters for testing, dev, and non-blocking operation
// ---------------------------------------------------------------------

export class DefaultAddressService implements AddressService {
  public async normalizeAndMatch(rawAddress: string, cep: string, city: string, uf: string): Promise<AddressMatchResult> {
    if (!cep || cep.replace(/\D/g, '').length !== 8) {
      return {
        geographicAddressId: '',
        normalizedStreet: '',
        normalizedNumber: '',
        normalizedCity: city,
        normalizedUf: uf,
        score: 0,
        matched: false,
        errorCode: 'INVALID_CEP',
      };
    }

    if (rawAddress.toLowerCase().includes('invalido') || rawAddress.toLowerCase().includes('nao encontrado')) {
      return {
        geographicAddressId: '',
        normalizedStreet: '',
        normalizedNumber: '',
        normalizedCity: city,
        normalizedUf: uf,
        score: 0,
        matched: false,
        errorCode: 'ADDRESS_NOT_FOUND',
      };
    }

    const cleanCep = cep.replace(/\D/g, '');
    const id = `GEO-VT-${cleanCep.substring(0, 5)}-${Math.floor(1000 + Math.random() * 9000)}`;

    return {
      geographicAddressId: id,
      normalizedStreet: rawAddress.split(',')[0]?.trim() || rawAddress,
      normalizedNumber: '100',
      normalizedCity: city,
      normalizedUf: uf,
      score: 0.95,
      matched: true,
    };
  }
}

export class DefaultViabilityService implements ViabilityService {
  public async checkViability(geographicAddressId: string): Promise<ViabilityCheckResult> {
    if (geographicAddressId.includes('BLOQUEADO')) {
      return {
        viable: false,
        viabilityId: '',
        targetInventoryId: '',
        targetHcId: '',
        targetBoxId: '',
        targetBoxType: 'CDO',
        errorCode: 'BLOCKED_AREA',
      };
    }

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const boxNumber = (randomSuffix % 5) + 1;
    return {
      viable: true,
      viabilityId: `VIAB-VT-${randomSuffix}`,
      targetInventoryId: `INV-VT-${randomSuffix}`,
      targetHcId: `HC-VT-${randomSuffix}`,
      targetBoxId: `CDO-VT-00${boxNumber}`,
      targetBoxType: 'CDO',
    };
  }
}

let osCounter = 100000;
let saCounter = 100000;

export class DefaultSalesforceOrderService implements SalesforceOrderService {
  public async createMigrationOrder(params: {
    customerId: string;
    subscriptionId: string;
    targetHcId: string;
    reuseOnt: boolean;
    orderJourney: 'CHANGE_ADDRESS';
    migrationType: 'MASS_MIGRATION';
    migrationReason: 'M_AND_A';
  }): Promise<SalesforceOrderResult> {
    // If customerId contains 'FAIL_OS', simulate failure
    if (params.customerId.includes('FAIL_OS')) {
      return {
        crmOrderId: '',
        osId: '',
        status: 'FAILED',
        errorCode: 'SALESFORCE_REJECTED',
        errorDescription: 'Limite de crédito ou pendência cadastral no Salesforce',
      };
    }

    const id = ++osCounter;
    return {
      crmOrderId: `CRM-${id}`,
      osId: `OS-VT-${id}`,
      status: 'SUCCESS',
    };
  }
}

export class DefaultFulfillmentService implements FulfillmentService {
  public async createAndEnrichSa(params: {
    osId: string;
    customerId: string;
    ontSerial: string;
    bufferTechnicianId: string;
    targetBoxId: string;
  }): Promise<FulfillmentSaResult> {
    if (params.osId.includes('FAIL_SA')) {
      return {
        saId: '',
        status: 'FAILED',
        parkedToBuffer: false,
        errorCode: 'FULFILLMENT_REJECTED',
        errorDescription: 'Falha no enriquecimento de SA no sistema de Fulfillment',
      };
    }

    const id = ++saCounter;
    return {
      saId: `SA-VT-${id}`,
      status: 'SUCCESS',
      parkedToBuffer: true,
    };
  }

  public async closeSa(_saId: string): Promise<boolean> {
    return true;
  }

  public async closeOs(_osId: string): Promise<boolean> {
    return true;
  }
}

export class DefaultWorkforceService implements WorkforceService {
  public async assignToTechnician(_saId: string, _technicianId: string, _scheduledDate: string): Promise<boolean> {
    return true;
  }

  public async closeActivity(_saId: string): Promise<boolean> {
    return true;
  }
}

export class DefaultInventoryService implements InventoryService {
  public async associateOntToPort(params: {
    ontSerial: string;
    targetBoxId: string;
    targetHcId: string;
  }): Promise<{ success: boolean; portId: string }> {
    return {
      success: true,
      portId: `PORT-VT-${params.targetBoxId}-01`,
    };
  }
}

export class DefaultDiagnosticsService implements DiagnosticsService {
  public async diagnoseOnt(ontSerial: string, _targetBoxId: string): Promise<DiagnosticsResult> {
    // If serial contains 'FAIL_CUTOVER', simulate failure
    if (ontSerial.includes('FAIL_CUTOVER')) {
      return {
        discovered: false,
        opticalPowerRx: -38.5,
        opticalPowerTx: 0.0,
        parametersValid: false,
        errorCode: 'ONT_NOT_DISCOVERED',
        errorDescription: 'ONT não encontrada no canal GPON / Potência óptica atenuada (-38.5 dBm)',
      };
    }

    return {
      discovered: true,
      opticalPowerRx: -19.4,
      opticalPowerTx: 2.3,
      parametersValid: true,
      details: 'Potência óptica normal: Rx = -19.4 dBm, Tx = 2.3 dBm. GPON link sync OK.',
    };
  }
}
