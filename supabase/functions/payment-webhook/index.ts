import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

async function creditWallet(walletId: string, amount: number, description: string) {
  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('id', walletId)
    .single()

  if (!wallet) return

  const newBalance = wallet.balance + amount
  await supabase.from('wallets').update({ balance: newBalance }).eq('id', walletId)
  await supabase.from('wallet_transactions').insert({
    wallet_id: walletId,
    type: 'topup',
    amount,
    balance_after: newBalance,
    description,
    status: 'success',
  })
}

async function handleMtnWebhook(body: Record<string, unknown>) {
  const referenceId = body.financialTransactionId as string ?? body.externalId as string
  const status = (body.status as string ?? '').toUpperCase()

  const { data: tx } = await supabase
    .from('mobile_money_transactions')
    .select('*')
    .eq('operator_reference', referenceId)
    .single()

  if (!tx) return new Response('Not found', { status: 404 })

  if (status === 'SUCCESSFUL') {
    await supabase
      .from('mobile_money_transactions')
      .update({ status: 'success', completed_at: new Date().toISOString() })
      .eq('operator_reference', referenceId)

    if (tx.type === 'topup' && tx.wallet_id) {
      await creditWallet(tx.wallet_id, tx.amount, 'Recharge MTN MoMo')
    }

    if (tx.type === 'ride' && tx.ride_id) {
      await supabase
        .from('rides')
        .update({ payment_status: 'success' })
        .eq('id', tx.ride_id)
    }
  } else if (status === 'FAILED') {
    await supabase
      .from('mobile_money_transactions')
      .update({ status: 'failed', failure_reason: body.reason as string ?? 'Échec MTN' })
      .eq('operator_reference', referenceId)
  }

  return new Response('OK', { status: 200 })
}

async function handleOrangeWebhook(body: Record<string, unknown>) {
  const orderId = body.order_id as string
  const status = body.status as string

  const { data: tx } = await supabase
    .from('mobile_money_transactions')
    .select('*')
    .eq('operator_reference', orderId)
    .single()

  if (!tx) return new Response('Not found', { status: 404 })

  if (status === 'SUCCESS' || status === '00') {
    await supabase
      .from('mobile_money_transactions')
      .update({ status: 'success', completed_at: new Date().toISOString() })
      .eq('operator_reference', orderId)

    if (tx.type === 'topup' && tx.wallet_id) {
      await creditWallet(tx.wallet_id, tx.amount, 'Recharge Orange Money')
    }

    if (tx.type === 'ride' && tx.ride_id) {
      await supabase
        .from('rides')
        .update({ payment_status: 'success' })
        .eq('id', tx.ride_id)
    }
  } else {
    await supabase
      .from('mobile_money_transactions')
      .update({ status: 'failed', failure_reason: body.message as string ?? 'Échec Orange Money' })
      .eq('operator_reference', orderId)
  }

  return new Response('OK', { status: 200 })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const url = new URL(req.url)
    const operator = url.searchParams.get('operator') ?? 'mtn'

    if (operator === 'orange') return await handleOrangeWebhook(body)
    return await handleMtnWebhook(body)
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
