import {createFloatingIsland} from './village-island.js?v=170';
import {createCampusKit} from './village-campus-kit.js?v=153';
import {createSchoolEntrance} from './village-school-signs.js?v=163';
const themes={
 mission:{wall:0xe5d3b0,roof:0x9c4f36,sky:0xb8d9e6,ground:0xbfa779,tree:'palm',land:'hills',label:'Mission-style courtyards'},
 pacific:{wall:0xcaa88c,roof:0x96513f,sky:0xafd2e7,ground:0xbba77e,tree:'palm',land:'coast',label:'Pacific campus'},
 desert:{wall:0xc78f65,roof:0x845846,sky:0xd6d9d7,ground:0xc5a173,tree:'cactus',land:'mesa',label:'Desert campus'},
 mountain:{wall:0xac947c,roof:0x59666a,sky:0xbacfdc,ground:0x84916e,tree:'pine',land:'mountains',label:'Mountain campus'},
 flatirons:{wall:0xb99072,roof:0x985644,sky:0xafcddd,ground:0x929476,tree:'pine',land:'flatirons',label:'Front Range campus'},
 stone:{wall:0xa9aaa0,roof:0x596268,sky:0xc5d6de,ground:0x86926d,tree:'oak',land:'hills',label:'Stone campus'},
 northwest:{wall:0x9f9588,roof:0x526562,sky:0xb2c6cf,ground:0x6f8b75,tree:'pine',land:'hills',label:'Evergreen campus'},
 tropical:{wall:0xe1cba7,roof:0xb16c4b,sky:0xaed7e1,ground:0xa6b681,tree:'palm',land:'water',label:'Palm-lined campus'},
 south:{wall:0xaa715c,roof:0x60646b,sky:0xc2d9e2,ground:0x819164,tree:'oak',land:'grove',label:'Southern campus'},
 southern:{wall:0xbca58d,roof:0x5d6662,sky:0xc4d6d8,ground:0x71886c,tree:'oak',land:'grove',label:'Garden campus'},
 midwest:{wall:0xa27665,roof:0x58606a,sky:0xc2d0dc,ground:0x8c9970,tree:'oak',land:'grove',label:'College-town campus'},
 northeast:{wall:0x986d60,roof:0x59606b,sky:0xbccbd9,ground:0x949473,tree:'autumn',land:'grove',label:'Brick college town'},
 midatlantic:{wall:0xa98070,roof:0x54616a,sky:0xc1d0dc,ground:0x819370,tree:'oak',land:'hills',label:'Mid-Atlantic campus'},
 urban:{wall:0x98786c,roof:0x505964,sky:0xb8c7d2,ground:0x858c83,tree:'oak',land:'city',label:'City campus'},
 texas:{wall:0xc5ab87,roof:0x946b53,sky:0xcbd7de,ground:0xa2a177,tree:'oak',land:'grove',label:'Texas campus'}
};
export function schoolTheme(school){if(!school)return null;const base=themes[school.theme]||themes[school.region]||themes.midwest;return {...base,floating:true,schoolName:school.name,sky:0xa5d6f3,seed:school.id,description:school.character||`${base.label} · ${school.city||school.name}${school.state?', '+school.state:''}`};}
export function createSchoolDistricts(T,school,extension=0,chapters=school.chapters||[]){
 const island=createFloatingIsland(T,school,chapters),kit=createCampusKit(T),theme=schoolTheme(school);
 const entrance=createSchoolEntrance(T,school,kit,theme.wall);entrance.scale.setScalar(.48);entrance.position.set(island.spec.x,0,island.spec.streetStart-5);island.root.add(entrance);
 const resources=new Set();entrance.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of [].concat(o.material||[])){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});Object.values(kit.geometries).forEach(g=>resources.add(g));kit.vehicles.resources.forEach(r=>resources.add(r));
 const dispose=island.dispose;island.dispose=()=>{dispose();for(const r of resources)if(!r.userData?.sharedResource)r.dispose();};return {...island,theme};
}
