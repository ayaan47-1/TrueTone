import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Body, Caption, Eyebrow, Heading, PrimaryButton } from '../../components/ui';
import { ProductDetailShell } from '../shop/ProductDetailShell';
import { ProductArt } from '../shop/ProductArt';
import { FINISH_LABELS } from '../../content/makeup-vocab';
import { shopifyStore } from '../commerce/shopify/shopify-store';
import { hasAcceptedShopPrivacy } from '../commerce/shopify/shop-privacy';
import { availableAlternatives } from './alternatives';
import { CatalogueNotice } from './CatalogueNotice';
import type { CatalogueSnapshot } from './state';
import type { Product } from '../match/match-types';
import { readApprovedVariant } from '../match/product-catalog';

export function LiveProductDetail({ productId,state,onChoose,onClose,onAdded,onShop }: {
  productId:string; state:CatalogueSnapshot; onChoose:(id:string)=>void; onClose:()=>void; onAdded:()=>void; onShop?:()=>void;
}) {
  const fromPage=state.products.find(item=>item.id===productId);
  const [lookup,setLookup]=useState<{id:string;status:'loading'}|{id:string;status:'ready';product:Product|null}|{id:string;status:'offline'}>({id:productId,status:'loading'});
  const [lookupAttempt,setLookupAttempt]=useState(0);
  useEffect(()=>{
    if(fromPage || (state.status!=='ready' && state.status!=='empty')) return;
    let current=true;
    setLookup({id:productId,status:'loading'});
    void readApprovedVariant(productId).then(product=>{if(current)setLookup({id:productId,status:'ready',product});},()=>{if(current)setLookup({id:productId,status:'offline'});});
    return()=>{current=false;};
  },[productId,fromPage,state.status,lookupAttempt]);
  const currentLookup=lookup.id===productId?lookup:null;
  const readable=state.status==='ready' || state.status==='empty';
  const product=readable ? fromPage??(currentLookup?.status==='ready'?currentLookup.product:null) : null;
  const checking=readable && !fromPage && currentLookup?.status!=='ready' && currentLookup?.status!=='offline';
  const previous=state.previousProducts.find(item=>item.id===productId);
  const [findAlternatives,setFindAlternatives]=useState(false);
  const [message,setMessage]=useState('');
  const [adding,setAdding]=useState(false);
  const alternatives=previous && findAlternatives ? availableAlternatives(previous,state.products,
    previous.catalogue?.coverage && previous.finish!=='unknown' ? {finish:previous.finish,coverage:previous.catalogue.coverage,budget:previous.price,currency:'USD'} : null,0) : [];

  async function add() {
    if (!product || adding) return;
    setAdding(true);
    setMessage('');
    if (await shopifyStore.addToCart(productId,1)) { onAdded(); }
    else { setMessage('This shade could not be added. Try again.'); }
    setAdding(false);
  }

  const footer = product ? hasAcceptedShopPrivacy()
    ? <PrimaryButton label="Add this shade to Shopify bag" fullWidth disabled={adding} onPress={()=>void add()} />
    : <PrimaryButton label="Open Shop" fullWidth onPress={onShop ?? onClose} /> : null;
  return <ProductDetailShell onClose={onClose} hero={product ? <ProductArt product={product} height={380} radius={0} /> : undefined} footer={footer}>
    <View className="rounded-t-[28px] bg-mist-50 px-6 pt-6 gap-3">
    <CatalogueNotice state={state} />
    {product ? <>
      <Eyebrow>Reviewed catalogue shade</Eyebrow>
      <Heading>{product.name}</Heading>
      <Caption>{product.shadeName}</Caption>
      <Body>{FINISH_LABELS[product.finish]}</Body>
      <Body>{`$${product.price.toFixed(2)} USD`}</Body>
      <Caption>Product image and colour swatch unavailable.</Caption>
      <Caption>Reviewed catalogue shade. Shade suggestions are estimates.</Caption>
      {!hasAcceptedShopPrivacy() ? <Body>Open Shop first to review its privacy notice before adding this shade.</Body> : null}
    </> : readable && currentLookup?.status==='offline' ? <>
      <Heading>Catalogue unavailable</Heading>
      <Body>Reconnect to confirm this shade.</Body>
      <PrimaryButton label="Try again" onPress={()=>setLookupAttempt(attempt=>attempt+1)} />
    </> : checking ? <Heading>Checking shade availability…</Heading> : state.status==='ready' || state.status==='empty' ? <>
      <Heading>This shade is unavailable</Heading>
      {previous?.catalogue?.coverage && previous.finish!=='unknown' ? <>
        <Body>{`Find available alternatives in the same depth band with ${previous.finish} finish and ${previous.catalogue.coverage} coverage, up to $${previous.price.toFixed(2)} USD.`}</Body>
        <PrimaryButton label="Show alternatives" onPress={()=>setFindAlternatives(true)} />
      </> : null}
      {findAlternatives && !alternatives.length ? <Body>No suitable available alternatives on this page.</Body> : null}
      {alternatives.map(item=><PrimaryButton key={item.id} label={item.name} variant="glass" onPress={()=>{setFindAlternatives(false);onChoose(item.id);}} />)}
    </> : null}
    {message ? <Body>{message}</Body> : null}
    </View>
  </ProductDetailShell>;
}
