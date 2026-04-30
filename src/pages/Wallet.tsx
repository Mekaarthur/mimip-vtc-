import { useState, useEffect } from 'react'
import { ArrowLeft, TrendingUp, TrendingDown, Plus, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PaymentModal } from '@/components/PaymentModal'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/integrations/supabase/client'
import { formatXAF } from '@/integrations/supabase/types'

interface WalletData { id: string; balance: number }
interface Transaction {
  id: string; type: string; amount: number; balance_after: number
  description: string | null; status: string; created_at: string
}

const TOPUP_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000]

export default function Wallet() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [wallet, setWallet] = useState<WalletData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showTopup, setShowTopup] = useState(false)
  const [topupAmount, setTopupAmount] = useState(5000)
  const [customAmount, setCustomAmount] = useState('')

  useEffect(() => { fetchWallet() }, [user])

  async function fetchWallet() {
    if (!user) return
    setLoading(true)
    const { data: w } = await supabase
      .from('wallets').select('id, balance').eq('user_id', user.id).single()
    if (w) {
      setWallet(w)
      const { data: txs } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_id', w.id)
        .order('created_at', { ascending: false })
        .limit(30)
      setTransactions(txs ?? [])
    }
    setLoading(false)
  }

  const effectiveAmount = customAmount ? parseInt(customAmount) || 0 : topupAmount

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <RefreshCw className="w-8 h-8 text-yellow-400 animate-spin" />
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
        {/* Carte solde */}
        <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-3xl p-6 text-yellow-900 shadow-lg">
          <p className="text-yellow-800 text-sm mb-1">Solde disponible</p>
          <p className="text-4xl font-black mb-6">{formatXAF(wallet?.balance ?? 0)}</p>
          <Button
            onClick={() => setShowTopup(true)}
            className="w-full bg-yellow-900 hover:bg-yellow-800 text-white rounded-xl h-12 font-bold"
          >
            <Plus className="w-4 h-4 mr-2" /> Recharger
          </Button>
        </div>

        {/* Historique */}
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
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {tx.description ?? tx.type}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(tx.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${tx.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.amount > 0 ? '+' : ''}{formatXAF(Math.abs(tx.amount))}
                    </p>
                    <Badge variant="outline" className={`text-xs ${
                      tx.status === 'success' ? 'border-green-300 text-green-600' :
                      tx.status === 'pending' ? 'border-yellow-300 text-yellow-600' :
                      'border-red-300 text-red-600'
                    }`}>
                      {tx.status === 'success' ? 'Confirmé' :
                       tx.status === 'pending' ? 'En attente' : 'Échoué'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal recharge */}
      {showTopup && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-xl text-gray-900 mb-4">Recharger le portefeuille</h3>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {TOPUP_AMOUNTS.map(amt => (
                <button
                  key={amt}
                  onClick={() => { setTopupAmount(amt); setCustomAmount('') }}
                  className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all
                    ${topupAmount === amt && !customAmount
                      ? 'border-yellow-400 bg-yellow-50 text-yellow-900'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}
                >
                  {formatXAF(amt)}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-sm text-gray-600 block mb-1">Autre montant</label>
              <div className="flex items-center gap-2 border rounded-xl px-4 py-3 focus-within:border-yellow-400">
                <input
                  type="number"
                  placeholder="Ex : 15000"
                  value={customAmount}
                  onChange={e => setCustomAmount(e.target.value)}
                  className="flex-1 outline-none text-sm"
                  min={500}
                  step={500}
                />
                <span className="text-gray-500 text-sm">XAF</span>
              </div>
              {customAmount && effectiveAmount < 500 && (
                <p className="text-red-500 text-xs mt-1">Minimum 500 XAF</p>
              )}
            </div>

            {effectiveAmount >= 500 ? (
              <PaymentModal
                amount={effectiveAmount}
                walletBalance={wallet?.balance ?? 0}
                walletId={wallet?.id}
                type="topup"
                onSuccess={() => { setShowTopup(false); fetchWallet() }}
                onCancel={() => setShowTopup(false)}
              />
            ) : (
              <Button disabled className="w-full h-12 bg-gray-200 text-gray-500">
                Saisissez un montant (min. 500 XAF)
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
