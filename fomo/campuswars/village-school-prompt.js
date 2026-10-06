import {SCHOOL_PROMPT_DELAY} from './village-school-search.js?v=147';

// Count visible time only, starting after the opening intro completes or is skipped.
export function createSchoolPromptTimer({show,now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}){
 let timer=null,started=0,remaining=SCHOOL_PROMPT_DELAY,shown=false;
 function pause(){if(timer!==null){cancel(timer);timer=null;remaining=Math.max(0,remaining-(now()-started));}}
 return {
  update({ready,visible,introFinished}){
   pause();if(shown)return;
   if(!introFinished){remaining=SCHOOL_PROMPT_DELAY;return;}
   if(!ready||!visible)return;
   started=now();timer=schedule(()=>{timer=null;shown=true;show();},remaining);
  },
  stop(){pause();shown=true;},
  dispose(){pause();}
 };
}
