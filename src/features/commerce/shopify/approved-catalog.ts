import { z } from 'zod';
import type { ShopifyCatalog } from './catalog';
import type { ShopifyClient } from './client';
import { mapProductNode } from './product-mapper';
import type { ShopifyProduct } from './types';

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

export function createApprovedShopifyCatalog(client:ShopifyClient,approved:()=>Promise<readonly {id:string}[]>):ShopifyCatalog {
  const list=async():Promise<ShopifyProduct[]>=>{
    const ids=Array.from(new Set((await approved()).map(product=>product.id)));
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
  };
  return {list,async getByHandle(handle){return (await list()).find(product=>product.handle===handle)??null;}};
}
