(() => {
  'use strict';
  function ensure(){
    let root=document.querySelector('[data-ab-community-counter]');
    if(root)return root;
    const footer=document.querySelector('.site-footer');if(!footer)return null;
    root=document.createElement('div');root.className='ab-community-counter';root.setAttribute('data-ab-community-counter','');root.setAttribute('aria-label','Adventure Builder community size');
    root.innerHTML='<strong data-ab-adventurer-count>—</strong><span>adventurers joined</span><small data-ab-community-status>Loading community total…</small>';
    const copyright=footer.querySelector('.copyright');footer.insertBefore(root,copyright||null);return root;
  }
  async function initialise(){
    const root=ensure();if(!root)return;
    const count=root.querySelector('[data-ab-adventurer-count]'),status=root.querySelector('[data-ab-community-status]');
    const client=window.ADVENTURE_BUILDER_AUTH?.client;if(!client){status.textContent='Community total unavailable.';return;}
    const {data,error}=await client.rpc('get_adventure_builder_stats');
    if(error){status.textContent=error.message?.includes('get_adventure_builder_stats')?'Community counter needs the W56 database setup.':'Community total temporarily unavailable.';return;}
    const row=Array.isArray(data)?data[0]:data;const n=Number(row?.registered_users||0);count.textContent=n.toLocaleString('en-GB');status.textContent='One account across website and app';
  }
  initialise().catch(()=>{});
})();
