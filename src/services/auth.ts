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

// supabase.functions.invoke() met la Response HTTP brute dans `error.context`
// (pas un objet JSON déjà parsé) — il faut donc la lire via .json() pour
// récupérer le vrai message d'erreur renvoyé par la fonction, sinon on ne voit
// que le message générique "Edge Function returned a non-2xx status code".
async function extractFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  try {
    const ctx = (error as { context?: Response })?.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.json();
      if (body?.error) return body.error as string;
    }
  } catch {
    // Réponse non-JSON ou déjà consommée : on retombe sur le message générique.
  }
  return (error as Error)?.message || fallback;
}

export interface AuthResult {
  success: boolean;
  message?: string;
  user?: User;
  needsMfa?: boolean;
  mfaFactorId?: string;
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

// Connexion rapide serveur par PIN (scan QR "waiterPin=2001") — SÉCURISÉE :
// passe par l'Edge Function login-by-pin qui vérifie le PIN côté serveur et
// génère une vraie session Supabase, échangée ici via verifyOtp(). Ce n'est
// plus une simple identification visuelle : auth.uid() fonctionne ensuite
// normalement pour toutes les policies RLS et fonctions RPC.
export async function signInWithPin(pinCode: string): Promise<AuthResult> {
  const { data, error } = await supabase.functions.invoke('login-by-pin', {
    body: { pinCode },
  });

  if (error || !data?.success) {
    const message = error
      ? await extractFunctionErrorMessage(error, 'Code PIN invalide.')
      : data?.error || 'Code PIN invalide.';
    return { success: false, message };
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    email: data.email,
    token: data.tokenHash,
    type: 'magiclink',
  });

  if (verifyError) {
    return { success: false, message: 'Connexion impossible avec ce code PIN.' };
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

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export interface CreateStaffAccountInput {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  phone?: string;
  pinCode?: string;
}

export interface CreateStaffAccountResult {
  success: boolean;
  message?: string;
}

// Crée un nouveau compte du personnel (admin uniquement). Passe par l'Edge
// Function create-staff-user, la seule autorisée à utiliser la clé service
// nécessaire pour créer un utilisateur Supabase Auth — jamais depuis le
// navigateur directement.
export async function createStaffAccount(input: CreateStaffAccountInput): Promise<CreateStaffAccountResult> {
  const { data, error } = await supabase.functions.invoke('create-staff-user', {
    body: input,
  });

  if (error) {
    const message = await extractFunctionErrorMessage(error, 'Création du compte impossible.');
    return { success: false, message };
  }

  if (data?.error) {
    return { success: false, message: data.error };
  }

  return { success: true };
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
    role: row.role as UserRole,
    phone: (row.phone as string) || undefined,
    avatar: (row.avatar as string) || undefined,
    active: row.active as boolean,
  };
}

// ----------------------------------------------------------------------------
// DOUBLE AUTHENTIFICATION (MFA — TOTP via Google Authenticator / Authy...)
// ----------------------------------------------------------------------------

// Vérifie un code à 6 chiffres pour déverrouiller un écran sensible (ex:
// Paramètres) sans repasser par tout le flux de connexion — l'utilisateur est
// déjà connecté, on vérifie juste qu'il a bien son app d'authentification.
export async function verifyMfaChallengeOnly(factorId: string, code: string): Promise<{ success: boolean; message?: string }> {
  const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challengeData) {
    return { success: false, message: 'Impossible de générer le défi de vérification.' };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code: code.trim(),
  });

  if (verifyError) {
    return { success: false, message: 'Code incorrect. Réessayez.' };
  }

  return { success: true };
}

// Étape 2 de la connexion, quand signInWithUsername a renvoyé needsMfa: true.
export async function verifyMfaCode(factorId: string, code: string): Promise<AuthResult> {
  const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challengeData) {
    return { success: false, message: 'Impossible de générer le défi de vérification.' };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code: code.trim(),
  });

  if (verifyError) {
    return { success: false, message: 'Code incorrect. Réessayez.' };
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

export interface MfaFactor {
  id: string;
  friendlyName?: string;
  status: string;
}

// Liste les facteurs déjà activés pour le compte actuellement connecté
// (utilisé dans l'écran Paramètres > Sécurité).
export async function listMfaFactors(): Promise<MfaFactor[]> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) return [];
  return (data.totp || []).map((f) => ({ id: f.id, friendlyName: f.friendly_name, status: f.status }));
}

export interface MfaEnrollResult {
  success: boolean;
  message?: string;
  factorId?: string;
  qrCode?: string;
  secret?: string;
}

// Démarre l'activation : génère un QR code + un secret à scanner avec une
// application d'authentification (Google Authenticator, Authy...).
export async function enrollMfaTotp(): Promise<MfaEnrollResult> {
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error || !data) {
    return { success: false, message: error?.message || "Impossible de démarrer l'activation." };
  }
  return {
    success: true,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

// Confirme l'activation avec le premier code à 6 chiffres généré par
// l'application (obligatoire pour que le facteur devienne réellement actif).
export async function confirmMfaEnrollment(factorId: string, code: string): Promise<{ success: boolean; message?: string }> {
  const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId });
  if (challengeError || !challengeData) {
    return { success: false, message: 'Impossible de générer le défi de vérification.' };
  }

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code: code.trim(),
  });

  if (verifyError) {
    return { success: false, message: "Code incorrect. Vérifiez l'heure de votre téléphone et réessayez." };
  }

  return { success: true };
}

// Désactive la double authentification pour ce compte.
export async function unenrollMfaFactor(factorId: string): Promise<{ success: boolean; message?: string }> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { success: false, message: error.message };
  return { success: true };
}

// Un facteur en cours d'activation mais jamais confirmé reste "unverified" —
// on le retire proprement si l'utilisateur annule en cours de route.
export async function cancelMfaEnrollment(factorId: string): Promise<void> {
  await supabase.auth.mfa.unenroll({ factorId });
}
