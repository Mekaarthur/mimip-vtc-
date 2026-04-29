import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Car, Phone, Mail, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'

type Step = 'method' | 'phone_entry' | 'otp' | 'email'

export default function Auth() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { signInWithPhone, verifyOtp, signInWithEmail, signUpWithEmail } = useAuth()

  const [step, setStep] = useState<Step>('method')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSendOtp = async () => {
    if (!phone || phone.length < 9) {
      toast({ title: 'Numéro invalide', description: 'Entrez un numéro camerounais valide', variant: 'destructive' })
      return
    }
    setLoading(true)
    const { error } = await signInWithPhone(phone)
    setLoading(false)
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: 'Code envoyé !', description: `Un SMS a été envoyé au +237${phone}` })
      setStep('otp')
    }
  }

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      toast({ title: 'Code invalide', description: 'Le code doit contenir 6 chiffres', variant: 'destructive' })
      return
    }
    setLoading(true)
    const { error } = await verifyOtp(phone, otp)
    setLoading(false)
    if (error) {
      toast({ title: 'Code incorrect', description: 'Vérifiez le code et réessayez', variant: 'destructive' })
    } else {
      toast({ title: 'Connecté !', description: 'Bienvenue sur Mimip' })
      navigate('/book')
    }
  }

  const handleEmailAuth = async () => {
    if (!email || !password) return
    setLoading(true)
    const { error } = isSignUp
      ? await signUpWithEmail(email, password, fullName)
      : await signInWithEmail(email, password)
    setLoading(false)
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } else {
      toast({ title: isSignUp ? 'Compte créé !' : 'Connecté !', description: 'Bienvenue sur Mimip' })
      navigate('/book')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* LOGO */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
              <Car className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">Mimip</span>
          </Link>
          <p className="text-gray-500 mt-2 text-sm">Connectez-vous pour réserver une course</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl p-8">
          {step === 'method' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900 text-center mb-6">Choisir une méthode</h2>
              <Button
                onClick={() => setStep('phone_entry')}
                className="w-full h-12 bg-green-600 hover:bg-green-700 rounded-xl text-base"
              >
                <Phone className="w-5 h-5 mr-2" />
                Continuer avec le téléphone
              </Button>
              <Button
                onClick={() => setStep('email')}
                variant="outline"
                className="w-full h-12 rounded-xl text-base border-gray-200"
              >
                <Mail className="w-5 h-5 mr-2" />
                Continuer avec l'email
              </Button>
              <p className="text-xs text-gray-400 text-center pt-2">
                En continuant, vous acceptez nos CGU et politique de confidentialité.
              </p>
            </div>
          )}

          {step === 'phone_entry' && (
            <div className="space-y-4">
              <button onClick={() => setStep('method')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>
              <h2 className="text-xl font-bold text-gray-900">Votre numéro</h2>
              <p className="text-sm text-gray-500">Un SMS de vérification vous sera envoyé</p>
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 h-12 focus-within:border-orange-400 transition-colors">
                <span className="text-gray-500 font-medium text-sm">🇨🇲 +237</span>
                <div className="w-px h-6 bg-gray-200" />
                <input
                  type="tel"
                  className="flex-1 outline-none text-gray-900 placeholder-gray-400"
                  placeholder="6XX XXX XXX"
                  value={phone}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
                  maxLength={9}
                />
              </div>
              <Button
                onClick={handleSendOtp}
                disabled={loading || phone.length < 9}
                className="w-full h-12 bg-orange-500 hover:bg-orange-600 rounded-xl text-base font-semibold"
              >
                {loading ? 'Envoi...' : 'Envoyer le code'}
              </Button>
            </div>
          )}

          {step === 'otp' && (
            <div className="space-y-4">
              <button onClick={() => setStep('phone_entry')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>
              <h2 className="text-xl font-bold text-gray-900">Code de vérification</h2>
              <p className="text-sm text-gray-500">
                Entrez le code à 6 chiffres envoyé au <strong>+237 {phone}</strong>
              </p>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="000000"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-widest h-14 rounded-xl border-gray-200 focus:border-orange-400"
              />
              <Button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                className="w-full h-12 bg-orange-500 hover:bg-orange-600 rounded-xl text-base font-semibold"
              >
                {loading ? 'Vérification...' : 'Vérifier'}
              </Button>
              <button
                onClick={handleSendOtp}
                className="w-full text-sm text-orange-500 hover:underline"
              >
                Renvoyer le code
              </button>
            </div>
          )}

          {step === 'email' && (
            <div className="space-y-4">
              <button onClick={() => setStep('method')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
                <ArrowLeft className="w-4 h-4" /> Retour
              </button>
              <Tabs value={isSignUp ? 'signup' : 'signin'} onValueChange={v => setIsSignUp(v === 'signup')}>
                <TabsList className="w-full mb-4">
                  <TabsTrigger value="signin" className="flex-1">Se connecter</TabsTrigger>
                  <TabsTrigger value="signup" className="flex-1">Créer un compte</TabsTrigger>
                </TabsList>
                <TabsContent value="signin" className="space-y-3">
                  <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="h-12 rounded-xl" />
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} className="h-12 rounded-xl pr-10" />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </TabsContent>
                <TabsContent value="signup" className="space-y-3">
                  <Input placeholder="Nom complet" value={fullName} onChange={e => setFullName(e.target.value)} className="h-12 rounded-xl" />
                  <Input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="h-12 rounded-xl" />
                  <div className="relative">
                    <Input type={showPassword ? 'text' : 'password'} placeholder="Mot de passe" value={password} onChange={e => setPassword(e.target.value)} className="h-12 rounded-xl pr-10" />
                    <button onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </TabsContent>
              </Tabs>
              <Button
                onClick={handleEmailAuth}
                disabled={loading}
                className="w-full h-12 bg-orange-500 hover:bg-orange-600 rounded-xl text-base font-semibold"
              >
                {loading ? 'Chargement...' : isSignUp ? 'Créer mon compte' : 'Se connecter'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
