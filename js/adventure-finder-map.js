(() => {
  'use strict';
  const instances=new WeakMap();

  function mapStyle(){
    return {
      version:8,
      sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors'}},
      layers:[{id:'osm',type:'raster',source:'osm'}]
    };
  }

  function markerElement(result,isActive){
    const el=document.createElement('button');
    el.type='button';
    el.className=`af-map-marker${isActive?' is-active':''}`;
    el.dataset.placeId=result.id;
    el.setAttribute('aria-label',`${result.name}, ${result.matchLabel}`);
    el.innerHTML='<span></span>';
    return el;
  }

  function init(root,onSelect){
    const container=root.querySelector('[data-af-map]');
    if(!container || !window.maplibregl) return null;
    const map=new maplibregl.Map({container,style:mapStyle(),center:[-3.2,54.4],zoom:5.2,attributionControl:true});
    map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    const state={map,markers:[],activeId:null,onSelect};
    instances.set(root,state);
    return state;
  }

  function clear(state){
    state.markers.forEach(marker=>{try{marker.remove()}catch{}});
    state.markers=[];
  }

  function render(root,results,activeId=null){
    let state=instances.get(root);
    if(!state) state=init(root,id=>root.dispatchEvent(new CustomEvent('af:select',{detail:{id}})));
    if(!state) return;
    state.activeId=activeId;
    clear(state);
    const bounds=new maplibregl.LngLatBounds();
    results.forEach(result=>{
      if(!Array.isArray(result.coords)||result.coords.length!==2)return;
      const el=markerElement(result,result.id===activeId);
      el.addEventListener('click',()=>state.onSelect(result.id));
      const marker=new maplibregl.Marker({element:el,anchor:'bottom'}).setLngLat(result.coords).addTo(state.map);
      state.markers.push(marker); bounds.extend(result.coords);
    });
    if(!bounds.isEmpty()) state.map.fitBounds(bounds,{padding:70,maxZoom:10,duration:350});
    setTimeout(()=>state.map.resize(),0);
  }

  function focus(root,result){
    const state=instances.get(root); if(!state||!result?.coords)return;
    state.map.flyTo({center:result.coords,zoom:10.5,duration:500});
  }

  window.AdventureFinderMap = Object.freeze({init,render,focus});
})();
