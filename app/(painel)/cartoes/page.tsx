"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { 
  CreditCard, Calendar, ChevronDown, Loader2, 
  ArrowRight, X, AlertCircle, Receipt, Plus, Upload,
  ArrowLeft, Type, DollarSign, SplitSquareHorizontal,
  FileText, UploadCloud, Trash2, CheckSquare
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon: string;
  is_credit_card: boolean;
  credit_limit: number | null;
  closing_date: number | null;
  due_date: number | null;
}

interface Transaction {
  id: string;
  category_id: string;
  amount: number;
  date: string;
  status: "pendente" | "pago";
  description?: string;
  installment_current?: number;
  installment_total?: number;
  categories: Category;
}

interface ImportedTx {
  id: string;
  description: string;
  amount: number;
  date: string;
  isInstallment: boolean;
  installmentsCount: string;
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

export default function CartoesPage() {
  const [selectedMonth, setSelectedMonth] = useState("Julho");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [isMonthOpen, setIsMonthOpen] = useState(false);
  const [isYearOpen, setIsYearOpen] = useState(false);
  const monthRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);

  const [creditCards, setCreditCards] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCard, setSelectedCard] = useState<Category | null>(null);
  const [modalView, setModalView] = useState<"list" | "manual" | "import">("list");

  const [selectedTxsToDel, setSelectedTxsToDel] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState("2");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedTxs, setImportedTxs] = useState<ImportedTx[]>([]);

  const currentYear = new Date().getFullYear().toString();
  const availableYears = Array.from(new Set(transactions.map(tx => tx.date.split("-")[0])));
  if (!availableYears.includes(currentYear)) availableYears.push(currentYear);
  availableYears.sort((a, b) => Number(b) - Number(a));
  const dynamicYears = ["Todos os Anos", ...availableYears];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (monthRef.current && !monthRef.current.contains(event.target as Node)) setIsMonthOpen(false);
      if (yearRef.current && !yearRef.current.contains(event.target as Node)) setIsYearOpen(false);
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

    const { data: catData } = await supabase
      .from("categories")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("is_credit_card", true)
      .order("name", { ascending: true });

    if (catData) setCreditCards(catData);

    const { data: transData } = await supabase
      .from("transactions")
      .select(`id, category_id, amount, date, status, description, installment_current, installment_total, categories (*)`)
      .eq("user_id", session.user.id);

    if (transData) setTransactions(transData as unknown as Transaction[]);
    setLoading(false);
  }

  // --- EXCLUSÃO EM LOTE ---
  const toggleTxSelection = (id: string) => {
    setSelectedTxsToDel(prev => prev.includes(id) ? prev.filter(txId => txId !== id) : [...prev, id]);
  };

  const toggleSelectAll = (cardTxsIds: string[]) => {
    if (selectedTxsToDel.length === cardTxsIds.length) {
      setSelectedTxsToDel([]);
    } else {
      setSelectedTxsToDel(cardTxsIds);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedTxsToDel.length === 0) return;
    if (!confirm(`Tem certeza que deseja excluir ${selectedTxsToDel.length} lançamento(s)?`)) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase.from("transactions").delete().in("id", selectedTxsToDel);
      if (error) throw error;
      await fetchData();
      setSelectedTxsToDel([]);
    } catch (error) {
      alert("Erro ao excluir lançamentos.");
    } finally {
      setIsDeleting(false);
    }
  };

  // --- LANÇAMENTO MANUAL ---
  async function handleManualLaunch(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCard || !desc || !amount || !purchaseDate) return;

    setIsSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const totalAmount = parseFloat(amount);
      const totalInstallments = isInstallment ? parseInt(installmentsCount) : 1;
      const amountPerInstallment = totalAmount / totalInstallments;
      
      const payloads = [];
      const baseDate = new Date(`${purchaseDate}T12:00:00Z`);

      for (let i = 1; i <= totalInstallments; i++) {
        const instDate = new Date(baseDate.getTime());
        instDate.setMonth(instDate.getMonth() + (i - 1));

        payloads.push({
          user_id: session.user.id,
          category_id: selectedCard.id,
          amount: amountPerInstallment,
          date: instDate.toISOString().split('T')[0], // DATA DA COMPRA LIMPA
          status: "pendente", 
          description: isInstallment ? `${desc.trim()} (${i}/${totalInstallments})` : desc.trim(),
          installment_current: i,
          installment_total: totalInstallments
        });
      }

      const { error } = await supabase.from("transactions").insert(payloads);
      if (error) throw error;

      await fetchData(); 
      setDesc("");
      setAmount("");
      setIsInstallment(false);
      setInstallmentsCount("2");
      setModalView("list");

    } catch (error) {
      alert("Erro ao salvar lançamento.");
    } finally {
      setIsSaving(false);
    }
  }

  // --- IMPORTAÇÃO OFX (RESOLVIDO O BUG DO NUBANK) ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const extracted: ImportedTx[] = [];
      const usedIds = new Set<string>();
      
      const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
      let match;
      
      const groupedTxs: Record<string, { rawAmount: number, memo: string, date: string }[]> = {};

      while ((match = trnRegex.exec(text)) !== null) {
        const block = match[1];
        const amtMatch = block.match(/<TRNAMT>([\-\d.]+)/i);
        const dateMatch = block.match(/<DTPOSTED>(\d{8})/i);
        const fitidMatch = block.match(/<FITID>([^<\r\n]+)/i);
        const memoMatch = block.match(/<(?:MEMO|NAME)>([^<\r\n]+)/i);
        
        if (amtMatch && dateMatch) {
          const rawAmount = parseFloat(amtMatch[1]);
          const memo = memoMatch ? memoMatch[1].trim() : "Compra Cartão";
          const fitid = fitidMatch ? fitidMatch[1].trim() : Math.random().toString();

          if (!groupedTxs[fitid]) groupedTxs[fitid] = [];
          
          groupedTxs[fitid].push({
            rawAmount,
            memo,
            date: dateMatch[1]
          });
        }
      }

      for (const [fitid, txs] of Object.entries(groupedTxs)) {
        const totalAmount = txs.reduce((acc, tx) => acc + tx.rawAmount, 0);

        if (Math.abs(totalAmount) < 0.01) {
          continue; 
        }

        const firstTx = txs[0];

        if (
          firstTx.memo.toLowerCase().includes("pagamento recebido") || 
          firstTx.memo.toLowerCase().includes("pagamento de fatura") ||
          totalAmount > 0 
        ) {
          continue;
        }

        const finalAmount = Math.abs(totalAmount);

        const year = firstTx.date.substring(0, 4);
        const month = firstTx.date.substring(4, 6);
        const day = firstTx.date.substring(6, 8);
        
        // BUG CORRIGIDO: Nubank usa o mesmo FITID todos os meses. Adicionando a data garante unicidade.
        let uniqueId = `${fitid}_${year}${month}${day}`;
        while (usedIds.has(uniqueId)) {
          uniqueId += `-${Math.floor(Math.random() * 1000)}`;
        }
        usedIds.add(uniqueId);
        
        extracted.push({
          id: uniqueId,
          description: firstTx.memo, // DESCRIÇÃO PURA
          amount: finalAmount, 
          date: `${year}-${month}-${day}`, // DATA CORRETA DA COMPRA
          isInstallment: false,
          installmentsCount: "2"
        });
      }

      setImportedTxs(extracted);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = ''; 
  };

  const updateImportedTx = (id: string, field: keyof ImportedTx, value: any) => {
    setImportedTxs(prev => prev.map(tx => tx.id === id ? { ...tx, [field]: value } : tx));
  };

  const removeImportedTx = (id: string) => {
    setImportedTxs(prev => prev.filter(tx => tx.id !== id));
  };

  const handleSaveImport = async () => {
    if (importedTxs.length === 0) return;
    setIsSaving(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !selectedCard) return;

      const payloads = [];

      for (const tx of importedTxs) {
        if (tx.amount <= 0) continue; 

        const totalInstallments = tx.isInstallment ? parseInt(tx.installmentsCount) : 1;
        const amountPerInstallment = tx.amount / totalInstallments;
        const baseDate = new Date(`${tx.date}T12:00:00Z`);

        for (let i = 1; i <= totalInstallments; i++) {
          const instDate = new Date(baseDate.getTime());
          instDate.setMonth(instDate.getMonth() + (i - 1));

          payloads.push({
            user_id: session.user.id,
            category_id: selectedCard.id,
            amount: amountPerInstallment,
            date: instDate.toISOString().split('T')[0], // DATA LIMPA
            status: "pendente",
            description: tx.isInstallment ? `${tx.description} (${i}/${totalInstallments})` : tx.description,
            installment_current: i,
            installment_total: totalInstallments,
            external_id: tx.isInstallment ? `${tx.id}_${i}` : tx.id
          });
        }
      }

      const { error } = await supabase.from("transactions").upsert(payloads, { onConflict: "external_id", ignoreDuplicates: true });
      if (error) throw error;

      await fetchData();
      setImportedTxs([]);
      setModalView("list");
      
    } catch (err) {
      alert("Erro ao salvar importação.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- FILTRO INTELIGENTE DE COMPETÊNCIA DA FATURA ---
  const filteredTransactions = transactions.filter(tx => {
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

      const expectedMonthNum = MONTHS.indexOf(selectedMonth) - 1;
      const expectedYearNum = parseInt(selectedYear);
      
      const matchesYear = selectedYear === "Todos os Anos" || targetYear === expectedYearNum;
      const matchesMonth = selectedMonth === "Todos os Meses" || targetMonth === expectedMonthNum;
      
      return matchesYear && matchesMonth;
    } else {
      const [txYear, txMonth] = tx.date.split("-");
      const matchesYear = selectedYear === "Todos os Anos" || txYear === selectedYear;
      const matchesMonth = selectedMonth === "Todos os Meses" || txMonth === MONTH_MAP[selectedMonth];
      return matchesYear && matchesMonth;
    }
  });

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDateBR = (dateStr: string) => dateStr.split('-').reverse().join('/');

  // REMOVIDA A BORDA COLORIDA (border-purple-500) E MANTIDO APENAS O EFEITO DE SOMBRA/FLUTUAR
  const cardHoverEffect = "transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-pointer";

  const openCardModal = (card: Category) => {
    setSelectedCard(card);
    setModalView("list");
    setSelectedTxsToDel([]);
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* CABEÇALHO E FILTROS */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-black dark:text-white tracking-tight">Cartões de Crédito</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 flex items-center gap-1.5">
            <CreditCard size={16} className="text-purple-500" /> Acompanhe seus limites e faturas
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex items-center h-12 bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 shadow-sm text-sm font-medium w-full sm:w-auto relative">
            <div className="flex items-center gap-2 mr-4">
              <Calendar size={16} className="text-purple-500 dark:text-purple-400" />
              <span className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">Fatura de</span>
            </div>
            <div className="w-px h-6 bg-neutral-200 dark:bg-neutral-800 mr-4" />
            
            <div className="relative mr-4" ref={monthRef}>
              <button onClick={() => { setIsMonthOpen(!isMonthOpen); setIsYearOpen(false); }} className="flex items-center gap-2 text-black dark:text-white hover:opacity-80 transition-opacity min-w-[100px] justify-between">
                {selectedMonth} <ChevronDown size={14} className="text-neutral-500" />
              </button>
              {isMonthOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 max-h-64 overflow-y-auto bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2">
                  {MONTHS.map((month) => (
                    <button key={month} onClick={() => { setSelectedMonth(month); setIsMonthOpen(false); setSelectedTxsToDel([]); }} className="w-full text-left px-4 py-2.5 text-sm transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800">
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
                <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2">
                  {dynamicYears.map((year) => (
                    <button key={year} onClick={() => { setSelectedYear(year); setIsYearOpen(false); setSelectedTxsToDel([]); }} className="w-full text-left px-4 py-2.5 text-sm transition-colors text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800">
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
          <Loader2 className="animate-spin text-purple-500" size={32} />
        </div>
      ) : creditCards.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#151515] rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <div className="text-4xl mb-3">💳</div>
          <h3 className="text-lg font-semibold text-black dark:text-white">Nenhum cartão cadastrado</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 mb-4">
            Vá até a tela de Categorias e crie uma despesa marcada como Cartão de Crédito.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {creditCards.map((card) => {
            const cardTransactions = filteredTransactions.filter(tx => tx.category_id === card.id);
            const invoiceTotal = cardTransactions.reduce((acc, tx) => acc + tx.amount, 0);
            
            const limit = card.credit_limit || 0;
            const percentageUsed = limit > 0 ? (invoiceTotal / limit) * 100 : 0;
            const isOverLimit = invoiceTotal > limit && limit > 0;
            const barWidth = Math.min(percentageUsed, 100);
            const availableLimit = limit - invoiceTotal;

            const barColorClass = isOverLimit ? "bg-rose-500" : "bg-purple-500";
            const textColorClass = isOverLimit ? "text-rose-500" : "text-purple-500";

            return (
              <div
                key={card.id}
                onClick={() => openCardModal(card)}
                className={`flex flex-col p-6 bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-sm ${cardHoverEffect}`}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 flex items-center justify-center bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 rounded-xl text-xl">
                      {card.icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-black dark:text-white leading-tight text-lg">
                        {card.name}
                      </h3>
                      <p className="text-[11px] font-semibold tracking-wider text-neutral-400 uppercase mt-1">
                        Fatura {selectedMonth}
                      </p>
                    </div>
                  </div>
                  <div className="p-1.5 text-neutral-400 opacity-50 group-hover:opacity-100 transition-opacity">
                    <ArrowRight size={18} />
                  </div>
                </div>

                <div className="space-y-4 flex-1">
                  <div>
                    <div className="flex justify-between items-end mb-1.5">
                      <span className="text-xs font-semibold text-neutral-500">Valor da Fatura</span>
                      <span className={`text-2xl font-bold ${textColorClass}`}>
                        {formatCurrency(invoiceTotal)}
                      </span>
                    </div>

                    {limit > 0 ? (
                      <>
                        <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden mt-3">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${barColorClass}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-2.5 text-[11px] font-semibold">
                          <span className="text-neutral-500">
                            Limite: {formatCurrency(limit)}
                          </span>
                          <span className={availableLimit >= 0 ? "text-emerald-500" : "text-rose-500"}>
                            Disponível: {formatCurrency(availableLimit)}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] font-medium text-neutral-400 mt-3">Sem limite definido.</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-8 pt-5 border-t border-neutral-100 dark:border-neutral-800/80">
                  <div className="flex-1 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl p-3 text-center border border-neutral-200 dark:border-neutral-800/50">
                    <span className="block text-[10px] uppercase font-bold text-neutral-500 mb-1">Fecha dia</span>
                    <span className="text-sm font-bold text-black dark:text-white">{card.closing_date || "--"}</span>
                  </div>
                  <div className="flex-1 bg-neutral-50 dark:bg-neutral-900/50 rounded-xl p-3 text-center border border-neutral-200 dark:border-neutral-800/50">
                    <span className="block text-[10px] uppercase font-bold text-neutral-500 mb-1">Vence dia</span>
                    <span className="text-sm font-bold text-black dark:text-white">{card.due_date || "--"}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL COMPLEXO DO CARTÃO */}
      {selectedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            
            <div className="flex items-center justify-between p-5 md:p-6 border-b border-neutral-100 dark:border-neutral-800 shrink-0 bg-white dark:bg-[#151515] relative z-10">
              <div className="flex items-center gap-3">
                {modalView !== "list" && (
                  <button 
                    onClick={() => { setModalView("list"); setImportedTxs([]); }}
                    className="p-2 -ml-2 text-neutral-500 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition-colors"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <div className="w-10 h-10 flex items-center justify-center bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50 rounded-xl text-lg">
                  {selectedCard.icon}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-black dark:text-white leading-tight">
                    {modalView === "list" && selectedCard.name}
                    {modalView === "manual" && "Nova Compra"}
                    {modalView === "import" && "Importar Extrato OFX"}
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {modalView === "list" ? `Fatura de ${selectedMonth}` : selectedCard.name}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedCard(null); setImportedTxs([]); setSelectedTxsToDel([]); }}
                className="p-2 text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-900 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* CONTEÚDO: LISTA DE FATURAS */}
            {modalView === "list" && (
              <>
                <div className="px-5 md:px-6 py-4 bg-neutral-50 dark:bg-[#1A1A1A] border-b border-neutral-100 dark:border-neutral-800 shrink-0 flex flex-col sm:flex-row gap-3">
                  <button 
                    onClick={() => setModalView("manual")}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors shadow-sm shadow-purple-500/20"
                  >
                    <Plus size={16} /> Lançar Manualmente
                  </button>
                  <button 
                    onClick={() => setModalView("import")}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white dark:bg-[#222222] border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-sm font-semibold hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <Upload size={16} /> Importar Extrato (OFX)
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 md:p-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-200 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {(() => {
                    const cardTxs = filteredTransactions.filter(tx => tx.category_id === selectedCard.id);
                    
                    if (cardTxs.length === 0) {
                      return (
                        <div className="flex flex-col items-center justify-center py-10 text-center">
                          <Receipt size={40} className="text-neutral-300 dark:text-neutral-700 mb-3" />
                          <h3 className="text-sm font-semibold text-black dark:text-white">Fatura Vazia</h3>
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">Nenhum gasto registrado nesta fatura.</p>
                        </div>
                      );
                    }

                    const allTxsIds = cardTxs.map(tx => tx.id);

                    return (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1 mb-4 border-b border-neutral-200 dark:border-neutral-800 pb-3">
                          <label className="flex items-center gap-2 cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={selectedTxsToDel.length === cardTxs.length}
                              onChange={() => toggleSelectAll(allTxsIds)}
                              className="w-4 h-4 rounded border-neutral-300 text-purple-600 focus:ring-purple-600 cursor-pointer"
                            />
                            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500 group-hover:text-black dark:group-hover:text-white transition-colors">Selecionar Todos</span>
                          </label>

                          {selectedTxsToDel.length > 0 && (
                            <button 
                              onClick={handleDeleteSelected}
                              disabled={isDeleting}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                            >
                              {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                              Excluir ({selectedTxsToDel.length})
                            </button>
                          )}
                        </div>

                        {cardTxs.map(tx => (
                          <div key={tx.id} className={`flex items-center justify-between p-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border rounded-xl transition-colors group ${selectedTxsToDel.includes(tx.id) ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-900/10' : 'border-neutral-200 dark:border-neutral-800/80 hover:border-purple-300 dark:hover:border-purple-800'}`}>
                            <div className="flex items-center gap-3">
                              <input 
                                type="checkbox" 
                                checked={selectedTxsToDel.includes(tx.id)}
                                onChange={() => toggleTxSelection(tx.id)}
                                className="w-4 h-4 rounded border-neutral-300 text-purple-600 focus:ring-purple-600 cursor-pointer"
                              />
                              <div className={`w-2 h-2 rounded-full ${selectedTxsToDel.includes(tx.id) ? 'bg-purple-600' : 'bg-purple-400'}`}></div>
                              <div>
                                <p className="text-sm font-semibold text-black dark:text-white truncate max-w-[150px] sm:max-w-[300px]">
                                  {tx.description || "Compra no Cartão"}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">{formatDateBR(tx.date)}</span>
                                  {tx.installment_total && tx.installment_total > 1 && (
                                    <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-[9px] font-bold rounded">
                                      {tx.installment_current}/{tx.installment_total}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className={`text-sm font-bold ${tx.status === 'pago' ? 'line-through text-neutral-400' : 'text-black dark:text-white'}`}>
                              {formatCurrency(tx.amount)}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </>
            )}

            {/* CONTEÚDO: FORMULÁRIO MANUAL */}
            {modalView === "manual" && (
              <form onSubmit={handleManualLaunch} className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-200 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:rounded-full">
                
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Descrição (Local da Compra) *</label>
                  <div className="relative">
                    <Type size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input 
                      type="text" required placeholder="Ex: Mercado Livre, Uber, Amazon..." 
                      value={desc} onChange={(e) => setDesc(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-shadow"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Valor Total (R$) *</label>
                    <div className="relative">
                      <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input 
                        type="number" step="0.01" min="0.01" required placeholder="0,00" 
                        value={amount} onChange={(e) => setAmount(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-bold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-shadow"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">Data da Compra *</label>
                    <input 
                      type="date" required 
                      value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full px-4 py-3.5 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-shadow [&::-webkit-calendar-picker-indicator]:dark:invert [&::-webkit-calendar-picker-indicator]:opacity-50"
                    />
                  </div>
                </div>

                <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900/30 rounded-xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                        <SplitSquareHorizontal size={16} /> Compra Parcelada?
                      </h4>
                      <p className="text-[11px] text-purple-600/70 dark:text-purple-400/70 mt-0.5">
                        O sistema dividirá o valor total nos meses seguintes.
                      </p>
                    </div>
                    <button type="button" onClick={() => setIsInstallment(!isInstallment)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-[#151515] ${isInstallment ? "bg-purple-500" : "bg-neutral-300 dark:bg-neutral-700"}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isInstallment ? "translate-x-6" : "translate-x-1"}`} />
                    </button>
                  </div>

                  {isInstallment && (
                    <div className="pt-2 animate-in fade-in slide-in-from-top-2">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-2">Quantas parcelas?</label>
                      <input 
                        type="number" min="2" max="72" required={isInstallment}
                        value={installmentsCount} onChange={(e) => setInstallmentsCount(e.target.value)}
                        className="w-full px-4 py-3 bg-white dark:bg-[#1A1A1A] border border-purple-200 dark:border-purple-900/50 rounded-xl text-sm font-bold text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      {amount && (
                        <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mt-3 bg-purple-100 dark:bg-purple-900/30 p-2.5 rounded-lg border border-purple-200 dark:border-purple-900/50">
                          Resumo: Serão lançadas <strong>{installmentsCount}</strong> parcelas de <strong>{formatCurrency(parseFloat(amount) / parseInt(installmentsCount || "1"))}</strong>.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button type="button" onClick={() => setModalView("list")} className="flex-1 py-3 px-4 bg-white dark:bg-[#222] border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl font-semibold text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors">
                    Cancelar
                  </button>
                  <button type="submit" disabled={isSaving || !desc || !amount} className="flex-1 py-3 px-4 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors shadow-sm shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2">
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : "Adicionar Compra"}
                  </button>
                </div>
              </form>
            )}

            {/* CONTEÚDO: IMPORTAÇÃO OFX */}
            {modalView === "import" && (
              <div className="flex-1 overflow-y-auto p-5 md:p-6 flex flex-col [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-200 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:rounded-full">
                
                {importedTxs.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center min-h-[300px]">
                    <div className="w-full max-w-sm border-2 border-dashed border-neutral-300 dark:border-neutral-700 hover:border-purple-500 dark:hover:border-purple-500 bg-neutral-50 dark:bg-[#1A1A1A] rounded-3xl p-10 text-center transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText size={32} />
                      </div>
                      <h3 className="text-lg font-bold text-black dark:text-white mb-2">Selecione o arquivo .OFX</h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400">Exporte a fatura direto no app do seu banco e importe aqui.</p>
                      
                      <input 
                        type="file" 
                        accept=".ofx" 
                        className="hidden" 
                        ref={fileInputRef} 
                        onChange={handleFileUpload} 
                      />
                      
                      <button className="mt-6 px-6 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition-colors shadow-sm">
                        Buscar Arquivo
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full animate-in fade-in">
                    <div className="flex items-center justify-between mb-4 px-1">
                      <div>
                        <h3 className="text-sm font-bold text-black dark:text-white">Revisar Compras</h3>
                        <p className="text-xs text-neutral-500">Encontramos {importedTxs.length} registros no arquivo.</p>
                      </div>
                      <button onClick={() => setImportedTxs([])} className="text-xs font-semibold text-red-500 hover:underline">
                        Cancelar Importação
                      </button>
                    </div>

                    <div className="space-y-3 pb-4">
                      {importedTxs.map((tx) => (
                        <div key={tx.id} className="p-4 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800/80 rounded-xl space-y-3">
                          
                          <div className="flex flex-col sm:flex-row gap-3">
                            <div className="w-full sm:w-32 shrink-0">
                              <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Data</label>
                              <input type="date" value={tx.date} onChange={(e) => updateImportedTx(tx.id, "date", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#222] border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-medium focus:border-purple-500 focus:outline-none [&::-webkit-calendar-picker-indicator]:dark:invert" />
                            </div>
                            
                            <div className="flex-1">
                              <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Descrição</label>
                              <input type="text" value={tx.description} onChange={(e) => updateImportedTx(tx.id, "description", e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-[#222] border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-medium focus:border-purple-500 focus:outline-none" />
                            </div>

                            <div className="w-full sm:w-28 shrink-0">
                              <label className="block text-[10px] font-bold uppercase text-neutral-500 mb-1">Valor (R$)</label>
                              <input type="number" step="0.01" value={tx.amount} onChange={(e) => updateImportedTx(tx.id, "amount", parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 bg-white dark:bg-[#222] border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs font-bold text-purple-600 dark:text-purple-400 focus:border-purple-500 focus:outline-none" />
                            </div>

                            <div className="flex items-end pb-[2px]">
                              <button onClick={() => removeImportedTx(tx.id)} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={tx.isInstallment} onChange={(e) => updateImportedTx(tx.id, "isInstallment", e.target.checked)} className="w-3.5 h-3.5 rounded border-neutral-300 text-purple-600 focus:ring-purple-600" />
                              <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">Foi parcelado?</span>
                            </label>
                            
                            {tx.isInstallment && (
                              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                                <span className="text-[11px] text-neutral-500">Qtd:</span>
                                <input type="number" min="2" max="72" value={tx.installmentsCount} onChange={(e) => updateImportedTx(tx.id, "installmentsCount", e.target.value)} className="w-16 px-2 py-1 bg-white dark:bg-[#222] border border-neutral-200 dark:border-neutral-700 rounded-md text-xs font-medium focus:border-purple-500 focus:outline-none" />
                              </div>
                            )}
                          </div>

                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RODAPÉ FIXO */}
            <div className="p-5 md:p-6 bg-neutral-50 dark:bg-[#111111] border-t border-neutral-200 dark:border-neutral-800 rounded-b-2xl shrink-0">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                
                {/* Bloco do Total */}
                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-start">
                  <span className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">
                    {modalView === 'import' ? 'Total da Importação' : 'Total da Fatura'}
                  </span>
                  <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {formatCurrency(
                      modalView === 'import' 
                        ? importedTxs.reduce((acc, tx) => acc + tx.amount, 0)
                        : filteredTransactions.filter(tx => tx.category_id === selectedCard.id).reduce((acc, tx) => acc + tx.amount, 0)
                    )}
                  </span>
                </div>

                {/* Botão de Salvar Importação Fixo (Aparece apenas quando há transações importadas) */}
                {modalView === 'import' && importedTxs.length > 0 && (
                  <button 
                    onClick={handleSaveImport}
                    disabled={isSaving}
                    className="w-full sm:w-auto px-6 py-3 bg-purple-600 text-white rounded-xl font-semibold text-sm hover:bg-purple-700 transition-colors shadow-sm shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                    Salvar {importedTxs.length} transações
                  </button>
                )}
                
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}