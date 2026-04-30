import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MTN_BASE_URL = Deno.env.get('MTN_MOMO_BASE_URL') ?? 'https://sandbox.momodeveloper.mtn.com'
const MTN_SUBSCRIPTION_KEY = Deno.env.get('MTN_MOMO_SUBSCRIPTION_KEY') ?? ''
const MTN_API_USER = Deno.env.get('MTN_MOMO_API_USER') ?? ''
const MTN_API_KEY = Deno.env.get('MTN_MOMO_API_KEY') ?? ''
const MTN_TARGET_ENV = Deno.env.get('MTN_MOMO_TARGET_ENV') ?? 'sandbox'
const CALLBACK_URL = Deno.env.get('SUPABASE_URL') + '/functions/v1/payment-webhook'

async function getMtnToken(): Promise<string> {
  const credentials = btoa(`${MTN_API_USER}:${MTN_API_KEY}`)
  const res = await fetch(`${MTN_BASE_URL}/collection/token/`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY,
    },
  })
  const data = await res.json()
  return data.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { phone, amount, ride_id, wallet_id, type } = await req.json()

    // Valider le numéro camerounais
    const phoneClean = phone.replace(/\D/g, '').replace(/^237/, '')
    if (!/^6[5-9]\d{7}$/.test(phoneClean)) {
      return new Response(
        JSON.stringify({ error: 'Numéro MTN invalide (doit commencer par 65-69)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    const phoneIntl = `237${phoneClean}`

    const token = await getMtnToken()
    const referenceId = crypto.randomUUID()

    // Initier le paiement
    const payRes = await fetch(`${MTN_BASE_URL}/collection/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Reference-Id': referenceId,
        'X-Target-Environment': MTN_TARGET_ENV,
        'Ocp-Apim-Subscription-Key': MTN_SUBSCRIPTION_KEY,
        'Content-Type': 'application/json',
        ...(MTN_TARGET_ENV !== 'sandbox' && { 'X-Callback-Url': CALLBACK_URL }),
      },
      body: JSON.stringify({
        amount: String(amount),
        currency: 'XAF',
        externalId: ride_id ?? wallet_id ?? referenceId,
        payer: { partyIdType: 'MSISDN', partyId: phoneIntl },
        payerMessage: 'Paiement Mimip VTC',
        payeeNote: type === 'topup' ? 'Recharge portefeuille' : 'Course Mimip',
      }),
    })

    if (!payRes.ok && payRes.status !== 202) {
      const err = await payRes.text()
      return new Response(
        JSON.stringify({ error: 'Erreur MTN MoMo', detail: err }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Enregistrer la transaction en base
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    await supabase.from('mobile_money_transactions').insert({
      user_id: (await supabase.auth.getUser(
        req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
      )).data.user?.id,
      wallet_id,
      operator: 'mtn_momo',
      phone: phoneIntl,
      amount,
      type: type ?? 'topup',
      status: 'pending',
      operator_reference: referenceId,
    })

    return new Response(
      JSON.stringify({ success: true, reference_id: referenceId, status: 'pending' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
