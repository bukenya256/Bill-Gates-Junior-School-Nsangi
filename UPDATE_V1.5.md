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
