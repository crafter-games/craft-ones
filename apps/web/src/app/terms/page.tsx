import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "../../components/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Service | Craft Ones",
  description: "Terms for playing Craft Ones in your browser and on Discord.",
  alternates: { canonical: "https://craft-ones.crafter.run/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        Craft Ones is a free two-player artillery game provided by Crafter
        Station and operated by Railly Hugo. These terms apply to the game at
        craft-ones.crafter.run and its Discord Activity. By using the game, you
        agree to these terms. If you do not agree, please stop using it.
      </p>
      <h2>Who can play</h2>
      <p>
        You must be at least 13 and meet any higher minimum age required in your
        country or by Discord when playing there. If you are under the age of
        legal adulthood, your parent or guardian must permit your use and agree
        to these terms. Keep your Discord account secure and follow
        Discord&apos;s terms, community guidelines and the rules of the server
        you join.
      </p>
      <h2>Playing fairly</h2>
      <p>
        You may use the game for personal, lawful entertainment. Do not harass
        other players, cheat, exploit vulnerabilities, bypass access or capacity
        limits, interfere with other matches, overload the service or attempt to
        access information that is not yours. Report security issues privately
        to
        <a href="mailto:hi@railly.dev"> hi@railly.dev</a>.
      </p>
      <h2>Matches and availability</h2>
      <p>
        Matches run in real time and are not saved as a permanent match history.
        Disconnecting, closing a room, inactivity, maintenance or a server
        restart can end a match and lose its state. Features, maps, characters
        and capacity may change. We may restrict access when necessary to
        address abuse, security risks, legal obligations or maintenance.
      </p>
      <p>
        The current game has no entry fee, paid items, subscriptions, cash
        prizes or gambling. Any future paid feature would have its price and
        applicable terms disclosed before a purchase.
      </p>
      <h2>Game content and third-party services</h2>
      <p>
        Rights in the game&apos;s software, branding and content remain with
        their respective owners. These terms grant permission to play, not
        ownership of that content. Any separately published open-source license
        continues to govern the code covered by it. You may share your own
        gameplay screenshots and videos, provided you respect other
        people&apos;s privacy and rights.
      </p>
      <p>
        Discord is a separate service. Craft Ones is not sponsored or operated
        by Discord. Your use of Discord and other linked services is also
        subject to their own terms and policies.
      </p>
      <h2>Privacy</h2>
      <p>
        Our <Link href="/privacy">Privacy Policy</Link> explains the information
        processed to run the game and how to contact us about it.
      </p>
      <h2>Service limitations</h2>
      <p>
        To the extent permitted by applicable law, the game is provided as
        available, without promises of uninterrupted service, error-free
        gameplay or fitness for a particular purpose. To that same extent, we
        are not responsible for indirect losses arising from interruptions or
        use of the game. Nothing in these terms excludes liability or consumer
        rights that cannot lawfully be excluded, including applicable rights
        concerning fraud, intentional misconduct or negligence.
      </p>
      <h2>Changes and contact</h2>
      <p>
        We will publish changes here with an updated effective date. Material
        changes will be highlighted in the game or our community before they
        take effect when required by law. You can stop using the game at any
        time.
      </p>
      <p>
        For support, questions or complaints, contact Railly Hugo at
        <a href="mailto:hi@railly.dev"> hi@railly.dev</a> or visit the
        <a href="https://discord.gg/crafterstation">
          {" "}
          Crafter Station community
        </a>
        .
      </p>
    </LegalPage>
  );
}
