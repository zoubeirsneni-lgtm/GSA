/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { StockMovement, Category } from '../types';
import { X, History, ArrowDownUp, AlertCircle, Search, Filter, Calendar, User, ShoppingBag } from 'lucide-react';

interface StockMovementLogModalProps {
  categories: Category[];
  onClose: () => void;
}

export default function StockMovementLogModal({ categories, onClose }: StockMovementLogModalProps) {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter systems
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    // Only fetch up to 300 logs at a time for performance optimization
    const movementsRef = collection(db, 'stock_movements');
    const q = query(movementsRef, orderBy('createdAt', 'desc'), limit(300));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs: StockMovement[] = [];
      snapshot.forEach((doc) => {
        logs.push({
          id: doc.id,
          ...doc.data()
        } as StockMovement);
      });
      setMovements(logs);
      setLoading(false);
    }, (error) => {
      console.error("Error reading stock movements:", error);
      setErrorMsg("Impossible de charger l'historique des stocks. Permissions insuffisantes.");
      handleFirestoreError(error, OperationType.LIST, 'stock_movements');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter logs locally
  const filteredLogs = movements.filter((log) => {
    // Category match
    const categoryMatch = selectedCategory === 'all' || log.category === selectedCategory;

    // Type match
    const typeMatch = selectedType === 'all' || log.type === selectedType;

    // Word search match
    const searchMatch = 
      log.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase());

    return categoryMatch && typeMatch && searchMatch;
  });

  // Human-readable formatted date helper
  const formatTime = (timestamp: any) => {
    if (!timestamp) return 'Instantané';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <History className="text-clinic-blue" size={20} />
            <div>
              <h3 className="font-bold text-slate-800 text-base">Historique des Flux de Stock</h3>
              <p className="text-[10px] text-slate-500 font-medium">Tracabilité complète et audit des entrées/sorties (Super Admin)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-1 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters and search banner toolbar */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Searching */}
          <div className="relative md:col-span-4">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Rechercher produit ou auteur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2.5 focus:ring-2 focus:ring-clinic-blue/40 focus:outline-none"
            />
          </div>

          {/* Filtering operations type */}
          <div className="md:col-span-3 flex items-center gap-2">
            <Filter size={13} className="text-slate-400 shrink-0" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full text-xs border border-slate-300 bg-white rounded-xl px-2 py-2.5 focus:outline-none focus:ring-2 focus:ring-clinic-blue/40"
            >
              <option value="all">Sorte de flux : Tous</option>
              <option value="creation">Création d'article</option>
              <option value="adjustment">Ajustement numérique</option>
              <option value="deletion">Suppression d'article</option>
            </select>
          </div>

          {/* Filtering category */}
          <div className="md:col-span-3 flex items-center gap-2">
            <ShoppingBag size={13} className="text-slate-400 shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full text-xs border border-slate-300 bg-white rounded-xl px-2 py-2.5 focus:outline-none focus:ring-2 focus:ring-clinic-blue/40"
            >
              <option value="all">Secteur : Tous</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex items-center justify-end text-[11px] font-mono font-bold text-slate-500">
            {filteredLogs.length} ligne{filteredLogs.length > 1 ? 's' : ''}
          </div>
        </div>

        {/* Content body log table */}
        <div className="flex-1 overflow-y-auto p-5">
          {errorMsg && (
            <div className="p-4 bg-rose-50 text-rose-600 rounded-xl text-xs flex gap-2 items-center mb-4">
              <AlertCircle size={18} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="text-center py-16 text-slate-400 text-xs font-semibold">
              Récupération des logs d'audit sécurisés...
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-16 space-y-2 text-slate-400">
              <History className="mx-auto text-slate-300" size={32} />
              <p className="text-xs">Aucun mouvement enregistré correspondant aux critères.</p>
            </div>
          ) : (
            <div className="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse bg-white">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                    <td className="py-2.5 px-4"><span className="flex items-center gap-1"><Calendar size={11} /> Date & heure</span></td>
                    <td className="py-2.5 px-4">Type de flux</td>
                    <td className="py-2.5 px-4">Produit concerné</td>
                    <td className="py-2.5 px-4 text-center">Variations (Écart)</td>
                    <td className="py-2.5 px-4 text-center">Stock final</td>
                    <td className="py-2.5 px-4"><span className="flex items-center gap-1"><User size={11} /> Modificateur</span></td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredLogs.map((log) => {
                    let typeBadgeClass = "bg-blue-50 text-blue-700 border-blue-100";
                    let typeLabel = "Ajustement";
                    if (log.type === 'creation') {
                      typeBadgeClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
                      typeLabel = "Création";
                    } else if (log.type === 'deletion') {
                      typeBadgeClass = "bg-rose-50 text-rose-700 border-rose-100";
                      typeLabel = "Suppression";
                    }

                    const isDiffPositive = log.difference > 0;
                    const diffText = log.type === 'creation' 
                      ? `+${log.difference}` 
                      : log.type === 'deletion'
                        ? `-${log.difference}`
                        : isDiffPositive 
                          ? `+${log.difference}` 
                          : log.difference;

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/50 transition">
                        {/* Time */}
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {formatTime(log.createdAt)}
                        </td>

                        {/* Event type badge */}
                        <td className="py-3 px-4">
                          <span className={`inline-flex px-2 py-0.5 border rounded-md text-[9px] font-bold uppercase tracking-wider ${typeBadgeClass}`}>
                            {typeLabel}
                          </span>
                        </td>

                        {/* Product information */}
                        <td className="py-3 px-4 font-semibold text-slate-800">
                          <span className="block max-w-[200px] truncate">{log.productName}</span>
                          <span className="block text-[9px] text-slate-400 font-semibold uppercase">{log.category}</span>
                        </td>

                        {/* Offset diff */}
                        <td className="py-3 px-4 text-center">
                          {log.type === 'deletion' ? (
                            <span className="font-mono font-bold text-rose-600 block bg-rose-50 border border-rose-100 rounded px-1 text-[10px] w-fit mx-auto min-w-[36px]">
                              Suppr
                            </span>
                          ) : (
                            <span className={`font-mono font-bold ${isDiffPositive || log.type === 'creation' ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {diffText}
                            </span>
                          )}
                        </td>

                        {/* Ending inventory quantity level */}
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">
                          {log.type === 'deletion' ? '-' : log.finalQuantity}
                        </td>

                        {/* Action user email profile */}
                        <td className="py-3 px-4 text-slate-500 font-medium truncate max-w-[150px]" title={log.userEmail}>
                          {log.userEmail}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between items-center text-[10px] text-slate-400 font-medium">
          <span>Journal d'activités crypté et synchronisé</span>
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
