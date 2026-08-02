"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  List, 
  CreditCard, 
  TrendingUp, 
  Tag, 
  Settings, 
  Wallet,
  MonitorSmartphone,
  Sun,
  Moon,
  ChevronDown,
  User,
  LogOut,
  Search,
  Plus,
  Loader2,
  TrendingDown
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

const MenuItem = ({ href, icon: Icon, label, isActive }: { href: string, icon: any, label: string, isActive: boolean }) => {
  return (
    <div className="relative group flex justify-center w-full">
      <Link 
        href={href} 
        className={`w-12 h-12 rounded-[16px] transition-all duration-200 flex items-center justify-center
          ${isActive 
            ? "bg-[#E6EDFF] dark:bg-[#282D3F] text-[#5C67FF] dark:text-[#8D9EFF]" 
            : "text-neutral-500 dark:text-[#6B7280] hover:bg-neutral-100 dark:hover:bg-[#1E2230] hover:text-black dark:hover:text-white"
          }`}
      >
        <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
      </Link>
      
      <div className="absolute left-full ml-4 px-3 py-1.5 bg-black dark:bg-white text-white dark:text-black text-sm font-medium rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 shadow-lg pointer-events-none">
        {label}
        <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-black dark:bg-white rotate-45"></div>
      </div>
    </div>
  );
};

interface HeaderProfile {
  username: string
  plan_type: string
  avatar_url: string
  full_name: string
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // ==========================================
  // ESTADOS DA BARRA DE PESQUISA GLOBAL
  // ==========================================
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ incomes: any[], transactions: any[] }>({ incomes: [], transactions: [] });

  const [profile, setProfile] = useState<HeaderProfile>({
    username: "Carregando...",
    plan_type: "free",
    avatar_url: "",
    full_name: "",
  });

  // Carregar Perfil
  useEffect(() => {
    setMounted(true);
    async function loadHeaderProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data } = await supabase.from("profiles").select("username, plan_type, avatar_url, full_name").eq("id", session.user.id).single();

        if (data) {
          setProfile({
            username: data.username || data.full_name || "usuario",
            plan_type: data.plan_type || "free",
            avatar_url: data.avatar_url || "",
            full_name: data.full_name || "",
          });
        }
      } catch (err) {
        console.error("Erro ao carregar perfil do header:", err);
      }
    }
    loadHeaderProfile();
  }, []);

  // Controlar o clique fora dos dropdowns (Perfil e Busca Global)
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lógica de Debounce (Atrasa a busca para não sobrecarregar o banco enquanto o usuário digita)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(globalSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [globalSearch]);

  // Executar a busca no Supabase
  useEffect(() => {
    if (debouncedSearch.trim().length < 2) {
      setSearchResults({ incomes: [], transactions: [] });
      setIsSearching(false);
      return;
    }

    async function performSearch() {
      setIsSearching(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Busca Receitas
        const { data: incData } = await supabase
          .from("incomes")
          .select("*")
          .eq("user_id", session.user.id)
          .ilike("name", `%${debouncedSearch}%`)
          .limit(3);

        // Busca Lançamentos (Despesas) - Procurando pela descrição
        const { data: transData } = await supabase
          .from("transactions")
          .select(`*, categories(name, icon)`)
          .eq("user_id", session.user.id)
          .ilike("description", `%${debouncedSearch}%`)
          .limit(3);

        setSearchResults({
          incomes: incData || [],
          transactions: transData || []
        });
      } catch (error) {
        console.error("Erro na busca:", error);
      } finally {
        setIsSearching(false);
      }
    }

    performSearch();
  }, [debouncedSearch]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const getInitials = (name: string) => {
    if (!name) return "RN";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return "";
    return dateStr.split('-').reverse().join('/');
  };

  return (
    <>
      <div className="flex md:hidden h-screen w-full flex-col items-center justify-center bg-white dark:bg-[#0E0E0E] p-6 text-center">
        <MonitorSmartphone size={64} className="text-[#5C67FF] mb-4" />
        <h2 className="text-xl font-bold text-black dark:text-white mb-2">Visualização não suportada</h2>
        <p className="text-neutral-600 dark:text-neutral-400">Para garantir a melhor experiência, o 2Mangos web está disponível apenas para Tablets e Desktops.</p>
      </div>

      <div className="hidden md:flex h-screen w-full bg-neutral-50 dark:bg-[#0E0E0E] transition-colors duration-200">
        
        {/* BARRA LATERAL */}
        <aside className="w-20 bg-white dark:bg-[#121212] shadow-[4px_0_24px_rgba(0,0,0,0.03)] dark:shadow-none flex flex-col items-center py-6 transition-colors duration-200 z-50 shrink-0 sticky top-0 h-screen">
          <div className="w-full flex items-center justify-center mb-8">
            <Link href="/dashboard" className="w-12 h-12 bg-[#5C67FF] rounded-[16px] flex items-center justify-center text-white shadow-lg shadow-[#5C67FF]/20 hover:scale-105 transition-transform">
              <Wallet size={24} strokeWidth={2.5} />
            </Link>
          </div>
          <nav className="flex-1 w-full flex flex-col items-center gap-4">
            <MenuItem href="/dashboard" icon={LayoutDashboard} label="Dashboard" isActive={pathname === "/dashboard"} />
            <MenuItem href="/lancamentos" icon={List} label="Lançamentos" isActive={pathname === "/lancamentos"} />
            <MenuItem href="/cartoes" icon={CreditCard} label="Cartões" isActive={pathname === "/cartoes"} />
            <MenuItem href="/receitas" icon={TrendingUp} label="Receitas" isActive={pathname === "/receitas"} />
            <MenuItem href="/categorias" icon={Tag} label="Categorias" isActive={pathname === "/categorias"} />
          </nav>
          <div className="w-full flex flex-col items-center gap-4 mt-auto">
            <MenuItem href="/dashboard/configuracoes" icon={Settings} label="Configurações" isActive={pathname === "/dashboard/configuracoes"} />
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden relative">
          
          {/* CABEÇALHO */}
          <header className="h-24 pt-4 bg-transparent flex items-center justify-center px-4 md:px-8 w-full z-30 shrink-0">
            <div className="w-full max-w-[1600px] flex items-center justify-between">
              
              {pathname === "/dashboard" ? (
                <div className="flex items-center gap-3 w-full max-w-2xl">
                  
                  {/* SEARCH BAR COM LISTA SUSPENSA (DROPDOWN) */}
                  <div className="relative flex-1" ref={searchContainerRef}>
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input 
                      type="text" 
                      placeholder="Pesquisar lançamentos, receitas..." 
                      value={globalSearch}
                      onFocus={() => setIsSearchOpen(true)}
                      onChange={(e) => {
                        setGlobalSearch(e.target.value);
                        setIsSearchOpen(true);
                      }}
                      className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 rounded-xl text-sm font-medium text-black dark:text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#5C67FF] transition-colors shadow-sm"
                    />
                    
                    {/* Spinner de carregamento dentro do input */}
                    {isSearching && (
                      <Loader2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5C67FF] animate-spin" />
                    )}

                    {/* CAIXA SUSPENSA DE RESULTADOS */}
                    {isSearchOpen && globalSearch.length >= 2 && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-[400px] overflow-y-auto">
                        
                        {!isSearching && searchResults.incomes.length === 0 && searchResults.transactions.length === 0 ? (
                          <div className="p-6 text-center text-sm text-neutral-500">
                            Nenhum resultado encontrado para "{globalSearch}"
                          </div>
                        ) : (
                          <div className="py-2">
                            {/* Grupo: Receitas */}
                            {searchResults.incomes.length > 0 && (
                              <div className="mb-2">
                                <div className="px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <TrendingUp size={12} className="text-emerald-500" /> Receitas
                                </div>
                                {searchResults.incomes.map(inc => (
                                  <Link 
                                    key={`inc-${inc.id}`} 
                                    href="/receitas"
                                    onClick={() => setIsSearchOpen(false)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-sm font-semibold text-black dark:text-white">{inc.name}</span>
                                      <span className="text-xs text-neutral-500">{formatDateBR(inc.date)}</span>
                                    </div>
                                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-500">+{formatCurrency(inc.amount)}</span>
                                  </Link>
                                ))}
                              </div>
                            )}

                            {/* Separador se tiver os dois */}
                            {searchResults.incomes.length > 0 && searchResults.transactions.length > 0 && (
                              <div className="h-px w-full bg-neutral-100 dark:bg-neutral-800 my-1" />
                            )}

                            {/* Grupo: Despesas/Lançamentos */}
                            {searchResults.transactions.length > 0 && (
                              <div>
                                <div className="px-4 py-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <TrendingDown size={12} className="text-red-500" /> Lançamentos
                                </div>
                                {searchResults.transactions.map(tx => (
                                  <Link 
                                    key={`tx-${tx.id}`} 
                                    href="/lancamentos"
                                    onClick={() => setIsSearchOpen(false)}
                                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                                  >
                                    <div className="flex flex-col">
                                      <span className="text-sm font-semibold text-black dark:text-white">
                                        {tx.description || tx.categories?.name || "Despesa"}
                                      </span>
                                      <span className="text-xs text-neutral-500">
                                        {tx.categories?.icon} {tx.categories?.name} • {formatDateBR(tx.date)}
                                      </span>
                                    </div>
                                    <span className="text-sm font-bold text-black dark:text-white">-{formatCurrency(tx.amount)}</span>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <Link href="/receitas?new=true" className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#5C67FF] text-white rounded-xl text-sm font-semibold hover:bg-[#4A54D4] transition-colors shadow-sm whitespace-nowrap">
                    <Plus size={16} /> Receita
                  </Link>
                  <Link href="/lancamentos?new=true" className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#5C67FF] text-white rounded-xl text-sm font-semibold hover:bg-[#4A54D4] transition-colors shadow-sm whitespace-nowrap">
                    <Plus size={16} /> Lançamento
                  </Link>
                </div>
              ) : (
                <div /> 
              )}
              
              {/* Perfil e Tema */}
              <div className="flex items-center gap-4 shrink-0 ml-4">
                {mounted && (
                  <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="p-2.5 rounded-full bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800/80 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-black dark:text-white transition-colors shadow-sm" aria-label="Alternar tema">
                    {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                  </button>
                )}

                <div className="relative" ref={dropdownRef}>
                  <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-3 group focus:outline-none">
                    <div className="flex flex-col text-right">
                      <span className="text-sm font-semibold text-black dark:text-white tracking-tight leading-tight group-hover:opacity-80 transition-opacity">{profile.username}</span>
                      <span className="text-[10px] font-bold tracking-widest text-neutral-500 dark:text-neutral-400 uppercase">{profile.plan_type}</span>
                    </div>

                    <div className="relative">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-center text-neutral-700 dark:text-neutral-400 font-bold text-sm group-hover:opacity-80 transition-opacity">
                        {profile.avatar_url ? <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" /> : getInitials(profile.full_name || profile.username)}
                      </div>
                      <div className="absolute -bottom-1 -right-1 bg-white dark:bg-[#0E0E0E] rounded-full p-0.5 border border-neutral-200 dark:border-neutral-800">
                        <ChevronDown size={12} className="text-neutral-500 dark:text-neutral-400" />
                      </div>
                    </div>
                  </button>

                  {isDropdownOpen && (
                    <div className="absolute top-full right-0 mt-3 w-52 bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl py-2 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <Link href="/perfil" onClick={() => setIsDropdownOpen(false)} className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <User size={18} className="text-neutral-500" /> Meu Perfil
                      </Link>
                      <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800 my-1" />
                      <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
                        <LogOut size={18} /> Sair da conta
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:px-8 md:pt-10 md:pb-8 flex flex-col">
            <div className="flex-1 w-full">
              {children}
            </div>
            <footer className="w-full max-w-[1600px] mx-auto mt-12 pt-6 border-t border-neutral-200 dark:border-neutral-800/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-500 font-medium shrink-0">
              <p>© {new Date().getFullYear()} 2Mangos. Todos os direitos reservados.</p>
              <div className="flex items-center gap-6">
                <Link href="/politica-de-privacidade" className="hover:text-black dark:hover:text-white transition-colors">Política de Privacidade</Link>
                <Link href="/contato" className="hover:text-black dark:hover:text-white transition-colors">Contato</Link>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </>
  );
}