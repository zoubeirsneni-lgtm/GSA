/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { useFirebase } from './FirebaseProvider';
import { ShieldCheck, Mail, Sparkles, Building2, Layers, AlertCircle, PhoneCall } from 'lucide-react';
import { motion } from 'motion/react';

export default function LoginScreen() {
  const { loginWithGoogle, simulateUser } = useFirebase();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authError, setAuthError] = useState<{ code: string; message: string; title: string; steps: string[] } | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setErrorMsg(null);
      setAuthError(null);
      await loginWithGoogle();
    } catch (e: any) {
      console.error("Login component caught error:", e);
      const code = e?.code || "";
      const message = e?.message || "";
      
      let title = "Erreur de connexion";
      let displayMessage = "La connexion Google n'a pas pu être établie.";
      let steps: string[] = [];

      if (code === 'auth/unauthorized-domain') {
        title = "Domaine d'hébergement non autorisé";
        displayMessage = "Le domaine actuel n'est pas autorisé dans la configuration de votre projet Firebase Authentication.";
        steps = [
          "Connectez-vous à la Console Firebase de VOTRE projet.",
          "Allez dans Authentication > onglet Settings (Paramètres) > Domaines autorisés.",
          "Ajoutez le domaine de votre application Netlify (ex: gestionstockavicenne.netlify.app).",
          "Revenez sur votre application, actualisez la page et réessayez !"
        ];
      } else if (code === 'auth/operation-not-allowed') {
        title = "Connexion Google non activée";
        displayMessage = "La méthode de connexion par Google n'est pas activée sur votre console Firebase.";
        steps = [
          "Connectez-vous à la Console Firebase.",
          "Allez dans Authentication > onglet Sign-in method.",
          "Ajoutez ou activez le fournisseur 'Google', configurez l'adresse email de support et enregistrez.",
          "Actualisez cette page et réessayez de vous connecter."
        ];
      } else if (code === 'auth/popup-blocked') {
        title = "Fenêtre pop-up bloquée";
        displayMessage = "Votre navigateur a bloqué l'affichage de la fenêtre de connexion Google.";
        steps = [
          "Regardez dans la barre d'adresse de votre navigateur l'icône de pop-up bloquée.",
          "Sélectionnez 'Toujours autoriser les fenêtres pop-up et les redirections pour ce site'.",
          "Cliquez à nouveau sur le bouton de connexion Google."
        ];
      } else if (code === 'auth/popup-closed-by-user') {
        title = "Connexion annulée";
        displayMessage = "La fenêtre de connexion Google a été fermée avant la fin du processus.";
        steps = [
          "Cliquez sur le bouton pour rouvrir la connexion.",
          "Sélectionnez votre compte Google et allez jusqu'au bout de l'authentification."
        ];
      } else {
        displayMessage = message || "Une erreur inattendue s'est produite lors de la connexion.";
      }

      setAuthError({
        code,
        message: displayMessage,
        title,
        steps
      });
      setErrorMsg(message || "Erreur de connexion");
    }
  };

  const testAccounts = [
    {
      name: "Super-Admin Clinic",
      email: "zoubeirsneni@gmail.com",
      role: "super_admin" as const,
      permissions: ["Médical", "Cuisine", "Ménage", "Entretien"],
      color: "bg-clinic-dark text-white hover:bg-opacity-90 border border-clinic-blue",
      desc: "Accès complet, modification du stock global, création de catégories, gestion des comptes admins et visibilité des fournisseurs."
    },
    {
      name: "Admin Matériel Médical",
      email: "medical.admin@clinique.com",
      role: "admin" as const,
      permissions: ["Médical"],
      color: "bg-[#eef5fc] text-clinic-blue hover:bg-[#e1edf9] border border-clinic-blue/20",
      desc: "Édition du stock Médical uniquement. Accès en lecture seule sur les autres catégories. Fournisseurs masqués."
    },
    {
      name: "Admin Cuisine & Restauration",
      email: "cuisine.admin@clinique.com",
      role: "admin" as const,
      permissions: ["Cuisine"],
      color: "bg-[#eef5fc] text-clinic-blue hover:bg-[#e1edf9] border border-clinic-blue/20",
      desc: "Édition du stock 'Cuisine' uniquement. Consultation pour le reste. Fournisseurs masqués."
    },
    {
      name: "Admin Entretien & Ménage",
      email: "entretien.admin@clinique.com",
      role: "admin" as const,
      permissions: ["Ménage", "Entretien"],
      color: "bg-[#eef5fc] text-clinic-blue hover:bg-[#e1edf9] border border-clinic-blue/20",
      desc: "Édition des stocks 'Ménage' et 'Entretien' uniquement. Fournisseurs masqués."
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {/* Clinique Logo & Title */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center justify-center p-4 bg-white rounded-2xl shadow-sm border border-slate-100 mb-4 text-clinic-blue">
          <Building2 size={40} className="stroke-2 text-clinic-blue" />
        </div>
        <h1 className="text-3xl font-bold text-clinic-dark tracking-tight">
          Avicenne Stock <span className="text-clinic-green font-semibold">T-R</span>
        </h1>
        <p className="text-sm text-slate-500 mt-2 max-w-sm">
          Système de gestion de stock clinique universel en temps réel avec alertes automatiques et gestion des droits d'accès.
        </p>
      </motion.div>

      {/* Main Container */}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8 items-start mb-8">
        {/* Left Card: Core Presentation */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 h-full flex flex-col justify-between"
        >
          <div>
            <h2 className="text-xl font-bold text-clinic-dark mb-4 border-b pb-3 border-slate-100 flex items-center gap-2">
              <Sparkles className="text-clinic-green" size={20} /> Fonctions Principales
            </h2>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 shrink-0 bg-[#eef5fc] text-clinic-blue rounded-lg flex items-center justify-center">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Gestion des Droits par Catégorie</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Le Super-Admin attribue des droits ciblés (Médical, Cuisine, Ménage) empêchant les modifications accidentelles.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 shrink-0 bg-clinic-green-light text-clinic-green rounded-lg flex items-center justify-center">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Alertes de Rupture & Seuils</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Visualisation instantanée en cas de stock inférieur au seuil minimal configuré.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 shrink-0 bg-amber-50 text-clinic-accent rounded-lg flex items-center justify-center">
                  <PhoneCall size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Confidentialité des Fournisseurs</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Les numéros de téléphone des fournisseurs de chaque produit sont stockés de manière sécurisée et visibles uniquement par le Super-Admin.</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 shrink-0 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
                  <Layers size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-sm">Stock Universel Clinique</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Gestion d'absolument tout type de stock : matériel chirurgical, réactifs, éponges, cuisine clinique, nourriture, outillage, etc.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-slate-100">
            <button
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 text-slate-700 py-3 px-4 rounded-xl font-medium border border-slate-300 shadow-sm transition duration-150 cursor-pointer text-sm"
              id="google-login-button"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-7.989 0-4.41 3.529-7.989 7.859-7.989 2.463 0 4.111 1.011 5.05 1.91l3.32-3.19C18.303 1.832 15.539 1 12.24 1A10.973 10.973 0 0 0 1.25 12a10.972 10.972 0 0 0 10.99 11c5.733 0 9.54-3.993 9.54-9.629 0-.65-.07-1.144-.153-1.571H12.24z"/>
              </svg>
              Se connecter avec Google Auth
            </button>
            {authError ? (
              <div className="mt-4 p-4 bg-rose-50 rounded-xl border border-rose-100 text-slate-700 text-xs">
                <div className="flex items-center gap-2 text-rose-600 font-semibold mb-1">
                  <AlertCircle size={16} />
                  <span>{authError.title}</span>
                </div>
                <p className="text-slate-600 mb-2 leading-relaxed">{authError.message}</p>
                {authError.steps.length > 0 && (
                  <div className="mt-2 pl-4 border-l-2 border-rose-200 space-y-1.5">
                    {authError.steps.map((step, idx) => (
                      <div key={idx} className="flex gap-1.5 items-start text-left">
                        <span className="font-semibold text-rose-500 font-mono text-[10px] bg-rose-100 rounded-full w-4 h-4 shrink-0 flex items-center justify-center mt-0.5">{idx + 1}</span>
                        <span className="text-slate-600 font-medium leading-tight">{step}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-3 text-[10px] text-slate-400 font-mono uppercase bg-rose-100/30 p-1.5 rounded text-center">
                  Code : {authError.code || 'unknown'}
                </div>
              </div>
            ) : errorMsg ? (
              <p className="text-xs text-rose-500 text-center mt-2 font-medium">{errorMsg}</p>
            ) : null}
          </div>
        </motion.div>

        {/* Right Card: Sandbox & Multi-user demo access */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80 h-full"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block p-1 bg-clinic-green-light text-clinic-green rounded-full shrink-0">
              <ShieldCheck size={16} />
            </span>
            <h2 className="text-lg font-bold text-clinic-dark">Simulation de Profils Clinique</h2>
          </div>
          <p className="text-xs text-slate-500 mb-4 leading-relaxed">
            Pour tester sereinement les différentes fonctionnalités et les **restrictions d'écriture par rôles et catégories** sans devoir déconnecter et reconnecter différents comptes Google réels, cliquez sur un profil ci-dessous :
          </p>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {testAccounts.map((account, index) => (
              <button
                key={index}
                onClick={() => simulateUser(account.role, account.permissions, account.email)}
                className={`w-full text-left p-3 rounded-xl transition duration-150 cursor-pointer flex flex-col gap-1 items-start ${account.color}`}
                id={`simulate-btn-${index}`}
              >
                <div className="w-full flex items-center justify-between">
                  <span className="font-semibold text-sm tracking-tight">{account.name}</span>
                  <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 roundedbg-black bg-opacity-10">
                    {account.role === 'super_admin' ? 'Super Admin' : `${account.permissions.join(', ')}`}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-80 text-[11px] mb-1">
                  <Mail size={12} /> {account.email}
                </div>
                <p className="text-[11px] leading-snug opacity-75">{account.desc}</p>
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200/70 text-slate-500 text-[11px] leading-normal flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 text-slate-400 mt-0.5" />
            <span>
              <strong>Note de test :</strong> Les modifications effectuées par l'un de ces profils simulés seront immédiatement reflétées en temps réel sur les tablettes ou autres navigateurs connectés !
            </span>
          </div>
        </motion.div>
      </div>

      {/* Footer copyright */}
      <p className="text-xs text-slate-400">
        © 2026 Clinique Avicenne. Tous droits réservés.
      </p>
    </div>
  );
}
