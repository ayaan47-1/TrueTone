import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Body, Caption, GlassCard, Heading, ListRow } from '../../components/ui';
import { SUPABASE_OFFLINE } from '../../lib/supabase';
import { localFeedback, feedbackService, deleteOwnedFeedback } from './runtime';

export function FeedbackDataPanel({owner,confirm}:{owner:string;confirm:(message:string)=>Promise<boolean>}) {
  const [readable,setReadable]=useState('');
  const [message,setMessage]=useState('');
  const [page,setPage]=useState(0);
  const [more,setMore]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [source,setSource]=useState<'local'|'server'>('local');
  async function viewLocal() {
    try { setReadable(JSON.stringify(await localFeedback.list(owner),null,2));setSource('local');setExpanded(false);setMore(false);setMessage('On this phone only. Select the text to copy your answers.'); }
    catch { setMessage('Could not read local answers.'); }
  }
  async function viewServer(offset=0) {
    try {
      const data=await feedbackService.list(offset);
      setReadable(JSON.stringify(data,null,2));setPage(offset);setMore(data.events.length===50);
      setSource('server');setExpanded(false);
      setMessage('Your server answers. Select the text to copy this page.');
    } catch { setMessage('Could not read server answers. Try again.'); }
  }
  async function remove() {
    if(!await confirm('Delete your shade feedback on this phone and the server?')) return;
    try {await deleteOwnedFeedback(owner);setReadable('');setMessage('Shade feedback deleted.');}
    catch {setMessage('Deletion incomplete. Try Delete Shade Feedback again.');}
  }
  async function withdraw() {
    if(!await confirm('Withdraw optional shade-feedback consent and delete its answers?')) return;
    try {
      const results=await Promise.allSettled([localFeedback.clear(owner),...(!SUPABASE_OFFLINE?[feedbackService.withdraw()]:[])]);
      if(results.some(result=>result.status==='rejected')) throw new Error('Withdrawal incomplete');
      setReadable('');setMessage('Optional consent withdrawn and answers deleted.');
    } catch {setMessage('Withdrawal incomplete. Please try again.');}
  }
  return <View style={{gap:12,marginBottom:20}}>
    <Heading>Shade Feedback</Heading>
    <Body>Optional directional answers stay on this phone by default. Server collection is not enabled.</Body>
    <GlassCard flat radius={22} className="px-5 py-2">
      <ListRow label="View / copy local feedback" caption="Answers saved on this phone" onPress={()=>void viewLocal()} />
      {!SUPABASE_OFFLINE ? <ListRow label="View / copy server feedback" caption="Read a page of your server answers" onPress={()=>void viewServer()} /> : null}
      {more ? <ListRow label="Next feedback page" onPress={()=>void viewServer(page+50)} /> : null}
    </GlassCard>
    <GlassCard flat radius={22} className="px-5 py-2">
      <ListRow label="Delete Shade Feedback" destructive hideChevron onPress={()=>void remove()} />
      <ListRow label="Withdraw Shade Feedback consent" destructive hideChevron onPress={()=>void withdraw()} />
    </GlassCard>
    {message ? <Body accessibilityRole="alert">{message}</Body> : null}
    {readable ? <GlassCard flat radius={22} className="px-5 py-4 gap-2">
      <Heading>{source==='local'?'Local feedback export':'Server feedback export'}</Heading>
      <Caption>{source==='local'?'Saved answers on this phone.':`Server page ${Math.floor(page/50)+1}.`} Open the readable JSON below to select and copy it.</Caption>
      <Pressable accessibilityRole="button" accessibilityLabel={expanded?'Hide readable export':'Show readable export'}
        accessibilityState={{expanded}} onPress={()=>setExpanded(value=>!value)} style={{minHeight:44,paddingVertical:12}}>
        <Body>{expanded?'Hide readable export':'Show readable export'}</Body>
      </Pressable>
      {expanded ? <ScrollView testID="feedback-export-scroll" nestedScrollEnabled style={{maxHeight:240}}>
        <Body selectable accessibilityLabel={`${source==='local'?'Local':'Server'} feedback JSON`}>{readable}</Body>
      </ScrollView> : null}
    </GlassCard> : null}
  </View>;
}
