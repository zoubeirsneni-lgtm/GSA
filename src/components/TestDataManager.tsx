/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { doc, setDoc, deleteDoc, writeBatch, collection, getDocs, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { X, Play, Trash2, CheckCircle, Database, Sparkles, HelpCircle, AlertCircle } from 'lucide-react';
import { useFirebase } from './FirebaseProvider';

interface TestDataManagerProps {
  onClose: () => void;
}

export default function TestDataManager({ onClose }: TestDataManagerProps) {
  const { user, userRights } = useFirebase();
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSuperAdmin = userRights?.role === 'super_admin';

  // Pre-configured premium clinic dataset
  const testCategories = [
    { 
      id: 'materiel-medical', 
      name: 'Matériel Médical',
      staff: [
        { id: 't-staff-1', name: 'Dr. Audrey Martin', role: 'Médecin Coordinateur', phone: '06.12.34.56.78' },
        { id: 't-staff-2', name: 'Isabelle Dubois', role: 'Infirmière Major', phone: '06.98.76.54.32' }
      ]
    },
    { 
      id: 'pharmacie-vaccins', 
      name: 'Pharmacie & Vaccins',
      staff: [
        { id: 't-staff-3', name: 'Jean-Pierre Clavel', role: 'Pharmacien Clinicien', phone: '07.45.89.12.36' }
      ]
    },
    { 
      id: 'bloc-operatoire', 
      name: 'Bloc Opératoire',
      staff: [
        { id: 't-staff-4', name: 'Pr. François Thierry', role: 'Chef de Bloc', phone: '06.55.44.33.22' },
        { id: 't-staff-5', name: 'Yasmine Benali', role: 'IADE Anesthésiste', phone: '07.11.22.33.44' }
      ]
    },
    { 
      id: 'entretien-hygiene', 
      name: 'Entretien & Hygiène',
      staff: [
        { id: 't-staff-6', name: 'Marc Lessage', role: 'Responsable Hygiène & Bionettoyage', phone: '06.88.99.00.11' }
      ]
    }
  ];

  const testProducts = [
    {
      id: 'test-prod-1',
      name: 'Seringues Seringo 5ml (Boîte de 100)',
      category: 'Matériel Médical',
      quantity: 145,
      minQuantity: 40,
      suppliers: [
        { name: 'PharmaDistri SA', phone: '01.45.67.89.10' },
        { name: 'HospitAll Group', phone: '02.99.88.77.66' }
      ]
    },
    {
      id: 'test-prod-2',
      name: 'Vaccin Grippal G10 doses injectables',
      category: 'Pharmacie & Vaccins',
      quantity: 8,
      minQuantity: 25, // Under-stock
      suppliers: [
        { name: 'Laboratoires BioCare', phone: '04.72.33.44.55' }
      ]
    },
    {
      id: 'test-prod-3',
      name: 'Gants d\'examen latex M non poudrés',
      category: 'Matériel Médical',
      quantity: 420,
      minQuantity: 100,
      suppliers: [
        { name: 'GantMedic International', phone: '05.56.78.12.34' }
      ]
    },
    {
      id: 'test-prod-4',
      name: 'Compresses stériles tissées 10x10',
      category: 'Matériel Médical',
      quantity: 80,
      minQuantity: 150, // Under-stock
      suppliers: [
        { name: 'PharmaDistri SA', phone: '01.45.67.89.10' }
      ]
    },
    {
      id: 'test-prod-5',
      name: 'Anesthésique local Lido-Gel 2%',
      category: 'Bloc Opératoire',
      quantity: 35,
      minQuantity: 10,
      suppliers: [
        { name: 'SpeciaMed Distrib', phone: '03.88.99.00.11' }
      ]
    },
    {
      id: 'test-prod-6',
      name: 'Désinfectant de sol médicalisé 5L',
      category: 'Entretien & Hygiène',
      quantity: 3,
      minQuantity: 6, // Under-stock
      suppliers: [
        { name: 'ClinClean Pro', phone: '08.00.12.34.56' }
      ]
    },
    {
      id: 'test-prod-7',
      name: 'Champs opératoires stériles bleus 75x90',
      category: 'Bloc Opératoire',
      quantity: 60,
      minQuantity: 20,
      suppliers: [
        { name: 'SpeciaMed Distrib', phone: '03.88.99.00.11' }
      ]
    },
    {
      id: 'test-prod-8',
      name: 'Gel hydroalcoolique Aniosgel 1L',
      category: 'Entretien & Hygiène',
      quantity: 45,
      minQuantity: 12,
      suppliers: [
        { name: 'ClinClean Pro', phone: '08.00.12.34.56' }
      ]
    }
  ];

  const isSimulated = user && 'isSimulated' in user && (user as any).isSimulated;

  const [progressMsg, setProgressMsg] = useState<string | null>(null);

  const handleGenerateTestData = async () => {
    if (!isSuperAdmin) {
      setErrorMsg("Seul le Super Admin est autorisé à configurer les données de test.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setProgressMsg("Initialisation de la génération...");

    try {
      // Security warning for simulated profiles that cannot sign into firestore
      if (isSimulated || !auth.currentUser) {
        throw new Error("Profil de simulation d'accès actif. Pour injecter de vraies données dans le serveur Firestore, déconnectez-vous et connectez-vous avec un compte Google authentique.");
      }

      // 1. Write the test Categories sequentially to show step-by-step progress
      let count = 1;
      const totalSteps = testCategories.length + (testProducts.length * 3);

      for (const cat of testCategories) {
        setProgressMsg(`[${count}/${totalSteps}] Configuration de la catégorie : ${cat.name}...`);
        const catRef = doc(db, 'categories', cat.id);
        await setDoc(catRef, {
          id: cat.id,
          name: cat.name,
          staff: cat.staff || [],
          createdAt: serverTimestamp()
        });
        count++;
      }

      // 2. Write the test Products & Suppliers & Stock Move log for each
      for (const prod of testProducts) {
        // Product
        setProgressMsg(`[${count}/${totalSteps}] Importation de l'article : ${prod.name}...`);
        const productRef = doc(db, 'products', prod.id);
        await setDoc(productRef, {
          id: prod.id,
          name: prod.name,
          category: prod.category,
          quantity: prod.quantity,
          minQuantity: prod.minQuantity,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        count++;

        // Supplier
        setProgressMsg(`[${count}/${totalSteps}] Liaison du fournisseur pour : ${prod.name}...`);
        const supplierRef = doc(db, 'suppliers', prod.id);
        await setDoc(supplierRef, {
          productId: prod.id,
          contacts: prod.suppliers,
          updatedAt: serverTimestamp()
        });
        count++;

        // Initial movement log
        const moveId = `test-move-${prod.id}`;
        setProgressMsg(`[${count}/${totalSteps}] Enregistrement historique de stock pour : ${prod.name}...`);
        const moveRef = doc(db, 'stock_movements', moveId);
        await setDoc(moveRef, {
          id: moveId,
          productId: prod.id,
          productName: prod.name,
          category: prod.category,
          type: 'creation',
          difference: prod.quantity,
          finalQuantity: prod.quantity,
          userEmail: user?.email || 'Simulateur',
          createdAt: serverTimestamp()
        });
        count++;
      }

      setProgressMsg(null);
      setSuccessMsg("Jeu d'essai de la clinique généré avec succès ! Le tableau de bord et les graphiques de stock sont désormais peuplés.");
    } catch (err: any) {
      console.error("Data generation failed at progress step: ", progressMsg, err);
      setErrorMsg(`Échec de la génération de données : ${err.message || err.toString()}`);
      setProgressMsg(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePurgeTestData = async () => {
    if (!isSuperAdmin) {
      setErrorMsg("Seul le Super Admin est autorisé à purger les données.");
      return;
    }

    if (!confirm("Voulez-vous supprimer TOUTES les données de test générées ? Vos données créées manuellement ne seront pas affectées.")) {
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setProgressMsg("Initialisation de la purge...");

    try {
      if (isSimulated || !auth.currentUser) {
        throw new Error("Profil de simulation détecté. La suppression sécurisée nécessite un compte Google réel.");
      }

      let count = 1;
      const totalSteps = testCategories.length + (testProducts.length * 3);

      // 1. Delete matching test Categories
      for (const cat of testCategories) {
        setProgressMsg(`[${count}/${totalSteps}] Retrait de la catégorie d'essai : ${cat.name}...`);
        await deleteDoc(doc(db, 'categories', cat.id));
        count++;
      }

      // 2. Delete matching test Products & Suppliers & Movement logs
      for (const prod of testProducts) {
        setProgressMsg(`[${count}/${totalSteps}] Retrait du produit d'essai : ${prod.name}...`);
        await deleteDoc(doc(db, 'products', prod.id));
        count++;

        setProgressMsg(`[${count}/${totalSteps}] Retrait de la fiche fournisseur de : ${prod.name}...`);
        await deleteDoc(doc(db, 'suppliers', prod.id));
        count++;

        setProgressMsg(`[${count}/${totalSteps}] Purge de l'historique du produit : ${prod.name}...`);
        await deleteDoc(doc(db, 'stock_movements', `test-move-${prod.id}`));
        count++;
      }

      setProgressMsg(null);
      setSuccessMsg(`Purge accomplie ! Les documents d'essai fictifs ont été supprimés de la base Firestore de manière sécurisée.`);
    } catch (err: any) {
      console.error("Purge failed at progress step: ", progressMsg, err);
      setErrorMsg("Erreur lors de la purge : " + (err.message || err.toString()));
      setProgressMsg(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl border border-slate-100 flex flex-col">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <Sparkles className="text-amber-500" size={20} />
            <h3 className="font-bold text-slate-800 text-sm">Générateur de données d'essai</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-1 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Core Layout Split */}
        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Pour tester sereinement le tableau de bord, les alertes de rupture, le graphique circulaire interactif (Recharts) et les fiches fournisseurs, vous pouvez injecter instantanément un jeu de données médicales réalistes de clinique.
          </p>

          <div className="p-3 bg-amber-50 border border-amber-100 text-amber-700 rounded-xl text-[11px] flex items-start gap-2">
            <HelpCircle size={15} className="shrink-0 mt-0.5" />
            <span>
              Les éléments générés seront pourvus d'un repère de test (identifiant "test-") permettant de les supprimer à tout moment via le bouton de purge ci-dessous, en préservant vos propres saisies.
            </span>
          </div>

          {isSimulated && (
            <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-[11px] flex items-start gap-2 leading-relaxed">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>
                <strong>Mode Simulation Détecté :</strong> Vous naviguez actuellement avec un profil d'administrateur fictif. l'ajustement ou la génération de données de simulation sur le vrai serveur Firestore requiert d'être dûment connecté avec un authentique compte Google (par exemple via votre adresse <strong>{user?.email || 'zoubeirsneni@gmail.com'}</strong>).
              </span>
            </div>
          )}

          {progressMsg && (
            <div className="p-3.5 bg-blue-50 border border-blue-100 text-clinic-blue rounded-xl text-xs flex items-center gap-3 font-semibold animate-pulse">
              <div className="w-4 h-4 border-2 border-clinic-blue/20 border-t-clinic-blue rounded-full animate-spin shrink-0"></div>
              <span>{progressMsg}</span>
            </div>
          )}

          {errorMsg && <p className="text-xs text-rose-500 font-semibold bg-rose-50 border border-rose-200/55 p-3 rounded-xl">{errorMsg}</p>}
          {successMsg && <p className="text-xs text-emerald-600 font-semibold bg-emerald-50 border border-emerald-100 p-2.5 rounded-xl">{successMsg}</p>}

          <div className="grid grid-cols-1 gap-3 pt-2">
            {/* Generate Action */}
            <button
              onClick={handleGenerateTestData}
              disabled={loading}
              className="w-full bg-clinic-blue hover:bg-opacity-95 text-white rounded-xl py-3 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50"
            >
              <Database size={16} />
              {loading ? "Génération en cours..." : "Générer les 8 articles & fournisseurs d'essai"}
            </button>

            {/* Clear/Purge Action */}
            <button
              onClick={handlePurgeTestData}
              disabled={loading}
              className="w-full border border-rose-200 hover:bg-rose-50 text-rose-600 rounded-xl py-3 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Trash2 size={16} />
              Purger uniquement les données de test
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-end">
          <button
            onClick={onClose}
            className="border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-xl py-2 px-4 text-xs font-semibold cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
}
