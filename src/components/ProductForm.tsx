/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, Category, SupplierContact } from '../types';
import { useFirebase } from './FirebaseProvider';
import { X, Plus, Trash2, ShieldCheck, HelpCircle, PhoneCall } from 'lucide-react';

interface ProductFormProps {
  product?: Product | null; // If passed, we are editing, otherwise creating
  categories: Category[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProductForm({ product, categories, onClose, onSuccess }: ProductFormProps) {
  const { user, userRights } = useFirebase();
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: 0,
    minQuantity: 5,
  });

  const [suppliers, setSuppliers] = useState<SupplierContact[]>([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSuperAdmin = userRights?.role === 'super_admin';
  
  // Clean allowed edit categories list based on admin's permissions
  const allowedCategories = categories.filter(cat => 
    isSuperAdmin || userRights?.permissions.includes(cat.name)
  );

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        category: product.category,
        quantity: product.quantity,
        minQuantity: product.minQuantity,
      });

      // Standard admins are not allowed to fetch supplier details, doing so will trigger permissions error
      if (isSuperAdmin) {
        setLoadingSuppliers(true);
        const fetchSuppliers = async () => {
          try {
            const supplierDocRef = doc(db, 'suppliers', product.id);
            const docSnap = await getDoc(supplierDocRef);
            if (docSnap.exists()) {
              setSuppliers(docSnap.data().contacts || []);
            }
          } catch (error) {
            console.error("Error reading supplier info (expected if normal user):", error);
          } finally {
            setLoadingSuppliers(false);
          }
        };
        fetchSuppliers();
      }
    } else {
      // Default category if any allowed category exists
      if (allowedCategories.length > 0) {
        setFormData(prev => ({ ...prev, category: allowedCategories[0].name }));
      }
    }
  }, [product, categories, userRights]);

  const handleAddSupplierField = () => {
    setSuppliers([...suppliers, { name: '', phone: '' }]);
  };

  const handleRemoveSupplierField = (index: number) => {
    setSuppliers(suppliers.filter((_, i) => i !== index));
  };

  const handleSupplierFieldChange = (index: number, key: keyof SupplierContact, value: string) => {
    const updated = [...suppliers];
    updated[index][key] = value;
    setSuppliers(updated);
  };

  // Helper validation for permissions
  const hasEditRights = (cat: string) => {
    return isSuperAdmin || (userRights?.permissions.includes(cat) ?? false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validate inputs
    if (!formData.name.trim()) {
      setErrorMsg("Le nom du produit est requis.");
      return;
    }
    if (!formData.category) {
      setErrorMsg("Veuillez sélectionner une catégorie.");
      return;
    }
    if (formData.quantity < 0 || formData.minQuantity < 0) {
      setErrorMsg("Les quantités doivent être positives.");
      return;
    }

    // Double check write authorization
    if (!hasEditRights(formData.category)) {
      setErrorMsg(`Vous n'avez pas l'autorisation d'écrire des articles dans la catégorie : ${formData.category}`);
      return;
    }

    if (product && !hasEditRights(product.category)) {
      setErrorMsg(`Vous n'avez pas l'autorisation d'éditer d'anciens articles de la catégorie : ${product.category}`);
      return;
    }

    setSubmitting(true);

    try {
      // Generate standard clean slug or id
      const productId = product?.id || 'prod-' + Math.random().toString(36).substring(2, 11);
      const productRef = doc(db, 'products', productId);

      const productPayload = {
        id: productId,
        name: formData.name.trim(),
        category: formData.category,
        quantity: Math.floor(formData.quantity),
        minQuantity: Math.floor(formData.minQuantity),
        createdAt: product ? product.createdAt : serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Create or Update Product document
      await setDoc(productRef, productPayload);

      // Write Stock Movement Log
      const diff = product ? Math.floor(formData.quantity) - product.quantity : Math.floor(formData.quantity);
      if (!product || diff !== 0) {
        const movementId = 'move-' + Math.random().toString(36).substring(2, 11);
        const movementRef = doc(db, 'stock_movements', movementId);
        await setDoc(movementRef, {
          id: movementId,
          productId: productId,
          productName: formData.name.trim(),
          category: formData.category,
          type: product ? 'adjustment' : 'creation',
          difference: diff,
          finalQuantity: Math.floor(formData.quantity),
          userEmail: user?.email || 'Inconnu',
          createdAt: serverTimestamp(),
        });
      }

      // Save supplier isolation details only if current user is Super Admin
      if (isSuperAdmin) {
        // Clean suppliers list and discard blanks
        const validSuppliers = suppliers.filter(s => s.name.trim() || s.phone.trim());
        const supplierRef = doc(db, 'suppliers', productId);
        await setDoc(supplierRef, {
          productId: productId,
          contacts: validSuppliers,
          updatedAt: serverTimestamp(),
        });
      }

      onSuccess();
    } catch (error: any) {
      setErrorMsg("Échec de l'enregistrement : " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-100 flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <h3 className="font-bold text-slate-800 text-base">
            {product ? "Modifier le produit" : "Ajouter un produit"}
          </h3>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-1 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {errorMsg && (
            <div className="p-3 bg-rose-50 text-rose-600 text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}

          {/* Product Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Nom du matériel / produit *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Seringues 5ml, Boîte de repas clinique, Détergent sol..."
              maxLength={140}
              className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-clinic-blue/40 focus:border-clinic-blue focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Category Dropdown (Filtered matches) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Catégorie *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-clinic-blue/40 focus:border-clinic-blue bg-white focus:outline-none"
              >
                {allowedCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
                {allowedCategories.length === 0 && (
                  <option value="" disabled>Aucune catégorie autorisée</option>
                )}
              </select>
              <p className="text-[10px] text-slate-400">
                Affiche les catégories que vous êtes autorisé à modifier.
              </p>
            </div>

            {/* Minimum Quantity Alert threshold */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Seuil d'Alerte de Rupture *</label>
              <input
                type="number"
                min={0}
                required
                value={formData.minQuantity}
                onChange={(e) => setFormData({ ...formData, minQuantity: Math.max(0, parseInt(e.target.value) || 0) })}
                className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-clinic-blue/40 focus:border-clinic-blue focus:outline-none"
              />
              <p className="text-[10px] text-slate-400">Une alerte sera émise si le stock descend à ou sous ce seuil.</p>
            </div>
          </div>

          {/* Current Stock Quantity */}
          <div className="space-y-1.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Quantité en stock actuelle *</label>
              <span className="text-[11px] font-mono text-clinic-blue font-semibold">Réel</span>
            </div>
            <div className="flex items-center gap-3 mt-1.5">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, quantity: Math.max(0, prev.quantity - 1) }))}
                className="w-10 h-10 shrink-0 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl flex items-center justify-center font-bold text-lg select-none cursor-pointer"
              >
                -
              </button>
              <input
                type="number"
                min={0}
                required
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: Math.max(0, parseInt(e.target.value) || 0) })}
                className="flex-1 text-center font-bold text-base border border-slate-300 bg-white rounded-xl py-2 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                className="w-10 h-10 shrink-0 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl flex items-center justify-center font-bold text-lg select-none cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Isolated Supplier Contact Numbers (Super Admin exclusive visibility) */}
          {isSuperAdmin ? (
            <div className="space-y-3 bg-[#eef5fc]/60 p-4 rounded-xl border border-clinic-blue/10">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#002247] flex items-center gap-1">
                    <PhoneCall size={14} className="text-clinic-blue" />
                    Numéros des Fournisseurs
                  </h4>
                  <p className="text-[10px] text-slate-500">Visible uniquement pour vous (Super Admin)</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddSupplierField}
                  className="bg-white hover:bg-slate-100 text-clinic-blue border border-clinic-blue/30 rounded-lg px-2.5 py-1 text-[10px] font-semibold flex items-center gap-0.5 cursor-pointer transition"
                >
                  <Plus size={12} /> Un fournisseur
                </button>
              </div>

              {loadingSuppliers ? (
                <div className="text-[11px] text-center text-slate-400 py-2">Chargement des fiches fournisseurs sécurisées...</div>
              ) : suppliers.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic bg-white/70 py-2.5 px-3 rounded-lg text-center border border-dashed border-slate-300/60">
                  Aucun numéro lié à cet article. Les commandes critiques se font via ce volet.
                </p>
              ) : (
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {suppliers.map((sup, index) => (
                    <div key={index} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-slate-200">
                      <input
                        type="text"
                        placeholder="Société ou Nom"
                        value={sup.name}
                        onChange={(e) => handleSupplierFieldChange(index, 'name', e.target.value)}
                        className="flex-1 text-xs border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Téléphone"
                        value={sup.phone}
                        onChange={(e) => handleSupplierFieldChange(index, 'phone', e.target.value)}
                        className="flex-1 text-xs border border-slate-300 rounded px-2.5 py-1.5 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveSupplierField(index)}
                        className="text-slate-400 hover:text-red-500 p-1 rounded transition cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 italic bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 flex items-start gap-1.5">
              <ShieldCheck size={14} className="text-slate-400 shrink-0 mt-0.5" />
              <span>Les fiches fournisseurs sont hautement confidentielles et accessibles exclusivement en lecture/écriture par le Super-Administrateur.</span>
            </div>
          )}

        </form>

        {/* Form Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-xl py-2 px-4 text-xs font-semibold cursor-pointer"
          >
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || allowedCategories.length === 0}
            className="bg-clinic-blue hover:bg-opacity-90 disabled:opacity-50 text-white rounded-xl py-2 px-6 text-xs font-semibold flex items-center justify-center cursor-pointer min-w-[100px]"
          >
            {submitting ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>

      </div>
    </div>
  );
}
