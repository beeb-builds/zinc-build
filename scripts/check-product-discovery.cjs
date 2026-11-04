// Public discovery / role fixtures. Never connects a real wallet or signs.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,overrides={}){const api={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:api,require:id=>id in overrides?overrides[id]:require(id)});return api;}
const link={__esModule:true,default:({href,children,...props})=>React.createElement('a',{href,...props},children)};
const campaign={id:7,name:'Project <script>unsafe</script>',creator:'creator.testnet',treasury_account:'treasury.testnet',treasury_share_bps:4000,contributors:[{account_id:'alice.testnet',role:'Artist',share_bps:6000}],created_at_ms:7};
const right={campaign_id:7,contributor_index:0,token_id:'campaign:7:right:0',owner_id:'bob.testnet',role:'Artist',share_bps:6000};
let campaigns=[campaign],fail=false;
const model=load('src/lib/public-rights.ts',{'./zinc-contract':{getCampaigns:async()=>campaigns,getCampaignRights:async id=>{if(fail&&id===8)throw Error('RPC unavailable');return [{...right,campaign_id:id,token_id:`campaign:${id}:right:0`}];}},'./campaign-discovery':{validateDiscoveryCampaigns(){}}});
(async()=>{
 assert.equal(model.validateCampaignRights(campaign,[right])[0].owner_id,'bob.testnet');
 for(const invalid of [[],[right,right],[{...right,token_id:'campaign:999:right:0'}],[{...right,share_bps:1}],[{...right,role:'Fake role'}],[{...right,owner_id:''}]])assert.throws(()=>model.validateCampaignRights(campaign,invalid));
 let data=await model.readPublicRights();assert.equal(data.rights.length,1);assert.equal(data.rights[0].originalContributor,'alice.testnet');assert.equal(model.filterPublicRights(data.rights,'BOB','all').length,1);assert.equal(model.filterPublicRights(data.rights,'Artist','7').length,1);assert.equal(model.filterPublicRights(data.rights,'','8').length,0);
 campaigns=[campaign,{...campaign,id:8,created_at_ms:8}];fail=true;data=await model.readPublicRights();assert.equal(data.rights.length,1);assert.equal(data.unavailable[0],8);
 campaigns=[];data=await model.readPublicRights();assert.equal(data.rights.length,0);assert.equal(data.unavailable.length,0);
 const card=load('src/components/nfts/RevenueRightCard.tsx',{'next/link':link});
 const roster=load('src/components/campaigns/ProjectTeamRoster.tsx',{'next/link':link,'../nfts/RevenueRightCard':card});
 let html=renderToStaticMarkup(React.createElement(roster.default,{campaign,rights:[right],accountId:'bob.testnet'}));
 for(const text of ['Project creator','Original contributor','Current right holder','alice.testnet','bob.testnet','treasury.testnet','60% Revenue Right','40% account-based','Transferred'])assert.ok(html.includes(text),text);
 assert.ok(html.includes('href="/rights/campaign%3A7%3Aright%3A0"'));assert.ok(html.includes('You'));assert.ok(!html.includes('NFT owner is the creator'));
 html=renderToStaticMarkup(React.createElement(roster.default,{campaign,rights:null,accountId:null}));assert.ok(html.includes('Ownership not yet verified'));assert.ok(!html.includes('href="/rights/'));
 const onboarding=load('src/components/dashboard/ProjectOnboarding.tsx',{'next/link':link});html=renderToStaticMarkup(React.createElement(onboarding.default));for(const href of ['/campaigns/new','/nfts','/campaigns','/gallery'])assert.ok(html.includes(`href="${href}"`));assert.ok(html.includes('Connecting a wallet alone does not mint an NFT'));
 const personalMarker=()=>null;const home=load('src/app/page.tsx',{'../components/dashboard/PersonalDashboard':{__esModule:true,default:personalMarker}});assert.equal(home.default().type,personalMarker);
 let effect,reads=0;const personal=load('src/components/dashboard/PersonalDashboard.tsx',{react:{...React,useEffect:fn=>{effect=fn;},useState:initial=>[initial,()=>{}]},'next/link':link,'../layout/DashboardShell':{__esModule:true,default:({children})=>React.createElement('main',null,children)},'./WalletDashboard':{__esModule:true,default:()=>React.createElement('p',null,'Personal only')},'./ProjectOnboarding':onboarding,'../wallet/WalletProvider':{useWallet:()=>({accountId:null,connect(){}})},'../data/useReadRefresh':{useReadRefresh:()=>({version:0,refresh(){}})},'../../lib/zinc-contract':{getCampaigns:async()=>{reads++;return[];}},'../../lib/campaign-discovery':{validateDiscoveryCampaigns(){}}});
 html=renderToStaticMarkup(React.createElement(personal.default));effect();assert.equal(reads,0);assert.ok(!html.includes('aria-label="Platform totals"'));assert.ok(html.includes('href="/explore"'));
 console.log('PASS: complete public rights validation, search/project filters, partial vs empty reads, creator/treasury/original/current roles, verified NFT links, onboarding paths, personal home and no disconnected dashboard RPC.');
})().catch(error=>{console.error(error);process.exitCode=1});
