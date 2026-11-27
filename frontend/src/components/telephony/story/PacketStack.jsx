import {useId, useMemo, useState} from 'react';
import {ChevronDown, Layers, Info} from 'lucide-react';
import {buildPacketModel} from './packetModel';
import {pc, explainField} from './packetFields';
import './PacketStack.css';
export default function PacketStack({detail,phase,lang}) {
  const model=useMemo(()=>buildPacketModel(detail,phase,lang),[detail,phase,lang]);
  const [expanded,setExpanded]=useState(null),id=useId();
  return <section className="packet-stack" data-testid="packet-stack" data-kind={model.kind} aria-label={pc('title',lang)}>
    <div className="packet-stack-intro"><Layers size={18} aria-hidden="true"/><p>{pc('hint',lang)}</p></div>
    <div className="packet-stack-layers">{model.layers.map((layer,index)=><section className="packet-layer" data-tone={layer.tone} data-layer={layer.id} key={layer.id}>
      <header className="packet-layer-header"><span className="packet-layer-index">{index+1}</span><h4>{layer.title}</h4><span className="packet-layer-count">{layer.fields.length}</span></header>
      <div className="packet-layer-fields">{layer.fields.map((field,i)=>{
        const key=layer.id+'-'+i,open=expanded===key,panel=id+'-'+key;
        return <div className="packet-field" data-field={field.name} key={key} data-open={open}>
          <button type="button" className="packet-field-button" aria-expanded={open} aria-controls={panel} onClick={()=>setExpanded(open?null:key)}>
            <span className="packet-field-name">{field.name}{field.separator===''?'':':'}</span>{' '}<code>{field.value}</code>
            <span className="packet-field-action">{field.bits && <span>{field.bits}</span>}<ChevronDown size={14} aria-hidden="true"/></span>
          </button>
          {open && <div className="packet-field-explanation" id={panel} role="region" aria-label={`${field.name} — ${pc('purpose',lang)}`}>
            <strong><Info size={13} aria-hidden="true"/>{pc('purpose',lang)}</strong><p>{explainField(field,lang)}</p>
            {(field.reference || layer.reference) && <a href={field.reference || layer.reference} target="_blank" rel="noreferrer">{pc('reference',lang)}</a>}
          </div>}
        </div>;
      })}</div>
    </section>)}</div>
    {model.empty && <div className="packet-empty"><strong>{pc('empty',lang)}</strong><p>{pc('emptyText',lang)}</p></div>}
    {model.notes?.map((note,i)=><p className="packet-stack-scope" key={i}>{note}</p>)}
    <p className="packet-stack-scope">{pc('scope',lang)}</p>
  </section>;
}
