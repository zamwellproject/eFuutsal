export const TEAMS=[
{id:'EVR',name:'EVERSION',primary:'#c4f35b',accent:'#17251a'},
{id:'VDL',name:'Vaedalation',primary:'#54b7e8',accent:'#10263a'},
{id:'AWFA',name:'Alwafi Futsal Academy',primary:'#f1f1ed',accent:'#d94d42'},
{id:'ZVR',name:'Zetsvire',primary:'#bb83ee',accent:'#21152f'}];
const outfield=[['Hilmy',7],['Sunan',18],['Faiq',48],['Nyong',29],['Ahmad',25],['Hamdi',27],['I. Kenzie',13],['Sajjad',10],['Al raffle',77],['Rakan',23],['Abiyu',7],['Manggos',67],['Najid',57]];
const keepers=[['Bima',2],['I.kenzie',9],['R. Maliq',6],['Naufal',1]];
export const DEFAULT_PLAYERS=[...outfield.map(([name,number],i)=>({id:`of-${i+1}`,name,number,position:'Outfield',attributes:{speed:68+(i*7)%25,shooting:62+(i*9)%30,passing:65+(i*5)%27,dribbling:66+(i*6)%28,defense:58+(i*8)%32,gkHandling:8}})),...keepers.map(([name,number],i)=>({id:`gk-${i+1}`,name,number,position:'Goalkeeper',attributes:{speed:48+i*5,shooting:25,passing:58+i*6,dribbling:40,defense:70+i*4,gkHandling:78+i*5}}))];
export const DEFAULT_LINEUP=['of-1','of-2','of-3','of-4','gk-1'];
