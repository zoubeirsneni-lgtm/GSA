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

export interface Category {
  id: string; // Unique slug or ID
  name: string; // Human-readable name, e.g. "Médical", "Cuisine"
  createdAt: any;
}

export interface Product {
  id: string;
  name: string;
  category: string; // The category name/id this product belongs to
  quantity: number;
  minQuantity: number;
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
