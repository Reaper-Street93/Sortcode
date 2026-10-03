// Everything on the Caxton desk page that isn't the model: playbooks, codes,
// customer themes and sources. Built only from public information, retrieved
// 3 October 2026. Nothing internal to Caxton and no customer data.
//
// Where Caxton's own practice isn't published, a playbook says what to check
// rather than stating a policy.

export const RETRIEVED = "3 October 2026";

export const SOURCES = {
  terms: {
    name: "Caxton Mastercard Prepaid Card terms and conditions",
    url: "https://caxton.io/legal-hub/terms-and-conditions/caxton-mastercard-prepaid-card",
  },
  cards: { name: "Caxton Currency Card page", url: "https://www.caxton.io/cards" },
  sc: { name: "Thredd Smart Client Guide v3.6", url: "https://docs.thredd.ai/pdf/Smart_Client_Guide_3.6.pdf" },
  codes: {
    name: "Thredd Card Status and Response Codes v1.7",
    url: "https://docs.thredd.com/pdf/Card_Status_Reponse_Codes_Changes_1.7.pdf",
  },
  cko: {
    name: "Checkout.com API response codes",
    url: "https://www.checkout.com/docs/developer-resources/codes/api-response-codes",
  },
  thredd: {
    name: "Thredd renews and expands partnership with Caxton (2 June 2026)",
    url: "https://www.businesswire.com/news/home/20260602884868/en/Thredd-Renews-and-Expands-Partnership-with-Caxton",
  },
  trustpilot: { name: "Caxton on Trustpilot", url: "https://uk.trustpilot.com/review/caxton.io" },
  appstore: { name: "Caxton Currency Card on the App Store", url: "https://apps.apple.com/gb/app/caxton-currency-card/id687286642" },
  play: { name: "Caxton Currency Card on Google Play", url: "https://play.google.com/store/apps/details?id=com.caxtonfx.mobile&hl=en_GB" },
  currencyexpert: { name: "Currency Expert: Caxton review", url: "https://www.currencyexpert.com/reviews/caxton/" },
  finder: { name: "Finder: Caxton FX review", url: "https://www.finder.com/uk/travel-money/caxton-review" },
};

// System tags used in "where to look" steps.
export const SYSTEMS = {
  sc: "Smart Client",
  cko: "Checkout dashboard",
  terms: "Terms",
  app: "Customer's app",
  payments: "Payments platform",
  none: "Check",
};

export const PLAYBOOKS = {
  card_declined: {
    title: "Card declined at a shop or online",
    where: [
      ["sc", "Card Activity › View Transactions, find the card, right-click › Show All results for the Card. Open the declined authorisation and read its response code (look it up below)."],
      ["sc", "Check the card's status: a G-code or 59 means a block is on, 54 means expired, 51 means not enough balance."],
      ["sc", "For online declines, check the 3-D Secure details on the transaction."],
      ["terms", "Hotels, car hire and pay-at-the-pump place pre-authorisation holds that can make a card decline even with money on it."],
    ],
    reply: "Sorry your card was declined at [merchant]. I've looked at the payment and it was declined because [reason]. [Next step]. If you were paying at a fuel pump or a hotel, they often hold more than the bill, so paying at the till or desk usually works.",
    facts: [
      ["Spending in a currency that isn't loaded draws on the other balances in a fixed order (GBP, EUR, USD and so on) with a 2.49% mark-up, so a balance can look sufficient and still fall short.", "terms"],
      ["Fuel pumps can pre-authorise £100 or more; hotels and car hire can add 20% or more, and holds can take up to 30 days to drop off.", "terms"],
      ["Card payments are limited to 20 in 24 hours.", "terms"],
    ],
  },
  atm_declined: {
    title: "Cash machine declined the card",
    where: [
      ["sc", "View Transactions › the ATM authorisation › response code. 61 means the amount limit, 65 the frequency limit, 75 too many PIN tries."],
      ["terms", "Daily limits: 2 ATM withdrawals and £300 in 24 hours."],
      ["sc", "If the code is 75, see the PIN-blocked playbook."],
    ],
    reply: "Sorry the cash machine wouldn't pay out. The card allows [2 withdrawals / £300] in 24 hours, and [today's attempts]. [If not limits: the machine's bank declined it before it reached us, which some machines do with prepaid cards, so another bank's machine should work.] Caxton doesn't charge for withdrawals abroad, but the machine's owner may.",
    facts: [
      ["ATM limits: 2 withdrawals and £300 per 24 hours; a single withdrawal is capped at £300.", "terms"],
      ["Caxton charges nothing for ATM withdrawals abroad, and £1.50 in the UK on the published fee schedule. ATM operators can add their own fees.", "terms"],
    ],
  },
  card_swallowed: {
    title: "A cash machine kept the card",
    where: [
      ["sc", "Change Card Status to block the card (it may be retrieved by someone else), then order a replacement."],
      ["sc", "Check View Transactions for any use after the card was kept."],
    ],
    reply: "Sorry the machine kept your card. I've blocked it so nobody else can use it, and I can order you a replacement to [address]. Your balance is safe and will move to the new card.",
    facts: [["A replacement card for a damaged, lost or stolen card costs £5.", "terms"]],
  },
  pin_blocked: {
    title: "PIN blocked",
    where: [
      ["sc", "View Transactions: confirm declines with code 75 (allowable PIN tries exceeded)."],
      ["sc", "Actions › SMS PIN to Cardholder. This queues a PIN unblock script that reaches the chip on the card's next online chip-and-PIN use."],
      ["sc", "That first transaction after the unblock is declined while the script runs. If declines continue, send another unblock and suggest an ATM."],
    ],
    reply: "I've reset your PIN tries. To finish unblocking, use your card with your PIN at a cash machine or a chip-and-PIN terminal. That first attempt may decline while the card updates, then it'll work normally. You can see your PIN in the app with PIN reveal if you need it.",
    facts: [
      ["The PIN is available any time through PIN reveal in the online account or app.", "terms"],
      ["After a PIN unblock, the first transaction at an online chip terminal is declined while the script unblocks the chip.", "sc"],
    ],
  },
  pin_info: {
    title: "Finding or changing the PIN",
    where: [["app", "PIN reveal in the app or online account shows the current PIN."]],
    reply: "You can see your PIN any time with PIN reveal in the app. [If you change it at a cash machine that offers PIN change, the app will show the new PIN.]",
    facts: [
      ["PIN reminders are free through the online account or app.", "terms"],
      ["If the PIN is changed at an ATM, the online account and app still show the new PIN.", "terms"],
    ],
  },
  lost_card: {
    title: "Card lost or stolen",
    where: [
      ["sc", "Change Card Status to lost (41) or stolen (43). Both are permanent: the card can never be approved again."],
      ["sc", "View Transactions: go through recent activity with the customer and note anything they don't recognise."],
      ["none", "Order a replacement; the balance carries over."],
    ],
    reply: "I've blocked your card so it can't be used. Let's check your recent payments together. Is there anything here you don't recognise? I'll order a replacement to [address], and your balance moves across to it.",
    facts: [
      ["Lost or stolen cards can be reported 24 hours a day on 0333 123 1812, or +44 20 7201 0526 from abroad.", "terms"],
      ["Before reporting, a cardholder's liability is capped at £35, unless they acted fraudulently or with gross negligence.", "terms"],
      ["Replacement card fee: £5.", "terms"],
    ],
  },
  lost_phone: {
    title: "Phone lost or stolen",
    where: [
      ["sc", "Check device tokens: View Transactions › an authorisation › More details › Card Details. Form Factor shows each wallet device; suspend the token on the lost phone."],
      ["none", "If card details were stored on the phone, treat it like a lost card."],
    ],
    reply: "Sorry about your phone. I've stopped your card working in the wallet on that phone. Your physical card still works, unless you think someone may have its details too, in which case I'll block it and send a new one.",
    facts: [["Apple Pay and Google Wallet are supported; each phone or watch holds its own token.", "cards"]],
  },
  unrecognised: {
    title: "Payment or withdrawal they don't recognise",
    where: [
      ["sc", "Block the card first: Change Card Status (a G-code for a temporary block while you investigate, or 43 if stolen)."],
      ["sc", "View Transactions: identify the disputed items. Check whether the card was present (chip/PIN) or not (online)."],
      ["sc", "Card Activity › Chargebacks to raise a dispute; record confirmed fraud for the scheme's fraud reporting (SAFE for Mastercard)."],
    ],
    reply: "Thanks for telling us straight away. I've blocked your card to stop any more payments. Can you confirm which payments you don't recognise? You'll also need to confirm them in writing by email, and we'll investigate and refund any unauthorised payment as the terms set out.",
    facts: [
      ["Unauthorised payments must be reported without undue delay, and within 13 months of the debit date.", "terms"],
      ["The cardholder isn't liable for online (card-not-present) fraud, or anything after reporting, unless they acted fraudulently.", "terms"],
      ["Disputed transactions must be confirmed in writing with the details and receipts.", "terms"],
    ],
  },
  hold_pending: {
    title: "Payment showing as pending, or reversed",
    where: [
      ["sc", "View Transactions: is it still an authorisation (a hold) or has the merchant sent the final amount (presentment)? Check linked transaction details."],
      ["terms", "Holds from hotels, car hire and fuel pumps can last up to 30 days."],
    ],
    reply: "That's a hold the merchant placed when you paid, not a final charge. It drops off when [merchant] sends us the final amount, usually within a few days, though the terms allow up to 30. If it hasn't cleared by [date], come back to us and we'll chase it.",
    facts: [["Pre-authorisation holds stay until the merchant sends the final amount, up to 30 days.", "terms"]],
  },
  charged_wrong: {
    title: "Charged twice, or the wrong amount",
    where: [
      ["sc", "View Transactions › right-click › linked transaction details. A 'double charge' is often a hold plus the final payment, where the hold drops off."],
      ["sc", "If it really is two settled payments: Card Activity › Chargebacks."],
      ["sc", "Wrong cash from an ATM: check the authorisation amount against what the customer received; this can go to a chargeback."],
    ],
    reply: "Let me check that for you. [It's a temporary hold alongside the real payment, and the hold will drop off by itself.] / [You were charged twice, so I'll raise a dispute with the merchant's bank; please email us the receipt.]",
    facts: [
      ["Because it's a prepaid card, credit-card protections against a merchant don't apply; the customer must try the merchant first.", "terms"],
      ["An authorised payment where the final amount wasn't known in advance can be refunded if claimed within 8 weeks; a decision follows within 10 business days.", "terms"],
    ],
  },
  merchant_refund: {
    title: "Refund from a merchant",
    where: [
      ["sc", "View Transactions: look for the merchant's credit. Refunds still post to a blocked card, unless it's fully blocked (G2, G4, G6, G8)."],
      ["none", "If the merchant hasn't refunded, the customer needs to have tried the merchant before a dispute."],
    ],
    reply: "Refunds are sent by the merchant, so they show up once [merchant] processes theirs. That usually takes a few working days. If they've given you a refund reference and it's not here after [5 working days], send it over and I'll trace it. If they won't refund, let's look at whether a dispute is possible.",
    facts: [
      ["For disputes with merchants, the cardholder must first have made every effort to resolve it with the merchant.", "terms"],
      ["Refunds still post to cards on a debit-only block, but not on a full block.", "codes"],
    ],
  },
  exchange_rates: {
    title: "Exchange rates and currencies",
    where: [
      ["terms", "15 card currencies, in priority order: GBP, EUR, USD, AUD, CAD, NZD, HKD, CHF, JPY, DKK, ZAR, PLN, SEK, NOK, HUF."],
      ["terms", "Spending in a non-card currency uses the Mastercard rate plus a 2.49% mark-up; between card currencies, Caxton sets the daily rate."],
      ["sc", "For a 'wrong rate' complaint: View Transactions, compare the billing amount with the rate on the transaction date."],
    ],
    reply: "Your card holds [currency], so payments in it use that balance with no fee. When you spend in a currency the card doesn't hold, it converts from your other balances at Mastercard's rate plus 2.49%. That's probably the difference you saw on [date]. [If they're comparing with the rate on the app's home screen, explain which rate applied to their top-up.]",
    facts: [
      ["The card can hold 15 currencies, or the customer can load GBP and convert as they go.", "cards"],
      ["Non-card-currency spending: converted at Mastercard's rate with a 2.49% FX mark-up.", "terms"],
    ],
  },
  fees: {
    title: "A fee they didn't expect",
    where: [
      ["terms", "Published fee schedule: UK ATM £1.50, UK card payment £1.50, ATM balance check 30p, over-the-counter cash £4.50 + 2%, 2.49% for non-card currencies."],
      ["sc", "View Transactions: find the fee line and the transaction it belongs to."],
    ],
    reply: "That's the [fee] from the card's fee schedule, charged when [reason]. I know it's annoying. [If it looks wrong, I'll look into a refund.] You can avoid it next time by [how].",
    facts: [
      ["Domestic ATM and domestic card payments: £1.50 each. Abroad: no Caxton fee.", "terms"],
      ["ATM balance enquiry: 30p; online balance checks are free.", "terms"],
    ],
  },
  account_fee: {
    title: "The £2 monthly account management fee",
    where: [
      ["terms", "£2 a month, charged only after 12 months with no transactions, card loads or balance switches."],
      ["sc", "View Transactions: confirm the last activity date and how many fees have been taken."],
      ["sc", "If a refund is agreed, Actions › Balance Adjustment, with the fee reversal as the reason."],
    ],
    reply: "That's the account management fee: £2 a month, which only starts after 12 months with no spending, top-ups or balance switches. Any use of the card stops it. [I can see it's been charged since [date].] If you'd rather close the account, I can arrange to return your balance.",
    facts: [["Account management fee: £2 per month after 12 months with no transactions, card loads or balance switches.", "terms"]],
    related: ["A final-year project that warned customers at 6 months, before this fee starts", "https://github.com/Reaper-Street93/FYP"],
  },
  topup_failed: {
    title: "Top-up failed or didn't arrive",
    where: [
      ["cko", "Payments › Processing › All payments, search the customer's top-up, open it and read the response code (look it up below). Most 20xxx codes are declines from the customer's own bank."],
      ["sc", "If Checkout shows it approved: View Transactions on the card to confirm the load posted."],
      ["terms", "Limits: £50 minimum, 2 loads in 24 hours, £10,000 per load, £12,000 balance, £50,000 a year."],
    ],
    reply: "I've checked your top-up from [date]. [It was declined by your bank with the reason '[reason]', so it never left your account; please try again or use another card.] / [It went through and is on your card now.] Top-ups need to be at least £50, and you can top up twice in 24 hours.",
    facts: [
      ["Minimum load £50; maximum 2 loads per 24 hours; balance cap £12,000.", "terms"],
      ["Funds are usually available within minutes once loaded.", "terms"],
      ["20051 means the customer's own bank declined for insufficient funds; 20151 means they failed 3-D Secure.", "cko"],
    ],
  },
  topup_howto: {
    title: "How to top up, and top-up limits",
    where: [["terms", "Top up online, by phone or in the app; the first load must be online."]],
    reply: "You can top up in the app, online or by phone. The minimum is £50, you can top up twice in 24 hours, and your card can hold up to £12,000 in total.",
    facts: [
      ["Load options: internet, phone, app. The first load must be online.", "terms"],
      ["Limits: £50 minimum, £10,000 per load, 2 per 24 hours, £12,000 balance, £50,000 a year.", "terms"],
    ],
  },
  balance_not_updated: {
    title: "Money sent in hasn't shown on the balance",
    where: [
      ["payments", "Check whether the incoming payment has been received and matched to the account."],
      ["sc", "View Transactions: confirm whether a load has posted to the card."],
    ],
    reply: "Let me check where your money is. [It's arrived and I've added it to your card.] / [It hasn't reached us yet. Bank transfers can take [time]; if your bank shows it's sent, a payment reference will help me trace it.]",
    facts: [["Once a load is processed, funds are usually on the card within minutes.", "terms"]],
  },
  transfers: {
    title: "International payment (transfer)",
    where: [
      ["payments", "International payments are a separate product with their own terms; check the payment's status there."],
      ["none", "For a payment that's left but not arrived, the recipient's bank details and the payment reference are the first things to confirm."],
    ],
    reply: "Let me look at your payment of [amount] to [recipient]. [It's on its way and should arrive by [date].] / [It's been held because [reason], and here's what we need.] Can you confirm the recipient's bank details?",
    facts: [],
    caution: "BANKING77 comes from an app where transfers are part of the card. At Caxton, international payments are their own product, so these tickets go to that team.",
  },
  card_delivery: {
    title: "Ordering, receiving or activating a card",
    where: [
      ["sc", "Card status: 02 or 72 means not yet activated."],
      ["none", "Check the order and dispatch date against the published delivery time."],
    ],
    reply: "Your card was ordered on [date] and sent to [address]. [It should arrive by [date].] / [It's on its way but not activated yet, which you can do in the app once it arrives.]",
    facts: [
      ["The first card is free; a secondary card costs £5; renewal is free.", "terms"],
      ["Additional cardholders must be 13 or over.", "terms"],
    ],
  },
  virtual_card: {
    title: "Virtual or disposable cards",
    where: [["none", "Check whether this product is offered before answering."]],
    reply: "[If offered: here's how.] / [We don't offer virtual cards on this account at the moment, but you can add your card to Apple Pay or Google Wallet to pay by phone.]",
    facts: [["Apple Pay and Google Wallet are supported.", "cards"]],
    caution: "BANKING77 includes disposable virtual cards; check whether the product exists before replying.",
  },
  wallets: {
    title: "Apple Pay, Google Wallet and card linking",
    where: [["sc", "View Transactions › an authorisation › More details › Card Details. Form Factor lists each device and whether its token is active."]],
    reply: "You can add your Caxton card to Apple Pay or Google Wallet from the app. [I can see your [device] is set up and active.] / [I can see the token on your [device] is inactive, so let's re-add the card.]",
    facts: [["Apple Pay and Google Wallet are supported.", "cards"]],
  },
  identity: {
    title: "Verifying identity",
    where: [["none", "KYC is required before the card can be used; check which document or check is outstanding."]],
    reply: "We have to confirm who you are and your address before you can use the card. It's a legal requirement for e-money accounts. [We still need [document].] Once it's in, we'll aim to confirm it quickly.",
    facts: [["Applicants must be 18 or over and UK resident, with evidence of identity and address for KYC checks.", "terms"]],
  },
  eligibility: {
    title: "Who can have a card",
    where: [["terms", "Applicants must be 18+ and UK resident; additional cardholders 13+."]],
    reply: "To open a card you need to be 18 or over and live in the UK. Family members aged 13 or over can have an additional card on your account.",
    facts: [["18+ and UK resident to apply; additional cardholders 13+.", "terms"]],
  },
  source_of_funds: {
    title: "Source of funds checks",
    where: [["none", "A compliance request: route to the team handling it and don't speculate about the reason."]],
    reply: "We sometimes need to understand where funds come from. It's a regulatory check, not an accusation. Please send [documents] and the team will review them.",
    facts: [],
  },
  close_account: {
    title: "Closing the account",
    where: [
      ["terms", "Cancellation is requested by email to info@caxton.io from the registered address; the balance is returned after checks."],
      ["sc", "Once settled, the final status is permanent (46 closed, 98 refund given)."],
    ],
    reply: "Sorry to see you go. Email info@caxton.io from your registered address to close the account. Once any pending payments have cleared and we've completed the required checks, we'll return your balance to you.",
    facts: [
      ["Closure is by email from the registered address; the balance is refunded after AML/KYC checks and once all transactions have cleared.", "terms"],
      ["A £1.50 redemption processing fee may apply in some circumstances (see the terms).", "terms"],
    ],
  },
  personal_details: {
    title: "Changing personal details",
    where: [["none", "Update the details, verifying the change as the security process requires."]],
    reply: "I can update that for you. [Steps to verify the change.]",
    facts: [["Customers must tell Caxton promptly about changes to name, address, phone or email.", "terms"]],
  },
  app_access: {
    title: "App passcode or login",
    where: [["app", "Help the customer reset access in the app."]],
    reply: "No problem. [Steps to reset the app passcode.] Your card keeps working in the meantime.",
    facts: [],
  },
  card_info: {
    title: "Where the card works",
    where: [["terms", "Accepted wherever Mastercard is; acceptance by any one merchant or ATM isn't guaranteed."]],
    reply: "Your card works anywhere that takes Mastercard, over 35 million places. Caxton doesn't charge for spending or withdrawals abroad, though some cash machines add their own fee.",
    facts: [
      ["Usable anywhere Mastercard is accepted.", "cards"],
      ["No merchant or ATM is guaranteed to accept the card.", "terms"],
    ],
  },
};

// Which playbook answers each of the 77 intents the model can return.
export const PLAYBOOK_OF = {
  declined_card_payment: "card_declined", card_not_working: "card_declined", contactless_not_working: "card_declined",
  declined_cash_withdrawal: "atm_declined", card_swallowed: "card_swallowed",
  pin_blocked: "pin_blocked", change_pin: "pin_info",
  lost_or_stolen_card: "lost_card", lost_or_stolen_phone: "lost_phone",
  compromised_card: "unrecognised", card_payment_not_recognised: "unrecognised",
  cash_withdrawal_not_recognised: "unrecognised", direct_debit_payment_not_recognised: "unrecognised",
  pending_card_payment: "hold_pending", pending_cash_withdrawal: "hold_pending", "reverted_card_payment?": "hold_pending",
  transaction_charged_twice: "charged_wrong", extra_charge_on_statement: "charged_wrong", wrong_amount_of_cash_received: "charged_wrong",
  request_refund: "merchant_refund", Refund_not_showing_up: "merchant_refund",
  exchange_rate: "exchange_rates", card_payment_wrong_exchange_rate: "exchange_rates",
  wrong_exchange_rate_for_cash_withdrawal: "exchange_rates", exchange_charge: "exchange_rates",
  exchange_via_app: "exchange_rates", fiat_currency_support: "exchange_rates", supported_cards_and_currencies: "exchange_rates",
  card_payment_fee_charged: "fees", cash_withdrawal_charge: "fees", transfer_fee_charged: "fees",
  top_up_by_card_charge: "fees", top_up_by_bank_transfer_charge: "fees",
  top_up_failed: "topup_failed", top_up_reverted: "topup_failed", pending_top_up: "topup_failed", verify_top_up: "topup_failed",
  topping_up_by_card: "topup_howto", top_up_limits: "topup_howto", automatic_top_up: "topup_howto",
  top_up_by_cash_or_cheque: "topup_howto", transfer_into_account: "topup_howto",
  balance_not_updated_after_bank_transfer: "balance_not_updated", balance_not_updated_after_cheque_or_cash_deposit: "balance_not_updated",
  cancel_transfer: "transfers", failed_transfer: "transfers", pending_transfer: "transfers",
  transfer_not_received_by_recipient: "transfers", transfer_timing: "transfers", beneficiary_not_allowed: "transfers",
  declined_transfer: "transfers", receiving_money: "transfers",
  card_arrival: "card_delivery", card_delivery_estimate: "card_delivery", order_physical_card: "card_delivery",
  get_physical_card: "card_delivery", getting_spare_card: "card_delivery", card_about_to_expire: "card_delivery",
  activate_my_card: "card_delivery",
  getting_virtual_card: "virtual_card", get_disposable_virtual_card: "virtual_card",
  disposable_card_limits: "virtual_card", virtual_card_not_working: "virtual_card",
  apple_pay_or_google_pay: "wallets", card_linking: "wallets",
  verify_my_identity: "identity", why_verify_identity: "identity", unable_to_verify_identity: "identity",
  age_limit: "eligibility", country_support: "eligibility", verify_source_of_funds: "source_of_funds",
  terminate_account: "close_account", edit_personal_details: "personal_details", passcode_forgotten: "app_access",
  atm_support: "card_info", card_acceptance: "card_info", visa_or_mastercard: "card_info",
};

// BANKING77 has no intent for the account management fee, which is one of
// the most common review complaints, so it's caught by keywords first.
export const ACCOUNT_FEE = /\bdorman\w*|\binactiv\w*|\baccount management fee|£2 (a|per|every) month|\bmonthly fee\b/i;

// Decline and status codes an agent meets. Thredd: when the customer's
// Caxton card is declined. Checkout.com: when their top-up from another
// card is declined by that card's bank.
export const CODES = [
  { code: "51", src: "codes", where: "Caxton card", meaning: "Insufficient funds", merchant: "Try again", tell: "There wasn't enough balance, counting all currencies and fees. Top up, or check for holds." },
  { code: "54", src: "codes", where: "Caxton card", meaning: "Expired card", merchant: "Updated info needed", tell: "The card has expired. The renewal card should be used instead." },
  { code: "55", src: "codes", where: "Caxton card", meaning: "Incorrect PIN", merchant: "Updated info needed", tell: "Wrong PIN. They can check it with PIN reveal in the app." },
  { code: "61", src: "codes", where: "Caxton card", meaning: "Exceeds withdrawal amount limit", merchant: "Try again", tell: "Over the ATM limit (£300 in 24 hours). Try again tomorrow or for less." },
  { code: "62", src: "codes", where: "Caxton card", meaning: "Restricted card", merchant: "Try again", tell: "A restriction is on the card. Check its status before answering." },
  { code: "65", src: "codes", where: "Caxton card", meaning: "Exceeds withdrawal frequency limit", merchant: "Updated info needed", tell: "Over the ATM frequency limit (2 withdrawals in 24 hours)." },
  { code: "75", src: "codes", where: "Caxton card", meaning: "Allowable number of PIN tries exceeded", merchant: "Try again", tell: "PIN blocked. Send a PIN unblock; the next chip-and-PIN use clears it (that first attempt declines)." },
  { code: "05", src: "codes", where: "Caxton card", meaning: "Do not honour (generic)", merchant: "Try again", tell: "A generic decline. Look at the card status and the transaction details for the real reason." },
  { code: "59", src: "codes", where: "Caxton card", meaning: "Suspected fraud", merchant: "Do not try again", tell: "Fraud monitoring stopped it. Confirm the payment with the customer before any block is lifted." },
  { code: "02", src: "codes", where: "Caxton card", meaning: "Card not yet activated", merchant: "Try again", tell: "The card needs activating in the app." },
  { code: "41", src: "codes", where: "Caxton card", meaning: "Lost card (permanent)", merchant: "Do not try again", tell: "Reported lost. The card can never work again; a replacement is needed." },
  { code: "43", src: "codes", where: "Caxton card", meaning: "Stolen card (permanent)", merchant: "Do not try again", tell: "Reported stolen. The card can never work again; a replacement is needed." },
  { code: "46", src: "codes", where: "Caxton card", meaning: "Closed account (permanent)", merchant: "Do not try again", tell: "The account is closed." },
  { code: "G1", src: "codes", where: "Caxton card", meaning: "Short-term block; credits and refunds still allowed", merchant: "Try again", tell: "A temporary block is on. Find out why before lifting it." },
  { code: "G2", src: "codes", where: "Caxton card", meaning: "Short-term full block", merchant: "Try again", tell: "Temporarily fully blocked, refunds included." },
  { code: "G3", src: "codes", where: "Caxton card", meaning: "Long-term block; credits and refunds still allowed", merchant: "Do not try again", tell: "A long-term block. Refunds still reach the card." },
  { code: "G4", src: "codes", where: "Caxton card", meaning: "Long-term full block", merchant: "Do not try again", tell: "Fully blocked long-term, refunds included." },
  { code: "G5", src: "codes", where: "Caxton card", meaning: "Fraud monitoring: short-term block", merchant: "Try again", tell: "Fraud monitoring paused the card. Confirm recent payments with the customer, then review the block." },
  { code: "G9", src: "codes", where: "Caxton card", meaning: "Lost/stolen block via the phone line (permanent)", merchant: "Do not try again", tell: "Blocked through the lost/stolen phone line. A replacement is needed." },
  { code: "9G", src: "codes", where: "Caxton card", meaning: "Blocked by the cardholder", merchant: "Try again", tell: "Blocked by the cardholder, for example a freeze from the app if the programme uses this status. They can lift it themselves." },
  { code: "20051", src: "cko", where: "Top-up", meaning: "Insufficient funds (customer's own bank)", merchant: "", tell: "Their bank declined the top-up for insufficient funds. Try another card or contact their bank." },
  { code: "20005", src: "cko", where: "Top-up", meaning: "Do not honour (customer's own bank)", merchant: "", tell: "Their bank declined it without a reason. Try another card or contact their bank." },
  { code: "20054", src: "cko", where: "Top-up", meaning: "Expired card", merchant: "", tell: "The card they topped up from has expired." },
  { code: "20059", src: "cko", where: "Top-up", meaning: "Suspected fraud (customer's own bank)", merchant: "", tell: "Their bank's fraud checks stopped it. They need to approve it with their bank." },
  { code: "20061", src: "cko", where: "Top-up", meaning: "Activity amount limit exceeded", merchant: "", tell: "Over a limit on their bank card. Try a smaller amount or another card." },
  { code: "20087", src: "cko", where: "Top-up", meaning: "Bad track data (wrong CVV or expiry)", merchant: "", tell: "The card details were wrong. Re-enter the CVV and expiry date." },
  { code: "20091", src: "cko", where: "Top-up", meaning: "Issuer unavailable", merchant: "", tell: "A technical issue at their bank. Try again shortly." },
  { code: "20151", src: "cko", where: "Top-up", meaning: "Cardholder failed 3-D Secure", merchant: "", tell: "The bank's security check (3-D Secure) wasn't completed. Try again and approve it in their banking app." },
  { code: "20152", src: "cko", where: "Top-up", meaning: "3-D Secure not completed within 15 minutes", merchant: "", tell: "The security check timed out. Try again and approve it straight away." },
  { code: "20154", src: "cko", where: "Top-up", meaning: "3-D Secure authentication required", merchant: "", tell: "Their bank requires a security check. Try again and complete it." },
];

// Recurring themes in public reviews, paraphrased (no review text copied),
// each tied to the playbook that answers it.
export const THEMES = [
  { tone: "praise", title: "Real, UK-based people", text: "The most repeated praise: quick, helpful human support by phone and in-app, especially when a card is lost abroad.", playbook: "lost_card", sources: ["trustpilot", "currencyexpert"] },
  { tone: "praise", title: "Fee-free spending abroad", text: "Customers value no fees on spending and withdrawals abroad, and locking in rates before travelling.", playbook: "exchange_rates", sources: ["finder", "currencyexpert"] },
  { tone: "complaint", title: "Declined abroad, especially at some cash machines", text: "Cards working in shops but not at certain banks' ATMs; one review describes trying several machines in Brazil.", playbook: "atm_declined", sources: ["trustpilot", "currencyexpert"] },
  { tone: "complaint", title: "The £2 monthly account fee on idle cards", text: "Balances left on the card between trips being reduced by the account management fee.", playbook: "account_fee", sources: ["currencyexpert", "finder"] },
  { tone: "complaint", title: "Automated security freezes", text: "Cards frozen by fraud checks mid-trip, though reviewers note support releases them quickly.", playbook: "unrecognised", sources: ["currencyexpert", "trustpilot"] },
  { tone: "complaint", title: "PIN blocked abroad", text: "Cards blocked after wrong PIN attempts while travelling.", playbook: "pin_blocked", sources: ["currencyexpert"] },
  { tone: "complaint", title: "App top-ups and rates", text: "Top-ups only in £50 steps, the rate on the home screen differing from the one at top-up, and quotes expiring while connecting a bank.", playbook: "topup_howto", sources: ["appstore", "play"] },
];

export const RATINGS = [
  { where: "Trustpilot", score: "4.8", src: "trustpilot" },
  { where: "App Store", score: "4.7", detail: "5.1k ratings", src: "appstore" },
  { where: "Google Play", score: "4.8", detail: "2.45k reviews", src: "play" },
];
