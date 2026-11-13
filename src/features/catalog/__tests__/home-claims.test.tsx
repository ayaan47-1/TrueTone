jest.mock('expo-router',()=>({useRouter:()=>({push:jest.fn()})}));
import { render } from '@testing-library/react-native';
import TodayScreen from '../../../../app/(tabs)/index';
jest.mock('../../session/personalization',()=>({usePersonalization:()=>({hasScanned:false,currentShade:null})}));
jest.mock('../../../lib/profile-context',()=>({useProfile:()=>({userId:null})}));
jest.mock('../../foryou/use-greeting-name',()=>({useGreetingName:()=>''}));
jest.mock('../../foryou/use-recent-shade-matches',()=>({useRecentShadeMatches:()=>({status:'empty',matches:[]})}));
jest.mock('../../match/product-catalog',()=>{
 const {catalog}=jest.requireActual('../../match/demo-product-catalog');
 return {catalog,catalogueIsDemo:false,useProductCatalogue:()=>({status:'ready',products:[catalog[0]],previousProducts:[]})};
});
test('one reviewed shade makes no breadth claim on Home',async()=>{
 const view=await render(<TodayScreen />);
 expect(view.getByText('Available reviewed shades')).toBeTruthy();
 expect(view.queryByText('A range from fair to deep')).toBeNull();
});
