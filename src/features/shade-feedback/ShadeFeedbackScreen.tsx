import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Body, Caption, GlassCard, Heading, PrimaryButton, Screen, HEADER_CLEARANCE } from '../../components/ui';
import { localAnswerSchema } from './contract';
import type { z } from 'zod';

type Answer = z.infer<typeof localAnswerSchema>;

function ChoiceGroup<T extends string|null>({title,options,value,onChange}:{
  title:string;options:readonly (readonly [T,string])[];value:T;onChange:(next:T)=>void;
}) {
  return <View style={{gap:8}} accessibilityRole="radiogroup" accessibilityLabel={title}>
    <Heading>{title}</Heading>
    <GlassCard flat radius={22} className="px-4 py-1">
      {options.map(([next,label])=><Pressable key={label} accessibilityRole="radio" accessibilityLabel={label}
        accessibilityState={{checked:value===next,selected:value===next}} onPress={()=>onChange(next)}
        style={{minHeight:44,paddingVertical:14,flexDirection:'row',alignItems:'center',gap:12}}>
        <Body style={{flex:1}}>{label}</Body>
        <Body accessible={false}>{value===next?'●':'○'}</Body>
      </Pressable>)}
    </GlassCard>
  </View>;
}
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
  return <Screen className="px-6" topGap={HEADER_CLEARANCE} bottomGap={24} contentStyle={{gap:12}} scrollTestID="shade-feedback-form">
    <Heading>How did this shade look?</Heading>
    <Body>Answer only after trying it. This optional answer stays on this phone and does not change your suggestions.</Body>
    <ChoiceGroup title="Depth" options={options} value={depth} onChange={setDepth} />
    <ChoiceGroup title="Undertone" options={tones} value={undertone} onChange={setUndertone} />
    <ChoiceGroup title="Outcome, optional" options={outcomes} value={outcome} onChange={setOutcome} />
    {depth==='not_sure' && undertone==='not_sure' ? <Caption>Pick at least one direction for depth or undertone to save.</Caption> : null}
    <PrimaryButton label="Save on this phone" disabled={busy || (depth==='not_sure' && undertone==='not_sure')} onPress={()=>void submit()} />
    <PrimaryButton label="Cancel" variant="ghost" onPress={onClose} />
    {message ? <Body accessibilityRole="alert">{message}</Body> : null}
  </Screen>;
}
