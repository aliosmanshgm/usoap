import {editionOf} from './state-analysis.mjs';
export function validateCapArchive(x,set){
 if(!x||x.schemaVersion!==1||x.recordType!=='cap_archive'||!/^[-\w.]{1,100}$/.test(x.id)||typeof x.label!=='string'||!x.label.trim()||x.label.length>150||x.country!=='TUR'||!['draft','final'].includes(x.publicationStatus)||!['complete','partial'].includes(x.completeness)||!Array.isArray(x.records)||x.records.length>5000||!Array.isArray(x.sources)||!x.sources.length||new Set(x.sources.map(s=>s?.area)).size!==x.sources.length||!Array.isArray(x.scopeAreas)||!x.scopeAreas.length||new Set(x.scopeAreas).size!==x.scopeAreas.length)throw Error('CAP arşiv yapısı geçersiz.');
 if(!set||x.pqSetId!==set.id||typeof x.pqEdition!=='string'||!x.pqEdition.trim()||(editionOf(set)&&x.pqEdition!==editionOf(set)))throw Error('CAP ve seçilen PQ sürümü uyuşmuyor.');
 if(!['CMAA','PQ_MIGRATION','OSVA','ICVM','STATE_SNAPSHOT'].includes(x.activityType)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(x.activityPeriod))throw Error('Faaliyet türü ve dönemi gerekli.');
 const defs=new Map(set.records.map(r=>[r.id,r])),ids=new Set();
 for(const area of x.scopeAreas){if(!set.records.some(r=>r.area===area)||!x.sources.some(s=>s.area===area))throw Error('CAP kapsam kaynağı eksik: '+area)}
 for(const source of x.sources)if(!x.scopeAreas.includes(source.area)||typeof source.filename!=='string'||!/^[a-f0-9]{64}$/.test(source.sha256))throw Error('CAP kaynak bilgisi geçersiz.');
 for(const r of x.records){if(!defs.has(r.id)||defs.get(r.id).area!==r.area||!x.scopeAreas.includes(r.area)||ids.has(r.id)||!['NS','S','NA'].includes(r.status)||!Array.isArray(r.steps)||!Array.isArray(r.emptySlots))throw Error('Geçersiz CAP PQ kaydı: '+r.id);ids.add(r.id);for(const k of ['question','description','guidance','references','progressDocumented','classification','statusText','sscText'])if(typeof r[k]!=='string')throw Error('CAP alanı eksik: '+r.id+' / '+k);if(new Set([...r.steps,...r.emptySlots].map(s=>s.number)).size!==r.steps.length+r.emptySlots.length)throw Error('Yinelenen CAP adım numarası: '+r.id);for(const s of [...r.steps,...r.emptySlots])if(!Number.isInteger(s.number)||s.number<1||['action','offices','evidence','estimatedDate','revisedDate','completionDate','progress'].some(k=>typeof s[k]!=='string'))throw Error('CAP adımı geçersiz: '+r.id)}
 return x;
}
export function buildCapArchive(documents,set,meta){
 if(!documents.length)throw Error('En az bir CAP belgesi gerekli.');for(const d of documents)if(d.source.findingCount!==d.records.length)throw Error('Belge kayıt sayısı uyuşmuyor: '+d.area);const areas=documents.map(d=>d.area);if(new Set(areas).size!==areas.length)throw Error('Aynı alanın iki tarih sürümünü aynı arşive yüklemeyin; ayrı kayıt oluşturun.');
 return validateCapArchive({schemaVersion:1,recordType:'cap_archive',id:'cap-'+crypto.randomUUID(),country:'TUR',label:meta.label.trim(),pqSetId:set.id,pqEdition:meta.pqEdition.trim(),activityType:meta.activityType,activityPeriod:meta.activityPeriod,publicationStatus:meta.publicationStatus,completeness:meta.completeness,scopeAreas:areas,sources:documents.map(d=>d.source),records:documents.flatMap(d=>d.records)},set);
}
export function reconcileCap(archive,snapshot){
 if(archive.pqSetId!==snapshot.pqSetId)throw Error('Eşleştirme için CAP ve ülke kaydının PQ seti aynı olmalı.');const expected=snapshot.records.filter(r=>archive.scopeAreas.includes(r.area)&&r.status==='NS'),ids=new Set(archive.records.filter(r=>r.status==='NS').map(r=>r.id)),expectedIds=new Set(expected.map(r=>r.id));
 return {matched:expected.filter(r=>ids.has(r.id)).map(r=>r.id),missing:expected.filter(r=>!ids.has(r.id)).map(r=>r.id),extra:[...ids].filter(id=>!expectedIds.has(id))};
}
export function compareCaps(before,after,sets,transition){
 for(const a of [before,after])validateCapArchive(a,sets.find(s=>s.id===a.pqSetId));if(before.id===after.id)throw Error('İki farklı CAP kaydı seçin.');
 const target=sets.find(s=>s.id===after.pqSetId),defs=new Set(target.records.map(r=>r.id)),afterMap=new Map(after.records.map(r=>[r.id,r]));const sameSet=before.pqSetId===after.pqSetId&&before.pqEdition===after.pqEdition;
 const rows=before.records.filter(r=>r.status==='NS').map(r=>{
 let state='open';const next=afterMap.get(r.id);if(!after.scopeAreas.includes(r.area))state='out_of_scope';else if(!sameSet){const m=transition&&before.pqEdition===transition.fromEdition&&after.pqEdition===transition.toEdition?transition.mappings.filter(m=>m.oldIds.includes(r.id)):[];state=!defs.has(r.id)?(m.some(m=>m.mergeTargetIds?.length)?'version_merged':'version_removed'):'version_review'}else if(next?.status==='S')state=after.publicationStatus==='draft'?'draft_closed':'closed_explicit';else if(next?.status==='NA')state='not_applicable';else if(next?.status==='NS')state='open';else if(after.completeness!=='complete')state='missing_partial';else state=after.publicationStatus==='draft'?'draft_closed':'closed_by_absence';
 return {id:r.id,area:r.area,state,before:r.status,after:next?.status||null};});
 return {sameSet,rows,counts:rows.reduce((a,r)=>(a[r.state]=(a[r.state]||0)+1,a),{}),added:after.records.filter(r=>r.status==='NS'&&!before.records.some(b=>b.id===r.id&&b.status==='NS'))};
}
