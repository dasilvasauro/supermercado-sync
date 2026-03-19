import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ShoppingCart, List, Plus, Settings, CheckCircle, ChevronLeft, 
  Trash2, Save, CloudOff, Cloud, RefreshCw, Edit2, Search, X,
  Download, WifiOff, Filter, ChevronDown, ChevronRight, ArrowDownAZ
} from 'lucide-react';

// --- UTILIDADES ---
const formatMoney = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
};

const generateId = () => Math.random().toString(36).substr(2, 9);

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [apiUrl, setApiUrl] = useState(localStorage.getItem('gcart_apiUrl') || '');
  const [isSetup, setIsSetup] = useState(!!localStorage.getItem('gcart_apiUrl'));
  const [currentView, setCurrentView] = useState('home'); // home, activeList, catalog
  
  // Dados globais
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [lists, setLists] = useState([]);
  
  const [activeListId, setActiveListId] = useState(null);
  const [listToDelete, setListToDelete] = useState(null);
  
  // Status PWA e Rede
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  
  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, syncing, error, success, offline

  // Configuração de PWA e status online/offline
  useEffect(() => {
    // Monitora status da rede
    const handleOnline = () => {
      setIsOnline(true);
      if (isSetup && apiUrl) fetchData(); // Tenta sincronizar ao voltar online
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Captura o evento de instalação do PWA
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Esconde o prompt se o app for instalado
    window.addEventListener('appinstalled', () => {
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isSetup, apiUrl]);

  // Carrega dados iniciais se tiver API configurada
  useEffect(() => {
    if (isSetup && apiUrl) {
      if (isOnline) {
        fetchData();
      } else {
        // Se estiver offline logo de cara, carrega o backup
        loadBackup();
        setSyncStatus('offline');
      }
    }
  }, [isSetup, apiUrl, isOnline]);

  const loadBackup = () => {
    const backup = localStorage.getItem('gcart_backup');
    if (backup) {
      const data = JSON.parse(backup);
      setCategories(data.categories || []);
      setItems(data.items || []);
      setLists(data.lists || []);
    }
  }

  // Função para buscar todos os dados da planilha
  const fetchData = async () => {
    if (!isOnline) return loadBackup();
    
    setIsLoading(true);
    setSyncStatus('syncing');
    try {
      const res = await fetch(apiUrl);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setCategories(data.categories || []);
      setItems(data.items || []);
      setLists(data.lists || []);
      setSyncStatus('success');
      
      // Salva backup local
      localStorage.setItem('gcart_backup', JSON.stringify(data));
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
      // Tenta carregar backup local em caso de erro
      loadBackup();
    } finally {
      setIsLoading(false);
    }
  };

  // Função para enviar dados para a planilha
  const syncData = async (action, data) => {
    // Atualiza o backup local primeiro para funcionamento imediato
    const currentBackup = JSON.parse(localStorage.getItem('gcart_backup') || '{"categories":[],"items":[],"lists":[]}');
    if (action.includes('CATEGORY')) currentBackup.categories = categories;
    if (action.includes('ITEM')) currentBackup.items = items;
    if (action.includes('LIST')) currentBackup.lists = lists;
    localStorage.setItem('gcart_backup', JSON.stringify(currentBackup));

    if (!apiUrl) return;
    if (!isOnline) {
      setSyncStatus('offline');
      return; // Salvo apenas localmente enquanto offline
    }

    setSyncStatus('syncing');
    try {
      // Usamos text/plain para evitar o bloqueio de CORS (preflight OPTIONS) no Google Apps Script
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action, data })
      });
      const result = await res.json();
      if (result.success) {
        setSyncStatus('success');
      } else {
        throw new Error("Erro ao salvar");
      }
    } catch (err) {
      console.error(err);
      setSyncStatus('error');
    }
  };

  // --- FUNÇÕES DE NEGÓCIO ---

  // Retorna o último preço pago e a quantidade (olhando as listas anteriores)
  const getLastPurchase = (itemId, currentListId) => {
    // Ordena listas da mais nova para a mais velha
    const sortedLists = [...lists].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    for (let list of sortedLists) {
      if (list.id === currentListId) continue; // Pula a lista atual
      const foundItem = list.items?.find(i => i.itemId === itemId && i.price > 0);
      if (foundItem) {
        return { price: foundItem.price, qty: foundItem.qty || 1 };
      }
    }
    return null;
  };

  // --- COMPONENTES DE TELA ---

  if (!isSetup) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex flex-col justify-center items-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center">
          <div className="bg-green-100 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
            <ShoppingCart size={40} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Supermercado Sync</h1>
          <p className="text-gray-500 mb-6 text-sm">
            Para começar, cole a URL do seu Google Apps Script abaixo. Isso conectará o aplicativo à sua própria planilha.
          </p>
          <input 
            type="text" 
            placeholder="https://script.google.com/macros/s/..."
            className="w-full p-4 border rounded-xl mb-4 bg-gray-50"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
          />
          <button 
            className="w-full bg-green-600 text-white font-bold p-4 rounded-xl shadow-lg active:bg-green-700"
            onClick={() => {
              if (apiUrl.trim().length > 10) {
                localStorage.setItem('gcart_apiUrl', apiUrl);
                setIsSetup(true);
              }
            }}
          >
            Conectar Planilha
          </button>
        </div>
      </div>
    );
  }

  // View: HOME (Listas)
  if (currentView === 'home') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <Header title="Minhas Compras" status={syncStatus} onRefresh={fetchData} />
        
        {/* Banner de Instalação PWA */}
        {showInstallPrompt && (
          <div className="mx-4 mt-4 bg-gradient-to-r from-green-600 to-green-500 text-white p-4 rounded-2xl shadow-lg flex justify-between items-center animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-xl">
                <Download size={24} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Instalar Aplicativo</h3>
                <p className="text-xs text-green-100">Acesso rápido na tela inicial</p>
              </div>
            </div>
            <button 
              onClick={async () => {
                if (deferredPrompt) {
                  deferredPrompt.prompt();
                  const { outcome } = await deferredPrompt.userChoice;
                  if (outcome === 'accepted') setShowInstallPrompt(false);
                  setDeferredPrompt(null);
                }
              }}
              className="bg-white text-green-700 px-4 py-2 rounded-xl font-bold text-sm active:scale-95 transition-transform shadow-sm"
            >
              Instalar
            </button>
          </div>
        )}

        <div className="p-4 space-y-4">
          <button 
            onClick={() => {
              // Cria nova lista
              const newList = {
                id: generateId(),
                name: `Compra ${new Date().toLocaleDateString('pt-BR')}`,
                market: '',
                budget: 0,
                date: new Date().toISOString(),
                items: [] // Inicia vazia para você adicionar na hora
              };
              
              setLists([newList, ...lists]);
              setActiveListId(newList.id);
              setCurrentView('activeList');
            }}
            className="w-full bg-green-600 text-white p-4 rounded-2xl shadow-lg flex items-center justify-center font-bold text-lg active:scale-95 transition-transform"
          >
            <Plus className="mr-2" /> Iniciar Nova Compra
          </button>

          <h2 className="font-bold text-gray-600 mt-6 mb-2">Histórico (Máx. 10)</h2>
          
          {isLoading && lists.length === 0 ? (
            <div className="text-center p-8 text-gray-400 animate-pulse">Carregando listas...</div>
          ) : lists.length === 0 ? (
            <div className="text-center p-8 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-300">
              Nenhuma lista encontrada. Comece uma nova!
            </div>
          ) : (
            lists.sort((a,b) => new Date(b.date) - new Date(a.date)).map(list => {
              const total = (list.items || []).reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
              const dateObj = new Date(list.date);
              
              return (
                <div 
                  key={list.id} 
                  className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center active:bg-gray-50"
                  onClick={() => {
                    setActiveListId(list.id);
                    setCurrentView('activeList');
                  }}
                >
                  <div>
                    <h3 className="font-bold text-lg">{list.name}</h3>
                    <p className="text-sm text-gray-500">
                      {dateObj.toLocaleDateString('pt-BR')} • {list.market || 'Mercado não definido'}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="flex items-center gap-2 mb-1">
                      <button onClick={(e) => { e.stopPropagation(); setListToDelete(list); }} className="text-gray-400 hover:text-red-500 p-1 bg-gray-50 rounded-full">
                        <Trash2 size={16} />
                      </button>
                      <div className="font-bold text-green-600">{formatMoney(total)}</div>
                    </div>
                    <div className="text-xs text-gray-400">Ver detalhes ➔</div>
                  </div>
                </div>
              );
            })
          )}
          
          <ConfirmModal
            isOpen={!!listToDelete}
            title="Excluir Lista"
            message={`Tem certeza que deseja excluir a lista "${listToDelete?.name}"? Os itens permanecerão no catálogo.`}
            isDanger={true}
            onCancel={() => setListToDelete(null)}
            onConfirm={() => {
              setLists(lists.filter(l => l.id !== listToDelete.id));
              syncData('DELETE_LIST', { id: listToDelete.id });
              setListToDelete(null);
            }}
          />
        </div>

        <BottomNav current="home" setView={setCurrentView} />
      </div>
    );
  }

  // View: CATALOGO (Gerenciar Categorias e Itens)
  if (currentView === 'catalog') {
    return (
      <CatalogView 
        categories={categories} 
        setCategories={setCategories}
        items={items}
        setItems={setItems}
        syncData={syncData}
        setCurrentView={setCurrentView}
      />
    );
  }

  // View: ACTIVE LIST (A tela de compras em si)
  if (currentView === 'activeList') {
    const list = lists.find(l => l.id === activeListId);
    if (!list) return setCurrentView('home');

    return (
      <ActiveListView 
        list={list}
        lists={lists}
        setLists={setLists}
        categories={categories}
        items={items}
        setItems={setItems}
        syncData={syncData}
        setCurrentView={setCurrentView}
        getLastPurchase={getLastPurchase}
      />
    );
  }
}

// --- SUB-COMPONENTES ---

function Header({ title, status, onRefresh }) {
  return (
    <div className="bg-white px-4 py-4 shadow-sm sticky top-0 z-10 flex justify-between items-center">
      <h1 className="font-bold text-xl text-gray-800">{title}</h1>
      <div className="flex items-center gap-3">
        {status === 'offline' && <div className="flex items-center gap-1 bg-orange-100 text-orange-600 px-2 py-1 rounded-full text-xs font-bold"><WifiOff size={12} /> Offline</div>}
        {status === 'syncing' && <RefreshCw size={20} className="text-blue-500 animate-spin" />}
        {status === 'success' && <Cloud size={20} className="text-green-500" />}
        {status === 'error' && <CloudOff size={20} className="text-red-500" />}
        {onRefresh && status !== 'offline' && (
          <button onClick={onRefresh} className="p-2 bg-gray-100 rounded-full active:bg-gray-200">
            <RefreshCw size={16} className="text-gray-600" />
          </button>
        )}
      </div>
    </div>
  );
}

function BottomNav({ current, setView }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around pb-safe">
      <button 
        className={`flex-1 py-4 flex flex-col items-center ${current === 'home' ? 'text-green-600' : 'text-gray-400'}`}
        onClick={() => setView('home')}
      >
        <ShoppingCart size={24} />
        <span className="text-xs mt-1 font-medium">Listas</span>
      </button>
      <button 
        className={`flex-1 py-4 flex flex-col items-center ${current === 'catalog' ? 'text-green-600' : 'text-gray-400'}`}
        onClick={() => setView('catalog')}
      >
        <Settings size={24} />
        <span className="text-xs mt-1 font-medium">Catálogo</span>
      </button>
    </div>
  );
}

// --- TELA DO CATÁLOGO ---
function CatalogView({ categories, setCategories, items, setItems, syncData, setCurrentView }) {
  const [newCatName, setNewCatName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [selectedCatId, setSelectedCatId] = useState('');
  const [catToDelete, setCatToDelete] = useState(null);

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const cat = { id: generateId(), name: newCatName.trim() };
    setCategories([...categories, cat]);
    syncData('SAVE_CATEGORY', cat);
    setNewCatName('');
  };

  const handleAddItem = () => {
    if (!newItemName.trim() || !selectedCatId) return;
    const item = { id: generateId(), categoryId: selectedCatId, name: newItemName.trim() };
    setItems([...items, item]);
    syncData('SAVE_ITEM', item);
    setNewItemName('');
  };

  const handleDeleteItem = (item) => {
    setItems(items.filter(i => i.id !== item.id));
    syncData('DELETE_ITEM', item);
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Header title="Catálogo Base" />
      
      <div className="p-4 space-y-6">
        <div className="bg-white p-4 rounded-2xl shadow-sm border">
          <h2 className="font-bold text-gray-700 mb-4">1. Categorias</h2>
          {/* ALTERAÇÃO AQUI: flex-col no mobile, flex-row a partir da tela sm */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input 
              type="text" 
              placeholder="Ex: Limpeza, Açougue..." 
              className="flex-1 border p-3 rounded-xl bg-gray-50"
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
            />
            {/* ALTERAÇÃO AQUI: w-full no mobile, w-auto a partir da tela sm */}
            <button onClick={handleAddCategory} className="bg-gray-800 text-white p-3 rounded-xl font-bold w-full sm:w-auto">
              Adicionar
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <div key={cat.id} className="bg-gray-100 pl-3 pr-1 py-1 rounded-full text-sm font-medium text-gray-600 border flex items-center gap-1">
                <span>{cat.name}</span>
                <button onClick={() => setCatToDelete(cat)} className="text-gray-400 hover:text-red-500 p-1 rounded-full">
                  <X size={14} />
                </button>
              </div>
            ))}
            {categories.length === 0 && <span className="text-gray-400 text-sm">Nenhuma categoria cadastrada.</span>}
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border">
          <h2 className="font-bold text-gray-700 mb-4">2. Itens do Mercado</h2>
          <div className="space-y-3 mb-6">
            <select 
              className="w-full border p-3 rounded-xl bg-gray-50"
              value={selectedCatId}
              onChange={e => setSelectedCatId(e.target.value)}
            >
              <option value="">Selecione a Categoria...</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            {/* ALTERAÇÃO AQUI: flex-col no mobile, flex-row a partir da tela sm */}
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text" 
                placeholder="Ex: Arroz 5kg" 
                className="flex-1 border p-3 rounded-xl bg-gray-50"
                value={newItemName}
                onChange={e => setNewItemName(e.target.value)}
              />
              {/* ALTERAÇÃO AQUI: w-full no mobile, w-auto a partir da tela sm */}
              <button onClick={handleAddItem} className="bg-green-600 text-white p-3 rounded-xl font-bold w-full sm:w-auto">
                Criar Item
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {categories.map(cat => {
              const catItems = items.filter(i => i.categoryId === cat.id);
              if (catItems.length === 0) return null;
              return (
                <div key={cat.id}>
                  <h3 className="font-bold text-sm text-gray-500 mb-2">{cat.name}</h3>
                  <div className="space-y-2">
                    {catItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border">
                        <span>{item.name}</span>
                        <button onClick={() => handleDeleteItem(item)} className="text-red-400 p-1">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          
          <ConfirmModal
            isOpen={!!catToDelete}
            title="Excluir Categoria"
            message={`Atenção: Ao excluir a categoria "${catToDelete?.name}", TODOS os itens pertencentes a ela também serão excluídos do catálogo. Tem certeza?`}
            isDanger={true}
            onCancel={() => setCatToDelete(null)}
            onConfirm={() => {
              const itemsToDelete = items.filter(i => i.categoryId === catToDelete.id);
              setCategories(categories.filter(c => c.id !== catToDelete.id));
              setItems(items.filter(i => i.categoryId !== catToDelete.id));
              syncData('DELETE_CATEGORY', { id: catToDelete.id });
              itemsToDelete.forEach(item => syncData('DELETE_ITEM', { id: item.id }));
              setCatToDelete(null);
            }}
          />
        </div>
      </div>
      
      <BottomNav current="catalog" setView={setCurrentView} />
    </div>
  );
}

// --- TELA DA LISTA ATIVA (COMPRAS) ---
function ActiveListView({ list, lists, setLists, categories, items, setItems, syncData, setCurrentView, getLastPurchase }) {
  const [numpadConfig, setNumpadConfig] = useState(null);
  const [isEditingHeader, setIsEditingHeader] = useState(false);

  // Novos states para busca e adição de itens
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newCategoryPrompt, setNewCategoryPrompt] = useState(false);

  // States para colapsar, filtrar e ordenar categorias
  const [expandedCats, setExpandedCats] = useState({}); // Agora começam vazias (fechadas por padrão)
  const [filterCats, setFilterCats] = useState({});
  const [sortAlpha, setSortAlpha] = useState({}); // Controle de ordem alfabética

  // Sugestões de autocomplete
  const suggestions = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleAddExisting = (item) => {
    if (!list.items?.find(i => i.itemId === item.id)) {
      const updatedItems = [{ itemId: item.id, price: 0, qty: 1 }, ...(list.items || [])];
      updateList({ ...list, items: updatedItems });
    }
    setSearchTerm('');
    setShowSuggestions(false);
  };

  const handleCreateNew = (categoryId) => {
    const newItem = { id: generateId(), categoryId, name: searchTerm.trim() };
    
    // Atualiza o catálogo
    setItems([...items, newItem]);
    syncData('SAVE_ITEM', newItem);

    // Adiciona à lista atual
    const updatedItems = [{ itemId: newItem.id, price: 0, qty: 1 }, ...(list.items || [])];
    updateList({ ...list, items: updatedItems });

    setSearchTerm('');
    setShowSuggestions(false);
    setNewCategoryPrompt(false);
  };

  const handleRemoveFromList = (itemId) => {
    const updatedItems = list.items.filter(i => i.itemId !== itemId);
    updateList({ ...list, items: updatedItems });
  };

  // Calcula totais
  const totalSpent = (list.items || []).reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
  const balance = list.budget - totalSpent;

  // Atualiza um campo da lista principal (nome, mercado, budget)
  const updateListMeta = (field, value) => {
    const updated = { ...list, [field]: value };
    updateList(updated);
  };

  // Atualiza um item da lista
  const updateItemValue = (itemId, field, value) => {
    const updatedItems = list.items.map(i => {
      if (i.itemId === itemId) return { ...i, [field]: value };
      return i;
    });
    
    // Se o item não existia na lista ainda (foi adicionado ao catálogo depois da lista criada), adiciona agora
    if (!updatedItems.find(i => i.itemId === itemId)) {
      updatedItems.push({ itemId, price: field === 'price' ? value : 0, qty: field === 'qty' ? value : 1 });
    }

    updateList({ ...list, items: updatedItems });
  };

  const updateList = (updatedList) => {
    setLists(lists.map(l => l.id === updatedList.id ? updatedList : l));
    syncData('SAVE_LIST', updatedList);
  };

  const handleNumpadConfirm = (value) => {
    const num = parseFloat(value) || 0;
    if (numpadConfig.field === 'budget') {
      updateListMeta('budget', num);
    } else {
      updateItemValue(numpadConfig.targetItem, numpadConfig.field, num);
    }
    setNumpadConfig(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-40">
      {/* Header Fixo */}
      <div className="bg-white px-4 py-3 shadow-sm sticky top-0 z-10 flex items-center justify-between">
        <button onClick={() => setCurrentView('home')} className="p-2 -ml-2 text-gray-600">
          <ChevronLeft size={24} />
        </button>
        <div className="flex-1 text-center font-bold text-lg truncate px-2" onClick={() => setIsEditingHeader(true)}>
          {list.name}
        </div>
        <button className="p-2 -mr-2 text-green-600" onClick={() => syncData('SAVE_LIST', list)}>
          <Save size={24} />
        </button>
      </div>

      {/* Editor de Cabeçalho Modal (Simples) */}
      {isEditingHeader && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm space-y-4">
            <h2 className="font-bold text-lg">Detalhes da Compra</h2>
            <div>
              <label className="text-sm text-gray-500">Nome da Lista</label>
              <input type="text" value={list.name} onChange={e => updateListMeta('name', e.target.value)} className="w-full border p-3 rounded-xl bg-gray-50 mt-1" />
            </div>
            <div>
              <label className="text-sm text-gray-500">Mercado</label>
              <input type="text" value={list.market} onChange={e => updateListMeta('market', e.target.value)} placeholder="Ex: Assaí, Atacadão..." className="w-full border p-3 rounded-xl bg-gray-50 mt-1" />
            </div>
            <button onClick={() => setIsEditingHeader(false)} className="w-full bg-green-600 text-white p-3 rounded-xl font-bold">Concluir</button>
          </div>
        </div>
      )}

      {/* Barra de Adicionar Item */}
      <div className="bg-white p-4 shadow-sm border-b relative z-20">
        <div className="relative">
          <input
            type="text"
            placeholder="Buscar ou adicionar item..."
            className="w-full border p-3 rounded-xl bg-gray-50 pl-10 focus:ring-2 focus:ring-green-500 focus:outline-none"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          />
          <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
        </div>

        {showSuggestions && searchTerm.trim().length > 0 && (
          <div className="absolute left-4 right-4 bg-white mt-2 rounded-xl shadow-xl border overflow-hidden max-h-60 overflow-y-auto">
            {suggestions.map(item => (
              <div
                key={item.id}
                className="p-3 border-b active:bg-gray-50 flex justify-between items-center cursor-pointer"
                onClick={() => handleAddExisting(item)}
              >
                <span className="font-medium text-gray-700">{item.name}</span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                   {categories.find(c => c.id === item.categoryId)?.name || 'Sem categoria'}
                </span>
              </div>
            ))}
            <div
              className="p-3 text-green-600 font-bold active:bg-green-50 flex items-center gap-2 cursor-pointer bg-green-50/50"
              onClick={() => setNewCategoryPrompt(true)}
            >
              <Plus size={18} /> Cadastrar "{searchTerm}"
            </div>
          </div>
        )}
      </div>

      {/* Modal de Escolher Categoria para Item Novo */}
      {newCategoryPrompt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-2xl w-full max-w-sm space-y-4">
            <h2 className="font-bold text-lg text-gray-800">Salvar no Catálogo</h2>
            <p className="text-sm text-gray-500">Escolha a categoria para <strong>"{searchTerm}"</strong>:</p>

            {categories.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-red-500 mb-4">Você precisa criar ao menos uma categoria no Catálogo primeiro.</p>
                <button
                  onClick={() => { setNewCategoryPrompt(false); setCurrentView('catalog'); }}
                  className="bg-green-600 text-white p-3 rounded-xl font-bold w-full"
                >
                  Ir para Catálogo
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => handleCreateNew(cat.id)}
                    className="w-full text-left p-3 border rounded-xl active:bg-gray-50 font-medium text-gray-700 hover:border-green-500"
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            <button onClick={() => setNewCategoryPrompt(false)} className="w-full p-3 text-gray-400 font-bold mt-2 hover:bg-gray-50 rounded-xl">Cancelar</button>
          </div>
        </div>
      )}

      {/* Corpo da Lista - Agrupado por Categoria */}
      <div className="p-4 space-y-6">
        {(!list.items || list.items.length === 0) && (
           <div className="text-center p-8 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-300">
             Lista vazia. Busque ou adicione itens usando o campo acima!
           </div>
        )}

        {categories.map(cat => {
          // Filtra apenas os itens que estão NESTA lista E pertencem a ESTA categoria
          const listItemsData = (list.items || [])
            .map(listItem => {
              const baseItem = items.find(i => i.id === listItem.itemId);
              return baseItem ? { ...baseItem, price: listItem.price, qty: listItem.qty || 1 } : null;
            })
            .filter(item => item && item.categoryId === cat.id);

          if (listItemsData.length === 0) return null;

          // Calcula progresso da categoria
          const boughtCount = listItemsData.filter(i => i.price > 0).length;
          const totalCount = listItemsData.length;
          const progressPercent = totalCount === 0 ? 0 : (boughtCount / totalCount) * 100;

          // Calcula o preço máximo para exibir a coroa
          const maxItemPrice = Math.max(0, ...listItemsData.filter(i => i.price > 0).map(i => i.price));

          // Calcula o total gasto nesta categoria
          const categoryTotal = listItemsData.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);

          // Lógica de filtro, ordenação e colapso
          let displayItems = [...listItemsData]; // Clonamos o array original para não afetar outras ordens
          
          if (filterCats[cat.id] === 'unbought') {
            displayItems = displayItems.filter(i => i.price === 0);
          }
          
          // Se o botão de A-Z estiver ativo, ordena por nome
          if (sortAlpha[cat.id]) {
            displayItems.sort((a, b) => a.name.localeCompare(b.name));
          }

          // A categoria só será expandida se estiver explicitamente como true no estado
          const isExpanded = !!expandedCats[cat.id];

          return (
            <div key={cat.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <div className="flex justify-between items-center mb-2">
                  <div 
                    className="flex items-center gap-2 cursor-pointer active:opacity-70 flex-1"
                    onClick={() => setExpandedCats(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                  >
                    {!isExpanded ? <ChevronRight size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
                    <h2 className="font-bold text-gray-700 truncate pr-2">{cat.name}</h2>
                  </div>
                  
                  {/* Container dos botões e valores */}
                  <div className="flex items-center gap-2">
                    {/* Botão de Ordenação Alfabética */}
                    <button 
                      onClick={() => setSortAlpha(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                      className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${sortAlpha[cat.id] ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-500'}`}
                      title={sortAlpha[cat.id] ? "Remover ordem alfabética" : "Ordenar de A-Z"}
                    >
                      <ArrowDownAZ size={16} />
                    </button>

                    {/* Botão de Filtro */}
                    <button 
                      onClick={() => setFilterCats(prev => ({ ...prev, [cat.id]: prev[cat.id] === 'unbought' ? 'all' : 'unbought' }))}
                      className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${filterCats[cat.id] === 'unbought' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}
                      title={filterCats[cat.id] === 'unbought' ? "Mostrar todos" : "Mostrar apenas não comprados"}
                    >
                      <Filter size={16} />
                    </button>
                    
                    <div className="text-right ml-1">
                      {categoryTotal > 0 && (
                        <div className="text-sm font-bold text-green-700">{formatMoney(categoryTotal)}</div>
                      )}
                      <div className="text-xs font-medium text-gray-500 whitespace-nowrap">
                        {boughtCount} / {totalCount}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Barra de Progresso */}
                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-green-500 h-2 transition-all duration-300 ease-in-out" 
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              </div>

              {isExpanded && (
                <div className="p-2 space-y-2">
                  {displayItems.length === 0 && filterCats[cat.id] === 'unbought' && (
                    <div className="text-center p-4 text-sm text-green-600 font-medium bg-green-50 rounded-xl">
                      Todos os itens desta categoria foram comprados! 🎉
                    </div>
                  )}
                  {displayItems.map(item => {
                    const lastPurchase = getLastPurchase(item.id, list.id);
                    const lastPrice = lastPurchase ? lastPurchase.price : 0;
                    const lastQty = lastPurchase ? lastPurchase.qty : 0;
                    const priceDiff = item.price > 0 && lastPrice > 0 ? item.price - lastPrice : 0;
                    
                    const isBought = item.price > 0;
                    const isMostExpensive = isBought && item.price === maxItemPrice && maxItemPrice > 0;
                    
                    return (
                      <div 
                        key={item.id} 
                        className={`p-3 rounded-xl border flex flex-col transition-colors ${
                          isBought ? 'bg-green-50 border-green-200' : 'bg-white border-gray-100'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className={`font-bold text-lg pr-2 flex items-center gap-2 ${isBought ? 'text-green-800' : 'text-gray-800'}`}>
                            {item.name} {isMostExpensive && <span title="Item mais caro da categoria">👑</span>}
                          </span>
                          <div className="flex items-center gap-2">
                            {isBought && (
                              <span className="font-bold text-green-800 bg-green-200/60 px-2 py-1 rounded-lg text-sm">
                                {formatMoney(item.price * item.qty)}
                              </span>
                            )}
                            {isBought && <CheckCircle className="text-green-500" size={20} />}
                            <button onClick={() => handleRemoveFromList(item.id)} className="text-gray-400 p-1 active:bg-gray-100 rounded-full">
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-500 mb-3 flex items-center gap-1 flex-wrap">
                          <span>Último:</span> 
                          <span className={lastPrice > 0 ? "font-medium text-gray-700" : ""}>
                            {lastPrice > 0 ? `${formatMoney(lastPrice)} (Qtd: ${lastQty})` : 'Sem registro'}
                          </span>
                          {isBought && lastPrice > 0 && priceDiff !== 0 && (
                            <span className={`ml-1 font-bold flex items-center gap-0.5 ${priceDiff > 0 ? 'text-red-500' : 'text-green-600'}`}>
                              {priceDiff > 0 ? '↑' : '↓'} {formatMoney(Math.abs(priceDiff))}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button 
                            onClick={() => setNumpadConfig({ targetItem: item.id, field: 'price', currentValue: item.price })}
                            className={`flex-1 p-3 rounded-xl border font-bold text-center flex items-center justify-center active:scale-95 transition-transform ${
                              isBought ? 'bg-green-600 text-white border-green-600' : 'bg-gray-50 text-gray-600'
                            }`}
                          >
                            {isBought ? formatMoney(item.price) : 'Inserir Preço Unitário'}
                          </button>
                          
                          <button 
                            onClick={() => setNumpadConfig({ targetItem: item.id, field: 'qty', currentValue: item.qty })}
                            className={`w-20 p-3 rounded-xl border font-bold text-center active:scale-95 transition-transform flex items-center justify-center gap-1 ${
                              isBought ? 'bg-green-100 border-green-200 text-green-800' : 'bg-gray-50 text-gray-600'
                            }`}
                          >
                            <span className="text-xs font-normal">Qtd</span> {item.qty}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Barra de Totais Fixa no Rodapé */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)] p-4 pb-safe z-20">
        <div className="flex justify-between items-center mb-3">
          <div className="flex-1" onClick={() => setNumpadConfig({ field: 'budget', currentValue: list.budget })}>
            <div className="text-xs text-gray-500 font-medium">Saldo / Orçamento <Edit2 size={10} className="inline ml-1"/></div>
            <div className="font-bold text-gray-800">{formatMoney(list.budget)}</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-xs text-gray-500 font-medium">Total Gasto</div>
            <div className="font-bold text-gray-800">{formatMoney(totalSpent)}</div>
          </div>
          <div className="flex-1 text-right">
            <div className="text-xs text-gray-500 font-medium">Sobra</div>
            <div className={`font-bold text-lg ${balance < 0 ? 'text-red-500' : 'text-green-600'}`}>
              {formatMoney(balance)}
            </div>
          </div>
        </div>
      </div>

      {/* Teclado Customizado (Numpad) */}
      {numpadConfig && (
        <NumpadModal 
          config={numpadConfig} 
          onClose={() => setNumpadConfig(null)} 
          onConfirm={handleNumpadConfirm}
          itemName={
            numpadConfig.field === 'budget' 
            ? 'Definir Orçamento' 
            : items.find(i => i.id === numpadConfig.targetItem)?.name
          }
        />
      )}
    </div>
  );
}

// --- TECLADO CUSTOMIZADO PARA UMA MÃO ---
function NumpadModal({ config, onClose, onConfirm, itemName }) {
  const isMoney = config.field === 'price' || config.field === 'budget';
  const initialStr = config.currentValue ? config.currentValue.toString().replace('.', ',') : '';
  const [valueStr, setValueStr] = useState(initialStr === '0' ? '' : initialStr);

  const handlePress = (key) => {
    if (key === 'BACK') {
      setValueStr(prev => prev.slice(0, -1));
    } else if (key === ',') {
      if (!valueStr.includes(',')) setValueStr(prev => (prev || '0') + ',');
    } else {
      // Limita tamanho para não estourar layout
      if (valueStr.length < 10) setValueStr(prev => prev + key);
    }
  };

  const confirm = () => {
    const finalVal = valueStr.replace(',', '.');
    onConfirm(finalVal);
  };

  // Botões do teclado arranjados para ergonomia de uma mão
  const keys = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    isMoney ? ',' : '', '0', 'BACK'
  ];

  // Visualização formatada em tempo real no display
  let displayValue = valueStr;
  if (!displayValue) displayValue = '0';
  if (isMoney) {
     // Apenas para mostrar o 'R$' de forma bonita
     displayValue = `R$ ${displayValue}`;
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex flex-col justify-end animate-in fade-in duration-200">
      <div className="flex-1" onClick={onClose}></div>
      <div className="bg-white rounded-t-3xl shadow-2xl p-4 animate-in slide-in-from-bottom-full duration-300">
        
        <div className="flex justify-between items-center mb-4 px-2">
          <h3 className="font-bold text-gray-500 uppercase text-xs">{itemName}</h3>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">
            {config.field === 'price' ? 'Preço Unitário' : config.field === 'qty' ? 'Quantidade' : 'Orçamento'}
          </span>
        </div>

        <div className="bg-gray-100 p-4 rounded-2xl mb-4 text-right">
          <span className="text-4xl font-bold text-gray-800 tracking-tight">
            {displayValue}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {keys.map((key, i) => {
            if (key === '') return <div key={i} />;
            if (key === 'BACK') return (
              <button key={i} onClick={() => handlePress(key)} className="bg-gray-100 p-4 rounded-2xl text-2xl font-bold text-red-500 active:bg-gray-200 flex justify-center items-center touch-manipulation">
                <Trash2 size={24} />
              </button>
            );
            return (
              <button 
                key={i} 
                onClick={() => handlePress(key)} 
                className="bg-gray-100 py-5 rounded-2xl text-3xl font-bold text-gray-800 active:bg-gray-200 active:scale-95 transition-all touch-manipulation"
              >
                {key}
              </button>
            );
          })}
        </div>

        <button 
          onClick={confirm}
          className="w-full bg-green-600 text-white py-5 rounded-2xl text-xl font-bold shadow-lg active:bg-green-700 active:scale-95 transition-all mb-safe"
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}

// --- MODAL DE CONFIRMAÇÃO ---
function ConfirmModal({ isOpen, title, message, confirmText, cancelText, onConfirm, onCancel, isDanger }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white p-6 rounded-2xl w-full max-w-sm space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <h2 className="font-bold text-lg text-gray-800">{title}</h2>
        <p className="text-sm text-gray-600">{message}</p>
        <div className="flex gap-3 pt-2">
          <button onClick={onCancel} className="flex-1 p-3 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200">
            {cancelText || 'Cancelar'}
          </button>
          <button onClick={onConfirm} className={`flex-1 p-3 rounded-xl font-bold text-white ${isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}>
            {confirmText || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}