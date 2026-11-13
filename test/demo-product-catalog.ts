/** Explicit fixture for existing UI/unit suites; live runtime suites unmock this module. */
export { catalog, getSwatchColor } from '../src/features/match/demo-product-catalog';
import { catalog } from '../src/features/match/demo-product-catalog';
const state = { status:'demo' as const,products:catalog,previousProducts:[] };
export const catalogueIsDemo = true;
export const useProductCatalogue = () => state;
export const getCatalogueState = () => state;
export const refreshCatalogue = async () => {};
