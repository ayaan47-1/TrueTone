import { CommunityScreen } from '../../src/features/community/CommunityScreen';

/**
 * Route wrapper for the Community tab. Stable, no-props — keeps `src/features/community/**`
 * (owned by the Social agent) decoupled from routing (owned by Commerce).
 */
export default function Community() {
  return <CommunityScreen />;
}
