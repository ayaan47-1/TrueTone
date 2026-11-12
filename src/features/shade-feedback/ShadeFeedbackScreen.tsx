import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Body, Heading, PrimaryButton } from '../../components/ui';
import { localAnswerSchema } from './contract';
import type { z } from 'zod';

type Answer = z.infer<typeof localAnswerSchema>;
export function ShadeFeedbackScreen({variantId,save,onClose}:{variantId:string;save:(answer:Answer)=>Promise<void>;onClose:()=>void}) {
  const [depth,setDepth]=useState<Answer['depth_correction']>('not_sure');
  const [undertone,setUndertone]=useState<Answer['undertone_correction']>('not_sure');
  const [outcome,setOutcome]=useState<Answer['outcome']>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const options:readonly [Answer['depth_correction'],string][]=[['as_expected','Depth as expected'],['too_light','Too light'],['too_dark','Too dark'],['not_sure','Not sure about depth']];
  const tones:readonly [Answer['undertone_correction'],string][]=[['as_expected','Undertone as expected'],['too_warm','Too warm'],['too_cool','Too cool'],['not_sure','Not sure about undertone']];
  const outcomes:readonly [Answer['outcome'],string][]=[[null,'No outcome yet'],['kept','Kept'],['returned_color','Returned for colour'],['returned_other','Returned for another reason'],['still_deciding','Still deciding']];
  async function submit() {
    if (busy) return;
    setBusy(true);
    try {
      await save(localAnswerSchema.parse({variant_gid:variantId,depth_correction:depth,undertone_correction:undertone,outcome}));
      setMessage('Saved on this phone. Nothing was sent.');
    } catch { setMessage('Could not save. Please try again.'); }
    finally { setBusy(false); }
  }
  return <ScrollView contentContainerStyle={{padding:24,paddingTop:64,paddingBottom:48,gap:12}}>
    <Heading>How did this shade look?</Heading>
    <Body>Answer only after trying it. This optional answer stays on this phone and does not change your suggestions.</Body>
    <Heading>Depth</Heading>
    <View style={{gap:8}}>{options.map(([value,label])=><PrimaryButton key={value} label={label} variant={depth===value?'primary':'ghost'} onPress={()=>setDepth(value)} />)}</View>
    <Heading>Undertone</Heading>
    <View style={{gap:8}}>{tones.map(([value,label])=><PrimaryButton key={value} label={label} variant={undertone===value?'primary':'ghost'} onPress={()=>setUndertone(value)} />)}</View>
    <Heading>Outcome, optional</Heading>
    <View style={{gap:8}}>{outcomes.map(([value,label])=><PrimaryButton key={label} label={label} variant={outcome===value?'primary':'ghost'} onPress={()=>setOutcome(value)} />)}</View>
    <PrimaryButton label="Save on this phone" disabled={busy || (depth==='not_sure' && undertone==='not_sure')} onPress={()=>void submit()} />
    <PrimaryButton label="Cancel" variant="ghost" onPress={onClose} />
    {message ? <Body accessibilityRole="alert">{message}</Body> : null}
  </ScrollView>;
}
