import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Scan } from '../../../lib/scans';
import { ScanHistoryDetailScreen } from '../ScanHistoryDetailScreen';

const scan: Scan = {
  id: 'scan-detail',
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

describe('ScanHistoryDetailScreen', () => {
  it('shows the saved cosmetic labels on cards without scores, claims, or images', async () => {
    const onBack = jest.fn();
    const view = await render(
      <ScanHistoryDetailScreen
        scanId="scan-detail"
        loadHistory={() => Promise.resolve([scan])}
        onBack={onBack}
      />,
    );

    await waitFor(() => expect(view.getByText('Warm Sand')).toBeTruthy());
    expect(view.getByText('Depth')).toBeTruthy();
    expect(view.getAllByText('Tan')).toHaveLength(2);
    expect(view.getByText('Undertone')).toBeTruthy();
    expect(view.getByText('Warm')).toBeTruthy();
    expect(view.getByText('Finish')).toBeTruthy();
    expect(view.getByText('Satin')).toBeTruthy();
    expect(view.getByText('Saved on')).toBeTruthy();
    expect(view.getByText('Past matches are a record, not a measure of change.')).toBeTruthy();
    expect(view.queryByText(/score|confidence|accurate|real shade/i)).toBeNull();
    expect(JSON.stringify(view.toJSON())).not.toContain('RCTImageView');

    await fireEvent.press(view.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
