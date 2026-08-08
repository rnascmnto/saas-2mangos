"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
  TrendingDown, Calendar, ChevronDown, Plus, ArrowRight, 
  DollarSign, Wallet, PieChart, X, Search, MoreVertical, 
  Trash2, Edit3, Loader2, ListFilter
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon: string;
  expense_type: string;
  due_date?: number | null;
  closing_date?: number | null;
  is_credit_card?: boolean;
  is_active?: boolean; // Novo campo
}

interface Transaction {
  id: string;
  category_id: string;
  amount: number;
  date: string;
  status: "pendente" | "pago";
  categories: Category;
  merged_ids?: string[]; // Propriedade invisível para gerenciar o agrupamento da fatura
}

const MONTHS = [
  "Todos os Meses", "Janeiro", "Fevereiro", "Março", "Abril", 
  "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", 
  "Novembro", "Dezembro"
];

const MONTH_MAP: { [key: string]: string } = {
  "Janeiro": "01", "Fevereiro": "02", "Março": "03", "Abril": "04",
  "Maio": "05", "Junho": "06", "Julho": "07", "Agosto": "08",
  "Setembro": "09", "Outubro": "10", "Novembro": "11", "Dezembro": "12"
};

const STATUS_OPTIONS = ["Todos os Status", "Pago", "Pendente"];
const TYPE_OPTIONS = ["Todos os Tipos", "Variável", "Recorrente"];

export default function LancamentosPage() {
  // Inicialização dinâmica baseada na data atual do sistema
  const currentDate = new Date();
  const currentMonthName = MONTHS[currentDate.getMonth() + 1]; // Pula o "Todos os Meses"
  const currentYearStr = currentDate.getFullYear().toString();

  // Filtros de Período (Topo)
  const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);
  const monthRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);

  // Filtros Secundários (Barra da Tabela)
  const [statusFilter, setStatusFilter] = useState("Todos os Status");
  const [typeFilter, setTypeFilter] = useState("Todos os Tipos");
  const [tableSearch, setTableSearch] = useState("");
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const typeRef = useRef<HTMLDivElement>(null);

  // Estados dos Dados
  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  // Dropdown Categoria no Modal
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [searchCategory, setSearchCategory] = useState("");
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Dropdown de Ações da Tabela
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // --- LÓGICA DE ANOS DINÂMICOS ---
  const availableYears = Array.from(new Set(transactions.map(tx => tx.date.split("-")[0])));
  
  if (!availableYears.includes(currentYearStr)) {
    availableYears.push(currentYearStr);
  }
  
  availableYears.sort((a, b) => Number(b) - Number(a));
  const dynamicYears = ["Todos os Anos", ...availableYears];

  // Clique fora para fechar todos os dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (monthRef.current && !monthRef.current.contains(event.target as Node)) setIsMonthOpen(false);
      if (yearRef.current && !yearRef.current.contains(event.target as Node)) setIsYearOpen(false);
      if (statusRef.current && !statusRef.current.contains(event.target as Node)) setIsStatusOpen(false);
      if (typeRef.current && !typeRef.current.contains(event.target as Node)) setIsTypeOpen(false);
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) setIsCategoryDropdownOpen(false);
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) setActiveActionMenu(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // Buscando também a coluna is_active
    const { data: catData } = await supabase
      .from("categories")
      .select("id, name, icon, expense_type, due_date, closing_date, is_credit_card, is_active") 
      .eq("user_id", session.user.id)
      .order("name", { ascending: true });
    
    if (catData) setCategories(catData);

    const { data: transData } = await supabase
      .from("transactions")
      .select(`
        id, category_id, amount, date, status,
        categories (id, name, icon, expense_type, due_date, closing_date, is_credit_card, is_active)
      `)
      .eq("user_id", session.user.id)
      .order("date", { ascending: true });

    if (transData) setTransactions(transData as unknown as Transaction[]);
    setLoading(false);
  }

  // Filtrando para ocultar categorias inativas do dropdown
  const filteredCategories = categories.filter(cat => 
    cat.is_active !== false && 
    cat.name.toLowerCase().includes(searchCategory.toLowerCase())
  );

  function openNewModal() {
    setEditingTransactionId(null);
    setSelectedCategory(null);
    setAmount("");
    setDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  }

  function openEditModal(tx: Transaction) {
    if (tx.merged_ids && tx.merged_ids.length > 0) {
      alert("Para editar os lançamentos do cartão, gerencie através da tela de Cartões de Crédito.");
      setActiveActionMenu(null);
      return;
    }
    setEditingTransactionId(tx.id);
    setSelectedCategory(tx.categories);
    setAmount(tx.amount.toString());
    setDate(tx.date);
    setIsModalOpen(true);
    setActiveActionMenu(null);
  }

  async function handleSaveTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCategory || !amount || !date) return;

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const payload = {
        user_id: session.user.id,
        category_id: selectedCategory.id,
        amount: parseFloat(amount),
        date: date,
      };

      if (editingTransactionId) {
        await supabase.from("transactions").update(payload).eq("id", editingTransactionId);
      } else {
        await supabase.from("transactions").insert([payload]);
      }
      
      await fetchData(); 
      setIsModalOpen(false);
    } catch (error) {
      alert("Erro ao salvar lançamento.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(tx: Transaction) {
    if (!confirm("Tem certeza que deseja excluir esta despesa?")) return;
    try {
      if (tx.merged_ids && tx.merged_ids.length > 0) {
        await supabase.from("transactions").delete().in("id", tx.merged_ids);
        setTransactions(transactions.filter(t => !tx.merged_ids!.includes(t.id)));
      } else {
        await supabase.from("transactions").delete().eq("id", tx.id);
        setTransactions(transactions.filter(t => t.id !== tx.id));
      }
      setActiveActionMenu(null);
    } catch (error) {
      alert("Erro ao excluir.");
    }
  }

  async function toggleStatus(tx: Transaction) {
    const newStatus = tx.status === "pendente" ? "pago" : "pendente";
    
    if (tx.merged_ids && tx.merged_ids.length > 0) {
      setTransactions(transactions.map(t => tx.merged_ids!.includes(t.id) ? { ...t, status: newStatus } : t));
      await supabase.from("transactions").update({ status: newStatus }).in("id", tx.merged_ids);
    } else {
      setTransactions(transactions.map(t => t.id === tx.id ? { ...t, status: newStatus } : t));
      await supabase.from("transactions").update({ status: newStatus }).eq("id", tx.id);
    }
  }

  // --- LÓGICA DE FILTRAGEM E AGRUPAMENTO INVISÍVEL ---
  const isTableFiltered = statusFilter !== "Todos os Status" || typeFilter !== "Todos os Tipos" || tableSearch.trim() !== "";

  // 1. Filtra determinando o mês correto (Competência para cartões)
  const baseFiltered = transactions.filter(tx => {
    let targetYearStr = "";
    let targetMonthStr = "";

    if (tx.categories?.is_credit_card) {
      const closingDay = tx.categories.closing_date;
      const dueDay = tx.categories.due_date;
      
      const d = new Date(tx.date + "T12:00:00Z");
      let targetMonth = d.getMonth();
      let targetYear = d.getFullYear();
      
      if (closingDay && dueDay) {
        if (d.getDate() >= closingDay) {
          targetMonth += 1;
          if (targetMonth > 11) { targetMonth = 0; targetYear += 1; }
        }
        if (dueDay < closingDay) {
          targetMonth += 1;
          if (targetMonth > 11) { targetMonth = 0; targetYear += 1; }
        }
      }
      targetYearStr = targetYear.toString();
      targetMonthStr = String(targetMonth + 1).padStart(2, '0');
    } else {
      const [txY, txM] = tx.date.split("-");
      targetYearStr = txY;
      targetMonthStr = txM;
    }

    const matchesYear = selectedYear === "Todos os Anos" || targetYearStr === selectedYear;
    const matchesMonth = selectedMonth === "Todos os Meses" || targetMonthStr === MONTH_MAP[selectedMonth];

    const matchesStatus = statusFilter === "Todos os Status" || 
      (statusFilter === "Pago" && tx.status === "pago") || 
      (statusFilter === "Pendente" && tx.status === "pendente");

    const matchesType = typeFilter === "Todos os Tipos" ||
      (typeFilter === "Variável" && tx.categories?.expense_type === "variavel") ||
      (typeFilter === "Recorrente" && tx.categories?.expense_type === "recorrente");

    const matchesSearch = tableSearch === "" || 
      tx.categories?.name.toLowerCase().includes(tableSearch.toLowerCase());

    return matchesYear && matchesMonth && matchesStatus && matchesType && matchesSearch;
  });

  // 2. Agrupa apenas para a visualização, criando uma linha unificada com o total da fatura
  const displayTransactions: Transaction[] = [];
  const ccMap: Record<string, Transaction> = {};

  baseFiltered.forEach(tx => {
    if (tx.categories?.is_credit_card) {
      const groupKey = tx.category_id;
      
      if (!ccMap[groupKey]) {
        const dueDay = tx.categories.due_date ? String(tx.categories.due_date).padStart(2, '0') : "01";
        const y = selectedYear !== "Todos os Anos" ? selectedYear : new Date().getFullYear().toString();
        const m = selectedMonth !== "Todos os Meses" ? MONTH_MAP[selectedMonth] : String(new Date().getMonth() + 1).padStart(2, '0');

        ccMap[groupKey] = { 
          ...tx, 
          amount: 0, 
          date: `${y}-${m}-${dueDay}`, 
          merged_ids: [] 
        };
        displayTransactions.push(ccMap[groupKey]);
      }
      
      ccMap[groupKey].amount += Number(tx.amount);
      ccMap[groupKey].merged_ids!.push(tx.id);
      
      if (tx.status === "pendente") {
        ccMap[groupKey].status = "pendente";
      }
    } else {
      displayTransactions.push(tx);
    }
  });

  displayTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // --- CÁLCULO DOS CARDS ---
  const transactionsForYear = transactions.filter(tx => {
    let targetYearStr = "";
    if (tx.categories?.is_credit_card) {
      const closingDay = tx.categories.closing_date;
      const dueDay = tx.categories.due_date;
      const d = new Date(tx.date + "T12:00:00Z");
      let targetMonth = d.getMonth();
      let targetYear = d.getFullYear();
      if (closingDay && dueDay) {
        if (d.getDate() >= closingDay) {
          targetMonth += 1;
          if (targetMonth > 11) { targetMonth = 0; targetYear += 1; }
        }
        if (dueDay < closingDay) {
          targetMonth += 1;
          if (targetMonth > 11) { targetMonth = 0; targetYear += 1; }
        }
      }
      targetYearStr = targetYear.toString();
    } else {
      const [txY] = tx.date.split("-");
      targetYearStr = txY;
    }
    return selectedYear === "Todos os Anos" || targetYearStr === selectedYear;
  });

  const totalPeriodAmount = baseFiltered.reduce((acc, tx) => acc + Number(tx.amount), 0);
  const totalYearAmount = transactionsForYear.reduce((acc, tx) => acc + Number(tx.amount), 0);
  
  const averageMonthlyAmount = totalYearAmount / 12;
  const filteredAverageAmount = displayTransactions.length > 0 ? totalPeriodAmount / displayTransactions.length : 0;
  const displayAverage = isTableFiltered ? filteredAverageAmount : averageMonthlyAmount;

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDateBR = (dateStr: string) => dateStr.split('-').reverse().join('/');

  const cardHoverEffect = "transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:bg-[#202020]";

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* CABEÇALHO E FILTROS MACRO */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-black dark:text-white tracking-tight">Lançamentos</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 flex items-center gap-1.5">
            <TrendingDown size={16} className="text-red-500" /> Gerencie e rastreie o fluxo de saída financeira
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center h-12 bg-white dark:bg-[#1A1A1A] rounded-xl px-4 shadow-sm text-sm font-medium w-full sm:w-auto relative">
            <div className="flex items-center gap-2 mr-4">
              <Calendar size={16} className="text-red-500 dark:text-red-400" />
              <span className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Período</span>
            </div>
            <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mr-4" />
            <div className="relative mr-4" ref={monthRef}>
              <button onClick={() => { setIsMonthOpen(!isMonthOpen); setIsYearOpen(false); }} className="flex items-center gap-2 text-black dark:text-white hover:opacity-80 transition-opacity min-w-[100px] justify-between">
                {selectedMonth} <ChevronDown size={14} className="text-neutral-500" />
              </button>
              {isMonthOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 max-h-64 overflow-y-auto bg-white dark:bg-[#1A1A1A] rounded-xl shadow-xl z-50 py-2">
                  {MONTHS.map((month) => (
                    <button key={month} onClick={() => { setSelectedMonth(month); setIsMonthOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                      {month}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mr-4" />
            <div className="relative" ref={yearRef}>
              <button onClick={() => { setIsYearOpen(!isYearOpen); setIsMonthOpen(false); }} className="flex items-center gap-2 text-black dark:text-white hover:opacity-80 transition-opacity min-w-[70px] justify-between">
                {selectedYear} <ChevronDown size={14} className="text-neutral-500" />
              </button>
              {isYearOpen && (
                <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-[#1A1A1A] rounded-xl shadow-xl z-50 py-2">
                  {dynamicYears.map((year) => (
                    <button key={year} onClick={() => { setSelectedYear(year); setIsYearOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button onClick={openNewModal} className="flex items-center justify-center gap-2 h-12 px-6 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm w-full sm:w-auto whitespace-nowrap group">
            <Plus size={18} /> Novo Lançamento <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total no Período */}
        <div className={`bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-sm ${cardHoverEffect}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">Total no período</span>
              <h3 className="text-2xl font-bold text-black dark:text-white">{formatCurrency(totalPeriodAmount)}</h3>
            </div>
            <div className="p-2 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg">
              <DollarSign size={16} className="text-red-500 dark:text-red-400" />
            </div>
          </div>
          <div>
            <span className={`inline-block px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors ${
              isTableFiltered 
                ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400" 
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-500"
            }`}>
              {isTableFiltered ? "Pesquisa Ativa" : `${selectedMonth}${selectedYear !== "Todos os Anos" ? ` / ${selectedYear}` : ""}`}
            </span>
          </div>
        </div>

        {/* Card 2: Acumulado do Ano */}
        <div className={`bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-sm ${cardHoverEffect} ${isTableFiltered ? 'opacity-40 grayscale' : ''}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">Acumulado do ano</span>
              <h3 className="text-2xl font-bold text-black dark:text-white">
                {isTableFiltered ? "------" : formatCurrency(totalYearAmount)}
              </h3>
            </div>
            <div className="p-2 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg">
              <TrendingDown size={16} className="text-neutral-500" />
            </div>
          </div>
          <div>
            <span className="inline-block px-2.5 py-1 bg-neutral-100 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 text-[10px] font-semibold rounded-md">
              {isTableFiltered ? "Não aplicável à pesquisa" : `Ano: ${selectedYear}`}
            </span>
          </div>
        </div>

        {/* Card 3: Média de Saídas */}
        <div className={`bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-sm ${cardHoverEffect}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">
                {isTableFiltered ? "Média da pesquisa" : "Média de saídas"}
              </span>
              <h3 className="text-2xl font-bold text-black dark:text-white">{formatCurrency(displayAverage)}</h3>
            </div>
            <div className="p-2 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg">
              <Wallet size={16} className="text-neutral-500" />
            </div>
          </div>
          <div>
            <span className={`inline-block px-2.5 py-1 text-[10px] font-semibold rounded-md transition-colors ${
              isTableFiltered 
                ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400" 
                : "bg-neutral-100 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400"
            }`}>
              {isTableFiltered ? "Custo médio das despesas acima" : "Estimativa mensal"}
            </span>
          </div>
        </div>

        {/* Card 4: Análise Avançada */}
        <div className={`bg-white dark:bg-[#1A1A1A] rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-sm opacity-60 ${cardHoverEffect}`}>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">Análise avançada</span>
              <h3 className="text-2xl font-bold text-neutral-400 dark:text-neutral-500">Em breve</h3>
            </div>
            <div className="p-2 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg">
              <PieChart size={16} className="text-neutral-400 dark:text-neutral-600" />
            </div>
          </div>
          <div>
            <span className="inline-block px-2.5 py-1 bg-transparent text-neutral-400 dark:text-neutral-600 text-[10px] font-semibold rounded-md border border-neutral-200 dark:border-neutral-800">
              Próxima Atualização
            </span>
          </div>
        </div>
      </div>

      {/* BARRA DE FILTROS DA TABELA */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative" ref={statusRef}>
          <button 
            onClick={() => { setIsStatusOpen(!isStatusOpen); setIsTypeOpen(false); }}
            className={`flex items-center justify-between w-full sm:w-44 px-4 py-2.5 bg-white dark:bg-[#1A1A1A] rounded-xl text-sm font-medium transition-colors ${statusFilter !== "Todos os Status" ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20" : "text-neutral-700 dark:text-neutral-300"}`}
          >
            {statusFilter}
            <ChevronDown size={14} className="opacity-50" />
          </button>
          {isStatusOpen && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-[#1A1A1A] rounded-xl shadow-xl z-20 py-1.5 animate-in fade-in zoom-in-95">
              {STATUS_OPTIONS.map((opt) => (
                <button key={opt} onClick={() => { setStatusFilter(opt); setIsStatusOpen(false); }} className={`w-full text-left px-4 py-2 text-sm transition-colors ${statusFilter === opt ? "bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-medium" : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={typeRef}>
          <button 
            onClick={() => { setIsTypeOpen(!isTypeOpen); setIsStatusOpen(false); }}
            className={`flex items-center justify-between w-full sm:w-48 px-4 py-2.5 bg-white dark:bg-[#1A1A1A] rounded-xl text-sm font-medium transition-colors ${typeFilter !== "Todos os Tipos" ? "text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/20" : "text-neutral-700 dark:text-neutral-300"}`}
          >
            {typeFilter}
            <ChevronDown size={14} className="opacity-50" />
          </button>
          {isTypeOpen && (
            <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-[#1A1A1A] rounded-xl shadow-xl z-20 py-1.5 animate-in fade-in zoom-in-95">
              {TYPE_OPTIONS.map((opt) => (
                <button key={opt} onClick={() => { setTypeFilter(opt); setIsTypeOpen(false); }} className={`w-full text-left px-4 py-2 text-sm transition-colors ${typeFilter === opt ? "bg-blue-50 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 font-medium" : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}>
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Procurar despesa específica..." 
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#1A1A1A] rounded-xl text-sm font-medium text-black dark:text-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
          />
        </div>
      </div>

      {/* TABELA E RODAPÉ (COM SCROLL INTERNO DISCRETO) */}
      <div className="space-y-4">
        <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto overflow-y-auto max-h-[520px] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-200 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-width:thin] [scrollbar-color:#d4d4d4_transparent] dark:[scrollbar-color:#262626_transparent]">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-neutral-50 dark:bg-[#222222] sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-neutral-500">Data do Vencimento</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-neutral-500">Categoria</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-neutral-500">Valor</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-neutral-500">Status</th>
                  <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-neutral-500 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <Loader2 className="animate-spin text-neutral-400 mx-auto" size={24} />
                    </td>
                  </tr>
                ) : displayTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-neutral-500">
                      Nenhum lançamento encontrado para este período.
                    </td>
                  </tr>
                ) : (
                  displayTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors group">
                      <td className="px-6 py-4 font-medium text-black dark:text-white">
                        {formatDateBR(tx.date)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-neutral-100 dark:bg-[#222222] rounded-lg">
                            <span className="text-sm">{tx.categories?.icon}</span>
                            <span className="font-medium text-black dark:text-white text-xs">{tx.categories?.name}</span>
                          </div>
                          <span className="px-2 py-1 bg-neutral-100 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400 text-[10px] font-semibold rounded">
                            {tx.categories?.expense_type === "recorrente" ? "Recorrente" : "Variável"}
                          </span>
                        </div>
                      </td>
                      <td className={`px-6 py-4 font-semibold transition-colors ${
                        tx.status === "pago" 
                          ? "line-through text-neutral-400 dark:text-neutral-600" 
                          : "text-black dark:text-white"
                      }`}>
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="w-[85px]">
                          <button 
                            onClick={() => toggleStatus(tx)}
                            className={`inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-md transition-all ${
                              tx.status === "pago" 
                                ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-500 hover:bg-green-100 dark:hover:bg-green-900/40" 
                                : "bg-neutral-100 dark:bg-neutral-800/50 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700"
                            }`}
                          >
                            {tx.status}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right relative">
                        <button 
                          onClick={() => setActiveActionMenu(activeActionMenu === tx.id ? null : tx.id)}
                          className="p-1.5 text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#222222] rounded-lg transition-colors"
                        >
                          <MoreVertical size={18} />
                        </button>

                        {activeActionMenu === tx.id && (
                          <div ref={actionMenuRef} className="absolute right-6 top-1/2 -translate-y-1/2 w-32 bg-white dark:bg-[#1A1A1A] rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95">
                            <button onClick={() => openEditModal(tx)} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#222222] transition-colors">
                              <Edit3 size={15} className="text-neutral-400" /> Editar
                            </button>
                            <button onClick={() => handleDelete(tx)} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 size={15} className="text-red-500" /> Excluir
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rodapé de Status */}
        <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-[#1A1A1A] rounded-xl text-xs font-medium text-neutral-500">
          <div className="flex items-center gap-2">
            <ListFilter size={14} className="text-blue-500" />
            <span>Extrato ativo: <strong className="text-black dark:text-white">{displayTransactions.length}</strong> itens processados</span>
          </div>
          <span>Ano: <strong className="text-black dark:text-white">{selectedYear}</strong></span>
        </div>
      </div>

      {/* MODAL NOVA/EDITAR DESPESA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl w-full max-w-lg shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-500 rounded-xl">
                  <TrendingDown size={20} strokeWidth={2.5} />
                </div>
                <h2 className="text-xl font-bold text-black dark:text-white tracking-tight">
                  {editingTransactionId ? "Editar Despesa" : "Nova Despesa"}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#222222] rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-6 pt-0 space-y-6">
              <div className="relative" ref={categoryDropdownRef}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Categoria</label>
                <button type="button" onClick={() => setIsCategoryDropdownOpen(!isCategoryDropdownOpen)} className="w-full flex items-center justify-between px-4 py-3.5 bg-neutral-50 dark:bg-[#222222] rounded-xl text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/20">
                  {selectedCategory ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{selectedCategory.icon}</span>
                      <span className="font-medium text-black dark:text-white">{selectedCategory.name}</span>
                    </div>
                  ) : <span className="text-neutral-400 font-medium">Selecione uma categoria...</span>}
                  <ChevronDown size={18} className={`text-neutral-400 transition-transform duration-200 ${isCategoryDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isCategoryDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1A1A1A] rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 border-b border-neutral-100 dark:border-neutral-800">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                        <input type="text" placeholder="Buscar categoria..." value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-neutral-50 dark:bg-[#222222] rounded-lg text-sm text-black dark:text-white focus:outline-none"/>
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto p-1">
                      {filteredCategories.length > 0 ? filteredCategories.map((cat) => (
                        <button 
                          key={cat.id} 
                          type="button" 
                          onClick={() => { 
                            setSelectedCategory(cat); 
                            setIsCategoryDropdownOpen(false); 
                            setSearchCategory(""); 

                            if (cat.due_date) {
                              const y = selectedYear !== "Todos os Anos" ? selectedYear : new Date().getFullYear();
                              const m = selectedMonth !== "Todos os Meses" ? MONTH_MAP[selectedMonth] : String(new Date().getMonth() + 1).padStart(2, '0');
                              const d = String(cat.due_date).padStart(2, '0');
                              setDate(`${y}-${m}-${d}`);
                            }
                          }} 
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${selectedCategory?.id === cat.id ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-medium" : "text-black dark:text-white hover:bg-neutral-100 dark:hover:bg-[#222222]"}`}
                        >
                          <span className="text-lg">{cat.icon}</span>{cat.name}
                        </button>
                      )) : <div className="px-4 py-6 text-center text-sm text-neutral-500">Nenhuma categoria encontrada.</div>}
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Valor (R$)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-medium">R$</span>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      max="9999999" 
                      placeholder="0,00" 
                      value={amount} 
                      onChange={(e) => { 
                        if (e.target.value.length <= 10) setAmount(e.target.value); 
                      }} 
                      required 
                      className="w-full pl-11 pr-4 py-3.5 bg-neutral-50 dark:bg-[#222222] rounded-xl text-base font-semibold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-shadow"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Data do Vencimento</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      min="2000-01-01" 
                      max="2099-12-31" 
                      value={date} 
                      onChange={(e) => setDate(e.target.value)} 
                      required 
                      disabled={!!selectedCategory?.due_date}
                      className={`w-full px-4 py-3.5 bg-neutral-50 dark:bg-[#222222] rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-shadow [&::-webkit-calendar-picker-indicator]:dark:invert [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100 ${selectedCategory?.due_date ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 px-4 bg-transparent text-neutral-700 dark:text-neutral-300 rounded-xl font-semibold text-sm hover:bg-neutral-100 dark:hover:bg-[#222222] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving || !selectedCategory || !amount || !date} className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition-colors shadow-sm shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center">
                  {isSaving ? <Loader2 size={20} className="animate-spin" /> : (editingTransactionId ? "Salvar Alterações" : "Salvar Despesa")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}