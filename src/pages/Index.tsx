import { Link } from 'react-router-dom'
import { Car, Shield, CreditCard, Star, MapPin, Clock, Users, ChevronRight, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/hooks/useAuth'

const STATS = [
  { value: '500+', label: 'Chauffeurs vérifiés' },
  { value: '50 000+', label: 'Courses effectuées' },
  { value: '4.8★', label: 'Note moyenne' },
  { value: '24/7', label: 'Service disponible' },
]

const FEATURES = [
  { icon: Shield, title: 'Sécurité garantie', desc: 'PIN de vérification, SOS intégré, suivi en temps réel et partage de trajet.' },
  { icon: CreditCard, title: 'Paiement flexible', desc: 'Cash, MTN Mobile Money, Orange Money ou portefeuille Mimip.' },
  { icon: Star, title: 'Prix fixe transparent', desc: 'Le prix est confirmé avant la course. Aucune mauvaise surprise.' },
  { icon: Clock, title: 'Courses planifiées', desc: 'Réservez à l\'avance pour l\'aéroport, réunions, ou événements.' },
]

const STEPS = [
  { icon: MapPin, title: 'Entrez votre destination', desc: 'Saisissez votre point de départ et d\'arrivée ou choisissez un point de repère.' },
  { icon: Car, title: 'Un chauffeur vous est assigné', desc: 'Notre algorithme vous connecte au chauffeur le plus proche et disponible.' },
  { icon: Shield, title: 'Voyagez en toute sécurité', desc: 'Confirmez avec le PIN 4 chiffres et suivez votre trajet en temps réel.' },
]

const TESTIMONIALS = [
  { name: 'Marie Ngo', city: 'Yaoundé', score: 5, text: 'Service impeccable ! Le chauffeur était ponctuel et professionnel. Je recommande Mimip à toute ma famille.' },
  { name: 'Jean-Paul Mbarga', city: 'Douala', score: 5, text: 'Le paiement MTN MoMo fonctionne parfaitement. Prix honnêtes et trajet confortable.' },
  { name: 'Christelle Ateba', city: 'Yaoundé', score: 5, text: 'J\'utilise Mimip tous les jours pour aller au travail. Fiable, rapide et sécurisé.' },
]

export default function Index() {
  const { user, isDriver } = useAuth()

  return (
    <div className="min-h-screen bg-white">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Mimip</span>
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <Link to="/book" className="hover:text-orange-500 transition-colors">Réserver</Link>
            <Link to="/history" className="hover:text-orange-500 transition-colors">Historique</Link>
            <Link to="/wallet" className="hover:text-orange-500 transition-colors">Portefeuille</Link>
            <Link to="/driver/register" className="hover:text-orange-500 transition-colors">Devenir Chauffeur</Link>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <Link to={isDriver ? '/driver/dashboard' : '/book'}>
                <Button className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-5">
                  Tableau de bord
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/auth" className="text-sm text-gray-600 hover:text-gray-900">Se connecter</Link>
                <Link to="/auth">
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-5">
                    Commander
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="bg-gradient-to-br from-orange-50 to-amber-50 pt-16 pb-24">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Badge className="bg-green-100 text-green-700 border-green-200 mb-4">
              ● N°1 au Cameroun
            </Badge>
            <h1 className="text-5xl font-extrabold text-gray-900 leading-tight mb-4">
              Voyagez en toute <span className="text-orange-500">sécurité</span> avec Mimip
            </h1>
            <p className="text-lg text-gray-600 mb-8">
              La plateforme VTC la plus fiable du Cameroun. Prix fixe, chauffeurs vérifiés, paiement mobile.
            </p>

            {/* BOOKING QUICK FORM */}
            <div className="bg-white rounded-2xl shadow-lg p-5 space-y-3">
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <MapPin className="w-5 h-5 text-orange-500 shrink-0" />
                <input className="flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400" placeholder="Point de départ" />
              </div>
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                <div className="w-5 h-5 rounded-full border-2 border-green-500 shrink-0" />
                <input className="flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400" placeholder="Destination" />
              </div>
              <Link to={user ? '/book' : '/auth'} className="block">
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-xl h-12 text-base font-semibold">
                  Réserver une course →
                </Button>
              </Link>
            </div>

            {/* STATS */}
            <div className="grid grid-cols-4 gap-4 mt-8">
              {STATS.map(s => (
                <div key={s.label} className="text-center">
                  <div className="text-xl font-bold text-gray-900">{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* MAP ILLUSTRATION */}
          <div className="hidden md:flex items-center justify-center">
            <div className="relative w-80 h-80 bg-gradient-to-br from-green-100 to-teal-100 rounded-3xl overflow-hidden shadow-xl">
              <div className="absolute inset-0 opacity-20" style={{
                backgroundImage: 'repeating-linear-gradient(0deg, #ccc 0, #ccc 1px, transparent 1px, transparent 30px), repeating-linear-gradient(90deg, #ccc 0, #ccc 1px, transparent 1px, transparent 30px)'
              }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                  <Car className="w-6 h-6 text-white" />
                </div>
              </div>
              <div className="absolute top-8 right-8 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow">
                <Car className="w-4 h-4 text-white" />
              </div>
              <div className="absolute bottom-12 left-10 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow">
                <Car className="w-4 h-4 text-white" />
              </div>
              <div className="absolute bottom-4 right-4 bg-white rounded-xl px-3 py-2 shadow text-xs font-medium text-gray-700">
                📍 Yaoundé
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Pourquoi choisir Mimip ?</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow">
                <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mb-4">
                  <f.icon className="w-6 h-6 text-orange-500" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Comment ça marche ?</h2>
          <div className="space-y-8">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-6">
                <div className="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-lg shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 pt-2">
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">{step.title}</h3>
                  <p className="text-gray-500">{step.desc}</p>
                </div>
                <step.icon className="w-8 h-8 text-orange-300 shrink-0 mt-2" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TÉMOIGNAGES */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">Ce que disent nos clients</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="p-6 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: t.score }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-orange-400 text-orange-400" />
                  ))}
                </div>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">"{t.text}"</p>
                <div className="font-semibold text-gray-900 text-sm">{t.name}</div>
                <div className="text-xs text-gray-400">{t.city}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DEVENIR CHAUFFEUR CTA */}
      <section className="py-20 bg-gradient-to-r from-orange-500 to-amber-500">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Devenez chauffeur Mimip</h2>
          <p className="text-orange-100 mb-8 text-lg">Gagnez entre 150 000 et 400 000 XAF par mois. Travaillez à votre rythme.</p>
          <div className="flex flex-wrap justify-center gap-6 mb-8 text-sm">
            <div className="flex items-center gap-2"><Users className="w-4 h-4" /> Inscription gratuite</div>
            <div className="flex items-center gap-2"><CreditCard className="w-4 h-4" /> Paiement chaque semaine</div>
            <div className="flex items-center gap-2"><Clock className="w-4 h-4" /> Horaires flexibles</div>
          </div>
          <Link to="/driver/register">
            <Button className="bg-white text-orange-500 hover:bg-orange-50 rounded-full px-8 h-12 font-semibold">
              Commencer maintenant <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-6xl mx-auto px-4 grid md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-orange-500 rounded-lg flex items-center justify-center">
                <Car className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-bold">Mimip</span>
            </div>
            <p className="text-sm">La plateforme VTC N°1 au Cameroun.</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Services</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/book" className="hover:text-white transition-colors">Réserver une course</Link></li>
              <li><Link to="/driver/register" className="hover:text-white transition-colors">Devenir chauffeur</Link></li>
              <li><Link to="/wallet" className="hover:text-white transition-colors">Portefeuille</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Villes</h4>
            <ul className="space-y-2 text-sm">
              <li>Yaoundé</li>
              <li>Douala</li>
              <li>Bafoussam (bientôt)</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Contact</h4>
            <div className="flex items-center gap-2 text-sm mb-2">
              <Phone className="w-4 h-4" />
              <span>+237 6XX XXX XXX</span>
            </div>
            <p className="text-sm">support@mimip.cm</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 mt-8 pt-6 border-t border-gray-800 text-sm text-center">
          © 2025 Mimip. Tous droits réservés.
        </div>
      </footer>
    </div>
  )
}
