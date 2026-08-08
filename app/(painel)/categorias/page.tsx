"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Loader2, X, Trash2, CreditCard, Repeat, Activity, Target, Edit3, HelpCircle, Tag, EyeOff, Eye } from "lucide-react";

interface Category {
  id: string;
  name: string;
  icon: string;
  expense_type: "recorrente" | "variavel";
  budget: number | null;
  is_credit_card: boolean;
  credit_limit: number | null;
  closing_date: number | null;
  due_date: number | null;
  is_active?: boolean; // Novo campo para controle de inativação
}

// Lista GIGANTE de Emojis
const COMMON_EMOJIS = [
  // Moradia / Contas / Internet
  "🏠", "🏢", "⚡", "💧", "🔥", "🌐", "📡", "📞", "🧹", "🪴", "🔧", "🛋️",
  // Alimentação / Mercado
  "🛒", "🍽️", "🍔", "🍕", "☕", "🍺", "🍎", "🥦", "🥩", "🍣", "🍷", "🧁",
  // Transporte
  "🚗", "🚌", "⛽", "🚇", "🚕", "🚲", "🏍️", "✈️", "🛴", "⛴️", "🅿️", "🛠️",
  // Saúde / Academia / Cuidados
  "💊", "🏥", "🏋️", "💪", "🏃", "🧘", "🦷", "💇", "🩺", "🧼", "💅", "🩸",
  // Lazer / Assinaturas / Educação
  "🏖️", "🎮", "🎬", "🎵", "⚽", "🎨", "📚", "🎓", "🎟️", "🍿", "🎤", "🎪",
  // Compras / Tecnologia
  "🛍️", "👕", "👗", "🎁", "📱", "💻", "📺", "⌚", "📷", "👟", "💄", "🧴",
  // Pets / Finanças / Família / Outros
  "🐶", "🐱", "🐾", "💳", "💰", "🏦", "📈", "🛡️", "👶", "💸", "💼", "🤝"
];

export default function CategoriasPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("🏠");
  const [expenseType, setExpenseType] = useState<"recorrente" | "variavel">("variavel");
  const [budget, setBudget] = useState("");
  const [isCreditCard, setIsCreditCard] = useState(false);
  
  // Credit Card specific state
  const [creditLimit, setCreditLimit] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", session.user.id);

      if (error) throw error;
      
      const sortedData = sortCategories(data || []);
      setCategories(sortedData);
    } catch (error) {
      console.error("Erro ao buscar categorias:", error);
    } finally {
      setLoading(false);
    }
  }

  // Função para ordenar: Ativas primeiro, depois em ordem alfabética
  function sortCategories(cats: Category[]) {
    return [...cats].sort((a, b) => {
      const aActive = a.is_active !== false;
      const bActive = b.is_active !== false;
      
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return a.name.localeCompare(b.name);
    });
  }

  function openEditModal(category: Category) {
    setEditingId(category.id);
    setNewName(category.name);
    setSelectedIcon(category.icon);
    setExpenseType(category.expense_type);
    setBudget(category.budget ? category.budget.toString() : "");
    setIsCreditCard(category.is_credit_card);
    setCreditLimit(category.credit_limit ? category.credit_limit.toString() : "");
    setClosingDate(category.closing_date ? category.closing_date.toString() : "");
    setDueDate(category.due_date ? category.due_date.toString() : "");
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingId(null);
    setNewName("");
    setSelectedIcon("🏠");
    setExpenseType("variavel");
    setBudget("");
    setIsCreditCard(false);
    setCreditLimit("");
    setClosingDate("");
    setDueDate("");
  }

  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const categoryData = {
        user_id: session.user.id,
        name: newName.trim(),
        icon: selectedIcon,
        expense_type: expenseType,
        budget: budget ? parseFloat(budget) : null,
        is_credit_card: isCreditCard,
        credit_limit: isCreditCard && creditLimit ? parseFloat(creditLimit) : null,
        closing_date: isCreditCard && closingDate ? parseInt(closingDate) : null,
        due_date: isCreditCard && dueDate ? parseInt(dueDate) : null,
      };

      if (editingId) {
        // Atualiza categoria existente
        const { data, error } = await supabase
          .from("categories")
          .update(categoryData)
          .eq("id", editingId)
          .select()
          .single();

        if (error) throw error;
        
        const updatedCategories = categories.map(cat => cat.id === editingId ? data : cat);
        setCategories(sortCategories(updatedCategories));
      } else {
        // Cria nova categoria
        const { data, error } = await supabase
          .from("categories")
          .insert([{ ...categoryData, is_active: true }])
          .select()
          .single();

        if (error) throw error;
        
        const newCategoriesList = [...categories, data];
        setCategories(sortCategories(newCategoriesList));
      }
      
      closeModal();
    } catch (error) {
      alert("Erro ao salvar categoria.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir permanentemente esta categoria?\nSe houver lançamentos vinculados, ocorrerá um erro.")) return;

    try {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) {
        if (error.code === '23503') { // Código de erro de Foreign Key
          alert("Não é possível excluir esta categoria pois ela possui lançamentos vinculados. Em vez disso, inative-a clicando no ícone de ocultar.");
        } else {
          throw error;
        }
        return;
      }
      setCategories(categories.filter((cat) => cat.id !== id));
    } catch (error) {
      alert("Erro ao deletar categoria.");
    }
  }

  async function toggleStatus(category: Category) {
    const newStatus = category.is_active === false ? true : false;
    const confirmMessage = newStatus 
      ? "Deseja reativar esta categoria para que volte a aparecer nos lançamentos?" 
      : "Deseja inativar esta categoria? Ela não aparecerá mais para novos lançamentos, mas seu histórico será mantido.";

    if (!confirm(confirmMessage)) return;

    try {
      const { error } = await supabase
        .from("categories")
        .update({ is_active: newStatus })
        .eq("id", category.id);

      if (error) throw error;

      const updatedCategories = categories.map(cat => 
        cat.id === category.id ? { ...cat, is_active: newStatus } : cat
      );
      
      setCategories(sortCategories(updatedCategories));
    } catch (error) {
      alert("Erro ao alterar o status da categoria.");
    }
  }

  // Formata moeda para a lista
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  const cardHoverEffect = "transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:bg-[#202020]";

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          {/* TÍTULO E SUBTÍTULO */}
          <h1 className="text-3xl font-bold text-black dark:text-white tracking-tight">
            Categorias
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 flex items-center gap-2">
            <Tag size={16} className="text-[#5C67FF]" />
            Organize suas despesas e metas de gastos.
          </p>
        </div>
        <button
          onClick={() => { closeModal(); setIsModalOpen(true); }}
          className="inline-flex items-center justify-center gap-2 px-6 h-12 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
        >
          <Plus size={18} />
          Nova Categoria
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm">
          <div className="text-4xl mb-3">🏷️</div>
          <h3 className="text-lg font-semibold text-black dark:text-white">Nenhuma categoria</h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1 mb-4">
            Você ainda não cadastrou nenhuma categoria.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="text-sm font-medium text-blue-600 dark:text-blue-500 hover:underline"
          >
            Criar primeira categoria
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4 2xl:gap-6">
          {categories.map((category) => {
            const isActive = category.is_active !== false;

            return (
              <div
                key={category.id}
                className={`group relative flex flex-col p-5 bg-white dark:bg-[#1A1A1A] rounded-2xl shadow-sm ${isActive ? cardHoverEffect : 'opacity-60 grayscale hover:opacity-100 transition-opacity'}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 flex items-center justify-center bg-neutral-100 dark:bg-[#222222] rounded-xl text-xl shrink-0">
                      {category.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold leading-tight ${isActive ? 'text-black dark:text-white' : 'text-neutral-600 dark:text-neutral-400 line-through'}`}>
                          {category.name}
                        </h3>
                        {!isActive && (
                          <span className="px-1.5 py-0.5 bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-[9px] font-bold uppercase rounded">
                            Inativa
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1 mt-1">
                        {category.expense_type === "recorrente" ? <Repeat size={12}/> : <Activity size={12}/>}
                        {category.expense_type === "recorrente" ? "Recorrente" : "Variável"}
                      </p>
                    </div>
                  </div>
                  
                  {/* Botões de Ação no Hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => toggleStatus(category)}
                      className="p-1.5 text-neutral-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                      title={isActive ? "Inativar categoria" : "Ativar categoria"}
                    >
                      {isActive ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      onClick={() => openEditModal(category)}
                      className="p-1.5 text-neutral-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Editar categoria"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id)}
                      className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Excluir categoria"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Renderiza o rodapé do card APENAS se houver meta ou se for cartão */}
                {(category.budget || category.is_credit_card) && (
                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-neutral-100 dark:border-neutral-800/50">
                    {category.budget && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-500 rounded-lg">
                        <Target size={12} /> Meta: {formatCurrency(category.budget)}
                      </span>
                    )}
                    
                    {category.is_credit_card && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 rounded-lg ml-auto">
                        <CreditCard size={12} /> Cartão
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Criação/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 shrink-0">
              <h2 className="text-xl font-bold text-black dark:text-white tracking-tight">
                {editingId ? "Editar Categoria" : "Nova Categoria"}
              </h2>
              <button 
                onClick={closeModal}
                className="p-2 text-neutral-400 hover:text-black dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#222222] rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 pt-0 overflow-y-auto space-y-6">
              
              {/* Ícone e Nome */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Mercado, Aluguel, Farmácia..."
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-4 py-3.5 bg-neutral-50 dark:bg-[#222222] rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                  Escolha um Ícone *
                </label>
                <div className="grid grid-cols-8 gap-1.5 bg-neutral-50 dark:bg-[#222222] p-3 rounded-xl max-h-48 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-200 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {COMMON_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setSelectedIcon(emoji)}
                      className={`text-xl p-1.5 rounded-lg transition-all flex items-center justify-center
                        ${selectedIcon === emoji 
                          ? "bg-blue-100 dark:bg-blue-900/40 text-black dark:text-white shadow-sm" 
                          : "hover:bg-neutral-200 dark:hover:bg-[#2A2A2A]"
                        }
                      `}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tipo de Despesa com Tooltip */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Tipo de Despesa
                  </label>
                  <div className="relative group flex items-center">
                    <HelpCircle size={14} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-black dark:bg-white text-white dark:text-black text-[11px] font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all shadow-xl text-center pointer-events-none z-50 leading-relaxed">
                      <span className="block mb-2"><strong>Recorrente:</strong> Despesas previsíveis que ocorrem todos os meses, independentemente da variação de valor.</span>
                      <span><strong>Variável:</strong> Gastos pontuais ou esporádicos que não possuem frequência mensal fixa.</span>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-black dark:border-t-white"></div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setExpenseType("variavel")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                      expenseType === "variavel"
                        ? "bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                        : "bg-neutral-50 dark:bg-[#222222] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#2A2A2A]"
                    }`}
                  >
                    <Activity size={16} /> Variável
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpenseType("recorrente")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                      expenseType === "recorrente"
                        ? "bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                        : "bg-neutral-50 dark:bg-[#222222] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-[#2A2A2A]"
                    }`}
                  >
                    <Repeat size={16} /> Recorrente
                  </button>
                </div>
              </div>

              {/* Meta de Gasto */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                  Meta de Gasto (Opcional)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-medium">
                    R$
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full pl-10 pr-4 py-3.5 bg-neutral-50 dark:bg-[#222222] rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
                  />
                </div>
                <p className="text-[11px] text-neutral-400 mt-1.5">
                  Deixe em branco se não quiser definir um limite para esta categoria.
                </p>
              </div>

              {/* Cartão de Crédito e Condicionais */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-neutral-50 dark:bg-[#222222] rounded-xl">
                  <div>
                    <h4 className="text-sm font-semibold text-black dark:text-white flex items-center gap-2">
                      <CreditCard size={16} className="text-purple-500" />
                      Cartão de Crédito
                    </h4>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Marque se esta categoria for atrelada a faturas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCreditCard(!isCreditCard)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 dark:focus:ring-offset-[#1A1A1A] ${
                      isCreditCard ? "bg-purple-500" : "bg-neutral-300 dark:bg-[#1A1A1A]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isCreditCard ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Campos condicionais de cartão */}
                {isCreditCard && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-2">
                        Limite do Cartão
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-medium">
                          R$
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          value={creditLimit}
                          onChange={(e) => setCreditLimit(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#1A1A1A] rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-shadow"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-2">
                          Dia de Fechamento
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          placeholder="Ex: 15"
                          value={closingDate}
                          onChange={(e) => setClosingDate(e.target.value)}
                          className="w-full px-4 py-3 bg-white dark:bg-[#1A1A1A] rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-shadow"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-2">
                          Dia de Vencimento
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="31"
                          placeholder="Ex: 20"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="w-full px-4 py-3 bg-white dark:bg-[#1A1A1A] rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-shadow"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving || !newName.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm shadow-blue-500/20"
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : (editingId ? "Salvar Alterações" : "Salvar Categoria")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}