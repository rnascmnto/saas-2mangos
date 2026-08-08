"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Camera, ShieldCheck, LogOut, Edit3, Loader2, Save, X, User, Sparkles, Download, Trash2, KeyRound, Database } from "lucide-react"
import { useRouter } from "next/navigation"

interface Profile {
  full_name: string
  username: string
  phone: string
  plan_type: string
  avatar_url: string
}

export default function PerfilPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [memberSince, setMemberSince] = useState<string>("")
  
  // Senhas
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [isChangingPwd, setIsChangingPwd] = useState(false)
  const [pwdError, setPwdError] = useState("")
  const [pwdSuccess, setPwdSuccess] = useState("")

  const [profile, setProfile] = useState<Profile>({
    full_name: "",
    username: "",
    phone: "",
    plan_type: "free",
    avatar_url: "",
  })

  const [editForm, setEditForm] = useState<Profile>(profile)

  useEffect(() => {
    async function loadUserData() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !session) {
          router.push("/login")
          return
        }

        setUserEmail(session.user.email || "")
        setUserId(session.user.id)

        // Formata a data de criação do usuário (Membro desde)
        if (session.user.created_at) {
          const dateObj = new Date(session.user.created_at)
          const formattedDate = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
          setMemberSince(formattedDate)
        }

        let { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single()

        if (!data) {
          const meta = session.user.user_metadata || {}
          const newProfile = {
            id: session.user.id,
            full_name: meta.full_name || "",
            username: meta.username || "",
            phone: meta.phone || "",
            plan_type: "free",
          }
          await supabase.from("profiles").upsert(newProfile)
          data = newProfile
        }

        const loadedProfile = {
          full_name: data.full_name || "",
          username: data.username || "",
          phone: data.phone || "",
          plan_type: data.plan_type || "free",
          avatar_url: data.avatar_url || "",
        }

        setProfile(loadedProfile)
        setEditForm(loadedProfile)
      } catch (err) {
        console.error("Erro inesperado:", err)
      } finally {
        setLoading(false)
      }
    }

    loadUserData()
  }, [router])

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: editForm.full_name,
          username: editForm.username,
          phone: editForm.phone,
        })
        .eq("id", userId)

      if (error) throw error

      setProfile(editForm)
      setIsEditing(false)
    } catch (err: any) {
      alert("Erro ao atualizar perfil: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    try {
      if (!e.target.files || e.target.files.length === 0) return
      
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        alert("Sessão expirada. Faça login novamente.")
        router.push("/login")
        return
      }

      setUploading(true)
      const file = e.target.files[0]
      const fileExt = file.name.split(".").pop()
      const fileName = `${session.user.id}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: publicURLData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName)

      const avatarUrl = publicURLData.publicUrl

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", session.user.id)

      if (updateError) throw updateError

      setProfile((prev) => ({ ...prev, avatar_url: avatarUrl }))
      setEditForm((prev) => ({ ...prev, avatar_url: avatarUrl }))
      alert("Foto de perfil atualizada com sucesso!")
    } catch (err: any) {
      alert("Erro ao enviar foto: " + (err.message || JSON.stringify(err)))
    } finally {
      setUploading(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  // --- SEGURANÇA LÓGICA ---
  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwdError("")
    setPwdSuccess("")

    if (!currentPassword || !newPassword) {
      setPwdError("Preencha a senha atual e a nova senha.")
      return
    }

    if (newPassword.length < 6) {
      setPwdError("A nova senha deve ter pelo menos 6 caracteres.")
      return
    }

    setIsChangingPwd(true)
    try {
      if (userEmail) {
        // Valida a senha atual
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: currentPassword
        })

        if (signInError) {
          throw new Error("Senha atual incorreta.")
        }
      }

      // Atualiza a senha
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError

      setPwdSuccess("Senha alterada com sucesso!")
      setCurrentPassword("")
      setNewPassword("")
    } catch (err: any) {
      setPwdError(err.message)
    } finally {
      setIsChangingPwd(false)
    }
  }

  // --- EXPORTAÇÃO EXCEL/CSV ---
  async function handleExportData() {
    if (!userId) return
    setExporting(true)
    
    try {
      // Busca receitas e despesas (junto com os nomes das categorias)
      const { data: incomes } = await supabase.from('incomes').select('*').eq('user_id', userId)
      const { data: transactions } = await supabase.from('transactions').select('*, categories(*)').eq('user_id', userId)

      // Monta um Array único com tudo formatado
      const allData = [
        ...(incomes || []).map(i => ({ date: i.date, type: 'Receita', source: i.name, amount: i.amount, status: i.status })),
        ...(transactions || []).map(t => ({ date: t.date, type: 'Despesa', source: t.categories?.name || 'Outros', amount: t.amount, status: t.status }))
      ];

      // Ordena por data
      allData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Monta o conteúdo do CSV (separado por ; para Excel no Brasil)
      let csvContent = "Data;Tipo;Origem/Categoria;Valor (R$);Status\n";

      allData.forEach(row => {
        // Formata data de YYYY-MM-DD para DD/MM/YYYY
        const dateParts = row.date.split('-');
        const dateStr = dateParts.length === 3 ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}` : row.date;
        
        // Formata o valor trocando ponto por vírgula (padrão Brasil)
        const amountStr = Number(row.amount).toFixed(2).replace('.', ',');

        csvContent += `${dateStr};${row.type};${row.source};${amountStr};${row.status}\n`;
      });

      // Adiciona o BOM (\uFEFF) para garantir que o Excel leia acentos em UTF-8 corretamente
      const bom = "\uFEFF";
      const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `extrato_2mangos_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (err) {
      alert("Erro ao exportar os dados.")
      console.error(err)
    } finally {
      setExporting(false)
    }
  }

  async function handleDeleteAccount() {
    const confirm1 = window.confirm(
      "ATENÇÃO: Você está prestes a excluir sua conta. Esta ação apagará TODOS os seus dados financeiros, faturas e históricos para sempre.\n\nDeseja continuar?"
    )
    if (!confirm1) return

    const confirm2 = window.prompt("Para confirmar a exclusão permanente, digite a palavra: EXCLUIR")
    
    if (confirm2 !== "EXCLUIR") {
      alert("Exclusão cancelada.")
      return
    }

    alert("Sua solicitação de exclusão foi recebida. Entraremos em contato com a confirmação em breve.")
  }

  const getInitials = (name: string) => {
    if (!name) return "2M"
    const parts = name.trim().split(" ")
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const cardHoverEffect = "transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:hover:bg-[#202020]"

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500 pb-12">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-black dark:text-white tracking-tight">Perfil</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1.5 flex items-center gap-1.5">
            <User size={16} className="text-blue-500" /> Gerencie suas informações pessoais e preferências da conta
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-[#1A1A1A] text-neutral-700 dark:text-neutral-300 rounded-xl text-sm font-semibold hover:bg-neutral-200 dark:hover:bg-[#222222] transition-colors w-full sm:w-auto justify-center shadow-sm"
        >
          <LogOut size={16} /> Sair da conta
        </button>
      </div>

      {/* CARD PRINCIPAL DE APRESENTAÇÃO */}
      <div className={`bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6 ${cardHoverEffect}`}>
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div className="w-20 h-20 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xl overflow-hidden shadow-sm">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                getInitials(profile.full_name)
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-white" />
                </div>
              )}
            </div>
            <label className="absolute bottom-0 right-0 p-2 rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-colors cursor-pointer">
              <Camera size={14} />
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
          </div>

          <div>
            <h2 className="text-xl font-bold text-black dark:text-white leading-tight">
              {profile.full_name || "Usuário sem nome"}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              @{profile.username || "usuario"}
            </p>
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400">
              <Sparkles size={12} /> {profile.plan_type}
            </div>
          </div>
        </div>

        {/* ESTATÍSTICA RÁPIDA DA CONTA */}
        <div className="flex items-center justify-center md:justify-end w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-neutral-100 dark:border-neutral-800/50">
          <div className="text-center md:text-right">
            <span className="block text-[11px] font-semibold text-neutral-500 mb-0.5 uppercase tracking-wide">Membro desde</span>
            <span className="text-sm font-bold text-black dark:text-white capitalize">{memberSince || "Recente"}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUNA ESQUERDA: DETALHES + SEGURANÇA (Ocupa 2 espaços) */}
        <div className={`lg:col-span-2 bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 shadow-sm space-y-8 ${cardHoverEffect}`}>
          
          {/* SESSÃO 1: DADOS PESSOAIS */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800/50 pb-4">
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white">Detalhes da Conta</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Atualize seus dados cadastrais</p>
              </div>
              
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setIsEditing(false); setEditForm(profile); }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold bg-neutral-100 dark:bg-[#222222] hover:bg-neutral-200 dark:hover:bg-[#2A2A2A] text-neutral-600 dark:text-neutral-400 transition-colors"
                  >
                    <X size={16} /> Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20 disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-neutral-100 dark:bg-[#222222] hover:bg-neutral-200 dark:hover:bg-[#2A2A2A] text-neutral-700 dark:text-neutral-300 transition-colors shadow-sm"
                >
                  <Edit3 size={16} /> Editar Perfil
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                  Nome Completo
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#222222] rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                ) : (
                  <div className="px-4 py-3 bg-neutral-50 dark:bg-[#222222] rounded-xl">
                    <p className="text-sm font-semibold text-black dark:text-white">
                      {profile.full_name || "Não informado"}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                  Nome de Usuário
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#222222] rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                ) : (
                  <div className="px-4 py-3 bg-neutral-50 dark:bg-[#222222] rounded-xl">
                    <p className="text-sm font-semibold text-black dark:text-white">
                      @{profile.username || "naoinformado"}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                  Endereço de E-mail
                </label>
                <div className="px-4 py-3 bg-neutral-50 dark:bg-[#222222] rounded-xl flex items-center justify-between">
                  <p className="text-sm font-semibold text-black dark:text-white truncate pr-2">
                    {userEmail || "Carregando..."}
                  </p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md shrink-0">
                    <ShieldCheck size={12} /> VERIFICADO
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                  Celular / WhatsApp
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#222222] rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                ) : (
                  <div className="px-4 py-3 bg-neutral-50 dark:bg-[#222222] rounded-xl">
                    <p className="text-sm font-semibold text-black dark:text-white">
                      {profile.phone || "Não informado"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="w-full h-px bg-neutral-100 dark:bg-neutral-800/50"></div>

          {/* SESSÃO 2: SEGURANÇA (SUBTÓPICO) */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2">
              <div className="text-neutral-400">
                <KeyRound size={20} />
              </div>
              <div>
                <h4 className="text-base font-bold text-black dark:text-white">Segurança</h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Altere a sua senha de acesso</p>
              </div>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              {pwdError && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">{pwdError}</p>}
              {pwdSuccess && <p className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl">{pwdSuccess}</p>}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                    Senha Atual
                  </label>
                  <input
                    type="password"
                    placeholder="Sua senha atual"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#222222] rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-2">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    placeholder="Nova senha (min. 6 caracteres)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-neutral-50 dark:bg-[#222222] rounded-xl text-sm font-medium text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isChangingPwd || !currentPassword || !newPassword}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-neutral-900 dark:bg-white text-white dark:text-black hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isChangingPwd && <Loader2 size={16} className="animate-spin" />}
                  Atualizar Senha
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* COLUNA DIREITA (Ocupa 1 espaço - DADOS DA CONTA) */}
        <div className="lg:col-span-1 space-y-6">
          <div className={`bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 shadow-sm space-y-6 ${cardHoverEffect}`}>
            <div className="flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800/50 pb-4">
              <div className="p-2 bg-neutral-100 dark:bg-[#222222] text-neutral-600 dark:text-neutral-400 rounded-lg">
                <Database size={18} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white">Dados da Conta</h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">Exportação e encerramento</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Exportar Dados */}
              <div>
                <h4 className="text-sm font-semibold text-black dark:text-white">Exportar para Excel</h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 mb-3">
                  Baixe um arquivo CSV compatível com Excel contendo todas as suas receitas e despesas.
                </p>
                <button 
                  onClick={handleExportData}
                  disabled={exporting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-100 dark:bg-[#222222] text-neutral-700 dark:text-neutral-300 rounded-xl text-sm font-semibold hover:bg-neutral-200 dark:hover:bg-[#2A2A2A] transition-colors shadow-sm disabled:opacity-50"
                >
                  {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Baixar Planilha CSV
                </button>
              </div>

              <div className="w-full h-px bg-neutral-100 dark:bg-neutral-800/50 my-2"></div>

              {/* Excluir Conta */}
              <div>
                <h4 className="text-sm font-semibold text-black dark:text-white">Exclusão de Conta</h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 mb-3">
                  A exclusão é permanente e não poderá ser desfeita posteriormente.
                </p>
                <button 
                  onClick={handleDeleteAccount}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-500 rounded-xl text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <Trash2 size={16} /> Excluir permanentemente
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  )
}