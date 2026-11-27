import {TextEncoder} from 'util';
import {scenarioFor,tabs} from './scenarios';
import {setupHints} from './setupHints';
global.TextEncoder=TextEncoder;
test('all tabs, targets and registration modes explain configuration locations in both languages',()=>{
  for(const tab of tabs) for(const target of ['201','202','301']) for(const mode of ['phones','pbx']) {
    const story=scenarioFor(tab.id,target,mode);let setupSteps=0;
    for(const phase of story.phases) for(const lang of ['tr','en']) {
      const hint=setupHints(story,phase,lang);
      expect(['setup','automatic','action','admin']).toContain(hint.mode);
      expect(hint.items.length).toBeGreaterThan(0);
      if(hint.mode!=='automatic') setupSteps++;
      for(const item of hint.items) {
        expect(item.where.length).toBeGreaterThan(8);
        expect(item.steps.length).toBeGreaterThan(0);
        expect(item.steps.every(s=>s.length>30)).toBe(true);
        if(lang==='en') expect(item.where+item.steps.join(' ')).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/);
      }
    }
    expect(setupSteps).toBeGreaterThan(2);
  }
});
test('adding Verasist shows operator, Verasist trunk and agent-number settings in their actual locations',()=>{
  const story=scenarioFor('direct');
  const phase=story.phases.find(p=>p.title==='Şimdi Verasist operatör bağlantısına eklenir');
  const hint=setupHints(story,phase,'en'),text=hint.items.flatMap(c=>[c.where,...c.steps]).join(' ');
  expect(text).toContain('Operator portal');expect(text).toContain('SIP Gateway IP');
  expect(text).toContain('Enable Registration');expect(text).toContain('Phone numbers');expect(text).toContain('Inbound workflow');
  expect(text).toContain('Keep the existing office-a-201 phone registration');
  const back=setupHints(story,story.phases[15],'en').items.flatMap(c=>c.steps).join(' ');
  expect(back).toContain('12025550201');expect(back).toContain('loop');
});
test('virtual extension 700 maps to the assigned agent DID and REGISTER direction stays explicit',()=>{
  const extension=scenarioFor('extension'),phase=extension.phases.find(p=>p.title==='700 hedefi Verasist’e yönlendirilir');
  expect(setupHints(extension,phase,'en').items.flatMap(c=>c.steps).join(' ')).toContain('Rewrite local 700 to the agent DID');
  const reg=scenarioFor('registration','201','pbx'),request=reg.phases.find(p=>p.title==='Verasist santrale kayıt isteği gönderir');
  expect(setupHints(reg,request,'en').items.flatMap(c=>c.steps).join(' ')).toContain('REGISTER goes Verasist → PBX');
});
test('automatic SIP replies are distinguished from provisioning and normal PBX calls do not require Verasist setup',()=>{
  const story=scenarioFor('pbx'),answer=story.phases.find(p=>p.message==='200 OK · INVITE cevabı');
  const hint=setupHints(story,answer,'en');expect(hint.mode).toBe('automatic');
  expect(hint.items[0].steps.join(' ')).toContain('No new panel setting');
  expect(story.phases.flatMap(p=>setupHints(story,p,'en').items).flatMap(c=>[c.where,...c.steps]).join(' ')).not.toContain('Verasist');
});
