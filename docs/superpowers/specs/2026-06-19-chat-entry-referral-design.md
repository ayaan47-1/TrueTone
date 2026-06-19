# Chat Entry Point + Dermatologist-Referral Card — Design

**Date:** 2026-06-19
**Status:** Design (approved for planning)
**Scope:** Frontend only. No backend, migration, or compliance-boundary changes.

## Goal

Close two gaps left when the routine + chat feature (build-order step 6, PR #3) merged:

1. `ChatScreen` is built and tested but has **no entry point** — nothing in the app opens it.
2. The chat has no **visually-distinct dermatologist-referral state** (spec §5.2), even though the
   backend already signals one.

This work wires the entry point as a dedicated route, renders the referral card when a turn is a
referral, and surfaces the already-present (but invisible) "sending" state.

## Context (current state on `main`)

- `src/lib/routine-chat.ts` — `sendChat(scanId, message, history)` **already returns
  `{ reply: string; referred: boolean }`**. The `referred` flag is set by the backend
  (`supabase/functions/routine-chat`) via the input-side `isMedicalQuery` refusal in
  `src/features/recommend/chat/refusal.ts`, which returns the compliant `REFERRAL_MESSAGE`.
- `src/features/recommend/ChatScreen.tsx` — holds session-only `history: ChatTurn[]`, renders each
  turn as a plain `<Text>` bubble, has an **invisible** `busy` flag, and an `error` state. It
  **ignores `referred`** — a referral currently renders as an ordinary assistant bubble.
- `src/features/recommend/RoutineView.tsx` — **pure presentational** component taking only
  `{ routine }`. Reused by the no-backend preview, so it must stay free of `scanId`/navigation.
- `app/scan/routine.tsx` — the route that owns the loaded `scan` (and thus `scan.id`); renders
  `<RoutineView routine={scan.routine} />`.

## Compliance posture (CLAUDE.md)

- No image, no new SDK, no new vendor, no network egress introduced — all edits are client-side
  rendering of data that already crosses the boundary.
- The referral card reuses the backend-returned `REFERRAL_MESSAGE` verbatim as its body; it adds a
  heading and styling only. No new user-facing medical/disease vocabulary is authored. The
  hard-refusal logic (`isMedicalQuery`) and output post-filter are unchanged.
- The card's purpose is the spec §5.2 requirement: a referral state that is **visually distinct**
  and framed as **"this isn't a diagnosis."**

## Design

### 1. New route — `app/scan/chat.tsx`

- Reads `scanId` via `useLocalSearchParams<{ scanId?: string }>()`.
- If `scanId` is a non-empty string → render `<ChatScreen scanId={scanId} />`.
- If `scanId` is missing/empty → render a graceful fallback
  (`"No scan yet — run a scan to ask about your routine."`) instead of mounting `ChatScreen` with a
  bad id. This prevents a backend call with an invalid scan.
- The Stack header (already `headerShown: true`) provides the back affordance. Navigating back
  unmounts the screen, which clears the ephemeral in-component history (spec §5.2: "cleared on
  exit, never persisted").

### 2. Entry point — `app/scan/routine.tsx`

- `RoutineView` stays pure (unchanged). The route composes the button around it:

  ```
  <View className="flex-1">
    <RoutineView routine={scan.routine} />
    <Pressable
      accessibilityRole="button"
      className="m-4 bg-violet-600 active:bg-violet-700 rounded-2xl py-4 items-center"
      onPress={() => router.push({ pathname: '/scan/chat', params: { scanId: scan.id } })}
    >
      <Text className="text-white text-base font-semibold">Ask about your routine</Text>
    </Pressable>
  </View>
  ```

- The "Ask about your routine" label sets scope expectations (spec §5.2: "input affordance … sets
  scope expectations").

### 3. Referral card — `ChatScreen.tsx`

- Local message model becomes a UI type that carries the flag:

  ```ts
  type Msg = { role: 'user' | 'assistant'; content: string; referred?: boolean };
  ```

- On a reply: `setHistory([...next, { role: 'assistant', content: reply, referred }])`.
- The `history` argument passed to `sendChat` is mapped to the wire type, stripping the UI flag:
  `history.map(({ role, content }) => ({ role, content }))`. The backend never sees `referred`.
- Rendering:
  - `referred === true` → a **distinct card**, not a plain bubble:
    - bordered, rounded, neutral-warm background (e.g. `border border-amber-300 bg-amber-50`),
    - bold heading **"This isn't a diagnosis"**,
    - body = the message `content` (the backend's `REFERRAL_MESSAGE`),
    - `accessibilityRole="text"` and `testID="referral-card"` for test/assistive access.
  - otherwise → the existing plain bubble.

### 4. Sending indicator — `ChatScreen.tsx`

- While `busy`, render a muted tail line (`testID="sending-indicator"`, text `"Sending…"`) and
  disable the `TextInput` and Send `Pressable` (`editable={!busy}`, guarded `onPress`).
- Clears when the reply arrives or `error` is set.

## Testing (TDD)

All Jest + React Native Testing Library, matching the existing suite.

- **`app/scan/chat.tsx`**
  - With `scanId` param present → renders `ChatScreen` (assert an element it owns, e.g. the input
    placeholder "Ask about your routine").
  - With no `scanId` param → renders the fallback text, does **not** mount `ChatScreen`.
- **`app/scan/routine.tsx`** (entry point)
  - When a scan is loaded, the "Ask about your routine" button is present.
  - Pressing it calls `router.push` with `{ pathname: '/scan/chat', params: { scanId: <scan.id> } }`
    (mock `expo-router`).
- **`ChatScreen.tsx`**
  - A reply with `referred: true` renders `testID="referral-card"` containing the "This isn't a
    diagnosis" heading and the referral body, and **not** a plain assistant bubble for that turn.
  - The referral card body contains no disease terms (sanity check against the cosmetic filter's
    blocklist).
  - A reply with `referred: false` renders a plain bubble (no referral card).
  - While the `sendChat` promise is pending, `testID="sending-indicator"` is shown and the Send
    control is disabled; after resolution it is gone.
  - `sendChat` is called with `history` containing only `{ role, content }` (no `referred` key),
    even after a prior referral turn.

## Out of scope

- **Offline state** (NetInfo-based "chat disabled, routine still works") — deferred; tracked
  separately.
- Camera read → `recordScan` (P2 Phase 4, device/iOS-gated).
- Any backend, Edge Function, migration, or RLS change.
- Persisting chat history (it remains ephemeral by design).

## Files

- Create: `app/scan/chat.tsx`, `app/__tests__/chat-route.test.tsx`
- Modify: `app/scan/routine.tsx`, `src/features/recommend/ChatScreen.tsx`
- Modify/extend tests: `app/__tests__/routine-route.test.tsx`,
  `src/features/recommend/__tests__/ChatScreen.test.tsx` (both already exist)

Existing test conventions to follow: `expo-router` is mocked as
`jest.mock('expo-router', () => ({ ..., useRouter: () => ({ push: jest.fn() }) }))` (see
`app/__tests__/routes.test.tsx`); the new route test and the entry-point test should follow that
pattern, capturing the `push` mock to assert navigation args.
