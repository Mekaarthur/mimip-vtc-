import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Camera, Phone, Mail, MapPin, LogOut, ChevronRight, Bell, Shield, Car } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'

export default function Profile() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { profile, isDriver, updateProfile, signOut } = useAuth()

  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [city, setCity] = useState(profile?.city ?? 'Yaoundé')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const { error } = await updateProfile({ full_name: fullName, city })
    setSaving(false)
    if (error) {
      toast({ title: 'Erreur', description: 'Impossible de sauvegarder', variant: 'destructive' })
    } else {
      toast({ title: 'Profil mis à jour !' })
      setEditing(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  const MENU_ITEMS = [
    { icon: Car, label: 'Mes courses', action: () => navigate('/history') },
    { icon: Bell, label: 'Notifications', action: () => {} },
    { icon: Shield, label: 'Sécurité & confidentialité', action: () => {} },
    ...(isDriver ? [{ icon: Car, label: 'Tableau de bord chauffeur', action: () => navigate('/driver/dashboard') }] : []),
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-gray-900">Mon profil</h1>
          <button onClick={() => setEditing(!editing)} className="ml-auto text-sm text-orange-500 font-medium">
            {editing ? 'Annuler' : 'Modifier'}
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* AVATAR */}
        <div className="flex flex-col items-center py-6">
          <div className="relative">
            <div className="w-24 h-24 bg-orange-100 rounded-full flex items-center justify-center text-4xl font-bold text-orange-500">
              {profile?.full_name?.charAt(0) ?? '?'}
            </div>
            <button className="absolute bottom-0 right-0 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center shadow">
              <Camera className="w-4 h-4 text-white" />
            </button>
          </div>
          <h2 className="mt-3 text-xl font-bold text-gray-900">{profile?.full_name ?? 'Utilisateur'}</h2>
          <p className="text-sm text-gray-500">{profile?.city}</p>
        </div>

        {/* INFOS */}
        <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Informations personnelles</h3>

          {editing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nom complet</label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Ville</label>
                <select
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full h-11 border border-gray-200 rounded-xl px-3 outline-none focus:border-orange-400 text-gray-900"
                >
                  <option>Yaoundé</option>
                  <option>Douala</option>
                  <option>Bafoussam</option>
                  <option>Garoua</option>
                </select>
              </div>
              <Button onClick={handleSave} disabled={saving} className="w-full bg-orange-500 hover:bg-orange-600 rounded-xl h-11">
                {saving ? 'Sauvegarde...' : 'Sauvegarder'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {profile?.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{profile.phone}</span>
                </div>
              )}
              {profile?.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-700">{profile.email}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span className="text-gray-700">{profile?.city ?? 'Non renseignée'}</span>
              </div>
            </div>
          )}
        </div>

        {/* MENU */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {MENU_ITEMS.map((item, i) => (
            <button
              key={item.label}
              onClick={item.action}
              className={`w-full flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors ${
                i < MENU_ITEMS.length - 1 ? 'border-b border-gray-50' : ''
              }`}
            >
              <item.icon className="w-5 h-5 text-gray-400" />
              <span className="flex-1 text-left text-sm text-gray-700">{item.label}</span>
              <ChevronRight className="w-4 h-4 text-gray-300" />
            </button>
          ))}
        </div>

        {/* DÉCONNEXION */}
        <Button
          onClick={handleSignOut}
          variant="outline"
          className="w-full border-red-100 text-red-500 hover:bg-red-50 rounded-xl h-11"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Se déconnecter
        </Button>
      </div>
    </div>
  )
}
