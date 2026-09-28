(() => {
  const R = window.TribeNetResearchV2;
  if (!R?.notesForSkill) return;
  const q = id => document.getElementById(id);

  const oldShowSkill = showSkill;
  showSkill = function(name,push=true) {
    oldShowSkill(name,push);
    const article=q('compArticle');
    if(!article)return;
    const notes=R.notesForSkill(name);
    if(notes.length){
      const html=`<section class="comp-section compact-section source-gap"><div class="comp-inline-heading"><h2>Research status / source notes</h2><span class="comp-muted">${notes.length}</span></div>${notes.map(n=>`<div class="comp-callout ${n.status==='under-review'?'warn':''}"><strong>${esc(n.status==='under-review'?'Under review':'Source note')}:</strong> ${esc(n.note)} <small>Research List p.${fmtNum(n.page)}</small></div>`).join('')}</section>`;
      article.insertAdjacentHTML('beforeend',html);
    }
    bindLinks(article);
  };

  const oldShowEntity = showEntity;
  showEntity = function(name,push=true) {
    oldShowEntity(name,push);
    const article=q('compArticle');
    if(!article)return;
    const core=entityByName(name);
    const detailed=core ? R.entity(core.name) : R.entity(name);
    if(detailed?.kind==='ship'){
      const head=article.querySelector('.comp-standard-entity .comp-standard-head strong');
      if(head) head.textContent='Ship specification';
    }
  };
})();
