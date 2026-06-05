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
  orderBy,
  limit 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Product, Category, ProductSupplier, StockMovement } from '../types';
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
  X,
  History,
  Sparkles,
  Phone,
  Copy,
  Check,
  Download,
  FileText,
  ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import CategoryManager from './CategoryManager';
import ProductForm from './ProductForm';
import AdminManager from './AdminManager';
import SupplierModal from './SupplierModal';
import StockChart from './StockChart';
import StockMovementLogModal from './StockMovementLogModal';
import TestDataManager from './TestDataManager';
import InventoryAuditModal from './InventoryAuditModal';
import StockAnalyticsModal from './StockAnalyticsModal';

export default function Dashboard() {
  const { user, userRights, logout } = useFirebase();

  // Collections state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  
  // Filtering & Search
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'alert' | 'ok' | 'expired' | 'expiring'>('all');
  const [suppliersList, setSuppliersList] = useState<ProductSupplier[]>([]);
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>('all');

  // Staff on duty widget local states
  const [copiedStaffId, setCopiedStaffId] = useState<string | null>(null);
  const [personnelSearch, setPersonnelSearch] = useState('');

  // Helper to extract and filter staff members from active categories
  const getStaffList = () => {
    let list: Array<{ id: string; name: string; role: string; phone: string; categoryName: string; categoryId: string }> = [];
    
    categories.forEach(cat => {
      if (cat.staff && cat.staff.length > 0) {
        cat.staff.forEach(member => {
          list.push({
            id: member.id,
            name: member.name,
            role: member.role,
            phone: member.phone,
            categoryName: cat.name,
            categoryId: cat.id
          });
        });
      }
    });

    // Filter by selected category IF one is focused
    if (selectedCategory !== 'all') {
      list = list.filter(item => item.categoryName === selectedCategory);
    }

    // Filter by search string
    if (personnelSearch.trim() !== '') {
      const search = personnelSearch.toLowerCase();
      list = list.filter(item => 
        item.name.toLowerCase().includes(search) || 
        item.role.toLowerCase().includes(search) ||
        item.phone.includes(search) ||
        item.categoryName.toLowerCase().includes(search)
      );
    }

    return list;
  };

  const currentStaffList = getStaffList();

  const handleCopyPhone = (staffId: string, phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedStaffId(staffId);
    setTimeout(() => setCopiedStaffId(null), 1800);
  };

  // Modals view controllers
  const [showCatModal, setShowCatModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [activeProductEdit, setActiveProductEdit] = useState<Product | null | undefined>(undefined); // undefined = closed, null = create, object = edit
  const [selectedSupplierProduct, setSelectedSupplierProduct] = useState<Product | null>(null);
  const [showMovementsModal, setShowMovementsModal] = useState(false);
  const [showTestDataModal, setShowTestDataModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  // Additional smart features: CSV export & order draft compiler
  const [showOrderDraftModal, setShowOrderDraftModal] = useState(false);
  const [copiedDraftText, setCopiedDraftText] = useState(false);

  const handleExportCSV = () => {
    const headers = ['Nom', 'Secteur (Catégorie)', 'Stock Actuel', 'Seuil d\'Alerte', 'Statut', 'Numéro de Lot', 'Date Expiration', 'Dernier Inventaire', 'Suivi de Commande'];
    const rows = filteredProducts.map(prod => {
      const isLow = prod.quantity <= prod.minQuantity;
      const status = prod.quantity === 0 ? 'Rupture Totale' : (isLow ? 'Alerte Stock Bas' : 'Stock Optimal');
      const diff = isLow ? (prod.minQuantity * 2) - prod.quantity : 0;
      const recommendation = isLow ? `Commander min. ${diff} unites` : 'N/A';
      return [
        `"${prod.name.replace(/"/g, '""')}"`,
        `"${prod.category.replace(/"/g, '""')}"`,
        prod.quantity,
        prod.minQuantity,
        `"${status}"`,
        `"${(prod.lotNumber || 'N/A').replace(/"/g, '""')}"`,
        `"${prod.expiryDate || 'N/A'}"`,
        `"${prod.lastAuditDate || 'N/A'}"`,
        `"${recommendation}"`
      ];
    });
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const todayStr = new Date().toISOString().substring(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `Stock_Clinique_Export_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getReplenishmentText = () => {
    let text = `=======================================================\n`;
    text    += `   BON DE COMMANDE DE REAPPROVISIONNEMENT CLINIQUE   \n`;
    text    += `   Genere le : ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}\n`;
    text    += `=======================================================\n\n`;
    text    += `Veuillez trouver ci-dessous la liste des materiels et fournitures sous seuil d'alerte, classes par secteur :\n\n`;

    lowStockProducts.forEach((prod, idx) => {
      const isCritical = prod.quantity === 0;
      const needed = Math.max(1, (prod.minQuantity * 2) - prod.quantity);
      const prodSup = suppliersList.find(s => s.productId === prod.id);
      const supplierStr = prodSup && prodSup.contacts.length > 0
        ? prodSup.contacts.map(c => `${c.name} (${c.phone})`).join(', ')
        : 'Aucun fournisseur referent enregistre';

      text += `${idx + 1}. [${prod.category}] ${prod.name}\n`;
      text += `   - Etat : ${isCritical ? 'CRITIQUE / RUPTURE TOTALE' : 'STOCK INSUFFISANT'}\n`;
      text += `   - Stock Actuel : ${prod.quantity} (Seuil d'alerte : ${prod.minQuantity})\n`;
      text += `   - Quantite suggeree pour commande : ${needed} unites\n`;
      text += `   - Contacts Fournisseurs : ${supplierStr}\n\n`;
    });

    text += `-------------------------------------------------------\n`;
    text += `Rapport genere par l'Administrateur de Roster & Stock Clinique.\n`;
    return text;
  };

  const handleCopyDraftText = () => {
    navigator.clipboard.writeText(getReplenishmentText());
    setCopiedDraftText(true);
    setTimeout(() => setCopiedDraftText(false), 2000);
  };

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

  // Real-time synchronization for Stock Movements (top 300)
  useEffect(() => {
    const movementsQuery = query(collection(db, 'stock_movements'), orderBy('createdAt', 'desc'), limit(300));
    const unsubscribeMovements = onSnapshot(movementsQuery, (snapshot) => {
      const logs: StockMovement[] = [];
      snapshot.forEach(doc => {
        logs.push({ id: doc.id, ...doc.data() } as StockMovement);
      });
      setMovements(logs);
    }, (error) => {
      console.error("Error backing up movements:", error);
    });

    return () => unsubscribeMovements();
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

  // Real-time synchronization for Suppliers (Super Admin exclusive)
  useEffect(() => {
    if (!isSuperAdmin) {
      setSuppliersList([]);
      setSelectedSupplierFilter('all');
      return;
    }

    const q = query(collection(db, 'suppliers'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sups: ProductSupplier[] = [];
      snapshot.forEach(doc => {
        sups.push({ ...doc.data() } as ProductSupplier);
      });
      setSuppliersList(sups);
    }, (error) => {
      console.error("Error subscribing to suppliers collection:", error);
    });

    return () => unsubscribe();
  }, [isSuperAdmin]);

  // Check category-specific write authorization helper
  const canEditCategory = (catName: string) => {
    if (isSuperAdmin) return true;
    return userRights?.permissions.includes(catName) || false;
  };

  // Instant real-time stock adjuster (+/- buttons on dashboard row)
  const handleAdjustStock = async (prod: Product, offset: number) => {
    if (!canEditCategory(prod.category)) return;

    const newQty = Math.max(0, prod.quantity + offset);
    if (newQty === prod.quantity) return; // No change if attempting to subtract below 0

    try {
      const productRef = doc(db, 'products', prod.id);
      await setDoc(productRef, {
        ...prod,
        quantity: newQty,
        updatedAt: serverTimestamp()
      });

      // Write Stock Movement Log
      const movementId = 'move-' + Math.random().toString(36).substring(2, 11);
      const movementRef = doc(db, 'stock_movements', movementId);
      await setDoc(movementRef, {
        id: movementId,
        productId: prod.id,
        productName: prod.name,
        category: prod.category,
        type: 'adjustment',
        difference: offset,
        finalQuantity: newQty,
        userEmail: user?.email || 'Inconnu',
        createdAt: serverTimestamp(),
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

      // Write Stock Movement Log of type 'deletion'
      const movementId = 'move-' + Math.random().toString(36).substring(2, 11);
      const movementRef = doc(db, 'stock_movements', movementId);
      await setDoc(movementRef, {
        id: movementId,
        productId: prod.id,
        productName: prod.name,
        category: prod.category,
        type: 'deletion',
        difference: prod.quantity,
        finalQuantity: 0,
        userEmail: user?.email || 'Inconnu',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error deleting product', error);
    }
  };

  // Filter computations
  const lowStockProducts = products.filter(p => p.quantity <= p.minQuantity);
  
  const todayUnix = new Date().setHours(0, 0, 0, 0);

  const expiredProducts = products.filter(p => {
    if (!p.expiryDate) return false;
    const expUnix = new Date(p.expiryDate).getTime();
    return expUnix <= todayUnix;
  });

  const expiringSoonProducts = products.filter(p => {
    if (!p.expiryDate) return false;
    const expUnix = new Date(p.expiryDate).getTime();
    const daysLeft = Math.ceil((expUnix - todayUnix) / (1000 * 60 * 60 * 24));
    return daysLeft > 0 && daysLeft <= 45;
  });

  // Extract unique supplier names across all products (Super Admin only Check)
  const uniqueSuppliers = Array.from(
    new Set(
      suppliersList.flatMap(s => s.contacts.map(c => c.name.trim()).filter(name => name !== ''))
    )
  ).sort();
  
  const filteredProducts = products.filter(prod => {
    // Category match
    const categoryMatch = selectedCategory === 'all' || prod.category === selectedCategory;

    // Search match
    const searchMatch = prod.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        prod.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        (prod.lotNumber && prod.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    // Status filter match
    let statusMatch = true;
    if (stockFilter === 'alert') {
      statusMatch = prod.quantity <= prod.minQuantity;
    } else if (stockFilter === 'ok') {
      statusMatch = prod.quantity > prod.minQuantity;
    } else if (stockFilter === 'expired') {
      if (!prod.expiryDate) {
        statusMatch = false;
      } else {
        const expUnix = new Date(prod.expiryDate).getTime();
        statusMatch = expUnix <= todayUnix;
      }
    } else if (stockFilter === 'expiring') {
      if (!prod.expiryDate) {
        statusMatch = false;
      } else {
        const expUnix = new Date(prod.expiryDate).getTime();
        const daysLeft = Math.ceil((expUnix - todayUnix) / (1000 * 60 * 60 * 24));
        statusMatch = daysLeft > 0 && daysLeft <= 45;
      }
    }

    // Supplier filter match (Super Admin exclusive)
    let supplierMatch = true;
    if (isSuperAdmin && selectedSupplierFilter !== 'all') {
      const prodSupplier = suppliersList.find(s => s.productId === prod.id);
      supplierMatch = prodSupplier?.contacts.some(c => c.name.trim() === selectedSupplierFilter) || false;
    }

    return categoryMatch && searchMatch && statusMatch && supplierMatch;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row font-sans">
      
      {/* Mobile Top Header Bar */}
      <div className="md:hidden bg-clinic-dark text-white p-4 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-bold tracking-tight text-sm flex items-center gap-1.5">
            <ClipboardList className="text-clinic-green stroke-2" size={18} />
            Clinic-Stock <span className="text-clinic-green text-xs font-mono">T-R</span>
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={logout}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-900/60 hover:bg-rose-900 text-rose-100 hover:text-white rounded-lg text-[11px] font-bold transition duration-200 cursor-pointer"
            title="Se déconnecter"
          >
            <LogOut size={13} />
            <span>Déconnexion</span>
          </button>
          
          <button 
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="text-slate-300 hover:text-white p-1 rounded-lg focus:outline-none cursor-pointer"
          >
            {isMobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
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
              <span className="font-bold text-sm tracking-tight block text-white leading-none">Clinique Avicenne</span>
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

            {/* Quick Logout inside the card */}
            <div className="mt-3.5 pt-2.5 border-t border-white/5">
              <button
                onClick={logout}
                className="w-full py-1.5 px-3 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 hover:text-white border border-rose-900/20 hover:border-rose-800/40 rounded-lg text-[10px] uppercase font-mono tracking-wider font-bold flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
              >
                <LogOut size={12} /> Se déconnecter
              </button>
            </div>
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

            {/* Audits & Analytics dedicated modules block */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-2 px-1">Audits & Analytics</span>
              <div className="space-y-1">
                {/* Physical inventory control */}
                <button
                  onClick={() => { setShowAuditModal(true); setIsMobileSidebarOpen(false); }}
                  className="w-full text-left py-1.5 px-3 rounded-lg text-xs text-[#cee2f1] hover:text-white hover:bg-white/5 cursor-pointer transition flex items-center gap-2"
                  id="open-physical-audit"
                >
                  <ClipboardCheck size={14} className="text-clinic-green" />
                  <span>Inventaire de Garde</span>
                </button>

                {/* Algorithmic analytics predictions */}
                <button
                  onClick={() => { setShowAnalyticsModal(true); setIsMobileSidebarOpen(false); }}
                  className="w-full text-left py-1.5 px-3 rounded-lg text-xs text-[#cee2f1] hover:text-white hover:bg-white/5 cursor-pointer transition flex items-center gap-2"
                  id="open-stock-analytics"
                >
                  <TrendingDown size={14} className="text-clinic-blue animate-pulse" />
                  <span>Analytics & Rotation</span>
                </button>
              </div>
            </div>

            {/* Admin system Configuration Tools */}
            <div className="pt-2 border-t border-slate-800/80">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block mb-2 px-1">Paramètres Clinique</span>
              <div className="space-y-1">
                
                {/* Category manager */}
                <button
                  onClick={() => { setShowCatModal(true); setIsMobileSidebarOpen(false); }}
                  className="w-full text-left py-1.5 px-3 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition flex items-center gap-2 animate-pulse"
                >
                  <FolderEdit size={14} className="text-clinic-green" />
                  <span>Catégories & Personnels de garde</span>
                </button>

                {/* Admins manager (Super admin only) */}
                {isSuperAdmin && (
                  <>
                    <button
                      onClick={() => { setShowAdminModal(true); setIsMobileSidebarOpen(false); }}
                      className="w-full text-left py-1.5 px-3 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition flex items-center gap-2"
                      id="open-admin-manager"
                    >
                      <Users size={14} className="text-clinic-green" />
                      <span>Inscriptions des Admins</span>
                    </button>

                    <button
                      onClick={() => { setShowMovementsModal(true); setIsMobileSidebarOpen(false); }}
                      className="w-full text-left py-1.5 px-3 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition flex items-center gap-2"
                      id="open-movements-log"
                    >
                      <History size={14} className="text-clinic-green" />
                      <span>Journal des flux de stock</span>
                    </button>

                    <button
                      onClick={() => { setShowTestDataModal(true); setIsMobileSidebarOpen(false); }}
                      className="w-full text-left py-1.5 px-3 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer transition flex items-center gap-2"
                      id="open-test-data-generator"
                    >
                      <Sparkles size={14} className="text-amber-500" />
                      <span>Données de test / Simulation</span>
                    </button>
                  </>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wide font-semibold block">Articles en Rupture</span>
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

          <div className={`p-4 rounded-xl border transition shadow-sm flex items-center gap-4 ${(expiredProducts.length > 0 || expiringSoonProducts.length > 0) ? 'bg-rose-50/40 border-rose-200' : 'bg-white border-slate-200/80'}`}>
            <div className={`p-3 rounded-xl ${(expiredProducts.length > 0) ? 'bg-rose-100 text-rose-600' : (expiringSoonProducts.length > 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500')}`}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wide font-semibold block">Alertes Péremption</span>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-bold ${(expiredProducts.length > 0) ? 'text-rose-600 font-extrabold' : (expiringSoonProducts.length > 0 ? 'text-amber-600' : 'text-slate-800')}`}>
                  {expiredProducts.length + expiringSoonProducts.length}
                </span>
                {(expiredProducts.length > 0 || expiringSoonProducts.length > 0) && (
                  <span className="text-[9px] font-semibold text-slate-500 font-mono">
                    ({expiredProducts.length} exp. / {expiringSoonProducts.length} pr.)
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Automatic alerts banner (Lower stock detection) */}
        {lowStockProducts.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-rose-50 border border-rose-200/40 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between"
          >
            <div className="flex gap-2.5 items-start">
              <ShieldAlert className="text-rose-500 shrink-0 mt-0.5" size={18} />
              <div>
                <h4 className="font-bold text-rose-800 text-xs uppercase tracking-wider">Alerte automatique de réapprovisionnement ({lowStockProducts.length})</h4>
                <p className="text-[11px] text-rose-700/80 mt-0.5 leading-normal">
                  Certains articles ont atteint ou sont descendus sous leur seuil de rupture par rapport au paramétrage fixé.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto shrink-0">
              <div className="flex flex-wrap gap-1 max-h-[80px] overflow-y-auto">
                {lowStockProducts.slice(0, 2).map(prod => (
                  <div key={prod.id} className="text-[9px] bg-white border border-rose-200/80 text-rose-700 font-semibold py-1 px-2.5 rounded-lg flex items-center gap-1.5 shrink-0">
                    <span className="truncate max-w-[80px]">{prod.name}</span>
                    <span className="font-bold text-[10px] bg-rose-100 px-1 rounded font-mono">{prod.quantity} / {prod.minQuantity}</span>
                  </div>
                ))}
                {lowStockProducts.length > 2 && (
                  <span className="text-[9px] text-slate-500 font-bold bg-white/70 py-1 px-2.5 rounded-lg shrink-0 border border-slate-200">
                    + {lowStockProducts.length - 2} autres
                  </span>
                )}
              </div>

              <button
                onClick={() => setShowOrderDraftModal(true)}
                className="bg-rose-900 hover:bg-rose-950 text-white font-bold text-xs py-2 px-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-sm shadow-rose-900/10 cursor-pointer transition select-none"
                title="Compiler un bon de commande de réapprovisionnement prêt pour impression/copie"
              >
                <Sparkles size={13} /> Compiler Bon de Commande
              </button>
            </div>
          </motion.div>
        )}

        {/* Graphs & On-duty Personnel Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <StockChart products={products} categories={categories} />
          </div>
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm h-full flex flex-col justify-between" id="personnel-garde-widget">
              <div>
                {/* Panel Header */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-50 text-clinic-green rounded-lg">
                      <Users size={16} />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Équipes de Garde</h3>
                      <p className="text-[10px] text-slate-400">Services d'astreinte & référents cliniques</p>
                    </div>
                  </div>
                  
                  {/* Inline button to open categories/guard manager */}
                  <button
                    onClick={() => setShowCatModal(true)}
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold px-2 py-1 rounded-lg transition shrink-0 cursor-pointer"
                    title="Configurer ou ajouter des personnels à l'équipe"
                  >
                    Gérer
                  </button>
                </div>

                {/* Local search within personnel */}
                <div className="relative mb-3">
                  <Search className="absolute left-2.5 top-2 text-slate-400" size={12} />
                  <input
                    type="text"
                    placeholder="Chercher un personnel, poste..."
                    value={personnelSearch}
                    onChange={(e) => setPersonnelSearch(e.target.value)}
                    className="w-full text-[11px] bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 focus:ring-1 focus:ring-clinic-blue focus:bg-white focus:outline-none"
                  />
                  {personnelSearch && (
                    <button 
                      onClick={() => setPersonnelSearch('')}
                      className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 hover:text-slate-600"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Filter indicator */}
                {selectedCategory !== 'all' && (
                  <div className="mb-3 flex items-center justify-between bg-blue-50/50 border border-clinic-blue/10 rounded-lg py-1 px-2 text-[10px]">
                    <span className="text-clinic-blue font-semibold truncate">
                      Secteur sélectionné : <strong>{selectedCategory}</strong>
                    </span>
                    <button 
                      onClick={() => setSelectedCategory('all')}
                      className="text-slate-400 hover:text-rose-600 font-bold ml-1 flex items-center gap-0.5 animate-pulse shrink-0 bg-white rounded px-1 border border-slate-200"
                      title="Afficher tous les secteurs d'astreinte"
                    >
                      <X size={10} /> Tout voir
                    </button>
                  </div>
                )}

                {/* Scrollable list container */}
                <div className="space-y-2 max-h-[195px] overflow-y-auto pr-1">
                  {currentStaffList.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 space-y-2">
                      <p className="text-[11px] italic">Aucun personnel de garde trouvé.</p>
                      {categories.length > 0 && (
                        <button
                          onClick={() => {
                            setShowCatModal(true);
                          }}
                          className="text-[10px] text-clinic-blue hover:underline bg-clinic-light-blue px-2.5 py-1 rounded-md font-semibold"
                        >
                          + Configurer l'équipe de garde
                        </button>
                      )}
                    </div>
                  ) : (
                    currentStaffList.map((item) => (
                      <div 
                        key={item.id}
                        className="p-2 border border-slate-100 rounded-xl hover:bg-slate-50/80 hover:border-slate-200 transition flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 max-w-[70%] min-w-0">
                          {/* Round colored initial fallback circle */}
                          <div className="w-7 h-7 rounded-full bg-clinic-light-blue font-bold text-[10px] text-clinic-blue flex items-center justify-center shrink-0">
                            {item.name.substring(0, 1).toUpperCase()}
                          </div>
                          
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 block truncate text-[11px] leading-tight" title={item.name}>
                              {item.name}
                            </span>
                            
                            <div className="flex items-center flex-wrap gap-1 mt-0.5">
                              <span className="text-[9.5px] text-slate-500 font-medium truncate" title={item.role}>
                                {item.role}
                              </span>
                              
                              {/* Display Sector Category tag in general view */}
                              {selectedCategory === 'all' && (
                                <button
                                  onClick={() => setSelectedCategory(item.categoryName)}
                                  className="text-[8px] bg-slate-100 border border-slate-200 hover:bg-clinic-blue hover:text-white rounded px-1 transition text-slate-500 font-semibold truncate shrink-0"
                                  title={`Filtrer par secteur ${item.categoryName}`}
                                >
                                  {item.categoryName}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Dial & Copy Tools */}
                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={`tel:${item.phone}`}
                            className="bg-emerald-50 text-clinic-green border border-emerald-100/30 rounded-lg p-1.5 hover:bg-clinic-green hover:text-white transition"
                            title={`Appeler ${item.name} au ${item.phone}`}
                          >
                            <Phone size={11} />
                          </a>
                          
                          <button
                            onClick={() => handleCopyPhone(item.id, item.phone)}
                            className={`border rounded-lg p-1.5 transition cursor-pointer ${
                              copiedStaffId === item.id 
                                ? 'bg-emerald-50 border-emerald-300 text-clinic-green' 
                                : 'bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-400 hover:text-slate-700'
                            }`}
                            title="Copier le numéro de téléphone"
                          >
                            {copiedStaffId === item.id ? <Check size={11} /> : <Copy size={11} />}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Informative footer */}
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[10px] text-slate-400">
                <span className="leading-snug">Roster de garde de la clinique</span>
                <span className="font-semibold text-rose-500 flex items-center gap-0.5 animate-pulse">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span> Astreinte active
                </span>
              </div>
            </div>
          </div>
        </div>

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
                Tous
              </button>
              <button
                onClick={() => setStockFilter('alert')}
                className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${stockFilter === 'alert' ? 'bg-amber-500 text-white shadow-sm' : 'bg-white hover:bg-amber-50 text-amber-600 border border-slate-200'}`}
              >
                Ruptures ({lowStockProducts.length})
              </button>
              <button
                onClick={() => setStockFilter('ok')}
                className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold cursor-pointer transition ${stockFilter === 'ok' ? 'bg-clinic-green text-white shadow-sm' : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'}`}
              >
                En stock
              </button>
              <button
                onClick={() => setStockFilter('expired')}
                className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${stockFilter === 'expired' ? 'bg-rose-700 text-white shadow-sm font-bold' : 'bg-white hover:bg-rose-50 text-rose-700 border border-slate-200'}`}
              >
                Périmés ({expiredProducts.length})
              </button>
              <button
                onClick={() => setStockFilter('expiring')}
                className={`py-1.5 px-3.5 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${stockFilter === 'expiring' ? 'bg-amber-600 text-white shadow-sm font-bold' : 'bg-white hover:bg-amber-50 text-amber-700 border border-slate-200'}`}
              >
                ⚠️ Péremption Proche ({expiringSoonProducts.length})
              </button>
            </div>

            {/* Smart filter search match input and CSV Export */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleExportCSV}
                className="py-1.5 px-3.5 bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
                title="Exporter la liste actuelle filtrée sous format Excel / CSV"
              >
                <Download size={13} className="text-slate-500" />
                <span>Exporter (.csv)</span>
              </button>
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
          </div>

          {/* Quick supplier filters (Super Admin only) */}
          {isSuperAdmin && uniqueSuppliers.length > 0 && (
            <div className="px-4 py-3 bg-[#eef5fc]/20 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-2 text-xs">
              <div className="flex items-center gap-2 text-clinic-blue font-bold shrink-0 min-w-[170px]">
                <span className="w-2 h-2 rounded-full bg-clinic-blue animate-pulse shrink-0"></span>
                <span>Filtre par Fournisseur :</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                <button
                  onClick={() => setSelectedSupplierFilter('all')}
                  className={`py-1 px-3 rounded-lg text-[10.5px] font-bold transition cursor-pointer select-none border border-transparent ${
                    selectedSupplierFilter === 'all'
                      ? 'bg-clinic-blue text-white shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  Tous ({products.length})
                </button>
                {uniqueSuppliers.map((supName) => {
                  const count = products.filter(prod => 
                    suppliersList.find(s => s.productId === prod.id)?.contacts.some(c => c.name.trim() === supName)
                  ).length;
                  return (
                    <button
                      key={supName}
                      onClick={() => setSelectedSupplierFilter(supName)}
                      className={`py-1 px-3 rounded-lg text-[10.5px] font-bold transition flex items-center gap-1.5 border cursor-pointer select-none ${
                        selectedSupplierFilter === supName
                          ? 'bg-clinic-blue text-white border-transparent shadow-sm'
                          : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      <span className="truncate max-w-[140px]">{supName}</span>
                      <span className={`text-[9.5px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
                        selectedSupplierFilter === supName 
                          ? 'bg-blue-800 text-blue-100' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                        <td className="py-3.5 px-5 text-slate-800 tracking-tight">
                          <div className="space-y-1">
                            <span className="block font-bold max-w-[180px] md:max-w-xs truncate">{prod.name}</span>
                            
                            {/* Clinical Tracking Badges if present */}
                            {(prod.lotNumber || prod.expiryDate || prod.lastAuditDate) && (
                              <div className="flex flex-wrap items-center gap-1.5 text-[9px] mt-0.5">
                                {prod.lotNumber && (
                                  <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-medium" title="Numéro de Lot">
                                    Lot: {prod.lotNumber}
                                  </span>
                                )}
                                
                                {prod.expiryDate && (() => {
                                  const daysLeft = Math.ceil((new Date(prod.expiryDate).getTime() - todayUnix) / (1000 * 60 * 60 * 24));
                                  const isExpired = daysLeft <= 0;
                                  const isWarning = daysLeft > 0 && daysLeft <= 45;
                                  let badgeStyle = "bg-emerald-50 text-emerald-600 border border-emerald-100/30";
                                  if (isExpired) {
                                    badgeStyle = "bg-rose-50 text-rose-600 border border-rose-100 font-bold animate-pulse";
                                  } else if (isWarning) {
                                    badgeStyle = "bg-amber-50 text-amber-600 border border-amber-100 font-bold";
                                  }
                                  return (
                                    <span className={`px-1.5 py-0.5 rounded flex items-center gap-0.5 ${badgeStyle}`} title={`Date de péremption clinique : ${prod.expiryDate}`}>
                                      ⌛ {isExpired ? "EXPIRÉ" : (isWarning ? `Périme dans ${daysLeft} j` : `Exp: ${prod.expiryDate}`)}
                                    </span>
                                  );
                                })()}

                                {prod.lastAuditDate && (
                                  <span className="bg-slate-100/60 text-slate-500 px-1.5 py-0.5 rounded" title={`Dernière vérification physique d'inventaire sur l'étagère de la clinique : ${prod.lastAuditDate}`}>
                                    ✓ Vérif: {prod.lastAuditDate}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4 font-semibold">
                          <button
                            onClick={() => setSelectedCategory(prod.category)}
                            className="text-[10px] bg-[#eef5fc] text-clinic-blue hover:bg-clinic-blue hover:text-white rounded-md px-2.5 py-1 border border-clinic-blue/10 font-extrabold transition cursor-pointer text-left focus:outline-none"
                            title="Filtrer sur ce secteur et afficher son équipe de garde"
                          >
                            {prod.category}
                          </button>
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
                          {/* Navigate/Filter to Personnel de garde */}
                          <button
                            onClick={() => {
                              setSelectedCategory(prod.category);
                              document.getElementById('personnel-garde-widget')?.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-lg transition cursor-pointer inline-flex items-center"
                            title={`Voir le personnel de garde (astreinte) de la catégorie ${prod.category}`}
                          >
                            <Users size={14} />
                          </button>

                          {/* Suppliers (Super Admin exclusive visibility) */}
                          {isSuperAdmin && (
                            <button
                              onClick={() => setSelectedSupplierProduct(prod)}
                              className="text-clinic-green hover:bg-clinic-green-light p-1.5 rounded-lg transition cursor-pointer inline-flex items-center"
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

        {/* Audit Movements log Modal */}
        {showMovementsModal && isSuperAdmin && (
          <StockMovementLogModal 
            categories={categories}
            onClose={() => setShowMovementsModal(false)}
          />
        )}

        {/* Test Data configuration Modal */}
        {showTestDataModal && isSuperAdmin && (
          <TestDataManager 
            onClose={() => setShowTestDataModal(false)}
          />
        )}

        {/* Physical Inventory Audit Control Modal */}
        {showAuditModal && (
          <InventoryAuditModal
            categories={categories}
            products={products}
            userRights={userRights}
            userEmail={user?.email || 'Visiteur'}
            onClose={() => setShowAuditModal(false)}
          />
        )}

        {/* Algorithmic Stock Analytics Modal */}
        {showAnalyticsModal && (
          <StockAnalyticsModal
            products={products}
            categories={categories}
            movements={movements}
            onClose={() => setShowAnalyticsModal(false)}
          />
        )}


        {/* Replenishment Purchase Order Draft Modal */}
        {showOrderDraftModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-2xl shadow-xl border border-slate-100 flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-50 text-rose-700 rounded-lg">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Bon de Commande Automatique</h3>
                    <p className="text-[10px] text-slate-400">Synthèse d'achat générée selon les alertes de rupture</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowOrderDraftModal(false)}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-1.5 rounded-lg transition"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[11px] text-indigo-700 leading-relaxed">
                  Cette interface rassemble tous les articles sous le seuil critique de rupture. Elle estime les besoins d'approvisionnement nécessaires pour revenir à un stock idéal et associe les contacts des fournisseurs enregistrés.
                </div>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Synthese des articles ({lowStockProducts.length})</h4>
                  {lowStockProducts.map(prod => {
                    const diff = Math.max(1, (prod.minQuantity * 2) - prod.quantity);
                    const prodSup = suppliersList.find(s => s.productId === prod.id);
                    return (
                      <div key={prod.id} className="p-2.5 border border-slate-150 rounded-xl bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800 text-[12px]">{prod.name}</span>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                            <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[9.5px] font-semibold">{prod.category}</span>
                            <span>Stock actuel: <strong className="text-rose-600">{prod.quantity}</strong> / {prod.minQuantity} (seuil)</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[11px] block text-slate-500 font-medium">Recommande :</span>
                          <span className="text-xs font-bold text-clinic-green bg-emerald-50 px-2 py-0.5 rounded">+ {diff} unites</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wide">Texte du message de commande compile</label>
                    <button
                      onClick={handleCopyDraftText}
                      className="text-[11px] text-clinic-blue hover:underline font-bold flex items-center gap-1"
                    >
                      {copiedDraftText ? <Check size={11} className="text-clinic-green" /> : <Copy size={11} />}
                      {copiedDraftText ? "Copie !" : "Copier le texte"}
                    </button>
                  </div>
                  <textarea
                    readOnly
                    value={getReplenishmentText()}
                    className="w-full h-44 bg-slate-900 text-emerald-400 font-mono text-[10.5px] rounded-xl p-3 border border-slate-800 focus:outline-none focus:ring-1 focus:ring-clinic-blue resize-none scrollbar-thin"
                  />
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2 rounded-b-2xl">
                <button
                  onClick={() => setShowOrderDraftModal(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-300 transition cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`<pre style="font-family: monospace; font-size: 13px; padding: 20px;">${getReplenishmentText()}</pre>`);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }}
                  className="px-4 py-2 bg-clinic-blue hover:bg-opacity-95 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Imprimer le rapport
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
