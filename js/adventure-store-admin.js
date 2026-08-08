(() => {
  'use strict';
  const auth = () => window.ADVENTURE_BUILDER_AUTH;
  const $ = (id) => document.getElementById(id);
  const gate = $('store-gate');
  const admin = $('store-admin');
  const gateTitle = $('store-gate-title');
  const gateCopy = $('store-gate-copy');
  const status = $('store-status');
  let client = null;
  let user = null;
  let isAdmin = false;
  let categories = [];
  let products = [];
  let orders = [];
  let editingProductId = null;
  let currentImagePath = null;

  const money = (pence=0) => new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format((Number(pence)||0)/100);
  const slugify = (value='') => value.toLowerCase().trim().replace(/&/g,'and').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90);
  const splitList = (value='') => value.split(',').map(v=>v.trim()).filter(Boolean);
  const setStatus = (msg='', type='') => { if(!status) return; status.textContent=msg; status.className=`store-status${type?` ${type}`:''}`; };
  const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  function showGate(title, copy, login=false){ gate.hidden=false; admin.hidden=true; gateTitle.textContent=title; gateCopy.textContent=copy; $('store-login-btn').hidden=!login; }
  function showAdmin(){ gate.hidden=true; admin.hidden=false; }

  async function checkAccess(session){
    user = session?.user || null;
    client = auth()?.client || null;
    if(!client || !user){ isAdmin=false; showGate('Private Adventure Store','Log in with the Adventure Builder owner/admin account to continue.', true); return; }
    showGate('Checking store access','Confirming your Adventure Store admin permissions…', false);
    const {data,error}=await client.rpc('is_shop_admin');
    if(error){ isAdmin=false; showGate('Store setup required','Run supabase-adventure-store.sql in Supabase, add your user UUID to shop_admins, then reload this page.', false); return; }
    if(!data){ isAdmin=false; showGate('Admin access only','This hidden store is restricted to Adventure Builder store administrators.', false); return; }
    isAdmin=true; showAdmin(); await refreshAll();
  }

  async function refreshAll(){
    if(!isAdmin) return;
    setStatus('Loading store…');
    const [catRes,prodRes,orderRes,settingsRes] = await Promise.all([
      client.from('shop_categories').select('*').order('sort_order').order('name'),
      client.from('shop_products').select('*,shop_categories(name)').order('created_at',{ascending:false}),
      client.from('shop_orders').select('*').order('created_at',{ascending:false}).limit(100),
      client.from('shop_settings').select('*').eq('id',1).single()
    ]);
    const err=catRes.error||prodRes.error||orderRes.error||settingsRes.error;
    if(err){ setStatus(err.message,'bad'); return; }
    categories=catRes.data||[]; products=prodRes.data||[]; orders=orderRes.data||[];
    renderCategories(); renderCategoryOptions(); await renderProducts(); renderOrders(); renderDashboard(); await renderPreview(); renderSettings(settingsRes.data);
    setStatus('Store ready. Public access and checkout remain disabled.','ok');
  }

  function renderDashboard(){
    $('stat-products').textContent=products.length;
    $('stat-published').textContent=products.filter(p=>p.status==='published').length;
    $('stat-low').textContent=products.filter(p=>p.stock_quantity<=p.low_stock_threshold).length;
    $('stat-orders').textContent=orders.length;
    const low=products.filter(p=>p.stock_quantity<=p.low_stock_threshold).slice(0,8);
    $('low-stock-list').innerHTML=low.length?low.map(p=>`<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.sku||'—')}</td><td>${p.stock_quantity}</td><td><span class="store-pill ${p.stock_quantity===0?'zero':'low'}">${p.stock_quantity===0?'Out of stock':'Low stock'}</span></td></tr>`).join(''):`<tr><td colspan="4" class="store-empty">No low-stock products.</td></tr>`;
  }

  function renderCategoryOptions(){
    $('product-category').innerHTML='<option value="">Uncategorised</option>'+categories.filter(c=>c.active).map(c=>`<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  }
  function renderCategories(){
    $('category-list').innerHTML=categories.length?categories.map(c=>`<tr><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.slug)}</td><td>${c.sort_order}</td><td>${c.active?'Active':'Hidden'}</td><td><button class="store-btn light" type="button" data-edit-category="${c.id}">Edit</button></td></tr>`).join(''):`<tr><td colspan="5" class="store-empty">No categories yet.</td></tr>`;
  }

  async function signedImage(path){
    if(!path) return null;
    const {data}=await client.storage.from('shop-product-images').createSignedUrl(path,3600);
    return data?.signedUrl||null;
  }

  async function renderProducts(){
    const rows=[];
    for(const p of products){
      const src=await signedImage(p.image_path);
      const stockClass=p.stock_quantity===0?'zero':(p.stock_quantity<=p.low_stock_threshold?'low':'');
      rows.push(`<tr><td>${src?`<img class="store-thumb" src="${src}" alt="">`:`<div class="store-thumb placeholder">AB</div>`}</td><td><strong>${escapeHtml(p.name)}</strong><br><small>${escapeHtml(p.shop_categories?.name||'Uncategorised')}</small></td><td>${escapeHtml(p.sku||'—')}</td><td>${money(p.price_pence)}</td><td><span class="store-pill ${stockClass}">${p.stock_quantity}</span></td><td><span class="store-pill ${p.status}">${p.status}</span></td><td><button class="store-btn light" type="button" data-edit-product="${p.id}">Edit</button></td></tr>`);
    }
    $('product-list').innerHTML=rows.length?rows.join(''):`<tr><td colspan="7" class="store-empty">No products yet. Add your first Adventure Builder product above.</td></tr>`;
  }

  function renderOrders(){
    $('order-list').innerHTML=orders.length?orders.map(o=>`<tr><td><strong>${escapeHtml(o.order_number)}</strong></td><td>${escapeHtml(o.customer_email||'—')}</td><td>${money(o.total_pence)}</td><td><span class="store-pill">${escapeHtml(o.status)}</span></td><td>${new Date(o.created_at).toLocaleString('en-GB')}</td></tr>`).join(''):`<tr><td colspan="5" class="store-empty">No orders yet. Checkout is intentionally disabled.</td></tr>`;
  }

  async function renderPreview(){
    const list=products.filter(p=>p.status==='published');
    const cards=[];
    for(const p of list){
      const src=await signedImage(p.image_path);
      cards.push(`<article class="store-product-preview">${src?`<img src="${src}" alt="${escapeHtml(p.image_alt||p.name)}">`:`<div class="fake-img">Adventure Builder</div>`}<div class="store-product-preview-body"><small>${escapeHtml(p.shop_categories?.name||'Adventure Store')}</small><h3>${escapeHtml(p.name)}</h3><p>${escapeHtml((p.description||'').slice(0,120))}</p><span class="store-price">${money(p.price_pence)}</span></div></article>`);
    }
    $('store-preview-grid').innerHTML=cards.length?cards.join(''):`<div class="store-empty">Publish a product to see it in this private preview.</div>`;
  }

  function renderSettings(s){
    $('setting-name').value=s?.store_name||'Adventure Store';
    $('setting-notice').value=s?.notice||'';
    $('setting-public').checked=Boolean(s?.public_enabled);
    $('setting-checkout').checked=Boolean(s?.checkout_enabled);
    $('launch-state').textContent=(s?.public_enabled?'Public flag ON':'Public flag OFF')+' · '+(s?.checkout_enabled?'Checkout flag ON':'Checkout flag OFF');
  }

  function resetProduct(){ editingProductId=null; currentImagePath=null; $('product-form').reset(); $('product-id').value=''; $('product-status').value='draft'; $('product-stock').value='0'; $('product-low-stock').value='5'; $('product-submit').textContent='Save Product'; $('product-delete').hidden=true; $('product-image-preview').src=''; $('product-image-preview').className='store-image-preview empty'; $('product-image-preview').alt='No image selected'; renderCategoryOptions(); }

  async function editProduct(id){
    const p=products.find(x=>x.id===id); if(!p) return;
    editingProductId=id; currentImagePath=p.image_path||null; $('product-id').value=id; $('product-name').value=p.name||''; $('product-slug').value=p.slug||''; $('product-description').value=p.description||''; $('product-category').value=p.category_id||''; $('product-sku').value=p.sku||''; $('product-price').value=(p.price_pence/100).toFixed(2); $('product-compare-price').value=p.compare_at_price_pence==null?'':(p.compare_at_price_pence/100).toFixed(2); $('product-stock').value=p.stock_quantity; $('product-low-stock').value=p.low_stock_threshold; $('product-weight').value=p.weight_grams||''; $('product-sizes').value=(p.sizes||[]).join(', '); $('product-colours').value=(p.colours||[]).join(', '); $('product-status').value=p.status; $('product-featured').checked=p.featured; $('product-image-alt').value=p.image_alt||''; $('product-submit').textContent='Update Product'; $('product-delete').hidden=false;
    const src=await signedImage(p.image_path); if(src){ $('product-image-preview').src=src; $('product-image-preview').className='store-image-preview'; $('product-image-preview').alt=p.image_alt||p.name; } else { $('product-image-preview').src=''; $('product-image-preview').className='store-image-preview empty'; }
    $('product-name').scrollIntoView({behavior:'smooth',block:'center'});
  }

  async function uploadImage(file, slug){
    if(!file) return currentImagePath;
    if(file.size>5*1024*1024) throw new Error('Product image must be 5 MB or smaller.');
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Use a JPG, PNG or WebP image.');
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
    const path=`${user.id}/${slug}-${Date.now()}.${ext}`;
    const {error}=await client.storage.from('shop-product-images').upload(path,file,{upsert:false,contentType:file.type});
    if(error) throw error;
    return path;
  }

  async function saveProduct(event){
    event.preventDefault(); if(!isAdmin) return;
    try{
      setStatus('Saving product…');
      const name=$('product-name').value.trim(); const slug=slugify($('product-slug').value||name); if(!name||!slug) throw new Error('Product name is required.');
      const imagePath=await uploadImage($('product-image').files[0],slug);
      const record={name,slug,description:$('product-description').value.trim(),category_id:$('product-category').value||null,sku:$('product-sku').value.trim()||null,price_pence:Math.round((parseFloat($('product-price').value)||0)*100),compare_at_price_pence:$('product-compare-price').value?Math.round(parseFloat($('product-compare-price').value)*100):null,stock_quantity:Math.max(0,parseInt($('product-stock').value||'0',10)),low_stock_threshold:Math.max(0,parseInt($('product-low-stock').value||'5',10)),weight_grams:$('product-weight').value?Math.max(0,parseInt($('product-weight').value,10)):null,image_path:imagePath||null,image_alt:$('product-image-alt').value.trim(),sizes:splitList($('product-sizes').value),colours:splitList($('product-colours').value),status:$('product-status').value,featured:$('product-featured').checked,updated_at:new Date().toISOString()};
      let res;
      if(editingProductId) res=await client.from('shop_products').update(record).eq('id',editingProductId); else res=await client.from('shop_products').insert(record);
      if(res.error) throw res.error;
      resetProduct(); await refreshAll(); setStatus('Product saved. It is still private to store admins.','ok');
    }catch(error){setStatus(error.message||String(error),'bad');}
  }

  async function deleteProduct(){
    if(!editingProductId||!confirm('Delete this product? This cannot be undone.')) return;
    const id=editingProductId; const img=currentImagePath; const {error}=await client.from('shop_products').delete().eq('id',id); if(error) return setStatus(error.message,'bad');
    if(img) await client.storage.from('shop-product-images').remove([img]); resetProduct(); await refreshAll(); setStatus('Product deleted.','ok');
  }

  async function saveCategory(event){
    event.preventDefault();
    const id=$('category-id').value||null; const name=$('category-name').value.trim(); const record={name,slug:slugify($('category-slug').value||name),description:$('category-description').value.trim(),sort_order:parseInt($('category-order').value||'100',10),active:$('category-active').checked,updated_at:new Date().toISOString()};
    const res=id?await client.from('shop_categories').update(record).eq('id',id):await client.from('shop_categories').insert(record);
    if(res.error) return setStatus(res.error.message,'bad'); $('category-form').reset(); $('category-id').value=''; $('category-active').checked=true; $('category-order').value='100'; await refreshAll(); setStatus('Category saved.','ok');
  }

  function editCategory(id){ const c=categories.find(x=>x.id===id); if(!c)return; $('category-id').value=c.id; $('category-name').value=c.name; $('category-slug').value=c.slug; $('category-description').value=c.description||''; $('category-order').value=c.sort_order; $('category-active').checked=c.active; }

  async function saveSettings(event){
    event.preventDefault();
    const publicEnabled=$('setting-public').checked; const checkoutEnabled=$('setting-checkout').checked;
    if((publicEnabled||checkoutEnabled) && !confirm('The store is intended to stay hidden. Save these launch flags anyway?')) return;
    const {error}=await client.from('shop_settings').update({store_name:$('setting-name').value.trim()||'Adventure Store',notice:$('setting-notice').value.trim(),public_enabled:publicEnabled,checkout_enabled:checkoutEnabled,updated_at:new Date().toISOString()}).eq('id',1);
    if(error) return setStatus(error.message,'bad'); await refreshAll(); setStatus('Store settings saved.','ok');
  }

  document.addEventListener('click',(e)=>{
    const tab=e.target.closest('[data-store-tab]'); if(tab){ document.querySelectorAll('[data-store-tab]').forEach(b=>b.classList.toggle('active',b===tab)); document.querySelectorAll('.store-panel').forEach(p=>p.classList.toggle('active',p.id===`store-panel-${tab.dataset.storeTab}`)); }
    const ep=e.target.closest('[data-edit-product]'); if(ep) editProduct(ep.dataset.editProduct);
    const ec=e.target.closest('[data-edit-category]'); if(ec) editCategory(ec.dataset.editCategory);
  });
  $('store-login-btn')?.addEventListener('click',()=>auth()?.open('login'));
  $('product-form')?.addEventListener('submit',saveProduct); $('product-reset')?.addEventListener('click',resetProduct); $('product-delete')?.addEventListener('click',deleteProduct);
  $('category-form')?.addEventListener('submit',saveCategory); $('settings-form')?.addEventListener('submit',saveSettings); $('store-refresh')?.addEventListener('click',refreshAll);
  $('product-name')?.addEventListener('input',()=>{if(!editingProductId && !$('product-slug').dataset.touched) $('product-slug').value=slugify($('product-name').value);});
  $('product-slug')?.addEventListener('input',()=>{$('product-slug').dataset.touched='1';});
  $('category-name')?.addEventListener('input',()=>{if(!$('category-slug').dataset.touched) $('category-slug').value=slugify($('category-name').value);});
  $('category-slug')?.addEventListener('input',()=>{$('category-slug').dataset.touched='1';});
  $('product-image')?.addEventListener('change',(e)=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);$('product-image-preview').src=url;$('product-image-preview').className='store-image-preview';});

  window.addEventListener('adventurebuilder:auth',(event)=>checkAccess(event.detail?.session).catch(err=>showGate('Store unavailable',err.message,false)));
  setTimeout(()=>checkAccess(auth()?.getSession?.()).catch(()=>{}),500);
})();
