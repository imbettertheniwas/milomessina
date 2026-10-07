// High-polling mice can emit hundreds of moves per frame. Hover only needs the
// latest position, and hovering pavement should never traverse model triangles.
export function createPointerHover(T,canvas,camera,blimp,{schedule=requestAnimationFrame,cancel=cancelAnimationFrame,schoolPickables=()=>[]}={}){
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),bounds=new T.Sphere(),localBounds=new T.Sphere(new T.Vector3(0,-.5,0),13);
  let pending=0,latest=null,hovered='';
  function paint(next){if(next===hovered)return;hovered=next;canvas.style.cursor=next?'pointer':'';canvas.title=next;}
  function flush(){
    pending=0;if(!latest)return;
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
    pointer.set((latest.x-rect.left)/rect.width*2-1,-((latest.y-rect.top)/rect.height)*2+1);raycaster.setFromCamera(pointer,camera);
    bounds.copy(localBounds).applyMatrix4(blimp.root.matrixWorld);
    const schoolTargets=schoolPickables();
    if(schoolTargets.length){const hit=raycaster.intersectObjects(schoolTargets,false)[0];paint(hit?.object.userData.action==='school'?`Jump to ${hit.object.userData.name} ↗`:hit?.object.userData.action==='discord'?'Join the FOMO Discord ↗':'');return;}
    paint(blimp.root.visible&&raycaster.ray.intersectsSphere(bounds)&&raycaster.intersectObjects(blimp.pickables,false).length>0?'Join the FOMO Discord ↗':'');
  }
  return {move(event){latest={x:event.clientX,y:event.clientY};if(!pending)pending=schedule(flush);},clear(){if(pending)cancel(pending);pending=0;latest=null;paint('');}};
}
export function releasedMouseDrag(event){return event.pointerType!=='touch'&&(event.buttons&1)===0;}
