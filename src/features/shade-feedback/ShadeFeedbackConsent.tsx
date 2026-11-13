import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { Body, Heading, PrimaryButton } from '../../components/ui';
import { SERVER_FEEDBACK_ENABLED } from './flags';

/** Dormant review component. Do not mount until approved notices are live. */
export function ShadeFeedbackConsent({onAccept,onDecline}:{onAccept:()=>Promise<void>;onDecline:()=>void}) {
  const [checked,setChecked]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  if(!SERVER_FEEDBACK_ENABLED) return null;
  async function accept() {
    if(!checked || busy) return;
    setBusy(true);
    try {await onAccept();}
    catch {setMessage('Could not record your choice. Nothing will be sent.');}
    finally {setBusy(false);}
  }
  return <ScrollView contentContainerStyle={{padding:24,paddingTop:64,gap:16}}>
    <Heading>Shade Feedback Improvement</Heading>
    <Body>This is a separate, optional choice. Matching and shopping work the same if you decline.</Body>
    <Body>With your permission, we retain product and shown-candidate identifiers, catalogue and engine versions, your directional answer, optional outcome and dates to evaluate cosmetic shade suggestions.</Body>
    <Body>We do not include your picture, saved read identifier, skin measurements, written comments or purchase records. We do not use answers for advertising or share them with other companies.</Body>
    <Body>Answers are deleted when their evaluation purpose ends, or within twelve months, whichever comes first. In Your Data you can view or copy them, withdraw this choice, or delete them. Delete My Data and Delete Account remove them too.</Body>
    <Body>Cosmetic preferences only. No promise of a match.</Body>
    <Pressable accessibilityRole="checkbox" accessibilityState={{checked}} accessibilityLabel="I agree to optional Shade Feedback Improvement" onPress={()=>setChecked(!checked)} style={{minHeight:44,justifyContent:'center'}}>
      <Body>{checked?'Selected':'Not selected'}: I agree to optional Shade Feedback Improvement</Body>
    </Pressable>
    <PrimaryButton label="Allow optional feedback" disabled={!checked || busy} onPress={()=>void accept()} />
    <PrimaryButton label="Not now" variant="ghost" onPress={onDecline} />
    {message ? <Body>{message}</Body> : null}
  </ScrollView>;
}
