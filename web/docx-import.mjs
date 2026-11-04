// Browser-local OOXML reader. Does not send the original Word document anywhere.
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
export const AREAS=['LEG','ORG','PEL','OPS','AIR','AIG','ANS','AGA','SSP'];
const MAX_FILE=20*1024*1024,MAX_XML=24*1024*1024,MAX_TOTAL=64*1024*1024;
function fail(message){throw Error(message)}
const crcTable=Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return (n^0xffffffff)>>>0}
export async function sha256(input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
 if(globalThis.crypto?.subtle)return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],data=new Uint8Array(Math.ceil((bytes.length+9)/64)*64);data.set(bytes);data[bytes.length]=128;const view=new DataView(data.buffer);view.setUint32(data.length-8,Math.floor(bytes.length/0x20000000));view.setUint32(data.length-4,(bytes.length*8)>>>0);const w=new Uint32Array(64),rotr=(x,n)=>(x>>>n)|(x<<(32-n));
 for(let offset=0;offset<data.length;offset+=64){for(let i=0;i<16;i++)w[i]=view.getUint32(offset+4*i);for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(rotr(x,7)^rotr(x,18)^(x>>>3))+w[i-7]+(rotr(y,17)^rotr(y,19)^(y>>>10)))>>>0}let [a,b,c,d,e,f,g,j]=h;for(let i=0;i<64;i++){const t1=(j+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;j=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0}for(const [i,v] of [a,b,c,d,e,f,g,j].entries())h[i]=(h[i]+v)>>>0;}
 return h.map(x=>x.toString(16).padStart(8,'0')).join('');
}
export async function readDocxZip(input){
 const bytes=input instanceof Uint8Array?input:new Uint8Array(input);if(bytes.length>MAX_FILE)fail('Word dosyası 20 MB sınırını aşıyor.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);const u16=i=>v.getUint16(i,true),u32=i=>v.getUint32(i,true);
 let end=-1;for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(u32(i)===0x06054b50&&i+22+u16(i+20)===bytes.length){end=i;break}}
 if(end<0)fail('Geçerli bir DOCX arşivi okunamadı. Eski .doc biçimi desteklenmiyor.');
 if(u16(end+4)||u16(end+6)||u16(end+8)!==u16(end+10))fail('Çok parçalı Word arşivi desteklenmiyor.');
 const count=u16(end+10),start=u32(end+16),length=u32(end+12);if(count===65535||start===0xffffffff||length===0xffffffff)fail('ZIP64 Word arşivi desteklenmiyor.');
 if(count>5000||start+length!==end)fail('Word arşiv dizini geçersiz veya sınırı aşıyor.');
 let pos=start,total=0;const entries=new Map(),decoder=new TextDecoder();
 for(let i=0;i<count;i++){
  if(pos+46>end||u32(pos)!==0x02014b50)fail('Word arşiv dizini bozuk.');
  const flags=u16(pos+8),method=u16(pos+10),crc=u32(pos+16),packed=u32(pos+20),size=u32(pos+24),nl=u16(pos+28),extra=u16(pos+30),comment=u16(pos+32),offset=u32(pos+42);
  if(pos+46+nl+extra+comment>end)fail('Word arşiv girdisi eksik.');
  const name=decoder.decode(bytes.subarray(pos+46,pos+46+nl));pos+=46+nl+extra+comment;
  if(entries.has(name))fail('Word arşivinde yinelenen dosya: '+name);
  if(flags&1)fail('Parolalı Word belgesi desteklenmiyor.');
  if(size===0xffffffff||packed===0xffffffff||offset===0xffffffff)fail('ZIP64 girdisi desteklenmiyor.');
  entries.set(name,{flags,method,crc,packed,size,offset});
 }
 if(pos!==end||!entries.has('word/document.xml'))fail('Bu dosya bir DOCX Word belgesi değil.');
 const output=new Map();
 for(const [name,e] of entries){
  if(name!=='word/document.xml'&&!/^word\/footer\d+\.xml$/.test(name))continue;
  if(e.size>MAX_XML||(total+=e.size)>MAX_TOTAL)fail('Word XML içeriği okuma sınırını aşıyor.');
  if(e.offset+30>start||u32(e.offset)!==0x04034b50||u16(e.offset+8)!==e.method)fail('Word arşiv başlığı geçersiz.');
  const p=e.offset+30+u16(e.offset+26)+u16(e.offset+28);if(p+e.packed>start)fail('Word arşiv içeriği eksik.');
  const compressed=bytes.subarray(p,p+e.packed);let plain;
  if(e.method===0)plain=compressed;
  else if(e.method===8){
   let stream;try{stream=new DecompressionStream('deflate-raw')}catch{fail('Tarayıcı Word açmayı desteklemiyor. Güncel Chrome, Edge veya Safari kullanın.');}
   const reader=new Blob([compressed]).stream().pipeThrough(stream).getReader(),parts=[];let length=0;
   for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>e.size||length>MAX_XML){await reader.cancel();fail('Word içeriği beyan edilen boyutu aşıyor.');}parts.push(value)}
   plain=new Uint8Array(length);let p=0;for(const part of parts){plain.set(part,p);p+=part.length}
  }else fail('Desteklenmeyen Word sıkıştırması.');
  if(plain.length!==e.size||crc32(plain)!==e.crc)fail('Word belgesinin bütünlük kontrolü başarısız: '+name);
  output.set(name,new TextDecoder('utf-8',{fatal:true}).decode(plain));
 }
 return output;
}
function local(n,name){return n?.namespaceURI===W&&n.localName===name}
function nodes(n,name){return [...n.getElementsByTagNameNS(W,name)]}
function ancestor(n,name){for(let p=n.parentNode;p;p=p.parentNode)if(local(p,name))return p;return null}
function underTextBox(n){return !!ancestor(n,'txbxContent')}
export function cellText(cell){
 const paragraphs=nodes(cell,'p').filter(p=>!underTextBox(p));
 return paragraphs.map(p=>{let text='';const walk=n=>{if(local(n,'txbxContent')||local(n,'del'))return;if(local(n,'t')){text+=n.textContent;return}if(local(n,'br')){if(!n.getAttributeNS(W,'type')||n.getAttributeNS(W,'type')==='textWrapping')text+='\n';return}if(local(n,'cr')){text+='\n';return}if(local(n,'tab')){text+='\t';return}for(const c of n.childNodes||[])walk(c)};walk(p);return text}).join('\n').trim();
}
function parseXml(text){if(/<!DOCTYPE|<!ENTITY/i.test(text))fail('DTD/ENTITY içeren Word XML dosyası desteklenmiyor.');const d=new DOMParser().parseFromString(text,'application/xml');if(d.getElementsByTagName('parsererror').length)fail('Word XML yapısı okunamıyor.');return d}
function rows(t){return nodes(t,'tr').filter(r=>ancestor(r,'tbl')===t)}
function cells(r){return nodes(r,'tc').filter(c=>ancestor(c,'tr')===r)}
const header=s=>s.toLowerCase().replace(/\s+/g,' ').trim();
export async function parseDocx(file){
 if(!/\.docx$/i.test(file.name))fail('Yalnızca .docx dosyası seçin: '+file.name);if(file.size>MAX_FILE)fail('Word dosyası 20 MB sınırını aşıyor.');
 const bytes=new Uint8Array(await file.arrayBuffer()),xmls=await readDocxZip(bytes),doc=parseXml(xmls.get('word/document.xml'));
 const tables=nodes(doc,'tbl'),main=tables.filter(t=>{const row=rows(t)[0];if(!row)return false;const h=cells(row).map(c=>header(cellText(c)));return h.some(x=>x.includes('protocol question'))&&h.some(x=>x.includes('guidance for review'))});
 if(main.length!==1)fail('Tek bir ana PQ tablosu bulunmalı. Değişiklik tablosu ana liste yerine kullanılamaz: '+file.name);
 const table=main[0],allRows=rows(table),headers=cells(allRows[0]).map(c=>header(cellText(c)));
 const index={id:headers.findIndex(x=>x.includes('pq no')),question:headers.findIndex(x=>x==='protocol question'),guidance:headers.findIndex(x=>x.includes('guidance for review')),references:headers.findIndex(x=>x.includes('icao references')),ppq:headers.findIndex(x=>x==='ppq'),classification:headers.findIndex(x=>x==='ce'||x.includes('ssp component'))};
 if(Object.values(index).some(i=>i<0)||new Set(Object.values(index)).size!==6)fail('Ana PQ tablosundaki zorunlu sütunlar eksik.');
 const records=[],ids=new Set(),warnings=[];
 allRows.slice(1).forEach((row,i)=>{
  const cs=cells(row),values=cs.map(cellText);if(values.every(x=>!x))return;if(header(values[index.id]||'').includes('pq no'))return;
  if(cs.length!==headers.length)fail('Eksik/birleşmiş tablo hücresi: satır '+(i+2));
  const id=values[index.id];if(!/^[1-9]\.\d{3}$/.test(id))fail('Geçersiz PQ numarası: '+id+' (satır '+(i+2)+')');
  if(ids.has(id))fail('Mükerrer PQ numarası: '+id);ids.add(id);
  const area=AREAS[Number(id[0])-1],q=values[index.question],g=values[index.guidance],c=values[index.classification].replace(/\s+/g,' '),ppq=values[index.ppq].trim();
  if(!q||!g||!c)fail('Soru, rehber veya CE/SSP bilgisi eksik: '+id);
  if(ppq&&!/^(yes|no)$/i.test(ppq))fail('PPQ değeri tanınmıyor: '+id+' · '+ppq);
  if(area==='SSP'?!headers[index.classification].includes('ssp'):!/^CE-[1-8]$/.test(c))fail('CE / SSP bileşeni uyuşmuyor: '+id);
  const ref=values[index.references];if(!ref)warnings.push(id+' için ICAO referansı boş.');
  const shaded=cs.some(tc=>[...tc.children].filter(n=>local(n,'tcPr')).some(pr=>nodes(pr,'shd').some(sh=>{const fill=sh.getAttributeNS(W,'fill').toUpperCase();return fill&&!['AUTO','FFFFFF','NIL'].includes(fill)})));
  const full=nodes(row,'t').map(n=>n.textContent).join(' ');
  records.push({id,area,question:q,guidance:g,references:ref,ppq:/^yes$/i.test(ppq),classification:c,classificationType:area==='SSP'?'SSP':'CE',onSiteOnly:shaded,sourceRow:i+2,temporaryRemoval:/temporarily removed/i.test(full)});
 });
 if(!records.length)fail('Ana tabloda PQ kaydı yok.');const areas=[...new Set(records.map(r=>r.area))];if(areas.length!==1)fail('Bir alan dosyasında birden fazla alanın PQ numarası bulundu.');const area=areas[0];
 const footers=[...xmls].filter(([n])=>n!=='word/document.xml').map(([,text])=>cellText(parseXml(text).documentElement)).join('\n');
 const revisions=[...new Set([...footers.matchAll(/Revision\s*(\d+(?:\.\d+)?)/gi)].map(m=>m[1]))];if(revisions.length>1)fail('Belgenin alt bilgilerinde birden fazla revizyon bulundu: '+revisions.join(', '));
 const dates=[...new Set([...footers.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/gi)].map(m=>m[1]+' '+m[2]))];if(dates.length>1)fail('Belgenin alt bilgilerinde birden fazla tarih var.');
 const codes=[...footers.matchAll(/QMSF-0?07-0?(\d)\/L/gi)].map(m=>AREAS[Number(m[1])-1]);if(codes.some(c=>c!==area))fail('Alt bilgi belge kodu ile PQ alanı uyuşmuyor.');
 if(!dates.length)warnings.push('Belge tarihi alt bilgiden okunamadı; önizlemede girilmeli.');
 if(!revisions.length)warnings.push('Alt bilgide revizyon ibaresi yok; önizlemede doğrulayın.');
 let expected=null;for(const t of tables.filter(t=>t!==table)){for(const row of rows(t)){const v=cells(row).map(cellText);const a=v.findIndex(x=>x.trim()===area);if(a>=0&&/^\d+$/.test(v[a+1]||'')){expected=Number(v[a+1]);break}}if(expected!==null)break}
 if(expected!==null&&expected!==records.length)warnings.push('Girişteki soru sayısı '+expected+', okunan ana tablo '+records.length+' PQ içeriyor. Farkı inceleyin.');
 return {source:{area,filename:file.name,revision:revisions[0]||null,date:dates[0]||'',sha256:await sha256(bytes),count:records.length,footer:footers.slice(0,600)},records,warnings,expected};
}
export function mergeDocuments(base,documents,{id,label,formatRecord=r=>({...r})}={}){
 if(!/^[a-zA-Z0-9_.-]{1,100}$/.test(id||''))fail('Yeni set kimliği geçersiz.');if(!label?.trim()||label.length>150)fail('Yeni set adı 1–150 karakter olmalı.');
 if(!documents.length)fail('Word belgesi seçilmedi.');const areas=new Set();for(const d of documents){if(areas.has(d.source.area))fail('Aynı alan için birden fazla dosya seçildi: '+d.source.area);areas.add(d.source.area);if(!d.source.date.trim())fail(d.source.area+' belge tarihi girilmeli.');}
 const sources=base.sources.filter(s=>!areas.has(s.area)).map(s=>({...s})).concat(documents.map(d=>({...d.source}))).sort((a,b)=>AREAS.indexOf(a.area)-AREAS.indexOf(b.area));
 const records=base.records.filter(r=>!areas.has(r.area)).map(r=>({...r})).concat(documents.flatMap(d=>d.records.map(r=>({...r})))).sort((a,b)=>a.id.localeCompare(b.id,'en',{numeric:true}));
 const set={schemaVersion:1,id,label:label.trim(),sources,records};
 const before=new Map(base.records.map(r=>[r.id,r])),after=new Map(records.map(r=>[r.id,r]));const diff={added:[],removed:[],changed:[],same:[],formatting:[],sourceChanges:[]};
 const fields=['area','question','guidance','references','ppq','classification','classificationType','onSiteOnly','temporaryRemoval'];
 for(const [id,raw] of after){const old=before.get(id);if(!old){diff.added.push(id);continue}const a=formatRecord(old,base),b=formatRecord(raw,set),changed=fields.filter(f=>f==='classification'?a[f].replace(/\s/g,'')!==b[f].replace(/\s/g,''):a[f]!==b[f]);
 if(!changed.length)diff.same.push(id);else if(changed.every(f=>['question','guidance','references'].includes(f)&&a[f].replace(/\s/g,'')===b[f].replace(/\s/g,'')))diff.formatting.push(id);else diff.changed.push({id,fields:changed,before:a,after:b});}
 for(const id of before.keys())if(!after.has(id))diff.removed.push(id);
 for(const d of documents){const old=base.sources.find(s=>s.area===d.source.area),s=d.source;if(!old||['sha256','revision','date','filename'].some(f=>old[f]!==s[f]))diff.sourceChanges.push({area:s.area,before:old||null,after:s})}
 return {set,diff,updatedAreas:[...areas],preservedAreas:base.sources.filter(s=>!areas.has(s.area)).map(s=>s.area)};
}
