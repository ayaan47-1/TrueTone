import { useLocalSearchParams, useRouter } from 'expo-router';
import { Body } from '../src/components/ui';
import { useProfile } from '../src/lib/profile-context';
import { ShadeFeedbackScreen } from '../src/features/shade-feedback/ShadeFeedbackScreen';
import { localFeedback } from '../src/features/shade-feedback/runtime';

export default function ShadeFeedbackRoute() {
  const {userId,route,loading,error}=useProfile();
  const {variant}=useLocalSearchParams<{variant:string}>();
  const router=useRouter();
  if (loading || error || route!=='home' || !userId || !/^gid:\/\/shopify\/ProductVariant\/\d+$/.test(variant??'')) return <Body>Choose a reviewed shade before answering.</Body>;
  return <ShadeFeedbackScreen variantId={variant} save={answer=>localFeedback.save(userId,answer)} onClose={()=>router.back()} />;
}
