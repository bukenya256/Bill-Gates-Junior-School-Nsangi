# BGS 1.5.1 — fixes and build instructions

## Headteacher and Teacher
- Teacher setup keeps the previously saved Headteacher network address when its optional address input is left blank. Saving the same key no longer clears the school identity; an additional regression test verifies that previously paired devices reconnect without a new key.
- Discovery continues to run after the Headteacher PC becomes unavailable, and only the matching previously paired school identity is selected if one is known.
- Simplified Headteacher Settings and Teacher Connection pages; retained controls, actionable alerts and status.

## SMS
- Africa's Talking submission results are not carrier delivery confirmations. Messages are now displayed as **submitted / delivery unconfirmed**, not **delivered**.
- Logs capture provider message IDs, when supplied, and provider status; the test SMS UI reports the charge and ID when available.
- Live proof of SMS delivery needs Africa's Talking delivery reports and an approved sender ID (where one is used), correct live credentials, recipient number and carrier routing. The application has not been tested against a real Africa's Talking account. Do not repeatedly send billable tests to the same number before reviewing the provider's delivery reports.

## Build installers
- Windows: push the full project to a GitHub repository; Actions > Build BGS Windows App > Run workflow, then download BGS-Windows-Applications artifacts (portable .exe and setup .exe).
- macOS Mojave (Intel): Actions > Build BGS macOS Mojave DMG > Run workflow, then download BGS-Mojave-Intel-DMG artifact. Build uses Electron 26.6.10 for Mojave compatibility.
- Both builds must be tested on physical Windows and Mojave PCs, including ethernet reconnect, firewall and offline mark synchronization. Building a macOS DMG requires a macOS build runner.
- Back up both PCs' local BGS data before installing a new version. Never share API keys in screenshots.

## Automated tests
`npm test && node test-ui-patch.js`
