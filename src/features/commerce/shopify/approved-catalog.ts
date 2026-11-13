import { z } from 'zod';
import type { ShopifyCatalog } from './catalog';
import type { ShopifyClient } from './client';
import { mapProductNode } from './product-mapper';
import type { ShopifyProduct } from './types';
import type { CataloguePage } from '../../catalog/repository';

const money=z.object({amount:z.string().regex(/^\d+(\.\d+)?$/),currencyCode:z.string().length(3)});
const image=z.object({url:z.string(),width:z.number().nullable().optional(),height:z.number().nullable().optional()});
const node=z.object({id:z.string(),title:z.string(),availableForSale:z.boolean(),quantityAvailable:z.number().nullable(),
  price:money,compareAtPrice:money.nullable(),image:image.nullable(),selectedOptions:z.array(z.object({name:z.string(),value:z.string()})),
  product:z.object({id:z.string(),handle:z.string(),title:z.string(),vendor:z.string(),featuredImage:image.nullable()})});
const query=`query ApprovedVariants($ids:[ID!]!) @inContext(visitorConsent:{analytics:false,preferences:false,marketing:false,saleOfData:false}) {
  nodes(ids:$ids){... on ProductVariant {id title availableForSale quantityAvailable price{amount currencyCode}
    compareAtPrice{amount currencyCode} image{url width height} selectedOptions{name value}
    product{id handle title vendor featuredImage{url width height}}}}
}`;

const identityQuery=`query ApprovedProductIdentity($handle:String!) @inContext(visitorConsent:{analytics:false,preferences:false,marketing:false,saleOfData:false}) {product(handle:$handle){id handle title vendor featuredImage{url width height}}}`;
async function fetchApproved(client:ShopifyClient,approved:readonly {id:string}[]):Promise<ShopifyProduct[]> {
    const ids=Array.from(new Set(approved.map(product=>product.id)));
    const allowed=new Set(ids);
    const products=new Map<string,ShopifyProduct>();
    for(let offset=0;offset<ids.length;offset+=50){
      const response=z.object({nodes:z.array(node.nullable())}).parse(await client.request(query,{ids:ids.slice(offset,offset+50)}));
      for(const variant of response.nodes){
        if(!variant || !allowed.has(variant.id) || !variant.availableForSale || variant.price.currencyCode !== 'USD' ||
          (variant.compareAtPrice && variant.compareAtPrice.currencyCode !== 'USD')) continue;
        const mapped=mapProductNode({...variant.product,variants:{nodes:[variant]}});
        const previous=products.get(mapped.id);
        products.set(mapped.id,previous?{...mapped,variants:[...previous.variants,...mapped.variants]}:mapped);
      }
    }
    return [...products.values()];
}

export async function approvedShopifyVariant(client:ShopifyClient,validate:(id:string)=>Promise<{id:string}|null>,id:string) {
  if((await validate(id))?.id!==id) return null;
  const products=await fetchApproved(client,[{id}]);
  return products.flatMap(product=>product.variants).find(variant=>variant.id===id)??null;
}

export function createApprovedShopifyCatalog(client:ShopifyClient,approved:()=>Promise<readonly {id:string}[]>,productPage:(id:string,after:string|null)=>Promise<CataloguePage>):ShopifyCatalog {
  const list=async()=>fetchApproved(client,await approved());
  return {list,async getByHandle(handle,after=null){
    const identity=z.object({product:z.object({id:z.string().regex(/^gid:\/\/shopify\/Product\/\d+$/),handle:z.string(),title:z.string(),vendor:z.string(),featuredImage:image.nullable()}).nullable()}).parse(await client.request(identityQuery,{handle}));
    if(!identity.product) return null;
    const seen=new Set<string>();
    for(let attempt=0;attempt<5;attempt++) {
      const page=await productPage(identity.product.id,after);
      const product=(await fetchApproved(client,page.products)).find(product=>product.id===identity.product?.id && product.handle===handle);
      if(product) return {...product,optionsPage:{nextCursor:page.nextCursor}};
      if(page.nextCursor===null) return null;
      if(seen.has(page.nextCursor) || page.nextCursor===after) throw Error('options did not advance');
      seen.add(page.nextCursor);after=page.nextCursor;
    }
    return {...mapProductNode({...identity.product,variants:{nodes:[]}}),optionsPage:{nextCursor:after}};
  }};
}
