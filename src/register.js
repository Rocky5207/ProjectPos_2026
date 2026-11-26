'use strict';
// All monetary values are integer fen. Business dates use the counter's local clock.
const PRODUCTS = [
  {id:'101', art:'rice', name:'Seaweed rice ball', group:'Fresh', price:800, min:5},
  {id:'102', art:'sandwich', name:'Egg sandwich', group:'Fresh', price:950, min:4},
  {id:'103', art:'yogurt', name:'Peach yogurt', group:'Chilled', price:650, min:4},
  {id:'104', art:'soy', name:'Plain soy milk', group:'Drinks', price:350, min:5},
  {id:'105', art:'water', name:'Spring water', group:'Drinks', price:200, min:6},
  {id:'106', art:'crackers', name:'Sea salt crackers', group:'Pantry', price:500, min:4}
];
const product = id => {
  const found = PRODUCTS.find(p => p.id === id);
  if (!found) throw Error('Unknown product code.');
  return found;
};
function dayOf(date = new Date()) {
  return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'),
    String(date.getDate()).padStart(2,'0')].join('-');
}
function offsetDay(day, offset) {
  const date = new Date(day+'T12:00:00');
  date.setDate(date.getDate()+offset);
  return dayOf(date);
}
function positive(n) {
  if (!Number.isSafeInteger(n) || n<1 || n>9999) throw Error('Enter a whole quantity from 1 to 9999.');
  return n;
}
function initialState(day) {
  const stocks = [['101',0,3],['101',2,6],['102',0,2],['102',2,5],['103',4,8],
    ['104',6,9],['105',90,12],['106',45,3]];
  const lots = stocks.map(([sku,offset,qty],i)=>({id:'B'+String(i+1).padStart(2,'0'),
    sku,expires:offsetDay(day,offset),qty,blocked:0}));
  return {version:0,lots,basket:{},holds:[],sales:[],refunds:[],moves:[],nextHold:1};
}
class StockBook {
  constructor(state, day) { this.state=state; this.day=day; }
  shelf(sku) {
    return this.state.lots.filter(l=>l.sku===sku && l.qty>0 && l.expires>=this.day)
      .sort((a,b)=>a.expires.localeCompare(b.expires)||a.id.localeCompare(b.id));
  }
  price(lot) {
    const p=product(lot.sku);
    return lot.expires===this.day && ['Fresh','Chilled'].includes(p.group)
      ? Math.round(p.price*0.75) : p.price;
  }
  allocate(sku, count) {
    let left=positive(count);
    const lines=[];
    for (const lot of this.shelf(sku)) {
      const qty=Math.min(left,lot.qty);
      lines.push({sku,lot:lot.id,qty,unit:this.price(lot),original:product(sku).price,returned:0});
      left-=qty;
      if (!left) break;
    }
    if(left) throw Error('Only '+(count-left)+' available for '+product(sku).name+'.');
    return lines;
  }
  move(lot, delta, isolated, reason, ref) {
    lot.qty+=delta; lot.blocked+=isolated;
    this.state.moves.push({day:this.day,lot:lot.id,sku:lot.sku,delta,isolated,reason,ref});
  }
}
class Register {
  constructor(state, day=dayOf()) { this.s=state; this.day=day; this.stock=new StockBook(state,day); }
  setQty(sku,qty) {
    product(sku);
    if (qty===0) { delete this.s.basket[sku]; return; }
    this.stock.allocate(sku,qty);
    this.s.basket[sku]=qty;
  }
  quote(basket=this.s.basket) {
    const lines=Object.entries(basket).flatMap(([sku,n])=>this.stock.allocate(sku,n));
    const total=lines.reduce((v,l)=>v+l.unit*l.qty,0);
    const saving=lines.reduce((v,l)=>v+(l.original-l.unit)*l.qty,0);
    return {lines,total,saving};
  }
  park() {
    if(!Object.keys(this.s.basket).length) throw Error('Add an item before parking a basket.');
    const id='H'+String(this.s.nextHold++).padStart(3,'0');
    this.s.holds.push({id,basket:this.s.basket}); this.s.basket={};
    return id;
  }
  recall(id) {
    if(Object.keys(this.s.basket).length) throw Error('Park or finish the current basket first.');
    const i=this.s.holds.findIndex(h=>h.id===id);
    if(i<0) throw Error('Ticket has already been recalled.');
    this.s.basket=this.s.holds.splice(i,1)[0].basket;
  }
  pay(cash) {
    const quote=this.quote();
    if(!quote.lines.length) throw Error('The basket is empty.');
    if(!Number.isSafeInteger(cash)||cash<quote.total) throw Error('Cash received is below the amount due.');
    const id='S'+String(this.s.sales.length+1).padStart(4,'0');
    const sale={id,day:this.day,...quote,cash,change:cash-quote.total};
    for(const l of sale.lines) this.stock.move(this.s.lots.find(b=>b.id===l.lot),-l.qty,0,'Sale',id);
    this.s.sales.push(sale); this.s.basket={}; return sale;
  }
  refund(id,index,qty,condition) {
    const sale=this.s.sales.find(x=>x.id===id);
    const line=sale?.lines[index];
    if(!line) throw Error('Select an original receipt line.');
    positive(qty);
    if(qty>line.qty-line.returned) throw Error('Return exceeds the quantity left on this line.');
    if(!['Sealed','Opened'].includes(condition)) throw Error('Choose a condition.');
    const lot=this.s.lots.find(b=>b.id===line.lot);
    const sellable=condition==='Sealed' && lot.expires>=this.day;
    const refund={id:'R'+String(this.s.refunds.length+1).padStart(4,'0'),sale:id,index,
      sku:line.sku,lot:lot.id,day:this.day,qty,amount:line.unit*qty,condition,
      route:sellable?'Shelf':'Quarantine'};
    line.returned+=qty;
    this.stock.move(lot,sellable?qty:0,sellable?0:qty,refund.route,refund.id);
    this.s.refunds.push(refund); return refund;
  }
  receive(sku,qty,expires) {
    product(sku); positive(qty);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(expires)||offsetDay(expires,0)!==expires||expires<this.day)
      throw Error('Use today or a later valid expiry date.');
    const lot={id:'B'+String(this.s.lots.length+1).padStart(2,'0'),sku,expires,qty:0,blocked:0};
    this.s.lots.push(lot); this.stock.move(lot,qty,0,'Delivery',lot.id);
    return lot.id;
  }
  shift() {
    const sales=this.s.sales.filter(s=>s.day===this.day);
    const refunds=this.s.refunds.filter(r=>r.day===this.day);
    const sum=(rows,field)=>rows.reduce((v,r)=>v+r[field],0);
    const gross=sum(sales,'total'), paidBack=sum(refunds,'amount');
    return {sales:sales.length,gross,paidBack,net:gross-paidBack,saving:sum(sales,'saving'),
      markedUnits:sales.flatMap(s=>s.lines).reduce((n,l)=>n+(l.unit<l.original?l.qty:0),0)};
  }
}
if(typeof module!=='undefined') module.exports={Register,StockBook,initialState,dayOf,offsetDay};
