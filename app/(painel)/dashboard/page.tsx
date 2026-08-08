"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Calendar, ChevronDown, TrendingUp, TrendingDown, 
  Wallet, CalendarClock, Loader2, AlertCircle, Target
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { getCompetencia, competenciaMonthStr, competenciaYearStr } from "@/lib/fatura";

// Interfaces
interface Category {
  id: string;
  name: string;
  icon: string;
  expense_type: string;
  budget?: number; 
  is_credit_card?: boolean | null;
  closing_date?: number | null;
  due_date?: number | null;
}

interface Transaction {
  id: string;
  amount: number;
  date: string;
  status: "pendente" | "pago";
  categories: Category;
}

interface Income {
  id: string;
  name: string;
  amount: number;
  date: string;
  status: string;
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

const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export default function DashboardPage() {
  // Inicialização dinâmica baseada na data atual do sistema
  const currentDate = new Date();
  const currentMonthName = MONTHS[currentDate.getMonth() + 1]; // Pula o "Todos os Meses"
  const currentYearStr = currentDate.getFullYear().toString();

  // Filtros de Período
  const [selectedMonth, setSelectedMonth] = useState(currentMonthName);
  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);
  
  // Filtros dos Gráficos
  const [chartView, setChartView] = useState<"tudo" | "receitas" | "despesas">("tudo");
  const [selectedEvolutionCategory, setSelectedEvolutionCategory] = useState<string>("");
  const [isEvolutionDropdownOpen, setIsEvolutionDropdownOpen] = useState(false);
  
  const monthRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);
  const evolutionDropdownRef = useRef<HTMLDivElement>(null);

  // Estados dos Dados
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [userName, setUserName] = useState<string>("Usuário");
  const [loading, setLoading] = useState(true);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (monthRef.current && !monthRef.current.contains(event.target as Node)) setIsMonthOpen(false);
      if (yearRef.current && !yearRef.current.contains(event.target as Node)) setIsYearOpen(false);
      if (evolutionDropdownRef.current && !evolutionDropdownRef.current.contains(event.target as Node)) setIsEvolutionDropdownOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    // BUSCA O PERFIL PARA PEGAR O NOME
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, username")
      .eq("id", session.user.id)
      .single();

    if (profileData) {
      const nameToUse = profileData.full_name || profileData.username || "Usuário";
      const firstName = nameToUse.trim().split(" ")[0]; 
      setUserName(firstName);
    }

    // CONSULTA: Puxando as transações
    const { data: transData, error: transError } = await supabase
      .from("transactions")
      .select(`id, amount, date, status, categories (id, name, icon, expense_type, budget, is_credit_card, closing_date, due_date)`)
      .eq("user_id", session.user.id);

    if (transError) {
      console.error("Erro ao buscar transações:", transError);
    }

    const { data: incData } = await supabase
      .from("incomes")
      .select("*")
      .eq("user_id", session.user.id);

    if (transData) {
      setTransactions(transData as unknown as Transaction[]);
    }
    if (incData) setIncomes(incData as Income[]);
    
    setLoading(false);
  }

  // --- LÓGICA DE ANOS DINÂMICOS CORRIGIDA ---
  const incomeYears = incomes.filter(inc => inc.date).map(inc => inc.date.split("-")[0]);
  const transactionYears = transactions.filter(tx => tx.date).map(tx => tx.date.split("-")[0]);
  
  const availableYears = Array.from(new Set([...incomeYears, ...transactionYears]));
  if (!availableYears.includes(currentYearStr)) {
    availableYears.push(currentYearStr);
  }
  availableYears.sort((a, b) => Number(b) - Number(a));
  const dynamicYears = ["Todos os Anos", ...availableYears];

  // --- LÓGICA DE FILTRAGEM ---
  const filteredIncomes = incomes.filter(inc => {
    const [incYear, incMonth] = inc.date.split("-");
    const matchesYear = selectedYear === "Todos os Anos" || incYear === selectedYear;
    const matchesMonth = selectedMonth === "Todos os Meses" || incMonth === MONTH_MAP[selectedMonth];
    return matchesYear && matchesMonth;
  });

  const filteredTransactions = transactions.filter(tx => {
    const competencia = getCompetencia(tx.date, tx.categories);
    const matchesYear = selectedYear === "Todos os Anos" || competenciaYearStr(competencia) === selectedYear;
    const matchesMonth = selectedMonth === "Todos os Meses" || competenciaMonthStr(competencia) === MONTH_MAP[selectedMonth];
    return matchesYear && matchesMonth;
  });

  const totalIncome = filteredIncomes.reduce((acc, inc) => acc + Number(inc.amount), 0);
  const totalExpense = filteredTransactions.reduce((acc, tx) => acc + Number(tx.amount), 0);
  const balance = totalIncome - totalExpense;

  // --- LÓGICA DO PRÓXIMO VENCIMENTO INTELIGENTE (LIMITADO AO PERÍODO SELECIONADO) ---
  const getNextDueItem = () => {
    // Utiliza as transações já filtradas pelo mês/ano selecionado no topo da Dashboard
    const pendingInPeriod = filteredTransactions.filter(tx => tx.status === "pendente");

    // 1. Mapeia despesas normais pendentes no período
    const normalItems = pendingInPeriod
      .filter(tx => !tx.categories?.is_credit_card)
      .map(tx => ({
        name: tx.categories?.name || "Despesa",
        amount: Number(tx.amount),
        date: tx.date
      }));

    // 2. Agrupa faturas de cartão de crédito pendentes por competência/cartão no período
    const cardMap: Record<string, { name: string, amount: number, date: string }> = {};

    pendingInPeriod
      .filter(tx => tx.categories?.is_credit_card)
      .forEach(tx => {
        const comp = getCompetencia(tx.date, tx.categories);
        const cardId = tx.categories.id;
        const key = `${cardId}_${comp.year}_${comp.month}`;

        if (!cardMap[key]) {
          const dueDay = tx.categories.due_date ? String(tx.categories.due_date).padStart(2, '0') : "10";
          const compMonthStr = String(comp.month + 1).padStart(2, '0');
          const dueDateStr = `${comp.year}-${compMonthStr}-${dueDay}`;

          cardMap[key] = {
            name: `${tx.categories.name}`,
            amount: 0,
            date: dueDateStr
          };
        }
        cardMap[key].amount += Number(tx.amount);
      });

    const cardItems = Object.values(cardMap);

    // Junta tudo e ordena pela data mais próxima dentro do mês selecionado
    const allUpcoming = [...normalItems, ...cardItems].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return allUpcoming[0] || null;
  };

  const nextDueItem = getNextDueItem();

  // --- LÓGICA GRÁFICO 1: FLUXO DE CAIXA (12 Meses) ---
  const getChartData = () => {
    let endMonth = new Date().getMonth(); 
    let endYear = new Date().getFullYear();
    if (selectedMonth !== "Todos os Meses") endMonth = parseInt(MONTH_MAP[selectedMonth]) - 1;
    if (selectedYear !== "Todos os Anos") endYear = parseInt(selectedYear);

    const data = [];
    for (let i = 11; i >= 0; i--) {
      let d = new Date(endYear, endMonth - i, 1);
      let y = d.getFullYear();
      let m = String(d.getMonth() + 1).padStart(2, '0');
      
      let incSum = incomes.filter(inc => inc.date.startsWith(`${y}-${m}`)).reduce((acc, curr) => acc + Number(curr.amount), 0);
      let expSum = transactions.filter(tx => {
        const c = getCompetencia(tx.date, tx.categories);
        return c.year === y && competenciaMonthStr(c) === m;
      }).reduce((acc, curr) => acc + Number(curr.amount), 0);
      data.push({ name: SHORT_MONTHS[d.getMonth()], receitas: incSum, despesas: expSum });
    }
    return data;
  };
  const chartData = getChartData();

  // --- LÓGICA GRÁFICO 2: PERFIL DO MÊS ---
  const fixedExpenses = filteredTransactions.filter(tx => tx.categories?.expense_type === "recorrente").reduce((acc, curr) => acc + Number(curr.amount), 0);
  const variableExpenses = filteredTransactions.filter(tx => tx.categories?.expense_type === "variavel").reduce((acc, curr) => acc + Number(curr.amount), 0);
  const pieData = [
    { name: "Fixo", value: fixedExpenses, color: "#2563EB" }, // Hex do blue-600 
    { name: "Variável", value: variableExpenses, color: "#F43F5E" } 
  ];

  // --- LÓGICA GRÁFICO 3: ORIGEM RECEITAS ---
  const incomeSources = filteredIncomes.reduce((acc: { [key: string]: number }, curr) => {
    acc[curr.name] = (acc[curr.name] || 0) + Number(curr.amount);
    return acc;
  }, {});
  const sortedIncomeSources = Object.entries(incomeSources).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);

  // --- LÓGICA GRÁFICO 4: TOP CATEGORIAS ---
  const categoryTotals = filteredTransactions.reduce((acc: { [key: string]: number }, tx) => {
    const catName = tx.categories?.name || "Outros";
    acc[catName] = (acc[catName] || 0) + Number(tx.amount);
    return acc;
  }, {});
  
  const sortedCategories = Object.entries(categoryTotals).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  const maxCategoryAmount = sortedCategories.length > 0 ? sortedCategories[0].amount : 1;
  const top5Categories = sortedCategories.slice(0, 5);

  // --- LÓGICA GRÁFICO 4B: METAS DO MÊS ---
  const categoryGoals = transactions.reduce((acc: Record<string, number>, tx) => {
    const catName = tx.categories?.name;
    const catGoal = tx.categories?.budget || 0;
    if (catName && catGoal > 0) {
      acc[catName] = catGoal;
    }
    return acc;
  }, {});

  const goalsData = Object.entries(categoryGoals).map(([name, goal]) => {
    const amount = categoryTotals[name] || 0;
    return { name, goal, amount };
  })
  .filter(item => item.amount > 0)
  .sort((a, b) => (b.amount / b.goal) - (a.amount / a.goal));

  // --- LÓGICA GRÁFICO 5: EVOLUÇÃO DE CONTAS ---
  // CORREÇÃO: Pegar as categorias APENAS dos lançamentos do mês selecionado
  const allCategoryNames = Array.from(new Set(filteredTransactions.map(tx => tx.categories?.name).filter(Boolean)));

  // EFEITO: Ajusta a categoria selecionada caso o usuário mude de mês e a categoria anterior suma
  useEffect(() => {
    if (allCategoryNames.length > 0 && (!selectedEvolutionCategory || !allCategoryNames.includes(selectedEvolutionCategory))) {
      setSelectedEvolutionCategory(allCategoryNames[0]);
    } else if (allCategoryNames.length === 0 && selectedEvolutionCategory !== "") {
      setSelectedEvolutionCategory("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear, filteredTransactions.length]);

  const getEvolutionData = () => {
    let endMonth = new Date().getMonth(); 
    let endYear = new Date().getFullYear();
    if (selectedMonth !== "Todos os Meses") endMonth = parseInt(MONTH_MAP[selectedMonth]) - 1;
    if (selectedYear !== "Todos os Anos") endYear = parseInt(selectedYear);

    const data = [];
    for (let i = 11; i >= 0; i--) {
      let d = new Date(endYear, endMonth - i, 1);
      let y = d.getFullYear();
      let m = String(d.getMonth() + 1).padStart(2, '0');
      
      let sum = transactions
        .filter(tx => {
          const c = getCompetencia(tx.date, tx.categories);
          return c.year === y && competenciaMonthStr(c) === m && tx.categories?.name === selectedEvolutionCategory;
        })
        .reduce((acc, curr) => acc + Number(curr.amount), 0);
        
      data.push({ name: SHORT_MONTHS[d.getMonth()], valor: sum });
    }
    return data;
  };
  const evolutionData = getEvolutionData();

  // --- FORMATADORES ---
  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1A1A1A] border border-neutral-800 p-4 rounded-xl shadow-xl z-50">
          <p className="text-sm font-bold text-white mb-2 uppercase tracking-widest">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm mt-1">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.stroke }} />
              <span className="text-neutral-400 capitalize">{entry.name}:</span>
              <span className="font-semibold text-white">{formatCurrency(entry.value)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Efeito de hover atualizado para sem bordas: usa sombra e leve alteração de cor no dark mode
  const cardHoverEffect = "transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:bg-[#202020]";

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* CABEÇALHO E FILTROS */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-black dark:text-white tracking-tight">Visão Geral</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5">
            Bem-vindo(a) de volta, <span className="font-semibold text-black dark:text-white">{userName}</span>.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center h-12 bg-white dark:bg-[#1A1A1A] rounded-xl px-4 shadow-sm text-sm font-medium w-full sm:w-auto relative">
            <div className="flex items-center gap-2 mr-4">
              <Calendar size={16} className="text-blue-500 dark:text-blue-400" />
              <span className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Período</span>
            </div>
            <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mr-4" />
            
            <div className="relative mr-4" ref={monthRef}>
              <button onClick={() => { setIsMonthOpen(!isMonthOpen); setIsYearOpen(false); }} className="flex items-center gap-2 text-black dark:text-white hover:opacity-80 transition-opacity min-w-[100px] justify-between">
                {selectedMonth} <ChevronDown size={14} className="text-neutral-500" />
              </button>
              {isMonthOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 max-h-64 overflow-y-auto bg-white dark:bg-[#1A1A1A] rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2">
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
                <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-[#1A1A1A] rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2">
                  {dynamicYears.map((year) => (
                    <button key={year} onClick={() => { setSelectedYear(year); setIsYearOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800">
                      {year}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-neutral-400" size={32} />
        </div>
      ) : (
        <>
          {/* LINHA 1: 4 CARDS RESUMO */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={`bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 shadow-sm relative overflow-hidden flex flex-col justify-center gap-3 ${cardHoverEffect}`}>
              <div className={`absolute top-0 left-0 w-full h-1 ${balance >= 0 ? "bg-emerald-500" : "bg-red-500"}`} />
              <div className="flex items-start justify-between w-full">
                <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase mt-1">Saldo do mês</span>
                <div className="p-2 bg-neutral-100 dark:bg-neutral-800/50 rounded-lg">
                  <Wallet size={16} className="text-neutral-500" />
                </div>
              </div>
              <h3 className={`text-2xl font-bold ${balance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-500"}`}>
                {formatCurrency(balance)}
              </h3>
            </div>

            <div className={`bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 shadow-sm flex flex-col justify-center gap-3 ${cardHoverEffect}`}>
              <div className="flex items-start justify-between w-full">
                <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase mt-1">Total Receitas</span>
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                  <TrendingUp size={16} className="text-emerald-500" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-black dark:text-white">
                {formatCurrency(totalIncome)}
              </h3>
            </div>

            <div className={`bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 shadow-sm flex flex-col justify-center gap-3 ${cardHoverEffect}`}>
              <div className="flex items-start justify-between w-full">
                <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase mt-1">Total Despesas</span>
                <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <TrendingDown size={16} className="text-red-500" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-black dark:text-white">
                {formatCurrency(totalExpense)}
              </h3>
            </div>

            <div className={`bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 shadow-sm flex flex-col justify-center gap-3 ${cardHoverEffect}`}>
              <div className="flex items-start justify-between w-full">
                <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase mt-1">Próximo Vencimento</span>
                <div className="p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <CalendarClock size={16} className="text-orange-500" />
                </div>
              </div>
              {nextDueItem ? (
                <div className="flex flex-col">
                  <h3 className="text-2xl font-bold text-black dark:text-white leading-none">
                    {formatCurrency(nextDueItem.amount)}
                  </h3>
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mt-1.5 truncate">
                    {nextDueItem.name}
                  </p>
                </div>
              ) : (
                <h3 className="text-lg font-semibold text-neutral-400 dark:text-neutral-500">
                  Sem pendências
                </h3>
              )}
            </div>
          </div>

          {/* LINHA 2: GRÁFICOS PRINCIPAIS */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-8">
            {/* Fluxo de Caixa */}
            <div className={`lg:col-span-2 bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 shadow-sm flex flex-col ${cardHoverEffect}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-lg font-bold text-black dark:text-white">Fluxo de Caixa Mensal</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Entradas vs Saídas</p>
                </div>
                <div className="flex items-center p-1 bg-neutral-100 dark:bg-[#222222] rounded-lg">
                  <button onClick={() => setChartView("tudo")} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${chartView === "tudo" ? "bg-white dark:bg-neutral-700 text-black dark:text-white shadow-sm" : "text-neutral-500 hover:text-black dark:hover:text-white"}`}>Tudo</button>
                  <button onClick={() => setChartView("receitas")} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${chartView === "receitas" ? "bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-neutral-500 hover:text-black dark:hover:text-white"}`}>Receitas</button>
                  <button onClick={() => setChartView("despesas")} className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${chartView === "despesas" ? "bg-white dark:bg-neutral-700 text-red-600 dark:text-red-400 shadow-sm" : "text-neutral-500 hover:text-black dark:hover:text-white"}`}>Despesas</button>
                </div>
              </div>
              <div className="h-[220px] 2xl:h-[280px] w-full mt-2 transition-all">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorReceitas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorDespesas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.3} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12 }} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value} />
                    <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#333', strokeWidth: 1, strokeDasharray: '4 4' }} />
                    {(chartView === "tudo" || chartView === "receitas") && <Area type="monotone" dataKey="receitas" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorReceitas)" name="Receitas" activeDot={{ r: 6, fill: "#10B981", stroke: "#151515", strokeWidth: 2 }} />}
                    {(chartView === "tudo" || chartView === "despesas") && <Area type="monotone" dataKey="despesas" stroke="#EF4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorDespesas)" name="Despesas" activeDot={{ r: 6, fill: "#EF4444", stroke: "#151515", strokeWidth: 2 }} />}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Perfil do Mês */}
            <div className={`lg:col-span-1 bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 shadow-sm flex flex-col justify-between ${cardHoverEffect}`}>
              <div>
                <h2 className="text-lg font-bold text-black dark:text-white">Perfil do Mês</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Recorrentes vs Variáveis</p>
              </div>
              <div className="h-[140px] 2xl:h-[180px] w-full relative mt-4 transition-all">
                {totalExpense > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} innerRadius="70%" outerRadius="100%" paddingAngle={5} dataKey="value" stroke="none">
                          {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-1">
                      <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">Total</span>
                      <span className="text-sm font-bold text-black dark:text-white">{formatCurrency(totalExpense)}</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                    <AlertCircle size={24} className="mb-2 opacity-50" />
                    <span className="text-xs">Sem despesas no mês.</span>
                  </div>
                )}
              </div>
              <div className="space-y-2 mt-4 2xl:mt-6">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-2.5 bg-neutral-50 dark:bg-[#222222] rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[11px] font-bold text-black dark:text-white uppercase tracking-wider">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold text-black dark:text-white">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Origem Receitas */}
            <div className={`lg:col-span-1 bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 shadow-sm flex flex-col ${cardHoverEffect}`}>
              <div>
                <h2 className="text-lg font-bold text-black dark:text-white">Origem Receitas</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Principais entradas</p>
              </div>
              {sortedIncomeSources.length > 0 ? (
                <div className="mt-6 2xl:mt-8 space-y-2.5 flex-1 overflow-y-auto pr-1">
                  {sortedIncomeSources.slice(0, 5).map((source, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-[#222222] rounded-xl">
                      <span className="text-xs font-bold text-black dark:text-white truncate pr-2">{source.name}</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-500 whitespace-nowrap">{formatCurrency(source.amount)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-neutral-500 min-h-[150px] mt-4">
                  <AlertCircle size={24} className="mb-2 opacity-50" />
                  <span className="text-xs">Nenhuma receita.</span>
                </div>
              )}
            </div>
          </div>

          {/* LINHA 3: NOVOS GRÁFICOS (Detalhes) */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-8">
            
            {/* Top Categorias */}
            <div className={`lg:col-span-1 bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 shadow-sm flex flex-col ${cardHoverEffect}`}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-black dark:text-white">Top Categorias</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Onde gastou mais</p>
                </div>
                <div className="p-1.5 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <TrendingDown size={14} className="text-red-500" />
                </div>
              </div>
              
              <div className="space-y-5 2xl:space-y-6 flex-1 pt-2">
                {top5Categories.length > 0 ? (
                  top5Categories.map((cat, index) => {
                    const percentage = (cat.amount / maxCategoryAmount) * 100;
                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-black dark:text-white truncate pr-2">{cat.name}</span>
                          <span className="text-neutral-900 dark:text-white whitespace-nowrap">{formatCurrency(cat.amount)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-neutral-100 dark:bg-[#2A2A2A] rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-600 rounded-full transition-all duration-1000"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                    <span className="text-xs">Sem gastos registrados.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Metas do Mês */}
            <div className={`lg:col-span-1 bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 shadow-sm flex flex-col ${cardHoverEffect}`}>
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-black dark:text-white">Metas do Mês</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Orçamento vs Realizado</p>
                </div>
                <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Target size={14} className="text-blue-500" />
                </div>
              </div>
              
              <div className="space-y-5 2xl:space-y-6 flex-1 pt-2">
                {goalsData.length > 0 ? (
                  goalsData.slice(0, 5).map((cat, index) => {
                    const percentage = (cat.amount / cat.goal) * 100;
                    const isOverBudget = cat.amount > cat.goal;
                    const barWidth = Math.min(percentage, 100); 
                    
                    const dotColorClass = "bg-neutral-500";
                    const barColorClass = isOverBudget ? "bg-rose-500" : "bg-emerald-500";
                    const textColorClass = isOverBudget ? "text-rose-500" : "text-emerald-500";

                    return (
                      <div key={index} className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold relative">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <div className={`w-2 h-2 rounded-full ${dotColorClass}`} />
                            <span className="text-black dark:text-white truncate">{cat.name}</span>
                          </div>
                          
                          <div className="relative group flex items-center cursor-help">
                            <span className={`${textColorClass} whitespace-nowrap transition-opacity hover:opacity-80`}>
                              {formatCurrency(cat.amount)}
                            </span>
                            
                            <div className="absolute right-0 bottom-full mb-2 hidden group-hover:block w-max bg-[#222222] text-neutral-300 text-[10px] font-semibold py-1.5 px-3 rounded-lg shadow-xl z-10 border border-neutral-800 animate-in fade-in zoom-in-95 pointer-events-none">
                              Meta de gasto: <span className="text-white">{formatCurrency(cat.goal)}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="w-full h-2 bg-neutral-100 dark:bg-[#2A2A2A] rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${barColorClass}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                    <span className="text-xs">Nenhuma meta configurada.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Evolução de Contas */}
            <div className={`lg:col-span-2 bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 shadow-sm flex flex-col ${cardHoverEffect}`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                  <h2 className="text-lg font-bold text-black dark:text-white">Evolução de Contas</h2>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">Comportamento individual (12 meses)</p>
                </div>
                
                {/* DROPDOWN CUSTOMIZADO CORRIGIDO (SEM ESPAÇO SOBRANDO E COM FILTRO CORRETO) */}
                {allCategoryNames.length > 0 && (
                  <div className="relative" ref={evolutionDropdownRef}>
                    <button 
                      onClick={() => setIsEvolutionDropdownOpen(!isEvolutionDropdownOpen)}
                      className="flex items-center justify-between gap-3 bg-neutral-100 dark:bg-[#222222] text-black dark:text-white text-xs font-semibold rounded-lg px-4 py-2 min-w-[140px] max-w-[200px] transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <span className="truncate">{selectedEvolutionCategory || "Selecione..."}</span>
                      <ChevronDown size={14} className={`shrink-0 text-neutral-400 transition-transform ${isEvolutionDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isEvolutionDropdownOpen && (
                      <div className="absolute top-full right-0 mt-2 min-w-full w-max max-w-[240px] max-h-64 overflow-y-auto bg-white dark:bg-[#222222] rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-200 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                        {allCategoryNames.map(name => (
                          <button
                            key={name}
                            title={name}
                            onClick={() => {
                              setSelectedEvolutionCategory(name);
                              setIsEvolutionDropdownOpen(false);
                            }}
                            className={`w-full block text-left px-4 py-2.5 text-xs font-medium transition-colors truncate ${
                              selectedEvolutionCategory === name
                                ? "bg-blue-50/50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                                : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#2A2A2A]"
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              <div className="h-[200px] 2xl:h-[260px] w-full mt-2 transition-all">
                {allCategoryNames.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={evolutionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.3} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#737373', fontSize: 12 }} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value} />
                      <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#333', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Line type="monotone" dataKey="valor" name={selectedEvolutionCategory} stroke="#2563EB" strokeWidth={3} dot={{ r: 4, fill: "#2563EB", stroke: "#151515", strokeWidth: 2 }} activeDot={{ r: 6, fill: "#2563EB", stroke: "#151515", strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                    <span className="text-xs">Nenhum dado para exibir.</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}