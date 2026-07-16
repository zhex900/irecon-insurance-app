# CAR New Policy — Form Validation Rules

Source: `legacy-app/WebSite/CAR/CARNewPolicy.aspx` (+ `.cs` code-behind).

> **See also:** [CAR_SAVE_VALIDATION.md](./CAR_SAVE_VALIDATION.md) — validation on **Save**, **Finish**, status changes, and adjustments.

When the broker clicks **Next** on Step 1 (Policy Information), ASP.NET runs all validators. Failures are shown in a message box with this header:

**Cannot continue for the following reasons:**

The list below uses the exact legacy `ErrorMessage` text (bullet format). Rules are grouped by form section in display order.

---

## Policy Information

- Insurer is required
- Insured Name is required
- Type of Cover is required
- Policy Category is required *(legacy label; rebuild: **Business type**)*
- Policy Number is required. *(Renewal only — see conditional rules)*
- Estimated Turnover/Project Value is required
- Estimated Turnover/Project Value must be in currency
- Postcode of construction is required
- Postcode of construction must be in whole number
- State is required
- Business Activities is required
- Insured Contracts is required
- Geographical scope is required
- Maximum Construction Period is required
- Maximum Construction Period must be in numeric
- Maximum Maintenance Period is required
- Maximum Maintenance Period must be in numeric
- Policy From Date is required.
- Policy End Date is required.
- Do you hold a current Contract Works/Liability policy is required
- Current Insurer is required. *(When “Yes” on current policy — see conditional rules)*

**Not validated in legacy:** Site Address (`Enter Site Address (if applicable)`) — optional, no validator.

---

## Section 1 — Contract Works

- Section 1 Contract Works is required
- Display Homes is required
- Display Homes must be in currency
- Existing Structures is required
- Construction Plant & Equipment is required. Enter 0 if not required
- Named Insureds Construction Plant & Equipment must be in currency

**Not validated in legacy:** Section 1 Contract Works and Existing Structures have no currency format check (only required).

---

## Sub Limits of Liability

All sub-limit fields are required (free-text values, no format check):

- Sub limit for removal of debris is required
- Sub limit for expediting expenses is required
- Sub limit for professional fees is required
- Sub limit for mitigation expenses is required
- Sub limit for search and locate costs is required
- Sub limit for plant hire charges is required
- Sub limit for claims preparation costs is required
- Sub limit for government costs is required
- Sub limit for inflation protection is required
- Sub limit for employees property is required
- Sub limit for materials in off site storage is required
- Sub limit for transit is required

---

## Section 2 — Legal Liability

- Section 2 Legal Liability is required

---

## Excesses

**Section 1 — Contract Works**

- Named Insured Plant & Equipment excess is required
- Contract Value up to $2,000,000 minor perils excess is required
- Contract Value up to $2,000,000 major perils excess is required
- Contract Value $2,000,001 to $5,000,000 minor perils excess is required
- Contract Value $2,000,001 to $5,000,000 major perils excess is required

**Section 2 — Legal Liability**

- Worker to Worker excess is required
- Contract Value up to $2,000,000 - $10m Limit of Liability excess is required
- Contract Value up to $2,000,000 - $20m Limit of Liability excess is required
- Contract Value $2,000,001 to $5,000,000 - $10m Limit of Liability excess is required
- Contract Value $2,000,001 to $5,000,000 - $20m Limit of Liability excess is required

**Not validated in legacy:** Excess Additional Notes — optional.

---

## Claims History

- Number of Claims is required
- Have any claims exceeded is required

**Not validated in legacy:** Excluded Contracts 1/2/3 — optional (pre-filled defaults, no validator).

---

## General Disclosure

- Confirm you have asked is required

**Note:** Legacy only requires a dropdown selection (Yes/No). It does **not** block submission when “No” is selected.

**Not validated in legacy:** Additional Wording checkboxes and custom wording fields — optional.

---

## Conditional rules

These validators only apply when specific other fields are set:

| Condition | Field | Message |
|-----------|-------|---------|
| Policy Category = **Renewal** (`2`) | Policy Number | Policy Number is required. |
| Do you hold a current Contract Works/Liability policy = **Yes** (`TRUE`) | Current Insurer | Current Insurer is required. |

**Client-side alert (Renewal):** If Renewal is selected and Policy Number is empty, `fnCheckPolNum` also shows:  
`Policy Number is required if Policy Category selected is renewal`

**Server-side:** `CustomValidator1_ServerValidate` — invalid when Category = Renewal and Policy Number is blank.

---

## When validation runs

| Action | Behaviour |
|--------|-----------|
| **Next** (Step 1 → Step 2) | `Page.IsValid` checked in `wzdNewDeclare_NextButtonClick`; navigation cancelled if any validator fails |
| **Finish** (Step 2) | No additional field validators on pricing step; saves policy |
| **Save failure** | `alert('ERROR. Unable to continue, please refer to your system admin.')` on unhandled exception |

---

## Referral reasons (informational — does not block)

Shown on **Step 2 — Pricing DeclarationConfirmed** when `CARPolicy.IsReferred()` or `CARCalculator.IsReferred()` is true. These are **not** included in the “Cannot continue” validation summary; the broker can still finish the wizard.

From `CARPolicy.GetReferralReasons()` and `CARCalculator2.GetReferralReasons()`:

- Display Homes has a value of {amount}
- Existing Structure has a value of {amount}
- Number of claim last 3 years is entered with value {count}
- Any claims exceeded $20,000 in value is stated as yes
- Do not hold a current Contract Works/Liability policy
- Named Insureds Construction Plant & Equipment is over 50,000
- Unable to find Contract Works rate
- Unable to find Liability rate for {limit label}
- Unable to find the SD rate
- Unable to find the ESL rate
- Unable to find terrorism rate for this combination of postcode/State

---

## New app (`web/`) mapping notes

| Legacy rule | New app (`policy-car.ts`) |
|-------------|---------------------------|
| All required-field messages above | Mostly covered by Zod `carQuoteSchema` on final save |
| Renewal → Policy Number | `businessTypeId === 2` → `policyNumber` required |
| Yes on current policy → Current Insurer | `hasExistingContractWorksCover` → `currentInsurer` required |
| Currency / integer format checks | Zod `coerce.number()` (differs from ASP.NET currency parsing) |
| Site Address optional | **Stricter in new app** — `siteAddress` required |
| Disclosure must be Yes | **Stricter in new app** — `confirmation` must be `true` |
| Sub-limits / excesses required | Required in full schema; draft schema allows partial save |

---

## Example — full blocking message list

If every applicable rule failed at once, the broker would see:

**Cannot continue for the following reasons:**

- Insurer is required
- Insured Name is required
- Type of Cover is required
- Policy Category is required *(legacy label; rebuild: **Business type**)*
- Policy Number is required.
- Estimated Turnover/Project Value is required
- Estimated Turnover/Project Value must be in currency
- Postcode of construction is required
- Postcode of construction must be in whole number
- State is required
- Business Activities is required
- Insured Contracts is required
- Geographical scope is required
- Maximum Construction Period is required
- Maximum Construction Period must be in numeric
- Maximum Maintenance Period is required
- Maximum Maintenance Period must be in numeric
- Policy From Date is required.
- Policy End Date is required.
- Do you hold a current Contract Works/Liability policy is required
- Current Insurer is required.
- Section 1 Contract Works is required
- Display Homes is required
- Display Homes must be in currency
- Existing Structures is required
- Construction Plant & Equipment is required. Enter 0 if not required
- Named Insureds Construction Plant & Equipment must be in currency
- Sub limit for removal of debris is required
- Sub limit for expediting expenses is required
- Sub limit for professional fees is required
- Sub limit for mitigation expenses is required
- Sub limit for search and locate costs is required
- Sub limit for plant hire charges is required
- Sub limit for claims preparation costs is required
- Sub limit for government costs is required
- Sub limit for inflation protection is required
- Sub limit for employees property is required
- Sub limit for materials in off site storage is required
- Sub limit for transit is required
- Section 2 Legal Liability is required
- Named Insured Plant & Equipment excess is required
- Contract Value up to $2,000,000 minor perils excess is required
- Contract Value up to $2,000,000 major perils excess is required
- Contract Value $2,000,001 to $5,000,000 minor perils excess is required
- Contract Value $2,000,001 to $5,000,000 major perils excess is required
- Worker to Worker excess is required
- Contract Value up to $2,000,000 - $10m Limit of Liability excess is required
- Contract Value up to $2,000,000 - $20m Limit of Liability excess is required
- Contract Value $2,000,001 to $5,000,000 - $10m Limit of Liability excess is required
- Contract Value $2,000,001 to $5,000,000 - $20m Limit of Liability excess is required
- Number of Claims is required
- Have any claims exceeded is required
- Confirm you have asked is required
