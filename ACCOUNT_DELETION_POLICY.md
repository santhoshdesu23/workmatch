# Account Deletion Policy

Account deletion is available to worker and employer accounts after current-password reauthentication and exact `DELETE` confirmation. The server identifies the account only from the authenticated request. The endpoint is rate-limited by the existing authentication limiter and requires a MongoDB transaction-capable deployment.

Deletion is refused while the account is a worker or employer on any confirmed or in-progress assignment. The user must first resolve or cancel those commitments.

On successful deletion:

- Worker and employer profile documents are deleted, including saved-job references and public business contact details.
- Notifications addressed to the account are deleted.
- Verification request records are retained, but submitted document/business data is removed.
- An employer's non-completed job postings are marked cancelled, and pending applications to those postings are cancelled and their applicants notified.
- A worker's pending applications are marked withdrawn, retained as history, and the corresponding employers are notified.
- The user record is retained as an anonymized tombstone (`Deleted Account`, a non-deliverable `deleted.invalid` address, random unusable password data, and deleted status). This preserves referential integrity for historical records and makes existing JWTs unusable.
- Applications, completed/cancelled assignments, payment records, reviews, reports, job-change history, audit logs, and their references are retained. These may be relevant to payment reconciliation, disputes, platform integrity, and historical marketplace records; this is a product retention choice, not a claim about a legal obligation.
- Free-text application messages, reviews, reports/evidence, and audit metadata are not automatically redacted. They may contain personal information and need a separately approved retention/redaction policy before launch.

The multi-document operation runs in a MongoDB transaction. Production must use a transaction-capable replica set or sharded cluster. No production records are modified by tests.