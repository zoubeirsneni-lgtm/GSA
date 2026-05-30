/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Product, SupplierContact } from '../types';
import { X, Phone, User, HelpCircle, ShieldAlert } from 'lucide-react';

interface SupplierModalProps {
  product: Product;
  onClose: () => void;
}

export default function SupplierModal({ product, onClose }: SupplierModalProps) {
  const [contacts, setContacts] = useState<SupplierContact[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        setLoading(true);
        const ref = doc(db, 'suppliers', product.id);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setContacts(snap.data().contacts || []);
        } else {
          setContacts([]);
        }
      } catch (err: any) {
        console.error("Error reading restricted suppliers collection:", err);
        setErrorMsg("Accès refusé. Vous n'avez pas l'autorisation d'accéder aux fiches fournisseurs.");
      } finally {
        setLoading(false);
      }
    };

    fetchSuppliers();
  }, [product]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl border border-slate-100 flex flex-col">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Phone className="text-clinic-green" size={18} />
            <span className="font-bold text-slate-800 text-sm">Fiche Fournisseur</span>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-1 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="border-b pb-3Border-slate-100">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wide">{product.category}</span>
            <h4 className="font-bold text-slate-800 text-base leading-tight mt-0.5">{product.name}</h4>
          </div>

          {loading ? (
            <div className="text-center py-6 text-xs text-slate-400 font-medium">Chargement sécurisé des contacts...</div>
          ) : errorMsg ? (
            <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-xs flex gap-2 border border-rose-100 font-semibold text-center items-center justify-center flex-col">
              <ShieldAlert size={24} className="text-rose-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          ) : contacts && contacts.length > 0 ? (
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {contacts.map((contact, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-[#eef5fc]/50 border border-clinic-blue/10 rounded-xl hover:bg-[#eef5fc]/90 transition">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-xs text-slate-800 flex items-center gap-1">
                      <User size={12} className="text-slate-400" />
                      {contact.name || "Société Anonyme"}
                    </p>
                    <p className="text-xs font-mono text-slate-500">{contact.phone || "Non renseigné"}</p>
                  </div>
                  
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-clinic-green text-white hover:bg-opacity-90 shadow-sm transition"
                      title="Téléphoner"
                    >
                      <Phone size={14} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 space-y-2 text-slate-400">
              <HelpCircle className="mx-auto text-slate-300" size={24} />
              <p className="text-xs italic">Aucun fournisseur n'a été enregistré pour cet article.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
          <button
            onClick={onClose}
            className="border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-xl py-1.5 px-4 text-xs font-semibold cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
