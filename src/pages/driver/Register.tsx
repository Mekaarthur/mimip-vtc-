import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Upload, CheckCircle, Car, FileText, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { VehicleType } from '@/integrations/supabase/types'

const STEPS = [
  { id: 1, label: 'Véhicule', icon: Car },
  { id: 2, label: 'Documents', icon: FileText },
  { id: 3, label: 'Confirmation', icon: CheckCircle },
]

const VEHICLE_TYPES: { type: VehicleType; label: string; desc: string }[] = [
  { type: 'standard', label: 'Standard', desc: 'Berline 4 places' },
  { type: 'comfort', label: 'Confort', desc: 'Véhicule premium' },
  { type: 'van', label: 'Van', desc: 'Minibus 6+ places' },
  { type: 'moto', label: 'Moto', desc: 'Taxi-moto' },
]

const REQUIRED_DOCS = [
  { id: 'cni', label: 'Carte Nationale d\'Identité', required: true },
  { id: 'permis', label: 'Permis de conduire', required: true },
  { id: 'assurance', label: 'Assurance véhicule', required: true },
  { id: 'carte_grise', label: 'Carte grise', required: true },
  { id: 'visite_technique', label: 'Visite technique', required: false },
  { id: 'photo_vehicule', label: 'Photo du véhicule', required: true },
] as const

export default function DriverRegister() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()

  const [step, setStep] = useState(1)
  const [vehicleType, setVehicleType] = useState<VehicleType>('standard')
  const [vehicleBrand, setVehicleBrand] = useState('')
  const [vehicleModel, setVehicleModel] = useState('')
  const [vehicleColor, setVehicleColor] = useState('')
  const [vehicleYear, setVehicleYear] = useState('')
  const [plateNumber, setPlateNumber] = useState('')
  const [uploads, setUploads] = useState<Record<string, File>>({})
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleUpload = (docId: string, file: File) => {
    setUploads(prev => ({ ...prev, [docId]: file }))
  }

  const handleSubmit = async () => {
    if (!user) return
    setSubmitting(true)

    // Créer le profil chauffeur
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .insert({
        profile_id: user.id,
        vehicle_type: vehicleType,
        vehicle_brand: vehicleBrand,
        vehicle_model: vehicleModel,
        vehicle_color: vehicleColor,
        vehicle_year: parseInt(vehicleYear) || null,
        plate_number: plateNumber.toUpperCase(),
        status: 'offline',
      })
      .select()
      .single()

    if (driverError) {
      toast({ title: 'Erreur', description: driverError.message, variant: 'destructive' })
      setSubmitting(false)
      return
    }

    // Upload documents
    for (const [docId, file] of Object.entries(uploads)) {
      setUploading(true)
      const path = `${user.id}/${docId}/${file.name}`
      const { data: uploadData } = await supabase.storage
        .from('driver-documents')
        .upload(path, file, { upsert: true })

      if (uploadData) {
        const { data: urlData } = supabase.storage.from('driver-documents').getPublicUrl(path)
        await supabase.from('driver_documents').insert({
          driver_id: driver.id,
          type: docId,
          file_url: urlData.publicUrl,
          status: 'pending',
        })
      }
    }

    // Ajouter le rôle chauffeur
    await supabase.from('user_roles').insert({ user_id: user.id, role: 'driver' }).onConflict('user_id, role').ignore()

    setUploading(false)
    setSubmitting(false)
    setStep(3)
  }

  const requiredDone = REQUIRED_DOCS.filter(d => d.required).every(d => uploads[d.id])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : navigate('/')} className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-gray-900">Devenir chauffeur Mimip</h1>
        </div>

        {/* PROGRESS */}
        <div className="max-w-2xl mx-auto px-4 pb-4">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  step >= s.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}>
                  {step > s.id ? <CheckCircle className="w-4 h-4" /> : s.id}
                </div>
                <span className={`text-xs ${step >= s.id ? 'text-orange-500 font-medium' : 'text-gray-400'}`}>{s.label}</span>
                {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 ${step > s.id ? 'bg-orange-400' : 'bg-gray-100'}`} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* STEP 1 — VÉHICULE */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Type de véhicule</h2>
              <div className="grid grid-cols-2 gap-3">
                {VEHICLE_TYPES.map(v => (
                  <button
                    key={v.type}
                    onClick={() => setVehicleType(v.type)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      vehicleType === v.type ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <Car className={`w-5 h-5 mb-1 ${vehicleType === v.type ? 'text-orange-500' : 'text-gray-400'}`} />
                    <div className="font-semibold text-sm text-gray-900">{v.label}</div>
                    <div className="text-xs text-gray-500">{v.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-3">
              <h2 className="font-semibold text-gray-900 mb-2">Informations du véhicule</h2>
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Marque (ex: Toyota)" value={vehicleBrand} onChange={e => setVehicleBrand(e.target.value)} className="h-11 rounded-xl" />
                <Input placeholder="Modèle (ex: Corolla)" value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} className="h-11 rounded-xl" />
                <Input placeholder="Couleur" value={vehicleColor} onChange={e => setVehicleColor(e.target.value)} className="h-11 rounded-xl" />
                <Input placeholder="Année" type="number" value={vehicleYear} onChange={e => setVehicleYear(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <Input
                placeholder="Plaque d'immatriculation (ex: LT 1234 A)"
                value={plateNumber}
                onChange={e => setPlateNumber(e.target.value)}
                className="h-11 rounded-xl uppercase"
              />
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!vehicleBrand || !vehicleModel || !plateNumber}
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold"
            >
              Continuer →
            </Button>
          </div>
        )}

        {/* STEP 2 — DOCUMENTS */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm text-blue-700 font-medium">📋 Documents requis</p>
              <p className="text-xs text-blue-600 mt-1">Vos documents seront vérifiés sous 24-48h. Formats acceptés : JPG, PNG, PDF.</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              {REQUIRED_DOCS.map(doc => (
                <div key={doc.id}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-900">
                      {doc.label}
                      {doc.required && <span className="text-red-400 ml-1">*</span>}
                    </span>
                    {uploads[doc.id] && <CheckCircle className="w-4 h-4 text-green-500" />}
                  </div>
                  <label className={`flex items-center gap-3 border-2 border-dashed rounded-xl p-4 cursor-pointer transition-all ${
                    uploads[doc.id] ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-orange-300'
                  }`}>
                    <Upload className={`w-5 h-5 ${uploads[doc.id] ? 'text-green-500' : 'text-gray-400'}`} />
                    <span className="text-sm text-gray-600">
                      {uploads[doc.id] ? uploads[doc.id].name : 'Cliquez pour uploader'}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={e => e.target.files?.[0] && handleUpload(doc.id, e.target.files[0])}
                    />
                  </label>
                </div>
              ))}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!requiredDone || submitting}
              className="w-full h-12 bg-orange-500 hover:bg-orange-600 rounded-xl font-semibold"
            >
              {submitting ? 'Envoi en cours...' : 'Soumettre ma candidature'}
            </Button>
          </div>
        )}

        {/* STEP 3 — CONFIRMATION */}
        {step === 3 && (
          <div className="text-center py-10 space-y-5">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Candidature envoyée !</h2>
            <p className="text-gray-500 max-w-sm mx-auto">
              Votre dossier est en cours de vérification. Nous vous contacterons sous 24-48h par SMS.
            </p>
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 text-left space-y-2">
              <p className="text-sm font-medium text-orange-700">Prochaines étapes :</p>
              <ul className="text-sm text-orange-600 space-y-1">
                <li>✓ Vérification de vos documents</li>
                <li>✓ Validation du véhicule</li>
                <li>✓ Formation en ligne (30 min)</li>
                <li>✓ Activation de votre compte chauffeur</li>
              </ul>
            </div>
            <Button onClick={() => navigate('/')} className="bg-orange-500 hover:bg-orange-600 rounded-full px-8">
              Retour à l'accueil
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
