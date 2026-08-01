"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Camera, ShieldCheck, LogOut, Edit3, Loader2, Save, X } from "lucide-react"
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
  const [isEditing, setIsEditing] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  
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

      // 1. Upload da imagem para o bucket avatars
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      // 2. Pega a URL pública
      const { data: publicURLData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName)

      const avatarUrl = publicURLData.publicUrl

      // 3. Atualiza explicitamente usando o ID da sessão atual
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

  const getInitials = (name: string) => {
    if (!name) return "2M"
    const parts = name.trim().split(" ")
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-black dark:text-white">Perfil</h1>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">
          Gerencie suas informações pessoais e preferências da conta.
        </p>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-neutral-700 dark:text-neutral-300 font-bold text-xl overflow-hidden border border-neutral-300 dark:border-neutral-700">
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
            <label className="absolute bottom-0 right-0 p-1.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-black shadow-md hover:opacity-90 transition-opacity cursor-pointer">
              <Camera size={14} />
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
          </div>

          <div>
            <h2 className="text-xl font-bold text-black dark:text-white">
              {profile.full_name || "Sem Nome"}
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              @{profile.username || "usuario"}
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            {profile.plan_type.toUpperCase()}
            </div>
          </div>
        </div>

        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          <LogOut size={16} /> Sair da conta
        </button>
      </div>

      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-4">
          <h3 className="text-lg font-semibold text-black dark:text-white">
            Detalhes da Conta
          </h3>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setIsEditing(false); setEditForm(profile); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
              >
                <X size={15} /> Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-sm"
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              <Edit3 size={15} /> Editar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">
              Nome Completo
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editForm.full_name}
                onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            ) : (
              <p className="text-sm font-medium text-black dark:text-white">
                {profile.full_name || "Não informado"}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">
              Nome de Usuário
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            ) : (
              <p className="text-sm font-medium text-black dark:text-white">
                @{profile.username || "naoinformado"}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">
              Endereço de E-mail
            </label>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-black dark:text-white">
                {userEmail || "Carregando..."}
              </p>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                <ShieldCheck size={12} /> VERIFICADO
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">
              Celular
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            ) : (
              <p className="text-sm font-medium text-black dark:text-white">
                {profile.phone || "Não informado"}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}