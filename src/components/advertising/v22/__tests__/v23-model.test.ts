import type { AdsDayV23, AdsSalesV23, AdsSummaryV23, SalesMetricV23, SalesRowV23 } from '@/services/advertisingV23Service';
import { allocateV23Sales, breakdownV23, monthlyV23, totalV23, v23Financial, v23Scope } from '../v23-model';
import { emptySales } from '../model';
const metric = (patch: Partial<SalesMetricV23> = {}): SalesMetricV23 => ({ ...emptySales(),
  normalOrders:0,normalConfirmed:0,convertedCodOrders:0,unattributedOrders:0,missingSellerOrders:0,adjustmentOrders:0,adjustmentRevenue:'0',unknownAdjustmentAmounts:0,
  ordersNet:0,orderRevenue:'0',orderRevenueNet:'0',completeCostOrders:0,deliveredRevenue:'0',eligibleDelivered:0,eligibleDeliveredUnits:0,
  inTransitUnits:0,inTransitRevenue:'0',inTransitProductCost:'0',inTransitShippingCost:'0',billedUnits:0,eligibleBilledUnits:0,...patch });
const row = (patch: Partial<SalesRowV23> = {}): SalesRowV23 => ({...metric({orders:2,ordersNet:2,units:3,normalOrders:2,normalConfirmed:1,confirmed:1,delivered:1,deliveredUnits:2,
  orderRevenue:'300',orderRevenueNet:'300',deliveredRevenue:'200',eligibleRevenue:'200',eligibleProductCost:'50',eligibleShippingCost:'20',eligibleDelivered:1,eligibleDeliveredUnits:2}),
  storeId:'store',storeName:'KUNCA',date:'2026-10-01',channel:'WHATSAPP',channelFamily:'messages',sellerId:'alice',sellerName:'Alice',accountId:null,adId:null,...patch});
const day = (patch: Partial<AdsDayV23> = {}): AdsDayV23 => ({date:'2026-10-01',accountId:'a',adId:'ad',adsetId:'set',campaignId:'campaign',storeId:'store',channel:'messages',channelExact:'wa',
  sellerId:'alice',currency:'PEN',spend:'100',results:10,impressions:'1000',linkClicks:'100',provisional:false,...patch});
const summary=(days:AdsDayV23[]=[day()]):AdsSummaryV23=>({source:'powip-advertising-v23',from:'2026-10-01',to:'2026-10-31',today:'2026-10-03',timeZone:'America/Lima',currency:'PEN',stores:[{id:'store',name:'KUNCA'}],channels:[],days,
  accounts:[{id:'a',name:'A',externalId:'1',currency:'PEN'},{id:'b',name:'B',externalId:'2',currency:'PEN'}],sellers:[{id:'alice',name:'Alice'},{id:'bob',name:'Bob'}],shopifyCod:[],unassignedSpend:'0',adProducts:[],
  settings:{version:1,rules:{noResultsDays:3,minSpend:'60',nearLimitPct:70,highFrequency:3.5,winPct:60,testMultiplier:2,testMinSales:3},budgets:[{storeId:'store',month:'2026-10',amount:'1000'}],whatsapp:{enabled:false,time:'08:00',numbers:[],includes:[]},permissions:[],tags:{hooks:[],creators:[]},capabilities:{view:true,spend:true,profit:true,edit:true,configure:true}},quality:{warnings:[],spendAvailable:true}});
const sales=(rows:SalesRowV23[]=[]):AdsSalesV23=>({source:'powip-orders-v23',from:'2026-10-01',to:'2026-10-31',asOf:'2026-10-03',currency:'PEN',totals:totalV23(rows),byStore:[],byChannel:[],bySeller:[],byAd:rows,byProduct:[],daily:rows,deliveryHistory:[],productVelocity:[],quality:{},warnings:[],definitions:{},shopifyCod:null,
  deliveredActivity:{basis:'delivery-event-date',totals:metric(),byStore:[],byChannel:[],bySeller:[],byAd:[],daily:[]}});
const sumSpend=(groups:ReturnType<typeof breakdownV23>)=>groups.flatMap(group=>group.days).reduce((sum,entry)=>sum+Number(entry.spend),0);
describe('Publicidad v2.3 formulas and allocation',()=>{
 it('uses ingress orders and units for CPV/CPP and the supplied net amount without adding delivery charges',()=>{
  const result=v23Financial([row()],summary(),sales());
  expect(result.cpv).toBe(50);expect(result.cpp).toBeCloseTo(100/3);expect(result.enteredRevenue).toBe(300);expect(result.roasEntered).toBe(3);
  expect(result.maximum).toBe(130);expect(result.gain).toBe(30);expect(result.ticket).toBe(200);
 });
 it('excludes converted COD from both sides of normal confirmation rate',()=>{
  const result=v23Financial([row({orders:3,ordersNet:3,normalOrders:2,normalConfirmed:1,confirmed:2,convertedCodOrders:1})],summary(),sales());
  expect(result.confirmationRate).toBe(.5);expect(result.cpv).toBeCloseTo(100/3);
 });
 it('preserves measured IDs and distributes only residual without changing total orders or revenue',()=>{
  const known=row({accountId:'a',adId:'123',orders:6,ordersNet:6,orderRevenue:'600',orderRevenueNet:'600'}),unmeasured=row({orders:8,ordersNet:8,orderRevenue:'800',orderRevenueNet:'800'});
  const result=allocateV23Sales([known,unmeasured],summary([day({results:10}),day({accountId:'b',results:10})]));
  expect(result.find(entry=>entry.adId==='123')).toEqual(known);
  expect(result.filter(entry=>entry.estimated).reduce((n,entry)=>n+entry.orders,0)).toBeCloseTo(8);
  expect(totalV23(result).orders).toBeCloseTo(14);expect(Number(totalV23(result).orderRevenueNet)).toBeCloseTo(1400);
 });
 it('never estimates WhatsApp sales from Instagram results or from a different store',()=>{
  const source=summary([day({accountId:'a',channelExact:'wa'}),day({accountId:'b',channelExact:'ig'}),day({accountId:'b',storeId:'other',channelExact:'wa'})]);
  const result=allocateV23Sales([row()],source);
  expect(result).toHaveLength(1);expect(result[0].accountId).toBe('a');
 });
 it('keeps Shopify COD separate from ordinary Shopify web sales',()=>{
  const source=summary([day({accountId:'a',channel:'web',channelExact:'web'}),day({accountId:'b',channel:'web',channelExact:'shopify_cod'})]);
  expect(allocateV23Sales([row({channel:'SHOPIFY_COD',channelFamily:'web'})],source)[0].accountId).toBe('b');
  expect(allocateV23Sales([row({channel:'SHOPIFY',channelFamily:'web'})],source)[0].accountId).toBe('a');
 });
 it('keeps an unknown assignment unallocated when exact-channel Meta results are missing',()=>{
  const source=summary([day({channelExact:null})]);
  const result=allocateV23Sales([row()],source);
  expect(result[0].accountId).toBeNull();expect(result[0].estimated).not.toBe(true);
  expect(v23Scope([row()],source,'all','a')).toHaveLength(0);
 });
 it('keeps every unattributed sale unallocated when one account has unknown results in the same exact channel',()=>{
  const source=summary([day({accountId:'a',results:10}),day({accountId:'b',results:null})]);
  const result=allocateV23Sales([row()],source);expect(result).toHaveLength(1);expect(result[0].accountId).toBeNull();
 });
 it('subtracts known confirming sellers from the same channel/account residual before estimating missing owners',()=>{
  const source=summary([day({sellerId:'alice',results:10}),day({sellerId:'bob',results:10})]);
  const data=sales([row({accountId:'a',sellerId:'alice',orders:6,ordersNet:6}),row({accountId:'a',sellerId:null,sellerName:null,orders:8,ordersNet:8})]);
  const groups=breakdownV23('seller',source,data);
  expect(groups.find(group=>group.id==='alice')?.rows.reduce((n,entry)=>n+entry.orders,0)).toBeCloseTo(6+8*4/14);
  expect(groups.find(group=>group.id==='bob')?.rows.reduce((n,entry)=>n+entry.orders,0)).toBeCloseTo(8*10/14);
  expect(groups.flatMap(group=>group.rows).reduce((n,entry)=>n+entry.orders,0)).toBeCloseTo(14);
 });
 it('conserves actual spend and counts across channel, seller and account tables',()=>{
  const source=summary([day({spend:'100'}),day({accountId:'b',spend:'50',channelExact:'ig',sellerId:'bob'})]);
  const data=sales([row({accountId:'a'}),row({accountId:'b',channel:'INSTAGRAM',sellerId:'bob'})]);
  for(const kind of ['channel','seller','account'] as const){const groups=breakdownV23(kind,source,data);expect(sumSpend(groups)).toBe(150);expect(groups.flatMap(group=>group.rows).reduce((n,entry)=>n+entry.orders,0)).toBe(4);}
 });
 it('keeps physical or referral orders outside main advertising financial scope while allowing explicit other-channel comparison',()=>{
  const source=summary();const rows=[row(),row({channel:'TIENDA_FISICA',channelFamily:'other'})];
  expect(v23Scope(rows,source)).toHaveLength(1);
  expect(v23Scope(rows,source,'all','all','other')).toHaveLength(1);
 });
 it('retains a measured confirming seller even when another seller owns the ad set',()=>{
  const source=summary([day({sellerId:'bob'})]);const groups=breakdownV23('seller',source,sales([row({accountId:'a',sellerId:'alice'})]));
  expect(groups.find(group=>group.id==='alice')?.rows[0].sellerId).toBe('alice');expect(sumSpend(groups)).toBe(100);
 });
 it('estimates an absent confirmer only from the matching actual channel',()=>{
  const source=summary([day({sellerId:'alice',channelExact:'wa'}),day({sellerId:'bob',channelExact:'ig'})]);
  const groups=breakdownV23('seller',source,sales([row({accountId:'a',sellerId:null,sellerName:null})]));
  expect(groups.find(group=>group.id==='alice')?.rows.reduce((n,entry)=>n+entry.orders,0)).toBe(2);
  expect(groups.find(group=>group.id==='bob')?.rows).toHaveLength(0);
 });
 it('allocates COD spending by received leads while preserving the seller who actually confirmed the sale',()=>{
  const data=sales([row({channel:'SHOPIFY_COD',channelFamily:'web',sellerId:'alice',accountId:'a'})]);
  data.shopifyCod={enabled:true,storeIds:['store'],totals:metric(),byStore:[],byChannel:[],bySeller:[],byAd:[],daily:[],leads:4,converted:1,conversionRate:.25,
   leadsDaily:[],leadsByChannel:[],leadsBySeller:[],byAssignedSeller:[{storeId:'store',sellerId:'alice',leads:1,converted:0,conversionRate:0},{storeId:'store',sellerId:'bob',leads:3,converted:1,conversionRate:1/3}]};
  const groups=breakdownV23('seller',summary([day({channel:'web',channelExact:'shopify_cod',sellerId:null})]),data);
  expect(groups.find(group=>group.id==='alice')?.days.reduce((n,entry)=>n+Number(entry.spend),0)).toBe(25);
  expect(groups.find(group=>group.id==='bob')?.days.reduce((n,entry)=>n+Number(entry.spend),0)).toBe(75);
  expect(groups.find(group=>group.id==='alice')?.rows[0].orders).toBe(2);expect(sumSpend(groups)).toBe(100);
 });
 it('keeps projected delivery cost and profit unknown without a 60-day history',()=>{
  const result=v23Financial([row({inTransit:2,inTransitRevenue:'200',inTransitProductCost:'40',inTransitShippingCost:'10'})],summary(),sales());
  expect(result.projectedDelivered).toBeNull();expect(result.projectedCost).toBeNull();expect(result.projectedGain).toBeNull();expect(result.projectedRoas).toBeNull();
 });
 it('preserves null financial facts instead of manufacturing zero revenue or costs',()=>{
  const result=v23Financial([row({orderRevenueNet:null,eligibleProductCost:null})],summary(),sales());
  expect(result.enteredRevenue).toBeNull();expect(result.roasEntered).toBeNull();expect(result.maximum).toBeNull();expect(result.gain).toBeNull();
 });
 it('projects monthly spend from closed days excluding today and uses all days in the selected month',()=>{
  const source=summary([day({date:'2026-10-01',spend:'100'}),day({date:'2026-10-02',spend:'200'}),day({date:'2026-10-03',spend:'50',provisional:true})]);
  const result=monthlyV23(source,sales(),'2026-10');
  expect(result.data).toHaveLength(31);expect(result.dailyAverage).toBe(150);expect(result.remaining).toBe(28);expect(result.total.spend).toBe(350);expect(result.projectedSpend).toBe(4550);
 });
 it('does not reuse a full-store monthly budget for a partial account or channel',()=>{
  expect(monthlyV23(summary(),sales(),'2026-10','store','a').budget).toBeNull();
  expect(monthlyV23(summary(),sales(),'2026-10','store','all','messages').budget).toBeNull();
  const source=summary();source.settings.budgets=[];expect(monthlyV23(source,sales(),'2026-10').budget).toBeNull();
 });
});
