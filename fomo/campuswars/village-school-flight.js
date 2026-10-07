import {createSchoolDrop,SCHOOL_DROP_DURATION} from './village-school-drop.js?v=154';

// Selecting a school starts directly in the original parachute drop.
export const SCHOOL_FLIGHT_DURATION=SCHOOL_DROP_DURATION;
export function schoolFlightStage(time){return time<.55?'freefall':time<SCHOOL_FLIGHT_DURATION-.5?'parachute':'arrival';}
export function schoolFlightCaption(time,school){
 return {index:'campus',title:school.name,description:'',join:false,opacity:1,copyOpacity:1,lift:0,scale:1};
}
export function createSchoolFlight(T,scene){
 const drop=createSchoolDrop(T,scene);
 return {root:drop.root,drop,
  begin(options){drop.finish();drop.begin(options);},
  update(time,camera){const pose=drop.update(time,camera);if(pose)return {...pose,stage:schoolFlightStage(time)};},
  finish(){drop.finish();},dispose(){drop.dispose();}
 };
}
