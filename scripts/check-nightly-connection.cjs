// Official adapter boundary fixtures: no real wallet connections or transactions.
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const api={},browser={};let now=0,timers=0;
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/nightly-connection.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 exports:api,window:browser,Date:{now:()=>now},setTimeout:callback=>{now+=100;timers++;if(timers===40)browser.nightly={near:{}};callback();},
});
(async()=>{
 await api.waitForNightlyProvider();assert.equal(now,4000,'Delayed mobile injection should outlast the upstream two-second limit');
 delete browser.nightly;await assert.rejects(api.waitForNightlyProvider(200),/provider was not detected/);
 browser.nightly={near:{}};
 assert.match(api.nightlyConnectionError('Wallet denied access').message,/Wallet denied access/);
 assert.match(api.nightlyConnectionError({message:'Unsupported network'}).message,/Unsupported network/);
 assert.match(api.nightlyConnectionError({code:4001}).message,/cancelled/);
 assert.match(api.nightlyConnectionError({code:-32002}).message,/pending/);
 assert.match(api.nightlyConnectionError(undefined).message,/NEAR Testnet/);
 let reject=false;const accounts=[{accountId:'alice.testnet'}],sign=()=>{};
 const factory=async()=>({id:'nightly',metadata:{name:'Nightly'},type:'injected',init:async()=>({signIn:async()=>{if(reject)throw 'Permission denied';return accounts;},signAndSendTransaction:sign})});
 const nightlyModule=await api.withNightlyConnection(factory)({});const wallet=await nightlyModule.init({});
 assert.equal(await wallet.signIn({}),accounts);assert.equal(wallet.signAndSendTransaction,sign);
 reject=true;await assert.rejects(wallet.signIn({}),/Permission denied/);
 assert.equal(await api.withNightlyConnection(async()=>null)({}),null);
 console.log('PASS: delayed/missing mobile provider, error details, cancellation, pending requests, successful accounts and unchanged signing methods.');
})().catch(e=>{console.error(e);process.exitCode=1});
