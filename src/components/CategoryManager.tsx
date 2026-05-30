/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, setDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Category } from '../types';
import { useFirebase } from './FirebaseProvider';
import { Plus, Trash, FolderOpen, AlertCircle, X, Check } from 'lucide-react';

interface CategoryManagerProps {
  onClose: () => void;
}

export default function CategoryManager({ onClose }: CategoryManagerProps) {
  const { userRights } = useFirebase();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = userRights?.role === 'super_admin';

  useEffect(() => {
    // Real-time synchronization
    const q = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cats: Category[] = [];
      snapshot.forEach((doc) => {
        cats.push({
          id: doc.id,
          ...doc.data()
        } as Category);
      });
      setCategories(cats);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setErrorMsg(null);

    if (!isSuperAdmin) {
      setErrorMsg("Seul le Super Admin est autorisé à créer des catégories.");
      return;
    }

    // Convert category name to standardized ID/slug
    const catSlug = newCatName
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-') // replace spaces/special with dash
      .replace(/-+/g, '-') // collapse multiple dashes
      .replace(/^-|-$/g, ''); // trim dashes

    if (!catSlug) {
      setErrorMsg("Le nom de catégorie n'est pas valide.");
      return;
    }

    try {
      const catRef = doc(db, 'categories', catSlug);
      const categoryData = {
        id: catSlug,
        name: newCatName.trim(),
        createdAt: serverTimestamp()
      };
      await setDoc(catRef, categoryData);
      setNewCatName('');
    } catch (err: any) {
      setErrorMsg("Impossible de créer la catégorie: " + err.message);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!isSuperAdmin) {
      setErrorMsg("Seul le Super Admin est autorisé à supprimer des catégories.");
      return;
    }

    if (!confirm("Voulez-vous vraiment supprimer cette catégorie ? Remarque: cela n'affecte pas directement les produits associés mais la catégorie n'apparaîtra plus dans les filtres.")) {
      return;
    }

    try {
      setErrorMsg(null);
      await deleteDoc(doc(db, 'categories', catId));
    } catch (err: any) {
      setErrorMsg("Erreur lors de la suppression: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <FolderOpen className="text-clinic-blue" size={20} />
            <h3 className="font-bold text-slate-800 text-base">Gérer les catégories</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-1 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          
          {/* Add Form (Super Admin only) */}
          {isSuperAdmin ? (
            <form onSubmit={handleCreateCategory} className="flex gap-2">
              <input
                type="text"
                placeholder="Ex: Cuisine, Ménage, Blocs..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                maxLength={40}
                className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-clinic-blue/40 focus:border-clinic-blue"
              />
              <button
                type="submit"
                className="bg-clinic-blue hover:bg-opacity-90 text-white rounded-xl px-4 py-2 text-sm font-medium flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Plus size={16} /> Ajouter
              </button>
            </form>
          ) : (
            <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-xs flex gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>Seuls les Super-Admins peuvent créer ou supprimer des catégories. Les admins standard peuvent uniquement les consulter.</span>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-rose-500 font-medium px-1">{errorMsg}</p>
          )}

          {/* List */}
          <div className="border border-slate-200/80 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
            <div className="bg-slate-50/60 py-2 px-3 text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wider">
              {categories.length} Catégories configurées
            </div>
            {loading ? (
              <div className="p-4 text-center text-slate-400 text-xs">Chargement des catégories...</div>
            ) : categories.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">Aucune catégorie configurée.</div>
            ) : (
              categories.map((cat) => (
                <div key={cat.id} className="py-2.5 px-3 flex items-center justify-between hover:bg-slate-50">
                  <span className="font-semibold text-slate-700 text-sm">{cat.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-100 rounded px-1.5 py-0.5">{cat.id}</span>
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded transition cursor-pointer"
                        title="Supprimer la catégorie"
                      >
                        <Trash size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
          <button
            onClick={onClose}
            className="border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-xl py-2 px-4 text-xs font-medium cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
