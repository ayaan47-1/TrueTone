// Counsel-pending Draft A copy. Keep user-visible text verbatim with the 2026-10-06 draft.
export const CONSENT_COPY = {
  title: 'Before your cosmetic skin read',
  adult: 'TrueTone is available only to adults age 18 or older.',
  photoHeading: 'What happens to your photo.',
  photo:
    'Your device takes a photo of your face and analyzes it on your device to measure visible features of how your skin looks. The face photo never leaves your device. It is deleted from your device immediately after the read, including if the read fails.',
  storageHeading: 'What [LEGAL ENTITY NAME] stores.',
  storage:
    'We automatically save a scan record to your account. It may include derived cosmetic appearance scores, a skin-type label, a cosmetic routine, a coarse capture-quality label, the model version, the scan time, and—if enabled—a cosmetic skin-appearance-age estimate and confidence value. We also keep a consent receipt containing your user identifier, the time, the policy version, and whether you consented, withdrew, or requested deletion. We do not store the face photo on our servers.',
  purposeHeading: 'Why we use it.',
  purpose:
    'We use the on-device read and saved derived data to show your cosmetic skin-appearance results, match you to cosmetic shades, suggest a brand-neutral cosmetic routine, and show your own prior reads over time. TrueTone describes appearance only. It does not provide a diagnosis or medical advice.',
  retentionHeading: 'How long we keep it.',
  retention:
    'We delete identifiable derived scan data when its purpose has been met or no later than 3 years after your last interaction with TrueTone, whichever comes first. You can delete it sooner at any time by choosing Your Data → Delete My Data. Choosing Withdraw Consent stops future scans and deletes saved scan records. Choosing Delete Account deletes your account and its derived scan data. We may retain a de-identified consent receipt as proof of your consent and choices. Read the public Data Retention Schedule at [POLICY URL].',
  saleHeading: 'No sale or profit.',
  sale:
    '[LEGAL ENTITY NAME] will not sell, lease, trade, or otherwise profit from your face photo, derived scan data, or consent record. We will not disclose that data for advertising or analytics.',
  contact: 'Questions or privacy requests: [CONTACT EMAIL].',
  checkbox:
    'I am 18 or older. I have read the Biometric Data Policy and Data Retention Schedule at [POLICY URL]. I voluntarily consent to [LEGAL ENTITY NAME] collecting and processing my face photo on my device and automatically storing the derived scan data described above until its purpose is met or no later than 3 years after my last interaction, whichever comes first.',
} as const;
