import { useState } from 'react';
import { Text, View } from 'react-native';
import { Body, Heading, PrimaryButton } from '../../components/ui';
import { SUPABASE_OFFLINE } from '../../lib/supabase';
import { localFeedback, feedbackService, deleteOwnedFeedback } from './runtime';

export function FeedbackDataPanel({owner,confirm}:{owner:string;confirm:(message:string)=>Promise<boolean>}) {
  const [readable,setReadable]=useState('');
  const [message,setMessage]=useState('');
  const [page,setPage]=useState(0);
  const [more,setMore]=useState(false);
  async function viewLocal() {
    try { setReadable(JSON.stringify(await localFeedback.list(owner),null,2));setMessage('On this phone only. Select the text to copy your answers.'); }
    catch { setMessage('Could not read local answers.'); }
  }
  async function viewServer(offset=0) {
    try {
      const data=await feedbackService.list(offset);
      setReadable(JSON.stringify(data,null,2));setPage(offset);setMore(data.events.length===50);
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
    <PrimaryButton label="View / copy local feedback" variant="ghost" onPress={()=>void viewLocal()} />
    {!SUPABASE_OFFLINE ? <PrimaryButton label="View / copy server feedback" variant="ghost" onPress={()=>void viewServer()} /> : null}
    {more ? <PrimaryButton label="Next feedback page" variant="ghost" onPress={()=>void viewServer(page+50)} /> : null}
    <PrimaryButton label="Delete Shade Feedback" variant="ghost" onPress={()=>void remove()} />
    <PrimaryButton label="Withdraw Shade Feedback consent" variant="ghost" onPress={()=>void withdraw()} />
    {message ? <Body accessibilityRole="alert">{message}</Body> : null}
    {readable ? <Text selectable>{readable}</Text> : null}
  </View>;
}
