import {summarize,validateSnapshot} from './state-analysis.mjs';
export const activityTypes={CMAA:'CMAA denetimi',PQ_MIGRATION:'PQ sürüm geçişi',OSVA:'OSVA',ICVM:'ICVM',STATE_SNAPSHOT:'OLF durum görüntüsü'};
const fields=['area','question','guidance','references','ppq','classification','classificationType','onSiteOnly','temporaryRemoval'];
export function periodOf(s){return s.activityDate||s.activityPeriod||null}
export function timeline(snapshots,sets,area=''){
 const ids=new Set();return snapshots.map(s=>{if(ids.has(s.id))throw Error('Yinelenen durum görüntüsü: '+s.id);ids.add(s.id);const set=sets.find(x=>x.id===s.pqSetId);if(!set)throw Error('PQ seti bulunamadı: '+s.pqSetId);validateSnapshot(s,set);const records=s.records.filter(r=>!area||r.area===area);return {snapshot:s,period:periodOf(s),summary:summarize(records),covered:records.length>0,areas:[...new Set(s.records.map(r=>r.area))].sort()}}).sort((a,b)=>{if(!a.period||!b.period)return a.period?-1:b.period?1:a.snapshot.id.localeCompare(b.snapshot.id);return a.period.localeCompare(b.period)||a.snapshot.source.sourceDate.localeCompare(b.snapshot.source.sourceDate)||a.snapshot.id.localeCompare(b.snapshot.id)});
}
export function compareSnapshots(before,after,sets,area='',transition=null){
 if(before.id===after.id)throw Error('İki farklı durum kaydı seçin.');if(before.country!==after.country)throw Error('Ülkeler aynı olmalı.');
 for(const s of [before,after]){const set=sets.find(x=>x.id===s.pqSetId);if(!set)throw Error('PQ seti bulunamadı.');validateSnapshot(s,set)}
 const a=before.records.filter(r=>!area||r.area===area),b=after.records.filter(r=>!area||r.area===area),am=new Map(a.map(r=>[r.id,r])),bm=new Map(b.map(r=>[r.id,r]));
 const common=[...am.keys()].filter(id=>bm.has(id)),added=b.filter(r=>!am.has(r.id)),removed=a.filter(r=>!bm.has(r.id));
 const at=summarize(a),bt=summarize(b),sameSet=before.pqSetId===after.pqSetId&&before.pqEdition===after.pqEdition;
 const observed=sameSet?common.filter(id=>am.get(id).status!==bm.get(id).status).map(id=>({id,area:bm.get(id).area,before:am.get(id).status,after:bm.get(id).status})):[];
 const as=sets.find(x=>x.id===before.pqSetId),bs=sets.find(x=>x.id===after.pqSetId),ad=new Map(as.records.map(r=>[r.id,r])),bd=new Map(bs.records.map(r=>[r.id,r]));
 const changedDefinitions=common.filter(id=>fields.some(f=>ad.get(id)[f]!==bd.get(id)[f]));
 const sourceMappings=transition&&before.pqEdition===transition.fromEdition&&after.pqEdition===transition.toEdition?transition.mappings.filter(m=>m.flags.some(f=>['deleted','merged','new','revised'].includes(f))&&(!area||m.area===area)):[];
 return {before:at,after:bt,delta:at.ei===null||bt.ei===null?null:bt.ei-at.ei,sameSet,sameCoverage:added.length===0&&removed.length===0,commonCount:common.length,added,removed,observed,changedDefinitions,sourceMappings,hasBefore:a.length>0,hasAfter:b.length>0};
}
export function associateActivity(snapshot,set,{type,period,date='',label}){
 validateSnapshot(snapshot,set);
 if(!activityTypes[type]||!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)||typeof label!=='string'||!label.trim()||label.trim().length>150)throw Error('Faaliyet türü, geçerli dönem (YYYY-AA) ve başlık gerekli.');
 if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||date.slice(0,7)!==period))throw Error('Faaliyet tarihi geçerli olmalı ve dönemle aynı ayda bulunmalı.');
 const result={...structuredClone(snapshot),id:'tur-'+type.toLowerCase()+'-'+period+'-'+crypto.randomUUID().slice(0,8),label:label.trim(),activityId:'tur-'+type.toLowerCase()+'-'+period,activityType:type,activityPeriod:period,activityDate:date||null,activityLabel:activityTypes[type]+' · '+period,recordRole:type==='PQ_MIGRATION'?'pq_migration':type==='STATE_SNAPSHOT'?'state_snapshot':'audit_closing',designationBasis:'user_confirmation',designationNote:'Faaliyet bilgisi kullanıcı tarafından tanımlandı. Ülke PQ durumları ve kaynak bilgileri korundu.',derivedFromSnapshotId:snapshot.id};
 return validateSnapshot(result,set);
}
