(() => {
  const X=window.TribeNetCompendiumExpansion;if(!X)return;
  const priorResearch=showResearch;
  showResearch=function(key,push=true){
    priorResearch(key,push);
    const topic=X.topic(key);if(!topic?.sourceStatus)return;
    const title=$('compArticle')?.querySelector('.comp-title-row');
    if(title)title.insertAdjacentHTML('afterend',`<div class="comp-callout warn comp-source-status"><strong>Source status:</strong> ${esc(topic.sourceStatus)}</div>`);
  };
  const priorEntity=showEntity;
  showEntity=function(name,push=true){
    priorEntity(name,push);
    const entity=entityByName(name);if(!entity)return;
    const statuses=[...new Set((entity.researchTopics||[]).map(t=>t.sourceStatus).filter(Boolean))];
    if(!statuses.length)return;
    const card=$('compArticle')?.querySelector('.entity-rule-card');
    if(card)card.insertAdjacentHTML('afterbegin',`<div class="comp-rule-row wide comp-source-status"><span>Research List status</span><div>${statuses.map(esc).join(' · ')}</div></div>`);
  };
})();
