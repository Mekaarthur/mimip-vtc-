import { useState, useEffect } from 'react'
import { Phone, Wallet, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePayment, PaymentOperator } from '@/hooks/usePayment'
import { formatXAF } from '@/integrations/supabase/types'

interface PaymentModalProps {
  amount: number
  walletBalance: number
  rideId?: string
  walletId?: string
  type?: 'topup' | 'ride'
  onSuccess: () => void
  onCancel: () => void
}

const OPERATORS = [
  {
    id: 'mtn_momo' as PaymentOperator,
    name: 'MTN MoMo',
    color: 'bg-yellow-400 text-yellow-900',
    border: 'border-yellow-400',
    prefix: '67, 68, 65',
    logo: '🟡',
  },
  {
    id: 'orange_money' as PaymentOperator,
    name: 'Orange Money',
    color: 'bg-orange-500 text-white',
    border: 'border-orange-500',
    prefix: '69, 65, 66',
    logo: '🟠',
  },
  {
    id: 'wallet' as PaymentOperator,
    name: 'Portefeuille',
    color: 'bg-green-600 text-white',
    border: 'border-green-600',
    prefix: '',
    logo: '💳',
  },
]

export function PaymentModal({
  amount,
  walletBalance,
  rideId,
  walletId,
  type = 'ride',
  onSuccess,
  onCancel,
}: PaymentModalProps) {
  const [operator, setOperator] = useState<PaymentOperator>('mtn_momo')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [referenceId, setReferenceId] = useState<string | null>(null)
  const [pollCount, setPollCount] = useState(0)
  const { initiatePayment, checkPaymentStatus, loading, status } = usePayment()

  // Polling du statut après initiation MoMo
  useEffect(() => {
    if (!referenceId || status !== 'pending' || operator === 'wallet') return
    if (pollCount >= 20) return // max 2 minutes

    const timer = setTimeout(async () => {
      const s = await checkPaymentStatus(referenceId)
      if (s === 'success') { onSuccess(); return }
      if (s === 'failed') return
      setPollCount(p => p + 1)
    }, 6000)

    return () => clearTimeout(timer)
  }, [referenceId, pollCount, status, operator])

  function validatePhone(value: string): boolean {
    const clean = value.replace(/\D/g, '')
    if (operator === 'mtn_momo' && !/^(237)?6[5-8]\d{7}$/.test(clean)) {
      setPhoneError('Numéro MTN invalide (ex: 677 000 000)')
      return false
    }
    if (operator === 'orange_money' && !/^(237)?6[569]\d{7}$/.test(clean)) {
      setPhoneError('Numéro Orange Money invalide')
      return false
    }
    setPhoneError('')
    return true
  }

  async function handlePay() {
    if (operator !== 'wallet' && !validatePhone(phone)) return

    const result = await initiatePayment({
      operator,
      phone: operator !== 'wallet' ? `237${phone.replace(/\D/g, '').replace(/^237/, '')}` : undefined,
      amount,
      ride_id: rideId,
      wallet_id: walletId,
      type,
    })

    if (result.success) {
      if (operator === 'wallet') {
        onSuccess()
      } else if (result.reference_id) {
        setReferenceId(result.reference_id)
      }
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <p className="text-xl font-bold text-green-700">Paiement confirmé !</p>
        <p className="text-gray-500">{formatXAF(amount)} reçus</p>
        <Button onClick={onSuccess} className="w-full bg-green-600 hover:bg-green-700">
          Continuer
        </Button>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <XCircle className="w-16 h-16 text-red-500" />
        <p className="text-xl font-bold text-red-700">Paiement échoué</p>
        <p className="text-gray-500 text-center">Vérifiez votre solde ou réessayez.</p>
        <Button onClick={() => { setPollCount(0); setReferenceId(null) }} className="w-full">
          Réessayer
        </Button>
        <Button variant="ghost" onClick={onCancel} className="w-full">Annuler</Button>
      </div>
    )
  }

  if (referenceId && status === 'pending' && operator !== 'wallet') {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 className="w-16 h-16 text-yellow-500 animate-spin" />
        <p className="text-lg font-semibold">En attente de confirmation</p>
        <p className="text-gray-500 text-center text-sm">
          Ouvrez l'application {operator === 'mtn_momo' ? 'MTN MoMo' : 'Orange Money'} ou composez le code USSD pour valider.
        </p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 w-full text-center">
          <p className="text-yellow-800 font-bold text-xl">{formatXAF(amount)}</p>
          <p className="text-yellow-600 text-sm">À confirmer sur votre téléphone</p>
        </div>
        {operator === 'mtn_momo' && (
          <p className="text-sm text-gray-400">MTN MoMo : *126# → Payer</p>
        )}
        {operator === 'orange_money' && (
          <p className="text-sm text-gray-400">Orange Money : #150*50#</p>
        )}
        <p className="text-xs text-gray-400">Vérification automatique en cours… ({pollCount * 6}s)</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-center mb-2">
        <p className="text-gray-500 text-sm">Montant à payer</p>
        <p className="text-3xl font-bold text-gray-900">{formatXAF(amount)}</p>
      </div>

      {/* Choix opérateur */}
      <div className="grid grid-cols-3 gap-2">
        {OPERATORS.map(op => (
          <button
            key={op.id}
            onClick={() => setOperator(op.id)}
            disabled={op.id === 'wallet' && walletBalance < amount}
            className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all
              ${operator === op.id ? `${op.border} bg-opacity-10` : 'border-gray-200'}
              ${op.id === 'wallet' && walletBalance < amount ? 'opacity-40 cursor-not-allowed' : 'hover:border-gray-400'}
            `}
          >
            <span className="text-2xl">{op.logo}</span>
            <span className="text-xs font-semibold text-gray-700">{op.name}</span>
            {op.id === 'wallet' && (
              <Badge variant="secondary" className="text-xs px-1">
                {formatXAF(walletBalance)}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Champ numéro */}
      {operator !== 'wallet' && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            Numéro {operator === 'mtn_momo' ? 'MTN' : 'Orange'} (+237)
          </label>
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2 focus-within:border-yellow-400">
            <Phone className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-gray-500 text-sm">+237</span>
            <input
              type="tel"
              placeholder="6XX XXX XXX"
              value={phone}
              onChange={e => {
                setPhone(e.target.value)
                setPhoneError('')
              }}
              onBlur={() => phone && validatePhone(phone)}
              className="flex-1 outline-none text-sm bg-transparent"
              maxLength={9}
            />
          </div>
          {phoneError && (
            <p className="text-red-500 text-xs flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {phoneError}
            </p>
          )}
          <p className="text-xs text-gray-400">
            Préfixes acceptés : {OPERATORS.find(o => o.id === operator)?.prefix}
          </p>
        </div>
      )}

      {operator === 'wallet' && (
        <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700 text-center">
          Solde disponible : <strong>{formatXAF(walletBalance)}</strong><br />
          Après paiement : <strong>{formatXAF(walletBalance - amount)}</strong>
        </div>
      )}

      <Button
        onClick={handlePay}
        disabled={loading || (operator !== 'wallet' && !phone)}
        className="w-full h-12 text-base font-semibold bg-yellow-400 hover:bg-yellow-500 text-yellow-900"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Traitement…</>
        ) : (
          <><Wallet className="w-4 h-4 mr-2" /> Payer {formatXAF(amount)}</>
        )}
      </Button>

      <Button variant="ghost" onClick={onCancel} className="w-full text-gray-500">
        Annuler
      </Button>
    </div>
  )
}
