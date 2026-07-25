// Supabase Edge Function : create-staff-user
//
// Crée un compte Supabase Auth + son profil (public.profiles) pour un membre
// du personnel. Doit être appelée UNIQUEMENT par un admin déjà connecté.
//
// Pourquoi une Edge Function et pas un simple insert côté client ?
// Créer un utilisateur Supabase Auth nécessite la clé "service_role", qui a
// tous les droits et ne doit JAMAIS être envoyée au navigateur. Cette fonction
// tourne côté serveur (chez Supabase), reçoit le JWT de l'admin appelant pour
// vérifier son rôle, puis utilise la clé service en interne uniquement.
//
// Déploiement : supabase functions deploy create-staff-user
// Variables d'environnement nécessaires (Supabase les fournit automatiquement) :
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY

import { createClient } from 'npm:@supabase/supabase-js@2';

const STAFF_EMAIL_DOMAIN = Deno.env.get('STAFF_EMAIL_DOMAIN') || 'staff.internal';

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Méthode non autorisée.' }), { status: 405 });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerToken = authHeader.replace('Bearer ', '');

    if (!callerToken) {
      return new Response(JSON.stringify({ error: 'Non authentifié.' }), { status: 401 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Client "en tant qu'appelant" : sert uniquement à vérifier qui appelle et son rôle.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser(callerToken);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Session invalide.' }), { status: 401 });
    }

    const { data: callerProfile, error: profileError } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (profileError || callerProfile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Seul un administrateur peut créer un compte.' }), {
        status: 403,
      });
    }

    const body = await req.json();
    const { username, password, name, role, phone, pinCode } = body as {
      username: string;
      password: string;
      name: string;
      role: 'admin' | 'manager' | 'serveur' | 'cuisinier' | 'caissier';
      phone?: string;
      pinCode?: string;
    };

    if (!username || !password || !name || !role) {
      return new Response(JSON.stringify({ error: 'Champs requis manquants (username, password, name, role).' }), {
        status: 400,
      });
    }
    if (password.length < 6) {
      return new Response(JSON.stringify({ error: 'Le mot de passe doit contenir au moins 6 caractères.' }), {
        status: 400,
      });
    }

    // Client "admin" : seule cette Edge Function y a accès, jamais le navigateur.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const syntheticEmail = `${username.toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
    });

    if (createError || !created?.user) {
      return new Response(JSON.stringify({ error: createError?.message || 'Création du compte impossible.' }), {
        status: 400,
      });
    }

    const { error: insertError } = await adminClient.from('profiles').insert({
      id: created.user.id,
      username: username.toLowerCase(),
      name,
      role,
      phone: phone || null,
      pin_code: pinCode || null,
      active: true,
    });

    if (insertError) {
      // Rollback : on supprime le compte Auth orphelin si le profil échoue.
      await adminClient.auth.admin.deleteUser(created.user.id);
      return new Response(JSON.stringify({ error: insertError.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ success: true, userId: created.user.id }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || 'Erreur interne.' }), { status: 500 });
  }
});
