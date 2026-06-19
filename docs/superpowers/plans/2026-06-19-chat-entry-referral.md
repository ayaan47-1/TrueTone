# Chat Entry Point + Dermatologist-Referral Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the already-built `ChatScreen` an entry point (a dedicated `/scan/chat` route reached from the routine view) and render a visually-distinct dermatologist-referral card plus a visible "sending" state.

**Architecture:** Frontend-only. `ChatScreen` gains a per-message `referred` flag (UI-only) that drives a distinct referral card; the wire `history` sent to the backend stays `{ role, content }`. A new `app/scan/chat.tsx` route renders `ChatScreen` from a `scanId` param. `app/scan/routine.tsx` adds a navigation button while keeping `RoutineView` pure.

**Tech Stack:** Expo Router, React Native, TypeScript, NativeWind, Jest + `@testing-library/react-native`.

## Global Constraints

- Frontend-only: **no** backend, Edge Function, migration, or RLS change. The `referred` signal and the `isMedicalQuery`/`REFERRAL_MESSAGE` refusal logic already exist and stay unchanged.
- The referral card reuses the backend-returned message verbatim as its body. The **only** UI-authored copy is the heading `"This isn't a diagnosis"` — no new medical/disease vocabulary.
- The wire `history` passed to `sendChat` MUST contain only `{ role, content }` — never the UI-only `referred` key.
- `RoutineView` stays pure (props: `{ routine }` only) — it is reused by the no-backend preview; do not add `scanId` or navigation to it.
- Chat history stays ephemeral (in component state, cleared on unmount). Do not persist it.
- No new dependencies.
- Test mock conventions (match existing suite): mock `../../src/lib/routine-chat` to avoid pulling in Supabase; mock `expo-router` per `app/__tests__/routes.test.tsx`.

---

### Task 1: ChatScreen referral card + sending indicator + wire-format history

**Files:**
- Modify: `src/features/recommend/ChatScreen.tsx`
- Test: `src/features/recommend/__tests__/ChatScreen.test.tsx`

**Interfaces:**
- Consumes: `sendChat(scanId: string, message: string, history: ChatTurn[]): Promise<{ reply: string; referred: boolean }>` and `type ChatTurn = { role: 'user' | 'assistant'; content: string }` from `src/lib/routine-chat.ts` (unchanged).
- Produces: `ChatScreen` component (unchanged props `{ scanId: string }`) that renders `testID="referral-card"` for referral turns and `testID="sending-indicator"` while a send is in flight.

- [ ] **Step 1: Write the failing tests**

Append these tests to `src/features/recommend/__tests__/ChatScreen.test.tsx` (keep the two existing tests). Add `getByTestId`/`queryByTestId` usage and the new import:

```tsx
import { findDiseaseTerms } from '../../../lib/cosmetic-filter';

test('renders a distinct referral card (not a plain bubble) for a referral reply', async () => {
  (sendChat as jest.Mock).mockResolvedValue({
    reply:
      "I can only describe how skin looks — please see a board-certified dermatologist, who can examine it properly.",
    referred: true,
  });
  const { getByPlaceholderText, getByText, getByTestId } = render(<ChatScreen scanId="s1" />);
  fireEvent.changeText(getByPlaceholderText(/ask about your routine/i), 'is this mole a problem?');
  fireEvent.press(getByText(/send/i));
  await waitFor(() => expect(getByTestId('referral-card')).toBeTruthy());
  expect(getByText(/isn.t a diagnosis/i)).toBeTruthy();
  expect(getByText(/board-certified dermatologist/i)).toBeTruthy();
});

test('the UI-authored referral heading contains no disease terms', () => {
  expect(findDiseaseTerms("This isn't a diagnosis")).toEqual([]);
});

test('a non-referral reply renders a plain bubble, not the referral card', async () => {
  (sendChat as jest.Mock).mockResolvedValue({ reply: 'The SPF step helps.', referred: false });
  const { getByPlaceholderText, getByText, queryByTestId } = render(<ChatScreen scanId="s1" />);
  fireEvent.changeText(getByPlaceholderText(/ask about your routine/i), 'why SPF?');
  fireEvent.press(getByText(/send/i));
  await waitFor(() => expect(getByText('The SPF step helps.')).toBeTruthy());
  expect(queryByTestId('referral-card')).toBeNull();
});

test('shows the sending indicator while awaiting and hides it after', async () => {
  let resolveSend!: (v: { reply: string; referred: boolean }) => void;
  (sendChat as jest.Mock).mockReturnValue(new Promise((r) => { resolveSend = r; }));
  const { getByPlaceholderText, getByText, queryByTestId } = render(<ChatScreen scanId="s1" />);
  fireEvent.changeText(getByPlaceholderText(/ask about your routine/i), 'why SPF?');
  fireEvent.press(getByText(/send/i));
  await waitFor(() => expect(queryByTestId('sending-indicator')).toBeTruthy());
  resolveSend({ reply: 'ok', referred: false });
  await waitFor(() => expect(queryByTestId('sending-indicator')).toBeNull());
});

test('strips the UI-only referred flag from the history sent to the backend', async () => {
  (sendChat as jest.Mock)
    .mockResolvedValueOnce({ reply: 'please see a dermatologist', referred: true })
    .mockResolvedValueOnce({ reply: 'the SPF step helps', referred: false });
  const { getByPlaceholderText, getByText } = render(<ChatScreen scanId="s1" />);
  fireEvent.changeText(getByPlaceholderText(/ask about your routine/i), 'is this mole bad?');
  fireEvent.press(getByText(/send/i));
  await waitFor(() => expect(getByText(/isn.t a diagnosis/i)).toBeTruthy());
  fireEvent.changeText(getByPlaceholderText(/ask about your routine/i), 'why SPF?');
  fireEvent.press(getByText(/send/i));
  await waitFor(() => expect((sendChat as jest.Mock).mock.calls.length).toBe(2));
  const secondCallHistory = (sendChat as jest.Mock).mock.calls[1][2];
  expect(secondCallHistory).toEqual([
    { role: 'user', content: 'is this mole bad?' },
    { role: 'assistant', content: 'please see a dermatologist' },
  ]);
  expect(secondCallHistory.every((t: Record<string, unknown>) => !('referred' in t))).toBe(true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx jest src/features/recommend/__tests__/ChatScreen.test.tsx`
Expected: FAIL — `referral-card` / `sending-indicator` testIDs not found; the strip-flag test fails because the current code passes the (untyped) `history` directly and never includes `referred`/assistant turns built the new way.

- [ ] **Step 3: Rewrite `ChatScreen.tsx`**

Replace the entire contents of `src/features/recommend/ChatScreen.tsx` with:

```tsx
import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { sendChat, type ChatTurn } from '../../lib/routine-chat';

interface ChatScreenProps {
  scanId: string;
}

// UI-only message model. `referred` drives the distinct referral card and is NEVER sent to the
// backend (the wire format is ChatTurn = { role, content }).
type Msg = { role: 'user' | 'assistant'; content: string; referred?: boolean };

export function ChatScreen({ scanId }: ChatScreenProps) {
  const [history, setHistory] = useState<Msg[]>([]); // session-only; cleared on unmount
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSend() {
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true);
    setError(false);
    const nextHistory: Msg[] = [...history, { role: 'user', content: message }];
    setHistory(nextHistory);
    setInput('');
    // Strip the UI-only `referred` flag — the backend sees only { role, content }.
    const wire: ChatTurn[] = history.map(({ role, content }) => ({ role, content }));
    try {
      const { reply, referred } = await sendChat(scanId, message, wire);
      setHistory([...nextHistory, { role: 'assistant', content: reply, referred }]);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 p-4">
      <ScrollView className="flex-1">
        {history.map((m, i) =>
          m.referred ? (
            <View
              key={i}
              testID="referral-card"
              accessibilityRole="text"
              className="mb-2 rounded-xl border border-amber-300 bg-amber-50 p-3"
            >
              <Text className="font-semibold mb-1">This isn&rsquo;t a diagnosis</Text>
              <Text>{m.content}</Text>
            </View>
          ) : (
            <Text key={i} className={m.role === 'user' ? 'text-right mb-2' : 'mb-2'}>
              {m.content}
            </Text>
          ),
        )}
        {busy && (
          <Text testID="sending-indicator" className="text-gray-400 italic mb-2">
            Sending…
          </Text>
        )}
        {error && (
          <Text className="text-red-600">Couldn&apos;t load a reply right now — please try again.</Text>
        )}
      </ScrollView>
      <View className="flex-row items-center mt-2">
        <TextInput
          className="flex-1 border rounded px-3 py-2"
          placeholder="Ask about your routine"
          value={input}
          onChangeText={setInput}
          editable={!busy}
        />
        <Pressable onPress={onSend} disabled={busy} className="ml-2 px-4 py-2 bg-black rounded">
          <Text className="text-white">Send</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx jest src/features/recommend/__tests__/ChatScreen.test.tsx`
Expected: PASS — all 6 tests (2 existing + 4 new) green.

- [ ] **Step 5: Commit**

```bash
git add src/features/recommend/ChatScreen.tsx src/features/recommend/__tests__/ChatScreen.test.tsx
git commit -m "feat(recommend): referral card + sending indicator in ChatScreen"
```

---

### Task 2: Chat route (`app/scan/chat.tsx`)

**Files:**
- Create: `app/scan/chat.tsx`
- Test: `app/__tests__/chat-route.test.tsx`

**Interfaces:**
- Consumes: `ChatScreen` from `src/features/recommend/ChatScreen.tsx` (props `{ scanId: string }`); `useLocalSearchParams` from `expo-router`.
- Produces: default-exported `ChatRoute` screen component for the `/scan/chat` route, reading a `scanId` query param.

- [ ] **Step 1: Write the failing test**

Create `app/__tests__/chat-route.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';

const mockParams = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams(),
}));
// Mock the chat client so the route test does not pull in Supabase.
jest.mock('../../src/lib/routine-chat', () => ({ sendChat: jest.fn() }));

import ChatRoute from '../scan/chat';

beforeEach(() => jest.clearAllMocks());

test('renders the chat when a scanId param is present', () => {
  mockParams.mockReturnValue({ scanId: 's1' });
  render(<ChatRoute />);
  expect(screen.getByPlaceholderText(/ask about your routine/i)).toBeTruthy();
});

test('renders a fallback (not the chat) when scanId is missing', () => {
  mockParams.mockReturnValue({});
  render(<ChatRoute />);
  expect(screen.getByText(/no scan yet/i)).toBeTruthy();
  expect(screen.queryByPlaceholderText(/ask about your routine/i)).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/__tests__/chat-route.test.tsx`
Expected: FAIL — `Cannot find module '../scan/chat'`.

- [ ] **Step 3: Create `app/scan/chat.tsx`**

```tsx
import { useLocalSearchParams } from 'expo-router';
import { View, Text } from 'react-native';
import { ChatScreen } from '../../src/features/recommend/ChatScreen';

export default function ChatRoute() {
  const { scanId } = useLocalSearchParams<{ scanId?: string }>();
  if (!scanId) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-gray-600">No scan yet — run a scan to ask about your routine.</Text>
      </View>
    );
  }
  return <ChatScreen scanId={scanId} />;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest app/__tests__/chat-route.test.tsx`
Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add app/scan/chat.tsx app/__tests__/chat-route.test.tsx
git commit -m "feat(recommend): /scan/chat route with missing-scan fallback"
```

---

### Task 3: Entry point on the routine route

**Files:**
- Modify: `app/scan/routine.tsx`
- Test: `app/__tests__/routine-route.test.tsx`

**Interfaces:**
- Consumes: `fetchLatestScan(): Promise<Scan | null>` and `type Scan` (with `id: string` and `routine: Routine`) from `src/lib/scans.ts`; `useRouter` from `expo-router`; the `/scan/chat` route from Task 2.
- Produces: the routine screen now renders an "Ask about your routine" button that calls `router.push({ pathname: '/scan/chat', params: { scanId: scan.id } })`.

- [ ] **Step 1: Write the failing test**

Edit `app/__tests__/routine-route.test.tsx`. Add `fireEvent` to the testing-library import, add a hoisted `mockPush` + an `expo-router` mock, and add the navigation test. Keep the existing "renders the latest scan routine" test. Full new file contents:

```tsx
import { render, screen, waitFor, fireEvent } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

import RoutineRoute from '../scan/routine';
import { fetchLatestScan } from '../../src/lib/scans';

jest.mock('../../src/lib/scans', () => ({ fetchLatestScan: jest.fn() }));

const SAMPLE_SCAN = {
  id: 's1', capturedAt: '2026-06-18', skinType: 'dry',
  scores: {}, modelVersion: 'stub-1', isStub: true,
  routine: {
    version: 'skincare-1',
    am: [{ category: 'a broad-spectrum SPF 30+ sunscreen', habit: 'am', rationale: 'r', dimensions: [] }],
    pm: [], notes: [],
  },
};

beforeEach(() => jest.clearAllMocks());

test('renders the latest scan routine', async () => {
  (fetchLatestScan as jest.Mock).mockResolvedValue(SAMPLE_SCAN);
  render(<RoutineRoute />);
  await waitFor(() => expect(screen.getByText(/broad-spectrum SPF/)).toBeTruthy());
});

test('navigates to /scan/chat with the scanId when the button is pressed', async () => {
  (fetchLatestScan as jest.Mock).mockResolvedValue(SAMPLE_SCAN);
  render(<RoutineRoute />);
  const button = await screen.findByText(/ask about your routine/i);
  fireEvent.press(button);
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/scan/chat', params: { scanId: 's1' } });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest app/__tests__/routine-route.test.tsx`
Expected: FAIL — `findByText(/ask about your routine/i)` finds nothing (button not yet added).

- [ ] **Step 3: Update `app/scan/routine.tsx`**

Replace the entire contents with:

```tsx
import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchLatestScan, type Scan } from '../../src/lib/scans';
import { RoutineView } from '../../src/features/recommend/RoutineView';

export default function RoutineRoute() {
  const router = useRouter();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLatestScan().then(setScan).finally(() => setLoading(false));
  }, []);

  if (loading) return <View><Text>Loading…</Text></View>;
  if (!scan) return <View><Text>No scan yet — run a scan to see your routine.</Text></View>;
  return (
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
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest app/__tests__/routine-route.test.tsx`
Expected: PASS — both tests green.

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npx jest && npx tsc --noEmit`
Expected: all tests pass; `tsc` reports no errors.

- [ ] **Step 6: Commit**

```bash
git add app/scan/routine.tsx app/__tests__/routine-route.test.tsx
git commit -m "feat(recommend): routine view entry point to /scan/chat"
```

---

## Notes for the implementer

- Run `npx jest <path>` for single-file runs; the project uses `jest-expo`.
- Do not touch any file under `supabase/` — this feature is frontend-only (Global Constraints).
- The referral message text is produced by the backend; the card only wraps it with the
  `"This isn't a diagnosis"` heading and styling. Do not hardcode a second copy of the referral
  message in the component.
