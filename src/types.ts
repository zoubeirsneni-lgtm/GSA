/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface UserRights {
  uid: string;
  email: string;
  role: 'super_admin' | 'admin';
  permissions: string[]; // List of categories they are authorized to edit
  createdAt: any; // Firestore timestamp
}

export interface StaffMember {
  id: string;
  name: string;
  role: string; // position/poste
  phone: string;
}

export interface Category {
  id: string; // Unique slug or ID
  name: string; // Human-readable name, e.g. "Médical", "Cuisine"
  createdAt: any;
  staff?: StaffMember[];
}

export interface Product {
  id: string;
  name: string;
  category: string; // The category name/id this product belongs to
  quantity: number;
  minQuantity: number;
  lotNumber?: string;
  expiryDate?: string; // YYYY-MM-DD
  lastAuditDate?: string; // YYYY-MM-DD
  createdAt: any;
  updatedAt: any;
}

export interface SupplierContact {
  name: string;
  phone: string;
}

export interface ProductSupplier {
  productId: string;
  contacts: SupplierContact[];
  updatedAt: any;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  category: string;
  type: 'creation' | 'adjustment' | 'deletion';
  difference: number; // e.g. +5, -2, or full quantity on creation
  finalQuantity: number;
  userEmail: string;
  createdAt: any; // Firestore timestamp
}

