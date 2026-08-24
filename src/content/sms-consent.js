// The single source of truth for the SMS consent disclosure.
//
// This exact string is seeded into waitlist_sms_consent_versions by migration 0016 and
// rendered into web/index.html. test/content/sms-consent.test.mjs asserts all three agree
// byte-for-byte — because the consent receipt we store points at a version, and a version
// that does not match what the visitor actually read is not proof of anything.
//
// ASCII only, deliberately. Beyond the matching problem, any character outside GSM-7
// forces an SMS into UCS-2, cutting the segment from 160 characters to 70.
//
// Changing the wording means minting a NEW version and inserting it in a new migration.
// Never edit an existing version in place: receipts already point at it.

export const SMS_CONSENT_VERSION = 'sms-2026-08-07';

export const SMS_CONSENT_BODY =
  "Text me when TrueTone launches. ~1-2 messages. Msg & data rates may apply. " +
  "Reply STOP to opt out. Consent isn't required to join.";
