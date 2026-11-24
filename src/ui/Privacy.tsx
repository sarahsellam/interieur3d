// « Confidentialité et données » : ce que l'application enregistre, où, et comment l'effacer.
// Texte fidèle au fonctionnement réel de l'application (à mettre à jour si elle évolue).
import { createPortal } from 'react-dom'
import { Icon } from './common'

export function PrivacyPage({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-label="Confidentialité et données">
      <div className="modal-card privacy">
        <div className="popover-head">
          <h2>Confidentialité et données</h2>
          <button type="button" className="icon-btn small" onClick={onClose} aria-label="Fermer">
            {Icon.close}
          </button>
        </div>
        <p className="privacy-lead">Vos projets vous appartiennent. Mon Intérieur 3D fonctionne sans publicité ni traceur, et n'enregistre que ce qui sert à l'application.</p>

        <h3>Sans compte</h3>
        <p>Vos pièces, versions, plans d'appartement, inspirations, « Mes meubles » et photos restent uniquement dans cet appareil (stockage du navigateur). Rien n'est envoyé ailleurs, sauf dans les cas ci-dessous que vous déclenchez vous-même.</p>

        <h3>Avec un compte</h3>
        <ul>
          <li>Le compte n'utilise ni e-mail ni mot de passe : seulement une clé d'accès (Face ID, Touch ID), gardée par votre appareil. Le serveur ne garde que la partie publique de cette clé, le prénom que vous avez saisi et une empreinte de votre code de secours.</li>
          <li>Vos projets, plans, inspirations, « Mes meubles » et leurs photos sont copiés sur le serveur pour être retrouvés sur vos autres appareils. Ils ne sont visibles que par vous.</li>
          <li>« Supprimer mon compte » (dans Mon compte, menu ⋯) efface définitivement tout ce qui est enregistré sur le serveur. Les projets restent sur l'appareil.</li>
        </ul>

        <h3>Quand vous l'utilisez</h3>
        <ul>
          <li>
            <strong>Partager pour avoir un avis</strong> : seules les versions choisies sont envoyées, avec les avis reçus. Toute personne qui a le lien peut les voir. « Arrêter le partage » les efface.
          </li>
          <li>
            <strong>Demander une idée</strong> : la description de la pièce, votre demande et, si vous les joignez, vos photos d'inspiration sont envoyées à l'assistant (Claude, d'Anthropic) pour préparer les propositions. Elles ne sont pas conservées par l'application.
          </li>
          <li>
            <strong>Ajouter depuis un lien</strong> : l'adresse du produit est lue par le serveur pour en tirer le nom, le prix et les dimensions.
          </li>
          <li>
            <strong>Photos des produits</strong> : les vignettes des références sont affichées depuis le site du vendeur.
          </li>
        </ul>

        <h3>Où sont les données</h3>
        <p>L'application est hébergée sur GitHub Pages. Le serveur (compte, synchronisation, partages, assistant) fonctionne sur Cloudflare. Aucune donnée n'est vendue ni utilisée pour de la publicité.</p>

        <h3>Vos droits</h3>
        <p>Vous pouvez à tout moment exporter vos projets (Sauvegarde sur l'accueil), arrêter un partage ou supprimer votre compte depuis l'application. Ces actions sont immédiates.</p>

        <p className="muted privacy-date">Dernière mise à jour : 24 novembre 2026</p>
      </div>
    </div>,
    document.body,
  )
}
