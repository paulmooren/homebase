# Vault values are encrypted with a server-held key, not a user passphrase

The Vault stores sensitive numbers (passport, insurance, bank details). Values and notes are encrypted in the application before they reach the database, using a key held in the server's environment; titles, categories, labels and expiry dates stay readable so entries can be listed and searched. We rejected a Household passphrase (end-to-end) because a forgotten passphrase would lose everything and adds a second secret to remember; the accepted trade-off is that whoever controls the server and its environment can decrypt, and that losing the key makes the stored values unrecoverable.

## Consequences

- Vault values are never included in data export.
- The key must be backed up separately from the database.
- Files (scans, PDFs) are out of scope; if they are ever added this decision must be revisited.
