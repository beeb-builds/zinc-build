// Isolated browser/DOM regression fixture. Never imports a wallet SDK or RPC client.
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { Script } from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "src/components/nfts/MyNfts.tsx"), "utf8");
const sourceHash = createHash("sha256").update(source).digest("hex");
const staticRoot = join(root, ".next/static");
const cssFiles = readdirSync(staticRoot, { recursive: true }).filter((file) => typeof file === "string" && file.endsWith(".css")).sort();
if (!cssFiles.length) throw new Error("Build Zinc first with npm run build so the fixture can use its real compiled styles.");
const appCss = cssFiles.map((file) => readFileSync(join(staticRoot, file), "utf8")).join("\n");
const packageFile = (entry, name) => readFileSync(join(dirname(fileURLToPath(import.meta.resolve(entry))), "cjs", name), "utf8");
const modules = {
  react: packageFile("react", "react.production.js"),
  "react/jsx-runtime": packageFile("react/jsx-runtime", "react-jsx-runtime.production.js"),
  "react-dom": packageFile("react-dom", "react-dom.production.js"),
  "react-dom/client": packageFile("react-dom/client", "react-dom-client.production.js"),
  scheduler: packageFile("scheduler", "scheduler.production.js"),
};
const compile = (path) => ts.transpileModule(readFileSync(join(root, path), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
modules.app = compile("src/components/nfts/MyNfts.tsx");
modules["./RevenueRightCard"] = compile("src/components/nfts/RevenueRightCard.tsx");
modules["./TransferEarningsPreview"] = compile("src/components/nfts/TransferEarningsPreview.tsx");
modules.refresh = compile("src/components/data/ReadCacheSync.tsx");
modules["../data/useReadRefresh"] = compile("src/components/data/useReadRefresh.ts");
modules["next/link"] = "module.exports={__esModule:true,default:'a'};";
modules["lucide-react"] = "module.exports=new Proxy({}, {get:()=>()=>null});";
modules["near-api-js"] = `exports.yoctoToNear=(v)=>{v=BigInt(v);const unit=10n**24n;const f=(v%unit).toString().padStart(24,'0').replace(/0+$/,'');return (v/unit).toString()+(f?'.'+f:'');};`;
modules["../../lib/near"] = "exports.ZINC_CONTRACT_ID='isolated-qa.testnet';";
modules["../../lib/read-scheduler"] = `exports.READS_INVALIDATED='zinc-reads-invalidated';exports.invalidateReadCache=()=>window.dispatchEvent(new Event(exports.READS_INVALIDATED));exports.browserReads={invalidate(){}};exports.isBrowserWriteActive=()=>false;`;
modules["../wallet/WalletProvider"] = `const React=require('react');exports.useWallet=()=>{const accountId=React.useSyncExternalStore(cb=>{window.addEventListener('qa-account',cb);return()=>window.removeEventListener('qa-account',cb)},()=>fixture.account);return {accountId,selector:{},connect(){},isInitializing:false};};`;
modules["../../lib/zinc-contract"] = `
const right=()=>({token_id:'campaign:7:right:0',owner_id:fixture.owner,campaign_id:7,contributor_index:0,role:'Artist',share_bps:6000});
exports.getAllNftTokensForOwner=(account)=>new Promise((ok,fail)=>setTimeout(()=>fixture.fail?fail(new Error('Simulated offline read')):ok(account===fixture.owner?[{token_id:'campaign:7:right:0',owner_id:fixture.owner,metadata:{}}]:[]),700));
exports.getCampaigns=async()=>[{id:7,name:'ISOLATED QA CAMPAIGN',contributors:[{account_id:'alice.testnet',share_bps:6000}]}];
exports.getRevenueRight=async()=>right();exports.getCampaignRights=async()=>[right()];
exports.getNftToken=async()=>({token_id:'campaign:7:right:0',owner_id:fixture.owner});
exports.getClaimable=exports.getClaimed=async()=>'0';`;
modules["../../lib/zinc-write"] = `exports.validateNftReceiver=(value,owner)=>{value=value.trim();if(!value||value===owner)throw new Error('Enter another fixture account');return value;};exports.transferRevenueRightOnNear=async()=>{throw new Error('Signing is disabled in this isolated QA fixture.');};`;
modules["../transactions/TransactionProgress"] = `exports.__esModule=true;exports.default=()=>null;exports.useTransactionProgress=()=>({progress:null,run:async()=>{throw new Error('Signing is disabled in this isolated QA fixture.');}});`;
modules["../../lib/zinc-activity"] = "exports.getSharedActivity=async()=>[];";
modules["../../lib/right-history"] = "exports.previouslyHeldRightIds=()=>new Set();";
modules["../../lib/transaction-journal"] = "exports.validTransactionHash=()=>false;";
modules["./TransferReceipt"] = "exports.__esModule=true;exports.default=()=>null;";

const runner = String.raw`
const React=require('react'),{createRoot}=require('react-dom/client');
createRoot(document.getElementById('app')).render(React.createElement(React.Fragment,null,React.createElement(require('refresh').default),React.createElement(require('app').default)));
const checks=[];
const assert=(value,label)=>{if(!value)throw new Error(label);checks.push(label);const row=document.createElement('li');row.textContent=label;document.getElementById('checks').append(row);document.getElementById('count').textContent=checks.length;};
const wait=async(fn)=>{const start=Date.now();while(!fn()){if(Date.now()-start>8000)throw new Error('Timed out: '+fn);await new Promise(r=>setTimeout(r,25));}};
const button=(name)=>Array.from(document.querySelectorAll('#app button')).find(el=>el.textContent.trim()===name);
const card=()=>document.querySelector('#app article[id]');
const refresh=()=>window.dispatchEvent(new Event('zinc-reads-invalidated'));
const report=async(status,error)=>{document.getElementById('result').textContent=JSON.stringify({status,checks,error},null,2);const summary=document.getElementById('summary');summary.dataset.status=status;document.getElementById('status').textContent=status==='PASS'?'All checks passed':'Test needs attention';document.getElementById('outcome').textContent=status==='PASS'?'The transfer form preserved its draft through refresh, failure and retry. No real wallet or NFT was used.':error;await fetch('/result',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,checks,error,sourceHash:SOURCE_HASH})});};
(async()=>{
  await wait(()=>card()&&button('Refresh NFTs')&&!button('Refresh NFTs').disabled);
  assert(parseFloat(getComputedStyle(card()).borderRadius)>0,'production Zinc styles loaded');
  const details=card().querySelector('details');details.open=true;
  const input=card().querySelector('input');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'bob.testnet');
  input.dispatchEvent(new Event('input',{bubbles:true}));
  await wait(()=>button('Review Transfer')&&!button('Review Transfer').disabled);
  assert(input.value==='bob.testnet','receiver draft entered in real DOM');
  card().querySelector('form').requestSubmit();
  await wait(()=>button('Confirm in wallet'));
  assert(!!card().querySelector('[aria-label="Review revenue-right transfer"]'),'review opened without signing');
  refresh();
  await wait(()=>button('Confirm in wallet').disabled);
  assert(card().querySelector('input')===input&&details.open,'same input and open details preserved during refresh');
  await wait(()=>!button('Confirm in wallet').disabled);
  assert(input.value==='bob.testnet'&&details.open,'receiver and review survive successful refresh');
  await new Promise(r=>setTimeout(r,1100));
  window.dispatchEvent(new Event('focus'));
  await wait(()=>button('Confirm in wallet').disabled);
  await wait(()=>!button('Confirm in wallet').disabled);
  assert(card().querySelector('input')===input&&input.value==='bob.testnet'&&details.open,'real focus listener preserves DOM draft/review');
  fixture.fail=true;refresh();
  await wait(()=>document.querySelector('#app [role="alert"]'));
  assert(button('Confirm in wallet').disabled&&input.value==='bob.testnet'&&details.open,'failed refresh keeps draft and blocks confirmation');
  fixture.fail=false;button('Refresh NFTs').click();
  await wait(()=>!button('Confirm in wallet').disabled);
  assert(input.value==='bob.testnet','retry recovers same draft');
  fixture.owner='bob.testnet';refresh();
  await wait(()=>!card());
  assert(!button('Confirm in wallet'),'lost ownership removes transfer controls');
  fixture.account='bob.testnet';window.dispatchEvent(new Event('qa-account'));
  await wait(()=>card()&&card().querySelector('input'));
  assert(card().querySelector('input').value===''&&!card().querySelector('details').open,'account switch clears prior draft/review');
  assert(fixture.walletCalls===0,'no wallet calls or transactions');
  await report('PASS');
})().catch(error=>report('FAIL',error.message));
`;
const bundle = `(()=>{const process={env:{NODE_ENV:'production'}};const fixture={account:'alice.testnet',owner:'alice.testnet',fail:false,walletCalls:0};const SOURCE_HASH=${JSON.stringify(sourceHash)};const modules={${Object.entries(modules).map(([id, code]) => `${JSON.stringify(id)}:function(module,exports,require){\n${code}\n}`).join(",")}};const cache={};function require(id){if(cache[id])return cache[id].exports;if(!modules[id])throw new Error('Unexpected dependency '+id);const module=cache[id]={exports:{}};modules[id](module,module.exports,require);return module.exports;}\n${runner}\n})();`;
new Script(bundle, { filename: "isolated-nft-refresh.js" });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Zinc isolated DOM QA</title><link rel="stylesheet" href="/app.css"><style>
.qa-shell{max-width:1280px;margin:auto;padding:32px 24px 64px}.qa-header{display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;padding-bottom:28px;border-bottom:1px solid #293954}.qa-brand{display:flex;align-items:center;gap:14px;font-size:20px;font-weight:700}.qa-logo{display:grid;place-items:center;width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,#ff685b,#ff8a9c)}.qa-label{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#ff9988}.qa-back{display:inline-flex;border:1px solid #394965;border-radius:12px;padding:12px 18px;font-size:14px;color:#fff}.qa-back:hover{border-color:#ff9988}.qa-back:focus-visible{outline:2px solid #ff9988;outline-offset:4px}.qa-intro{margin:32px 0 24px}.qa-intro h1{font-size:clamp(26px,4vw,36px);font-weight:600;margin-bottom:12px}.qa-muted{color:#a9b6cf;font-size:14px;line-height:1.7}.qa-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);align-items:start;gap:24px}.qa-report{min-width:0;padding:24px;border:1px solid #293954;border-radius:20px;background:#10213d}.qa-report[data-status="PASS"]{border-color:#69dab850}.qa-report[data-status="FAIL"]{border-color:#ff7568}.qa-report h2{font-size:22px;font-weight:600;margin:12px 0}.qa-count{display:inline-block;border-radius:99px;padding:6px 12px;background:#0b1933;color:#69dab8;font-size:12px}.qa-report ol{list-style:none;padding:0;margin:24px 0}.qa-report li{font-size:13px;line-height:1.6;color:#c5d1e4;padding:12px 0 12px 22px;border-top:1px solid #293954;position:relative}.qa-report li:before{content:'✓';position:absolute;left:0;color:#69dab8}.qa-report details{border-top:1px solid #293954;padding-top:16px}.qa-report summary{cursor:pointer;font-size:13px;color:#ff9988}.qa-report pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;line-height:1.6;color:#a9b6cf;margin-top:16px}.qa-preview{min-width:0;border:1px solid #293954;border-radius:20px;padding:24px;background:#0b1933}.qa-preview-label{padding-bottom:16px;border-bottom:1px solid #293954;margin-bottom:24px}.qa-preview #app>div{margin:0}.qa-footer{margin-top:28px;font-size:12px;color:#8194ae;line-height:1.7}.qa-footer code{overflow-wrap:anywhere}@media(max-width:900px){.qa-layout{grid-template-columns:minmax(0,1fr)}}@media(max-width:480px){.qa-shell{padding:20px 14px 40px}.qa-preview,.qa-report{padding:18px}}
</style><script defer src="/bundle.js"></script></head><body><main class="qa-shell"><header class="qa-header"><div class="qa-brand"><span class="qa-logo">Z</span><div>Zinc <div class="qa-label">Isolated UI verification</div></div></div><a class="qa-back" href="http://localhost:3000/nfts">Return to Zinc app ↗</a></header><section class="qa-intro"><h1>Transfer refresh checks</h1><p class="qa-muted">A local test of the real NFT components using fixture accounts. Wallet signing and NEAR RPC are blocked. The preview below is test data, not your portfolio.</p></section><div class="qa-layout"><section id="summary" class="qa-report" aria-labelledby="status"><span class="qa-count"><span id="count">0</span> checks passed</span><h2 id="status" role="status" aria-live="polite">Running checks…</h2><p id="outcome" class="qa-muted">Checking draft preservation, ownership refresh and account isolation.</p><ol id="checks" aria-label="Passed checks"></ol><details><summary>Technical test result</summary><pre id="result">RUNNING</pre></details></section><section class="qa-preview" aria-label="Isolated component preview"><p class="qa-label qa-preview-label">Component preview · fixture accounts only</p><div id="app"></div></section></div><footer class="qa-footer">No real funds, NFT ownership or wallet session are changed by this test.<br>Tested MyNfts source: <code>${sourceHash}</code></footer></main></body></html>`;
const origin = "http://127.0.0.1:3102";
const server = createServer((req, res) => {
  res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET" && req.url === "/") { res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(html); }
  else if (req.method === "GET" && req.url === "/bundle.js") { res.setHeader("Content-Type", "text/javascript; charset=utf-8"); res.end(bundle); }
  else if (req.method === "GET" && req.url === "/app.css") { res.setHeader("Content-Type", "text/css; charset=utf-8"); res.end(appCss); }
  else if (req.method === "POST" && req.url === "/result" && req.headers.origin === origin) {
    let body = "";
    req.on("data", (chunk) => { body += chunk; if (body.length > 16384) req.destroy(); });
    req.on("end", () => {
      try {
        const result = JSON.parse(body);
        if (!["PASS", "FAIL"].includes(result.status) || result.sourceHash !== sourceHash || !Array.isArray(result.checks) || result.checks.some((item) => typeof item !== "string" || item.length > 200)) throw new Error("Invalid report");
        mkdirSync(join(root, "data"), { recursive: true });
        const evidence = { ...result, sourceHash, capturedAt: new Date().toISOString(), isolated: true, realReactDom: true, walletOrRpcAccess: false };
        writeFileSync(join(root, "data/nft-refresh-browser-results.json"), JSON.stringify(evidence, null, 2)+"\n");
        console.log(JSON.stringify(evidence)); res.end("Saved");
      } catch { res.writeHead(400); res.end("Invalid report"); }
    });
  } else { res.writeHead(404); res.end("Not found"); }
});
server.listen(3102, "127.0.0.1", () => console.log(`Isolated NFT DOM QA: ${origin} — no wallet or RPC access; source ${sourceHash}`));
