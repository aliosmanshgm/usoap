import {readDocxZip,cellText,sha256,AREAS} from './docx-import.mjs';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const clean=s=>String(s??'').replace(/\\n/g,'\n').replace(/\u00a0/g,' ').trim();
const norm=s=>clean(s).replace(/\s+/g,' ').toLowerCase();
function status(s){const n=norm(s);if(['not satisfactory','ns'].includes(n))return 'NS';if(['satisfactory','s'].includes(n))return 'S';if(['not applicable','n/a','na'].includes(n))return 'NA';throw Error('CAP PQ durumu tanınmadı: '+s)}
export function parseCapTables(tables,footerText,{filename,hash}){
 const records=[],areas=new Set(),seen=new Set();let capTables=0;
 for(let ti=0;ti<tables.length;ti++){
  const rows=tables[ti];const hi=rows.findIndex(r=>r.some(c=>norm(c)==='pq')&&r.some(c=>norm(c)==='status')&&r.some(c=>norm(c).includes('protocol finding')));if(hi<0)continue;capTables++;
  const h=rows[hi].map(norm),pi=h.indexOf('pq'),si=h.indexOf('status'),ci=h.indexOf('ce'),ri=h.findIndex(c=>c.includes('icao')),ssc=h.indexOf('ssc');
  if([pi,si,ci,ri,ssc].some(i=>i<0))throw Error('CAP başlık sütunları eksik: tablo '+(ti+1));
  const candidates=rows.map((r,i)=>({r,i})).filter(({r,i})=>i>hi&&/^\s*\d\.\d{3}(?!\d)/.test(r[pi]||''));
  if(candidates.length!==1)throw Error('CAP tablosunda tek PQ bekleniyor: '+(ti+1));const {r,i}=candidates[0],match=clean(r[pi]).match(/^(\d\.\d{3})([\s\S]*)$/),id=match[1],area=AREAS[Number(id[0])-1];
  if(!area||area==='SSP'||seen.has(id))throw Error('Geçersiz veya yinelenen CAP PQ: '+id);seen.add(id);areas.add(area);
  const declared=rows.slice(0,hi).flat().map(norm).find(s=>AREAS.map(a=>a.toLowerCase()).includes(s));if(declared&&declared!==area.toLowerCase())throw Error('CAP alanı ve PQ numarası uyuşmuyor: '+id);
  if(r.length!==7)throw Error('Bulgu satırında beklenmeyen sütun sayısı: '+id);
  const stepHeader=rows.findIndex((r,j)=>j>i&&r.some(c=>norm(c)==='step')&&r.some(c=>norm(c).includes('corrective action')));
  if(stepHeader<0)throw Error('CAP adım başlığı bulunamadı: '+id);
  const guidance=rows.slice(i+1,stepHeader).flat().filter(c=>norm(c).startsWith('guidance for review of evidence')).join('\n').replace(/^\s*Guidance for review of evidence\s*:\s*/i,'');
  const steps=[],emptySlots=[];
  for(let j=stepHeader+1;j<rows.length;j++){
   const c=rows[j].map(clean);if(!/^\d+$/.test(c[0]||''))continue;if(c.length!==8)throw Error('CAP adımında beklenmeyen sütun sayısı: '+id+' / '+c[0]);
   const number=Number(c[0]);if(steps.some(s=>s.number===number)||emptySlots.some(s=>s.number===number))throw Error('Yinelenen CAP adımı: '+id+' / '+number);
   const step={number,action:c[1],offices:c[2],evidence:c[3],estimatedDate:c[4],revisedDate:c[5],completionDate:c[6],progress:c[7],sourceRow:j+1};
   if(!c.slice(1,7).some(Boolean)&&['','not started'].includes(norm(c[7])))emptySlots.push(step);else steps.push(step);
  }
  records.push({id,area,status:status(r[si]),statusText:clean(r[si]),classification:clean(r[ci]),sscText:clean(r[ssc]),question:clean(match[2]),references:clean(r[ri]),description:clean(r[5]),progressDocumented:clean(r[6]),guidance,steps,emptySlots,sourceTable:ti+1,sourceRow:i+1});
 }
 if(!capTables)throw Error('CAP bulgu tablosu bulunamadı. PQ Word belgesi yerine CAP .docx dosyası seçin.');
 if(areas.size!==1)throw Error('Her CAP dosyasında tek denetim alanı bekleniyor.');
 const dates=[...String(footerText).matchAll(/Export\s*Date\s*:\s*(\d{2})\/(\d{2})\/(\d{4})/gi)].map(m=>m[3]+'-'+m[2]+'-'+m[1]);const unique=[...new Set(dates)];if(unique.length>1)throw Error('Belgenin alt bilgilerindeki dışa aktarma tarihleri farklı.');
 return {area:[...areas][0],records,source:{area:[...areas][0],filename,sha256:hash,exportDate:unique[0]||null,dateBasis:unique.length?'document_footer':'not_found',findingCount:records.length,stepCount:records.reduce((n,r)=>n+r.steps.length,0),emptySlotCount:records.reduce((n,r)=>n+r.emptySlots.length,0)}};
}
export async function parseCapDocx(file){
 if(!/\.docx$/i.test(file.name))throw Error('Yalnızca .docx CAP belgeleri destekleniyor.');
 const bytes=new Uint8Array(await file.arrayBuffer()),xmls=await readDocxZip(bytes),parse=text=>{if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('DTD/ENTITY desteklenmiyor.');const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)throw Error('CAP Word XML yapısı bozuk.');return doc},doc=parse(xmls.get('word/document.xml'));
 const ancestor=(n,name)=>{for(let p=n.parentNode;p;p=p.parentNode)if(p.namespaceURI===W&&p.localName===name)return p;return null};
 const tables=[...doc.getElementsByTagNameNS(W,'tbl')].filter(t=>!ancestor(t,'tbl')).map(t=>[...t.getElementsByTagNameNS(W,'tr')].filter(r=>ancestor(r,'tbl')===t).map(r=>[...r.getElementsByTagNameNS(W,'tc')].filter(c=>ancestor(c,'tr')===r).map(cellText)));
 const footer=[...xmls].filter(([name])=>/^word\/footer\d+\.xml$/.test(name)).map(([,text])=>cellText(parse(text).documentElement)).join('\n');
 return parseCapTables(tables,footer,{filename:file.name,hash:await sha256(bytes)});
}
