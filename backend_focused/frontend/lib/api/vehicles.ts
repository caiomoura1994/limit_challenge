import { apiClient } from '@/lib/api-client';
import type {
  MaintenancePage,
  SaveInput,
  Vehicle,
  VehicleAssignmentInput,
  VehicleDetail,
  VehicleDuplicateInput,
  VehicleDuplicateResult,
  VehicleFilters,
  VehicleInput,
  VehicleNeedingMaintenancePage,
  VehiclePage,
} from './types';

export const vehiclesApi = {
  async list(filters: VehicleFilters = {}, signal?: AbortSignal) {
    const { data } = await apiClient.get<VehiclePage>('/vehicles/', { params: filters, signal });
    return data;
  },
  async detail(id: number, signal?: AbortSignal) {
    const { data } = await apiClient.get<VehicleDetail>(`/vehicles/${id}/`, {
      signal,
      timeout: 120_000,
      responseType: 'json',
      transitional: { silentJSONParsing: false },
    });
    return data;
  },
  async needingMaintenance(page = 1, signal?: AbortSignal) {
    const { data } = await apiClient.get<VehicleNeedingMaintenancePage>(
      '/vehicles/needing-maintenance/',
      {
        params: { page },
        signal,
      },
    );
    return data;
  },
  async maintenanceHistory(id: number, page = 1, signal?: AbortSignal) {
    const { data } = await apiClient.get<MaintenancePage>(`/vehicles/${id}/maintenance-history/`, {
      params: { page },
      signal,
    });
    return data;
  },
  async save({ id, data: input }: SaveInput<VehicleInput>) {
    const { data } = id
      ? await apiClient.put<Vehicle>(`/vehicles/${id}/`, input)
      : await apiClient.post<Vehicle>('/vehicles/', input);
    return data;
  },
  async remove(id: number) {
    await apiClient.delete(`/vehicles/${id}/`);
  },
  async assignOffice({ id, ...input }: VehicleAssignmentInput & { id: number }) {
    const { data } = await apiClient.post<Vehicle>(`/vehicles/${id}/assign-office/`, input);
    return data;
  },
  async duplicateCheck(input: VehicleDuplicateInput) {
    const { data } = await apiClient.post<VehicleDuplicateResult>(
      '/vehicles/duplicate-check/',
      input,
    );
    return data;
  },
};
