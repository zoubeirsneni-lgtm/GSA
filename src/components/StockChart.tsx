/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Product, Category } from '../types';
import { Layers, PackageOpen, Info, PieChart as PieIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface StockChartProps {
  products: Product[];
  categories: Category[];
}

const CHART_COLORS = [
  '#0b59b1', // Clinic Blue
  '#00b074', // Clinic Green
  '#f89406', // Clinic Accent Orange
  '#8b5cf6', // Indigo/Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#ef4444', // Red
  '#f59e0b', // Amber
];

export default function StockChart({ products, categories }: StockChartProps) {
  const [metricMode, setMetricMode] = useState<'quantity' | 'references'>('quantity');

  // Compute active categories with their values
  const rawChartData = categories.map((cat) => {
    const catProducts = products.filter((p) => p.category === cat.name);
    const totalQuantity = catProducts.reduce((sum, p) => sum + p.quantity, 0);
    const refsCount = catProducts.length;

    return {
      name: cat.name,
      quantity: totalQuantity,
      references: refsCount,
    };
  });

  // Filter out those with 0 value depending on what metric is displayed to avoid empty chart slices
  const chartData = rawChartData
    .map((item) => ({
      name: item.name,
      value: metricMode === 'quantity' ? item.quantity : item.references,
    }))
    .filter((item) => item.value > 0);

  // Math totals for percentages
  const totalGlobalValue = chartData.reduce((sum, item) => sum + item.value, 0);

  // Custom premium Tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const percentage = totalGlobalValue > 0 ? ((data.value / totalGlobalValue) * 100).toFixed(1) : '0';
      return (
        <div className="bg-white p-3.5 border border-slate-200/80 shadow-lg rounded-xl text-xs space-y-1">
          <p className="font-bold text-slate-800">{data.name}</p>
          <p className="font-semibold text-slate-600">
            {metricMode === 'quantity' ? (
              <>
                Stock : <span className="text-clinic-blue font-bold">{data.value}</span> unités
              </>
            ) : (
              <>
                Références : <span className="text-clinic-blue font-bold">{data.value}</span> produits
              </>
            )}
          </p>
          <p className="text-slate-400 text-[10px] font-medium font-mono">
            Part : {percentage}% de l'inventaire
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col lg:flex-row gap-6 items-center">
      {/* Chart visualization column */}
      <div className="w-full lg:w-1/2 flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-clinic-light-blue rounded-lg text-clinic-blue">
              <PieIcon size={16} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Répartition de Stock</h3>
              <p className="text-[10px] text-slate-400">Analyse visuelle par catégories de la clinique</p>
            </div>
          </div>

          {/* Metric Switcher Toggles */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/50">
            <button
              onClick={() => setMetricMode('quantity')}
              className={`px-3 py-1 text-[10px] font-bold rounded-lg cursor-pointer transition ${
                metricMode === 'quantity'
                  ? 'bg-white text-clinic-blue shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Volume de Stock
            </button>
            <button
              onClick={() => setMetricMode('references')}
              className={`px-3 py-1 text-[10px] font-bold rounded-lg cursor-pointer transition ${
                metricMode === 'references'
                  ? 'bg-white text-clinic-blue shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Références
            </button>
          </div>
        </div>

        {/* Dynamic Pie Render */}
        <div className="h-64 relative flex items-center justify-center">
          {chartData.length === 0 ? (
            <div className="text-center p-6 bg-slate-50 border border-dashed border-slate-300/60 rounded-xl max-w-sm space-y-1.5">
              <PackageOpen size={24} className="mx-auto text-slate-400" />
              <p className="text-xs font-semibold text-slate-600">Aucun produit en stock</p>
              <p className="text-[10px] text-slate-400 leading-normal">
                Ajoutez des produits avec des stocks positifs pour commencer à visualiser la répartition.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  animationDuration={850}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={CHART_COLORS[index % CHART_COLORS.length]} 
                      style={{ outline: 'none' }}
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}

          {/* Center visual metric details inside Donut donut gap */}
          {chartData.length > 0 && (
            <div className="absolute text-center select-none pointer-events-none">
              <span className="text-2xl font-black text-slate-800 block leading-tight tracking-tight">
                {totalGlobalValue}
              </span>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest font-mono block">
                {metricMode === 'quantity' ? 'Unités Totales' : 'Références'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Legend & Details table column */}
      <div className="w-full lg:w-1/2 self-stretch flex flex-col justify-between">
        <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-2 mt-2 lg:mt-8">
          {chartData.length === 0 ? (
            <div className="bg-[#eef5fc]/30 border border-clinic-blue/10 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-slate-500">
              <Info size={16} className="text-clinic-blue shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Le graphique circulaire affiche en temps réel le pourcentage représenté par chaque type de matériel médical ou denrée par rapport au stock total actif de la clinique.
              </p>
            </div>
          ) : (
            chartData.map((item, index) => {
              const color = CHART_COLORS[index % CHART_COLORS.length];
              const percentage = totalGlobalValue > 0 ? ((item.value / totalGlobalValue) * 100).toFixed(1) : '0';
              return (
                <div 
                  key={item.name} 
                  className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span 
                      className="w-3.5 h-3.5 rounded-md shrink-0 block border border-white/20 shadow-sm"
                      style={{ backgroundColor: color }}
                    />
                    <span className="font-bold text-slate-700 text-xs truncate max-w-[150px] lg:max-w-[200px]">
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono font-bold text-slate-800">
                      {item.value} {metricMode === 'quantity' ? 'U' : 'Réf'}
                    </span>
                    <span className="text-[10px] font-semibold font-mono bg-slate-100 text-slate-500 rounded px-1.5 py-0.5 shrink-0">
                      {percentage}%
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Informative footer */}
        <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-1">
            <Layers size={13} className="text-slate-400" />
            <span>Filtres appliqués : catégories configurées</span>
          </div>
          <span className="font-semibold text-clinic-green font-mono">Synchronisation instantanée</span>
        </div>
      </div>
    </div>
  );
}
