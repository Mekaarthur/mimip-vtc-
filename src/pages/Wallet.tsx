import { useState, useEffect } from 'react'
import { ArrowLeft, TrendingUp, TrendingDown, Plus, Minus, Smartphone, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { Wallet as WalletType, WalletTransaction, MobileMoneyTransaction, formatXAF, MomoOperator } from '@/integrations/supabase/types'

export default function Wallet() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()

  const [wallet, setWallet] = useState<WalletType | null>(null)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showTopup, setShowTopup] = useState(false)
  const [operator, setOperator] = useState<MomoOperator>('mtn_momo')
  const [momoPhone, setMomoPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [{ data: w }, { data: tx }] = await Promise.all([
        supabase.from('wallets').select('*').eq('user_id', user.id).single(),
        supabase.from('wallet_transactions')
          .select('*')
          .eq('wallet_id', (await supabase.from('wallets').select('id').eq('user_id', user.id).single()).data?.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ])
      setWallet(w)
      setTransactions(tx ?? [])
      setLoading(false)
    }
    load()
  }, [user])

  const handleTopup = async () => {
    if (!momoPhone || !amount || !wallet) return
    const amountNum = parseInt(amount)
    if (isNaN(amountNum) || amountNum < 500) {
      toast({ title: 'Montant invalide', description: 'Minimum 500 XAF', variant: 'destructive' })
      return
    }
    setProcessing(true)
    const { error } = await supabase.from('mobile_money_transactions').insert({
      user_id: user!.id,
      wallet_id: wallet.id,
      operator,
      phone: `+237${momoPhone}`,
      amount: amountNum,
      type: 'topup',
    })
    setProcessing(false)
    if (error) {
      toast({ title: 'Erreur', description: error.message, variant: 'destructive' })
    } else {
      toast({
        title: 'Demande envoyée !',
        description: `Confirmez le paiement de ${formatXAF(amountNum)} sur votre ${operator === 'mtn_momo' ? 'MTN MoMo' : 'Orange Money'}.`,
      })
      setShowTopup(false)
      setAmount('')
      setMomoPhone('')
    }
  }

  const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000]

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-semibold text-gray-900">Mon Portefeuille</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* CARTE SOLDE */}
        <div className="bg-gradient-to-br from-green-500 to-teal-600 rounded-3xl p-6 text-white shadow-lg">
          <p className="text-green-100 text-sm mb-1">Solde disponible</p>
          <p className="text-4xl font-bold mb-6">{wallet ? formatXAF(wallet.balance) : '...'}</p>
          <div className="flex gap-3">
            <Button
              onClick={() => setShowTopup(true)}
              className="flex-1 bg-white/20 hover:bg-white/30 text-white border-0 rounded-xl"
            >
              <Plus className="w-4 h-4 mr-1" /> Recharger
            </Button>
            <Button
              variant="outline"
              className="flex-1 bg-white/10 hover:bg-white/20 text-white border-white/30 rounded-xl"
            >
              <Minus className="w-4 h-4 mr-1" /> Retirer
            </Button>
          </div>
        </div>

        {/* RECHARGE MOMO */}
        {showTopup && (
          <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Recharger via Mobile Money</h2>

            {/* OPÉRATEUR */}
            <div className="grid grid-cols-2 gap-3">
              {(['mtn_momo', 'orange_money'] as MomoOperator[]).map(op => (
                <button
                  key={op}
                  onClick={() => setOperator(op)}
                  className={`p-4 rounded-xl border-2 transition-all text-center ${
                    operator === op ? 'border-orange-400 bg-orange-50' : 'border-gray-100'
                  }`}
                >
                  <Smartphone className={`w-6 h-6 mx-auto mb-1 ${
                    op === 'mtn_momo' ? 'text-yellow-500' : 'text-orange-500'
                  }`} />
                  <span className="text-sm font-medium">{op === 'mtn_momo' ? 'MTN MoMo' : 'Orange Money'}</span>
                </button>
              ))}
            </div>

            {/* TÉLÉPHONE */}
            <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 h-12 focus-within:border-orange-400">
              <span className="text-gray-500 font-medium text-sm">🇨🇲 +237</span>
              <div className="w-px h-6 bg-gray-200" />
              <input
                type="tel"
                className="flex-1 outline-none text-gray-900 placeholder-gray-400 text-sm"
                placeholder="6XX XXX XXX"
                value={momoPhone}
                onChange={e => setMomoPhone(e.target.value.replace(/\D/g, ''))}
                maxLength={9}
              />
            </div>

            {/* MONTANTS RAPIDES */}
            <div>
              <p className="text-sm text-gray-500 mb-2">Montant (XAF)</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {QUICK_AMOUNTS.map(a => (
                  <button
                    key={a}
                    onClick={() => setAmount(String(a))}
                    className={`py-2 rounded-lg text-sm font-medium border transition-all ${
                      amount === String(a) ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-gray-100 text-gray-600 hover:border-gray-200'
                    }`}
                  >
                    {formatXAF(a)}
                  </button>
                ))}
              </div>
              <input
                type="number"
                className="w-full border border-gray-200 rounded-xl px-4 h-12 outline-none focus:border-orange-400 text-gray-900"
                placeholder="Ou entrez un montant"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowTopup(false)} className="flex-1 rounded-xl h-12">
                Annuler
              </Button>
              <Button
                onClick={handleTopup}
                disabled={processing || !momoPhone || !amount}
                className="flex-1 bg-orange-500 hover:bg-orange-600 rounded-xl h-12"
              >
                {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : `Recharger ${amount ? formatXAF(parseInt(amount) || 0) : ''}`}
              </Button>
            </div>
          </div>
        )}

        {/* HISTORIQUE */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Transactions récentes</h2>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm">Aucune transaction pour le moment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center gap-3 py-2">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                    tx.amount > 0 ? 'bg-green-100' : 'bg-red-100'
                  }`}>
                    {tx.amount > 0
                      ? <TrendingUp className="w-4 h-4 text-green-500" />
                      : <TrendingDown className="w-4 h-4 text-red-500" />
                    }
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 capitalize">{tx.description ?? tx.type}</p>
                    <p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleDateString('fr-CM')}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.amount > 0 ? '+' : ''}{formatXAF(tx.amount)}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {tx.status === 'success' ? '✓' : tx.status === 'pending' ? '⏳' : '✗'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
