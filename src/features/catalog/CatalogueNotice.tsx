import { Body, Caption, GlassCard, PrimaryButton } from '../../components/ui';
import { refreshCatalogue } from '../match/product-catalog';
import type { CatalogueSnapshot } from './state';

type ShopNotice = {loading:boolean; error:string|null; cachedAt:number|null; empty:boolean};

/** One state surface for the reviewed catalogue and optional Storefront metadata. */
export function CatalogueNotice({state,shop,onRetry}: {
  state:CatalogueSnapshot; shop?:ShopNotice; onRetry?:()=>void;
}) {
  const loading=state.status==='loading' || state.status==='idle' || !!shop?.loading;
  const offline=state.status==='offline';
  const empty=state.status==='empty';
  let title:string;
  let detail:string|undefined;
  let retry=false;
  if(loading) title=shop ? 'Loading products…' : 'Loading verified shades…';
  else if(offline) {title='Catalogue unavailable';detail='Reconnect to check current shades, prices and availability.';retry=true;}
  else if(empty) {title='No verified shades available';detail='New shades appear after review and stock updates.';retry=true;}
  else if(shop?.cachedAt) {
    title=`Offline products · Last updated ${new Date(shop.cachedAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}`;
    detail='Prices and availability may have changed. Adding to bag and checkout are unavailable.';retry=true;
  } else if(shop?.error) {title='Shop unavailable';detail=shop.error;retry=true;}
  else if(shop?.empty) {title='No products available';detail='The Shopify collection is empty right now.';retry=true;}
  else return null;
  return <GlassCard testID="catalogue-notice" radius={22} className="my-3 gap-2 px-5 py-5">
    <Body>{title}</Body>
    {detail ? <Caption>{detail}</Caption> : null}
    {retry ? <PrimaryButton label={shop?.empty && !offline && !empty && !shop.error ? 'Refresh' : 'Try again'} variant="glass" onPress={onRetry ?? (()=>void refreshCatalogue(true))} /> : null}
  </GlassCard>;
}
