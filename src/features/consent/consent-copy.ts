export const LEGAL_ENTITY_NAME = '[True Tone legal entity name]';

export const CONSENT_COPY = {
  title: 'Consent to Collection of Skin-Scan Data',
  introduction:
    'To use True Tone you will need to provide an electronic image of your face. To proceed with True Tone, click "I Agree" below.',
  authorization: `I authorize ${LEGAL_ENTITY_NAME} (and/or a software service provider acting on True Tone's behalf) to collect and process data derived from a scan of my photograph of my face ("Skin-Scan Data"). I understand that the Skin-Scan Data may include measurements relating to facial features, and that some may contend that this information is biometric.`,
  retention:
    "I understand that any Skin-Scan Data will not be retained by True Tone or True Tone's software service provider after I navigate away from this webpage or close the True Tone app. I understand that I have the option to save my Skin-Scan results to my preferences in my True Tone account, and that I can change those preferences at any time in my account.",
  withdrawal:
    'I am providing my consent voluntarily, and I understand that I may withdraw my consent by navigating outside of True Tone within the True Tone mobile application.',
  representation:
    'By providing my consent, I represent that I am not an Illinois resident, and I am not using this tool while in Illinois.',
} as const;
