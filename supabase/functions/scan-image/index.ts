// Supabase Edge Function : scan-image
//
// Reçoit une photo (base64) et un "mode" :
//   - mode "menu"    : photo d'une carte/menu papier → extrait les plats
//                      (nom, prix, catégorie suggérée) pour import automatique.
//   - mode "invoice" : photo d'un bon d'achat / facture fournisseur → extrait
//                      les lignes (nom du produit, quantité) pour mise à jour
//                      automatique du stock.
//
// Utilise l'API Gemini (Google) en vision multimodale — nécessite la variable
// d'environnement GEMINI_API_KEY (à configurer avec :
//   supabase secrets set GEMINI_API_KEY=xxxxx
// ), obtenue gratuitement sur https://aistudio.google.com/apikey
//
// Réservé admin/manager (mêmes vérifications que create-staff-user).
//
// Déploiement : supabase functions deploy scan-image

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

const MENU_PROMPT = `Tu regardes la photo d'une carte de restaurant/bar. Extrait TOUS les
produits visibles (plats, boissons, etc.). Pour chaque produit, donne :
- name : le nom exact du produit
- price : le prix en nombre (juste le nombre, sans devise). Si illisible, mets 0.
- category : une suggestion de catégorie courte (ex: "Entrées", "Plats", "Bières", "Vins", "Desserts"...)

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, format exact :
[{"name": "...", "price": 0, "category": "..."}]`;

const INVOICE_PROMPT = `Tu regardes la photo d'un bon d'achat / facture fournisseur pour un
restaurant ou un bar. Extrait TOUTES les lignes de produits achetés. Pour chaque ligne, donne :
- name : le nom exact du produit tel qu'écrit
- quantity : la quantité achetée (nombre entier). Si illisible, mets 1.

Réponds UNIQUEMENT avec un tableau JSON valide, sans texte autour, format exact :
[{"name": "...", "quantity": 0}]`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Méthode non autorisée.' }, 405);
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerToken = authHeader.replace('Bearer ', '');
    if (!callerToken) {
      return jsonResponse({ error: 'Non authentifié.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser(callerToken);
    if (userError || !userData?.user) {
      return jsonResponse({ error: 'Session invalide.' }, 401);
    }

    const { data: callerProfile, error: profileError } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (profileError || !['admin', 'manager'].includes(callerProfile?.role)) {
      return jsonResponse({ error: 'Réservé à l\'administrateur ou au manager.' }, 403);
    }

    const body = await req.json();
    const { imageBase64, mimeType, mode } = body as {
      imageBase64: string;
      mimeType: string;
      mode: 'menu' | 'invoice';
    };

    if (!imageBase64 || !mimeType || (mode !== 'menu' && mode !== 'invoice')) {
      return jsonResponse({ error: "Image et mode ('menu' ou 'invoice') requis." }, 400);
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      return jsonResponse({ error: "Clé GEMINI_API_KEY non configurée côté serveur." }, 500);
    }

    const prompt = mode === 'menu' ? MENU_PROMPT : INVOICE_PROMPT;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mimeType, data: imageBase64 } },
                { text: prompt },
              ],
            },
          ],
          generationConfig: { temperature: 0.1 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return jsonResponse({ error: `Erreur IA : ${errText.slice(0, 300)}` }, 502);
    }

    const geminiData = await geminiRes.json();
    const rawText: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Le modèle répond parfois avec des ```json ... ``` autour — on nettoie.
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return jsonResponse({ error: "L'IA n'a pas renvoyé un JSON valide. Réessaie avec une photo plus nette." }, 502);
    }

    if (!Array.isArray(parsed)) {
      return jsonResponse({ error: 'Aucun produit détecté sur cette photo.' }, 200);
    }

    return jsonResponse({ success: true, items: parsed }, 200);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message || 'Erreur interne.' }, 500);
  }
});
