import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
export default function TelephonyEmbed() {
  const { theme } = useTheme(), { lang } = useLanguage();
  const frame = useRef(null), initialTheme = useRef(theme), initialLang = useRef(lang);
  const sync = () => frame.current?.contentWindow?.postMessage({ type: 'verasist-docs-theme', theme, lang }, window.location.origin);
  useEffect(() => { frame.current?.contentWindow?.postMessage({ type: 'verasist-docs-theme', theme, lang }, window.location.origin); }, [theme, lang]);
  return <section className="my-8 overflow-hidden rounded-xl border border-border" data-testid="telephony-embed">
    <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3 text-sm"><strong>{lang === 'tr' ? 'Santral ve Verasist · interaktif atölye' : 'PBX & Verasist · interactive workshop'}</strong><Link to="/verasistLAB/pbx" target="_blank" rel="noreferrer" className="shrink-0 text-primary underline" data-testid="telephony-lab-link">{lang === 'tr' ? 'Tam ekran aç' : 'Open fullscreen'}</Link></div>
    <iframe ref={frame} title={lang === 'tr' ? 'Santral ve Verasist kayıt, çağrı ve ses animasyonları' : 'PBX and Verasist registration, call and audio animations'} src={`/verasistLAB/pbx?embed=1&theme=${initialTheme.current}&lang=${initialLang.current}`} onLoad={sync} loading="lazy" allow="fullscreen" allowFullScreen style={{ display: 'block', width: '100%', height: 'clamp(740px, 86vh, 960px)', border: 0 }} />
  </section>;
}
