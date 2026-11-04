# Zinc revenue-right NFTs: accounting and migration review

This implementation is not deployed. It adds no marketplace, NFT UI, or transfer UI.

## State and NFT implementation

The contract pins `near-sdk` and the official `near-contract-standards` to 5.30.0.
It embeds `NonFungibleToken` with ownership, token metadata, and owner enumeration.
NEP-178 approval management is disabled; owners can transfer their tokens. Minting
is internal to campaign creation and migration. There is no arbitrary public mint.

Every contributor slot receives exactly one token:

`campaign:{campaign_id}:right:{zero_based_contributor_index}`

The decimal IDs have no leading zeroes. For example, the first contributor in
campaign 2 owns `campaign:2:right:0`. Slots, roles, shares, and campaign bindings
cannot be changed. The campaign's original contributor wallet is historical
data; the NFT owner is the current beneficiary. Treasury remains account-based.

Metadata supplies title, description, and JSON `extra` containing campaign ID,
campaign name, contributor index, role, and basis-point share. No external media
is invented. The official implementation emits NEP-171 mint/transfer events.

The existing `campaigns` and `claims` fields retain their types and data. New fields:

- `tokens`: official NFT storage, using `zinc:nft:v1:*` top-level prefixes.
- `rights`: immutable slot data plus each token's deposited-total checkpoint.
- `accrued`: per `(campaign_id, account_id)` historical whole yoctoNEAR credits
  and a remainder measured in 1/10,000 yoctoNEAR.
- `treasury_checkpoints`: deposited totals already included in historical credits.

## Revenue checkpoints

For each right, let `D` be the campaign's lifetime deposited total, `C` its last
ownership checkpoint, and `s` its basis-point share. Its owner earns exactly
`(D - C) * s / 10_000` during that ownership interval, including the fractional
remainder. All calculations use checked integers. Division splits the deposit
into quotient and remainder before multiplication to avoid intermediate u128
overflow.

Before any ownership change, the full interval is credited to the outgoing
owner's historical account ledger, and `C` advances to `D`. The new owner starts
at that checkpoint. A view adds the account's historical credits, current NFT
intervals, and any treasury interval, then floors the aggregate to whole
yoctoNEAR. It subtracts existing claimed reservations to produce `get_claimable`.

Fractions stay with the account that earned them and may combine with that
account's later revenue. A buyer never receives a seller's fractional debt or
historical balance. Deposits and claims do not reset token checkpoints, so
claim timing cannot create extra rounding loss. Total whole claims cannot exceed
deposits; sub-yocto remainders stay held until earned fractions accumulate.

Existing claimed and pending balances remain account-based. A claim made before
a transfer still pays its original claimant. If it fails, the existing private
payout callback restores that same account's claimability. A former owner can
claim historical credits without still holding an NFT.

## NEP-171 transfer paths

`nft_transfer` requires exactly one yoctoNEAR and delegates authorization,
ownership, enumeration, and events to the official implementation, after the
revenue checkpoint.

`nft_transfer_call` follows the same standard ownership behavior and receiver
callback protocol. Its promise wiring reserves 40 Tgas for Zinc's resolver,
rather than the library's default 5 Tgas, and requires at least 100 Tgas attached
to the initiating call. Remaining gas is forwarded to the receiver.

The private resolver uses the official return/forwarding logic. If the token
will actually return, it checkpoints the temporary receiver's ownership interval
before returning it. If the receiver already forwarded it, the resolver does not
overwrite that later owner's checkpoint or ownership. Deposits made while a
receiver is the on-chain owner belong to that receiver, even if it later returns
the token. Receiver failure or malformed results trigger standard return behavior.

## Migration

```rust
#[init(ignore_state)]
#[private]
pub fn migrate_nfts() -> Self
```

`ClaimsZincContract` explicitly matches the deployed Borsh layout:

```text
campaigns: Vec<Campaign>  // Campaign includes total_deposited_yocto
claims: BTreeMap<(u64, AccountId), ClaimBalance>  // claimed, then pending
```

The migration reads raw `STATE`, rejects missing/malformed or wrong-schema
data, and retains the campaign vector and claim map without reconstruction.
For each campaign it aggregates each original beneficiary's contributor and
treasury shares, credits their full historical entitlement INCLUDING fractional
remainder, and initializes NFT and treasury checkpoints at the current deposited
total. This preserves the previous account-level rounding even when an account
holds several roles or is also the treasury. Each contributor receives its NFT.
Existing payout callbacks retain their signatures and accounting keys.

`ZINC_NFT_SCHEMA_MIGRATED_V1` prevents replay, including empty state. Existing
migration markers are preserved. Older migration entrypoints are retained for
compatibility/tests but are not the entrypoint for this upgrade. Use
`migrate_nfts`, not `new`, `migrate`, or `migrate_claims` on the live claims schema.

## Storage and operational constraints

Zinc sponsors NFT storage, keeping the existing non-payable campaign creation
flow. Migration, creation, claims, and NFT ownership changes require contract
balance to cover predicted storage stake separately from beneficiary liabilities.
The check includes the generated wrapper's final serialized `STATE` size and
official NFT collection entries already written in the receipt. Pending payouts
are conservatively treated as still owed until their callback settles.

The representative test fixture (two campaigns, six NFTs, three owners, two
existing claim entries) adds **6,599 bytes**, or **0.06599 NEAR** at
10^19 yoctoNEAR per byte. This is an example, not a quote for live state. Metadata
length, distinct owners, token ID length, and claim history change the cost.
Transfers may also add historical beneficiary ledger entries over time.
WASM/code growth requires additional storage stake beyond that measured delta.

The built artifact is **402,252 bytes**. Compared with the previous local claims
artifact of 185,860 bytes, that is 216,392 additional bytes, approximately
**2.16392 NEAR** of extra code storage stake at the same byte price. Combined
with the representative six-NFT state delta, the example incremental stake is
about **2.22991 NEAR**. Confirm the actual deployed code size and live state before
using this as a funding estimate; it is not the contract's total required balance.
The full required balance also includes existing storage and all outstanding
beneficiary revenue.

Before deployment:

1. Back up the live raw state and verify its schema against this migrator.
2. Rehearse the atomic deploy-and-`migrate_nfts` batch against that snapshot in a
   NEAR sandbox, including successful and failed payout/receiver receipts.
3. Fund sufficient storage reserve independently of deposited revenue; include
   code growth, future NFT recipients, historical credits, and pending payouts.
4. Verify gas with actual state size. Campaigns and accounting maps are serialized
   inline; migration and callbacks get more expensive as they grow. The one-shot
   migration must fit the protocol transaction gas limit. If it does not, this
   release needs a staged migration design before deployment.

Unit tests use the NEAR mock storage/context and inspect promises and callbacks;
they do not prove full sandbox execution or gas limits. A callback that runs out
of gas may leave a payout pending or an NFT transfer-call unresolved. There is
no administrative payout-reset mechanism in this milestone. Keep reserve and
gas headroom, and do not deploy until the design and snapshot rehearsal are reviewed.

Frontend changes are read-only types and view helpers. The existing campaign,
deposit, and claim UIs are unchanged; after transfers, original contributor wallet
labels remain historical while the new right views report current owners.
