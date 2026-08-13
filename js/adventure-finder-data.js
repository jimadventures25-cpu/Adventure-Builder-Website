(() => {
  'use strict';

  const labels = {
    dog:'Dog friendly', tent:'Tent pitches', van:'Van friendly', family:'Family friendly', quiet:'Quiet setting',
    showers:'Showers', toilets:'Toilets', water:'Fresh water', electric:'Electric hook-up',
    waterfall:'Waterfalls', sunset:'Sunset views', sunrise:'Sunrise spots', hiking:'Walking & hiking',
    paddle:'Paddling', lake:'Lakes', mountain:'Mountains', beach:'Beaches', forest:'Forest', wildlife:'Wildlife',
    photo:'Photography', cafe:'Cafés', pub:'Pubs', cycling:'Cycling', cave:'Caves'
  };

  // Stage 1 keeps the current demo dataset, but normalises it into the same shape
  // the real discovery provider can supply in Stage 2.
  const places = [
    {id:'af1',name:'Rydal Explorer Base',region:'Lake District',type:'Campsite',coords:[-3.005,54.448],traits:['dog','tent','van','family','showers','toilets','water'],pois:['waterfall','sunset','hiking','lake','cafe'],vehicle:{maxHeight:3.4,maxLength:7.5,maxWeight:3500},distance:{waterfall:2.2,sunset:1.1,hiking:.3,lake:.8,cafe:1.6},summary:'A flexible base for lakeside walks, waterfalls and relaxed family adventures.',imageTone:'lake'},
    {id:'af2',name:'Borrowdale Adventure Stop',region:'Lake District',type:'Campervan Site',coords:[-3.152,54.523],traits:['dog','van','toilets','water','quiet'],pois:['waterfall','hiking','mountain','sunrise','pub'],vehicle:{maxHeight:3.1,maxLength:6.8,maxWeight:3500},distance:{waterfall:1.0,hiking:.2,mountain:1.8,sunrise:1.3,pub:1.1},summary:'A quieter mountain base close to classic Borrowdale walking country.',imageTone:'mountain'},
    {id:'af3',name:'Coniston Water Base',region:'Lake District',type:'Campsite',coords:[-3.079,54.369],traits:['dog','tent','van','showers','toilets','water','electric'],pois:['paddle','sunset','lake','hiking','cafe'],vehicle:{maxHeight:3.6,maxLength:8.0,maxWeight:4250},distance:{paddle:.7,sunset:.9,lake:.4,hiking:.5,cafe:1.2},summary:'A lakeside-style base suited to paddling, easy access walks and evening views.',imageTone:'water'},
    {id:'af4',name:'Peak Edge Explorer Camp',region:'Peak District',type:'Campsite',coords:[-1.807,53.304],traits:['dog','tent','family','showers','toilets'],pois:['hiking','sunset','cave','pub','photo'],vehicle:{maxHeight:2.9,maxLength:6.2,maxWeight:3500},distance:{hiking:.2,sunset:1.4,cave:3.1,pub:.8,photo:.6},summary:'A Peak District base for walking, photography and easy access to village stops.',imageTone:'hill'},
    {id:'af5',name:'Dales Quiet Van Haven',region:'Yorkshire Dales',type:'Permitted Overnight Stop',coords:[-2.157,54.278],traits:['dog','van','quiet','toilets'],pois:['waterfall','hiking','sunset','pub','photo'],vehicle:{maxHeight:3.3,maxLength:7.2,maxWeight:3500},distance:{waterfall:2.6,hiking:.4,sunset:.8,pub:1.7,photo:.9},summary:'A low-key van stop aimed at walkers and photographers exploring the Dales.',imageTone:'dales'},
    {id:'af6',name:'Highland Loch Explorer',region:'Scottish Highlands',type:'Campsite',coords:[-4.754,57.083],traits:['dog','tent','van','showers','toilets','water'],pois:['paddle','lake','mountain','wildlife','sunset'],vehicle:{maxHeight:3.8,maxLength:8.5,maxWeight:5000},distance:{paddle:.5,lake:.1,mountain:3.4,wildlife:1.3,sunset:.5},summary:'A Highland-style base for lochs, wildlife, mountain days and paddling.',imageTone:'highland'},
    {id:'af7',name:'Cornish Coast Adventure Park',region:'Cornwall',type:'Campsite',coords:[-5.498,50.134],traits:['dog','tent','van','family','showers','toilets','electric'],pois:['beach','sunset','paddle','cafe','hiking'],vehicle:{maxHeight:3.2,maxLength:7.0,maxWeight:3500},distance:{beach:.7,sunset:.4,paddle:1.0,cafe:.9,hiking:.3},summary:'A coastal base for beach days, paddling and sections of the coast path.',imageTone:'coast'},
    {id:'af8',name:'New Forest Quiet Base',region:'New Forest',type:'Campervan Site',coords:[-1.576,50.858],traits:['dog','van','quiet','toilets','water'],pois:['forest','wildlife','cycling','cafe','hiking'],vehicle:{maxHeight:3.0,maxLength:6.5,maxWeight:3500},distance:{forest:.1,wildlife:.6,cycling:.2,cafe:1.4,hiking:.2},summary:'A woodland base for cycling, wildlife and gentle walking days.',imageTone:'forest'}
  ];

  window.AdventureFinderData = Object.freeze({ labels, places });
})();
