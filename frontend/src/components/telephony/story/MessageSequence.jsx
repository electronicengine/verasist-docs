import {useEffect,useMemo,useState} from 'react';
import {sequenceModel,sequenceSource} from './sequenceDiagram';
import {localizePhase} from './english';
let modulePromise,renderQueue=Promise.resolve(),nextId=0;
const loadMermaid=()=>modulePromise||(modulePromise=import('mermaid').then(module=>module.default));

export default function MessageSequence({scenario,step,onStepChange,lang,theme}) {
 const en=lang==='en',[scope,setScope]=useState('step'),[result,setResult]=useState(null);
 const model=useMemo(()=>sequenceModel(scenario,lang,scope==='all'?null:step),[scenario,lang,scope,step]);
 const source=useMemo(()=>sequenceSource(model,lang,step),[model,lang,step]);
 const renderKey=theme+'\n'+source;
 useEffect(()=>{
  let cancelled=false;
  const job=async()=>{
   if(cancelled)return;
   const id='story-sequence-'+(++nextId);
   try{
    const mermaid=await loadMermaid();if(cancelled)return;
    const dark=theme==='dark',fontFamily=getComputedStyle(document.body).fontFamily;
    mermaid.initialize({startOnLoad:false,securityLevel:'strict',theme:'base',fontFamily,
     sequence:{useMaxWidth:false,wrap:true,actorMargin:35,width:150,height:65,messageMargin:28,noteMargin:18,diagramMarginX:20,diagramMarginY:15},
     themeVariables:{fontFamily,fontSize:'13px',darkMode:dark,background:dark?'#17202f':'#ffffff',primaryColor:dark?'#25334b':'#edf2fb',primaryTextColor:dark?'#e8eef8':'#1c2a42',primaryBorderColor:dark?'#7186ac':'#8fa5ce',lineColor:dark?'#9aabc5':'#607594',actorBkg:dark?'#25334b':'#edf2fb',actorBorder:dark?'#7186ac':'#8fa5ce',actorTextColor:dark?'#e8eef8':'#1c2a42',actorLineColor:dark?'#7186ac':'#8fa5ce',signalColor:dark?'#b4c8ed':'#355c9f',signalTextColor:dark?'#e8eef8':'#1c2a42',labelBoxBkgColor:dark?'#25334b':'#edf2fb',labelBoxBorderColor:dark?'#7186ac':'#8fa5ce',labelTextColor:dark?'#e8eef8':'#1c2a42',loopTextColor:dark?'#e8eef8':'#1c2a42',noteBkgColor:dark?'#29374c':'#f0f4fc',noteTextColor:dark?'#e8eef8':'#1c2a42',noteBorderColor:dark?'#667c9f':'#a4b4ce'}});
    const {svg}=await mermaid.render(id,source);
    if(!cancelled)setResult({key:renderKey,svg});
   }catch(error){document.getElementById('d'+id)?.remove();if(!cancelled)setResult({key:renderKey,error:true});}
  };
  renderQueue=renderQueue.catch(()=>{}).then(job);
  return ()=>{cancelled=true;};
 },[source,theme,renderKey]);
 const current=result?.key===renderKey?result:null;
 return <section className="story-sequence" data-testid="message-sequence" data-scope={scope} data-step={step}>
  <div className="story-sequence-controls">
   <label>{en?'Diagram scope':'Diyagram kapsamı'}<select aria-label={en?'Diagram scope':'Diyagram kapsamı'} value={scope} onChange={event=>setScope(event.target.value)}><option value="step">{en?'Through selected step':'Seçili adıma kadar'}</option><option value="all">{en?'Entire scenario':'Tüm akış'}</option></select></label>
   <label>{en?'Animation step':'Animasyon adımı'}<select aria-label={en?'Animation step':'Animasyon adımı'} value={step} onChange={event=>onStepChange(Number(event.target.value))}>{scenario.phases.map((phase,i)=><option key={i} value={i}>{i+1}. {localizePhase(phase,scenario,lang).title}</option>)}</select></label>
  </div>
  <p className="story-sequence-hint">{en?'All messages through the selected step are shown. Arrow numbers show message order. Control and continuing audio in the same step are parallel branches. Scroll the diagram horizontally and vertically.':'Seçili adıma kadar tüm mesajlar gösterilir. Ok numaraları mesaj sırasıdır. Aynı adımdaki kontrol ve süren ses paralel dallardır. Diyagramı yatay ve dikey kaydırabilirsiniz.'}</p>
  <div className="story-sequence-viewport" role="region" aria-label={en?'Scrollable Mermaid message diagram':'Kaydırılabilir Mermaid mesaj diyagramı'} tabIndex={0} aria-busy={!current}>
   {!current?<p role="status">{en?'Drawing message sequence…':'Mesaj akışı çiziliyor…'}</p>:current.error?<div role="alert"><p>{en?'The diagram could not be drawn. Mermaid source is available below.':'Diyagram çizilemedi. Mermaid kaynağını aşağıdan inceleyebilirsiniz.'}</p><pre>{source}</pre></div>:<div data-testid="sequence-svg" dangerouslySetInnerHTML={{__html:current.svg}}/>}
  </div>
  <p className="story-sequence-note">{scenario.id==='mechanism'?(en?'Organization/configuration arrows carry context; they are not raw audio paths. STT/LLM text and synthesized speech remain separate.':'Organizasyon/yapılandırma okları bağlam taşır; ham ses yolu değildir. STT/LLM metni ve üretilen ses ayrı gösterilir.'):(en?'Switches/routers forward network traffic; they do not generate SIP replies. Each PBX/operator call leg has its own SIP dialog. Voice arrows show the transport path, not a new RTP session at every hop.':'Switch/router ağ trafiğini iletir; SIP yanıtı üretmez. Santral/operatörün her çağrı bacağı ayrı SIP diyaloğudur. Ses okları taşıma yolunu gösterir; her ağ geçişi yeni RTP oturumu değildir.')}</p>
  <details className="story-sequence-source"><summary>{en?'Mermaid source':'Mermaid kaynağı'}</summary><pre>{source}</pre></details>
 </section>;
}
