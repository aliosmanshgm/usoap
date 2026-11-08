export function summarize(records){
 const result={total:records.length,S:0,NS:0,NA:0,unknown:0};
 for(const r of records){if(['S','NS','NA'].includes(r.status))result[r.status]++;else result.unknown++}
 result.applicable=result.S+result.NS;result.ei=result.applicable?100*result.S/result.applicable:null;return result;
}
export function editionOf(set){return set?.edition||({'icao-2024-sep-initial':'2024','icao-2020-olf-20251123-definitions':'2020'}[set?.id])||null}
export function validateSnapshot(x,set){
 if(!set||!x)throw Error('Ülke durum dosyası veya PQ seti eksik.');
 const scope=x.scopeAreas;
 if(scope!==undefined&&(!Array.isArray(scope)||!scope.length||new Set(scope).size!==scope.length||scope.some(a=>!set.records.some(r=>r.area===a))))throw Error('Geçerli ve tekil kapsam alanları gerekli.');
 const expected=scope?set.records.filter(r=>scope.includes(r.area)):set.records;

 if(!editionOf(set)||typeof x.pqEdition!=='string'||!x||x.schemaVersion!==1||x.recordType!=='state_snapshot'||!/^[-\w.]{1,100}$/.test(x.id)||typeof x.label!=='string'||!x.label.trim()||x.label.length>150||x.country!=='TUR'||x.pqSetId!==set.id||x.pqEdition!==editionOf(set)||!Array.isArray(x.records)||x.records.length!==expected.length)throw Error('Ülke durum dosyası seçilen PQ setiyle uyuşmuyor.');
 if(!x.source||!/^\d{4}-\d{2}-\d{2}$/.test(x.source.sourceDate)||typeof x.source.filename!=='string'||!x.source.filename||!/^[a-f0-9]{64}$/.test(x.source.sha256))throw Error('Kaynak tarihi, dosya adı veya SHA-256 eksik.');
 const definitions=new Map(expected.map(r=>[r.id,r])),seen=new Set();
 for(const r of x.records){if(!r||seen.has(r.id)||!definitions.has(r.id)||r.area!==definitions.get(r.id).area||!['S','NS','NA','UNKNOWN'].includes(r.status))throw Error('Geçersiz, yinelenen veya sete ait olmayan ülke kaydı: '+r?.id);seen.add(r.id)}
 if(x.activityType!==undefined&&!['CMAA','PQ_MIGRATION','OSVA','ICVM','STATE_SNAPSHOT'].includes(x.activityType))throw Error('Faaliyet türü geçersiz.');
 if(x.activityPeriod!==undefined&&x.activityPeriod!==null&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(x.activityPeriod))throw Error('Faaliyet dönemi geçersiz.');
 if(x.activityDate){if(!/^\d{4}-\d{2}-\d{2}$/.test(x.activityDate)||!Number.isFinite(Date.parse(x.activityDate+'T00:00:00Z'))||new Date(x.activityDate+'T00:00:00Z').toISOString().slice(0,10)!==x.activityDate||(x.activityPeriod&&x.activityDate.slice(0,7)!==x.activityPeriod))throw Error('Faaliyet tarihi veya dönemi geçersiz.');}
 return x;
}
export function removalEffect(snapshot,transition){
 if(snapshot.pqEdition!==transition.fromEdition)throw Error('Geçiş sürümü ülke görüntüsüyle uyuşmuyor.');
 const ids=new Set(transition.mappings.filter(m=>m.flags.includes('deleted')).flatMap(m=>m.oldIds));
 const removed=snapshot.records.filter(r=>ids.has(r.id)),retained=snapshot.records.filter(r=>!ids.has(r.id));
 const before=summarize(snapshot.records),after=summarize(retained);
 return {before,removed:summarize(removed),after,delta:before.ei===null||after.ei===null?null:after.ei-before.ei,records:removed.map(r=>({...r,mappings:transition.mappings.filter(m=>m.oldIds.includes(r.id))}))};
}
