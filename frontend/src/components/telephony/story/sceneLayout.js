// Ordered subtree bands give each cable its own planar branch in the home view.
export const edgeKey=(a,b)=>`${Math.min(a,b)}:${Math.max(a,b)}`;
export function layoutScene(topology,{mobile=false}={}) {
 if(topology.layout){const spec=topology.layout[mobile?'mobile':'desktop'];return {...spec};}
 const ids=topology.nodeIds,adj=new Map(ids.map(id=>[id,[]]));
 for(const w of topology.connections){adj.get(w.a)?.push(w.b);adj.get(w.b)?.push(w.a);}
 const visited=new Set(),children=new Map(),roots=[];
 const visit=id=>{visited.add(id);const branch=[];for(const other of adj.get(id)||[])if(!visited.has(other)){branch.push(other);visit(other);}children.set(id,branch);};
 for(const id of ids)if(!visited.has(id)){roots.push(id);visit(id);}
 const width=id=>Math.max(1,(children.get(id)||[]).reduce((sum,c)=>sum+width(c),0));
 const positions={};let offset=0;
 const place=(id,depth,start)=>{const span=width(id),cross=(start+span/2)*3.6,along=depth*3.8;positions[id]=mobile?[cross,along]:[along,cross];let next=start;for(const c of children.get(id)||[]){place(c,depth+1,next);next+=width(c);}};
 for(const root of roots){place(root,0,offset);offset+=width(root)+1;}
 const xs=Object.values(positions).map(p=>p[0]),zs=Object.values(positions).map(p=>p[1]);const cx=(Math.min(...xs)+Math.max(...xs))/2,cz=(Math.min(...zs)+Math.max(...zs))/2;
 for(const p of Object.values(positions)){p[0]-=cx;p[1]-=cz;}
 return {positions,edges:{}};
}
export function routePoints(layout,a,b){
 const edge=layout.edges?.[edgeKey(a,b)];
 if(!edge)return [layout.positions[a],layout.positions[b]];
 return a===Math.min(a,b)?edge:[...edge].reverse();
}
