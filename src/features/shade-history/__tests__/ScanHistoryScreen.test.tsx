import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Scan } from '../../../lib/scans';
import { ScanHistoryScreen } from '../ScanHistoryScreen';

const warmSandScan: Scan = {
  id: 'scan-warm-sand',
  capturedAt: '2026-10-27T16:20:00.000Z',
  skinType: 'combination',
  scores: {
    hydration: 0.5,
    oiliness: 0.5,
    texture: 0.5,
    pores: 0.5,
    darkSpots: 0.5,
    redness: 0.5,
    fineLines: 0.5,
    darkCircles: 0.5,
  },
  modelVersion: 'fixture',
  isStub: true,
  routine: { version: 'fixture', am: [], pm: [], notes: [] },
  skinAge: null,
  skinAgeConfidence: null,
  routineHelpful: null,
  captureQuality: 'good',
  shade: {
    shadeName: 'Warm Sand',
    depthBand: 'tan',
    undertone: 'warm',
    finish: 'satin',
  },
  captureMode: 'pair',
};

const deepNeutralScan: Scan = {
  ...warmSandScan,
  id: 'scan-deep-neutral',
  capturedAt: '2026-10-22T09:10:00.000Z',
  shade: {
    shadeName: 'Deep Neutral',
    depthBand: 'deep',
    undertone: 'neutral',
    finish: 'natural',
  },
};

describe('ScanHistoryScreen', () => {
  it('lists past scans with dates, saved shade words, fixed chips, and the required footer', async () => {
    const onOpen = jest.fn();
    const view = await render(
      <ScanHistoryScreen
        loadHistory={() => Promise.resolve([warmSandScan, deepNeutralScan])}
        clearHistory={() => Promise.resolve()}
        onBack={jest.fn()}
        onOpen={onOpen}
      />,
    );

    await waitFor(() => expect(view.getByText('Warm Sand')).toBeTruthy());
    expect(view.getByText('Tan · Warm · Satin')).toBeTruthy();
    expect(view.getByText('Deep Neutral')).toBeTruthy();
    expect(view.getByText('Deep · Neutral · Natural')).toBeTruthy();
    expect(view.getByText('Past matches are a record, not a measure of change.')).toBeTruthy();
    expect(view.getByTestId('shade-chip-scan-warm-sand').props.style).toEqual(
      expect.objectContaining({ backgroundColor: expect.any(String) }),
    );

    await fireEvent.press(view.getByRole('button', { name: /Warm Sand/ }));
    expect(onOpen).toHaveBeenCalledWith('scan-warm-sand');
  });

  it('shows the empty state only when no scans exist', async () => {
    const onBack = jest.fn();
    const view = await render(
      <ScanHistoryScreen
        loadHistory={() => Promise.resolve([])}
        clearHistory={() => Promise.resolve()}
        onBack={onBack}
        onOpen={jest.fn()}
      />,
    );

    await waitFor(() => expect(view.getByText('No scans saved yet')).toBeTruthy());
    expect(view.queryByRole('button', { name: 'Clear shade history' })).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Back to Account' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('keeps saved labels visible until clear succeeds, then leaves neutral dated rows', async () => {
    let finishClear: (() => void) | undefined;
    const clearHistory = jest.fn(
      () => new Promise<void>((resolve) => { finishClear = resolve; }),
    );
    const view = await render(
      <ScanHistoryScreen
        loadHistory={() => Promise.resolve([warmSandScan])}
        clearHistory={clearHistory}
        onBack={jest.fn()}
        onOpen={jest.fn()}
      />,
    );

    await waitFor(() => expect(view.getByText('Warm Sand')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Clear shade history' }));
    expect(view.getByText('Clear saved shade labels?')).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Clear saved shades' }));
    expect(clearHistory).toHaveBeenCalledTimes(1);
    expect(view.getByText('Warm Sand', { includeHiddenElements: true })).toBeTruthy();

    finishClear?.();
    await waitFor(() => expect(view.getByText('Shade removed')).toBeTruthy());
    expect(view.queryByText('Warm Sand')).toBeNull();
    expect(view.queryByRole('button', { name: 'Clear shade history' })).toBeNull();
    expect(view.getByTestId('shade-chip-scan-warm-sand').props.accessibilityLabel).toBe('No saved shade');
  });

  it('shows a retryable load error without presenting the empty state', async () => {
    const loadHistory = jest
      .fn<Promise<Scan[]>, []>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([warmSandScan]);
    const view = await render(
      <ScanHistoryScreen
        loadHistory={loadHistory}
        clearHistory={() => Promise.resolve()}
        onBack={jest.fn()}
        onOpen={jest.fn()}
      />,
    );

    await waitFor(() => expect(view.getByText("Couldn't load scan history.")).toBeTruthy());
    expect(view.queryByText('No scans saved yet')).toBeNull();
    await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(view.getByText('Warm Sand')).toBeTruthy());
    expect(loadHistory).toHaveBeenCalledTimes(2);
  });

  it('keeps the list and offers retry when clearing fails', async () => {
    const clearHistory = jest
      .fn<Promise<void>, []>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce();
    const view = await render(
      <ScanHistoryScreen
        loadHistory={() => Promise.resolve([warmSandScan])}
        clearHistory={clearHistory}
        onBack={jest.fn()}
        onOpen={jest.fn()}
      />,
    );

    await waitFor(() => expect(view.getByText('Warm Sand')).toBeTruthy());
    await fireEvent.press(view.getByRole('button', { name: 'Clear shade history' }));
    await fireEvent.press(view.getByRole('button', { name: 'Clear saved shades' }));
    await waitFor(() => expect(view.getByRole('alert')).toBeTruthy());
    expect(view.getByText('Warm Sand', { includeHiddenElements: true })).toBeTruthy();
    await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(view.getByText('Shade removed')).toBeTruthy());
    expect(clearHistory).toHaveBeenCalledTimes(2);
  });
});
