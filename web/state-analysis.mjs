export function summarize(records){
 const result={total:records.length,S:0,NS:0,NA:0,unknown:0};
 for(const r of records){if(['S','NS','NA'].includes(r.status))result[r.status]++;else result.unknown++}
 result.applicable=result.S+result.NS;result.ei=result.applicable?100*result.S/result.applicable:null;return result;
}
export function validateSnapshot(x,set){
 if(!x||x.schemaVersion!==1||x.recordType!=='state_snapshot'||!/^[-\w.]{1,100}$/.test(x.id)||typeof x.label!=='string'||!x.label.trim()||x.label.length>150||x.country!=='TUR'||x.pqSetId!==set.id||x.pqEdition!==set.edition||!Array.isArray(x.records)||x.records.length!==set.records.length)throw Error('Ülke durum dosyası seçilen PQ setiyle uyuşmuyor.');
 if(!x.source||!/^\d{4}-\d{2}-\d{2}$/.test(x.source.sourceDate)||typeof x.source.filename!=='string'||!x.source.filename||!/^[a-f0-9]{64}$/.test(x.source.sha256))throw Error('Kaynak tarihi, dosya adı veya SHA-256 eksik.');
 const definitions=new Map(set.records.map(r=>[r.id,r])),seen=new Set();
 for(const r of x.records){if(!r||seen.has(r.id)||!definitions.has(r.id)||r.area!==definitions.get(r.id).area||!['S','NS','NA','UNKNOWN'].includes(r.status))throw Error('Geçersiz, yinelenen veya sete ait olmayan ülke kaydı: '+r?.id);seen.add(r.id)}
 return x;
}
export function removalEffect(snapshot,transition){
 if(snapshot.pqEdition!==transition.fromEdition)throw Error('Geçiş sürümü ülke görüntüsüyle uyuşmuyor.');
 const ids=new Set(transition.mappings.filter(m=>m.flags.includes('deleted')).flatMap(m=>m.oldIds));
 const removed=snapshot.records.filter(r=>ids.has(r.id)),retained=snapshot.records.filter(r=>!ids.has(r.id));
 const before=summarize(snapshot.records),after=summarize(retained);
 return {before,removed:summarize(removed),after,delta:before.ei===null||after.ei===null?null:after.ei-before.ei,records:removed.map(r=>({...r,mappings:transition.mappings.filter(m=>m.oldIds.includes(r.id))}))};
}
