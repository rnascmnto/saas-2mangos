"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
  TrendingUp, Calendar, ChevronDown, Plus, ArrowRight, 
  DollarSign, PieChart, Target, X, Loader2, History, Search, MoreVertical, Edit3, Trash2
} from "lucide-react";

interface Income {
  id: string;
  name: string;
  amount: number;
  date: string;
  status: string;
  created_at: string;
}

const MONTHS = [
  "Todos os Meses", "Janeiro", "Fevereiro", "Março", "Abril", 
  "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", 
  "Novembro", "Dezembro"
];

// Mapeamento de texto para número do mês
const MONTH_MAP: { [key: string]: string } = {
  "Janeiro": "01", "Fevereiro": "02", "Março": "03", "Abril": "04",
  "Maio": "05", "Junho": "06", "Julho": "07", "Agosto": "08",
  "Setembro": "09", "Outubro": "10", "Novembro": "11", "Dezembro": "12"
};

export default function ReceitasPage() {
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

  // Filtros da Tabela
  const [tableSearch, setTableSearch] = useState("");

  // Estados dos Dados
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Estados de Sugestão (Autocompletar inteligente)
  const [recentNames, setRecentNames] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const nameInputRef = useRef<HTMLDivElement>(null);

  // Dropdown de Ações da Tabela
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Fecha dropdowns e popovers ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (monthRef.current && !monthRef.current.contains(event.target as Node)) setIsMonthOpen(false);
      if (yearRef.current && !yearRef.current.contains(event.target as Node)) setIsYearOpen(false);
      if (nameInputRef.current && !nameInputRef.current.contains(event.target as Node)) setShowSuggestions(false);
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) setActiveActionMenu(null);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchIncomes();
  }, []);

  async function fetchIncomes() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("incomes")
      .select("*")
      .eq("user_id", session.user.id)
      // Ordem crescente (do dia 01 ao dia 31 cronologicamente)
      .order("date", { ascending: true })
      .order("created_at", { ascending: true }); 

    if (data) {
      setIncomes(data as Income[]);
      
      // Pega as receitas recém-criadas para montar a lista de sugestão
      const sortedByCreated = [...data].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const uniqueRecentNames = Array.from(new Set(sortedByCreated.map(item => item.name))).slice(0, 5);
      setRecentNames(uniqueRecentNames);
    }
    setLoading(false);
  }

  function openNewModal() {
    setEditingIncomeId(null);
    setName("");
    setAmount("");
    setDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  }

  function openEditModal(inc: Income) {
    setEditingIncomeId(inc.id);
    setName(inc.name);
    setAmount(inc.amount.toString());
    setDate(inc.date);
    setIsModalOpen(true);
    setActiveActionMenu(null);
  }

  async function handleSaveIncome(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !amount || !date) return;

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const payload = {
        user_id: session.user.id,
        name: name.trim(),
        amount: parseFloat(amount),
        date: date,
      };

      if (editingIncomeId) {
        const { error } = await supabase.from("incomes").update(payload).eq("id", editingIncomeId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("incomes").insert([{ ...payload, status: "recebido" }]);
        if (error) throw error;
      }
      
      await fetchIncomes(); // Atualiza a tabela
      setIsModalOpen(false);
    } catch (error) {
      alert("Erro ao salvar receita.");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta receita?")) return;
    try {
      await supabase.from("incomes").delete().eq("id", id);
      setIncomes(incomes.filter(inc => inc.id !== id));
      setActiveActionMenu(null);
    } catch (error) {
      alert("Erro ao excluir.");
    }
  }

  // --- LÓGICA DE ANOS DINÂMICOS ---
  const currentYear = new Date().getFullYear().toString();
  const availableYears = Array.from(new Set(incomes.map(inc => inc.date.split("-")[0])));
  
  if (!availableYears.includes(currentYear)) {
    availableYears.push(currentYear);
  }
  availableYears.sort((a, b) => Number(b) - Number(a));
  const dynamicYears = ["Todos os Anos", ...availableYears];

  // --- LÓGICA DE FILTRAGEM ---
  const isTableFiltered = tableSearch.trim() !== "";

  const filteredIncomes = incomes.filter(inc => {
    // Filtro Macro (Mês/Ano)
    const [incYear, incMonth] = inc.date.split("-");
    const matchesYear = selectedYear === "Todos os Anos" || incYear === selectedYear;
    const matchesMonth = selectedMonth === "Todos os Meses" || incMonth === MONTH_MAP[selectedMonth];

    // Filtro de Pesquisa
    const matchesSearch = tableSearch === "" || 
      inc.name.toLowerCase().includes(tableSearch.toLowerCase());

    return matchesYear && matchesMonth && matchesSearch;
  });

  const incomesForYear = incomes.filter(inc => {
    const [incYear] = inc.date.split("-");
    return selectedYear === "Todos os Anos" || incYear === selectedYear;
  });

  // --- CÁLCULO DOS CARDS ---
  const totalPeriodAmount = filteredIncomes.reduce((acc, inc) => acc + Number(inc.amount), 0);
  const totalYearAmount = incomesForYear.reduce((acc, inc) => acc + Number(inc.amount), 0);
  const averageMonthlyAmount = totalYearAmount / 12;

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDateBR = (dateStr: string) => dateStr.split('-').reverse().join('/');

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-10">
      
      {/* CABEÇALHO E FILTROS MACRO */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-black dark:text-white tracking-tight">Receitas</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 flex items-center gap-1.5">
            <TrendingUp size={16} className="text-emerald-500" /> Gerencie e rastreie o fluxo de entrada financeira
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center h-12 bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 shadow-sm text-sm font-medium w-full sm:w-auto relative">
            <div className="flex items-center gap-2 mr-4">
              <Calendar size={16} className="text-emerald-500 dark:text-emerald-400" />
              <span className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Período</span>
            </div>
            <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mr-4" />
            
            {/* Dropdown Mês */}
            <div className="relative mr-4" ref={monthRef}>
              <button onClick={() => { setIsMonthOpen(!isMonthOpen); setIsYearOpen(false); }} className="flex items-center gap-2 text-black dark:text-white hover:opacity-80 transition-opacity min-w-[100px] justify-between">
                {selectedMonth} <ChevronDown size={14} className="text-neutral-500" />
              </button>
              {isMonthOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 max-h-64 overflow-y-auto bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2">
                  {MONTHS.map((month) => (
                    <button key={month} onClick={() => { setSelectedMonth(month); setIsMonthOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                      {month}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mr-4" />
            
            {/* Dropdown Ano Dinâmico */}
            <div className="relative" ref={yearRef}>
              <button onClick={() => { setIsYearOpen(!isYearOpen); setIsMonthOpen(false); }} className="flex items-center gap-2 text-black dark:text-white hover:opacity-80 transition-opacity min-w-[70px] justify-between">
                {selectedYear} <ChevronDown size={14} className="text-neutral-500" />
              </button>
              {isYearOpen && (
                <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2">
                  {dynamicYears.map((year) => (
                    <button key={year} onClick={() => { setSelectedYear(year); setIsYearOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button onClick={openNewModal} className="flex items-center justify-center gap-2 h-12 px-6 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors shadow-sm w-full sm:w-auto whitespace-nowrap group">
            <Plus size={18} /> Nova Receita <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

      {/* 4 CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Recebido */}
        <div className="bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">Total Recebido</span>
              <h3 className="text-2xl font-bold text-black dark:text-white">{formatCurrency(totalPeriodAmount)}</h3>
            </div>
            <div className="p-2 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <DollarSign size={16} className="text-emerald-500 dark:text-emerald-400" />
            </div>
          </div>
          <div>
            <span className={`inline-block px-2.5 py-1 text-[10px] font-semibold rounded-md border transition-colors ${
              isTableFiltered 
                ? "bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900/50" 
                : "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-500 border-emerald-100 dark:border-emerald-900/50"
            }`}>
              {isTableFiltered ? "Filtrado" : `${selectedMonth}${selectedYear !== "Todos os Anos" ? ` / ${selectedYear}` : ""}`}
            </span>
          </div>
        </div>

        {/* Card 2: Acumulado do Ano */}
        <div className="bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">Acumulado do ano</span>
              <h3 className="text-2xl font-bold text-black dark:text-white">{formatCurrency(totalYearAmount)}</h3>
            </div>
            <div className="p-2 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <TrendingUp size={16} className="text-neutral-500" />
            </div>
          </div>
          <div>
            <span className="inline-block px-2.5 py-1 bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 text-[10px] font-semibold rounded-md border border-neutral-200 dark:border-neutral-800">
              Ano: {selectedYear}
            </span>
          </div>
        </div>

        {/* Card 3: Média de Entradas */}
        <div className="bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">Média de entradas</span>
              <h3 className="text-2xl font-bold text-black dark:text-white">{formatCurrency(averageMonthlyAmount)}</h3>
            </div>
            <div className="p-2 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
              <Target size={16} className="text-neutral-500" />
            </div>
          </div>
          <div>
            <span className="inline-block px-2.5 py-1 bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 text-[10px] font-semibold rounded-md border border-neutral-200 dark:border-neutral-800">
              Estimativa mensal
            </span>
          </div>
        </div>

        {/* Card 4: Análise Avançada (Em breve) */}
        <div className="bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-2xl p-5 flex flex-col justify-between min-h-[140px] shadow-sm opacity-60 transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">Análise avançada</span>
              <h3 className="text-2xl font-bold text-neutral-400 dark:text-neutral-500">Em breve</h3>
            </div>
            <div className="p-2 bg-neutral-100 dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
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

      {/* BARRA DE PESQUISA */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input 
            type="text" 
            placeholder="Procurar receita específica..." 
            value={tableSearch}
            onChange={(e) => setTableSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-medium text-black dark:text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* TABELA DE RECEITAS */}
      <div className="bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm">
        <div className="overflow-x-auto lg:overflow-visible max-lg:pb-32">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-neutral-50 dark:bg-neutral-900/50 border-b border-neutral-200 dark:border-neutral-800">
              <tr>
                <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-neutral-500 rounded-tl-2xl">Data do Lançamento</th>
                <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-neutral-500">Descrição</th>
                <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-neutral-500">Valor</th>
                <th className="px-6 py-4 font-semibold text-[11px] uppercase tracking-wider text-neutral-500 text-right rounded-tr-2xl">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/50">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin text-neutral-400 mx-auto" size={24} />
                  </td>
                </tr>
              ) : filteredIncomes.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-neutral-500">
                    Nenhuma receita encontrada para este período.
                  </td>
                </tr>
              ) : (
                filteredIncomes.map((inc) => (
                  <tr key={inc.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors group">
                    <td className="px-6 py-4 font-medium text-black dark:text-white">
                      {formatDateBR(inc.date)}
                    </td>
                    <td className="px-6 py-4">
                      {/* Descrição em formato de selo (badge) */}
                      <div className="inline-flex items-center px-2.5 py-1.5 bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg">
                        <span className="font-medium text-black dark:text-white text-xs">{inc.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-emerald-600 dark:text-emerald-500">
                      {formatCurrency(inc.amount)}
                    </td>
                    <td className="px-6 py-4 text-right relative">
                      <button 
                        onClick={() => setActiveActionMenu(activeActionMenu === inc.id ? null : inc.id)}
                        className="p-1.5 text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-lg transition-colors"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {/* Dropdown de Ações */}
                      {activeActionMenu === inc.id && (
                        <div ref={actionMenuRef} className="absolute right-12 top-1/2 -translate-y-1/2 w-32 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in zoom-in-95">
                          <button onClick={() => openEditModal(inc)} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                            <Edit3 size={15} className="text-neutral-400" /> Editar
                          </button>
                          <button onClick={() => handleDelete(inc.id)} className="w-full flex items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
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

      {/* MODAL NOVA/EDITAR RECEITA */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-neutral-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-500 rounded-xl border border-emerald-100 dark:border-emerald-900/50 shadow-sm">
                  <TrendingUp size={20} strokeWidth={2.5} />
                </div>
                <h2 className="text-xl font-bold text-black dark:text-white tracking-tight">
                  {editingIncomeId ? "Editar Receita" : "Nova Receita"}
                </h2>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveIncome} className="p-6 space-y-6">
              
              {/* CAMPO DE NOME COM SUGESTÕES */}
              <div className="relative" ref={nameInputRef}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Descrição (Nome)</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Ex: Salário, Freelance, Rendimentos..." 
                  required 
                  className="w-full px-4 py-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-shadow"
                />
                
                {/* Popover de Sugestões */}
                {showSuggestions && recentNames.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2">
                    <div className="px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                      <History size={12} /> Últimas Utilizadas
                    </div>
                    {recentNames.map((rn) => (
                      <button 
                        key={rn} 
                        type="button" 
                        onClick={() => { 
                          setName(rn); 
                          setShowSuggestions(false); 
                        }} 
                        className="w-full text-left px-4 py-2.5 text-sm transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      >
                        {rn}
                      </button>
                    ))}
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
                      className="w-full pl-11 pr-4 py-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-xl text-base font-semibold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-shadow"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Data do Lançamento</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      min="2000-01-01" 
                      max="2099-12-31" 
                      value={date} 
                      onChange={(e) => setDate(e.target.value)} 
                      required 
                      className="w-full px-4 py-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-shadow [&::-webkit-calendar-picker-indicator]:dark:invert [&::-webkit-calendar-picker-indicator]:opacity-50 hover:[&::-webkit-calendar-picker-indicator]:opacity-100"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 px-4 bg-white dark:bg-transparent border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-semibold text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={isSaving || !name.trim() || !amount || !date} className="flex-1 py-3 px-4 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors shadow-sm shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center">
                  {isSaving ? <Loader2 size={20} className="animate-spin" /> : (editingIncomeId ? "Salvar Alterações" : "Salvar Receita")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}