/*
  ForensicLens progression logic
  - gate practice levels and modules based on quiz/module completion
  - persist small flags in localStorage

  Keys used:
    module1_done, module2_done, module3_done, module4_done ("true")
    practice1_done, practice2_done, practice3_done, practice4_done ("true")
    quiz1_score, quiz1_total, quiz1_pass ("true")
    quiz2_score, quiz2_total, quiz2_pass
    quiz3_score, quiz3_total, quiz3_pass
    quiz4_score, quiz4_total, quiz4_pass
*/
(function(){
  const LS = {
    get(k, d=null){ try{ const v = localStorage.getItem(k); return v===null? d : v; }catch(e){ return d; } },
    set(k, v){ try{ localStorage.setItem(k, v); }catch(e){} },
    bool(k){ return LS.get(k)==='true'; }
  };

  // Utilities
  function pass(score, total){ return Number(score) >= Math.ceil(0.8*Number(total)); }

  // Compute a root-aware path so we can navigate from any nested folder
  function rootPath(){
    try{
      const p = location.pathname || '/';
      const m = p.match(/^(.*?)(?:\/(modules|levels|quiz)(?:\/.*)?)$/);
      if (m && m[1] !== undefined) {
        // e.g., /ForensicLens/modules/module1.html => /ForensicLens
        const base = m[1];
        return base.endsWith('/') ? base : base + '/';
      }
      // Fallback: strip filename to get directory
      return p.replace(/[^/]*$/, '');
    } catch(e){
      return '/';
    }
  }
  function goRoot(pathFromRoot){
    const base = rootPath();
    const rel = String(pathFromRoot || '').replace(/^\//, '');
    try{ window.location.href = base + rel; }catch(e){ window.location.assign(base + rel); }
  }

  // API exposed on window
  const Progress = {
    // Take a snapshot of relevant keys for cloud sync
    snapshot(){
      const keys = [
        'module1_done','module2_done','module3_done','module4_done',
        'practice1_done','practice2_done','practice3_done','practice4_done',
        'quiz1_score','quiz1_total','quiz1_pass',
        'quiz2_score','quiz2_total','quiz2_pass',
        'quiz3_score','quiz3_total','quiz3_pass',
        'quiz4_score','quiz4_total','quiz4_pass'
      ];
      const out = {};
      keys.forEach(k=>{ const v = LS.get(k); if(v!==null && v!==undefined) out[k]=v; });
      return out;
    },
    // Restore a snapshot into localStorage
    restore(data){ if(!data) return; Object.entries(data).forEach(([k,v])=> LS.set(k,v)); },
    // Markers
  markModuleDone(n){ LS.set(`module${n}_done`, 'true'); try{ window.ForensicCloud?.saveProgress(Progress.snapshot()); }catch(e){} },
  markPracticeDone(n){ LS.set(`practice${n}_done`, 'true'); try{ window.ForensicCloud?.saveProgress(Progress.snapshot()); }catch(e){} },
  markQuizScore(n, score, total){ LS.set(`quiz${n}_score`, String(score)); LS.set(`quiz${n}_total`, String(total)); LS.set(`quiz${n}_pass`, String(pass(score,total))); try{ window.ForensicCloud?.saveProgress(Progress.snapshot()); }catch(e){} },

    // Queries
    isModuleDone(n){ return LS.bool(`module${n}_done`); },
    isPracticeDone(n){ return LS.bool(`practice${n}_done`); },
    quizPass(n){ return LS.get(`quiz${n}_pass`)==='true'; },

    // Gating for Practice Levels screen (unlock level N when Module N is done)
    applyPracticeLocks(root=document){
      const cards = root.querySelectorAll('.level-card');
      cards.forEach((card, i)=>{
        const level = i+1;
        const action = card.querySelector('.level-action');
        if(!action) return;
        const go = action.querySelector('a.go-btn');
        const lock = action.querySelector('.lock');
        const canStart = Progress.isModuleDone(level);

        if(canStart){
          // ensure a Go button exists
          if(!go){
            const link = document.createElement('a');
            link.className = 'go-btn';
            link.setAttribute('aria-label', `Start Level ${level}`);
            link.href = `./levels/level${level}.html`;
            link.innerHTML = '<span style="font-size:1.5rem;">&#8594;</span>';
            if(lock) lock.replaceWith(link); else action.appendChild(link);
          }
          card.style.opacity = 1;
        } else {
          // ensure a Lock is shown
          if(go){
            const span = document.createElement('span');
            span.className = 'lock';
            span.innerHTML = '<svg viewBox="0 0 20 20"><path d="M5 8V6a5 5 0 0 1 10 0v2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zm2-2a3 3 0 1 1 6 0v2H7V6zm-2 4v6h10v-6H5z"/></svg>Locked';
            go.replaceWith(span);
          }
          card.style.opacity = 0.5;
        }
      });
    },

    // Gating for Training Modules screen (unlock module N when Quiz N-1 passed)
    applyModuleLocks(root=document){
      const cards = root.querySelectorAll('.module-card');
      cards.forEach((card, i)=>{
        const mod = i+1;
        const action = card.querySelector('.module-action');
        if(!action) return;
        const go = action.querySelector('a.go-btn');
        const lock = action.querySelector('.lock');
        const canStart = (mod === 1) || Progress.quizPass(mod-1);

        if(canStart){
          if(!go){
            const link = document.createElement('a');
            link.className = 'go-btn';
            link.setAttribute('aria-label', `Start Module ${mod}`);
            link.href = `./modules/module${mod}.html`;
            link.innerHTML = '<span style="font-size:1.5rem;">&#8594;</span>';
            if(lock) lock.replaceWith(link); else action.appendChild(link);
          }
          card.style.opacity = 1;
        } else {
          if(go){
            const span = document.createElement('span');
            span.className = 'lock';
            span.innerHTML = '<svg viewBox="0 0 20 20"><path d="M5 8V6a5 5 0 0 1 10 0v2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zm2-2a3 3 0 1 1 6 0v2H7V6zm-2 4v6h10v-6H5z"/></svg>Locked';
            go.replaceWith(span);
          }
          card.style.opacity = 0.5;
        }
      });
    },

    // Flow helpers
    // Call after Module 1 finish
    onModule1Finished(){
      Progress.markModuleDone(1);
      goRoot('levels/level1.html');
    },
    // Call after Practice Level 1 finish
    onPractice1Finished(){
      Progress.markPracticeDone(1);
      window.location.href = './quiz/quiz1.html';
    },
    // After Quiz 1 submit (call with score & total)
    afterQuiz1(score,total){
      Progress.markQuizScore(1, score, total);
      if(pass(score,total)) goRoot('modules/module2.html');
      else goRoot('quiz/results/quiz1-result.html');
    },

    // After finishing Module 2
  onModule2Finished(){ Progress.markModuleDone(2); goRoot('levels/level2.html'); },
  onPractice2Finished(){ Progress.markPracticeDone(2); goRoot('quiz/quiz2.html'); },
  afterQuiz2(score,total){ Progress.markQuizScore(2, score, total); if(pass(score,total)) goRoot('modules/module3.html'); else goRoot('quiz/results/quiz2-result.html'); },

  onModule3Finished(){ Progress.markModuleDone(3); goRoot('levels/level3.html'); },
  onPractice3Finished(){ Progress.markPracticeDone(3); goRoot('quiz/quiz3.html'); },
  afterQuiz3(score,total){ Progress.markQuizScore(3, score, total); if(pass(score,total)) goRoot('modules/module4.html'); else goRoot('quiz/results/quiz3-result.html'); },

    onModule4Finished(){ Progress.markModuleDone(4); goRoot('levels/level4.html'); },
    onPractice4Finished(){ Progress.markPracticeDone(4); goRoot('quiz/quiz4.html'); },
    afterQuiz4(score,total){ Progress.markQuizScore(4, score, total); goRoot('quiz/results/quiz4-result.html'); }
  };

  window.ForensicFlow = Progress;

  // On load: if cloud available, hydrate local progress once per session
  (async function(){
    try{
      if(window.ForensicCloud && window.ForensicCloud._ready){
        const ok = await window.ForensicCloud._ready; if(!ok) return;
        const remote = await window.ForensicCloud.loadProgress();
        if(remote){ Progress.restore(remote); }
      }
    }catch(e){ /* ignore hydration errors */ }

    // After hydration, enforce page order if user deep-links into a locked page
    try{
      const p = location.pathname || '';
      const modMatch = p.match(/\/(modules)\/module(\d+)\.html$/);
      const lvlMatch = p.match(/\/(levels)\/level(\d+)\.html$/);
      const quizMatch = p.match(/\/(quiz)\/quiz(\d+)\.html$/);

      function computeNextRoute(){
        for(let i=1;i<=4;i++){
          if(!Progress.isModuleDone(i)) return `modules/module${i}.html`;
          if(!Progress.isPracticeDone(i)) return `levels/level${i}.html`;
          if(!Progress.quizPass(i)) return `quiz/quiz${i}.html`;
        }
        return 'training-modules.html';
      }

      // Guard logic per page kind
      if(modMatch){
        const n = parseInt(modMatch[2],10);
        const allowed = (n===1) || Progress.quizPass(n-1);
        if(!allowed){ goRoot(computeNextRoute()); return; }
      } else if(lvlMatch){
        const n = parseInt(lvlMatch[2],10);
        const allowed = Progress.isModuleDone(n);
        if(!allowed){ goRoot(computeNextRoute()); return; }
      } else if(quizMatch){
        const n = parseInt(quizMatch[2],10);
        const allowed = Progress.isPracticeDone(n);
        if(!allowed){ goRoot(computeNextRoute()); return; }
      }
    }catch(e){ /* ignore guard errors */ }
  })();
})();
