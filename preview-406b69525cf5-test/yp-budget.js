/* Your Plot — Budget v2 (28 Australian categories, collapsible sections, Edit/Add Item, Add Category, shared calc) */
(function(){
'use strict';

const FREQ_Y = { week:52, weekly:52, fortnight:26, fortnightly:26, month:12, monthly:12, quarter:4, year:1, yearly:1, annual:1 };
const ICON_PATHS = {
  home: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M9 21v-6h6v6"/>',
  doc: '<rect x="6" y="3.5" width="12" height="17" rx="2"/><path d="M9 8.5h6M9 12h6M9 15.5h4"/>',
  shield: '<path d="M12 3.5 19 6.5v5.5c0 4.4-3 7.2-7 8.5-4-1.3-7-4.1-7-8.5V6.5z"/>',
  tool: '<path d="M14 4 6.5 19.5h11L14 4z"/><path d="M9 13h8"/>',
  leaf: '<path d="M5 19.5c8-1 13.5-6 14.5-14.5C11 6 5.5 11.5 5 19.5z"/><path d="M9 15c2-2 4.5-3.5 8-4"/>',
  dots: '<circle cx="6.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="17.5" cy="12" r="1.2" fill="currentColor" stroke="none"/>',
  bolt: '<path d="M13 3 6.5 13h5.5L11 21 17.5 11h-5.5z"/>',
  screen: '<rect x="3.5" y="5" width="17" height="11.5" rx="1.8"/><path d="M8 20h8M12 16.5V20"/>',
  car: '<path d="M4 14.5 6 8.5h12l2 6"/><path d="M4 14.5h16v3.5H4z"/><circle cx="7.5" cy="18.5" r="1.4"/><circle cx="16.5" cy="18.5" r="1.4"/>',
  fuel: '<rect x="5" y="4" width="10" height="16" rx="1.5"/><path d="M8 7h4M15 7.5 19 10v7a1.5 1.5 0 0 1-3 0"/>',
  bus: '<rect x="4" y="4.5" width="16" height="12" rx="2"/><path d="M4 11h16M7 19.5v-3M17 19.5v-3"/>',
  card: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M3.5 10h17"/>',
  park: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h3.5a3 3 0 0 1 0 6H9zM9 8v11"/>',
  toll: '<path d="M4 17V7l8-3 8 3v10"/><path d="M4 17c2 2 5 3 8 3s6-1 8-3"/>',
  cart: '<circle cx="9" cy="20" r="1.2" fill="currentColor" stroke="none"/><circle cx="17" cy="20" r="1.2" fill="currentColor" stroke="none"/><path d="M4 5h2l2.2 11.5h10.2l2-7.5H7"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5c1 1.4 2.3 2 3.5 2s2.5-.6 3.5-2"/><path d="M9 10h.01M15 10h.01"/>',
  heart: '<path d="M12 19.5 5.2 12.4A4.2 4.2 0 0 1 11.2 6.5L12 7.3l.8-.8a4.2 4.2 0 0 1 6 5.9z"/>',
  plane: '<path d="M10 17.5 4 15.5l1-2 4 1 4.5-7.5L6.5 5 7.5 3.5 21 7.5 14 21l-1.5-1 1.5-6.5z"/>',
  star: '<path d="M12 3.5 14.4 9l6.1.6-4.6 3.9 1.5 5.9L12 16.5 6.6 19.4l1.5-5.9L3.5 9.6 9.6 9z"/>',
  pig: '<circle cx="16.5" cy="9" r="1" fill="currentColor" stroke="none"/><path d="M4 13.5c0-3.2 3.4-5.5 8-5.5 1.4 0 2.7.2 3.8.7L18 7l1.2 2.2c.5.4.8 1 .8 1.8v3.5h-2.2L16 18H8l-1.8-3.5H4z"/>',
  person: '<circle cx="12" cy="8" r="3"/><path d="M5 19.5c.8-3.2 3.4-5 7-5s6.2 1.8 7 5"/>',
  shirt: '<path d="M8 6.5 12 8.5 16 6.5 20 8.5v3l-3-.8V20H7v-9.3l-3 .8v-3z"/>',
  book: '<path d="M5 5.5A3 3 0 0 1 8.5 4H19v15H8.5A3 3 0 0 0 5 20.5z"/><path d="M5 5.5v15"/>',
  kids: '<circle cx="8" cy="8" r="2.2"/><circle cx="16" cy="9" r="1.8"/><path d="M4 19c.5-3 2.2-4.6 4.5-4.6S12.5 16 13 19M13.2 15.2c1.4-1 2.8-1.3 4.4-1 1.8.3 3 1.6 3.4 3.8"/>',
  gift: '<rect x="4" y="11" width="16" height="9" rx="1.5"/><path d="M4 11h16V8.5H4zM12 8.5V20"/><path d="M12 8.5c0-2-1.2-3.5-3-3.5S6.5 7 8.2 8.5H12c0-2 1.2-3.5 3-3.5s2.5 1.6.8 3.5H12z"/>',
  paw: '<circle cx="7" cy="10" r="1.5"/><circle cx="11" cy="7.5" r="1.5"/><circle cx="16" cy="7.5" r="1.5"/><circle cx="19.5" cy="10.5" r="1.5"/><path d="M8 18c0-2.6 1.8-4.2 4-4.2s4 1.6 4 4.2c0 1.4-2 2-4 2s-4-.6-4-2z"/>',
  case: '<rect x="3.5" y="8" width="17" height="11" rx="2"/><path d="M8 8V6.5A2 2 0 0 1 10 4.5h4A2 2 0 0 1 16 6.5V8"/>',
  list: '<rect x="5" y="4" width="14" height="16" rx="2"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>',
  alert: '<path d="M12 4.5 3.5 19h17z"/><path d="M12 10v4.5M12 16.8h.01"/>',
  scale: '<path d="M12 4v16M6 8h12M7 8 4.5 14M17 8l2.5 6M5 20h14"/>',
  social: '<circle cx="8.5" cy="8.5" r="2.3"/><circle cx="16.2" cy="9.2" r="2"/><path d="M3.8 18.5c.6-3 2.6-4.6 5.2-4.6 2 0 3.5.9 4.5 2.3 1-1.6 2.6-2.6 4.7-2.4 2.3.2 3.8 1.8 4.2 4.7"/>',
  rel: '<path d="M12 3.5v17M8 7h8"/><path d="M5 20h14"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5l3 2"/>'
};

function svgTag(key, cls){
  const body = ICON_PATHS[key] || ICON_PATHS.dots;
  return `<svg${cls?` class="${cls}"`:''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
const CHEV_SVG = '<svg class="yp-b-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const PEN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 16.5V20h3.5L19 8.5 15.5 5 4 16.5z"/><path d="M13.2 7.3 16.7 10.8"/></svg>';
const PLUS_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const BACK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';

/* 28 Australian categories from categories.md (Rent excluded from Housing because game rent comes from where you live). */
const YP_BUDGET_CATS = [
  { id:'housing', name:'Housing', icon:'home', color:'c-blue', items:[
    { id:'mortgage', name:'Mortgage', icon:'home' },
    { id:'council-rates', name:'Council Rates', icon:'doc', period:'year' },
    { id:'strata-fees', name:'Strata Fees', icon:'doc' },
    { id:'home-insurance', name:'Home Insurance', icon:'shield', period:'year' },
    { id:'repairs', name:'Repairs', icon:'tool' },
    { id:'lawn-care', name:'Lawn Care', icon:'leaf' },
    { id:'pest-control', name:'Pest Control', icon:'dots' }
  ]},
  { id:'utilities', name:'Utilities', icon:'bolt', color:'c-navy', items:[
    { id:'electricity', name:'Electricity', icon:'bolt', billKey:'power' },
    { id:'water', name:'Water', icon:'dots', billKey:'gaswater' },
    { id:'gas', name:'Gas', icon:'dots' },
    { id:'internet', name:'Internet', icon:'screen', billKey:'internet' },
    { id:'phone', name:'Phone', icon:'screen', billKey:'phone' },
    { id:'rubbish', name:'Rubbish', icon:'tool' }
  ]},
  { id:'transport', name:'Transport', icon:'car', color:'c-orange', items:[
    { id:'fuel', name:'Fuel', icon:'fuel', billKey:'transport' },
    { id:'public-transport', name:'Public Transport', icon:'bus' },
    { id:'car-registration', name:'Car Registration', icon:'doc', period:'year', billKey:'rego' },
    { id:'car-loan', name:'Car Loan', icon:'card' },
    { id:'parking', name:'Parking', icon:'park' },
    { id:'tolls', name:'Tolls', icon:'toll' },
    { id:'car-service', name:'Car Service', icon:'car' },
    { id:'rideshare', name:'Rideshare', icon:'car' }
  ]},
  { id:'food', name:'Food', icon:'cart', color:'c-ink', items:[
    { id:'groceries', name:'Groceries', icon:'cart', billKey:'food' },
    { id:'eating-out', name:'Eating Out', icon:'smile', billKey:'fun' },
    { id:'coffee', name:'Coffee', icon:'smile' },
    { id:'school-lunches', name:'School Lunches', icon:'cart' },
    { id:'work-lunches', name:'Work Lunches', icon:'cart' }
  ]},
  { id:'health', name:'Health', icon:'heart', color:'c-mid', items:[
    { id:'doctor', name:'Doctor', icon:'heart', billKey:'health' },
    { id:'dentist', name:'Dentist', icon:'heart' },
    { id:'chemist', name:'Chemist', icon:'heart' },
    { id:'optics', name:'Optics', icon:'heart' },
    { id:'physio', name:'Physio', icon:'heart' },
    { id:'mental-health', name:'Mental Health', icon:'heart' }
  ]},
  { id:'insurance', name:'Insurance', icon:'shield', color:'c-blue', items:[
    { id:'car-insurance', name:'Car Insurance', icon:'shield', period:'year', billKey:'carins' },
    { id:'health-insurance', name:'Health Insurance', icon:'heart', period:'year' },
    { id:'life-insurance', name:'Life Insurance', icon:'shield', period:'year' },
    { id:'income-protection', name:'Income Protection', icon:'shield', period:'year' },
    { id:'contents-insurance', name:'Contents Insurance', icon:'shield', period:'year' },
    { id:'travel-insurance', name:'Travel Insurance', icon:'plane', period:'year' }
  ]},
  { id:'debt-payments', name:'Debt Payments', icon:'card', color:'c-navy', items:[
    { id:'credit-card', name:'Credit Card', icon:'card' },
    { id:'personal-loan', name:'Personal Loan', icon:'card' },
    { id:'student-loan', name:'Student Loan', icon:'card' },
    { id:'buy-now-pay-later', name:'Buy Now Pay Later', icon:'card' }
  ]},
  { id:'savings', name:'Savings', icon:'pig', color:'c-ink', items:[
    { id:'emergency-fund', name:'Emergency Fund', icon:'pig' },
    { id:'superannuation', name:'Superannuation', icon:'pig' },
    { id:'holiday-savings', name:'Holiday Savings', icon:'pig' },
    { id:'house-deposit', name:'House Deposit', icon:'pig' },
    { id:'general-savings', name:'General Savings', icon:'pig' }
  ]},
  { id:'personal-care', name:'Personal Care', icon:'person', color:'c-mid', items:[
    { id:'haircuts', name:'Haircuts', icon:'person' },
    { id:'toiletries', name:'Toiletries', icon:'person' },
    { id:'gym', name:'Gym', icon:'person' },
    { id:'skincare', name:'Skincare', icon:'person' },
    { id:'beauty', name:'Beauty', icon:'person' }
  ]},
  { id:'clothing', name:'Clothing', icon:'shirt', color:'c-blue', items:[
    { id:'clothes', name:'Clothes', icon:'shirt', billKey:'clothes' },
    { id:'shoes', name:'Shoes', icon:'shirt' },
    { id:'school-uniforms', name:'School Uniforms', icon:'shirt' },
    { id:'dry-cleaning', name:'Dry Cleaning', icon:'shirt' }
  ]},
  { id:'entertainment', name:'Entertainment', icon:'smile', color:'c-orange', items:[
    { id:'movies', name:'Movies', icon:'smile' },
    { id:'concerts', name:'Concerts', icon:'star' },
    { id:'games', name:'Games', icon:'smile' },
    { id:'nights-out', name:'Nights Out', icon:'smile' },
    { id:'sports-events', name:'Sports Events', icon:'star' }
  ]},
  { id:'travel', name:'Travel', icon:'plane', color:'c-navy', items:[
    { id:'flights', name:'Flights', icon:'plane' },
    { id:'accommodation', name:'Accommodation', icon:'plane' },
    { id:'holidays', name:'Holidays', icon:'plane' },
    { id:'day-trips', name:'Day Trips', icon:'plane' }
  ]},
  { id:'education', name:'Education', icon:'book', color:'c-ink', items:[
    { id:'school-fees', name:'School Fees', icon:'book' },
    { id:'textbooks', name:'Textbooks', icon:'book' },
    { id:'tutoring', name:'Tutoring', icon:'book' },
    { id:'tafe', name:'TAFE', icon:'book' },
    { id:'university', name:'University', icon:'book' },
    { id:'short-courses', name:'Short Courses', icon:'book' }
  ]},
  { id:'childcare', name:'Childcare', icon:'kids', color:'c-mid', items:[
    { id:'childcare-fees', name:'Childcare Fees', icon:'kids' },
    { id:'after-school-care', name:'After School Care', icon:'kids' },
    { id:'babysitting', name:'Babysitting', icon:'kids' },
    { id:'nappies', name:'Nappies', icon:'kids' },
    { id:'kids-activities', name:'Kids Activities', icon:'kids' }
  ]},
  { id:'gifts-and-donations', name:'Gifts and Donations', icon:'gift', color:'c-blue', items:[
    { id:'birthday-gifts', name:'Birthday Gifts', icon:'gift' },
    { id:'christmas-gifts', name:'Christmas Gifts', icon:'gift' },
    { id:'charity', name:'Charity', icon:'gift' },
    { id:'wedding-gifts', name:'Wedding Gifts', icon:'gift' }
  ]},
  { id:'household', name:'Household', icon:'tool', color:'c-navy', items:[
    { id:'cleaning-products', name:'Cleaning Products', icon:'tool' },
    { id:'furniture', name:'Furniture', icon:'tool' },
    { id:'appliances', name:'Appliances', icon:'tool' },
    { id:'linen', name:'Linen', icon:'tool' },
    { id:'kitchenware', name:'Kitchenware', icon:'tool' }
  ]},
  { id:'pets', name:'Pets', icon:'paw', color:'c-orange', items:[
    { id:'vet', name:'Vet', icon:'paw' },
    { id:'pet-food', name:'Pet Food', icon:'paw' },
    { id:'pet-insurance', name:'Pet Insurance', icon:'paw' },
    { id:'grooming', name:'Grooming', icon:'paw' },
    { id:'boarding', name:'Boarding', icon:'paw' }
  ]},
  { id:'work-and-business', name:'Work and Business', icon:'case', color:'c-ink', items:[
    { id:'tools', name:'Tools', icon:'case' },
    { id:'work-uniform', name:'Work Uniform', icon:'case' },
    { id:'work-travel', name:'Work Travel', icon:'case' },
    { id:'home-office', name:'Home Office', icon:'case' },
    { id:'professional-fees', name:'Professional Fees', icon:'case' }
  ]},
  { id:'technology', name:'Technology', icon:'screen', color:'c-mid', items:[
    { id:'phone-handset', name:'Phone Handset', icon:'screen' },
    { id:'computer', name:'Computer', icon:'screen' },
    { id:'software', name:'Software', icon:'screen' },
    { id:'cloud-storage', name:'Cloud Storage', icon:'screen' },
    { id:'device-repairs', name:'Device Repairs', icon:'screen' }
  ]},
  { id:'subscriptions-and-memberships', name:'Subscriptions and Memberships', icon:'list', color:'c-blue', items:[
    { id:'streaming', name:'Streaming', icon:'list', billKey:'subs' },
    { id:'music', name:'Music', icon:'list' },
    { id:'news', name:'News', icon:'list' },
    { id:'software-subscriptions', name:'Software Subscriptions', icon:'list' },
    { id:'club-memberships', name:'Club Memberships', icon:'list' }
  ]},
  { id:'special-occasions', name:'Special Occasions', icon:'star', color:'c-navy', items:[
    { id:'birthdays', name:'Birthdays', icon:'star' },
    { id:'weddings', name:'Weddings', icon:'star' },
    { id:'anniversaries', name:'Anniversaries', icon:'star' },
    { id:'graduations', name:'Graduations', icon:'star' }
  ]},
  { id:'seasonal', name:'Seasonal', icon:'leaf', color:'c-ink', items:[
    { id:'christmas', name:'Christmas', icon:'leaf' },
    { id:'back-to-school', name:'Back to School', icon:'leaf' },
    { id:'easter', name:'Easter', icon:'leaf' },
    { id:'winter-prep', name:'Winter Prep', icon:'leaf' }
  ]},
  { id:'emergency', name:'Emergency', icon:'alert', color:'c-orange', items:[
    { id:'unexpected-repairs', name:'Unexpected Repairs', icon:'alert' },
    { id:'medical-emergency', name:'Medical Emergency', icon:'alert' },
    { id:'emergency-travel', name:'Emergency Travel', icon:'alert' },
    { id:'rainy-day-fund', name:'Rainy Day Fund', icon:'alert' }
  ]},
  { id:'legal-and-financial', name:'Legal and Financial', icon:'scale', color:'c-mid', items:[
    { id:'accountant', name:'Accountant', icon:'scale' },
    { id:'lawyer', name:'Lawyer', icon:'scale' },
    { id:'bank-fees', name:'Bank Fees', icon:'scale' },
    { id:'tax', name:'Tax', icon:'scale' },
    { id:'will-and-estate', name:'Will and Estate', icon:'scale' },
    { id:'financial-advice', name:'Financial Advice', icon:'scale' }
  ]},
  { id:'social', name:'Social', icon:'social', color:'c-blue', items:[
    { id:'catch-ups', name:'Catch Ups', icon:'social' },
    { id:'parties', name:'Parties', icon:'social' },
    { id:'club-events', name:'Club Events', icon:'social' },
    { id:'drinks', name:'Drinks', icon:'social' }
  ]},
  { id:'religious', name:'Religious', icon:'rel', color:'c-navy', items:[
    { id:'offerings', name:'Offerings', icon:'rel' },
    { id:'religious-events', name:'Religious Events', icon:'rel' },
    { id:'religious-school', name:'Religious School', icon:'rel' }
  ]},
  { id:'outdoor-and-hobbies', name:'Outdoor and Hobbies', icon:'clock', color:'c-ink', items:[
    { id:'sports', name:'Sports', icon:'clock' },
    { id:'camping', name:'Camping', icon:'clock' },
    { id:'fishing', name:'Fishing', icon:'clock' },
    { id:'craft', name:'Craft', icon:'clock' },
    { id:'garden-hobby', name:'Garden Hobby', icon:'clock' }
  ]},
  { id:'other', name:'Other', icon:'dots', color:'c-mid', items:[
    { id:'other', name:'Other', icon:'dots', billKey:'other' },
    { id:'unplanned', name:'Unplanned', icon:'dots' }
  ]}
];

const LEGACY_MAP = {
  transport: { groupId:'transport', itemId:'fuel' },
  rego: { groupId:'transport', itemId:'car-registration' },
  carins: { groupId:'insurance', itemId:'car-insurance' },
  phone: { groupId:'utilities', itemId:'phone' },
  internet: { groupId:'utilities', itemId:'internet' },
  power: { groupId:'utilities', itemId:'electricity' },
  gaswater: { groupId:'utilities', itemId:'water' },
  food: { groupId:'food', itemId:'groceries' },
  fun: { groupId:'food', itemId:'eating-out' },
  health: { groupId:'health', itemId:'doctor' },
  clothes: { groupId:'clothing', itemId:'clothes' },
  childsupport: { groupId:'childcare', itemId:'child-support', insertName:'Child Support' },
  subs: { groupId:'subscriptions-and-memberships', itemId:'streaming' },
  other: { groupId:'other', itemId:'other' }
};

function slug(s){
  return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'') || 'item';
}
function uid(){
  return Math.random().toString(36).slice(2,7);
}
function cloneDefaults(){
  return {
    v: 2,
    groups: YP_BUDGET_CATS.map(g=>({
      id: g.id,
      name: g.name,
      icon: g.icon,
      color: g.color,
      custom: false,
      items: g.items.map(it=>({
        id: it.id,
        billKey: it.billKey || it.id,
        name: it.name,
        icon: it.icon || g.icon,
        amount: 0,
        period: it.period === 'year' ? 'year' : 'week',
        custom: false
      }))
    })),
    deleted: []
  };
}
function toWeekNum(amount, freq){
  const y = FREQ_Y[freq] || 52;
  const a = +amount || 0;
  if(!(a > 0)) return 0;
  return a * y / 52;
}
function cleanNum(n){
  const a = Math.max(0, +n || 0);
  return Math.round(a * 10000) / 10000;
}
function normalizeV2(ex){
  const out = { v:2, groups:[], deleted: Array.isArray(ex.deleted) ? ex.deleted.map(String) : [] };
  const defById = Object.fromEntries(YP_BUDGET_CATS.map(g=>[g.id, g]));
  (ex.groups || []).forEach(g=>{
    if(!g || !g.id) return;
    const defG = defById[g.id];
    const items = [];
    (g.items || []).forEach(it=>{
      if(!it || !it.id) return;
      const period = it.period === 'year' ? 'year' : 'week';
      items.push({
        id: String(it.id),
        billKey: String(it.billKey || it.id),
        name: String(it.name || 'Item').trim() || 'Item',
        billName: it.billName ? String(it.billName) : undefined,
        icon: String(it.icon || g.icon || (defG && defG.icon) || 'dots'),
        amount: cleanNum(it.amount),
        period,
        custom: !!it.custom
      });
    });
    out.groups.push({
      id: String(g.id),
      name: String(g.name || (defG && defG.name) || 'Category').trim() || 'Category',
      icon: String(g.icon || (defG && defG.icon) || 'dots'),
      color: String(g.color || (defG && defG.color) || 'c-blue'),
      custom: !!g.custom,
      items
    });
  });
  return out;
}

function ypBudgetMigrateEx(rawEx, fallbackMonthlyExp){
  if(rawEx && rawEx.v === 2 && Array.isArray(rawEx.groups)){
    return normalizeV2(rawEx);
  }
  const ex = cloneDefaults();
  const findGroup = id => ex.groups.find(g=>g.id===id);

  /* Onboarding start-of-game category-level payload: { v:'start', freq:'week'|'fortnight'|'month', cats:{[catId]:num}, yearly:{[catId]:bool} } */
  if(rawEx && rawEx.v === 'start' && rawEx.cats && typeof rawEx.cats === 'object'){
    const baseFreq = FREQ_Y[rawEx.freq] && rawEx.freq !== 'year' ? rawEx.freq : 'week';
    Object.entries(rawEx.cats).forEach(([catId, val])=>{
      const raw = +val || 0;
      if(!(raw > 0)) return;
      const grp = findGroup(catId);
      if(!grp) return;
      const isYr = !!(rawEx.yearly && rawEx.yearly[catId]);
      const period = isYr ? 'year' : 'week';
      const amount = isYr ? cleanNum(raw) : cleanNum(toWeekNum(raw, baseFreq));
      if(catId === 'other'){
        const ot = grp.items.find(it=>it.id==='other') || grp.items[0];
        if(ot){ ot.amount = amount; ot.period = period; }
      }else{
        const genId = catId + '-general';
        grp.items.unshift({
          id: genId,
          billKey: genId,
          name: 'General',
          billName: grp.name + ' (General)',
          icon: grp.icon,
          amount,
          period,
          custom: true
        });
      }
    });
    return ex;
  }

  /* Legacy v1 { freq, items, yearly } */
  if(rawEx && rawEx.items && typeof rawEx.items === 'object'){
    const oldFreq = FREQ_Y[rawEx.freq] && rawEx.freq !== 'year' ? rawEx.freq : 'week';
    const yearly = rawEx.yearly || {};
    Object.entries(rawEx.items).forEach(([k, val])=>{
      const raw = +val || 0;
      if(!(raw > 0)) return;
      const map = LEGACY_MAP[k];
      if(!map){
        const othGrp = findGroup('other');
        if(othGrp){
          othGrp.items.push({
            id: 'legacy-' + slug(k),
            billKey: k,
            name: String(k),
            icon: 'dots',
            amount: yearly[k] ? cleanNum(raw) : cleanNum(toWeekNum(raw, oldFreq)),
            period: yearly[k] ? 'year' : 'week',
            custom: true
          });
        }
        return;
      }
      const grp = findGroup(map.groupId);
      if(!grp) return;
      let it = grp.items.find(x=>x.id===map.itemId);
      if(!it && map.insertName){
        it = {
          id: map.itemId,
          billKey: k,
          name: map.insertName,
          icon: grp.icon,
          amount: 0,
          period: 'week',
          custom: false
        };
        grp.items.unshift(it);
      }
      if(!it) return;
      const isYr = !!yearly[k];
      it.period = isYr ? 'year' : 'week';
      it.amount = isYr ? cleanNum(raw) : cleanNum(toWeekNum(raw, oldFreq));
    });
    return ex;
  }

  /* Bare fallback from G.income.exp monthly lump */
  const mo = +fallbackMonthlyExp || 0;
  if(mo > 0){
    const othGrp = findGroup('other');
    const ot = othGrp && (othGrp.items.find(x=>x.id==='other') || othGrp.items[0]);
    if(ot){
      ot.period = 'week';
      ot.amount = cleanNum(toWeekNum(mo, 'month'));
    }
  }
  return ex;
}

function ypBudgetEnsureEx(g){
  const root = g || (typeof G !== 'undefined' ? G : null);
  if(!root) return null;
  if(!root.income) return null;
  if(root.income.ex && root.income.ex.v === 2 && Array.isArray(root.income.ex.groups)){
    return root.income.ex;
  }
  if(root.income.ex || (+root.income.exp > 0)){
    root.income.ex = ypBudgetMigrateEx(root.income.ex, root.income.exp);
    return root.income.ex;
  }
  return null;
}

function ypBudgetItemWeekly(it){
  if(!it) return 0;
  return toWeekNum(it.amount, it.period || 'week');
}
function ypBudgetGroupWeekly(grp){
  if(!grp || !Array.isArray(grp.items)) return 0;
  return grp.items.reduce((s, it)=>s + ypBudgetItemWeekly(it), 0);
}
function ypBudgetWeeklyTotal(ex){
  const v2 = (ex && ex.v === 2 && Array.isArray(ex.groups)) ? ex : ypBudgetMigrateEx(ex, 0);
  return v2.groups.reduce((s, g)=>s + ypBudgetGroupWeekly(g), 0);
}
function ypBudgetMonthlyTotal(ex){
  return ypBudgetWeeklyTotal(ex) * 52 / 12;
}
function ypBudgetActiveItems(ex){
  const v2 = (ex && ex.v === 2 && Array.isArray(ex.groups)) ? ex : ypBudgetMigrateEx(ex, 0);
  const out = [];
  v2.groups.forEach(g=>{
    (g.items || []).forEach(it=>{
      const wk = ypBudgetItemWeekly(it);
      out.push({
        id: it.id,
        billKey: it.billKey || it.id,
        name: it.name,
        billName: it.billName || it.name,
        amount: +it.amount || 0,
        period: it.period === 'year' ? 'year' : 'week',
        weekly: wk,
        groupId: g.id,
        groupName: g.name
      });
    });
  });
  return out;
}

/* Money formatting matching index.html fmt() */
function bFmt(n){
  const v = Math.round(Math.abs(+n || 0));
  return ((+n || 0) < 0 ? '-$' : '$') + v.toLocaleString();
}
function bFmtIn(n){
  const a = +n || 0;
  if(!(a > 0)) return '';
  const r = Math.round(a * 100) / 100;
  return Number.isInteger(r) ? String(r) : String(r);
}
function bParse(t){
  t = String(t == null ? '' : t).replace(/[$,\s]/g,'');
  if(t === '') return { v: 0 };
  if(!/^\d*\.?\d{0,2}$/.test(t) || t === '.') return { e: 'Numbers only, like 450 or 89.50.' };
  const v = +t;
  if(!isFinite(v) || v < 0) return { e: "Amounts can't be less than $0." };
  return { v };
}

/* ---------- Modal CSS (matches option-b2 + edit-sheet2, brand colours only) ---------- */
function ypBudgetInjectCss(){
  if(document.getElementById('yp-budget-css')) return;
  const st = document.createElement('style');
  st.id = 'yp-budget-css';
  st.textContent = `
#sheet.yp-budget-sheet { display:flex; flex-direction:column; overflow:hidden; background:#eef1f6; }
#sheet.yp-budget-sheet > .yp-card-head { margin:0; flex:none; }
#sheet.yp-budget-sheet #sheetBody {
  flex:1 1 auto; min-height:0; padding:0; overflow:hidden;
  display:flex; flex-direction:column; background:#eef1f6; text-align:left;
}
#sheet.yp-budget-sheet .yp-b-back {
  grid-column:1; grid-row:1; justify-self:start; align-self:center;
  width:36px; height:36px; display:flex; align-items:center; justify-content:center;
  border:0; background:transparent; color:#fff; padding:0; cursor:pointer;
}
#sheet.yp-budget-sheet .yp-b-back svg { width:22px; height:22px; }
#sheet.yp-budget-sheet .yp-b-scroll {
  flex:1 1 auto; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch;
  padding:12px 12px 8px; scrollbar-width:none; -ms-overflow-style:none;
  background:#eef1f6;
}
#sheet.yp-budget-sheet .yp-b-scroll::-webkit-scrollbar { display:none; }
.yp-b-hint { margin:0 4px 10px; font-size:13px; line-height:1.4; color:#b8410a; font-weight:400; }
.yp-b-group {
  background:#fff; border:0; border-radius:16px;
  padding:2px 4px; margin:0 0 8px; box-shadow:none;
}
.yp-b-group.closed { padding-bottom:2px; }
.yp-b-group.closed .yp-b-items { display:none; }
.yp-b-group-h {
  width:100%; border:0; background:transparent; display:flex; align-items:center;
  gap:8px; min-height:44px; padding:8px 10px; cursor:pointer; text-align:left; font-family:inherit;
}
.yp-b-gico { display:none; }
.yp-b-gtitle {
  margin:0; flex:1; min-width:0; font-size:16px; font-weight:600; color:#14213d;
  letter-spacing:0; line-height:1.25;
}
.yp-b-gtot {
  font-size:15px; font-weight:600; color:#14213d;
  font-variant-numeric:tabular-nums; white-space:nowrap;
}
.yp-b-chev { width:16px; height:16px; color:#5a6780; flex:none; transition:transform .18s ease; }
.yp-b-group.open .yp-b-chev { transform:rotate(180deg); }
.yp-b-item {
  display:flex; align-items:center; gap:10px; min-height:40px;
  padding:6px 10px; border-top:1px solid #eef1f6;
}
.yp-b-iico {
  width:26px; height:26px; border-radius:50%; display:grid; place-items:center; flex:none; color:#fff;
}
.yp-b-iico svg { width:13px; height:13px; }
.yp-b-iico.c-blue { background:#1557c0; }
.yp-b-iico.c-navy { background:#0a3a8c; }
.yp-b-iico.c-ink { background:#0b2545; }
.yp-b-iico.c-mid { background:#3d6db5; }
.yp-b-iico.c-orange { background:#b8410a; }
.yp-b-iico.zero { background:#9aa5b8; }
.yp-b-copy { flex:1; min-width:0; }
.yp-b-copy strong { display:block; font-size:15px; font-weight:400; color:#14213d; line-height:1.3; }
.yp-b-copy small { display:block; margin-top:1px; font-size:12px; font-weight:400; color:#b8410a; }
.yp-b-pill {
  flex:none; background:#eef1f6; border-radius:999px; padding:3px 8px; min-width:44px;
  text-align:right; font-size:14px; font-weight:400; font-variant-numeric:tabular-nums;
  color:#14213d; letter-spacing:0;
}
.yp-b-pill.zero { color:#5a6780; }
.yp-b-pen {
  flex:none; width:36px; height:36px; border:0; background:none; color:#5a6780;
  display:grid; place-items:center; padding:0; margin-right:-4px; cursor:pointer;
}
.yp-b-pen svg { width:16px; height:16px; }
.yp-b-add-in {
  display:flex; align-items:center; gap:8px; width:100%; min-height:40px; border:0; background:none;
  padding:6px 10px; border-top:1px solid #eef1f6;
  color:#5a6780; font:400 14px Inter,system-ui,sans-serif; cursor:pointer; text-align:left;
}
.yp-b-add-in .yp-b-plus,
.yp-b-add-cat .yp-b-plus {
  width:22px; height:22px; border-radius:50%; display:grid; place-items:center;
  background:#e8eaee; color:#5a6780; flex:none;
}
.yp-b-add-in .yp-b-plus svg,
.yp-b-add-cat .yp-b-plus svg { width:11px; height:11px; }
.yp-b-add-cat {
  display:flex; align-items:center; gap:8px; width:100%; min-height:40px; border:0; background:none;
  padding:8px 10px; margin:2px 0 6px; color:#5a6780;
  font:400 14px Inter,system-ui,sans-serif; cursor:pointer; text-align:left;
}
.yp-b-foot {
  flex:none; padding:10px 14px calc(14px + var(--sab, 0px)); background:#fff;
  border-top:1px solid #e4e8ef;
}
#sheet.yp-budget-sheet #exp_tot {
  display:flex; align-items:baseline; justify-content:space-between; gap:10px;
  margin:0 0 10px; padding:0 2px;
}
#sheet.yp-budget-sheet #exp_tot span { font-size:16px; font-weight:600; color:#14213d; letter-spacing:0; }
#sheet.yp-budget-sheet #exp_tot b,
#sheet.yp-budget-sheet #exp_tot strong {
  font-size:16px; font-weight:600; color:#14213d; letter-spacing:0;
  font-variant-numeric:tabular-nums; white-space:nowrap;
}
.yp-b-cta {
  display:flex; align-items:center; justify-content:center; width:100%; min-height:48px;
  border-radius:999px; border:0; font:600 16px Inter,system-ui,sans-serif;
  background:#b8410a; color:#fff; box-shadow:0 6px 14px rgba(184,65,10,.22); cursor:pointer;
}
.yp-b-edit-lead { margin:0 0 16px; font-size:15px; font-weight:400; line-height:1.45; color:#14213d; }
.yp-b-field { margin:0 0 14px; }
.yp-b-field label {
  display:block; font-size:16px; font-weight:600; color:#14213d; letter-spacing:0; margin:0 0 6px 2px;
}
#sheet.yp-budget-sheet input.yp-b-input {
  display:block; width:100%; height:48px!important; min-height:48px!important;
  padding:0 14px!important; margin:0!important;
  background:#f4f7fb!important; border:1px solid #dfe5ef!important; border-radius:16px!important;
  font:400 15px Inter,system-ui,sans-serif!important; color:#14213d!important; box-sizing:border-box;
}
#sheet.yp-budget-sheet .yp-b-money {
  display:flex; align-items:center; background:#f4f7fb; border:1px solid #dfe5ef;
  border-radius:16px; min-height:48px; padding:0 14px;
}
#sheet.yp-budget-sheet .yp-b-money .cur { color:#5a6780; font:400 15px Inter,system-ui,sans-serif; margin-right:6px; flex:none; }
#sheet.yp-budget-sheet .yp-b-money input {
  flex:1; min-width:0; height:46px!important; min-height:46px!important; padding:0!important; margin:0!important;
  border:0!important; background:transparent!important; border-radius:0!important;
  font:400 15px Inter,system-ui,sans-serif!important; color:#14213d!important;
  font-variant-numeric:tabular-nums; letter-spacing:0;
}
#sheet.yp-budget-sheet input:focus { outline:none; }
#sheet.yp-budget-sheet .yp-b-money:focus-within,
#sheet.yp-budget-sheet input.yp-b-input:focus { border-color:#0a3a8c!important; }
.yp-b-seg {
  display:grid; grid-template-columns:1fr 1fr; background:#f4f7fb; border:1px solid #dfe5ef;
  border-radius:999px; padding:3px; margin:0 0 12px;
}
.yp-b-seg button {
  text-align:center; min-height:38px; border:0; background:transparent; border-radius:999px;
  font:600 14px Inter,system-ui,sans-serif; color:#5a6780; cursor:pointer;
}
.yp-b-seg button.on { background:#0a3a8c; color:#fff; }
.yp-b-conv { margin:0 2px 8px; font-size:13px; line-height:1.4; color:#b8410a; font-weight:400; }
.yp-b-err { margin:4px 2px 0; font-size:13px; line-height:1.35; color:#b8410a; font-weight:400; min-height:18px; }
.yp-b-btn-delete {
  display:flex; align-items:center; justify-content:center; width:100%; min-height:48px;
  margin-top:10px; border:1px solid #dfe5ef; border-radius:999px; background:#fff;
  color:#14213d; font:400 16px Inter,system-ui,sans-serif; cursor:pointer;
}
`;
  document.head.appendChild(st);
}

/* ---------- Modal State & Controllers ---------- */
let bDraft = null;
let bFrom = null;
let bOpenSet = new Set(); /* All sections start closed by default so all 28 categories stay scannable */
let bDeletedBills = [];
let bScrollTop = 0;

function setBudgetHead(title, onBack){
  const sheet = document.getElementById('sheet');
  if(!sheet) return;
  const head = sheet.querySelector(':scope > .yp-card-head');
  if(!head) return;
  const h2 = head.querySelector('h2');
  if(h2) h2.textContent = title;
  const oldBack = head.querySelector('.yp-b-back');
  if(oldBack) oldBack.remove();
  if(onBack){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'yp-b-back';
    btn.className = 'yp-b-back';
    btn.setAttribute('aria-label', 'Back');
    btn.innerHTML = BACK_SVG;
    btn.addEventListener('click', onBack);
    head.insertBefore(btn, head.firstChild);
  }
}

function esc(s){
  return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function expOpen(from){
  ypBudgetInjectCss();
  bFrom = from || null;
  bOpenSet = new Set(); /* All 28 sections start closed on open */
  bDeletedBills = [];
  bScrollTop = 0;
  const cur = ypBudgetEnsureEx(typeof G!=='undefined'?G:null);
  bDraft = cur ? JSON.parse(JSON.stringify(cur)) : cloneDefaults();
  window.expDraft = bDraft;
  window.expFrom = bFrom;
}

function renderBudgetList(){
  const sheet = document.getElementById('sheet');
  const body = document.getElementById('sheetBody');
  if(!sheet || !body || !bDraft) return;
  sheet.classList.add('yp-budget-sheet');
  setBudgetHead('Budget', null);

  const totalWk = ypBudgetWeeklyTotal(bDraft);
  const groupsHtml = bDraft.groups.map(g=>{
    const isOpen = bOpenSet.has(g.id);
    const gWk = ypBudgetGroupWeekly(g);
    const itemsHtml = (g.items || []).map(it=>{
      const wk = ypBudgetItemWeekly(it);
      const isZero = !(wk > 0);
      const isYr = it.period === 'year';
      return `<div class="yp-b-item" data-gid="${esc(g.id)}" data-iid="${esc(it.id)}">
        <div class="yp-b-iico ${esc(g.color)}${isZero?' zero':''}">${svgTag(it.icon || g.icon)}</div>
        <div class="yp-b-copy"><strong>${esc(it.name)}</strong>${isYr?'<small>Yearly</small>':''}</div>
        <div class="yp-b-pill${isZero?' zero':''}">${bFmt(wk)}</div>
        <button class="yp-b-pen" type="button" data-edit-gid="${esc(g.id)}" data-edit-iid="${esc(it.id)}" aria-label="Edit ${esc(it.name)}">${PEN_SVG}</button>
      </div>`;
    }).join('');
    return `<div class="yp-b-group ${isOpen?'open':'closed'}" data-gid="${esc(g.id)}">
      <button class="yp-b-group-h" type="button" data-toggle-gid="${esc(g.id)}" aria-expanded="${isOpen?'true':'false'}">
        <h3 class="yp-b-gtitle">${esc(g.name)}</h3>
        <span class="yp-b-gtot">${bFmt(gWk)}</span>
        ${CHEV_SVG}
      </button>
      <div class="yp-b-items">
        ${itemsHtml}
        <button class="yp-b-add-in" type="button" data-add-item-gid="${esc(g.id)}"><span class="yp-b-plus">${PLUS_SVG}</span>Add Item</button>
      </div>
    </div>`;
  }).join('');

  body.innerHTML = `<div class="yp-b-scroll" id="yp-b-scroll">
      <p class="yp-b-hint">Tap the pencil to change or remove an item.</p>
      ${groupsHtml}
      <button class="yp-b-add-cat" type="button" id="yp-b-add-cat"><span class="yp-b-plus">${PLUS_SVG}</span>Add Category</button>
    </div>
    <div class="yp-b-foot">
      <div id="exp_tot"><span>Your Budget</span><b id="exp_total">${bFmt(totalWk)} a week</b></div>
      <button class="yp-b-cta" id="exp_save" type="button">Save Budget</button>
    </div>`;

  const sc = document.getElementById('yp-b-scroll');
  if(sc && bScrollTop) sc.scrollTop = bScrollTop;

  body.querySelectorAll('[data-toggle-gid]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const gid = btn.getAttribute('data-toggle-gid');
      if(bOpenSet.has(gid)) bOpenSet.delete(gid);
      else bOpenSet.add(gid);
      const card = btn.closest('.yp-b-group');
      if(card){
        const open = bOpenSet.has(gid);
        card.classList.toggle('open', open);
        card.classList.toggle('closed', !open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    });
  });
  body.querySelectorAll('[data-edit-iid]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(sc) bScrollTop = sc.scrollTop;
      openItemSheet('edit', btn.getAttribute('data-edit-gid'), btn.getAttribute('data-edit-iid'));
    });
  });
  body.querySelectorAll('[data-add-item-gid]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      if(sc) bScrollTop = sc.scrollTop;
      openItemSheet('add', btn.getAttribute('data-add-item-gid'), null);
    });
  });
  const addCatBtn = document.getElementById('yp-b-add-cat');
  if(addCatBtn){
    addCatBtn.addEventListener('click', ()=>{
      if(sc) bScrollTop = sc.scrollTop;
      openAddCategorySheet();
    });
  }
  const saveBtn = document.getElementById('exp_save');
  if(saveBtn){
    saveBtn.addEventListener('click', ()=> window.expSave());
  }
}

function openItemSheet(mode, gid, iid){
  const body = document.getElementById('sheetBody');
  if(!body || !bDraft) return;
  const grp = bDraft.groups.find(g=>g.id===gid);
  if(!grp) return;
  const isEdit = mode === 'edit';
  const item = isEdit ? grp.items.find(it=>it.id===iid) : null;
  if(isEdit && !item) return;

  let period = isEdit ? (item.period === 'year' ? 'year' : 'week') : 'week';
  let nameVal = isEdit ? item.name : '';
  let amtStr = isEdit ? bFmtIn(item.amount) : '';

  setBudgetHead(isEdit ? 'Edit Item' : 'Add Item', ()=>renderBudgetList());

  body.innerHTML = `<div class="yp-b-scroll">
      <p class="yp-b-edit-lead">${isEdit
        ? 'You can change the name, or enter a yearly amount if you pay this once a year.'
        : 'Add an item under ' + esc(grp.name) + '. Enter a yearly amount if you pay this once a year.'}</p>
      <div class="yp-b-field">
        <label for="yp-b-name">Name</label>
        <input class="yp-b-input" id="yp-b-name" type="text" autocomplete="off" placeholder="e.g. Council Rates" value="${esc(nameVal)}">
      </div>
      <div class="yp-b-field">
        <label for="yp-b-amt">Amount</label>
        <div class="yp-b-money"><span class="cur">$</span><input id="yp-b-amt" type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="${esc(amtStr)}"></div>
      </div>
      <div class="yp-b-seg" role="tablist" aria-label="Period">
        <button type="button" data-p="week" class="${period==='week'?'on':''}" role="tab" aria-selected="${period==='week'?'true':'false'}">Weekly</button>
        <button type="button" data-p="year" class="${period==='year'?'on':''}" role="tab" aria-selected="${period==='year'?'true':'false'}">Yearly</button>
      </div>
      <p class="yp-b-conv" id="yp-b-conv"></p>
      <p class="yp-b-err" id="yp-b-err" role="alert"></p>
    </div>
    <div class="yp-b-foot">
      <button class="yp-b-cta" id="yp-b-item-save" type="button">Save</button>
      ${isEdit ? '<button class="yp-b-btn-delete" id="yp-b-item-del" type="button">Delete Item</button>' : ''}
    </div>`;

  const nameIn = document.getElementById('yp-b-name');
  const amtIn = document.getElementById('yp-b-amt');
  const convEl = document.getElementById('yp-b-conv');
  const errEl = document.getElementById('yp-b-err');
  const segBtns = [...body.querySelectorAll('.yp-b-seg button')];

  function refreshConv(){
    const r = bParse(amtIn.value);
    if(r.e){
      errEl.textContent = r.e;
      convEl.textContent = '';
      return null;
    }
    const wk = toWeekNum(r.v, period);
    if(wk * 52 > 1e6){
      errEl.textContent = "That's over $1 million a year. Check the number.";
      convEl.textContent = '';
      return null;
    }
    errEl.textContent = '';
    convEl.textContent = `That's ${bFmt(wk)} a week in your budget.`;
    return r.v;
  }

  segBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const next = btn.getAttribute('data-p');
      if(next === period) return;
      const r = bParse(amtIn.value);
      if(!r.e && r.v > 0){
        const converted = next === 'year' ? (r.v * 52) : (r.v / 52);
        amtIn.value = bFmtIn(converted);
      }
      period = next;
      segBtns.forEach(b=>{
        const on = b.getAttribute('data-p') === period;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      refreshConv();
    });
  });

  amtIn.addEventListener('input', refreshConv);
  nameIn.addEventListener('input', ()=>{ if(errEl.textContent) errEl.textContent = ''; });
  refreshConv();

  document.getElementById('yp-b-item-save').addEventListener('click', ()=>{
    const nm = String(nameIn.value || '').trim();
    if(!nm){
      errEl.textContent = 'Enter a name for this item.';
      nameIn.focus();
      return;
    }
    const v = refreshConv();
    if(v == null){ amtIn.focus(); return; }
    if(isEdit){
      const changedAmt = item.amount !== cleanNum(v) || item.period !== period;
      item.name = nm;
      if(item.billName) item.billName = nm;
      item.amount = cleanNum(v);
      item.period = period;
      if(changedAmt) item._syncBill = true;
    }else{
      const newId = 'custom-' + slug(nm) + '-' + uid();
      grp.items.push({
        id: newId,
        billKey: newId,
        name: nm,
        icon: grp.icon,
        amount: cleanNum(v),
        period,
        custom: true
      });
    }
    bOpenSet.add(grp.id);
    renderBudgetList();
  });

  const delBtn = document.getElementById('yp-b-item-del');
  if(delBtn){
    delBtn.addEventListener('click', ()=>{
      const idx = grp.items.findIndex(x=>x.id===item.id);
      if(idx >= 0) grp.items.splice(idx, 1);
      if(!item.custom){
        bDraft.deleted = bDraft.deleted || [];
        if(!bDraft.deleted.includes(item.id)) bDraft.deleted.push(item.id);
      }
      if(item.billKey) bDeletedBills.push(item.billKey);
      bOpenSet.add(grp.id);
      renderBudgetList();
    });
  }
}

function openAddCategorySheet(){
  const body = document.getElementById('sheetBody');
  if(!body || !bDraft) return;
  let period = 'week';
  const colors = ['c-blue','c-navy','c-ink','c-mid','c-orange'];
  const pickColor = colors[bDraft.groups.length % colors.length];

  setBudgetHead('Add Category', ()=>renderBudgetList());

  body.innerHTML = `<div class="yp-b-scroll">
      <p class="yp-b-edit-lead">Add your own category to your budget. You can also enter a first item now.</p>
      <div class="yp-b-field">
        <label for="yp-b-cat-name">Category Name</label>
        <input class="yp-b-input" id="yp-b-cat-name" type="text" autocomplete="off" placeholder="e.g. Boat">
      </div>
      <div class="yp-b-field">
        <label for="yp-b-cat-item">First Item (Optional)</label>
        <input class="yp-b-input" id="yp-b-cat-item" type="text" autocomplete="off" placeholder="e.g. Registration">
      </div>
      <div class="yp-b-field">
        <label for="yp-b-cat-amt">Amount</label>
        <div class="yp-b-money"><span class="cur">$</span><input id="yp-b-cat-amt" type="text" inputmode="decimal" autocomplete="off" placeholder="0"></div>
      </div>
      <div class="yp-b-seg" role="tablist" aria-label="Period">
        <button type="button" data-p="week" class="on" role="tab" aria-selected="true">Weekly</button>
        <button type="button" data-p="year" role="tab" aria-selected="false">Yearly</button>
      </div>
      <p class="yp-b-conv" id="yp-b-cat-conv">That's $0 a week in your budget.</p>
      <p class="yp-b-err" id="yp-b-cat-err" role="alert"></p>
    </div>
    <div class="yp-b-foot">
      <button class="yp-b-cta" id="yp-b-cat-save" type="button">Save</button>
    </div>`;

  const catIn = document.getElementById('yp-b-cat-name');
  const itemIn = document.getElementById('yp-b-cat-item');
  const amtIn = document.getElementById('yp-b-cat-amt');
  const convEl = document.getElementById('yp-b-cat-conv');
  const errEl = document.getElementById('yp-b-cat-err');
  const segBtns = [...body.querySelectorAll('.yp-b-seg button')];

  function refreshConv(){
    const r = bParse(amtIn.value);
    if(r.e){ errEl.textContent = r.e; convEl.textContent = ''; return null; }
    const wk = toWeekNum(r.v, period);
    if(wk * 52 > 1e6){ errEl.textContent = "That's over $1 million a year. Check the number."; convEl.textContent = ''; return null; }
    errEl.textContent = '';
    convEl.textContent = `That's ${bFmt(wk)} a week in your budget.`;
    return r.v;
  }

  segBtns.forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const next = btn.getAttribute('data-p');
      if(next === period) return;
      const r = bParse(amtIn.value);
      if(!r.e && r.v > 0){
        amtIn.value = bFmtIn(next === 'year' ? r.v * 52 : r.v / 52);
      }
      period = next;
      segBtns.forEach(b=>{
        const on = b.getAttribute('data-p') === period;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      refreshConv();
    });
  });

  amtIn.addEventListener('input', refreshConv);
  catIn.addEventListener('input', ()=>{ if(errEl.textContent) errEl.textContent = ''; });

  document.getElementById('yp-b-cat-save').addEventListener('click', ()=>{
    const cname = String(catIn.value || '').trim();
    if(!cname){
      errEl.textContent = 'Enter a category name.';
      catIn.focus();
      return;
    }
    const v = refreshConv();
    if(v == null){ amtIn.focus(); return; }
    const gid = 'cat-' + slug(cname) + '-' + uid();
    const firstItemName = String(itemIn.value || '').trim();
    const items = [];
    if(firstItemName || v > 0){
      const nm = firstItemName || 'General';
      const iid = 'custom-' + slug(nm) + '-' + uid();
      items.push({
        id: iid,
        billKey: iid,
        name: nm,
        billName: firstItemName ? nm : (cname + ' (General)'),
        icon: 'dots',
        amount: cleanNum(v),
        period,
        custom: true
      });
    }
    bDraft.groups.push({
      id: gid,
      name: cname,
      icon: 'dots',
      color: pickColor,
      custom: true,
      items
    });
    bOpenSet.add(gid);
    renderBudgetList();
  });
}

function expSave(){
  if(!bDraft) return false;
  const syncBills = [];
  bDraft.groups.forEach(g=>(g.items||[]).forEach(it=>{
    if(it._syncBill){ syncBills.push({ billKey: it.billKey || it.id, period: it.period }); delete it._syncBill; }
  }));
  const savedEx = JSON.parse(JSON.stringify(bDraft));
  const mo = Math.round(ypBudgetMonthlyTotal(savedEx) * 100) / 100;
  const wk = Math.round(ypBudgetWeeklyTotal(savedEx));
  const inc = typeof INC === 'function' ? INC() : ((typeof G !== 'undefined' && G && G.income) || {});
  if(typeof G !== 'undefined' && G){
    G.income = Object.assign({}, G.income || inc, {
      ex: savedEx,
      exp: mo,
      set: (G.income && G.income.set) || false,
      expSet: 1
    });
  }
  /* Clear bill setups for any deleted budget items (consistent with dates136 Delete Bill) */
  if(bDeletedBills.length && typeof ypBillsDeleteBudgetItem === 'function'){
    bDeletedBills.forEach(bk=>{
      try{ ypBillsDeleteBudgetItem(bk); }catch(e){}
    });
    bDeletedBills = [];
  }
  if(syncBills.length && typeof ypBillsGet === 'function'){
    syncBills.forEach(s=>{
      try{
        const b = ypBillsGet('exp:' + s.billKey);
        if(b){ delete b.amountUser; delete b.freqUser; b.freq = s.period === 'year' ? 'year' : 'week'; }
      }catch(e){}
    });
  }
  try{ if(typeof ypBillsSyncFromExpenses === 'function') ypBillsSyncFromExpenses(); }catch(e){}
  try{ if(typeof ypBillsSave === 'function') ypBillsSave(); }catch(e){}
  try{ if(typeof save === 'function') save(); }catch(e){}
  try{ if(typeof hud === 'function') hud(); }catch(e){}
  try{ if(typeof ypSyncRealBudget === 'function') ypSyncRealBudget(); }catch(e){}
  try{ if(typeof ypSyncFeed === 'function') ypSyncFeed(); }catch(e){}
  try{ if(typeof ypRefreshFinances === 'function') ypRefreshFinances(); }catch(e){}
  try{ if(typeof toast === 'function') toast('Budget saved: ' + bFmt(wk) + ' a week'); }catch(e){}

  const back = bFrom;
  bFrom = null;
  window.expFrom = null;
  const sheet = document.getElementById('sheet');
  if(sheet) sheet.classList.remove('yp-budget-sheet');
  if(back === 'income' && typeof UI !== 'undefined' && UI.income) UI.income();
  else if(back === 'profile' && typeof UI !== 'undefined' && UI.money) UI.money();
  else if(typeof closeSheet === 'function') closeSheet();
  else if(typeof UI !== 'undefined' && UI.close) UI.close();
  return true;
}

window.YP_BUDGET_CATS = YP_BUDGET_CATS;
window.YP_BUDGET_ICONS = ICON_PATHS;
window.ypBudgetSvg = svgTag;
window.ypBudgetMigrateEx = ypBudgetMigrateEx;
window.ypBudgetEnsureEx = ypBudgetEnsureEx;
window.ypBudgetItemWeekly = ypBudgetItemWeekly;
window.ypBudgetGroupWeekly = ypBudgetGroupWeekly;
window.ypBudgetWeeklyTotal = ypBudgetWeeklyTotal;
window.ypBudgetMonthlyTotal = ypBudgetMonthlyTotal;
window.ypBudgetActiveItems = ypBudgetActiveItems;
window.ypBudgetRender = renderBudgetList;
window.expOpen = expOpen;
window.expRender = renderBudgetList;
window.expSave = expSave;
window.expTotal = function(d){
  const target = d || bDraft;
  if(!target) return 0;
  if(target.v === 2) return ypBudgetWeeklyTotal(target);
  /* Legacy callers expecting expTotal in d.freq */
  const f = FREQ_Y[target.freq] && target.freq !== 'year' ? target.freq : 'week';
  return ypBudgetWeeklyTotal(target) * 52 / FREQ_Y[f];
};
window.expMonthly = function(d){
  const target = d || bDraft;
  if(!target) return 0;
  return ypBudgetMonthlyTotal(target);
};
})();
