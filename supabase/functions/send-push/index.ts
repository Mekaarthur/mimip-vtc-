import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:contact@mimip.cm'

// Messages par statut de course
const RIDE_MESSAGES: Record<string, { title: string; body: string; icon: string }> = {
  accepted:  { title: '🚗 Chauffeur trouvé !',      body: 'Votre chauffeur est en route vers vous.',      icon: '/icons/icon-192x192.png' },
  arriving:  { title: '📍 Chauffeur arrive !',       body: 'Votre chauffeur est presque à votre position.', icon: '/icons/icon-192x192.png' },
  ongoing:   { title: '🛣️ Course démarrée',          body: 'Bon voyage ! Votre course est en cours.',       icon: '/icons/icon-192x192.png' },
  completed: { title: '✅ Course terminée',           body: 'Merci d\'avoir choisi Mimip. Bonne journée !',  icon: '/icons/icon-192x192.png' },
  cancelled: { title: '❌ Course annulée',            body: 'Votre course a été annulée.',                   icon: '/icons/icon-192x192.png' },
  // Notifications chauffeur
  new_ride:  { title: '🔔 Nouvelle course !',        body: 'Un passager cherche un chauffeur près de vous.', icon: '/icons/icon-192x192.png' },
  alert_j25: { title: '⚠️ Rappel courses',           body: 'Il vous reste peu de jours pour atteindre 20 courses ce mois-ci.', icon: '/icons/icon-192x192.png' },
  sub_due:   { title: '💳 Abonnement à renouveler',  body: 'Votre abonnement mensuel Mimip est à régler.',  icon: '/icons/icon-192x192.png' },
}

async function sendWebPush(subscription: {
  endpoint: string; p256dh: string; auth: string
}, payload: { title: string; body: string; icon: string; url?: string }) {
  // Import web-push compatible avec Deno
  const { default: webpush } = await import('npm:web-push@3.6.7')

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

  await webpush.sendNotification(
    { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
    JSON.stringify({ title: payload.title, body: payload.body, icon: payload.icon, url: payload.url ?? '/' })
  )
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { user_id, type, ride_id } = await req.json()

    if (!user_id || !type) {
      return new Response(JSON.stringify({ error: 'user_id et type requis' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Récupérer les subscriptions push de l'utilisateur
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', user_id)

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'Aucune subscription' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const message = RIDE_MESSAGES[type]
    if (!message) {
      return new Response(JSON.stringify({ error: `Type inconnu: ${type}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
      })
    }

    const url = ride_id ? `/ride/${ride_id}` : '/'
    let sent = 0; let failed = 0

    for (const sub of subs) {
      try {
        await sendWebPush(sub, { ...message, url })
        sent++
      } catch (e) {
        failed++
        // Subscription expirée → on la supprime
        if ((e as { statusCode?: number }).statusCode === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    })
  }
})
