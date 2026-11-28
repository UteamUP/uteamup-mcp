# Operational entry creation

The backend advertises an `entryReview` argument on operational creation tools.
It applies the same rules to every MCP-connected model. This package forwards
the contract and the response unchanged.

Classify the user's intent before creating a record:

- `corrective_action`: workorder;
- `completed_activity`: journal;
- `observation`: note, stored in Journals;
- `ambiguous`: ask the user and supply the confirmed record type.

Follow the actual backend schema for mandatory facts, allowed explicit unknown
or not-applicable values and any configured scheduling policies. Confirm
consequential details. Ask only for unresolved fields returned by the server;
never guess code identities, criticality or dates.

Safety escalation must happen immediately through the site's emergency procedure,
without waiting for the assistant, missing fields or a photo. Request a photograph
where practical; an unavailable photo does not block urgent reporting.

Validation refusals have `isError: true`, structured missing/invalid fields and
`saved: false`. A successful create includes `entryReceipt` with confirmed save
status, the record GUID and verified attachment linkage. An attachment failure
may explicitly report `saved: true`: repair the existing record by GUID instead
of creating a duplicate. An unconfirmed save must be reconciled before retrying.

Use direct reviewed workorder/journal creation when a template, image-only or
quick-report shortcut cannot establish the required facts. Upload images and
link them through existing document tools; the backend verifies the join rows.

The `proxy-resilience.test.js` operational-entry scenarios run the real stdio
proxy with only the HTTPS backend mocked. They verify review argument and
structured response transparency across client identities, including partial
save status. Backend persistence/authorization tests remain the evidence for
mandatory validation itself.
