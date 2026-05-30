/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, Category } from '../types';
import { useFirebase } from './FirebaseProvider';
import { 
  Plus, 
  FolderEdit, 
  ShieldAlert, 
  Search, 
  Filter, 
  ClipboardList, 
  Users, 
  LogOut, 
  TrendingDown, 
  AlertTriangle, 
  Edit, 
  Trash2, 
  Lock, 
  CheckCircle2, 
  PhoneCall,
  Menu,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import CategoryManager from './CategoryManager';
import ProductForm from './ProductForm';
import AdminManager from './AdminManager';
import SupplierModal from './SupplierModal';

export default function Dashboard() {
  const { user, userRights, logout } = useFirebase();

  // Collections state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  // Filtering & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'alert' | 'ok'>('all');

  // Modals view controllers
  const [showCatModal, setShowCatModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [activeProductEdit, setActiveProductEdit] = useState<Product | null | undefined>(undefined); // undefined = closed, null = create, object = edit
  const [selectedSupplierProduct, setSelectedSupplierProduct] = useState<Product | null>(null);

  const [loading, setLoading] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const isSuperAdmin = userRights?.role === 'super_admin';

  // Real-time synchronization for Categories
  useEffect(() => {
    const catsQuery = query(collection(db, 'categories'), orderBy('name', 'asc'));
    const unsubscribeCats = onSnapshot(catsQuery, (snapshot) => {
      const cats: Category[] = [];
      snapshot.forEach(doc => {
        cats.push({ id: doc.id, ...doc.data() } as Category);
      });
      setCategories(cats);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    return () => unsubscribeCats();
  }, []);

  // Real-time synchronization for Products
  useEffect(() => {
    const prodsQuery = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsubscribeProds = onSnapshot(prodsQuery, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach(doc => {
        prods.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(prods);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
      setLoading(false);
    });

    return () => unsubscribeProds();
  }, []);

  // Check category-specific write authorization helper
  const canEditCategory = (catName: string) => {
    if (isSuperAdmin) return true;
    return userRights?.permissions.includes(catName) || false;
  };

  // Instant real-time stock adjuster (+/- buttons on dashboard row)
  const handleAdjustStock = async (prod: Product, offset: number) => {
    if (!canEditCategory(prod.category)) return;

    const newQty = Math.max(0, prod.quantity + offset);
    try {
      const productRef = doc(db, 'products', prod.id);
      await setDoc(productRef, {
        ...prod,
        quantity: newQty,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating stock level:', error);
    }
  };

  // Delete product action matching firestore.rules permission gate
  const handleDeleteProduct = async (prod: Product) => {
    if (!canEditCategory(prod.category)) return;

    if (!confirm(`Voulez-vous supprimer définitivement l'article ${prod.name} de l'inventaire ?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'products', prod.id));
      // Delete corresponding supplier node too if super admin
      if (isSuperAdmin) {
        await deleteDoc(doc(db, 'suppliers', prod.id));
      }
    } catch (error) {
      console.error('Error deleting product', error);
    }
  };

  // Filter computations
  const lowStockProducts = products.filter(p => p.quantity <= p.minQuantity);
  
  const filteredProducts = products.filter(prod => {
    // Category match
    const categoryMatch = selectedCategory === 'all' || prod.category === selectedCategory;

    // Search match
    const searchMatch = prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        prod.category.toLowerCase().includes(searchTerm.toLowerCase());

    // Status filter match
    let statusMatch = true;
    if (stockFilter === 'alert') {
      statusMatch = prod.quantity <= prod.minQuantity;
    } else if (stockFilter === 'ok') {
      statusMatch = prod.quantity > prod.minQuantity;
    }

    return categoryMatch && searchMatch && statusMatch;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row font-sans">
      
      {/* Mobile Top Header Bar */}
      <div className="md:hidden bg-clinic-dark text-white p-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-tight text-base flex items-center gap-1.5">
            <ClipboardList className="text-clinic-green stroke-2" size={20} />
            Clinic-Stock <span className="text-clinic-green text-xs font-mono">T-R</span>
          </span>
        </div>
        <button 
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="text-slate-300 hover:text-white p-1 rounded-lg focus:outline-none"
        >
          {isMobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Sidebar Panel */}
      <div className={`
        fixed inset-y-0 left-0 w-64 bg-clinic-dark text-white z-40 transform transition-transform duration-200 ease-in-out border-r border-slate-800 flex flex-col justify-between
        md:relative md:translate-x-0 md:flex
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar upper block */}
        <div className="flex flex-col flex-1 p-5 overflow-y-auto">
          {/* Clinic Brand */}
          <div className="hidden md:flex items-center gap-2 pb-6 border-b border-slate-800/80 mb-6">
            <div className="bg-[#eef5fc]/10 p-2 rounded-xl text-clinic-green">
              <ClipboardList size={24} className="stroke-2 text-clinic-green" />
            </div>
            <div>
              <span className="font-bold text-sm tracking-tight block text-white leading-none">Medizco Clinic</span>
              <span className="text-[10px] font-semibold text-slate-400 font-mono">Gestion de Stock</span>
            </div>
          </div>

          {/* User Status Profile Card */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/10 mb-6 relative hover:bg-white/10 transition">
            <div className="flex items-center gap-1">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-clinic-green animate-pulse"></span>
              <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-clinic-green-light">Connecté en temps réel</span>
            </div>
            <p className="text-xs font-bold text-white tracking-tight mt-1 truncate">{user?.email}</p>
            
            <div className="flex items-center gap-1 mt-1.5">
              <span className="text-[10px] font-mono text-slate-400">Rôle: </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${isSuperAdmin ? 'bg-clinic-green text-white' : 'bg-clinic-blue text-white'}`}>
                {isSuperAdmin ? 'Super Admin' : 'Admin standard'}
              </span>
            </div>

            {/* If standard admin, display explicit rights list */}
            {!isSuperAdmin && (
              <div className="mt-2.5 pt-2 border-t border-white/5 space-y-1">
                <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider block">Mes secteurs autorisés :</span>
                <div className="flex flex-wrap gap-1">
                  {userRights?.permissions && userRights.permissions.length > 0 ? (
                    userRights.permissions.map((perm, i) => (
                      <span key={i} className="text-[8px] bg-clinic-blue/40 text-clinic-light-blue px-1 rounded-sm border border-clinic-blue/20">
                        {perm}
                      </span>
                    ))
                  ) : (
                    <span className="text-[8px] bg-rose-900/30 text-rose-300 px-1 rounded-sm border border-rose-800">
                      Aucune modification autorisée
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {/* Simulation tag marker */}
            {(user as any)?.isSimulated && (
              <span className="absolute -top-2 -right-1.5 bg-amber-500 text-[8px] font-semibold text-white px-1.5 py-0.5 rounded-full">
                Simulé
              </span>
            )}
          </div>

          {/* Navigation Category Filters */}
          <div className="space-y-4">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-2 px-1">Filtre Catégories</span>
              <div className="space-y-1">
                <button
                  onClick={() => { setSelectedCategory('all'); setIsMobileSidebarOpen(false); }}
                  className={`w-full text-left py-2 px-3 rounded-lg text-xs font-medium cursor-pointer transition flex items-center justify-between ${selectedCategory === 'all' ? 'bg-[#eef5fc]/15 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <span>Toutes catégories</span>
                  <span className="text-[9px] font-mono bg-white/10 px-1.5 rounded">{products.length}</span>
                </button>
                {categories.map((cat) => {
                  const itemsCount = products.filter(p => p.category === cat.name).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { setSelectedCategory(cat.name); setIsMobileSidebarOpen(false); }}
                      className={`w-full text-left py-1.5 px-3 rounded-lg text-xs font-medium cursor-pointer transition flex items-center justify-between ${selectedCategory === cat.name ? 'bg-[#eef5fc]/15 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                    >
                      <span className="truncate">{cat.name}</span>
                      <span className="text-[9px] font-mono bg-white/10 px-1.5 rounded shrink-0 ml-1">{itemsCount}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Admin system Configuration Tools */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-2 px-1">Paramètres Clinique</span>
              <div className="space-y-1">
                
                {/* Category manager */}
                <button
                  onClick={() => { setShowCatModal(true); setIsMobileSidebarOpen(false); }}
                  className="w-full text-left py-1.5 px-3 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition flex items-center gap-2"
                >
                  <FolderEdit size={14} className="text-clinic-green" />
                  <span>Gérer les catégories</span>
                </button>

                {/* Admins manager (Super admin only) */}
                {isSuperAdmin && (
                  <button
                    onClick={() => { setShowAdminModal(true); setIsMobileSidebarOpen(false); }}
                    className="w-full text-left py-1.5 px-3 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition flex items-center gap-2"
                    id="open-admin-manager"
                  >
                    <Users size={14} className="text-clinic-green" />
                    <span>Inscriptions des Admins</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Logout bottom trigger */}
        <div className="p-5 border-t border-slate-800/80">
          <button
            onClick={logout}
            className="w-full py-2 px-3 border border-slate-800 hover:bg-rose-950/20 text-slate-400 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition"
          >
            <LogOut size={14} /> Déconnexion
          </button>
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 p-4 md:p-8 overflow-y-auto space-y-6">
        
        {/* Primary Page KPI stats or summaries */}
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-clinic-dark tracking-tight">Inventaire Centralisé</h2>
            <p className="text-xs text-slate-500 mt-1">Supervisez l'ensemble du matériel médical, cuisine, entretien et logistique en temps réel.</p>
          </div>

          <button
            onClick={() => setActiveProductEdit(null)} // Null = Open create dialog
            className="bg-clinic-blue hover:bg-opacity-95 text-white rounded-xl py-2.5 px-5 text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm shadow-clinic-blue/25 cursor-pointer transition self-start sm:self-auto"
            id="add-new-product-btn"
          >
            <Plus size={16} /> Ajouter un matériel
          </button>
        </div>

        {/* Dashboard statistics KPI boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-[#eef5fc] text-clinic-blue rounded-xl">
              <ClipboardList size={22} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wide font-semibold block">Total Articles</span>
              <span className="text-2xl font-bold text-slate-800">{products.length}</span>
            </div>
          </div>

          <div className={`p-4 rounded-xl border transition shadow-sm flex items-center gap-4 ${lowStockProducts.length > 0 ? 'bg-amber-50/50 border-amber-200' : 'bg-white border-slate-200/80'}`}>
            <div className={`p-3 rounded-xl ${lowStockProducts.length > 0 ? 'bg-amber-100 text-clinic-accent' : 'bg-slate-100 text-slate-500'}`}>
              <AlertTriangle size={22} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wide font-semibold block">Articles en Rupture / Alerte</span>
              <span className={`text-2xl font-bold ${lowStockProducts.length > 0 ? 'text-clinic-accent' : 'text-slate-800'}`}>
                {lowStockProducts.length}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-clinic-green-light text-clinic-green rounded-xl">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wide font-semibold block">Secteurs Actifs</span>
              <span className="text-2xl font-bold text-slate-800">{categories.length}</span>
            </div>
          </div>
        </div>

        {/* Automatic alerts banner (Lower stock detection) */}
        {lowStockProducts.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex flex-col md:flex-row gap-3 items-start md:items-center justify-between"
          >
            <div className="flex gap-2 items-start">
              <ShieldAlert className="text-rose-500 shrink-0 mt-0.5" size={18} />
              <div>
                <h4 className="font-bold text-rose-800 text-xs uppercase tracking-wider">Alerte automatique de réapprovisionnement ({lowStockProducts.length})</h4>
                <p className="text-[11px] text-rose-700/80 mt-0.5 leading-normal">
                  Certains articles ont atteint ou sont descendus sous leur seuil de rupture par rapport au paramétrage fixé. Réapprovisionnez-les ou contactez les fournisseurs.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto w-full md:w-auto">
              {lowStockProducts.slice(0, 3).map(prod => (
                <div key={prod.id} className="text-[9px] bg-white border border-rose-200/80 text-rose-700 font-semibold py-1 px-2.5 rounded-lg flex items-center gap-1.5 shrink-0">
                  <span className="truncate max-w-[120px]">{prod.name}</span>
                  <span className="font-bold text-[10px] bg-rose-100 px-1 rounded font-mono">{prod.quantity} / {prod.minQuantity}</span>
                </div>
              ))}
              {lowStockProducts.length > 3 && (
                <span className="text-[9px] text-slate-500 font-bold bg-white/70 py-1 px-2.5 rounded-lg shrink-0 border border-slate-200">
                  + {lowStockProducts.length - 3} autres
                </span>
              )}
            </div>
          </motion.div>
        )}

        {/* Filter controls, dynamic search, and product lists container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          
          {/* Header toolbar */}
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold shrink-0">
              <Filter size={15} /> Filtres :
            </div>

            {/* Stock status filter triggers */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setStockFilter('all')}
                className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold cursor-pointer transition ${stockFilter === 'all' ? 'bg-clinic-blue text-white shadow-sm' : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'}`}
              >
                Tous articles
              </button>
              <button
                onClick={() => setStockFilter('alert')}
                className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${stockFilter === 'alert' ? 'bg-amber-500 text-white shadow-sm' : 'bg-white hover:bg-amber-50 text-amber-600 border border-slate-200'}`}
              >
                Stock insuffisant ({lowStockProducts.length})
              </button>
              <button
                onClick={() => setStockFilter('ok')}
                className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold cursor-pointer transition ${stockFilter === 'ok' ? 'bg-clinic-green text-white shadow-sm' : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'}`}
              >
                Assez de stock
              </button>
            </div>

            {/* Smart filter search match input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Rechercher un matériel..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs bg-white border border-slate-300 rounded-xl pl-9 pr-3 py-2 focus:ring-1 focus:ring-clinic-blue focus:outline-none"
              />
            </div>
          </div>

          {/* Interactive Lists Board */}
          {loading ? (
            <div className="p-16 text-center text-slate-400 text-xs font-medium">Synchronisation du catalogue en temps réel...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-16 text-center text-slate-400 space-y-2">
              <Search className="mx-auto text-slate-300" size={32} />
              <p className="text-xs">Aucun matériel trouvé correspondant à vos critères.</p>
              {products.length === 0 && (
                <button
                  onClick={() => setActiveProductEdit(null)}
                  className="mt-2 text-xs font-semibold text-clinic-blue hover:underline bg-clinic-light-blue px-3 py-1.5 rounded-lg"
                >
                  Ajouter le premier article de stock
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                    <th className="py-3 px-5">Nom de l'article</th>
                    <th className="py-3 px-4">Catégorie / Secteur</th>
                    <th className="py-3 px-4 text-center">Niveau de Stock</th>
                    <th className="py-3 px-4 text-center">Seuil</th>
                    <th className="py-3 px-4">Statut / Consignes</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {filteredProducts.map((prod) => {
                    const isAlert = prod.quantity <= prod.minQuantity;
                    const canEdit = canEditCategory(prod.category);

                    return (
                      <tr 
                        key={prod.id} 
                        className={`hover:bg-slate-50/60 transition ${isAlert ? 'bg-amber-50/15' : ''}`}
                        id={`row-${prod.id}`}
                      >
                        {/* Name */}
                        <td className="py-3.5 px-5 font-bold text-slate-800 tracking-tight">
                          <span className="block max-w-[180px] md:max-w-xs truncate">{prod.name}</span>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4 font-semibold">
                          <span className="text-[10px] bg-slate-100 text-slate-600 rounded-md px-2 py-0.5 border border-slate-200/50">
                            {prod.category}
                          </span>
                        </td>

                        {/* Quantity controls */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="inline-flex items-center justify-center gap-2">
                            {canEdit ? (
                              <button
                                onClick={() => handleAdjustStock(prod, -1)}
                                className="w-6 h-6 border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-md flex items-center justify-center font-bold text-xs select-none cursor-pointer"
                              >
                                -
                              </button>
                            ) : (
                              <span className="w-6"></span>
                            )}
                            
                            <span className={`font-mono font-bold text-sm w-12 text-center text-slate-800 ${isAlert ? 'text-rose-600' : ''}`}>
                              {prod.quantity}
                            </span>

                            {canEdit ? (
                              <button
                                onClick={() => handleAdjustStock(prod, 1)}
                                className="w-6 h-6 border border-slate-300 hover:bg-slate-100 text-slate-600 rounded-md flex items-center justify-center font-bold text-xs select-none cursor-pointer"
                              >
                                +
                              </button>
                            ) : (
                              <span className="w-6"></span>
                            )}
                          </div>
                        </td>

                        {/* Alert limit limit */}
                        <td className="py-3.5 px-4 text-center font-mono font-semibold text-slate-400">
                          {prod.minQuantity}
                        </td>

                        {/* Status Label */}
                        <td className="py-3.5 px-4">
                          {isAlert ? (
                            <span className="inline-flex items-center gap-1 font-bold text-[10px] text-clinic-accent uppercase tracking-tighter">
                              <AlertTriangle size={12} />
                              Sous le seuil
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-clinic-green uppercase tracking-tighter">
                              <CheckCircle2 size={12} />
                              Stock adéquat
                            </span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3.5 px-5 text-right space-x-1.5 shrink-0">
                          {/* Suppliers (Super Admin exclusive visibility) */}
                          {isSuperAdmin && (
                            <button
                              onClick={() => setSelectedSupplierProduct(prod)}
                              className="text-clinic-green hover:bg-clinic-green-light p-1.5 rounded-lg transition cursor-pointer"
                              title="Voir ou appeler les fournisseurs sécurisés"
                            >
                              <PhoneCall size={14} />
                            </button>
                          )}

                          {canEdit ? (
                            <>
                              <button
                                onClick={() => setActiveProductEdit(prod)}
                                className="text-clinic-blue hover:bg-clinic-light-blue p-1.5 rounded-lg transition cursor-pointer inline-flex items-center"
                                title="Modifier le produit"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteProduct(prod)}
                                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition cursor-pointer inline-flex items-center"
                                title="Supprimer le produit"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <span 
                              className="inline-flex text-slate-400 hover:text-slate-600 p-1.5 transition select-none"
                              title="Vous n'avez pas l'autorisation d'éditer cette catégorie."
                            >
                              <Lock size={12} />
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

      </div>

      {/* MODALS RENDERING LAYERS (Controlled state modals) */}
      <AnimatePresence>
        {/* Category Setup Modal */}
        {showCatModal && (
          <CategoryManager onClose={() => setShowCatModal(false)} />
        )}

        {/* Administrator access config Modal (Super UI only) */}
        {showAdminModal && isSuperAdmin && (
          <AdminManager categories={categories} onClose={() => setShowAdminModal(false)} />
        )}

        {/* Create or Edit dynamic elements (Form) */}
        {activeProductEdit !== undefined && (
          <ProductForm 
            product={activeProductEdit} 
            categories={categories}
            onClose={() => setActiveProductEdit(undefined)}
            onSuccess={() => {
              setActiveProductEdit(undefined);
            }}
          />
        )}

        {/* Supplier Quick Card Modal */}
        {selectedSupplierProduct && (
          <SupplierModal 
            product={selectedSupplierProduct} 
            onClose={() => setSelectedSupplierProduct(null)} 
          />
        )}
      </AnimatePresence>

    </div>
  );
}
