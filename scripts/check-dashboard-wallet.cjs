// Exact balances and wallet-switch races. Fixtures never sign or send transactions.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict'),React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
function load(file,overrides){const api={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:api,require:id=>id in overrides?overrides[id]:require(id)});return api;}
let tokens=[],balances=[],failTokens=false,failBalances=false;
const model=load('src/lib/dashboard-wallet.ts',{'./zinc-contract':{getAllNftTokensForOwner:async()=>{if(failTokens)throw Error();return tokens;}},'./wallet-earnings':{readEarningsBalances:async()=>{if(failBalances)throw Error();return balances;}}});
const campaigns=[{id:1,name:'Artist project',creator:'creator.testnet',treasury_account:'treasury.testnet',treasury_share_bps:4000,created_at_ms:1,contributors:[{account_id:'alice.testnet',role:'Artist',share_bps:6000}]},{id:2,name:'Created by Alice',creator:'alice.testnet',treasury_account:'treasury.testnet',treasury_share_bps:4000,created_at_ms:2,contributors:[{account_id:'other.testnet',role:'Developer',share_bps:6000}]}];
const amount=900719925474099312345678901234n;
function walletBalances(claimable=0n,claimed=0n){return campaigns.map((campaign,index)=>({campaign,claimable:index===0?claimable:0n,claimed:index===0?claimed:0n}));}
(async()=>{
 balances=walletBalances(amount,1n);tokens=[];
 const alice=await model.readWalletDashboard(campaigns,'alice.testnet');assert.equal(alice.claimable,amount);assert.equal(alice.claimed,1n);assert.equal(alice.ownedCount,0);assert.equal(alice.relatedCount,2);assert.ok(alice.rows.some(r=>r.originalContributor&&r.claimable===amount));
 balances=walletBalances();tokens=[{token_id:'campaign:1:right:0',owner_id:'bob.testnet'}];
 const bob=await model.readWalletDashboard(campaigns,'bob.testnet');assert.equal(bob.ownedCount,1);assert.equal(bob.relatedCount,1);assert.equal(bob.rows[0].currentRights,1);assert.equal(bob.claimed,0n);
 tokens=[];const unrelated=await model.readWalletDashboard(campaigns,'unrelated.testnet');assert.equal(unrelated.relatedCount,0);assert.equal(unrelated.claimable,0n);
 failTokens=true;balances=walletBalances(amount,1n);let partial=await model.readWalletDashboard(campaigns,'alice.testnet');assert.equal(partial.claimable,amount);assert.equal(partial.ownedCount,null);assert.equal(partial.relatedCount,null);
 failTokens=false;failBalances=true;tokens=[{token_id:'campaign:1:right:0',owner_id:'bob.testnet'}];partial=await model.readWalletDashboard(campaigns,'bob.testnet');assert.equal(partial.claimable,null);assert.equal(partial.ownedCount,1);
 failBalances=false;balances=walletBalances(amount,1n);tokens=[{token_id:'campaign:1:right:0',owner_id:'wrong.testnet'}];partial=await model.readWalletDashboard(campaigns,'alice.testnet');assert.equal(partial.ownedCount,null);assert.equal(partial.claimable,amount);
 const near=await import('near-api-js');let slots={},cursor=0,effect;const pending=new Map();
 const hooks={...React,useState(initial){const key=cursor++;if(!(key in slots))slots[key]=initial;return[slots[key],value=>{slots[key]=value;}];},useEffect(fn){effect=fn;}};
 const component=load('src/components/dashboard/WalletDashboard.tsx',{react:hooks,'near-api-js':near,'../../lib/dashboard-wallet':{readWalletDashboard:(_items,account)=>new Promise((resolve,reject)=>pending.set(account,{resolve,reject}))},'next/link':{__esModule:true,default:({href,children,...props})=>React.createElement('a',{href,...props},children)}});
 const props={accountId:'alice.testnet',campaigns,campaignError:false,onConnect(){}};
 const render=(extra={})=>{cursor=0;return renderToStaticMarkup(component.default({...props,...extra}));};
 render();const cleanupAlice=effect();pending.get('alice.testnet').resolve(alice);await new Promise(setImmediate);
 assert.ok(render().includes('900719.925474099312345678901234 NEAR'));
 let html=render({accountId:'bob.testnet'});assert.ok(!html.includes('900719.'));assert.ok(!html.includes('alice.testnet'));assert.ok(html.includes('Loading'));
 cleanupAlice();effect();pending.get('bob.testnet').resolve(bob);await new Promise(setImmediate);html=render({accountId:'bob.testnet'});assert.ok(html.includes('Current NFT owner'));assert.ok(!html.includes('900719.'));
 html=render({accountId:null});assert.ok(html.includes('Connect to view your dashboard'));assert.ok(!html.includes('bob.testnet'));
 // An older request completing after a wallet switch cannot replace the new account's view.
 slots={};render();const cancel=effect();render({accountId:'bob.testnet'});cancel();effect();pending.get('bob.testnet').resolve(bob);await new Promise(setImmediate);pending.get('alice.testnet').resolve(alice);await new Promise(setImmediate);assert.ok(!render({accountId:'bob.testnet'}).includes('900719.'));
 console.log('PASS: exact per-wallet totals, current/transferred/creator relationships, unrelated wallet empty state, partial RPC errors, immediate account isolation and late-request cancellation.');
})().catch(error=>{console.error(error);process.exitCode=1});
