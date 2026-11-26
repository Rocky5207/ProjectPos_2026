const test=require('node:test');
const assert=require('node:assert/strict');
const {Register,initialState}=require('../src/register');
const today='2026-11-26';
const fresh=()=>new Register(initialState(today),today);
function riceSale(r,n=4){ r.setQty('101',n); return r.pay(5000); }

test('S1 earliest expiry and mixed prices on one SKU',()=>{
  const r=fresh();r.setQty('101',4);
  const q=r.quote();assert.deepEqual(q.lines.map(l=>[l.lot,l.qty,l.unit]),[['B01',3,600],['B02',1,800]]);
  assert.equal(q.total,2600);assert.equal(q.saving,600);
});
test('S2 unit markdown rounds half fen once',()=>{
  const r=fresh();r.setQty('102',2);assert.equal(r.quote().total,1426);
});
test('S3 stock and cash failures preserve basket and ledger',()=>{
  const r=fresh();r.setQty('101',1);
  for(const n of [0.5,-1,10]) assert.throws(()=>r.setQty('101',n));
  assert.throws(()=>r.pay(599));assert.equal(r.s.basket['101'],1);assert.equal(r.s.moves.length,0);
});
test('S4 pay records one receipt and exact change',()=>{
  const r=fresh();const s=riceSale(r);assert.equal(s.change,2400);assert.equal(r.stock.shelf('101')[0].qty,5);
  assert.throws(()=>r.pay(5000));assert.equal(r.s.sales.length,1);
});
test('H1 parking makes space and leaves stock free for the next customer',()=>{
  const r=fresh();r.setQty('101',4);const id=r.park();assert.equal(id,'H001');
  riceSale(r,1);r.recall(id);assert.equal(r.quote().total,2800);assert.equal(r.s.holds.length,0);
});
test('H2 an active basket cannot be overwritten by recall',()=>{
  const r=fresh();r.setQty('101',2);const id=r.park();r.setQty('105',1);
  assert.throws(()=>r.recall(id));assert.equal(r.s.holds.length,1);
});
test('R1 two returns cannot exceed a sold batch line',()=>{
  const r=fresh();const s=riceSale(r);const f=r.refund(s.id,0,1,'Sealed');assert.equal(f.amount,600);
  assert.throws(()=>r.refund(s.id,0,3,'Sealed'));assert.equal(s.lines[0].returned,1);
});
test('R2 opened and expired returns are isolated',()=>{
  const r=fresh();const s=riceSale(r);r.refund(s.id,0,1,'Opened');
  const later=new Register(r.s,'2026-11-27');later.refund(s.id,0,1,'Sealed');
  assert.equal(r.s.lots[0].qty,0);assert.equal(r.s.lots[0].blocked,2);
});
test('R3 a later-day refund uses the paid line price and its own business day',()=>{
  const r=fresh();const s=riceSale(r);const later=new Register(r.s,'2026-11-27');
  assert.equal(later.refund(s.id,0,1,'Sealed').amount,600);assert.equal(later.shift().net,-600);
  assert.equal(r.shift().net,2600);
});
test('I1 receipt of stock is dated, validated and logged',()=>{
  const r=fresh();assert.throws(()=>r.receive('106',3,'2026-02-31'));
  assert.throws(()=>r.receive('106',2,'2026-11-25'));const id=r.receive('106',2,'2027-01-01');
  assert.equal(r.s.moves.at(-1).ref,id);assert.equal(r.s.lots.at(-1).qty,2);
});
test('I2 an expired lot is removed from available stock',()=>{
  const r=fresh();const next=new Register(r.s,'2026-11-27');
  assert.deepEqual(next.stock.shelf('101').map(l=>l.id),['B02']);
});
test('L1 shift reconciles amounts, refunds and markdown units',()=>{
  const r=fresh();const s=riceSale(r);r.refund(s.id,0,1,'Opened');
  assert.deepEqual(r.shift(),{sales:1,gross:2600,paidBack:600,net:2000,saving:600,markedUnits:3});
});
test('B1 exposure uses the actual rounded unit price and excludes non-due stock',()=>{
  const r=fresh();assert.deepEqual(r.expiryReview(),{units:5,value:3226,expired:0,isolated:0});
});
test('B2 a partial close-out reduces exposure and does not touch cash',()=>{
  const r=fresh();assert.equal(r.writeOff('B03','Closing surplus',1),'W0001');
  assert.equal(r.expiryReview().value,2513);assert.equal(r.shift().net,0);
  assert.equal(r.trace('B03').events[0].delta,-1);
});
test('B3 validate date, source balance and quantity before posting',()=>{
  const r=fresh();
  for(const args of [['B02','Closing surplus',1],['B01','Expired stock',1],
    ['B01','Closing surplus',4],['B01','Closing surplus',.5],['B01','Quarantine disposal',1]])
    assert.throws(()=>r.writeOff(...args));
  assert.equal(r.s.moves.length,0);
  const tomorrow=new Register(r.s,'2026-11-27');tomorrow.writeOff('B01','Expired stock',3);
  assert.equal(tomorrow.expiryReview().expired,2);
});
test('B4 tracing a mixed receipt attributes only the selected batch and keeps disposal cash-neutral',()=>{
  const r=fresh();const sale=riceSale(r);r.refund(sale.id,0,1,'Opened');
  r.writeOff('B01','Quarantine disposal',1);
  assert.deepEqual(r.trace('B01').events.map(m=>m.cash),[1800,-600,0]);
  assert.equal(r.trace('B02').net,800);assert.equal(r.shift().net,2000);
  assert.throws(()=>r.writeOff('B01','Quarantine disposal',1));
});
