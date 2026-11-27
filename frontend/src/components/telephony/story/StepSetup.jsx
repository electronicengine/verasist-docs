import {Settings2, Zap, Wrench} from 'lucide-react';
import {setupHints} from './setupHints';
export default function StepSetup({scenario,phase,lang}) {
  const {mode,items}=setupHints(scenario,phase,lang),en=lang==='en';
  const labels={setup:en?'Prepare beforehand':'Önceden kurulum',automatic:en?'Automatic':'Otomatik',action:en?'User action':'Kullanıcı işlemi',admin:en?'Service admin':'Servis yöneticisi'};
  const Icon=mode==='automatic'?Zap:mode==='admin'?Wrench:Settings2;
  return <section className="story-step-setup" data-testid="step-setup" data-mode={mode} aria-label={en?'Configuration locations':'Yapılandırma yerleri'}>
    <header><Icon size={14} aria-hidden="true"/><h3>{en?'Where is this configured?':'Ayar nerede yapılır?'}</h3><span>{labels[mode]}</span></header>
    {items.map((item,i)=><div className="story-setup-location" key={i}><h4>{item.where}</h4><ul>{item.steps.map((text,j)=><li key={j}>{text}</li>)}</ul></div>)}
    {mode!=='automatic' && <p className="story-setup-note">{en?'Menu names can vary by vendor/version. Use the addresses and credentials assigned to your deployment; example values are illustrative.':'Menü adları marka/sürüme göre değişebilir. Örnek değerler yerine kurulumunuza verilen adres ve hesap bilgilerini kullanın.'}</p>}
  </section>;
}
