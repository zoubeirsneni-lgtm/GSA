/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit, addDoc, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, Category, InventoryAuditSession, InventoryAuditItem, UserRights } from '../types';
import { X, ClipboardCheck, History, HelpCircle, Save, CheckCircle2, AlertTriangle, User, Calendar, MessageSquare, ListPlus, ArrowDownUp, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InventoryAuditModalProps {
  categories: Category[];
  products: Product[];
  userRights: UserRights | null;
  userEmail: string;
  onClose: () => void;
}

export default function InventoryAuditModal({ 
  categories, 
  products, 
  userRights, 
  userEmail, 
  onClose 
}: InventoryAuditModalProps) {
  const [activeTab, setActiveTab] = useState<'new' | 'history'>('new');
  const [auditsHistory, setAuditsHistory] = useState<InventoryAuditSession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // New Audit State
  const [selectedAuditCategory, setSelectedAuditCategory] = useState<string>('all');
  const [auditComment, setAuditComment] = useState('');
  const [shouldUpdateDatabase, setShouldUpdateDatabase] = useState(true);
  const [submittingAudit, setSubmittingAudit] = useState(false);
  
  // Local counts dictionary: { [productId]: physicalCountStringOrNumber }
  const [physicalCounts, setPhysicalCounts] = useState<{ [key: string]: number | '' }>({});

  const isSuperAdmin = userRights?.role === 'super_admin';

  // Load physical counts with theoretical defaults when categories of interest change
  useEffect(() => {
    const counts: { [key: string]: number | '' } = {};
    products.forEach(p => {
      if (selectedAuditCategory === 'all' || p.category === selectedAuditCategory) {
        counts[p.id] = p.quantity; // Default to theoretical value to reduce data entry overhead
      }
    });
    setPhysicalCounts(counts);
  }, [selectedAuditCategory, products]);

  // Read history of audits
  useEffect(() => {
    const auditsRef = collection(db, 'audits');
    const q = query(auditsRef, orderBy('createdAt', 'desc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs: InventoryAuditSession[] = [];
      snapshot.forEach((doc) => {
        logs.push({
          id: doc.id,
          ...doc.data()
        } as InventoryAuditSession);
      });
      setAuditsHistory(logs);
      setHistoryLoading(false);
    }, (error) => {
      console.error("Error reading audits history:", error);
      setHistoryLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter products for the active audit sheet
  const auditProducts = products.filter(p => {
    // Sector permission check for standard admins
    const canEditCategory = isSuperAdmin || (userRights?.permissions || []).includes(p.category);
    if (!canEditCategory) return false;

    return selectedAuditCategory === 'all' || p.category === selectedAuditCategory;
  });

  const handleApplyTheoretical = () => {
    const counts: { [key: string]: number | '' } = {};
    auditProducts.forEach(p => {
      counts[p.id] = p.quantity;
    });
    setPhysicalCounts(counts);
  };

  const handleResetCounts = () => {
    const counts: { [key: string]: number | '' } = {};
    auditProducts.forEach(p => {
      counts[p.id] = '';
    });
    setPhysicalCounts(counts);
  };

  const calculateDiscrepancies = () => {
    let matches = 0;
    let gaps = 0;
    let totalEcartValue = 0;
    
    auditProducts.forEach(p => {
      const pCount = physicalCounts[p.id];
      const physical = pCount === '' ? 0 : Number(pCount);
      const diff = physical - p.quantity;
      if (diff === 0) {
        matches++;
      } else {
        gaps++;
        totalEcartValue += Math.abs(diff);
      }
    });

    return { matches, gaps, totalEcartValue };
  };

  const { matches: matchCount, gaps: gapCount, totalEcartValue: absoluteGap } = calculateDiscrepancies();

  const handleSaveAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (auditProducts.length === 0) {
      alert("Aucun produit à auditer.");
      return;
    }

    setSubmittingAudit(true);
    try {
      const auditItems: InventoryAuditItem[] = auditProducts.map(p => {
        const pCount = physicalCounts[p.id];
        const physical = pCount === '' ? 0 : Number(pCount);
        return {
          productId: p.id,
          productName: p.name,
          category: p.category,
          theoreticalQuantity: p.quantity,
          physicalQuantity: physical,
          discrepancy: physical - p.quantity
        };
      });

      // Save audit log session to db
      const auditSessionData = {
        userEmail: userEmail,
        createdAt: serverTimestamp(),
        items: auditItems,
        comment: auditComment.trim(),
        status: 'validated'
      };

      await addDoc(collection(db, 'audits'), auditSessionData);

      // Optionally update products database if toggle is enabled
      if (shouldUpdateDatabase) {
        const batch = writeBatch(db);
        const todayStr = new Date().toISOString().substring(0, 10);

        for (const item of auditItems) {
          const productRef = doc(db, 'products', item.productId);
          
          // Save updated quantity and audit stamp
          batch.update(productRef, {
            quantity: item.physicalQuantity,
            lastAuditDate: todayStr,
            updatedAt: serverTimestamp()
          });

          // If discrepancy exists, register a standard adjustment movement log too
          if (item.discrepancy !== 0) {
            const mRef = doc(collection(db, 'stock_movements'));
            batch.set(mRef, {
              productId: item.productId,
              productName: item.productName,
              category: item.category,
              type: 'adjustment',
              difference: item.discrepancy,
              finalQuantity: item.physicalQuantity,
              userEmail: userEmail,
              createdAt: serverTimestamp()
            });
          }
        }

        await batch.commit();
      } else {
        // Just audit dates update
        const batch = writeBatch(db);
        const todayStr = new Date().toISOString().substring(0, 10);
        for (const item of auditItems) {
          const productRef = doc(db, 'products', item.productId);
          batch.update(productRef, {
            lastAuditDate: todayStr
          });
        }
        await batch.commit();
      }

      alert("L'inventaire d'audit physique a été validé et enregistré avec succès !");
      setAuditComment('');
      setActiveTab('history');
    } catch (err: any) {
      console.error("Error committing audit session:", err);
      alert("Une erreur est survenue lors de l'enregistrement de l'audit.");
    } finally {
      setSubmittingAudit(false);
    }
  };

  // Date format helper
  const formatHistoryTime = (timestamp: any) => {
    if (!timestamp) return 'Instantané';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl w-full max-w-4xl shadow-xl border border-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Header Block */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-50 text-clinic-green rounded-xl">
              <ClipboardCheck size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Contrôle d'Inventaire Physique & Écarts</h3>
              <p className="text-[10px] text-slate-500 font-medium">Relevez le stock réel des placards pour assurer la régularité des soins médicaux</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-1.5 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-4">
          <button
            onClick={() => setActiveTab('new')}
            className={`py-3 px-4 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition ${activeTab === 'new' ? 'border-clinic-green text-clinic-green' : 'border-transparent text-slate-500 hover:text-slate-705'}`}
          >
            <ListPlus size={14} /> Nouvel Inventaire de Garde
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition ${activeTab === 'history' ? 'border-clinic-green text-clinic-green' : 'border-transparent text-slate-500 hover:text-slate-705'}`}
          >
            <History size={14} /> Registre des Audits Passés ({auditsHistory.length})
          </button>
        </div>

        {activeTab === 'new' ? (
          /* =================== TABS 1: NEW INVENTORY AUDIT ==================== */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
            
            {/* Left side: sheet grid of inventory products */}
            <div className="flex-1 p-5 overflow-y-auto border-r border-slate-100 flex flex-col space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide">Fiche de comptage</h4>
                  <p className="text-[10px] text-slate-500">Filtrer par secteur pour segmenter votre session d'inventaire clinique.</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedAuditCategory}
                    onChange={(e) => setSelectedAuditCategory(e.target.value)}
                    className="text-xs border border-slate-300 bg-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-clinic-blue"
                  >
                    <option value="all">Tous secteurs autorisés</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Action shortcuts */}
              <div className="flex flex-wrap items-center gap-2 text-[10px]">
                <button
                  type="button"
                  onClick={handleApplyTheoretical}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1 rounded-lg transition"
                >
                  Recopier stock théorique de la base
                </button>
                <button
                  type="button"
                  onClick={handleResetCounts}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold px-2.5 py-1 rounded-lg transition"
                >
                  Vider toutes les cases réelles
                </button>
              </div>

              {auditProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <AlertTriangle className="mx-auto text-slate-300 animate-bounce" size={28} />
                  <p className="text-xs">Aucun article disponible pour inventaire dans vos secteurs autorisés.</p>
                </div>
              ) : (
                <div className="border border-slate-150 rounded-xl overflow-hidden bg-white max-h-[350px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] uppercase font-bold text-slate-450 border-b border-slate-150">
                        <td className="py-2.5 px-3">Désignation</td>
                        <td className="py-2.5 px-3">Secteur</td>
                        <td className="py-2.5 px-3 text-center">Théorique (base)</td>
                        <td className="py-2.5 px-3 text-center">Physique (étagère)</td>
                        <td className="py-2.5 px-3 text-center">Écart de stock</td>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {auditProducts.map(p => {
                        const countVal = physicalCounts[p.id];
                        const theoreticalVal = p.quantity;
                        const physicalVal = countVal === '' ? 0 : Number(countVal);
                        const discrepancy = physicalVal - theoreticalVal;

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/40">
                            <td className="py-2.5 px-3 font-semibold text-slate-850">
                              <span className="block truncate max-w-[200px]" title={p.name}>{p.name}</span>
                              {p.lotNumber && (
                                <span className="text-[8.5px] text-slate-400 font-mono">Lot: {p.lotNumber}</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-500 text-[10px]">
                              {p.category}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-600">
                              {theoreticalVal}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={countVal}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0);
                                  setPhysicalCounts(prev => ({ ...prev, [p.id]: val }));
                                }}
                                className="w-16 text-center font-bold bg-white border border-slate-300 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-clinic-blue font-mono"
                              />
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {countVal === '' ? (
                                <span className="text-slate-400 text-[10px]">Non saisi</span>
                              ) : discrepancy === 0 ? (
                                <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">✓ Conforme</span>
                              ) : (
                                <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[10px] ${discrepancy > 0 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                                  {discrepancy > 0 ? `+${discrepancy}` : discrepancy}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right side: Summary and Commit Actions */}
            <form onSubmit={handleSaveAudit} className="w-full md:w-80 p-5 bg-slate-50/50 flex flex-col justify-between overflow-y-auto space-y-6">
              <div className="space-y-4">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block border-b border-slate-200/60 pb-1.5">Statistiques d'écart</span>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Conformes</span>
                    <strong className="text-emerald-500 text-lg font-bold">{matchCount}</strong>
                    <span className="text-[9px] block text-slate-400">éléments</span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <span className="text-[9px] text-slate-400 uppercase font-bold block">Discordances</span>
                    <strong className={`text-lg font-bold ${gapCount > 0 ? 'text-amber-500 animate-pulse' : 'text-slate-400'}`}>{gapCount}</strong>
                    <span className="text-[9px] block text-slate-400">écart{gapCount > 1 ? 's' : ''} constaté{gapCount > 1 ? 's' : ''}</span>
                  </div>
                </div>

                {gapCount > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[10px] text-amber-800 leading-relaxed flex gap-1.5 items-start">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      Des écarts ont été décelés représentant un cumul de <strong>{absoluteGap} unités</strong> de différence entre la base et les étagères.
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Notes & Remarques d'inventaire</label>
                  <textarea
                    placeholder="Ex: Écarts mineurs sur les gants, boîtes mal rangées dans le placard du bloc..."
                    value={auditComment}
                    onChange={(e) => setAuditComment(e.target.value)}
                    rows={3}
                    className="w-full bg-white text-xs border border-slate-300 rounded-lg p-2 focus:ring-1 focus:ring-clinic-blue focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Synchronisation base de données</span>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shouldUpdateDatabase}
                      onChange={(e) => setShouldUpdateDatabase(e.target.checked)}
                      className="mt-0.5 text-clinic-blue rounded"
                    />
                    <div className="text-[10px] text-slate-600 leading-tight">
                      <strong>Mettre à jour les stocks clinique</strong> réels d'après ces comptages physiques.
                    </div>
                  </label>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={submittingAudit || auditProducts.length === 0}
                  className="w-full py-2.5 px-4 bg-clinic-green hover:bg-opacity-95 disabled:bg-slate-300 text-white font-bold text-xs uppercase rounded-xl transition flex items-center justify-center gap-1.5 shadow shadow-clinic-green/10 cursor-pointer"
                >
                  <Save size={14} /> 
                  {submittingAudit ? 'Enregistrement...' : 'Valider l\'inventaire'}
                </button>

                <p className="text-[8.5px] text-slate-400 text-center leading-normal">
                  Chaque validation signe un log d'audit immuable avec votre profil : <strong className="text-slate-600 font-mono">{userEmail}</strong>.
                </p>
              </div>
            </form>
          </div>
        ) : (
          /* =================== TABS 2: AUDIT HISTORY REGISTRY ==================== */
          <div className="flex-1 p-6 overflow-y-auto min-h-0 space-y-4">
            
            <div className="space-y-1">
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide">Historique réglementaire d'inventaire clinique</h4>
              <p className="text-[10px] text-slate-500">Toutes les constatations d'écart physiques réalisées sur l'étagère de garde.</p>
            </div>

            {historyLoading ? (
              <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                Chargement des archives d'audits physiques...
              </div>
            ) : auditsHistory.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-1">
                <ClipboardCheck className="mx-auto text-slate-300" size={32} />
                <p className="text-xs">Aucun audit physique n'a encore été enregistré.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {auditsHistory.map((audit) => {
                  const itemsCount = audit.items?.length || 0;
                  const discrepancyItems = audit.items?.filter(it => it.discrepancy !== 0) || [];
                  const isExpanded = expandedSessionId === audit.id;

                  return (
                    <div key={audit.id} className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden transition">
                      
                      {/* Grid preview card header */}
                      <button
                        type="button"
                        onClick={() => setExpandedSessionId(isExpanded ? null : audit.id)}
                        className="w-full text-left p-4 hover:bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/20"
                      >
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-slate-800 flex items-center gap-1 font-mono">
                              📂 Réf: {audit.id.substring(0, 8).toUpperCase()}
                            </span>
                            <span className="bg-slate-200 text-slate-600 font-bold font-mono text-[9px] px-1.5 py-0.5 rounded">
                              {itemsCount} articles comptés
                            </span>
                            {discrepancyItems.length > 0 ? (
                              <span className="bg-rose-50 text-rose-700 font-bold text-[9px] px-1.5 py-0.5 rounded border border-rose-100/40">
                                {discrepancyItems.length} écart{discrepancyItems.length > 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="bg-emerald-50 text-emerald-600 font-bold text-[9px] px-1.5 py-0.5 rounded border border-emerald-100/30">
                                ✓ 100% Conforme
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500">
                            <span className="flex items-center gap-1 font-semibold text-slate-600">
                              <User size={12} className="text-slate-400" /> Par: {audit.userEmail}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar size={12} className="text-slate-400" /> Le: {formatHistoryTime(audit.createdAt)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {audit.comment && (
                            <MessageSquare size={13} className="text-slate-400" title={`Commentaire: ${audit.comment}`} />
                          )}
                          <span className="text-[10px] font-bold text-clinic-blue hover:underline">
                            {isExpanded ? 'Réduire [-]' : 'Consulter le détail [+]'}
                          </span>
                        </div>
                      </button>

                      {/* Expandable itemized discrepancy list */}
                      {isExpanded && (
                        <div className="p-4 border-t border-slate-150 bg-slate-50/20 space-y-3">
                          {audit.comment && (
                            <div className="p-2.5 bg-white border border-slate-200/80 rounded-lg text-xs flex gap-2">
                              <MessageSquare size={14} className="text-clinic-blue shrink-0 mt-0.5" />
                              <div>
                                <strong className="text-slate-500 text-[10px] uppercase font-bold block leading-none mb-1">Notes administratives :</strong>
                                <span className="text-slate-700 font-medium italic">{audit.comment}</span>
                              </div>
                            </div>
                          )}

                          <div className="space-y-1.5">
                            <h5 className="text-[10px] uppercase text-slate-500 font-bold block">Articles audités lors de cette session d'inventaire :</h5>
                            <div className="border border-slate-150 rounded-xl overflow-hidden bg-white text-xs max-h-[220px] overflow-y-auto">
                              <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 text-[9px] font-bold uppercase text-slate-500 border-b border-slate-150">
                                  <tr>
                                    <td className="py-2 px-3">Article</td>
                                    <td className="py-2 px-3 text-center">Théorique</td>
                                    <td className="py-2 px-3 text-center">Comptage réel</td>
                                    <td className="py-2 px-3 text-center">Écart</td>
                                    <td className="py-2 px-3 text-center">Statut d'étagère</td>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-[11.5px]">
                                  {audit.items?.map((it, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50">
                                      <td className="py-2 px-3">
                                        <span className="font-bold text-slate-800">{it.productName}</span>
                                        <span className="block text-[8.5px] text-slate-400 font-semibold">{it.category}</span>
                                      </td>
                                      <td className="py-2 px-3 text-center font-mono text-slate-500">
                                        {it.theoreticalQuantity}
                                      </td>
                                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">
                                        {it.physicalQuantity}
                                      </td>
                                      <td className="py-2 px-3 text-center">
                                        {it.discrepancy === 0 ? (
                                          <span className="font-bold text-emerald-600 font-mono">0</span>
                                        ) : (
                                          <span className={`font-mono font-bold ${it.discrepancy > 0 ? 'text-amber-600' : 'text-rose-650'}`}>
                                            {it.discrepancy > 0 ? `+${it.discrepancy}` : it.discrepancy}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2 px-3 text-center">
                                        {it.discrepancy === 0 ? (
                                          <span className="text-[10px] font-semibold text-emerald-600 uppercase">Exact (Conforme)</span>
                                        ) : (
                                          <span className={`text-[10px] font-bold uppercase ${it.discrepancy > 0 ? 'text-amber-600' : 'text-rose-650'}`}>
                                            {it.discrepancy > 0 ? 'Surnombre' : 'Déficit (Perte)'}
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-55 rounded-b-2xl flex justify-between items-center text-[10px] text-slate-400 font-medium">
          <span className="flex items-center gap-1"><ShieldCheck size={12} className="text-emerald-500" /> Session sécurisée d'audit de santé clinique</span>
          <button
            onClick={onClose}
            className="border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-xl py-2 px-5 text-xs font-semibold cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </motion.div>
    </div>
  );
}
