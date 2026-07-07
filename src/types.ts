/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Item {
  id: string;
  sku: string;
  name: string;
  category: 'E-Commerce' | 'Manufacturing' | 'Field Service' | 'General';
  unit: string;
  stock: number;
  cost: number;
  supplier: string;
  minSafetyThreshold: number;
}

export interface Location {
  id: string;
  name: string;
  type: 'warehouse' | 'store' | 'vehicle';
  address: string;
}

export interface StockLot {
  id: string;
  itemId: string;
  locationId: string;
  quantity: number;
  batchNo?: string;
  expiryDate?: string;
}

export interface Movement {
  id: string;
  itemId: string;
  fromLocationId: string; // "N/A" if receiving
  toLocationId: string;   // "N/A" if shipping out
  quantity: number;
  createdBy: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  teamId: string;
  role: 'Admin' | 'Manager' | 'Staff';
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string;
  performedAt: string;
  details: string;
}

export interface EcommerceOrder {
  id: string;
  sku: string;
  customerName: string;
  quantity: number;
  status: 'pending' | 'picking' | 'packed' | 'shipped';
  channel: 'Shopify' | 'Amazon' | 'WooCommerce';
  createdAt: string;
}

export interface BOMComponent {
  itemId: string;
  quantity: number;
}

export interface BOM {
  id: string;
  itemId: string; // Finished item ID
  name: string;
  components: BOMComponent[];
  description: string;
}

export interface WorkOrder {
  id: string;
  bomId: string;
  quantity: number;
  status: 'planned' | 'in-progress' | 'completed';
  dueDate: string;
}

export interface TechnicianVan {
  technicianId: string;
  technicianName: string;
  vanId: string;
  stock: { [itemId: string]: number };
}

export interface PartsRequest {
  id: string;
  technicianId: string;
  technicianName: string;
  itemId: string;
  quantity: number;
  status: 'requested' | 'approved' | 'dispatched';
  jobName: string;
  createdAt: string;
}

export interface SlackConfig {
  webhookUrl: string;
  channelName: string;
  enabled: boolean;
}

export interface CustomReport {
  id: string;
  title: string;
  type: string;
  createdAt: string;
  summary: string;
}

export interface DashboardStats {
  totalSkus: number;
  lowStockCount: number;
  pendingOrdersCount: number;
  activeWorkOrdersCount: number;
  activeVansCount: number;
}
