(async function main() {
  const fs = require("node:fs");
  const username = "Deshan-003";
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required to fetch real contribution data");
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount contributionLevel}}}}}}`;
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "deshan-profile-snake",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    body: JSON.stringify({query, variables:{login:username}})
  });
  const payload = await response.json();
  if (!response.ok || payload.errors?.length) throw new Error("GitHub GraphQL contribution request failed: " + JSON.stringify(payload.errors ?? payload));
  const weeks = payload?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!Array.isArray(weeks)) throw new Error("GitHub returned no contribution calendar. Keeping previous SVG.");
  const byDate = new Map(weeks.flatMap(w => w.contributionDays).map(d => [d.date,d]));
  const COLS=52, ROWS=7, CELL=10.5, PITCH=14, OX=86, OY=88;
  const pal={NONE:"#192B3B",FIRST_QUARTILE:"#145345",SECOND_QUARTILE:"#167C62",THIRD_QUARTILE:"#22B78C",FOURTH_QUARTILE:"#64E7B4"};
  const today=new Date(); today.setUTCHours(0,0,0,0);
  const sunday=new Date(today); sunday.setUTCDate(today.getUTCDate()-today.getUTCDay()-7*(COLS-1));
  const grid=[];
  for(let x=0;x<COLS;x++){
    grid[x]=[];
    for(let y=0;y<ROWS;y++){
      const date=new Date(sunday); date.setUTCDate(sunday.getUTCDate()+7*x+y);
      const d=byDate.get(date.toISOString().slice(0,10));
      const level=d && date <= today && pal[d.contributionLevel] ? d.contributionLevel : "NONE";
      grid[x][y]={date:date.toISOString().slice(0,10),level,count:d?.contributionCount??0};
    }
  }
  let cycle=Array.from({length:ROWS},(_,y)=>[0,y]);
  for(let x=1;x<COLS;x++) cycle.push([x,ROWS-1]);
  for(let x=COLS-1;x>=1;x--){
    if(x%2) for(let y=ROWS-2;y>=0;y--) cycle.push([x,y]);
    else for(let y=0;y<ROWS-1;y++) cycle.push([x,y]);
  }
  if(cycle.length!==COLS*ROWS) throw new Error("Invalid snake route");
  let seed=Math.floor(today.getTime()/86400000)>>>0;
  const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  if(rng()<.5) cycle.reverse();
  const offset=Math.floor(rng()*cycle.length);
  cycle=cycle.slice(offset).concat(cycle.slice(0,offset));
  const eligible=cycle.map(([x,y],i)=>grid[x][y].level!=="NONE" && i>=7 && i<cycle.length-7?i:-1).filter(i=>i>=0);
  for(let i=eligible.length-1;i>0;i--){const j=Math.floor(rng()*(i+1)); [eligible[i],eligible[j]]=[eligible[j],eligible[i]];}
  const food=new Map(eligible.slice(0,44).map(i=>[cycle[i].join(","),i]));
  const duration=(cycle.length*.095).toFixed(3)+"s";
  const sx=x=>(OX+PITCH*x).toFixed(1), sy=y=>(OY+PITCH*y).toFixed(1);
  const esc=s=>String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;");
  let parts=[];
  const add=s=>parts.push(s);
  add(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 238" width="900" height="238" role="img" aria-label="${esc(username)} animated contribution snake">`);
  add('<defs><linearGradient id="b" x2="1" y2="1"><stop stop-color="#091720"/><stop offset="1" stop-color="#091321"/></linearGradient><filter id="eatenGlow" x="-140%" y="-140%" width="380%" height="380%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="2.6"/></filter></defs>');
  add('<rect width="900" height="238" rx="17" fill="url(#b)"/><rect x="1" y="1" width="898" height="236" rx="16" fill="none" stroke="#254B52"/>');
  add('<text x="42" y="37" font-family="Arial,sans-serif" font-size="16" letter-spacing="2" font-weight="bold" fill="#BDFDEF">GITHUB ACTIVITY</text>');
  add(`<text x="859" y="37" text-anchor="end" font-family="monospace" font-size="11" fill="#5CAAA5">@${esc(username)}</text>`);
  add('<line x1="42" y1="52" x2="858" y2="52" stroke="#254550"/>');
  for(let y of [1,3,5]) add(`<text x="42" y="${sy(y)}" font-family="monospace" font-size="10" fill="#789CA4">${["","Mon","","Wed","","Fri"][y]}</text>`);
  let lastMonth="";
  for(let x=0;x<COLS;x++){
    const mo=new Date(grid[x][0].date+"T00:00:00Z").toLocaleString("en-US",{month:"short",timeZone:"UTC"});
    if(mo!==lastMonth && x<49){add(`<text x="${sx(x)}" y="76" font-family="Arial,sans-serif" font-size="10" fill="#7399A4">${mo}</text>`); lastMonth=mo;}
  }
  for(let x=0;x<COLS;x++)for(let y=0;y<ROWS;y++){
    const d=grid[x][y], t=food.get(`${x},${y}`);
    let inner=`<title>${d.date}: ${d.count} contributions</title>`;
    if(t!==undefined){
      const e=(t/cycle.length).toFixed(6),r=((cycle.length-1)/cycle.length).toFixed(6);
      inner+=`<animate attributeName="opacity" dur="${duration}" calcMode="discrete" keyTimes="0;${e};${r};1" values="1;0;0;1" repeatCount="indefinite"/>`;
    }
    add(`<rect x="${sx(x)}" y="${sy(y)}" width="${CELL}" height="${CELL}" rx="2" fill="${pal[d.level]}">${inner}</rect>`);
  }
  // An eaten contribution becomes a bright, centered mint marker.
  // Place markers above the calendar grid but beneath the five-segment snake.
  // SMIL discrete timing keeps the original square hidden until the next loop.
  for(const [cell,t] of food){
    const [x,y]=cell.split(",").map(Number);
    const eat=(t/cycle.length).toFixed(6);
    const reset=((cycle.length-1)/cycle.length).toFixed(6);
    const gx=(OX+PITCH*x+0.25).toFixed(2),gy=(OY+PITCH*y+0.25).toFixed(2);
    const cx=(OX+PITCH*x+2.5).toFixed(2),cy=(OY+PITCH*y+2.5).toFixed(2);
    add(`<g opacity="0"><rect x="${gx}" y="${gy}" width="10" height="10" rx="4" fill="#52FFAC" opacity="0.95" filter="url(#eatenGlow)"/><rect x="${cx}" y="${cy}" width="5.5" height="5.5" rx="1.5" fill="#B7FFD2" stroke="#ECFFF4" stroke-width="0.75"/><animate attributeName="opacity" dur="${duration}" calcMode="discrete" keyTimes="0;${eat};${reset};1" values="0;1;1;0" repeatCount="indefinite"/></g>`);
  }
  const colors=["#A1FFF2","#6DEBDC","#38C9BA","#20A49B","#167B7D"];
  for(let k=4;k>=0;k--){
    const values=cycle.map((_,n)=>{const [x,y]=cycle[(n-k+cycle.length)%cycle.length];return `${sx(x)} ${sy(y)}`;}).join(";");
    add(`<g><rect width="${CELL}" height="${CELL}" rx="3" fill="${colors[k]}"/>${k===0?'<circle cx="7" cy="3" r="1" fill="#083C39"/><circle cx="7" cy="7" r="1" fill="#083C39"/>':""}<animateTransform attributeName="transform" type="translate" calcMode="discrete" dur="${duration}" values="${values}" repeatCount="indefinite"/></g>`);
  }
  add('<text x="44" y="217" font-family="monospace" font-size="10.5" fill="#739BA5">52 WEEKS  /  FIVE PIXELS  /  LOOPING</text>');
  add('<text x="855" y="217" text-anchor="end" font-family="monospace" font-size="10.5" fill="#63CBAF">■ MINT DOT = EATEN</text>');
  add("</svg>");
  fs.mkdirSync("assets",{recursive:true});
  fs.writeFileSync("assets/contribution-snake.svg",parts.join("\n")+"\n");
  console.log(`Updated contribution SVG with ${food.size} edible real contribution squares`);
})().catch(err=>{console.error(err);process.exitCode=1;});
