import {TextEncoder} from 'util';
import {scenarioFor, tabs, detailFor, nodeLabel} from './scenarios';
import {localizePhase,localizeTab,localizeDetail,translate} from './english';
global.TextEncoder = TextEncoder;
test('every scenario, destination and registration mode has English step and detail copy',()=>{
  for(const tab of tabs) for(const target of ['201','202','301']) for(const mode of ['phones','pbx']) {
    const story=scenarioFor(tab.id,target,mode);
    expect(localizeTab(tab,'en').title).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/);
    for(const phase of story.phases) {
      const en=localizePhase(phase,story,'en');
      expect(en.title.length).toBeGreaterThan(5);
      expect(en.text.length).toBeGreaterThan(35);
      expect(en.title+en.text+en.message).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/);
      const detail=localizeDetail(detailFor(story,phase),story,phase,'en',id=>translate(nodeLabel(id,story.id),'en'));
      expect(detail.title+detail.route+detail.code+detail.note).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/);
      expect(localizePhase(phase,story,'tr')).toBe(phase);
    }
  }
});
