# Craft Ones brand assets

The cream cuy with its teal rocket launcher is the game mark. Use the same approved character, cream and caramel colors, cocoa outlines, forest-green background and golden burst across the website and Discord.

`icon-master.png` is the approved 1024px icon. `key-art-master.png` is the 1920×1008 landscape illustration generated from that icon with GPT Image 2 through Vercel AI Gateway. The exact creative brief and generation details are in `key-art-prompt.txt` and `generation.json`. Generation used the authorized API fallback. Credentials are not stored here.

Run `bun run generate:brand` to reproduce the optimized header mark, 192px and 512px install icons, favicon, Apple touch icon, 1200×630 Open Graph/Twitter card, 1920×1080 Discord cover and 1080×1080 social card. This command uses the committed artwork and fonts locally and makes no model calls.

The generated public assets live in `apps/web/public/brand`. Next.js icon files live in `apps/web/src/app`. Bungee and Archivo match the website typography; their original SIL Open Font Licenses are included in `fonts`.

Text is rendered from the font outlines, so exports keep the intended heavy wordmark without relying on installed system fonts.

Keep the face and launcher readable when cropping. The full square icon is suitable for square and circular app avatars. The large social card is shared by Open Graph and Twitter metadata. Keep the publisher attribution as “Built by Crafter Station”.
