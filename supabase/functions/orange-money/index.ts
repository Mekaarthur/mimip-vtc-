import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OM_BASE_URL = Deno.env.get('ORANGE_MONEY_BASE_URL') ?? 'https://api.orange.com'
const OM_CLIENT_ID = Deno.env.get('ORANGE_MONEY_CLIENT_ID') ?? ''
const OM_CLIENT_SECRET = Deno.env.get('ORANGE_MONEY_CLIENT_SECRET') ?? ''
const OM_MERCHANT_KEY = Deno.env.get('ORANGE_MONEY_MERCHANT_KEY') ?? ''
const CALLBACK_URL = Deno.env.get('SUPABASE_URL') + '/functions/v1/payment-webhook'
const CANCEL_URL = Deno.env.get('APP_URL') + '/wallet?status=cancelled'
const RETURN_URL = Deno.env.get('APP_URL') + '/wallet?status=success'

async function getOrangeToken(): Promise<string> {
  const credentials = btoa(`${OM_CLIENT_ID}:${OM_CLIENT_SECRET}`)
  const res = await fetch(`${OM_BASE_URL}/oauth/v3/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: 'grant_type=client_credentials',
  })
  const data = await res.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { phone, amount, ride_id, wallet_id, type } = await req.json()

    // Valider numéro Orange Cameroun (65x ou 69x)
    const phoneClean = phone.replace(/\D/g, '').replace(/^237/, '')
    if (!/^6[5689]\d{7}$/.test(phoneClean)) {
      return new Response(
        JSON.stringify({ error: 'Numéro Orange Money invalide' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    const phoneIntl = `+237${phoneClean}`

    const token = await getOrangeToken()
    const orderId = crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()

    // Initier paiement Orange Money Web Payment
    const payRes = await fetch(`${OM_BASE_URL}/orange-money-webpay/cm/v1/webpayment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        merchant_key: OM_MERCHANT_KEY,
        currency: 'XAF',
        order_id: orderId,
        amount: String(amount),
        return_url: RETURN_URL,
        cancel_url: CANCEL_URL,
        notif_url: CALLBACK_URL,
        lang: 'fr',
        reference: ride_id ?? wallet_id ?? orderId,
      }),
    })

    if (!payRes.ok) {
      const err = await payRes.text()
      return new Response(
        JSON.stringify({ error: 'Erreur Orange Money', detail: err }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    const data = await payRes.json()

    // Enregistrer la transaction
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    await supabase.from('mobile_money_transactions').insert({
      user_id: (await supabase.auth.getUser(
        req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
      )).data.user?.id,
      wallet_id,
      operator: 'orange_money',
      phone: phoneIntl,
      amount,
      type: type ?? 'topup',
      status: 'pending',
      operator_reference: orderId,
    })

    return new Response(
      JSON.stringify({
        success: true,
        reference_id: orderId,
        payment_url: data.payment_url,
        status: 'pending',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
