import { chromium } from "playwright";
const BASE="http://localhost:5199";
const USER={id:"00000000-0000-4000-8000-000000000001",name:"Auditoria QA",email:"qa@local.invalid",role:"admin",roles:["admin","diretoria","gerente","vendedor"],companies:["industria","resibag"],initials:"QA",avatarBg:"#1D4ED8",avatarUrl:null,sectors:[]};
const SEED={gs_v4_current_user:JSON.stringify(USER),gs_v4_onboarding:JSON.stringify({[USER.id]:true}),gs_v4_platform_tour_seen:JSON.stringify({[USER.id]:true}),gs_v4_changelog_seen:JSON.stringify({[USER.id]:"99.0.0"}),gs_v4_screen_tips_seen:JSON.stringify({[USER.id]:["*"]}),gs_v4_feature_spotlights_seen:JSON.stringify({[USER.id]:["*"]}),gs_v4_agents_coachmark_seen:JSON.stringify({[USER.id]:true})};
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:["--no-sandbox"]});
const ctx=await b.newContext({viewport:{width:1440,height:900}});
await ctx.addInitScript((s)=>{for(const[k,v]of Object.entries(s))localStorage.setItem(k,v);},SEED);
const p=await ctx.newPage();
await p.goto(BASE+"/",{waitUntil:"domcontentloaded"});
await p.evaluate(async()=>{const m=await import("/src/data/generate-leads.js");localStorage.setItem("gs_v4_leads",JSON.stringify(m.generateLeadsForAllCompanies()));});
await p.goto(BASE+"/pipeline",{waitUntil:"domcontentloaded"});
await p.waitForTimeout(3000);
console.log(await p.evaluate(()=>{
  const d=[...document.querySelectorAll('[draggable="true"]')];
  return JSON.stringify({total:d.length, amostra:d.slice(0,3).map(x=>x.tagName+" | "+x.className.slice(0,80)+" | "+x.textContent.slice(0,50))},null,1);
}));
console.log("URL:", p.url(), "| titulo visivel:", (await p.evaluate(()=>document.body.innerText.slice(0,300))));
await b.close();
