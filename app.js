'use strict';
const pages = {Dashboard:'▦', Products:'◇', Stock:'⇅', Sales:'▤', Payments:'₦', 'Member statement':'◎', Reports:'▥'};
const labels = {receipt:'Stock received', adjustment:'Count correction', sale:'Sale', return:'Sale return', payment:'Payment', product:'Product added'};
const seed = {
  products:[
    {id:'r',sku:'GRC-001',name:'Rice',unit:'25 kg bag',price:3200000,reorder:8},
    {id:'o',sku:'GRC-002',name:'Vegetable oil',unit:'5 L bottle',price:1250000,reorder:6},
    {id:'b',sku:'GRC-003',name:'Beans',unit:'5 kg bag',price:950000,reorder:8},
    {id:'m',sku:'GRC-004',name:'Maize flour',unit:'2 kg pack',price:340000,reorder:5}
  ],
  members:[{id:'M001',name:'Sample member A'},{id:'M002',name:'Sample member B'}],
  ledger:[
    ...[['r',34],['o',14],['b',7],['m',4]].map(([product,qty],i)=>({id:'OPEN-'+(i+1),type:'receipt',product,qty,note:'Sample opening stock',at:new Date().toISOString()})),
    {id:'SALE-001',type:'sale',product:'r',qty:-2,amount:6400000,price:3200000,member:'M001',credit:true,at:new Date().toISOString()},
    {id:'SALE-002',type:'sale',product:'o',qty:-1,amount:1250000,price:1250000,credit:false,at:new Date().toISOString()},
    {id:'PAY-001',type:'payment',amount:2000000,member:'M001',note:'Sample part payment',at:new Date().toISOString()}
  ]
};
const additionalProducts = [
  ['GRC-005','Honey beans (Oloyin)','2 kg bag','Staples',5200,8,18],
  ['GRC-006','Plantain flour','1 kg pack','Staples',4200,6,14],
  ['GRC-007','Red palm oil','1 L bottle','Staples',3500,6,20],
  ['GRC-008','Garri','2 kg bag','Staples',2400,8,25],
  ['GRC-009','Semolina','1 kg pack','Staples',2600,6,14],
  ['PRV-001','Powdered milk','400 g tin','Provisions',6500,5,12],
  ['PRV-002','Chocolate drink powder','400 g tin','Provisions',5800,5,10],
  ['PRV-003','Granulated sugar','500 g pack','Provisions',1500,8,22],
  ['PRV-004','Spaghetti','500 g pack','Provisions',1400,10,28],
  ['PRV-005','Instant noodles','70 g pack','Provisions',450,15,48],
  ['PRV-006','Tomato paste','70 g sachet','Provisions',400,12,36],
  ['PRV-007','Sardines','125 g tin','Provisions',2100,6,16],
  ['PRV-008','Tea bags','25-bag box','Provisions',2000,5,12],
  ['TLT-001','Bath soap','150 g bar','Toiletries',950,8,24],
  ['TLT-002','Toothpaste','140 g tube','Toiletries',1800,6,18],
  ['TLT-003','Toothbrush','Single brush','Toiletries',750,6,20],
  ['TLT-004','Toilet tissue','4-roll pack','Toiletries',2300,8,20],
  ['TLT-005','Sanitary pads','8-pad pack','Toiletries',1700,6,16],
  ['TLT-006','Body lotion','250 mL bottle','Toiletries',3900,5,10],
  ['TLT-007','Roll-on deodorant','50 mL bottle','Toiletries',2300,5,10],
  ['TLT-008','Liquid hand wash','250 mL bottle','Toiletries',1900,5,12]
];
const stapleIds = new Set(seed.products.map(p=>p.id));
const categoryOf = p=>p.category || (stapleIds.has(p.id)?'Staples':'Uncategorised');
function withExpandedCatalogue(saved){
  const current = saved || seed;
  const usedSkus = new Set(current.products.map(p=>p.sku.toUpperCase()));
  const products = current.products.slice(), openingStock = [];
  for(const [sku,name,unit,category,price,reorder,qty] of additionalProducts){
    if(usedSkus.has(sku))continue;
    const id = 'demo-'+sku;
    products.push({id,sku,name,unit,category,price:price*100,reorder});
    openingStock.push({id:'OPEN-'+sku,type:'receipt',product:id,qty,note:'Sample opening stock',at:current.ledger[0]?.at || seed.ledger[0].at});
  }
  return {...current,products,ledger:[...openingStock,...current.ledger]};
}
const key='asuu-coop-stock-v1';
let state=workspaceMode?{products:[],members:[],ledger:[]}:withExpandedCatalogue(JSON.parse(localStorage.getItem(key) || 'null'));
let page='Dashboard', member='M001', filter='';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=value=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:2}).format(value/100);
const sum=values=>values.reduce((a,b)=>a+b,0);
const stock=id=>workspaceMode?(state.products.find(p=>p.id===id)?.on_hand??0):sum(state.ledger.filter(x=>x.product===id).map(x=>x.qty||0));
const entries=(...types)=>state.ledger.filter(x=>types.includes(x.type)).slice().reverse();
const name=id=>state.products.find(x=>x.id===id)?.name||'';
const person=id=>state.members.find(x=>x.id===id)?.name||'Walk-in';
const amountDue=id=>sum(state.ledger.filter(x=>x.member===id).map(x=>x.type==='payment'?-x.amount:x.credit?x.amount:0));
const remaining=id=>sum(state.ledger.filter(x=>x.type==='return'&&x.sale===id).map(x=>x.qty))+(state.ledger.find(x=>x.id===id)?.qty||0);
const date=at=>new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Africa/Lagos'}).format(new Date(at));
const canAct=action=>!workspaceMode||(Boolean(coopSession?.role)&&action==='refresh')||(coopSession?.role==='staff'&&['receipt','sale'].includes(action))||(coopSession?.role==='exco'&&action==='export');
const allowedPage=p=>!workspaceMode||(['Dashboard','Products','Stock','Sales'].includes(p)||(p==='Reports'&&coopSession?.role==='exco'));
const btn=(label,action,primary=false)=>!canAct(action)?'':'<button class="'+(primary?'primary':'secondary')+'" data-action="'+action+'">'+label+'</button>';
const table=(headers,rows)=>rows.length?'<div class="scroll"><table><thead><tr>'+headers.map(x=>'<th scope="col">'+x+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<div class="empty">No matching records.</div>';
const panel=(title,body,action='')=>'<section class="panel"><div class="panel-head"><h2>'+title+'</h2>'+action+'</div>'+body+'</section>';
const card=(label,value)=>'<div class="card"><span>'+label+'</span><strong>'+value+'</strong></div>';
const badge=(label,warning=false)=>'<span class="badge '+(warning?'warn':'')+'">'+label+'</span>';
function activity(rows){
  return table(['Time (WAT)','Activity','Reference','Details',...(workspaceMode?['Recorded by']:[])],rows.map(x=>[date(x.at),labels[x.type],esc(x.id),esc(x.note||name(x.product)||person(x.member)),...(workspaceMode?[esc(x.actor)]:[])]));
}
function render(){
  $('nav').innerHTML=Object.entries(pages).filter(([p])=>allowedPage(p)).map(([p,i])=>'<button data-page="'+p+'" '+(p===page?'aria-current="page"':'')+'><span aria-hidden="true">'+i+'</span>'+p+'</button>').join('');
  $('crumb').textContent=page;
  const low=state.products.filter(p=>stock(p.id)<=p.reorder);
  const saleRows=entries('sale','return');
  const due=sum(state.members.map(m=>amountDue(m.id)));
  const sections={
    Dashboard: ['Stock overview','Monitor stock, shop sales and member credit from one workspace.',btn('Receive stock','receipt')+btn('Record sale','sale',true)+(workspaceMode?btn('Refresh','refresh'):''),
      '<div class="cards">'+card('Active products',state.products.length)+card('Low-stock items',low.length)+card('Net sales',money(sum(saleRows.map(x=>x.amount))))+(workspaceMode?'':card('Member credit outstanding',money(due)))+'</div><div class="grid">'+panel('Recent activity',activity(state.ledger.slice(-6).reverse()))+panel('Low stock',table(['Product','On hand','Reorder at'],low.map(p=>[esc(p.name)+'<small>'+esc(p.unit)+'</small>',badge(stock(p.id),true),p.reorder])))+'</div>'],
    Products:['Product catalogue',workspaceMode?'Check product quantities and prices.':'Manage stock-keeping units, selling prices and reorder points.',btn('Add product','product',true),
      panel('Products',table(['SKU','Product','Category','Unit','Selling price','On hand','Status'],state.products.filter(p=>[p.sku,p.name,p.unit,categoryOf(p)].some(v=>v.toLowerCase().includes(filter.toLowerCase()))).map(p=>[esc(p.sku),esc(p.name),esc(categoryOf(p)),esc(p.unit),money(p.price),stock(p.id),stock(p.id)<=p.reorder?badge('Low stock',true):badge('In stock')])),'<input id="filter" class="search" aria-label="Search products or categories" placeholder="Product or category…" value="'+esc(filter)+'">')],
    Stock:['Stock movements',workspaceMode?'Review goods received and stock movements.':'Receive goods and log physical count corrections.',btn('Count correction','adjustment')+btn('Receive stock','receipt',true),
      panel('Movement ledger',table(['Time (WAT)','Reference','Product','Movement','Quantity','Note'],entries('receipt','adjustment','sale','return').map(x=>[date(x.at),esc(x.id),esc(name(x.product)),labels[x.type],x.qty>0?'+'+x.qty:x.qty,esc(x.note||'')])) )],
    Sales:[workspaceMode?'Sales':'Sales and returns',workspaceMode?'Review recorded paid sales.':'Record paid and member-credit sales, then reverse eligible quantities with a return.',btn('Record return','return')+btn('Record sale','sale',true),
      panel('Sales ledger',table(['Reference','Date (WAT)','Product','Units','Member','Type','Amount'],saleRows.map(x=>[esc(x.id),date(x.at),esc(name(x.product)),x.type==='sale'?-x.qty:x.qty,esc(person(x.member)),x.type==='return'?badge('Return',true):badge(x.credit?'Member credit':'Paid',x.credit),money(x.amount)])))],
    Payments:['Member payments','Record payments against outstanding shop credit.',btn('Record payment','payment',true),
      panel('Credit balances',table(['Member ID','Member','Outstanding'],state.members.map(m=>[esc(m.id),esc(m.name),money(amountDue(m.id))])))+panel('Payment history',activity(entries('payment')))],
    'Member statement':['Member purchase statement','Preview what a member could see in their own shop statement. Switch sample members below.', '',
      panel('Statement', '<div class="panel-head"><label class="member-picker">Sample member<select id="member">'+state.members.map(m=>'<option value="'+m.id+'" '+(m.id===member?'selected':'')+'>'+esc(m.name)+'</option>').join('')+'</select></label>'+badge('Outstanding '+money(amountDue(member)),true)+'</div>'+
      table(['Reference','Date (WAT)','Activity','Product / note','Amount'],entries('sale','return','payment').filter(x=>x.member===member).map(x=>[esc(x.id),date(x.at),labels[x.type],esc(name(x.product)||x.note),money(x.type==='payment'?-x.amount:x.amount)])))],
    Reports:['Reports',workspaceMode?'Review sales and stock activity, and export the transaction ledger.':'Review sales, collections and stock activity. Export the demo transaction ledger.',btn('Export CSV','export',true),
      '<div class="cards">'+card('Net sales',money(sum(saleRows.map(x=>x.amount))))+(workspaceMode?'':card('Credit payments',money(sum(entries('payment').map(x=>x.amount))))+card('Outstanding credit',money(due)))+card('Stock movements',entries('receipt','adjustment','sale','return').length)+'</div>'+panel('Transaction activity',activity(state.ledger.slice().reverse()))]
  };
  const [title,desc,actions,body]=sections[page];
  $('main').innerHTML='<section class="hero"><div><div class="eyebrow">COOPERATIVE STORE</div><h1>'+title+'</h1><p>'+desc+'</p></div><div class="actions">'+actions+'</div></section>'+body;
}
const input=(name,label,type='text',attrs='')=>'<label>'+label+'<input name="'+name+'" type="'+type+'" '+attrs+' required></label>';
const select=(name,label,options)=>'<label>'+label+'<select name="'+name+'" required>'+options.map(([v,l])=>'<option value="'+esc(v)+'">'+esc(l)+'</option>').join('')+'</select></label>';
function form(action){
  const product=()=>select('product','Product',[['','Select product'],...state.products.map(p=>[p.id,p.name+' · '+stock(p.id)+' on hand'])]);
  const members=state.members.map(m=>[m.id,m.name]);
  const quantity=(label='Quantity',min=1)=>input('qty',label,'number','min="'+min+'" max="1000000" step="1"');
  const note=(label='Reason')=>input('note',label,'text','maxlength="120"');
  const fields={
    product:()=>input('name','Product name','text','maxlength="75"')+input('sku','Unique SKU','text','maxlength="25"')+input('unit','Unit of sale','text','maxlength="30"')+select('category','Category',['Staples','Provisions','Toiletries','Uncategorised'].map(x=>[x,x]))+input('price','Selling price (₦)','number','min="0.01" max="10000000" step="0.01"')+input('reorder','Reorder point','number','min="0" max="1000000" step="1"'),
    receipt:()=>product()+quantity()+note('Supplier or delivery reference'),
    adjustment:()=>product()+quantity('Actual physical count',0)+note(),
    sale:()=>product()+quantity()+(workspaceMode?'':select('method','Sale type',[['paid','Paid in full'],['credit','Member credit']])+select('member','Member',[['walk','Walk-in'],...members])),
    return:()=>select('sale','Original sale',[['','Select a sale'],...entries('sale').filter(x=>remaining(x.id)<0).map(x=>[x.id,x.id+' · '+name(x.product)+' · '+(-remaining(x.id))+' returnable'])])+quantity()+note(),
    payment:()=>select('member','Member',[['','Select member'],...members.filter(([id])=>amountDue(id)>0).map(([id,n])=>[id,n+' · '+money(amountDue(id))])])+input('amount','Payment amount (₦)','number','min="0.01" max="10000000000000" step="0.01"')+note('Payment reference')
  };
  const titles={product:'Add product',receipt:'Receive stock',adjustment:'Correct stock count',sale:'Record sale',return:'Record sale return',payment:'Record payment'};
  const dialog=$('dialog');
  dialog.innerHTML='<h2>'+titles[action]+'</h2><form data-form="'+action+'">'+fields[action]()+'<p class="error" role="alert"></p><div class="actions">'+btn('Cancel','cancel')+'<button class="primary" type="submit">Save record</button></div></form>';
  dialog.querySelector('[data-action=cancel]').type='button';
  if(workspaceMode)dialog.querySelector('form').dataset.requestId=crypto.randomUUID();
  dialog.showModal();
}
function record(action,d){
  const entry={type:action,at:new Date().toISOString(),id:({product:'ITEM',receipt:'IN',adjustment:'ADJ',sale:'SALE',return:'RET',payment:'PAY'}[action])+'-'+crypto.randomUUID().slice(0,8).toUpperCase()};
  const qty=Number(d.qty), price=Math.round(Number(d.price)*100), amount=Math.round(Number(d.amount)*100);
  const next={products:state.products.slice(),members:state.members,ledger:state.ledger.slice()};
  if(action==='product'){
    const sku=d.sku.trim().toUpperCase(), title=d.name.trim(), unit=d.unit.trim();
    if(!sku||!title||!unit)throw Error('Enter a SKU, product name and unit.');
    if(state.products.some(p=>p.sku===sku))throw Error('This SKU already exists.');
    next.products.push({id:entry.id,sku,name:title,unit,category:d.category,price,reorder:Number(d.reorder)});
    entry.note=title;
  }
  if(['receipt','sale','adjustment'].includes(action)){
    const product=state.products.find(p=>p.id===d.product);
    if(!product)throw Error('Select a product.');
    entry.product=product.id;
    entry.qty=action==='adjustment'?qty-stock(product.id):action==='sale'?-qty:qty;
    if(action==='adjustment'&&entry.qty===0)throw Error('The physical count already matches the ledger.');
    if(stock(product.id)+entry.qty<0)throw Error('This sale exceeds available stock.');
    if(action==='sale'){
      const credit=d.method==='credit';
      if(credit&&d.member==='walk')throw Error('Credit sales require a member.');
      Object.assign(entry,{price:product.price,amount:qty*product.price,credit,member:d.member==='walk'?undefined:d.member});
    }
  }
  if(action==='return'){
    const sale=state.ledger.find(x=>x.type==='sale'&&x.id===d.sale);
    if(!sale||qty>-remaining(sale.id))throw Error('Enter a quantity within the original sale balance.');
    if(sale.credit&&qty*sale.price>amountDue(sale.member))throw Error('This return would create a member credit balance. A refund workflow is required.');
    Object.assign(entry,{sale:sale.id,product:sale.product,qty,amount:-qty*sale.price,credit:sale.credit,member:sale.member});
  }
  if(action==='payment'){
    if(!state.members.some(m=>m.id===d.member)||amount<=0||amount>amountDue(d.member))throw Error('Enter a payment within the member’s outstanding balance.');
    Object.assign(entry,{member:d.member,amount});
  }
  if(d.note!==undefined){
    if(!d.note.trim())throw Error('Enter a reason or reference.');
    entry.note=d.note.trim();
  }
  next.ledger.push(entry);
  localStorage.setItem(key,JSON.stringify(next));
  state=next;
}
function exportLedger(){
  const csv=value=>'"'+String(value??'').replace(/^[\s]*[=+@\-]/, m=>"'"+m).replaceAll('"','""')+'"';
  const rows=[['Reference','Timestamp UTC','Type','Product','Member ID','Quantity change','Amount NGN','Note',...(workspaceMode?['Recorded by']:[])],
    ...state.ledger.map(x=>[x.id,x.at,labels[x.type],name(x.product),x.member,x.qty,typeof x.amount==='number'?x.amount/100:'',x.note,...(workspaceMode?[x.actor]:[])])];
  const url=URL.createObjectURL(new Blob([rows.map(r=>r.map(v=>typeof v==='number'?v:csv(v)).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=workspaceMode?'asuu-futa-ledger.csv':'asuu-futa-demo-ledger.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.addEventListener('click',e=>{
  const target=e.target.closest('button');
  if(!target)return;
  if(target.id==='sign-out'){coopSignOut();return;}
  if(target.dataset.page&&allowedPage(target.dataset.page)){page=target.dataset.page;render();return;}
  const action=target.dataset.action;
  if(action==='cancel')$('dialog').close();
  else if(action==='refresh'&&canAct(action))loadCoopWorkspace().catch(error=>{if(coopSession)$('toast').textContent=error.message;});
  else if(action==='export'&&canAct(action))exportLedger();
  else if(action&&canAct(action))form(action);
});
document.addEventListener('submit',async e=>{
  const form=e.target;
  if(!form.dataset.form)return;
  e.preventDefault();
  const action=form.dataset.form;
  if(!canAct(action))return;
  const submit=form.querySelector('[type=submit]');
  if(submit.disabled)return;
  submit.disabled=true;
  try{
    const data=Object.fromEntries(new FormData(form));
    if(workspaceMode){
      await coopRequest('/rest/v1/rpc/coop_post', {body:{
        p_request:form.dataset.requestId,p_kind:action,p_product:data.product,p_qty:Number(data.qty),p_note:data.note||null
      }});
      $('dialog').close();
      try { await loadCoopWorkspace(); }
      catch { if(coopSession) $('toast').textContent='Record saved. Refresh the workspace to see the updated stock.'; return; }
    }else{
      state=withExpandedCatalogue(JSON.parse(localStorage.getItem(key)||'null'));
      record(action,data);
    }
    $('dialog').close();render();
    $('toast').textContent='Record saved';
    clearTimeout(window.toastTimer);
    window.toastTimer=setTimeout(()=>$('toast').textContent='',2700);
  }catch(err){form.querySelector('.error').textContent=err.message;}finally{submit.disabled=false;}
});
document.addEventListener('change',e=>{if(e.target.id==='member'){member=e.target.value;render();$('member').focus();}});
document.addEventListener('input',e=>{if(e.target.id==='filter'){filter=e.target.value;const pos=e.target.selectionStart;render();$('filter').focus();$('filter').setSelectionRange(pos,pos);}});
window.addEventListener('storage',e=>{if(!workspaceMode&&e.key===key){state=withExpandedCatalogue(JSON.parse(e.newValue||'null'));render();}});
if(workspaceMode)showCoopSignIn();
else render();
if(!workspaceMode&&'serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
