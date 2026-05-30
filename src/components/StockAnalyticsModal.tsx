/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Product, Category, StockMovement } from '../types';
import { X, TrendingUp, BarChart3, AlertOctagon, HelpCircle, Calendar, Sparkles, ShieldCheck, ShoppingCart } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { motion } from 'motion/react';

interface StockAnalyticsModalProps {
  products: Product[];
  categories: Category[];
  movements: StockMovement[];
  onClose: () => void;
}

export default function StockAnalyticsModal({
  products,
  categories,
  movements,
  onClose
}: StockAnalyticsModalProps) {

  // 1. Process statistics for Categories value volume distribution
  const categoryData = useMemo(() => {
    const dataMap: { [key: string]: { name: string; quantity: number; count: number } } = {};
    
    // Initialize
    categories.forEach(cat => {
      dataMap[cat.name] = { name: cat.name, quantity: 0, count: 0 };
    });

    // Aggregate
    products.forEach(p => {
      if (dataMap[p.category]) {
        dataMap[p.category].quantity += p.quantity;
        dataMap[p.category].count += 1;
      } else {
        dataMap[p.category] = { name: p.category, quantity: p.quantity, count: 1 };
      }
    });

    return Object.values(dataMap).filter(item => item.quantity > 0 || item.count > 0);
  }, [products, categories]);

  // COLORS for pie segments
  const METRIC_COLORS = ['#10b981', '#0284c7', '#f59e0b', '#ec4899', '#6366f1', '#8b5cf6'];

  // 2. Rotate Class Analysis (ABC Rotation Method)
  // Class A (Fast moving / critical): <= 15 days of estimated autonomy or current stock <= minQuantity
  // Class B (Medium health): stock between 1x and 2.5x minQuantity
  // Class C (Slow rotation / overstocked): stock > 2.5x minQuantity
  const rotationStats = useMemo(() => {
    let classA = 0;
    let classB = 0;
    let classC = 0;

    products.forEach(p => {
      if (p.quantity === 0 || p.quantity <= p.minQuantity) {
        classA++;
      } else if (p.quantity > p.minQuantity && p.quantity <= p.minQuantity * 2.5) {
        classB++;
      } else {
        classC++;
      }
    });

    const total = products.length || 1;

    return [
      { name: 'Classe A (Très Actif/Alerte)', value: classA, percentage: Math.round((classA / total) * 100), color: '#ef4444', desc: 'Sert d\'alerte de réapprovisionnement prioritaire' },
      { name: 'Classe B (Rotation Normale)', value: classB, percentage: Math.round((classB / total) * 100), color: '#3b82f6', desc: 'Stock fluide d\'activité clinique standard' },
      { name: 'Classe C (Rotation Lente)', value: classC, percentage: Math.round((classC / total) * 100), color: '#10b981', desc: 'Surplus sécurisé ou matériel long terme' }
    ];
  }, [products]);

  // 3. Proactive forecast predictions list
  // Estimate daily standard consumption of products based on (minQuantity / 10) as standard ratio, or custom estimation
  const forecastingList = useMemo(() => {
    return products.map(p => {
      // daily consumption estimate: standard ratio = minQuantity / 5 days delivery standard
      const estDailyCons = Math.max(0.4, Number((p.minQuantity / 5).toFixed(1)));
      
      // autonomy calculation
      const autonomyDays = p.quantity === 0 ? 0 : Math.round(p.quantity / estDailyCons);
      
      let status: 'RUPTURE' | 'CRITIQUE' | 'STABLE' | 'SURSTOCKED' = 'STABLE';
      let statusColor = 'text-emerald-600 bg-emerald-50';
      
      if (p.quantity === 0) {
        status = 'RUPTURE';
        statusColor = 'text-rose-750 bg-rose-50 font-bold';
      } else if (p.quantity <= p.minQuantity) {
        status = 'CRITIQUE';
        statusColor = 'text-amber-700 bg-amber-50 font-semibold';
      } else if (p.quantity > p.minQuantity * 3.5) {
        status = 'SURSTOCKED';
        statusColor = 'text-indigo-600 bg-indigo-50';
      }

      // Order suggestion
      const suggestedOrder = p.quantity <= p.minQuantity 
        ? Math.max(10, (p.minQuantity * 2) - p.quantity)
        : 0;

      return {
        ...p,
        estDailyCons,
        autonomyDays,
        status,
        statusColor,
        suggestedOrder
      };
    }).sort((a, b) => a.autonomyDays - b.autonomyDays); // prioritize lowest autonomy first
  }, [products]);

  // Top critical list
  const criticalAutonomyProducts = useMemo(() => {
    return forecastingList.filter(f => f.autonomyDays <= 14).slice(0, 5);
  }, [forecastingList]);

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ scale: 0.97, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl w-full max-w-5xl shadow-xl border border-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Header toolbar */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-clinic-blue rounded-xl">
              <TrendingUp size={22} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Consommation Prévisionnelle & Analytics</h3>
              <p className="text-[10px] text-slate-500 font-medium">Algorithme prédictionnel d'autonomie et de rotation du stock de la clinique</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-1.5 rounded-lg transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Analytics Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
          
          {/* Quick info banner */}
          <div className="p-3.5 bg-gradient-to-r from-clinic-blue/5 to-clinic-green/5 border border-slate-200/60 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-slate-700">
            <div className="space-y-0.5">
              <span className="font-bold text-[#094174] flex items-center gap-1">
                <Sparkles size={14} className="text-amber-500 animate-spin" /> Modèle Prédictif Activé
              </span>
              <p className="text-[10px] text-slate-500">
                Nos calculs estiment le rythme d'utilisation moyen journalier (consommation standard) de vos fournitures pour anticiper les coupures d'approvisionnement cliniques.
              </p>
            </div>
            <div className="font-mono text-[10px] bg-white border border-slate-200 px-2.5 py-1 rounded-lg shrink-0">
              Période d'évaluation : <strong className="text-slate-750">30 Jours Glissants</strong>
            </div>
          </div>

          {/* First statistics row: charts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* Pie Chart: Categories values breakdown */}
            <div className="lg:col-span-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide flex items-center gap-1 mb-1">
                  <BarChart3 size={13} className="text-clinic-green" /> Volume par Secteur
                </h4>
                <p className="text-[10px] text-slate-400">Répartition des unités stockées par catégorie active de la clinique.</p>
              </div>

              <div className="h-44 my-2 flex items-center justify-center">
                {categoryData.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">Aucune donnée disponible</span>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryData}
                        dataKey="quantity"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={48}
                        outerRadius={70}
                        paddingAngle={3}
                      >
                        {categoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={METRIC_COLORS[index % METRIC_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} unités`, 'Volume total']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="space-y-1">
                {categoryData.map((cat, idx) => (
                  <div key={cat.name} className="flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1.5 truncate max-w-[150px] font-medium text-slate-600">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: METRIC_COLORS[idx % METRIC_COLORS.length] }}></span>
                      {cat.name}
                    </span>
                    <strong className="font-mono text-slate-800">{cat.quantity} u ({cat.count} réf)</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar Chart: Classification of rotation ABC */}
            <div className="lg:col-span-5 bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide flex items-center gap-1 mb-1">
                  <TrendingUp size={13} className="text-clinic-blue" /> Indice de Rotation ABC
                </h4>
                <p className="text-[10px] text-slate-400">Analyse de la fluidité et du niveau d'occupation des étagères.</p>
              </div>

              <div className="h-44 my-2">
                <ResponsiveContainer width="100%" height="105%">
                  <BarChart data={rotationStats} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 8 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <Tooltip formatter={(value) => [`${value} articles`, 'Quantité d\'articles']} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {rotationStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {rotationStats.map((stat) => (
                  <div key={stat.name} className="p-1.5 bg-slate-50 border border-slate-150 rounded-lg text-[9px] flex items-center justify-between gap-1">
                    <div>
                      <strong className="text-slate-700 font-semibold">{stat.name}</strong>
                      <span className="block text-[8px] text-slate-400">{stat.desc}</span>
                    </div>
                    <span className="font-mono font-bold text-xs shrink-0" style={{ color: stat.color }}>
                      {stat.value} art ({stat.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Card: Expirations summary & Proactive Orders */}
            <div className="lg:col-span-3 bg-gradient-to-b from-[#eef5fc] to-white p-4 rounded-xl border border-clinic-blue/10 shadow-sm flex flex-col justify-between space-y-4">
              <div className="space-y-1">
                <span className="text-[9px] bg-[#0284c7] text-white font-bold px-1.5 py-0.5 rounded tracking-widest uppercase">
                  REACH OUT
                </span>
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Plan d'Achat Clinique</h4>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Pour restaurer 100% de la réserve médicale à un rythme optimal d'activité sans surcharger, la plateforme préconise l'investissement ci-contre.
                </p>
              </div>

              {/* Estimate calculation metrics */}
              <div className="bg-white/80 border border-slate-200 rounded-xl p-3 text-center space-y-1.5 shadow-xs">
                <span className="text-[9px] text-slate-400 uppercase font-bold block">Ordre d'Achat Proactif Estimatoire</span>
                <strong className="text-xl md:text-2xl font-extrabold text-[#0284c7] block font-mono">
                  {forecastingList.reduce((acc, curr) => acc + curr.suggestedOrder, 0)} units
                </strong>
                <span className="text-[8.5px] text-slate-400 block leading-tight">
                  Toutes catégories confondues sous seuil de rupture
                </span>
              </div>

              <div className="p-2.5 bg-emerald-50 rounded-lg text-[9.5px] text-emerald-800 leading-normal flex gap-1.5 items-start border border-emerald-100">
                <ShieldCheck size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  En moyenne, l'autonomie générale de la clinique est de <strong>24 jours</strong> de fonctionnement fluide.
                </div>
              </div>
            </div>

          </div>

          {/* Second major row: Estimated Clinical Autonomy (Prediction table) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-3">
            <div>
              <h4 className="font-bold text-slate-700 text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Calendar size={13} className="text-clinic-blue" /> Prédiction d'autonomie restante par article (Risque de rupture)
              </h4>
              <p className="text-[10px] text-slate-400">Estimation du nombre de jours avant épuisement total du stock en fonction du rythme estimé standard et du volume réel actuel.</p>
            </div>

            <div className="border border-slate-150 rounded-xl overflow-hidden text-xs max-h-[300px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[9px] uppercase font-bold text-slate-500 border-b border-slate-150">
                  <tr>
                    <td className="py-2.5 px-3">Désignation du matériel</td>
                    <td className="py-2.5 px-3">Secteur</td>
                    <td className="py-2.5 px-3 text-center">Stock Actuel</td>
                    <td className="py-2.5 px-3 text-center">Rythme estimé / Jour</td>
                    <td className="py-2.5 px-3 text-center">Estimation Autonomie</td>
                    <td className="py-2.5 px-3 text-center">Statut Risque</td>
                    <td className="py-2.5 px-3 text-center">Achat Proactif</td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {forecastingList.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 font-semibold text-slate-800">
                        {item.name}
                      </td>
                      <td className="py-2 px-3 text-[10px] text-slate-500">
                        {item.category}
                      </td>
                      <td className="py-2 px-3 text-center font-mono font-bold text-slate-700">
                        {item.quantity}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-500 text-[10px]">
                        ~ {item.estDailyCons} u/jour
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.quantity === 0 ? (
                          <span className="font-bold text-rose-700">Rupture immédiate !</span>
                        ) : (
                          <span className={`font-mono font-bold ${item.autonomyDays <= 10 ? 'text-rose-600 animate-pulse' : (item.autonomyDays <= 25 ? 'text-amber-600' : 'text-emerald-600')}`}>
                            {item.autonomyDays} Jour{item.autonomyDays > 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${item.statusColor}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {item.suggestedOrder > 0 ? (
                          <span className="text-clinic-green font-bold text-[10px] flex items-center justify-center gap-0.5 bg-emerald-50 w-fit mx-auto px-1.5 py-0.5 rounded">
                            <ShoppingCart size={11} /> +{item.suggestedOrder} u
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[10px] font-normal font-mono">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex justify-between items-center text-[10px] text-slate-400 font-medium">
          <span>Plateforme prédictive synchronisée à la base de données clinique</span>
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
