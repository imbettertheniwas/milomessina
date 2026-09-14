// Keep a steady deadline instead of skipping a whole frame when Safari's display
// callbacks arrive slightly early. Safari can also block on the GPU after JS ends.
export function createFramePacer(fps=30){
  const interval=1000/fps;let deadline=0;
  return {
    due(now){
      if(deadline&&now<deadline-2)return false;
      deadline=deadline?deadline+interval:now+interval;
      if(deadline<now-interval)deadline=now+interval;
      return true;
    },
    reset(){deadline=0;}
  };
}
