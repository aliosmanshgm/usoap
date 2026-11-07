import {summarize,validateSnapshot,removalEffect} from './state-analysis.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=x=>x===null?'—':x.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+'%';
export function buildDashboard(snapshot,set,transition,area=''){
 validateSnapshot(snapshot,set);
 const definitions=new Map(set.records.map(r=>[r.id,r]));
 const records=snapshot.records.filter(r=>!area||r.area===area);
 const groups=(key,list)=>[...new Set(list.map(key))].sort().map(label=>({label,...summarize(list.filter(r=>key(r)===label))}));
 return {summary:summarize(records),areas:groups(r=>r.area,snapshot.records),ces:groups(r=>definitions.get(r.id).classification,records),records,scenario:transition&&snapshot.pqEdition===transition.fromEdition?removalEffect({...snapshot,records},transition):null};
}
export function initDashboard({getSets,onOpenRecords}){
 const host=document.querySelector('#dashboard');let snapshot=null,transition=null,area='';
 function render(){
 host.innerHTML=`<div class="panel"><div class="dash-heading"><div><h2>EI ve ülke sonuçları</h2><p>Seçilen durum görüntüsüne göre genel, alan ve CE bazında sonuçlar.</p></div><button id="dashboardLoad" class="primary">Durum kaydını aç</button></div><div id="dashboardBody"></div></div>`;
 host.querySelector('#dashboardLoad').onclick=onOpenRecords;
 const body=host.querySelector('#dashboardBody');
 if(!snapshot){body.innerHTML='<div class="notice">Henüz ülke durum kaydı açılmadı. “Durum kaydını aç” ile Sürüm Yönetimi’ne gidin; Eylül 2024 kapanış dosyasını seçin veya Firebase kayıtlarını getirin. Ardından Dashboard menüsüne dönün.</div>';return}
 const set=getSets().find(s=>s.id===snapshot.pqSetId);
 if(!set){body.textContent='Bu durum kaydının PQ seti açık değil. Önce ilgili seti açın.';return}
 let model;try{model=buildDashboard(snapshot,set,transition,area)}catch(e){body.textContent='Dashboard hesaplanamadı: '+e.message;return}
 const s=model.summary;
 body.innerHTML=`<p class="dash-record"><b>${esc(snapshot.label)}</b><br>Denetim dönemi: ${esc(snapshot.activityPeriod||'Tanımlı değil')} · PQ sürümü: ${esc(snapshot.pqEdition)}<br>Kaynak dosya tarihi: ${esc(snapshot.source.sourceDate)} · ${snapshot.recordRole==='audit_closing'?'Denetim kapanış kaydı':'Durum görüntüsü'}</p><label>Hesap kapsamı <select id="dashboardArea"><option value="">Tüm denetim alanları</option>${model.areas.map(r=>`<option value="${esc(r.label)}" ${r.label===area?'selected':''}>${esc(r.label)}</option>`).join('')}</select></label><div class="dash-stats">${[['Hesaplanan EI',pct(s.ei),s.S+' / '+s.applicable+' uygulanabilir PQ'],['NS durumundaki PQ',s.NS,'Seçilen kapsamdaki NS kayıtları'],['S durumundaki PQ',s.S,'Seçilen kapsamdaki S kayıtları'],['NA / belirsiz',s.NA+' / '+s.unknown,s.total+' toplam PQ']].map(([label,value,detail])=>`<div class="stat"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(detail)}</small></div>`).join('')}</div><p>EI = S / (S + NS) × 100. Genel EI, alan oranlarının ortalaması alınarak hesaplanmaz. NA ve belirsiz durumlar paydaya dahil edilmez.</p><h3>Alan bazında EI</h3><div class="dash-bars">${model.areas.map(r=>`<div class="dash-bar-row"><b>${esc(r.label)}</b><div class="dash-track" role="img" aria-label="${esc(r.label+' EI '+pct(r.ei))}"><span style="width:${r.ei===null?0:Math.max(0,Math.min(100,r.ei))}%"></span></div><span>${pct(r.ei)}</span><small>${r.S} S / ${r.NS} NS</small></div>`).join('')}</div><h3>CE bazında sonuçlar · ${esc(area||'tüm alanlar')}</h3><div class="table-wrap"><table><thead><tr><th>CE</th><th>TOPLAM</th><th>S</th><th>NS</th><th>NA</th><th>BELİRSİZ</th><th>EI</th></tr></thead><tbody>${model.ces.map(r=>`<tr><td>${esc(r.label)}</td><td>${r.total}</td><td>${r.S}</td><td>${r.NS}</td><td>${r.NA}</td><td>${r.unknown}</td><td>${pct(r.ei)}</td></tr>`).join('')}</tbody></table></div><div id="dashboardScenario"></div><details><summary>NS durumundaki PQ’lar · ${esc(area||'tüm alanlar')} (${s.NS})</summary><div class="table-wrap"><table><thead><tr><th>PQ</th><th>ALAN</th><th>CE</th><th>PROTOKOL SORUSU</th></tr></thead><tbody>${model.records.filter(r=>r.status==='NS').map(r=>{const d=set.records.find(x=>x.id===r.id);return `<tr><td>${esc(r.id)}</td><td>${esc(r.area)}</td><td>${esc(d.classification)}</td><td class="dash-question">${esc(d.question)}</td></tr>`}).join('')||'<tr><td colspan="4">Bu kapsamda NS kaydı yok.</td></tr>'}</tbody></table></div></details>`;
 const scenario=host.querySelector('#dashboardScenario');
 if(model.scenario){const e=model.scenario;scenario.innerHTML=`<section class="dash-scenario"><h3>PQ sürümünün etkisi · yalnızca silme senaryosu</h3><p><b>${pct(e.before.ei)} → ${pct(e.after.ei)}</b> · ${e.delta===null?'Fark hesaplanamaz':(e.delta>0?'+':'')+e.delta.toLocaleString('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2})+' yüzde puan'} · ${esc(area||'tüm alanlar')}</p><p>Eski setten çıkarılan: ${e.removed.NS} NS, ${e.removed.S} S, ${e.removed.NA} NA. Diğer durumlar sabit tutulur. Bu bir hesap senaryosudur; bulgu giderimi veya doğrulanmış 2024 sonrası EI sonucu olarak gösterilmez.</p></section>`}
 else scenario.innerHTML='<p class="muted">Bu PQ sürümü için silme etkisi senaryosu tanımlı değil.</p>';
 host.querySelector('#dashboardArea').onchange=e=>{area=e.target.value;render()};
 }
 render();return {update(next,nextTransition){if(snapshot?.id!==next?.id)area='';snapshot=next;transition=nextTransition;render()}};
}
