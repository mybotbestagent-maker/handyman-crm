// Shared TypeScript types for Handyman CRM
// All Prisma-generated types re-exported from @handyman-crm/db
// Additional UI/API types defined here

export type {
  Organization,
  User,
  Customer,
  Property,
  Technician,
  Lead,
  Job,
  JobItem,
  Estimate,
  Invoice,
  Payment,
  Call,
  Attachment,
  AuditLog,
  Role,
  CustomerType,
  EmploymentType,
  LeadStatus,
  JobStatus,
  Priority,
  ItemType,
  EstimateStatus,
  InvoiceStatus,
  PaymentMethod,
  CallDirection,
} from '@handyman-crm/db';

// ---------------------------------------------------------------
// UI-specific types (not in DB)
// ---------------------------------------------------------------

export type SidebarItem = {
  label: string;
  href: string;
  icon: string;
  badge?: number;
};

export type DateRange = {
  from: Date;
  to: Date;
};

export type Pagination = {
  page: number;
  limit: number;
  total: number;
};

export type ApiResponse<T> = {
  data: T;
  error?: string;
};

// Job with includes (common view model)
export type JobWithRelations = Job & {
  customer: Customer;
  property: Property;
  technician?: (Technician & { user: User }) | null;
  items: JobItem[];
};

// Lead with customer
export type LeadWithCustomer = Lead & {
  customer?: Customer | null;
};

import type { Job, Customer, Property, Technician, User, JobItem, Lead } from '@handyman-crm/db';
