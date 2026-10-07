import {campusIdentity} from './village-school-identities.js?v=138';
// Apparel colors supplement the school artwork catalog. These are cloth colors,
// not new logo assets; small fabric-tone variations are intentional.
const normalize=value=>String(value||'').split(' · ')[0].normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^the /,'').replace(/[^a-z0-9]+/g,' ').trim();
const extra=new Map([
  ["Duke University",0x00539B,0xFFFFFF],
  ["Sacred Heart University",0xA70034,0x8A8D8F],
  ["Covenant College",0x003366,0xFFFFFF],
  ["Texas A&M University - College Station",0x500000,0xFFFFFF],
  ["Bradley University",0xCE1432,0x939598],
  ["University of Oklahoma",0x841617,0xFDF9D8],
  ["University of Texas at Arlington",0x0064B1,0xF58025],
  ["College of Charleston",0x800000,0xFFFFFF],
  ["University of Illinois Springfield",0x003366,0xC8B18B],
  ["The College of New Jersey",0x293F6F,0xD2A92A],
  ["Queen's University",0x002452,0xFABD0F,0xB90E31],
  ["New Mexico State University",0x8C0B42,0xFFFFFF],
  ["Dartmouth College",0x00693E,0xFFFFFF],
  ["Saint Leo University",0x205C40,0xF2A900],
  ["Western University",0x4F2683,0xFFFFFF],
  ["University of San Diego",0x003B70,0x75BEE9],
  ["Saint Joseph's University",0x9E1B32,0xA7A9AC],
  ["Rowan College",0x57150B,0xFFCC00],
  ["University of Wisconsin - Milwaukee",0x000000,0xFFBD00],
  ["University of Pittsburgh",0x003594,0xFFB81C],
  ["State University of New York at Farmingdale",0x004846,0xCCA73C],
  ["University of California, Davis",0x022851,0xFFBF00],
  ["DePauw University",0x000000,0xCFB53B],
  ["Lehigh University",0x502D0E,0xFFFFFF],
  ["University of California, Berkeley",0x002676,0xFDB515],
  ["Washington & Lee University",0x003087,0xFFFFFF],
  ["Texas State University",0x501214,0xD7BD8A],
  ["University of Washington",0x4B2E83,0xB7A57A],
  ["George Washington University",0x033C5A,0xD6BF91],
  ["CUNY City College of NY",0x572C86,0xFFFFFF],
  ["University of California, Santa Cruz",0x003C6C,0xFDC700],
  ["High Point University",0x330072,0x818183],
  ["University of Kansas",0x0051BA,0xE8000D],
  ["Princeton University",0xE77500,0x000000],
  ["University of Rhode Island",0x002147,0xD0A627],
  ["Indiana University of Pennsylvania",0x9D2235,0x5E5F5F],
  ["State University of New York College at New Paltz",0x003E7E,0xF58426],
  ["Loyola University Chicago",0x5A0722,0xEAAA00],
  ["University of Virginia, Charlottesville",0x232D4B,0xE57200],
  ["University of Wisconsin - Madison",0xC5050C,0xFFFFFF],
  ["Indiana University",0x970310,0xFFFFFF],
].map(([name,...colors])=>[normalize(name),colors]));
const cache=new Map();
export function schoolWardrobePalette(chapter={}){
  const name=typeof chapter==='string'?chapter:chapter.school||chapter.name||'';
  const key=normalize(name);if(cache.has(key))return cache.get(key);
  const identity=campusIdentity({name});
  const colors=extra.get(key)||(identity.id!=='unknown'?[identity.primary,identity.secondary].map(c=>parseInt(c.slice(1),16)):null);
  cache.set(key,colors);return colors;
}
