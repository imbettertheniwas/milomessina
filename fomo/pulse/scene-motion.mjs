// A separate clock lets idle motion coast to a stop without snapping positions.
export function createIdleMotion(){
 let time=0,quiet=2,speed=0;
 return {
  activity(){quiet=0;},
  advance(dt,{held=false,paused=false,reduced=false,enabled=true}={}){
   if(paused||reduced||!enabled)return time;
   quiet=held?0:quiet+dt;
   const target=quiet>1.4?1:0;
   speed+=(target-speed)*(1-Math.exp(-dt/(target?1.1:.14)));
   time+=dt*speed;
   return time;
  }
 };
}

export const SIGNAL_SECONDS=7.2;
export function signalStrength(age,calm=false){
 if(age<0||age>=SIGNAL_SECONDS)return 0;
 if(calm)return .65;
 const fade=Math.min(1,(SIGNAL_SECONDS-age)/1.5);
 return (.3+.7*Math.pow((1+Math.cos(age*Math.PI))/2,2))*fade;
}
