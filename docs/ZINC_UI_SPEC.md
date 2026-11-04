# Zinc Dashboard UI Specification

## Product
Zinc is a campaign-based NFT revenue-sharing
platform built on NEAR Protocol.

## Design Direction
Premium Web3 financial dashboard.
Reference: dark navy Creator Earnings dashboard.

## Colors
Background: #07142D
Cards: #122344
Accent Coral: #FF685B
Accent Pink: #FF8E9C
Primary Text: #FFFFFF
Secondary Text: #A9B6CF
Borders: #293954

## Layout
- Consistent application shell across all pages
- Slim desktop sidebar with navigation icons
- Mobile-responsive navigation
- Top header with page title and wallet connection
- Rounded analytics cards with subtle borders
- Responsive charts and tables
- Clear loading, empty, and error states

## Navigation
1. Overview
2. Campaigns
3. My NFTs
4. Earnings
5. Transactions
6. Settings

## Overview Dashboard
- Total campaign revenue
- Active campaigns
- Claimable earnings
- NFTs owned
- Revenue distribution donut chart
- Revenue over time bar chart
- Recent campaign activity

## Campaign Dashboard
- Campaign details and status
- Start date and expiration date
- Revenue allocations
- Contributor NFTs
- Total deposits and claims
- Deposit revenue action
- Campaign transaction history

## My NFTs
- Owned revenue-rights NFTs
- Campaign association
- Ownership percentage
- Unclaimed earnings
- NFT transfer functionality

## Earnings
- Total allocated revenue
- Available claimable balance
- Claimed earnings
- Claim transaction history

## Design Rules
- Maintain the same visual language on every page
- Support desktop, tablet, and mobile
- Use Lucide React for icons
- Use Recharts for analytics
- Use Tailwind CSS for styling
- Clearly label mock data during development
- Never show simulated blockchain actions as real
- Always display transaction confirmation states

## Blockchain
Network: NEAR Testnet
NFT Standard: NEP-171
Smart Contracts: Rust
Payment Asset: Native NEAR
