(function(root){
const fields=['area','question','guidance','references','ppq','classification','classificationType','onSiteOnly','temporaryRemoval'];
function validate(x){
 if(!x||x.schemaVersion!==1||typeof x.label!=='string'||!x.label.trim()||x.label.length>150||!Array.isArray(x.records)||!x.records.length||x.records.length>5000||!Array.isArray(x.sources))throw Error('Geçerli bir schemaVersion: 1 PQ seti bekleniyor.');
 const ids=new Set();const areas=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA','SSP'];
 for(const r of x.records){if(!r||!/^\d\.\d{3}$/.test(r.id)||ids.has(r.id))throw Error('Geçersiz veya yinelenen PQ numarası: '+r?.id);ids.add(r.id);
 if(!areas.includes(r.area)||areas[Number(r.id[0])-1]!==r.area)throw Error('PQ numarası ve alan uyuşmuyor: '+r.id);
 for(const k of ['question','guidance','references','classification'])if(typeof r[k]!=='string'||(k!=='references'&&!r[k].trim())||r[k].length>100000)throw Error('Eksik/geçersiz '+k+': '+r.id);
 for(const k of ['ppq','onSiteOnly','temporaryRemoval'])if(typeof r[k]!=='boolean')throw Error('Geçersiz '+k+': '+r.id);
 if(r.classificationType!==(r.area==='SSP'?'SSP':'CE'))throw Error('CE/SSP türü uyuşmuyor: '+r.id);
 if(!x.sources.some(s=>s.area===r.area&&typeof s.filename==='string'&&typeof s.date==='string'&&(s.revision===null||typeof s.revision==='string')))throw Error('Kaynak bilgisi eksik: '+r.area);
 }
 return x;
}
function compare(a,b){const am=new Map(a.records.map(r=>[r.id,r])),bm=new Map(b.records.map(r=>[r.id,r]));const added=[],removed=[],changed=[],same=[];
 for(const [id,r] of bm){const before=am.get(id);if(!before)added.push(id);else {const changedFields=fields.filter(k=>before[k]!==r[k]);if(changedFields.length)changed.push({id,fields:changedFields,before,after:r});else same.push(id);}}
 for(const id of am.keys())if(!bm.has(id))removed.push(id);return {added,removed,changed,same};}
 const api={validate,compare,fields};if(typeof module!=='undefined')module.exports=api;else root.PQCore=api;
})(globalThis);
