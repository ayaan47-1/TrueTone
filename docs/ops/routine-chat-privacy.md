# Routine chat privacy hold

HAG-238 removes automatic scan context from routine chat. It does not authorize deploying or enabling chat.

## Payload

The app sends only the user's message and session conversation history. The server creates a fresh typed request, dropping all other fields. There is no scan identifier, scan lookup, score band, inferred skin type, saved routine, shade result, account identifier or profile context in the completion request. Legacy structured context fields are ignored, not forwarded. User-written text can still contain personal or sensitive information; text-only does not mean anonymous.

The provider payload contains only fixed model/token settings, constant cosmetic-only instructions and bounded user/assistant text turns. Messages have a 2,000-character limit. History permits at most 20 turns and 12,000 characters. No system/tool history roles, image blocks, cache controls, attachments, feedback, batch or Files calls are added. Medical-query refusal, output filtering and the authenticated daily quota remain intact. No chat persistence is added. Provider errors return fixed copy and log only a fixed failure kind, never the exception or submitted text.

## Disabled by construction

`src/features/recommend/chat/availability.ts` exports `ROUTINE_CHAT_AVAILABLE = false`. The generated Edge copy uses the same value. This is not an environment switch, consent receipt or approval mechanism. The route displays an unavailable card, the client refuses before invoking Supabase, and the server returns 503 before parsing the body or initializing either client. Camera-offline continues to fail before network access.

Do not flip this constant to enable chat. A separate reviewed change must implement an un-prechecked opt-in naming Anthropic and the exact message/history categories and purpose, versioned server-enforced consent and withdrawal, approved disclosures, commercial API/Data Processing Addendum, and written zero-data-retention approval for the organization/model. Biometric consent is not chat consent. No production chat data is authorized until those gates pass. This branch creates no consent table, disclosure acceptance or approval shortcut, and changes no secret or deployed function.

## Checks

```sh
node scripts/sync-routine-chat.mjs
npm test -- --runInBand --coverage
npm run test:scripts
npm run test:catalog
npx tsc --noEmit
npm run check:catalog
npm run check:compliance
npm run check:no-egress
```

The Edge HTTP tests run the actual shell with only its database/provider boundaries replaced. They check the outgoing completion fields with synthetic canaries and prove neither client initializes while disabled. Shared-copy tests prevent the deployed prompt, handler, validator, endpoint or availability value from drifting from the tested source. No real provider request is used by these tests.
