/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, setDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Category, StaffMember } from '../types';
import { useFirebase } from './FirebaseProvider';
import { 
  Plus, 
  Trash, 
  FolderOpen, 
  AlertCircle, 
  X, 
  Check, 
  Users, 
  UserPlus, 
  Phone, 
  User, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';

interface CategoryManagerProps {
  onClose: () => void;
}

export default function CategoryManager({ onClose }: CategoryManagerProps) {
  const { userRights } = useFirebase();
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Expanded category and inline person forms
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);
  const [staffFormState, setStaffFormState] = useState({
    name: '',
    role: '',
    phone: ''
  });

  const isSuperAdmin = userRights?.role === 'super_admin';

  // Clear subform state on expanded component change
  useEffect(() => {
    setStaffFormState({ name: '', role: '', phone: '' });
  }, [expandedCatId]);

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
      if (expandedCatId === catId) {
        setExpandedCatId(null);
      }
    } catch (err: any) {
      setErrorMsg("Erreur lors de la suppression: " + err.message);
    }
  };

  const handleAddStaff = async (cat: Category) => {
    if (!isSuperAdmin) {
      setErrorMsg("Seul le Super Admin est autorisé à modifier le personnel.");
      return;
    }

    const { name, role, phone } = staffFormState;
    if (!name.trim() || !role.trim() || !phone.trim()) {
      setErrorMsg("Tous les champs sont obligatoires pour déclarer un personnel.");
      return;
    }

    setErrorMsg(null);

    const newMember: StaffMember = {
      id: 'staff-' + Math.random().toString(36).substring(2, 11),
      name: name.trim(),
      role: role.trim(),
      phone: phone.trim()
    };

    const updatedStaff = [...(cat.staff || []), newMember];

    try {
      const catRef = doc(db, 'categories', cat.id);
      await setDoc(catRef, {
        ...cat,
        staff: updatedStaff
      });
      // Clear local states
      setStaffFormState({ name: '', role: '', phone: '' });
    } catch (err: any) {
      setErrorMsg("Impossible de sauvegarder le membre du personnel: " + err.message);
    }
  };

  const handleRemoveStaff = async (cat: Category, staffId: string) => {
    if (!isSuperAdmin) {
      setErrorMsg("Seul le Super Admin est autorisé à modifier le personnel.");
      return;
    }

    if (!confirm("Voulez-vous révoquer ce membre du personnel de l'équipe de garde ?")) {
      return;
    }

    setErrorMsg(null);
    const updatedStaff = (cat.staff || []).filter(s => s.id !== staffId);

    try {
      const catRef = doc(db, 'categories', cat.id);
      await setDoc(catRef, {
        ...cat,
        staff: updatedStaff
      });
    } catch (err: any) {
      setErrorMsg("Impossible de supprimer le membre du personnel: " + err.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <FolderOpen className="text-clinic-blue" size={20} />
            <h3 className="font-bold text-slate-800 text-base">Gérer les catégories & personnels</h3>
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
                <Plus size={16} /> Créer catégorie
              </button>
            </form>
          ) : (
            <div className="p-3 bg-amber-50 text-amber-700 rounded-xl text-xs flex gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>Seuls les Super-Admins peuvent créer/supprimer des catégories et modifier le personnel. Les admins standard peuvent toutefois les consulter et copier leurs contacts.</span>
            </div>
          )}

          {errorMsg && (
            <p className="text-xs text-rose-500 font-medium px-1 bg-rose-50 border border-rose-100 p-2 rounded-lg">{errorMsg}</p>
          )}

          {/* List and Accordeons */}
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
                <div key={cat.id} className="divide-y divide-slate-100/50">
                  {/* Category main header row */}
                  <div className="py-2.5 px-3 flex items-center justify-between hover:bg-slate-50/75 transition">
                    <button
                      onClick={() => setExpandedCatId(expandedCatId === cat.id ? null : cat.id)}
                      className="flex-1 flex items-center gap-2.5 text-left cursor-pointer focus:outline-none"
                    >
                      {expandedCatId === cat.id ? (
                        <ChevronUp size={16} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={16} className="text-slate-400" />
                      )}
                      <div>
                        <span className="font-semibold text-slate-800 text-sm block">{cat.name}</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-100 rounded px-1.5 py-0.2">{cat.id}</span>
                          {cat.staff && cat.staff.length > 0 && (
                            <span className="bg-clinic-blue/10 text-clinic-blue text-[9px] font-bold px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                              <Users size={10} /> {cat.staff.length} personnel(s)
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                    
                    {isSuperAdmin && (
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded transition cursor-pointer self-start"
                        title="Supprimer la catégorie"
                      >
                        <Trash size={14} />
                      </button>
                    )}
                  </div>

                  {/* Expanded staff block */}
                  {expandedCatId === cat.id && (
                    <div className="px-4 py-3.5 bg-slate-50/50 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1">
                          <Users size={12} className="text-clinic-blue" /> Personnel de garde & Contact référent
                        </span>
                      </div>

                      {/* Display staff list */}
                      {(!cat.staff || cat.staff.length === 0) ? (
                        <p className="text-xs text-slate-400 italic">Aucune information de personnel de garde enregistrée.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {cat.staff.map((member) => (
                            <div key={member.id} className="bg-white rounded-xl border border-slate-200/75 p-3 flex items-center justify-between hover:border-slate-300 transition">
                              <div className="flex items-center gap-2 max-w-[65%]">
                                <div className="bg-slate-100 p-2 rounded-lg text-slate-500 shrink-0">
                                  <User size={14} />
                                </div>
                                <div className="truncate">
                                  <span className="font-bold text-slate-700 text-xs block truncate" title={member.name}>{member.name}</span>
                                  <span className="text-[10px] text-slate-400 block truncate" title={member.role}>{member.role}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`tel:${member.phone}`}
                                  className="border border-clinic-blue/15 bg-clinic-blue/5 text-clinic-blue rounded-lg p-2 hover:bg-clinic-blue hover:text-white transition cursor-pointer flex items-center justify-center"
                                  title={`Appeler ${member.name} (${member.phone})`}
                                >
                                  <Phone size={13} />
                                </a>

                                {isSuperAdmin && (
                                  <button
                                    onClick={() => handleRemoveStaff(cat, member.id)}
                                    className="border border-slate-200 hover:border-rose-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg p-2 transition cursor-pointer"
                                    title="Révoquer ce membre"
                                  >
                                    <Trash size={13} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Staff form block (Super Admin only) */}
                      {isSuperAdmin && (
                        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-inner bg-slate-50/20">
                          <span className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5 border-b border-slate-100 pb-1.5">
                            <UserPlus size={14} className="text-clinic-green" /> Nouveau personnel référent (garde d'astreinte)
                          </span>
                          
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Nom complet</label>
                                <input
                                  type="text"
                                  value={staffFormState.name}
                                  onChange={(e) => setStaffFormState({ ...staffFormState, name: e.target.value })}
                                  placeholder="Ex: Dr. Martin Zoubeir"
                                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-clinic-blue focus:border-clinic-blue focus:outline-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Poste / Rôle</label>
                                <input
                                  type="text"
                                  value={staffFormState.role}
                                  onChange={(e) => setStaffFormState({ ...staffFormState, role: e.target.value })}
                                  placeholder="Ex: Médecin Anesthésiste"
                                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-clinic-blue focus:border-clinic-blue focus:outline-none"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider font-sans">Numéro Téléphone</label>
                                <input
                                  type="text"
                                  value={staffFormState.phone}
                                  onChange={(e) => setStaffFormState({ ...staffFormState, phone: e.target.value })}
                                  placeholder="Ex: 06 12 34 56 78"
                                  className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:ring-1 focus:ring-clinic-blue focus:border-clinic-blue focus:outline-none"
                                />
                              </div>
                            </div>
                            
                            <div className="flex pt-1">
                              <button
                                type="button"
                                onClick={() => handleAddStaff(cat)}
                                className="w-full bg-clinic-green hover:bg-opacity-95 text-white font-bold text-xs rounded-lg py-2 px-4 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.99] transition"
                              >
                                <Plus size={14} /> Ajouter à l'équipe de garde
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
