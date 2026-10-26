<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture
- Header mic uses original theme-specific asset pointers and static idle frames; CSS trims transparent margins while retaining uploaded animation and reduced-motion support.
- PIN-gated actions await the PIN dialog's history cleanup before opening a follow-up dialog, preventing Back events from closing the editor.
- Voucher previous balances follow ledger date/voucher ordering and exclude deleted entries, keeping printed balances consistent with statements.
- Trade entries store optional remarks separately from generated particulars; retain credit/advance storage values for Sale Type compatibility with existing paid-now vouchers.
- Shared Logo preserves intrinsic proportions with width-led sizing in header and PrintHeader, preventing constrained layouts from stretching branding.
- Shared full logos use embedded original PNG data URLs and voucher capture waits for image decoding, eliminating network-dependent branding in headers and exports.
- All app data is local-first in the browser (src/lib/db.ts, localStorage + undo stack) — the app must work fully offline for a single user.
- The login gate and app shell live in src/components/app/AppShell.tsx rendered from __root — every route is behind the local login.
- The login gate derives first-time setup from missing local credentials; split layout starts at tablet/desktop-site widths so mobile Chrome desktop mode retains the chevron.
- Login decorative arrows share a browser-safe inline SVG and CSS animation with reduced-motion support, keeping geometry consistent without depending on an external GIF.
- Legacy expense categories remain stored for historical entries but are hidden from the picker until re-added; this preserves old statements while resetting choices.
- The selected theme belongs to the login gate, not the signed-in shell, so locking cannot reset it.
- The shared Dialog wrapper pushes a history entry while open so the phone/browser Back key closes it first; AppShell shows Back + Dashboard controls on every non-dashboard page.
- Database migrations live in drizzle/migrations with a fresh empty set rescaffolded for this remix; schema changes go through the Lovable migration tool, which writes and applies files there (never mark copied old migrations as applied).
- In-app update checks run only from the explicit menu action, comparing loaded script filenames with a fresh page fetch; alerts expire and deduplicate so normal use is never interrupted.
- Money balances come from fund ledgers (cash in hand vs each bank, src/lib/db.ts fundLedger) and party balances separately; sales/purchases never move funds, and only cleared cheques count toward available bank balance — this prevents double-counting.
- Owner capital is a "capital" entry or an equity-flagged account, never a party payable; opening capital is derived as assets minus liabilities.
