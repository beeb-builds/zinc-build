# Zinc submission preparation

Rules checked **November 4, 2026** against the
[official hackathon instructions](https://nearhackathon.com/HACKATHON.md).
Recheck them before submission. This document is a draft checklist, not an
application or evidence that the project has been accepted.

## Known project details

| Field | Prepared value |
| --- | --- |
| Project | Zinc |
| Track | NFTs That Do Something (`nfts`) |
| Public repository | <https://github.com/beeb-builds/zinc-build> |
| Hosted Testnet app | <https://zinc-demo-production.up.railway.app> |
| Testnet contract | `zinc-demo-2026.testnet` |
| Judge instructions | [Public tour and two-wallet scenario](JUDGE_DEMO.md) |
| Verification | [Release evidence and open checks](RELEASE_ACCEPTANCE.md) |

The submission deadline is **November 14, 2026, 23:59 UTC**:
**November 15, 00:59 WAT** in Lagos. The rules request keeping a hosted demo
available through November 18, ideally November 25. Testnet is eligible;
integrations are optional. The membership/subaccount prompt is an example, not
a feature Zinc claims to implement.

## Owner decisions and final checks

- License completed: MIT selected by the owner; [LICENSE](../LICENSE) added.
  Third-party dependencies retain their respective licenses.
- Confirm whether Zinc-specific code predates October 19, 2026. The rules permit
  announcement-window development from that date; earlier work needs separation.
  The October 27 `.gitignore` commit is the earliest recorded local commit, not
  proof of when all source code was written. README links the recorded source
  comparison. Establish the actual baseline and final branch/tags before submission.
- Confirm team lead name, contact email and team size. These are not inferred
  from Git author details.
- Supply and verify the team's **MAINNET** prize payout account. The Testnet
  contract address is not a substitute. Never supply a private key or phrase.
- Review the README's library/AI disclosures, source history and public files.
- Finish the manual checks in the release report; ensure hosting stays available.
- Record a truthful demo using the [judge guide](JUDGE_DEMO.md). Label recorded
  evidence and distinguish shared platform statistics from personal earnings.
- The human publishes the X demo post mentioning NEAR HACKATHON, `@NEARProtocol`
  and `#NEARHackathon`, with demo media. Save its public URL for the application.
- Confirm whether Zinc was already submitted. Submit once; use the official
  request-changes process for an existing application.
- Review the exact completed submission payload and contact-consent notice with
  the human before submission. Consent is not assumed from development approval.

## Draft project description for human review

Zinc turns contributor revenue agreements into transferable on-chain rights on
NEAR. Teams create a campaign, define contributor and treasury shares, and mint
NEP-171 revenue-right NFTs. Native NEAR deposits accrue proportionally to the
rightful recipients. After a transfer, the previous owner retains already-earned
revenue while the new owner earns future deposits. Holders can claim earnings,
inspect ownership and available activity, and access a signed holder workspace.
The Testnet prototype includes a personal earnings dashboard, public NFT gallery
and project team rosters. Revenue comes from actual campaign deposits; there is
no guaranteed yield, marketplace or per-NFT subaccount. Recorded two-wallet tests
demonstrate historical/future revenue separation and successful payouts.

## Draft demo-post copy

Built Zinc at NEAR HACKATHON: revenue agreements become NFTs that earn.
Transfer the NFT and future revenue follows its new owner; previously earned
revenue stays with the former owner. See the Testnet demo and public source.
@NEARProtocol #NEARHackathon

Attach the reviewed demo media and actual links when the human publishes.
No post or application is sent by this document.
