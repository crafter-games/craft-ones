import type { Metadata } from "next";
import { LegalPage } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy | Craft Ones",
  description: "How Craft Ones processes game sessions and Discord identity.",
  alternates: { canonical: "https://craft-ones.crafter.run/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Craft Ones is provided by Crafter Station and operated by Railly Hugo,
        who is responsible for the game&apos;s processing of personal
        information. This policy covers craft-ones.crafter.run and the Craft
        Ones Discord Activity. Contact{" "}
        <a href="mailto:hi@railly.dev">hi@railly.dev</a> with privacy questions
        or requests.
      </p>
      <h2>Information used by the game</h2>
      <ul>
        <li>
          <strong>Browser play:</strong> you can play without creating an
          account. Online rooms process temporary session and room identifiers,
          your map and character choices, gameplay actions, positions, health
          and results. The local two-player mode runs the match on your device.
        </li>
        <li>
          <strong>Discord play:</strong> after you authorize the identify scope,
          Discord provides your user ID and basic profile information, such as
          username, display name and avatar. We use your identity, the
          application and Activity instance identifiers, and instance membership
          to confirm you belong in the match and prevent duplicate seats. We do
          not request your email, friends list, message history or voice
          recordings.
        </li>
        <li>
          <strong>Connection information:</strong> our hosting and networking
          services process information such as IP addresses, request timestamps,
          requested paths, browser information, response status and errors to
          deliver the game, diagnose failures and prevent abuse. Discord may
          proxy requests, so our server may see a proxy address instead of your
          address.
        </li>
        <li>
          <strong>Support:</strong> if you contact us, we receive the
          information you choose to send and use it to handle your request.
          Please do not send passwords, authentication tokens or unnecessary
          sensitive information.
        </li>
      </ul>
      <h2>Why we process information</h2>
      <p>
        We process session and identity information to provide the game you
        request, synchronize matches and authenticate Discord participants. We
        use limited connection information for our legitimate interests in
        security, abuse prevention and reliable operation. We may also process
        information to respond to requests and meet legal obligations. Where
        consent is required by applicable law, we obtain it and allow its
        withdrawal.
      </p>
      <h2>Storage and retention</h2>
      <p>
        The game has no persistent player database, saved match history or
        player profiles. Match state and Discord seat identifiers are held in
        server memory and discarded when the room is disposed, expires or the
        process restarts. Waiting, finished and active rooms have finite
        lifetimes.
      </p>
      <p>
        Discord access tokens are used to authenticate the current session and
        kept in browser memory. The game does not put them in URLs, cookies or
        local storage, and does not return a refresh token to the browser.
      </p>
      <p>
        Operational logs are separate from match state. Our game and monitor
        containers use bounded rotating logs. Hosting providers retain request
        and security records according to their service settings and policies;
        these records are not erased just by ending a match. We retain support
        correspondence only as needed to resolve the request and meet applicable
        security or legal obligations.
      </p>
      <h2>Local storage and analytics</h2>
      <p>
        The game stores your sound on/off preference in your browser&apos;s
        local storage until you change it or clear site data. It does not set
        its own advertising cookies or include an advertising or behavioral
        analytics SDK. Discord and hosting services may use their own storage
        and security mechanisms under their policies.
      </p>
      <h2>Who receives information</h2>
      <p>
        Other players receive the shared match state needed to play. Discord
        handles account authorization, Activity membership and its own social
        features. Vercel hosts the website; our hosted game server and network
        providers deliver and protect multiplayer connections. These providers
        process information needed to perform those functions. We may disclose
        information when legally required or necessary to protect users and the
        service. We do not sell personal information or share it for targeted
        advertising.
      </p>
      <p>
        Hosting and Discord services may process information in countries other
        than yours. Their privacy policies describe their processing and
        transfer safeguards: <a href="https://discord.com/privacy">Discord</a>{" "}
        and
        <a href="https://vercel.com/legal/privacy-policy"> Vercel</a>.
      </p>
      <h2>Your choices and rights</h2>
      <p>
        You can close the game, clear its local storage and revoke the
        app&apos;s Discord authorization in Discord&apos;s Authorized Apps
        settings. To request access, correction, deletion, restriction,
        portability or object to processing where those rights apply, email
        <a href="mailto:hi@railly.dev"> hi@railly.dev</a>. Include only the
        details necessary to identify your request. We may need to verify
        ownership without asking for your password or token. You may also
        complain to your local data-protection authority. Requests concerning
        Discord&apos;s own records should be directed to Discord.
      </p>
      <h2>Age requirements and updates</h2>
      <p>
        The game is not intended for children under 13 or below a higher
        applicable minimum age. Contact us if you believe a child has provided
        personal information. We will investigate and take appropriate action.
      </p>
      <p>
        We publish changes to this policy here with an updated effective date
        and provide additional notice of material changes when required.
      </p>
    </LegalPage>
  );
}
