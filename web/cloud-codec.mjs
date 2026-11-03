export function encodeSet(set){
 const text=JSON.stringify(set),chunks=[];
 // UTF-8 başına en çok 4 byte; her parça Firestore belge sınırının altında kalır.
 for(let i=0;i<text.length;i+=30000)chunks.push(text.slice(i,i+30000));
 if(chunks.length>200)throw Error('PQ seti bulut kayıt sınırını aşıyor.');
 return {text,chunks};
}
export async function digest(text){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('')}
export async function decodeSet(meta,chunks){
 if(!Number.isInteger(meta.chunkCount)||meta.chunkCount<1||meta.chunkCount>200||chunks.length!==meta.chunkCount)throw Error('Eksik veya geçersiz bulut parçaları.');
 chunks.sort((a,b)=>a.index-b.index);
 if(chunks.some((c,i)=>c.index!==i||typeof c.payload!=='string'))throw Error('Bulut parça sırası geçersiz.');
 const text=chunks.map(c=>c.payload).join('');if(await digest(text)!==meta.hash)throw Error('Bulut setinin bütünlük doğrulaması başarısız.');
 const set=JSON.parse(text);if(set.id!==meta.id||set.label!==meta.label||set.records.length!==meta.recordCount)throw Error('Bulut seti ve üst bilgileri uyuşmuyor.');return set;
}
