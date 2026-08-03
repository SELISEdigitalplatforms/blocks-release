





export interface RegisteredService {
  itemId: string;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string;
  language: string;
  lastUpdatedBy: string;
  organizationIds: string[];
  tags: string[];
  name: string;
  url: string;
  environment: string;
  type: number;
  description: string;
  serviceId: string;
  metadata: Record<string, string>;
  serviceBusConnectionString: string;
  tenantId: string;
  serviceType: string;
}






// // Get All Services
export interface IGetAllServicesPayload {
  page: number;
  pageSize: number;
  sort?: {
    property: string;
    isDescending: boolean;
  };
  filter?: {
    serviceId: string;
    serviceName: string;
    serviceType: number | string;
  };
  projectKey: string;
}

export interface IGetAllServicesResponse {
  data: RegisteredService[];
  totalCount: number;
  errors?: unknown;
}
