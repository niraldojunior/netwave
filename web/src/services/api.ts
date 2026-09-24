import axios from 'axios';
import type {
  BoxSchedule,
  DashboardMetrics,
  DecommissionBoxMetric,
  Ma,
  MigrationItem,
  MigrationLot,
  StrategicOverviewItem,
  Technician,
} from '../types';

const api = axios.create({
  baseURL: '/api/v1/migration',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const MigrationApi = {
  // Strategic Overview (Multi-M&A)
  getStrategicOverview: async (): Promise<StrategicOverviewItem[]> => {
    const res = await api.get('/metrics/strategic-overview');
    return res.data;
  },

  // Dashboard Metrics
  getDashboardMetrics: async (maId?: string): Promise<DashboardMetrics> => {
    const res = await api.get('/metrics/dashboard', { params: { maId } });
    return res.data;
  },

  // M&A
  listMas: async (): Promise<Ma[]> => {
    const res = await api.get('/ma');
    return res.data;
  },

  createMa: async (data: { name: string; originProvider: string; startDate: string; uf: string; description?: string }): Promise<Ma> => {
    const res = await api.post('/ma', data);
    return res.data;
  },

  updateMa: async (id: string, data: Partial<Ma>): Promise<Ma> => {
    const res = await api.put(`/ma/${id}`, data);
    return res.data;
  },

  deleteMa: async (id: string): Promise<{ success: boolean }> => {
    const res = await api.delete(`/ma/${id}`);
    return res.data;
  },

  // Technicians
  listTechnicians: async (maId: string): Promise<Technician[]> => {
    const res = await api.get('/technicians', { params: { maId } });
    return res.data;
  },

  createTechnician: async (data: {
    maId: string;
    externalTechId: string;
    name: string;
    vendorCompany: string;
    city?: string;
    uf?: string;
    dailyCapacity?: number;
  }): Promise<Technician> => {
    const res = await api.post('/technicians', data);
    return res.data;
  },

  updateTechnician: async (
    id: string,
    data: Partial<Pick<Technician, 'externalTechId' | 'name' | 'vendorCompany' | 'city' | 'uf' | 'dailyCapacity' | 'status'>>
  ): Promise<Technician> => {
    const res = await api.put(`/technicians/${id}`, data);
    return res.data;
  },

  // Lots
  listLots: async (maId?: string): Promise<MigrationLot[]> => {
    const res = await api.get('/lots', { params: { maId } });
    return res.data;
  },

  uploadLot: async (data: {
    maId: string;
    fileName: string;
    actor: string;
    rows: any[];
  }): Promise<MigrationLot> => {
    const res = await api.post('/lots/upload', data);
    return res.data;
  },

  // Items
  listItems: async (params: {
    maId?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
    municipality?: string;
    targetBoxId?: string;
    hasOs?: boolean;
  }): Promise<{ items: MigrationItem[]; total: number }> => {
    const res = await api.get('/items', { params });
    return res.data;
  },

  prepareItems: async (data: { maId: string; itemIds?: string[]; lotId?: string }) => {
    const res = await api.post('/items/prepare', data);
    return res.data;
  },

  overrideSerial: async (itemId: string, data: { newSerial: string; reason: string; observation?: string }) => {
    const res = await api.patch(`/items/${itemId}/serial`, data);
    return res.data;
  },

  updateItemAddress: async (itemId: string, data: { rawAddress: string; cep: string; city: string; stateOrUf: string }) => {
    const res = await api.patch(`/items/${itemId}/address`, data);
    return res.data;
  },

  retryItem: async (itemId: string) => {
    const res = await api.post(`/items/${itemId}/retry`);
    return res.data;
  },

  rollbackItem: async (itemId: string, reason: string) => {
    const res = await api.post(`/items/${itemId}/rollback`, { reason });
    return res.data;
  },

  // Orders
  authorizeOsBatch: async (data: { maId: string; itemIds?: string[] }) => {
    const res = await api.post('/os/batches', data);
    return res.data;
  },

  // Schedules (CDO/CDOI)
  listBoxSchedules: async (params: {
    maId?: string;
    status?: string;
    municipality?: string;
    neighborhood?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ schedules: BoxSchedule[]; total: number }> => {
    const res = await api.get('/box-schedules', { params });
    return res.data;
  },

  scheduleBox: async (data: {
    maId: string;
    targetBoxId: string;
    scheduledDate: string;
    technicianId: string;
  }): Promise<BoxSchedule> => {
    const res = await api.post('/box-schedules', data);
    return res.data;
  },

  cancelBoxSchedule: async (scheduleId: string): Promise<BoxSchedule> => {
    const res = await api.post('/box-schedules/cancel', { scheduleId });
    return res.data;
  },

  // Cutover
  executeCutover: async (data: { maId: string; targetBoxId?: string; itemIds?: string[] }) => {
    const res = await api.post('/cutovers', data);
    return res.data;
  },

  // Decommission
  listDecommissionBoxes: async (maId?: string): Promise<DecommissionBoxMetric[]> => {
    const res = await api.get('/decommission/boxes', { params: { maId } });
    return res.data;
  },
};
