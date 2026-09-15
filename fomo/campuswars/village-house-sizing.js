import {houseStandings} from './village-competition.js?v=110';
import {bannerIdentity} from './village-banner-art.js?v=105';
import {hash} from './village-district-layout.js?v=80';

function houseStyle(chapter){
  const original=['blue-and-gold','star-and-crescent','azure-academic','cardinal-rose','cherry-varsity'].indexOf(bannerIdentity(chapter).key);
  return original<0?Math.floor(hash(chapter.id,'house-style')*5):original;
}
export function rankedHouseSizes(chapters){
  const standings=houseStandings(chapters),ranks=new Map(standings.map(row=>[row.id,row.rank]));
  return new Map(chapters.map(chapter=>{
    const rank=ranks.get(chapter.id)||standings.length+1,advantage=1/(1+.55*(rank-1));
    const style=houseStyle(chapter),width=[11,12.2,10.5,12.2,10.5][style],height=style===4?9.1:7.4;
    // Rank controls all three dimensions. Equal ranks receive equal dimensions.
    // The largest footprint stays within the existing lot and walking routes.
    const footprint=8.5+5.1*advantage,roofline=7+8*advantage,depthScale=.76+.24*advantage;
    return [chapter.id,{rank,style,width,height,footprint,roofline,depthScale,scaleX:footprint/(width+1),scaleY:roofline/(height+2.82),offsetZ:6.2*(1-depthScale)}];
  }));
}
