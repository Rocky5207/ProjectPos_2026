'use strict';
const $=s=>document.querySelector(s);
const yuan=n=>'¥'+(n/100).toFixed(2);
const photos=/* PHOTOS */ {};
const sections={Register:'Lunch counter',Returns:'Receipt & returns',Stock:'Stock room',Shift:'Shift ledger'};
const store=new Store();
let state,tab='Register',filter='All',query='',selected='',cash='',notice='',busy=false;
const reg=()=>new Register(state);
function button(act,label,cls='small',data=''){return '<button class="'+cls+'" data-act="'+act+'" '+data+'>'+label+'</button>';}
const tables=(heads,rows)=>'<div class="tabular"><table><thead><tr>'+heads.map(x=>'<th>'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const opts=(values)=>values.map(([v,s])=>'<option value="'+v+'">'+s+'</option>').join('');
function msg(text){notice=text;$('#notice').textContent=text;}
function tiles(){
  const stock=reg().stock;
  const items=PRODUCTS.filter(p=>(filter==='All'||p.group===filter)&&(p.name+' '+p.id).toLowerCase().includes(query.toLowerCase()));
  return items.map(p=>{
    const lots=stock.shelf(p.id),qty=lots.reduce((v,l)=>v+l.qty,0);
    const price=lots.length?stock.price(lots[0]):p.price;
    return '<button class="tile" data-act="add" data-id="'+p.id+'" aria-label="Add '+p.name+'" '+(qty?'':'disabled')+'><img alt="" src="'+photos[p.art]+'">'+(price<p.price?'<span class="flag">TODAY −25%</span>':'')+'<span class="detail"><span class="eyebrow">'+p.id+' / '+p.group+'</span><span class="item">'+p.name+'</span><span class="meta"><b>'+yuan(price)+'</b><span>'+qty+' left</span></span></span></button>';
  }).join('')||'<p class="empty">No matching product.</p>';
}
function basket(){
  const r=reg();
  let rows='',total=0,saving=0,valid=true;
  for(const [sku,n] of Object.entries(state.basket)){
    let lines=[];
    try{lines=r.stock.allocate(sku,n);}catch(e){valid=false;}
    const sum=lines.reduce((v,l)=>v+l.qty*l.unit,0); total+=sum;
    saving+=lines.reduce((v,l)=>v+l.qty*(l.original-l.unit),0);
    rows+='<div class="cartrow"><div class="row"><b>'+product(sku).name+'</b><b>'+ (lines.length?yuan(sum):'Review qty')+'</b></div><div class="row"><small>'+(lines.map(l=>l.qty+' × '+yuan(l.unit)+' · '+l.lot).join('<br>')||'Available stock changed')+'</small><span class="step">'+button('minus','−','','data-id="'+sku+'" aria-label="Remove one '+product(sku).name+'"')+n+button('add','+','','data-id="'+sku+'" aria-label="Add one '+product(sku).name+'"')+'</span></div>'+(!lines.length?button('remove','Remove line','small','data-id="'+sku+'"'):'')+'</div>';
  }
  const parked=state.holds.map(h=>button('recall',h.id+' · '+Object.values(h.basket).reduce((a,b)=>a+b,0)+' items','small','data-id="'+h.id+'"')).join('');
  return '<aside class="till"><div class="heading"><h2>Current basket</h2>'+button('park','Park basket')+'</div>'+(rows||'<p class="empty">Select a product to start this sale.</p>')+'<div class="row sub"><span>Markdown savings</span><b>'+yuan(saving)+'</b></div><div class="row total"><span>Amount due</span><strong id="due">'+(valid?yuan(total):'—')+'</strong></div><div class="cashrow"><label>Cash received (CNY)<input id="cash" type="number" min="0" step=".01" inputmode="decimal"></label><label>Change due<br><b id="change">—</b></label></div>'+button('pay','Take cash & issue receipt','solid pay',(!rows||!valid?'disabled':''))+'<div class="park"><span class="eyebrow">Parked baskets · '+state.holds.length+'</span><div>'+(parked||'<span class="note">No tickets waiting.</span>')+'</div></div></aside>';
}
function checkout(){
  return '<div class="columns"><section class="panel"><div class="heading"><h2>On the shelf</h2><span class="eyebrow">6 products</span></div><input class="search" id="search" aria-label="Search products" placeholder="Search by item or till code"><div class="filters">'+['All','Fresh','Chilled','Drinks','Pantry'].map(f=>button('filter',f,f===filter?'chosen':'','data-id="'+f+'"')).join('')+'</div><div class="products" id="products">'+tiles()+'</div><p class="note legend">Today’s fresh and chilled batches are 25% off. The earliest expiry sells first.</p></section>'+basket()+'</div>';
}
function returns(){
  const s=state.sales.find(x=>x.id===selected);
  const recent=state.sales.slice(-8).reverse().map(x=>[button('select',x.id,'listbtn','data-id="'+x.id+'"'),x.day,yuan(x.total)]);
  let detail='<p class="empty">Look up a sale to see the paid prices and remaining quantities.</p>';
  if(s){
    const selectable=s.lines.map((l,i)=>[i,product(l.sku).name+' · '+l.lot+' · '+(l.qty-l.returned)+' left']).filter(([i])=>s.lines[i].qty>s.lines[i].returned);
    detail='<div class="heading"><h2>'+s.id+'</h2>'+button('receipt','View receipt','small','data-id="'+s.id+'"')+'</div>'+tables(['Item / lot','Paid each','Sold','Refunded','Left'],s.lines.map(l=>[product(l.sku).name+' / '+l.lot,yuan(l.unit),l.qty,l.returned,l.qty-l.returned]))+(selectable.length?'<label class="field">Receipt line<select id="line">'+opts(selectable)+'</select></label><label class="field">Quantity<input id="rq" type="number" min="1" value="1"></label><label class="field">Returned condition<select id="condition"><option>Sealed</option><option>Opened</option></select></label><p class="note">Opened goods and expired lots go to quarantine.</p>'+button('refund','Record cash refund','solid sub'):'<p class="note">This receipt has been fully refunded.</p>');
  }
  return '<div class="columns"><section class="panel">'+detail+'</section><aside class="till"><h2>Find receipt</h2><label class="field">Sale number<input id="lookup" placeholder="S0001"></label>'+button('find','Look up sale','solid')+'<h3 class="sub">Recent sales</h3>'+(recent.length?tables(['Receipt','Date','Paid'],recent):'<p class="empty">No completed sales yet.</p>')+'</aside></div>';
}
function stockView(){
  const r=reg(), low=PRODUCTS.filter(p=>r.stock.shelf(p.id).reduce((a,l)=>a+l.qty,0)<p.min);
  const rows=state.lots.map(l=>[l.id,product(l.sku).name,l.expires,l.expires<r.day?'Expired':l.qty===0?'Empty':r.stock.price(l)<product(l.sku).price?'−25% today':'Regular',l.qty,l.blocked]);
  return '<div class="columns"><section class="panel"><h2>Batch register</h2>'+tables(['Lot','Product','Expiry','Status','On hand','Isolated'],rows)+'<p class="note">Expired on-hand units are excluded from checkout availability.</p></section><aside class="till"><h2>Receive a delivery</h2><label class="field">Product<select id="sku">'+opts(PRODUCTS.map(p=>[p.id,p.name]))+'</select></label><label class="field">Units<input id="sq" type="number" min="1" value="1"></label><label class="field">Use-by date<input id="expiry" type="date" value="'+r.day+'"></label>'+button('receive','Add stock lot','solid')+'<div class="park"><h3>Below shelf minimum</h3>'+ (low.map(p=>'<p class="entry">'+p.name+' <small>· target '+p.min+'</small></p>').join('')||'<p class="note">All products meet minimum.</p>')+'</div></aside></div>';
}
function shift(){
  const r=reg(),s=r.shift(), movements=state.moves.filter(m=>m.day===r.day).slice().reverse();
  const stats=[['Completed sales',s.sales],['Sales',yuan(s.gross)],['Refunds',yuan(s.paidBack)],['Net cash',yuan(s.net)],['Markdown units sold',s.markedUnits]];
  return '<section class="panel"><div class="heading"><h2>Today’s till</h2>'+button('csv','Export ledger CSV')+'</div><div class="kpis">'+stats.map(([k,v])=>'<div class="metric"><span>'+k+'</span><b>'+v+'</b></div>').join('')+'</div><h3>Stock movements</h3>'+(movements.length?tables(['Reference','Reason','Product','Lot','Shelf Δ','Quarantine Δ'],movements.map(m=>[m.ref,m.reason,product(m.sku).name,m.lot,m.delta,m.isolated])):'<p class="empty">Sales, returns and deliveries will appear here.</p>')+'</section>';
}
function render(){
  $('nav').innerHTML=Object.keys(sections).map(k=>button('nav',k,k===tab?'active':'','data-id="'+k+'"')).join('');
  $('#title').textContent=sections[tab]; $('#section-id').textContent='CAMPUS MARKET / '+tab;
  $('#date').textContent=new Date().toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
  $('#app').innerHTML=({Register:checkout,Returns:returns,Stock:stockView,Shift:shift})[tab]();
  if(tab==='Register'){$('#search').value=query;$('#cash').value=cash;showChange();}
}
function toFen(value){
  if(!/^\d+(?:\.\d{1,2})?$/.test(value)) throw Error('Enter cash as yuan with up to two decimal places.');
  const [units,part='']=value.split('.'); return Number(units)*100+Number(part.padEnd(2,'0'));
}
function showChange(){let v='—';try{const delta=toFen(cash)-reg().quote().total;if(delta>=0 && Object.keys(state.basket).length)v=yuan(delta);}catch{} $('#change').textContent=v;}
function paper(x){
  const sale='lines' in x;
  $('#paper').innerHTML='<div class="eyebrow">Noon Counter · Till 01</div><h2>'+(sale?'Sale receipt':'Refund receipt')+'</h2><p class="note">'+x.id+' / '+x.day+'</p>'+(sale?tables(['Item / batch','Qty','Each','Line'],x.lines.map(l=>[product(l.sku).name+' / '+l.lot,l.qty,yuan(l.unit),yuan(l.unit*l.qty)]))+'<div class="row"><span>Cash / change</span><b>'+yuan(x.cash)+' / '+yuan(x.change)+'</b></div>':'<p class="entry">Original sale '+x.sale+' · '+product(x.sku).name+' × '+x.qty+'</p><p>'+x.lot+' / '+x.condition+' / '+x.route+'</p>')+'<div class="row total"><span>'+(sale?'Total paid':'Cash refunded')+'</span><strong>'+yuan(sale?x.total:x.amount)+'</strong></div>';
  $('#dialog').showModal();
}
function csv(){
  const r=reg(),s=r.shift(),rows=[['Day','Sales (CNY)','Refunds (CNY)','Net cash (CNY)'],[r.day,s.gross/100,s.paidBack/100,s.net/100],[],['Ref','Reason','Lot','Product','Shelf delta','Isolated delta'],...state.moves.filter(m=>m.day===r.day).map(m=>[m.ref,m.reason,m.lot,product(m.sku).name,m.delta,m.isolated])];
  const url=URL.createObjectURL(new Blob([rows.map(row=>row.join(',')).join('\r\n')],{type:'text/csv'}));
  const link=document.createElement('a');link.href=url;link.download='Noon-ledger-'+r.day+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function act(a,id){
  if(a==='close'){ $('#dialog').close();return; }
  if(a==='print'){window.print();return;}
  msg('');
  if(a==='nav'){tab=id;render();return;}
  if(a==='filter'){filter=id;render();return;}
  if(a==='receipt'){paper(state.sales.find(s=>s.id===id));return;}
  if(a==='csv'){csv();return;}
  if(a==='find'||a==='select'){
    const key=a==='find'?$('#lookup').value.trim().toUpperCase():id;
    if(!state.sales.some(s=>s.id===key)){selected='';render();throw Error('Receipt not found. Check the sale number.');}
    selected=key;render();return;
  }
  const ops={
    add:r=>r.setQty(id,(r.s.basket[id]||0)+1),
    minus:r=>r.setQty(id,(r.s.basket[id]||0)-1),remove:r=>r.setQty(id,0),
    park:r=>r.park(),recall:r=>r.recall(id),pay:r=>r.pay(toFen(cash)),
    refund:r=>r.refund(selected,Number($('#line').value),Number($('#rq').value),$('#condition').value),
    receive:r=>r.receive($('#sku').value,Number($('#sq').value),$('#expiry').value)
  };
  const out=await store.run(ops[a],state.version); state=out.state;
  if(['park','recall','pay'].includes(a))cash='';
  render();
  if(a==='pay'||a==='refund')paper(out.result);
  if(a==='park')msg('Parked as '+out.result+'. Stock will be checked again at payment.');
  if(a==='receive')msg('Delivery recorded as '+out.result+'.');
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]');if(!b||busy||b.disabled)return;busy=true;
  try{await act(b.dataset.act,b.dataset.id);}
  catch(e){if(e.message.includes('another tab')){state=(await store.run()).state;render();}msg(e.message);}
  finally{busy=false;}
});
document.addEventListener('input',e=>{if(e.target.id==='search'){query=e.target.value;$('#products').innerHTML=tiles();}
  if(e.target.id==='cash'){cash=e.target.value;showChange();}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='lookup')$('[data-act=find]').click();});
store.open().then(o=>{state=o.state;render();}).catch(()=>msg('Browser storage could not open. Use a regular Chrome, Edge or Firefox window.'));
