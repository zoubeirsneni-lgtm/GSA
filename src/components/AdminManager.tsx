/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, setDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserRights, Category } from '../types';
import { useFirebase } from './FirebaseProvider';
import { Users, UserPlus, Trash2, ShieldCheck, Mail, CheckCircle2, X } from 'lucide-react';

interface AdminManagerProps {
  categories: Category[];
  onClose: () => void;
}

export default function AdminManager({ categories, onClose }: AdminManagerProps) {
  const { userRights } = useFirebase();
  const [adminsList, setAdminsList] = useState<UserRights[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'super_admin' | 'admin'>('admin');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = userRights?.role === 'super_admin';

  useEffect(() => {
    if (!isSuperAdmin) return;

    const q = query(collection(db, 'users'), orderBy('email', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: UserRights[] = [];
      snapshot.forEach((doc) => {
        users.push({
          uid: doc.id,
          ...doc.data()
        } as UserRights);
      });
      setAdminsList(users);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isSuperAdmin]);

  const handleTogglePermission = (catName: string) => {
    if (selectedPermissions.includes(catName)) {
      setSelectedPermissions(selectedPermissions.filter(p => p !== catName));
    } else {
      setSelectedPermissions([...selectedPermissions, catName]);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const emailClean = newEmail.trim().toLowerCase();
    if (!emailClean) {
      setErrorMsg("L'adresse e-mail est requise.");
      return;
    }

    if (!isSuperAdmin) {
      setErrorMsg("Seul le Super Admin est autorisé à gérer les autorisations.");
      return;
    }

    // Replace invalid ID characters for document ID (comply with isValidId security regex)
    const emailSlug = emailClean.replace(/[@.]/g, '_');
    const docId = `pending-${emailSlug}`;

    try {
      const userRef = doc(db, 'users', docId);
      const payload: UserRights = {
        uid: docId,
        email: emailClean,
        role: newRole,
        permissions: newRole === 'super_admin' 
          ? categories.map(c => c.name) // Super admins get all permissions implicitly
          : selectedPermissions,
        createdAt: serverTimestamp(),
      };

      await setDoc(userRef, payload);
      setSuccessMsg(`L'invitation a été enregistrée avec succès pour ${emailClean} !`);
      setNewEmail('');
      setSelectedPermissions([]);
    } catch (error: any) {
      setErrorMsg("Échec de la création: " + error.message);
    }
  };

  const handleDeleteAdmin = async (uid: string, email: string) => {
    if (!isSuperAdmin) return;

    if (uid === userRights?.uid) {
      setErrorMsg("Vous ne pouvez pas supprimer votre propre compte Super Admin.");
      return;
    }

    if (!confirm(`Voulez-vous supprimer les droits d'accès de l'administrateur ${email} ?`)) {
      return;
    }

    try {
      setErrorMsg(null);
      setSuccessMsg(null);
      await deleteDoc(doc(db, 'users', uid));
      setSuccessMsg(`Droits révoqués pour l'utilisateur ${email}`);
    } catch (error: any) {
      setErrorMsg("Échec de la révocation: " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Users className="text-clinic-blue" size={20} />
            <h3 className="font-bold text-slate-800 text-base">Gestion des Administrateurs & Droits</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-1 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Core Layout split */}
        <div className="p-6 flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Left panel: Add Administrator Form (12-col to 5-col) */}
          <div className="md:col-span-5 bg-slate-50 p-4 rounded-xl border border-slate-200/65 h-fit space-y-4">
            <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus size={16} className="text-clinic-green" />
              Inviter un Admin
            </h4>

            {errorMsg && <p className="text-xs text-rose-500 font-semibold">{errorMsg}</p>}
            {successMsg && <p className="text-xs text-emerald-600 font-semibold">{successMsg}</p>}

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Adresse e-mail Google *</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 text-slate-400" size={15} />
                  <input
                    type="email"
                    required
                    placeholder="nom@clinique.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full text-xs border border-slate-300 rounded-xl pl-9 pr-3 py-2 focus:ring-2 focus:ring-clinic-blue/40 focus:outline-none"
                    id="admin-email-input"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-600">Rôle de l'utilisateur</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'super_admin' | 'admin')}
                  className="w-full text-xs border border-slate-300 bg-white rounded-xl px-3 py-2 focus:outline-none"
                >
                  <option value="admin">Admin Standard (Droits personnalisés)</option>
                  <option value="super_admin">Super-Admin (Tous les accès + fournisseurs)</option>
                </select>
              </div>

              {/* Category rights checklist */}
              {newRole === 'admin' && (
                <div className="space-y-1.5 pt-1">
                  <label className="text-xs font-semibold text-slate-600">Attribution des droits d'édition</label>
                  <p className="text-[10px] text-slate-400 leading-normal mb-2">Cochez les catégories que cet administrateur est autorisé à créer/modifier/supprimer :</p>
                  
                  <div className="space-y-1.5 max-h-[140px] overflow-y-auto bg-white p-2.5 rounded-lg border border-slate-200">
                    {categories.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">Configurez d'abord des catégories.</p>
                    ) : (
                      categories.map(cat => {
                        const isChecked = selectedPermissions.includes(cat.name);
                        return (
                          <label key={cat.id} className="flex items-center gap-2 text-xs text-slate-700 font-medium hover:text-clinic-blue cursor-pointer transition">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePermission(cat.name)}
                              className="rounded border-slate-300 text-clinic-blue focus:ring-clinic-blue/50"
                            />
                            {cat.name}
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-clinic-blue hover:bg-opacity-95 text-white bg-opacity-90 rounded-xl py-2 px-4 text-xs font-semibold flex items-center justify-center cursor-pointer transition"
                id="create-admin-button"
              >
                Inscrire / Attribuer
              </button>
            </form>
          </div>

          {/* Right panel: Current list of Admins (12-col to 7-col) */}
          <div className="md:col-span-7 flex flex-col">
            <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <ShieldCheck size={16} className="text-clinic-blue" />
              Droits des Comptes Actifs
            </h4>

            {loading ? (
              <div className="text-center py-10 text-xs text-slate-400">Chargement de l'organigramme...</div>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {adminsList.map((adm) => {
                  const isPending = adm.uid.startsWith('pending-');
                  const isCurrent = adm.uid === userRights?.uid;
                  return (
                    <div key={adm.uid} className={`p-3.5 rounded-xl border flex justify-between items-start ${isCurrent ? 'bg-clinic-light-blue/25 border-clinic-blue/20' : 'bg-white border-slate-200'}`}>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 text-xs tracking-tight">{adm.email}</span>
                          {isPending && (
                            <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/50">En attente</span>
                          )}
                          {isCurrent && (
                            <span className="text-[9px] font-semibold text-clinic-blue bg-clinic-light-blue px-1.5 py-0.5 rounded-md">Vous</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                          <span>Rôle: </span>
                          <span className={`font-semibold ${adm.role === 'super_admin' ? 'text-clinic-navy font-bold' : 'text-slate-600'}`}>{adm.role === 'super_admin' ? 'Super Admin' : 'Admin standard'}</span>
                        </div>

                        {/* Rights visual blocks */}
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {adm.role === 'super_admin' ? (
                            <span className="text-[9px] font-semibold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 border border-slate-200/60 font-mono">TOUTES LES CATÉGORIES (S - ADMIN)</span>
                          ) : adm.permissions && adm.permissions.length > 0 ? (
                            adm.permissions.map((p, i) => (
                              <span key={i} className="text-[9px] font-semibold text-clinic-blue bg-clinic-light-blue/50 border border-clinic-blue/10 rounded px-1.5 py-0.5">
                                Droit: {p}
                              </span>
                            ))
                          ) : (
                            <span className="text-[9px] font-semibold text-rose-500 bg-rose-50 border border-rose-100 rounded px-1.5 py-0.5">
                              Aucun droit d'écriture affecté
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete / Revoke Access */}
                      {!isCurrent && (
                        <button
                          onClick={() => handleDeleteAdmin(adm.uid, adm.email)}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition cursor-pointer"
                          title="Révoquer les accès de cet administrateur"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
          <button
            onClick={onClose}
            className="border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-xl py-2 px-5 text-xs font-semibold cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
