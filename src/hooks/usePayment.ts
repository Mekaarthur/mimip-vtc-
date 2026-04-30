import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export type PaymentOperator = 'mtn_momo' | 'orange_money' | 'wallet'
export type PaymentType = 'topup' | 'ride'

export interface PaymentRequest {
  operator: PaymentOperator
  phone?: string
  amount: number
  ride_id?: string
  wallet_id?: string
  type: PaymentType
}

export interface PaymentResult {
  success: boolean
  reference_id?: string
  payment_url?: string
  error?: string
}

export function usePayment() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle')
  const { toast } = useToast()

  async function initiatePayment(req: PaymentRequest): Promise<PaymentResult> {
    setLoading(true)
    setStatus('pending')

    try {
      if (req.operator === 'wallet') {
        return await payWithWallet(req)
      }

      const fn = req.operator === 'mtn_momo' ? 'mtn-momo' : 'orange-money'
      const { data, error } = await supabase.functions.invoke(fn, {
        body: {
          phone: req.phone,
          amount: req.amount,
          ride_id: req.ride_id,
          wallet_id: req.wallet_id,
          type: req.type,
        },
      })

      if (error) throw new Error(error.message)
      if (data.error) throw new Error(data.error)

      // Orange Money retourne une URL de paiement
      if (data.payment_url) {
        window.open(data.payment_url, '_blank')
      } else {
        toast({
          title: 'Paiement initié',
          description: 'Confirmez le paiement sur votre téléphone.',
        })
      }

      setStatus('pending')
      return { success: true, reference_id: data.reference_id, payment_url: data.payment_url }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur de paiement'
      setStatus('failed')
      toast({ title: 'Paiement échoué', description: msg, variant: 'destructive' })
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }

  async function payWithWallet(req: PaymentRequest): Promise<PaymentResult> {
    const { data: wallet, error: wErr } = await supabase
      .from('wallets')
      .select('id, balance')
      .single()

    if (wErr || !wallet) throw new Error('Portefeuille introuvable')
    if (wallet.balance < req.amount) throw new Error('Solde insuffisant')

    const newBalance = wallet.balance - req.amount
    const { error } = await supabase
      .from('wallets')
      .update({ balance: newBalance })
      .eq('id', wallet.id)

    if (error) throw new Error(error.message)

    await supabase.from('wallet_transactions').insert({
      wallet_id: wallet.id,
      type: 'ride',
      amount: -req.amount,
      balance_after: newBalance,
      description: 'Paiement course Mimip',
      ride_id: req.ride_id,
      status: 'success',
    })

    if (req.ride_id) {
      await supabase
        .from('rides')
        .update({ payment_status: 'success' })
        .eq('id', req.ride_id)
    }

    setStatus('success')
    toast({ title: 'Paiement effectué', description: `${req.amount.toLocaleString()} XAF débités` })
    return { success: true }
  }

  async function checkPaymentStatus(referenceId: string): Promise<string> {
    const { data } = await supabase
      .from('mobile_money_transactions')
      .select('status')
      .eq('operator_reference', referenceId)
      .single()

    const s = data?.status ?? 'pending'
    if (s === 'success') setStatus('success')
    else if (s === 'failed') setStatus('failed')
    return s
  }

  function reset() {
    setStatus('idle')
    setLoading(false)
  }

  return { initiatePayment, checkPaymentStatus, reset, loading, status }
}
