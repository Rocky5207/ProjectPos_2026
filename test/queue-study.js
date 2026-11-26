// Reproduce the 4 x 4 interruption study in the report. All prices are in fen.
const assert=require('node:assert/strict');
const {Register,initialState}=require('../src/register');
const day='2026-11-26';
console.log('parked,intervening,original_fen,recalled_fen,change_fen,predicted_fen');
for(let parked=1;parked<=4;parked++){
  for(let sold=0;sold<=3;sold++){
    const till=new Register(initialState(day),day);
    till.setQty('101',parked);
    const original=till.quote().total;
    const ticket=till.park();
    if(sold){till.setQty('101',sold);till.pay(5000);}
    till.recall(ticket);
    const revised=till.quote().total;
    const predicted=200*(Math.min(parked,3)-Math.min(parked,3-sold));
    assert.equal(revised-original,predicted);
    console.log([parked,sold,original,revised,revised-original,predicted].join(','));
  }
}
