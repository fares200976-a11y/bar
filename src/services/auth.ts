import { supabase } from './supabaseClient';
import type { User, UserRole } from '../types';

// Supabase Auth s'appuie sur un email. Comme votre personnel se connecte avec un
// simple identifiant (admin, cuisine, caisse...), on le fait correspondre à un
// email interne invisible pour l'utilisateur : "<username>@<STAFF_EMAIL_DOMAIN>".
// ⚠️ Doit être IDENTIQUE au domaine utilisé côté Edge Function create-staff-user.
const STAFF_EMAIL_DOMAIN = import.meta.env.VITE_STAFF_EMAIL_DOMAIN || 'staff.internal';

function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: User;
}

// Connexion classique identifiant + mot de passe (remplace la vérification
// factice de l'ancien LoginModal — le mot de passe est désormais vérifié par
// Supabase Auth lui-même, jamais en clair côté client).
export async function signInWithUsername(username: string, password: string): Promise<AuthResult> {
  const email = usernameToEmail(username);

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    return { success: false, message: 'Identifiant ou mot de passe incorrect.' };
  }

  const profile = await fetchOwnProfile();
  if (!profile) {
    await supabase.auth.signOut();
    return { success: false, message: 'Profil introuvable pour ce compte.' };
  }

  if (!profile.active) {
    await supabase.auth.signOut();
    return { success: false, message: 'Ce compte a été désactivé. Contactez un administrateur.' };
  }

  return { success: true, user: profile };
}

// Connexion rapide serveur par PIN (scan QR "waiterPin=2001").
//
// ⚠️ LIMITE IMPORTANTE À CONNAÎTRE : cette fonction retrouve le PROFIL correspondant
// au PIN, mais ne crée PAS de session Supabase Auth réelle (un PIN à 4 chiffres n'est
// pas un mot de passe Supabase valide). Tant qu'on n'a pas branché une Edge Function
// dédiée (qui vérifierait le PIN côté serveur puis émettrait une vraie session via
// `supabase.auth.admin.generateLink` ou équivalent), ce mode reste une identification
// "visuelle" côté client, PAS une authentification sécurisée par la base de données.
// → Recommandation pour la suite : soit exiger malgré tout le mot de passe réel du
// serveur après scan du QR, soit créer une Edge Function "login-by-pin" dédiée.
// Je fais volontairement ce compromis explicite maintenant plutôt que de vous laisser
// croire que c'est déjà sécurisé.
export async function fetchProfileByPin(pinCode: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('pin_code', pinCode)
    .eq('active', true)
    .maybeSingle();

  if (error || !data) return null;
  return mapProfileRowToUser(data);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function fetchOwnProfile(): Promise<User | null> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authData.user.id)
    .single();

  if (error || !data) return null;
  return mapProfileRowToUser(data);
}

function mapProfileRowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    name: row.name as string,
    username: row.username as string,
    password: '', // jamais renvoyé ni stocké côté client — géré entièrement par Supabase Auth
    role: row.role as UserRole,
    phone: (row.phone as string) || undefined,
    avatar: (row.avatar as string) || undefined,
    active: row.active as boolean,
  };
}
