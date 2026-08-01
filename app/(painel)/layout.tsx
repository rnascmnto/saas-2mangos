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
  LogOut
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

const MenuItem = ({ href, icon: Icon, label, isActive }: { href: string, icon: any, label: string, isActive: boolean }) => {
  return (
    <div className="relative group flex justify-center w-full">
      <Link 
        href={href} 
        className={`p-3 rounded-xl transition-all duration-200 flex items-center justify-center
          ${isActive 
            ? "bg-neutral-800 dark:bg-neutral-800 text-blue-500" 
            : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 hover:text-black dark:hover:text-white"
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

  const [profile, setProfile] = useState<HeaderProfile>({
    username: "Carregando...",
    plan_type: "free",
    avatar_url: "",
    full_name: "",
  });

  useEffect(() => {
    setMounted(true);

    async function loadHeaderProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data } = await supabase
          .from("profiles")
          .select("username, plan_type, avatar_url, full_name")
          .eq("id", session.user.id)
          .single();

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

  // Fechar o dropdown ao clicar fora dele
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const getInitials = (name: string) => {
    if (!name) return "RN";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  return (
    <>
      <div className="flex md:hidden h-screen w-full flex-col items-center justify-center bg-white dark:bg-black p-6 text-center">
        <MonitorSmartphone size={64} className="text-blue-600 mb-4" />
        <h2 className="text-xl font-bold text-black dark:text-white mb-2">
          Visualização não suportada
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400">
          Para garantir a melhor experiência, o 2Mangos web está disponível apenas para Tablets e Desktops.
        </p>
      </div>

      <div className="hidden md:flex h-screen w-full bg-white dark:bg-black transition-colors duration-200">
        
        {/* BARRA LATERAL */}
        <aside className="w-20 bg-white dark:bg-black border-r border-neutral-200 dark:border-neutral-800 flex flex-col items-center transition-colors duration-200 z-40 shrink-0">
          
          <div className="h-20 w-full flex items-center justify-center border-b border-neutral-200 dark:border-neutral-800">
            <Link href="/dashboard" className="w-11 h-11 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 hover:scale-105 transition-transform">
              <Wallet size={26} />
            </Link>
          </div>

          <nav className="flex-1 w-full flex flex-col items-center gap-4 pt-6">
            <MenuItem href="/dashboard" icon={LayoutDashboard} label="Visão Geral" isActive={pathname === "/dashboard"} />
            
            <div className="w-8 h-px bg-neutral-200 dark:bg-neutral-800 my-2" />
            
            <MenuItem href="/lancamentos" icon={List} label="Lançamentos" isActive={pathname === "/lancamentos"} />
            <MenuItem href="/cartoes" icon={CreditCard} label="Cartões" isActive={pathname === "/cartoes"} />
            <MenuItem href="/receitas" icon={TrendingUp} label="Receitas" isActive={pathname === "/receitas"} />
            
            <div className="w-8 h-px bg-neutral-200 dark:bg-neutral-800 my-2" />
            
            <MenuItem href="/categorias" icon={Tag} label="Categorias" isActive={pathname === "/categorias"} />
          </nav>

          <div className="w-full flex flex-col items-center gap-4 mt-auto pb-6">
            <MenuItem href="/dashboard/configuracoes" icon={Settings} label="Configurações" isActive={pathname === "/dashboard/configuracoes"} />
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* CABEÇALHO */}
          <header className="h-20 bg-transparent flex items-center px-8 justify-between z-30 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
            <div />
            
            <div className="flex items-center gap-4">
              {mounted && (
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="p-2.5 rounded-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-black dark:text-white transition-colors shadow-sm"
                  aria-label="Alternar tema"
                >
                  {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                </button>
              )}

              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-3 group focus:outline-none"
                >
                  <div className="flex flex-col text-right">
                    <span className="text-sm font-semibold text-black dark:text-white tracking-tight leading-tight group-hover:opacity-80 transition-opacity">
                      {profile.username}
                    </span>
                    <span className="text-[10px] font-bold tracking-widest text-neutral-500 dark:text-neutral-400 uppercase">
                      {profile.plan_type}
                    </span>
                  </div>

                  <div className="relative">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center justify-center text-neutral-700 dark:text-neutral-400 font-bold text-sm group-hover:opacity-80 transition-opacity">
                      {profile.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        getInitials(profile.full_name || profile.username)
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-white dark:bg-neutral-950 rounded-full p-0.5 border border-neutral-200 dark:border-neutral-800">
                      <ChevronDown size={12} className="text-neutral-500 dark:text-neutral-400" />
                    </div>
                  </div>
                </button>

                {isDropdownOpen && (
                  <div className="absolute top-full right-0 mt-3 w-52 bg-white dark:bg-[#151515] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl py-2 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <Link
                      href="/perfil"
                      onClick={() => setIsDropdownOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      <User size={18} className="text-neutral-500" />
                      Meu Perfil
                    </Link>

                    <div className="h-px w-full bg-neutral-200 dark:bg-neutral-800 my-1" />

                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <LogOut size={18} />
                      Sair da conta
                    </button>
                  </div>
                )}
              </div>

            </div>
          </header>

          {/* ÁREA DE ROLAGEM CORRIGIDA */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col">
            
            {/* O conteúdo (Dashboard, Lançamentos, etc) vai empurrar o rodapé para baixo */}
            <div className="flex-1 w-full">
              {children}
            </div>

            {/* RODAPÉ GLOBAL (Agora alinhado com o conteúdo e dentro do scroll) */}
            <footer className="w-full max-w-[1600px] mx-auto mt-12 pt-6 border-t border-neutral-200 dark:border-neutral-800/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-neutral-500 font-medium shrink-0">
              <p>© {new Date().getFullYear()} 2Mangos. Todos os direitos reservados.</p>
              <div className="flex items-center gap-6">
                <Link href="/politica-de-privacidade" className="hover:text-black dark:hover:text-white transition-colors">
                  Política de Privacidade
                </Link>
                <Link href="/contato" className="hover:text-black dark:hover:text-white transition-colors">
                  Contato
                </Link>
              </div>
            </footer>
            
          </div>
        </main>
      </div>
    </>
  );
}