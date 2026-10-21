# BGS v1.5.0 – one-time pairing and automatic connection

## Connection
- The Teachers' PC no longer depends on a fixed IP address. It finds the Headteacher PC by itself (UDP broadcast on port 4751) using only the school key, and re-finds it whenever the address changes (new Ethernet link, new DHCP lease, a different cable port).
- Pairing is saved on the Teachers' PC (name, school key, last known address). Reopening the program reconnects within seconds. No new code is needed.
- School key is accepted with or without the dash and in any letter case.
- Headteacher Settings & Backup lists the Teachers' PCs that have contacted it and has an "Allow connections in Windows (one time)" button, which opens the Windows firewall for ports 4750 (TCP) and 4751 (UDP) on every network type (cable links are treated as "Public" by Windows).
- Marks are still saved locally first and sent automatically when the link returns.

## Screens
- All code comments removed from the front end (HTML, CSS, JavaScript).
- Emoji and decorative symbols removed from buttons and notices; consistent icon set only.
- Teachers' Connection page rewritten with live status, "Find Headteacher PC again", manual address under Advanced.
- Cleaner empty states, focus outlines, modal animation, scrollbars.
- Headteacher password minimum raised to 6 characters.

## Not changed
Data format, cloud backup, restore, receipts and reports are unchanged. Back up your data before installing as usual.

## SMS to parents (Africa's Talking)
- Settings & Backup -> "SMS to parents": username, API key, optional sender name, and a "Send test SMS" button.
- The API key is stored encrypted (Windows login), only on the Headteacher PC. It is not in the source code, the cloud backup, the data files or the Teachers' PCs, and is never shown again after saving.
- Notifications: Send SMS button per saved message with a preview (how many parents, credits used, example text, who has no number) and a confirmation.
- Placeholders {parent} {student} {class} {balance} are filled in for each parent. Numbers are converted to +256 format.
- Each message keeps a per-parent delivery log; resending only goes to parents who have not yet received it, so nobody gets it twice.
- Use username `sandbox` to test without spending credit.
