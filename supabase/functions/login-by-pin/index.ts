// Supabase Edge Function : login-by-pin
//
// Connexion rapide serveur par QR Code (?waiterPin=2001), mais SÉCURISÉE :
// contrairement à la première version de l'app qui se contentait d'afficher
// l'interface sans vraie authentification, ici :
//   1. Le PIN est vérifié côté serveur (jamais exposé/comparé côté navigateur).
//   2. Une vraie session Supabase Auth est émise via un "magic link" généré
//      par l'API admin, que le client échange ensuite avec verifyOtp().
// Résultat : après un scan PIN réussi, auth.uid() fonctionne normalement dans
// toutes les policies RLS / fonctions RPC, exactement comme un login classique.
//
// Déploiement : supabase functions deploy login-by-pin

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Méthode non autorisée.' }, 405);
    }

    const { pinCode } = (await req.json()) as { pinCode?: string };

    if (!pinCode || !/^\d{4}$/.test(pinCode)) {
      return jsonResponse({ error: 'Code PIN à 4 chiffres requis.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Le PIN n'identifie que les comptes serveur actifs — jamais admin/manager/etc.
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, active, role')
      .eq('pin_code', pinCode)
      .eq('role', 'serveur')
      .maybeSingle();

    if (profileError || !profile) {
      return jsonResponse({ error: 'Code PIN invalide.' }, 401);
    }

    if (!profile.active) {
      return jsonResponse({ error: 'Ce compte a été désactivé. Contactez un administrateur.' }, 403);
    }

    const { data: authUser, error: authError } = await adminClient.auth.admin.getUserById(profile.id);
    if (authError || !authUser?.user?.email) {
      return jsonResponse({ error: 'Compte introuvable.' }, 401);
    }

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email: authUser.user.email,
    });

    if (linkError || !linkData?.properties?.hashed_token) {
      return jsonResponse({ error: 'Impossible de générer la session.' }, 500);
    }

    return jsonResponse(
      {
        success: true,
        email: authUser.user.email,
        tokenHash: linkData.properties.hashed_token,
      },
      200
    );
  } catch (err) {
    return jsonResponse({ error: (err as Error).message || 'Erreur interne.' }, 500);
  }
});
