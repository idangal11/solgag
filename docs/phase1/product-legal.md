# Potential roofs, Phase 1: product, legal and outreach rules

Workstream: product-legal. Prepared 2026-10-19 for SolGag (סולגג).
Scope: how the "potential roofs" layer should behave so that it is useful, lawful and ethical in
Israel. It covers copy and labelling, privacy, outreach, brokerage and securities, the claim flow,
and KPIs with a go/no-go gate.

> **This is not legal advice.** Every item tagged **[LAWYER]** needs sign-off from an Israeli
> lawyer (privacy and real estate) before the public launch. Statutory text was read from the
> consolidated Hebrew Wikisource transcriptions on 2026-10-19. Wikisource is a secondary copy, so
> check it against Nevo or the Knesset/Reshumot text before relying on it. **UNVERIFIED** marks
> anything I could not confirm from a primary or reputable source.

---

## 0. Decisions in brief

1. **Notify before publishing.** For each reviewed roof, first send a letter: "Is this your
   roof?" (see 5.6). Wait 30 days. Publish the roof only if nobody asks for removal. Where no
   deliverable address exists, show the roof in aggregate only. This gives owners notice and a
   real chance to opt out, which the Privacy Protection Authority (PPA) consent position (Feb 2026)
   treats as preconditions for implied consent (4.3). It also produces early claims.
2. **Never show owner identity.** No names, ID or company numbers, block/parcel (גוש/חלקה),
   street address text, business or tenant names, or Tabu or Companies Registrar data. This
   applies anywhere in the potential layer, including the API and exports.
3. **Two visibility tiers.**
   - **Anonymous visitors** see only aggregated hexagons (H3 res 8, about 0.74 km²). Each shows
     a count, total area and total kWp, and appears only when it holds at least 3 roofs (k≥3).
   - **Signed-in, phone-verified users who accepted the Outreach Code** see building outlines
     for roofs presumed to belong to corporations or public bodies: industrial and commercial
     zones, and kibbutzim, which are cooperative societies.
   - **Roofs presumed to belong to individuals** (moshav נחלות, private farms) stay aggregated
     for everyone until the owner claims the roof.
4. **The default contact path is mediated.** "I'm interested" records the interest. SolGag then
   contacts the owner once, in a compliant way, and tells them how many parties are interested.
   Direct approaches are allowed only under the Outreach Code (5.5). Electronic cold messages to
   owners (email, SMS, WhatsApp, autodialler, fax) are forbidden.
5. **Physical metrics only.** Show rounded area and a capacity range in kWp DC. Do not show ₪
   income, ROI or payback for any potential roof. Do not use the phrase "investment opportunity".
6. **No fees in Phase 1.** No success fees, paid leads or paid introductions. A fee for
   "meeting" the parties brings the activity within the definition of brokerage (6.1).
7. **Removal is easy; claiming is hard.** An owner or occupant can hide a roof with a
   one-step form, and SolGag hides it within 1 business day without proof. A claim needs
   documents plus an identity link, and it triggers an anti-fraud letter to the building (7).
8. **Phase 1 is small.** About 100–120 published roofs in the Emek Hefer pilot. Every relevant
   threshold is far away: 10,000 people for data-broker registration and a mandatory privacy
   officer, 100,000 for notifying the PPA. A national rollout must be reassessed (4.7).
9. **Go/no-go at month 6.** Proceed if at least 8% of published roofs are claimed and verified,
   at least 40% of roofs receive investor interest, opt-outs are at most 5%, and there are no
   substantiated regulator, trespass or harassment complaints. Details in section 8.
10. **Legal gate first.** No public potential layer before a lawyer signs off the items in
    section 10. The legal pages already say "draft". Today they have no section on data about
    roofs that owners did not publish.

---

## 1. Pilot facts that drive these rules

Source: `research/pilot-emek-hefer/data/stats.json` and my own tally of `data/candidates.geojson`
(run 2026-10-19).

| Item | Value |
|---|---|
| Pilot bbox | 32.30–32.42N, 34.85–35.00E, 188.4 km² |
| Candidates ≥1000 m² after exclusions | 992 (Tier A 238, B 231, C 523) |
| **Tier A by land use** | industrial 204, residential-zone 20, commercial 6, farmyard 5, retail 3 |
| Tier B by land use | farmland 108, industrial 75, unmapped 33, retail 8, commercial 4, farmyard 2, residential 1 |
| Tier A roof area | p10 1,092 m², median 1,860 m², p90 5,337 m², max 13,530 m² |
| Capacity formula in the pilot | area × 0.65 / 6.5, so about **0.1 kWp per m²** of footprint (median Tier A about 186 kWp) |
| Tier A photo review (n=12) | 5 good bare roofs (~42%), 1 partial PV, 2 full PV, 3 wrong outlines, 1 unclear |
| Expected real opportunities | ~100–120 in Tier A |

Implications:
- **86% of Tier A sits in industrial zones** (204/238). The Phase 1 public set will be mostly
  company-held buildings. Under Israeli law, data about a company is not "personal data" (4.1).
  Many industrial buildings are still owned by individuals or family firms who lease them out.
  The share is unknown (**UNVERIFIED**), so the corporate presumption is not reliable on its own.
- **Tier B/C farmland** is where individuals (moshav farmers) dominate, and where outlines are
  most often wrong (11 of 12 Microsoft-only farm roofs were greenhouses). Exclude these from
  Phase 1 publication entirely. At most, use them in aggregate after review.
- The 20 "residential-zone" Tier A roofs need special care. Exclude apartment buildings and other
  residential condominiums: each has many individual owners, and roof decisions need a collective
  decision (7.1, Land Law s.59ט).
- **The government already publishes per-building solar potential.** On 4 Feb 2025 the Ministry
  of Energy and the Survey of Israel (MAPI) launched a public tool. It shows roof area, free
  area, capacity and output for every building in built-up areas, including industrial and
  agricultural ones. Their example: a Netanya building with 898 m² of roof and 504 m² free
  supports about 67 kW, and earns about ₪51,200 a year per the ministry calculator
  ([Maariv, 4 Feb 2025](https://www.maariv.co.il/news/israel/article-1169853);
  [Mako, 4 Feb 2025](https://www.mako.co.il/finances-money/Article-94a0c45b77dc491026.htm); both
  seen 2026-10-19). This matters in three ways:
  - Per-building potential alone is no longer new or secret. That lowers the marginal privacy
    harm and supports a "reasonable expectations" argument.
  - SolGag's legal and ethical exposure comes from two additions: the "not listed / approach the
    owner" framing, and the contact mechanics.
  - Competitively, SolGag's value is human review (bare roof, no existing PV), the claim path and
    matchmaking. The capacity number is not the differentiator.

---

## 2. Recommended Phase 1 operating model

### 2.1 Staged rollout

| Stage | Who sees what | Exit criterion |
|---|---|---|
| **S0: internal** (2–4 weeks) | Admins only. Run the review screen and label roofs. Classify the presumed owner type (2.3). Resolve postal addresses internally. | ≥100 roofs reviewed as "good bare / partial"; lawyer sign-off on section 10 items |
| **S1: notice** (30 days) | Letters to every roof to be published (5.6). Each letter carries a unique code that enables claim, correct or remove. Nothing is published yet. | Removal requests processed; claims queued |
| **S2: invited beta** (~2 months) | Building-level view for 10–20 invited installers and investors who accept the Outreach Code. Anonymous visitors see nothing, or only the aggregated hex layer. | Complaint and opt-out rates inside limits (8.3) |
| **S3: public pilot** (to month 6) | Anonymous: aggregated hexagons. Signed-in and phone-verified: building level for presumed corporate/public roofs. | Month-6 go/no-go (8.4) |

### 2.2 Interest is mediated by default

- **Investor side.** An investor clicks **"אני מעוניין/ת בגג הזה"**. The click records an
  interest row (investor id, roof id, optional note, timestamp). The investor gets no owner data.
- **Owner side.** SolGag sends one letter per roof, and at most one reminder in 12 months. The
  letter says, for example, "4 parties interested in roofs like yours". It does not name them.
  Once the owner claims and publishes, every interested investor is notified (they consented to
  this) and can use the existing inquiry flow.
- **Why this is the default:**
  - The owner gets one compliant approach instead of N uncoordinated ones, so less spam and
    trespass.
  - No personal data goes to investors.
  - Because it is free, it is not brokerage "for consideration" (6.1).
  - It creates the network effect the business needs.

### 2.3 Presumed owner class (pipeline attribute, reviewed by a human)

| Class | How to presume it | Phase 1 visibility |
|---|---|---|
| `corporate_zone` | Industrial or commercial zone; logistics park | Building level for signed-in users |
| `kibbutz` | Inside a kibbutz locality polygon. The owner is the kibbutz cooperative society (a corporation). | Building level for signed-in users |
| `public` | School, municipal or government building | **Exclude from Phase 1.** Public bodies generally lease assets only by tender ([LAWYER]: Mandatory Tenders Law). The layer would mislead. |
| `individual_likely` | Moshav נחלה, private farm, single-owner agricultural building | Aggregated only. Contact only through the platform. |
| `residential_condo` | Apartment buildings; any residential condominium | **Exclude** |
| `unknown` | Everything else | Aggregated only |

The CBS locality-type file (kibbutz, moshav and so on) is a practical input for this. Its licence
is **UNVERIFIED**; the data/pipeline workstream should confirm it.

---

## 3. (a) Copy, labelling and what to show or hide

### 3.1 What to show and what to hide

| Field | Anonymous | Signed-in + Code | Reason |
|---|---|---|---|
| Aggregated hex (res 8 ≈ 0.737 km²; res 7 ≈ 5.16 km² fallback) with count, Σ area, Σ kWp | ✅ (k≥3, else merge to res 7, else hide) | ✅ | Not identifiable, so not personal data. Useful for showing density. H3 sizes: [h3geo.org](https://h3geo.org/docs/core-library/restable/) (seen 2026-10-19) |
| Building outline (reviewed polygon) | ❌ | ✅ for `corporate_zone` / `kibbutz` only | An outline pins the building down as precisely as an address. Gating it creates accountability (who saw what) and lets us rate-limit and enforce the Code. |
| Roof area | ❌ (only in the hex sum) | ✅ rounded to 100 m², with "±20%" | Outlines are wrong ~25% of the time (pilot). False precision invites disputes. |
| Capacity | ❌ (hex sum) | ✅ as a **range**: area×0.4/6.5 to area×0.65/6.5, rounded to 10 kWp | Existing PV, obstructions and structure are unknown. 0.65 is already the pilot's optimistic usable ratio. |
| Annual production | ❌ | Optional, in details only, as a range with a PVGIS caveat | Physical figure. The pilot's 1,677 kWh/kWp is optimistic (optimal angles). |
| ₪ income / ROI / payback | ❌ | ❌ | This is economic information about a person's asset (4.1). It is also projection-like and drifts towards investment marketing (6.3). |
| Street address text, gush/helka, locality-level labels that pin a single building | ❌ | ❌ | Each is a direct identifier: block/parcel leads to a Tabu extract, which gives the owner's name and ID (4.1). |
| Owner, tenant or business name, phone, website | ❌ | ❌ | Personal data, and implies an endorsement. |
| Imagery date and "last reviewed" date | – | ✅ | PV is installed quickly. Stale imagery causes false positives. |
| Review label (bare / partial PV) | – | ✅ ("נראה ללא מערכת" / "מערכת חלקית") | Only what a human reviewer saw. |
| Count of interested parties | – | ❌ to investors; ✅ to the owner | Showing it to investors creates herd pressure and invites competitors to game it. |

**Address decision.** Hide the exact address from everyone, always. Show exact building outlines
only to accountable, signed-in users, and only for roofs presumed to belong to corporations or
public bodies. Justification:
- **Privacy.** For individual owners, an outline or address makes the potential estimate
  personal data about their asset (4.1–4.2). Withholding it moves that processing out of public
  view.
- **Spam and trespass.** An exact location invites door-knocking and farmyard visits, and Emek
  Hefer farmers are sensitive to strangers (5.4).
- **Usefulness.** An installer can still see the building after signing in, and the mediated
  path covers the rest.
- **Discoverability.** No indexable per-roof pages (3.4).

### 3.2 Visual rules
- Use a separate layer and a separate legend entry. **Off by default.** The toggle is labelled
  "גגות עם פוטנציאל (לא פורסמו)".
- Grey dashed outline and a hollow icon, so it never looks like a listing, which uses solid
  colour.
- Potential roofs never appear in listing results, counts ("X גגות זמינים"), favourites or
  sitemaps.
- Show the status chip on every surface: **"לא מוצע · הבעלים לא פרסמו"**.

### 3.3 Hebrew copy deck (draft; plural inclusive form, matching /terms and /privacy)

| Location | Text |
|---|---|
| Layer toggle | גגות עם פוטנציאל (לא פורסמו) |
| Legend | קו מקווקו אפור — גג גדול שזוהה במיפוי ונבדק חזותית. הבעלים לא פרסמו אותו, והוא אינו מוצע להשכרה. |
| Popup title | גג עם פוטנציאל סולארי — לא פורסם על ידי הבעלים |
| Status chip | לא מוצע · הבעלים לא פרסמו |
| Popup body | הגג זוהה אוטומטית מנתוני מיפוי פתוחים ונבדק בתצלום אוויר על ידי צוות סולגג. איננו יודעים מי הבעלים. הבעלים לא פרסמו את הגג, לא אישרו את הצגתו, ולא ידוע אם הם מעוניינים בהתקשרות כלשהי. |
| Metrics | שטח גג משוער: כ־1,900 מ״ר (±20%) · הספק אפשרי משוער: כ־120–190 קילוואט (DC) |
| Dates | נבדק בתצלום מתאריך: 03/2025 · עודכן לאחרונה: 10/2026 |
| Disclaimer | הנתונים הם הערכה גסה בלבד. ייתכנו טעויות בגבולות המבנה, מערכת סולארית קיימת, מגבלות קונסטרוקטיביות, היתרים וחיבור לרשת. אין בכך הצעה, הערכת שווי, תחזית הכנסה או המלצה להשקעה. |
| Investor CTA | אני מעוניין/ת בגג הזה |
| After CTA | שמרנו את העניין שלכם. אם הבעלים יפרסמו את הגג או יפנו אלינו, נעדכן אתכם. איננו מוסרים לבעלים את פרטיכם בלי הסכמתכם, ואיננו מוסרים לכם את פרטי הבעלים. |
| Before direct approach | לפני כל פנייה ישירה לבעלי מבנה — חובה לפעול לפי <קוד ההתנהגות לפנייה לבעלי גגות>. אסור לשלוח דואר אלקטרוני, מסרונים או הודעות וואטסאפ שיווקיים בלי הסכמה, ואסור להיכנס לשטח המבנה. |
| Owner CTA | זה הגג שלי — לפרסם, לתקן או להסיר |
| Anonymous hex | באזור זה זוהו 4 גגות גדולים עם פוטנציאל (סה״כ כ־9,000 מ״ר, כ־560–900 קילוואט). התחברו כדי לראות פרטים. |
| `individual_likely` hex (signed-in) | כדי להגן על פרטיות הבעלים, המיקום המדויק של גגות באזור זה אינו מוצג. אפשר להביע עניין באזור, ונפנה לבעלים בעצמנו. |
| Owner landing ("/roof/CODE") | האם זה הגג שלכם? הגג הזה מופיע אצלנו כגג גדול שעשוי להתאים למערכת סולארית. אפשר לפרסם אותו כמודעה בחינם, לתקן את הנתונים, או להסיר אותו מהמפה — ההסרה לא דורשת הרשמה. |
| Removal done | הגג הוסתר מהמפה. נשמור רק מזהה טכני של המבנה, כדי שלא יופיע שוב בעדכון הבא של הנתונים. |
| Attribution line | מתארי מבנים: Microsoft Global ML Building Footprints (CDLA-Permissive-2.0) · תצלומי אוויר: <ספק מורשה> |

**Words to avoid** (they imply an offer, consent or an investment): "זמין", "פנוי להשכרה",
"מוצע", "למכירה", "הזדמנות השקעה", "תשואה", "רווח", "הכנסה צפויה", "בעלים מעוניינים",
"מאומת", "נבדק הנדסית". "נבדק חזותית" is the only verification wording allowed.

### 3.4 Discoverability
- No public per-roof URLs. The popup is client-side only, `noindex`, and excluded from the
  sitemap.
- The owner landing page `/roof/<code>` is `noindex`. Its code is unguessable (≥10 random
  characters). It shows only the outline and the figures already printed in the letter.
- Do not offer bulk export or a public API for the potential layer. Rate-limit building-level
  detail views (suggested 50 per user per day) and log them.

### 3.5 Freshness
- Re-review or unpublish any roof whose imagery is older than 24 months, or whose last review is
  older than 12 months.
- Remove a roof at the next refresh when an owner reports existing PV, or when a newer source
  shows PV.

---

## 4. (b) Privacy: Protection of Privacy Law 5741-1981 as amended by Amendment 13

Amendment 13 took effect on **14 Aug 2025** (Herzog Fox & Neeman via
[Mondaq, 26 Nov 2025](https://www.mondaq.com/privacy-protection/1709950/major-amendment-to-privacy-law-in-israel);
[RSM Israel](https://www.rsm.global/israel/he/node/228); both seen 2026-10-19).

### 4.1 Is a per-building potential estimate personal data?

Law text (s.3, consolidated, [Wikisource](https://he.wikisource.org/wiki/חוק_הגנת_הפרטיות),
seen 2026-10-19):
- **"מידע אישי"** is "נתון הנוגע לאדם מזוהה או לאדם הניתן לזיהוי".
- An identifiable person is "מי שניתן לזהותו במאמץ סביר, במישרין או בעקיפין". Examples of
  identifiers include name, ID number, **location data** and online identifiers. The definition
  also covers "נתון אחד או יותר הנוגע למצבו הפיזי, הבריאותי, **הכלכלי**, החברתי או התרבותי".
- **"אדם"**, for the definitions of "מידע אישי", "מאגר מידע" and "דיוור ישיר" and for ss.2,
  13, 14, 17ו and others, is defined **"– למעט תאגיד"**. Data about a company is therefore not
  personal data.

Analysis:
- **Company-held building** (Ltd, cooperative society, kibbutz, public company): **not personal
  data** in itself. Two caveats ([LAWYER]):
  - A one-person or family company whose name reveals an individual.
  - Contact persons' names, phones and emails *are* personal data.
- **Individually owned building:** **likely personal data.**
  - Identification needs only reasonable effort. The outline or location gives the block and
    parcel on GovMap. Anyone can then order a paid land-registry (Tabu) extract by block and
    parcel ([gov.il service page](https://www.gov.il/he/service/land_registration_extract),
    seen in search results 2026-10-19; the fee is **UNVERIFIED**, about ₪15–20 from memory).
    The extract shows the owner's name and ID number. Israel Land Authority property information
    is likewise requestable for third-party properties
    ([gov.il property-information](https://www.gov.il/he/service/property-information), search
    snippet 2026-10-19).
  - The estimate "relates to" the owner, because it describes the economic potential of their
    asset ("מצבו הכלכלי"). It is processed precisely so that the owner can be approached. Israel's
    new definition mirrors the GDPR. The EU Article 29 Working Party's
    [Opinion 4/2007 (WP136)](https://ec.europa.eu/justice/article-29/documentation/opinion-recommendation/files/2007/wp136_en.pdf),
    Example 5, says a house's value is data about an object. It becomes personal data when used
    to assess or treat the owner, but not when it only illustrates prices in a district (text
    extracted 2026-10-19). Our purpose is the "treat the owner" case.
- **Aggregated hexes with k≥3 and no building-level output:** not identifiable, so not personal
  data. This is why anonymous users only get hexes.

### 4.2 Building types

| Building type | Personal data? | Phase 1 handling |
|---|---|---|
| Single company in an industrial zone | No (corporate) | Building level for signed-in users |
| Industrial building owned by an individual, leased to tenants | Yes (the landlord) | Same as above, because it cannot be told apart reliably. Mitigated by notice-before-publish, removal on request, and no address. [LAWYER] to confirm this is acceptable. |
| Multi-tenant industrial park or industrial condominium (בית משותף) | Mixed: the management company is a corporation; unit owners are often individuals | Building level is allowed (data relates to a building with many owners, so attribution is weak). The claim flow needs a collective decision (7.1). |
| Kibbutz building | No (cooperative society) | Building level |
| Moshav נחלה / private farm | Yes | Aggregated only until claimed |
| Residential condominium | Yes (many) | Excluded |
| Public body | No; tender issues | Excluded |

### 4.3 Lawful basis

- Israeli law recognises **only two bases**: the data subject's informed consent (express or
  implied), or specific legal authorisation.
- Section 18 defences (good faith, a legitimate personal interest, and so on) are defences, not
  standalone lawful bases.
- The PPA's **final consent position paper (Feb 2026)** sets three conditions for implied or
  opt-out consent: the person was properly informed; the processing fits their reasonable
  expectations; and they had a genuine chance to opt out. Silence or an unread policy is not
  enough. Opt-in is required for secondary uses, profiling beyond expectations and
  **third-party direct marketing**. Source: AYR via
  [Legalink, 27 Apr 2026](https://www.legalink.net/en/publications/newsletters/israels-privacy-authority-issues-landmark-guidance-on-consent/7410/),
  seen 2026-10-19.

What this means for us:
- For individual owners, publishing building-level potential without any notice would fail
  those conditions. That is why Phase 1 uses **notice before publication** (letter plus 30-day
  window) and keeps `individual_likely` roofs aggregated.
- Sharing owner identity with investors would be third-party direct marketing and would need
  opt-in, so we never do it.
- For corporate roofs, no lawful basis is needed for the building data itself. Notice and
  removal are still used, for ethical consistency and because of the misclassification risk.
- **[LAWYER]** to confirm three points:
  1. Notice by letter plus an opt-out window is a sufficient basis for building-level display of
     individually owned industrial buildings.
  2. Internal processing of `individual_likely` candidates (stored, but only shown in aggregate)
     is lawful, or should be minimised further. One option is to store only hex ids for them
     until a claim is made.
  3. Whether s.11 (notice when *requesting* data from a person) applies. On its text it covers
     "פניה לאדם לקבלת מידע אישי", not data derived from third-party sources. The PPA's draft
     notice guidance should be checked.

### 4.4 Notice and transparency

- **New public page: "על שכבת הגגות עם הפוטנציאל"** (linked from every popup and from every
  letter). It should cover:
  - Sources: Microsoft footprints, open land-use data, licensed imagery.
  - Method and error rates: ~25% of raw outlines are wrong; human review is done before
    publication.
  - Purpose: help owners and investors connect.
  - What we do not collect: owner identity. Who sees what: the visibility tiers.
  - How to remove, correct or claim a roof.
  - Retention (4.6) and controller contact.
- **Add a section to /privacy:** "מידע על מבנים שלא פורסמו על ידי בעליהם". The current
  /privacy describes only data users give us.
- **Letters** carry the direct-mail-style disclosures (5.6) even if the direct-mail chapter does
  not strictly apply.

### 4.5 Opt-out and removal process (spec)

- **Who may request:** anyone who declares they are the owner, lessee, occupant or authorised
  representative. No account and no documents are needed.
- **Channels:**
  - The letter code at `/roof/<code>` (one click).
  - A "הסרת גג" form on the potential-layer page. The requester marks the building on the map
    and gives an email or phone number for confirmation only.
  - Email to the privacy address.
  - A phone line, recommended for farmers.
- **SLA:**
  - Hide automatically on submission when the request comes through a letter code.
  - Otherwise hide within **1 business day**.
  - Confirm within 2 business days.
  - Respond to a full privacy request (access or deletion) within 30 days. The existing /privacy
    already says 30 days; [LAWYER] to confirm the statutory period.
- **Effect:**
  - The roof leaves both layers, including aggregates if k drops below 3.
  - Pending investor interests on that roof are closed silently. Investors see only that the
    roof is "no longer shown", with no reason given.
  - A suppression record stops it from coming back at the next pipeline refresh.
- **Abuse of removal** (a competitor hides a roof): accept the risk; the harm is low. The real
  owner can claim later, and a verified claim overrides suppression.
- **Corrections** ("this is a greenhouse", "PV already installed"): use the same form with a
  "תיקון" option. The roof is hidden until re-reviewed.

### 4.6 Retention schedule (proposed; [LAWYER])

| Data | Keep | Delete / then |
|---|---|---|
| Unreviewed or rejected candidates (geometry + label) | Until the next pipeline refresh, ≤12 months | Regenerated each refresh. For `individual_likely`, consider storing only the hex id. |
| Published potential roof record | While published and re-reviewed every 12 months | Unpublish when stale (3.5) |
| Suppression list (building id/geometry hash, date, channel, reason code) | While the layer exists | Requester contact details deleted 90 days after the request closes |
| Postal address resolved for letters | Until 30 days after the last letter for that roof | Delete the address. Keep only the code and its status. |
| Letter codes and their status | 24 months | Then delete |
| Investor interest rows | Until the roof is claimed, removed, or 12 months pass | Delete, or carry over into an inquiry on conversion, with consent |
| Claim documents, **rejected** | 30 days after the decision (appeal window) | Delete the files. Keep audit metadata (who, when, document type, decision, file hash). |
| Claim documents, **approved** | Recommended: **delete the files 90 days after approval**. Keep the verification record. | This is stricter than today's /privacy, which keeps documents while the listing exists. Tabu extracts carry ID numbers and mortgage/lien details. |
| Audit metadata for claims and removals | 7 years (Israeli civil limitation period; **UNVERIFIED** as the right anchor) | Delete |

Data Security Regulations reg. 2(ג) requires the controller to check **at least once a year**
whether the database holds more data than its purposes need
([Wikisource](https://he.wikisource.org/wiki/תקנות_הגנת_הפרטיות_(אבטחת_מידע)), seen 2026-10-19).
Put this on the calendar.

### 4.7 Registration, notification, privacy officer and security level

Law text from Wikisource, seen 2026-10-19:

| Duty | Trigger (law text) | Phase 1 pilot | National scale |
|---|---|---|---|
| **Database registration** (s.8א(א)(1)) | (a) main purpose is collecting personal data **to transfer to others** as a business or for payment, incl. direct-mail services, **and >10,000 people**; or (b) the controller is a public body | **No.** The main purpose is a marketplace; individuals in the layer number ≪10,000 (<1,000 candidates in the whole pilot). | **Watch.** Individually owned candidates nationwide could pass 10,000. If the layer's main function becomes supplying owner leads to investors, registration plus a DPO could apply. The design (no owner identity transferred; individuals aggregated) argues against "data broker" status. [LAWYER] |
| **Notice to the PPA** (s.8א(ב)) | Non-registrable database holding **special-sensitivity** data on **>100,000 people**, within 30 days | No | No. Assets are not on the statutory special-sensitivity list (closest item: salary and financial activity). |
| **Privacy officer (DPO)** (s.17ב1) | Public body; data broker >10,000; core activity of systematic monitoring at considerable scale; core activity of special-sensitivity data at considerable scale | Not mandatory. **Recommend naming an internal privacy lead anyway.** /privacy already has an optional field for one. | Re-assess together with registration |
| **Security level** (Data Security Regs 2017, First Schedule) | Medium if the database includes "מידע על **נכסיו** של אדם, חובותיו והתחייבויותיו הכלכליות, מצבו הכלכלי…", unless the controller has **≤10 authorised users** (then basic). High if ≥100,000 people or >100 authorised users. | **Likely medium content, basic level** if admins with access stay ≤10. **The existing ownership-docs bucket (Tabu extracts with IDs and liens) already falls in this category today.** | Keep admin access ≤10, or implement medium-level controls: periodic audit **at least every 24 months** (reg. 16(א)), access logs and so on. [LAWYER] on whether signed-in end users count as "בעלי הרשאה". |

Also required under the regulations: a **database definitions document** (reg. 2). Update it for
the new purpose: potential-roof processing and letters.

### 4.8 Enforcement exposure (why this matters)

- Amendment 13 gave the PPA power to impose financial sanctions. These "can reach millions of
  shekels" depending on the violation, its scope and the organisation.
- Example: **Meuhedet health fund, ₪256,000**, for late reporting of a serious security incident
  (announced 21 Jul 2026,
  [Shibolet](https://www.shibolet.com/%D7%A2%D7%93%D7%9B%D7%95%D7%9F-%D7%9C%D7%A7%D7%95%D7%97%D7%95%D7%AA-%D7%90%D7%9B%D7%99%D7%A4%D7%94-%D7%91%D7%A2%D7%A7%D7%91%D7%95%D7%AA-%D7%AA%D7%99%D7%A7%D7%95%D7%9F-13-%D7%94%D7%A8%D7%A9%D7%95/),
  seen 2026-10-19).
- The PPA began cross-sector audits on 10 Dec 2025. Targets include **online trade companies**
  and **popular apps** ([Shibolet, 23 Dec 2025](https://www.shibolet.com/?p=23026)).
- Courts may award **up to ₪10,000** without proof of damage for certain violations
  ([Mondaq/HFN](https://www.mondaq.com/privacy-protection/1709950/major-amendment-to-privacy-law-in-israel)).

### 4.9 Privacy questions for the lawyer
1. Is building-level potential for individually owned industrial buildings, shown to signed-in
   users after a notice letter and 30-day opt-out, lawful under the Feb 2026 consent paper?
2. Is internal storage of `individual_likely` candidates (aggregated output only) lawful? Should
   it be limited to hex ids?
3. Under which conditions would SolGag become a "data broker" (s.8א(א)(1)(א)) at national scale?
4. Is the platform letter (no names, addressed to "the holder") "דיוור ישיר" under s.3/17ו?
5. Security level: do signed-in users count as authorised users? Is the ≤10-admin basic-level
   route valid for the ownership-docs bucket?
6. Is the retention schedule in 4.6 acceptable, especially deleting approved claim documents
   after 90 days?

---

## 5. (c) Outreach rules

### 5.1 Anti-spam law: Communications (Bezeq and Broadcasting) Law s.30א

- **Channels covered:** fax, autodialler (recorded messages), "electronic messages" including
  email, and SMS/MMS. Commentators treat WhatsApp and other messaging apps as electronic
  messages ([ToI blog, Jul 2026](https://blogs.timesofisrael.com/the-law-your-whatsapp-bot-keeps-breaking/),
  an author's reading only).
- **Not covered:** postal mail and live human phone calls
  ([he.wikipedia: חוק הספאם](https://he.wikipedia.org/wiki/חוק_הספאם), seen 2026-10-19).
- **Rule:** no advertising message without **explicit prior consent**, given in writing or in a
  recorded call. Exceptions:
  - An existing customer who gave details during a purchase and was offered a refusal.
  - **A one-time approach to a recipient that is a business, asking for consent to receive
    advertising** (Adv. Haim Ravia,
    [law.co.il, 27 May 2008](https://www.law.co.il/en/news/2008/05/27/knesset-approves-israeli-anti-spam-law/)).
    The exact statutory wording is **UNVERIFIED**; I could not retrieve the primary text.
- **Content requirements:** mark the message as advertising, identify the sender and contact
  details, and provide a working refusal mechanism.
- **Damages:** up to **₪1,000 per message** without proof of damage. Class actions are allowed,
  and it is also a criminal offence (sources above).
- **Consequences for SolGag:**
  - The platform's own cold emails or SMS to owners ("list your roof free") are almost certainly
    "advertising" for SolGag's service. **Do not send them.** If ever used, use only the one-time
    business consent request, with wording reviewed by a lawyer [LAWYER]. Never send them to
    individuals (moshav farmers are individuals, not businesses, for this purpose).
  - **The Outreach Code must forbid users from sending electronic marketing to owners without
    prior consent.** One spam campaign by a user could cost owners' goodwill and could expose
    SolGag to claims that it facilitated the spam.

### 5.2 Live phone calls and the "אל תתקשרו אליי" registry

- Consumer Protection Law amendment 61 (enacted Nov 2020, in force **1 Jan 2023**) created a
  do-not-call registry ([dnc.fta.gov.il](https://dnc.fta.gov.il/)). Businesses making marketing
  calls must check it. They have 15 days after registration to stop calling.
- Reported sanctions: **₪45,000 per company, ₪25,000 per individual business**
  ([Gadgety, 12 Dec 2022](https://www.gadgety.co.il/?p=302859), seen 2026-10-19).
- It protects *consumers*. Calls to a business about leasing its roof are probably outside it,
  but a farmer's private mobile may be registered. **UNVERIFIED** whether it applies to
  approaches seeking to *buy or lease* from an individual [LAWYER].
- Rules for users and for SolGag:
  - Call only numbers the owner published for business purposes.
  - Check the registry before calling any number that might be private.
  - At most 1 call per owner per 90 days.
  - Stop immediately on "no".

### 5.3 Postal letters, and whether SolGag may run an "Is this your roof?" campaign

- **Yes, by post**, with care:
  - s.30א does not cover post.
  - The privacy law's **direct-mail** rules apply to "פנייה אישית לאדם, בהתבסס על השתייכותו
    לקבוצת אוכלוסין… ששמותיהם כלולים במאגר מידע". The definition relies on *names* in a
    database. A letter addressed generically ("לכבוד המחזיקים בנכס") and selected by *building*
    characteristics is arguably outside it.
  - If it is direct mail, s.17ו(א) requires every mailing to state clearly: that it is direct
    mail (with a registration number where the database is registered); the right to be removed
    and where to write; and the controller's identity and address and the **source of the
    data**. A person can demand removal in writing, and the controller must comply.
  - **Recommendation:** include all these elements anyway (template in 5.6), and never put
    names from Tabu or other registries on envelopes [LAWYER].
- Do not use Tabu or Companies Registrar look-ups to personalise mail. That turns building data
  into named personal data and is direct marketing that needs opt-in under the PPA consent paper.

### 5.4 In-person visits, trespass, drones and biosecurity

- **Civil trespass:** Torts Ordinance s.29: "כניסה למקרקעין שלא כדין, או היזק או הפרעה…".
  Under s.30 the defendant must prove the entry was lawful
  ([Wikisource](https://he.wikisource.org/wiki/פקודת_הנזיקין), seen 2026-10-19).
- **Criminal trespass:** Penal Law s.447 covers entering property to intimidate, insult or annoy,
  or to commit an offence. Exact wording **UNVERIFIED**. A 2024 Knesset bill proposed a 3-year
  penalty for trespass into agricultural enterprises (Knesset document in search results; status
  **UNVERIFIED**). Farm communities are sensitive to strangers.
- **Harassment and photography** (Privacy Law s.2): (1) stalking that may harass, or other
  harassment; (3) photographing a person in a private domain. Repeated visits or calls, or
  drone photos of farmyards, can fall here.
- **Biosecurity:** dairy and poultry farms restrict entry for disease control (general
  knowledge; specific Ministry of Agriculture rules **UNVERIFIED**).
- **Drones:** civil aviation rules regulate flights. Details **UNVERIFIED**; forbid drone use
  without written owner consent regardless.

### 5.5 Outreach Code of Conduct (draft text for /terms and a pre-contact modal)

**קוד התנהגות לפנייה לבעלי גגות שלא פורסמו**

1. גג שמסומן "לא פורסם" אינו מוצע לעסקה. אל תציגו אותו לאחרים כגג זמין, ואל תטענו שהבעלים הביעו עניין או שסולגג ממליצה עליכם.
2. אין לשלוח לבעלים דואר אלקטרוני, מסרון, הודעת וואטסאפ, פקס או שיחה מוקלטת שיווקיים בלי הסכמה מפורשת מראש. מותר לכל היותר לשלוח לבית עסק פנייה חד־פעמית שמבקשת את הסכמתו, ובכפוף לדין.
3. שיחת טלפון — רק למספר שהבעלים פרסמו לצורך עסקי. יש לבדוק את מאגר "אל תתקשרו אליי" כשהמספר עשוי להיות פרטי. לכל היותר פנייה אחת ל־90 יום, ומפסיקים מיד כשמסרבים.
4. אסור להיכנס לשטח המבנה, לחצר, לרפת, ללול או לגג, ואסור להטיס רחפן או לצלם, בלי הסכמה מפורשת של המחזיקים. אסור להשאיר חומרים בתוך שטח מגודר.
5. בכל פנייה, ציינו בפתח הדברים את שמכם, את החברה שאתם מייצגים, ושהמידע על הגג מבוסס על מיפוי ציבורי ולא נמסר על ידי הבעלים.
6. אין לאסוף, להעשיר או למכור את נתוני השכבה. בכלל זה: הפקה מרוכזת של נסחי טאבו, בניית רשימות לידים, העברה לצד שלישי וסריקה אוטומטית.
7. מי שמשיג בעצמו מידע אישי על בעלים אחראי לעמוד בחוק הגנת הפרטיות, כבעל השליטה במידע שאסף.
8. דמי תיווך: רק מתווך מורשה רשאי לדרוש דמי תיווך על עסקה בגג. מתווך מורשה חייב לציין את מספר הרישיון בפנייה.
9. הפרה עלולה להוביל להשעיית החשבון, לחסימה, ולמסירת מידע לרשויות כשהדין מחייב.

Enforcement mechanics:
- Accepting the Code is a precondition for building-level view. Store the acceptance with a
  timestamp and version.
- Phone OTP and profile (name, company, role) are required.
- View logs per user. Rate limits: 50 detail views and 20 interest clicks per day.
- A "report a contact" link sits in every owner letter and on the owner landing page.
- 1 substantiated complaint leads to a warning; 2 lead to suspension.

### 5.6 SolGag's own "Is this your roof?" letter campaign

**Channel priority**, highest response and lowest risk first:
1. **Through intermediaries who already have a relationship with owners.** For example: moshav
   and kibbutz secretariats, the regional council (Emek Hefer Regional Council), industrial-park
   management companies, sector bodies (dairy and poultry associations, Manufacturers'
   Association). They inform their members. Owners self-select, and there is no personal data
   or spam issue.
2. **Addressed post** to "לכבוד המחזיקים בנכס", at the address resolved internally. Moshav
   addresses ("משק 23") are unreliable; route those through the secretariat.
3. **Hand delivery** to industrial-zone reception desks, by staff following the Code. Never into
   farmyards.
4. Phone or electronic channels: no, except the one-time business consent request after
   [LAWYER] review.

**Cadence:**
- Letter 1 goes out at S1, 30 days before publication.
- At most one reminder, ≥60 days later, and only if there was no response and no removal.
- Then stop for 12 months.
- Nothing more after a claim or a removal.

**Cost, pilot of ~120 roofs:**
- Postage about ₪3.30 per letter. **UNVERIFIED**: secondary report of a 2026 Israel Post change
  from ₪2.60 to ₪3.30.
- Printing about ₪1 (estimate).
- About **₪520 per wave**, about ₪1,000 with the reminder. Staff time for address resolution is
  the main cost, at an estimated 5–10 minutes per roof.

**Response benchmark (indicative only):** ANA direct-mail response rates are often quoted as
about 2–5% for prospect lists, and B2B is often quoted near 4.4%. These are secondary sources
that disagree with each other: [4OVER4](https://www.4over4.com/statistics/direct-mail-response-rate-benchmarks),
[Mailpro](https://mailpro.org/post/typical-direct-mail-response-rates), seen 2026-10-19. A
single letter will give about 3–6 responses per 120 roofs. Intermediaries and the reminder are
needed to reach the 8–10% claim target.

**Letter template (Hebrew draft, one A4 page):**

> **סולגג — מכתב למחזיקים במבנה בכתובת [כתובת]**
> פנייה זו נשלחת בדואר לבעלים ולמחזיקים של מבנים עם גג גדול. איננו יודעים מי אתם, ולא קיבלנו מכם מידע.
> **למה קיבלתם את המכתב?** לפי מיפוי ציבורי של מבנים ובדיקה חזותית בתצלום אוויר, הגג במבנה זה גדול (כ־[1,900] מ״ר) ועשוי להתאים להקמת מערכת סולארית בהספק משוער של כ־[120–190] קילוואט. זו הערכה גסה בלבד.
> **מה אפשר לעשות?** בכתובת solgag.co.il/roof/[קוד] אפשר:
> • לפרסם את הגג כמודעה בחינם ולקבל פניות ממשקיעים וחברות התקנה;
> • לתקן את הנתונים (למשל, אם כבר יש מערכת על הגג);
> • להסיר את הגג מהמפה — בלחיצה אחת, בלי הרשמה.
> **אם לא תעשו דבר:** בעוד 30 יום, ייתכן שהגג יוצג במפת סולגג כ"גג עם פוטנציאל — לא פורסם על ידי הבעלים", בלי כתובת ובלי פרטים מזהים, ורק למשתמשים רשומים. כרגע [N] גורמים הביעו עניין בגגות באזור.
> **מקור המידע:** Microsoft Building Footprints, נתוני שימושי קרקע פתוחים, תצלומי אוויר מורשים, ובדיקה של צוות סולגג.
> **הסרה ופרטיות:** solgag.co.il/roof/[קוד] · [טלפון] · [privacy@…] · [שם החברה, ח.פ., כתובת]. מדיניות הפרטיות: solgag.co.il/privacy
> **אם מישהו פונה אליכם בשמנו** בדרך שאינה הולמת, או שמישהו נכנס לשטח המבנה — דווחו לנו.

[Imagery workstream flag: do not print aerial imagery in letters unless the imagery licence
allows print or derived use.]

---

## 6. (d) Real-estate brokerage, securities and investment advice

### 6.1 Real Estate Brokers Law, 5756-1996

Law text ([Wikisource](https://he.wikisource.org/wiki/חוק_המתווכים_במקרקעין), seen 2026-10-19):
- **s.1 "תיווך במקרקעין":** "הפגשה **בתמורה** בין שני צדדים או יותר, לשם התקשרותם בעיסקה
  בזכות במקרקעין".
- **"זכות במקרקעין":** as in the Land Law, "בין אם היא רשומה ובין אם לאו". It includes
  contractual rights.
- **s.2(א):** no brokering without a licence. **s.2(ב):** no presenting oneself as a broker.
- **s.2(ג), the publication exemption:** the law does not apply to someone who publishes, on TV,
  radio, in a newspaper "או בכל דרך אחרת", information about parties interested in real-estate
  deals, "ובלבד שאינו מציג עצמו כמתווך במקרקעין".
- **s.9:** a fee requires a signed **written order** (הזמנה בכתב). **s.14:** a licence, s.9
  compliance and being the **"גורם יעיל"** are required.
- **s.15:** breaching s.2 carries **1 year in prison** and a fine.

A solar roof lease is a real-estate right. Land Law s.3: "שכירות… זכות שהוקנתה בתמורה להחזיק
במקרקעין ולהשתמש בהם שלא לצמיתות". A lease of more than 5 years is "חכירה", and Land Law s.79
requires registration. Solar roof deals usually run 20–25 years
([Wikisource, Land Law](https://he.wikisource.org/wiki/חוק_המקרקעין), seen 2026-10-19).
**Roof deals are therefore "עסקה בזכות במקרקעין".** I found no Israeli ruling on solar roof
leasing platforms (**UNVERIFIED**).

Analysis:
- **Listings that owners publish themselves:** close to the s.2(ג) publication exemption ("Yad2
  model"). /terms already says the operator is not a broker.
- **Potential roofs:** the s.2(ג) exemption fits poorly, because the owners are *not* "parties
  interested in a deal". The real protection is that **no consideration ("תמורה")** is charged
  for meeting the parties.
  - The mediated-interest model (2.2) is a "meeting" (הפגשה). If free, it is not brokerage.
  - **If SolGag charges anyone for it** (per lead, per introduction, success fee, or a
    subscription whose real value is introductions), the activity likely becomes brokerage and
    needs a licence and a written order [LAWYER].

### 6.2 Fee structures, ranked by brokerage risk

| Model | Risk | Notes |
|---|---|---|
| Everything free (**Phase 1**) | Low | Recommended |
| Owner pays for premium placement of their own listing | Low | Advertising (s.2(ג)) |
| Investor pays a flat subscription for analytics (hex density, alerts, saved searches), with no mediated introductions included | Low–medium | Keep introductions free and outside the paid tier [LAWYER] |
| Investor pays per lead or per contact for potential roofs | **High** | "Meeting for consideration" |
| Success fee or commission on a signed roof lease | **High** | Needs a licensed broker, a s.9 written order *before* the introduction, and s.14 effective cause. Possible later through a licensed-broker partner or by licensing staff. |
| SolGag negotiates or drafts agreements | **Prohibited** without the right professionals | s.12 bars brokers from drafting legal documents; the Bar Association law applies. |

### 6.3 Securities and investment advice

- **Investment Advice Law, 1995:** "ייעוץ השקעות" means advice on securities or "נכסים פיננסיים".
  "נכס פיננסי" is a closed list: fund units, options, futures, structured products and so on.
  Real estate and solar installations are **not** on it
  ([Wikisource](https://he.wikisource.org/wiki/חוק_הסדרת_העיסוק_בייעוץ_השקעות,_בשיווק_השקעות_ובניהול_תיקי_השקעות),
  seen 2026-10-19). Showing roof area and kWp is therefore not investment advice.
- **Securities Law:** offering securities (for example shares or units in an SPV owning a roof
  project) to **more than 35 investors** in 12 months needs a prospectus, unless an exemption
  such as licensed crowdfunding applies. Secondary sources
  ([Funder](https://www.funder.co.il/article/114720)); primary text **UNVERIFIED**.
- **Rules:**
  1. No ₪ return, IRR or payback per potential roof. The existing /calculator stays generic with
     its current disclaimer.
  2. No "invest in this roof" wording. No pooling of investors or collecting money. No project
     "offerings" to the public.
  3. The terms already forbid public offerings (keep that).
  4. Any future feature that lets several investors share one roof project needs Israel
     Securities Authority advice [LAWYER].

---

## 7. (e) Claim flow: verification requirements and abuse cases

### 7.1 Who may claim, and which documents prove authority to offer a roof

| Ownership situation | Proves the right | Ties the claimant to that right | Notes |
|---|---|---|---|
| **Registered owner or long lessee in Tabu, company** | Full Tabu extract (נסח רישום מלא) ≤30 days old, showing the company as owner or חוכר | Companies Registrar extract (נסח חברה), plus a signatory confirmation: a letter on company letterhead signed by authorised signatories, or a lawyer's/CPA's confirmation of signing rights; plus a claimant email on the company's domain | **Anyone can buy a Tabu extract**, so it proves the right exists, not that the claimant holds it |
| **Registered owner, individual** | Full Tabu extract ≤30 days | Name match with the account. The claimant also gives the **last 4 digits** of their ID, matched against the extract; do not store the full ID. Plus one presence proof: the **letter code** sent to the building, or a property-tax (ארנונה) or electricity bill for the address | An ID scan is not recommended (minimisation) |
| **Rights held at the Israel Land Authority or a housing company, not in Tabu** | ILA confirmation of rights (אישור זכויות) or a housing-company confirmation | As above | Common in industrial zones |
| **Moshav נחלה** (agricultural building) | Confirmation of rights from the moshav cooperative and/or ILA | Name match plus a presence proof, or a letter from the secretariat confirming the claimant | Whether ILA or moshav consent is needed for PV on farm buildings is **UNVERIFIED**. A secondary source says ILA charges no fee for PV on a lawfully built existing roof. This came from a search-result snippet; which page it came from is uncertain, possibly [tashtiot.co.il](https://tashtiot.co.il/?p=26987). [LAWYER] |
| **Kibbutz** | The kibbutz's own authorisation | Letter signed by the kibbutz's authorised signatories (secretariat or business manager) | Corporate |
| **Tenant** | Lease agreement | Plus the **landlord's written consent** to offer the roof | Without landlord consent, convert the claim into a "tenant interest" record (self-consumption lead), not a listing |
| **Condominium (בית משותף), including multi-unit industrial** | Roof is common property unless attached to a unit (check the registration order and bylaws) | **Land Law s.59ט:** a decision by owners of **two-thirds of the units holding two-thirds of the common property**, at the general assembly, to install PV on the common roof. **s.59י:** one owner may install on a share up to their proportional part, with **45 days' notice** to the representative body and the other owners. Accept: the assembly decision, or the representative body's letter plus the decision | A single unit owner may list only the proportional share (s.59י). Show the reduced area. |
| **Agent** (management company, installer, broker acting for the owner) | Signed authorisation from the owner, plus the owner's documents as above | Agent's identity; **broker licence number** if a fee is involved | The listing is shown as "מפורסם על ידי נציג מורשה" |

### 7.2 Claim process (states)

`submitted → auto-checks → admin review → approved (→ listing draft) | rejected | needs_info`

1. **Auto-checks:**
   - Is there a duplicate open claim?
   - Was a letter code used? It is strong evidence of presence at the address.
   - Does the email domain match the company?
   - How many claims has this account made? More than 3 in 30 days goes to manual scrutiny.
2. **Admin checklist:**
   - The document is ≤30 days old.
   - Names match.
   - Block/parcel on the extract matches the outline's location on GovMap.
   - Signatory authority checks out.
   - For a condominium, the s.59ט/59י documents are present.
   - Redact unneeded data before filing.
3. **Anti-fraud loop:**
   - If the claim did **not** use the letter code, send a **"claim notice" letter to the
     building**: "התקבלה בקשה לפרסם את הגג בכתובת זו. אם לא אתם — דווחו". The listing goes live
     no earlier than **14 days** after approval.
   - With a letter code, the listing can go live immediately after approval.
4. **Conversion:**
   - On approval, create a listing draft owned by the claimant. Map this to the existing
     `owner_verification='verified'` only if the documents meet the existing standard.
   - The potential roof leaves the potential layer.
   - Interested investors are notified once the owner publishes.
5. **Dispute** (second claimant, or a report):
   - Freeze or hide the listing and request documents from both sides.
   - SolGag does not adjudicate title. If the dispute is unresolved after 30 days, it stays
     hidden.

### 7.3 Abuse cases

| Abuse | Example | Mitigation |
|---|---|---|
| Impostor claims to divert investors | Fraudster lists a warehouse, collects "deposits" | Identity binding (7.1); claim-notice letter; 14-day delay; banner on all listings: "סולגג לעולם אינה גובה כסף בשם בעלי גגות — אל תעבירו מקדמות"; report button |
| Broker or installer "locks" roofs | Claims many roofs to resell the leads | Agents need owner authorisation; per-account claim cap; broker licence check |
| Tenant without roof rights | Factory tenant lists the landlord's roof | Landlord consent required; otherwise a tenant-interest record |
| One co-owner or heir | One of 3 siblings lists the barn | Tabu shows all owners. Require all of them, or a power of attorney; flag in review. |
| Competitor sabotage via removal | Hides a rival's roof | Low harm; a verified claim overrides suppression |
| Competitor sabotage via false claim | Claims, then marks "not available" | Same identity binding; a claim-notice letter reaches the real owner |
| Unit owner claims the whole condominium roof | – | Require s.59ט/59י documents; reduce the area |
| Scraping the layer | Bulk extraction into lead lists | No export; rate limits; logs; Code clause 6 |
| Harassing users | Repeated calls or visits | Report link in letters; suspension policy (5.5) |
| Fake removal by the real owner, followed by approaches through other channels | – | Not our problem. Respect removal. |

---

## 8. (f) KPIs and the go/no-go gate

### 8.1 Funnel and events to instrument

`reviewed → letter_sent → letter_code_visited → removal | correction | claim_submitted →
claim_verified → listing_published → investor_interest (pre/post) → inquiry → LOI reported`.

Also log: detail views (signed-in), Code acceptances, outreach complaints, removal reason codes,
review time per roof, and claim verification time.

### 8.2 Targets for the Emek Hefer pilot (denominator: about 100–120 published roofs; window: 6 months from S3)

| KPI | Target (GO) | Iterate | Stop |
|---|---|---|---|
| **Verified claims ÷ published roofs** | **≥8%** (≥8–10 roofs) | 3–8% | <3% |
| Owner engagement (any letter-code visit, claim, correction or removal) ÷ letters | ≥15% | 8–15% | <8% |
| Verified claims that become *published* listings | ≥60% | 40–60% | <40% |
| Roofs with ≥1 investor interest | ≥40% | 20–40% | <20% |
| Distinct investor/installer accounts expressing interest | ≥15 | 8–14 | <8 |
| Inquiries per converted listing within 60 days | ≥2 | 1 | 0 |
| Data precision: published roofs later found wrong (greenhouse, residential, existing PV, bad outline) | ≤10% | 10–20% | >20% |
| Median area error versus the owner's drawn outline | ≤20% | 20–35% | >35% |
| **Removal requests ÷ published roofs** | ≤5% | 5–10% | >10% |
| Substantiated outreach complaints (spam, harassment, trespass) per 100 roofs | ≤2 | 3–4 | ≥5, or **any** trespass or regulator complaint |
| Removal SLA met (hidden ≤1 business day) | 100% | – | <95% |
| Claims approved and later shown fraudulent | 0 | – | ≥1, which pauses claims immediately |
| Reported LOIs or negotiations from converted potential roofs (month 9) | ≥3 | 1–2 | 0 |
| Admin effort per verified claim (review + verification + letters) | ≤2 h | 2–4 h | >4 h |

### 8.3 Hard stops at any time
- Any PPA inquiry or complaint, or a lawyer's letter from an owner: **pause the layer** (hide
  building level) until legal review.
- More than 10% removals in any 30-day window, or ≥2 substantiated trespass or harassment
  reports: suspend direct-approach visibility and revert to mediated-only.

### 8.4 Gates
- **Gate 0 (before S1):** the lawyer signs off section 10. /privacy and /terms are updated
  (potential-layer section and Outreach Code). The removal flow works end to end, tested.
  Licensed imagery and tiles are in place.
- **Gate 1 (end of S2 beta):** complaint and removal rates are within limits.
- **Gate 2 (month 6 after S3): go/no-go for national expansion.** GO requires all of:
  - claim rate ≥8%;
  - interest coverage ≥40%;
  - removals ≤5%;
  - complaints within limits;
  - precision ≥90%;
  - a written legal opinion on the national-scale questions (data-broker status, registration,
    DPO).

  ITERATE if the claim rate is 3–8% but trust and safety are fine. Try more intermediaries, a
  reminder letter, and a better review. **NO-GO** on any "Stop" in the trust and safety rows, or
  a claim rate below 3%.

---

## 9. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | PPA views building-level display as processing without a lawful basis (individual owners) | Medium | High | Notice before publishing; aggregate `individual_likely` roofs; no identity; removal SLA; lawyer opinion |
| R2 | Users spam owners electronically | Medium | Medium–High | Code; mediated default; rate limits; suspension; report link |
| R3 | Trespass or farm-visit incidents | Low–Medium | High (reputation in small communities) | Code clause 4; aggregation in moshavim; intermediaries |
| R4 | Fraudulent claim leads to a scam on investors | Low | High | Identity binding; claim-notice letter; 14-day delay; "no deposits" banner |
| R5 | Treated as unlicensed brokerage | Low (if free) | High (criminal) | No fees in Phase 1; any fee model reviewed first |
| R6 | Owners believe they are "listed" without consent and react publicly | Medium | Medium | Letter first; clear "לא פורסם" labels; one-click removal |
| R7 | Wrong data (greenhouses, PV already installed) erodes trust | Medium | Medium | Human review; precision KPI; correction flow; freshness rules |
| R8 | Data-broker or registration duties at national scale | Medium (national) | Medium | Design choices in 4.7; reassess at Gate 2 |
| R9 | Condominium or co-owner disputes after a listing | Low | Medium | s.59ט/59י checks; all-owners rule |
| R10 | Imagery or footprint licence breach (other workstreams) | – | High | Licensed tiles before S2 (DEPLOY.md already requires it) |

---

## 10. Lawyer checklist (consolidated; needed before Gate 0)

1. Privacy questions 4.9 (1)–(6).
2. Wording and legality of the platform letter (5.6). Is it direct mail? Which disclosures are
   required?
3. Outreach Code (5.5) as part of /terms; SolGag's liability for users' spam; indemnity.
4. Whether the one-time business consent request by email may ever be used, and its wording
   (5.1).
5. Whether the DNC registry applies to calls asking an individual to lease their roof (5.2).
6. Brokerage: confirm that free mediated interest is outside "תיווך". Pre-clear any planned fee
   model (6.2).
7. Securities: confirm that physical-only metrics are fine. Advise on any future multi-investor
   feature (6.3).
8. Claim-flow document standards, especially the moshav, ILA and condominium cases (7.1). Do
   public bodies need a tender (exclusion in 2.3)?
9. Retention schedule (4.6) and the change to keep ownership documents for only 90 days.
10. The existing items in `src/components/site/legalInfo.tsx` REVIEW_NOTES: basis for transfers
    abroad, response time for rights requests, liability cap.

Budget: a privacy and real-estate opinion plus a review of terms, privacy and letters. **Estimate
₪20,000–60,000 (UNVERIFIED; my market estimate, no source).** Ask for a fixed-fee quote that
covers items 1–10.

---

## 11. Flags for the other Phase 1 workstreams

- **Pipeline:** add a `presumed_owner_class` attribute (2.3) from locality type. Add exclusions:
  public, residential condo, Microsoft-only farmland. Add a suppression list and freshness
  fields. Consider the **Ministry of Energy / MAPI per-building solar potential layer (launched
  4 Feb 2025)** as a comparator or prior. Its licence is unknown and must be checked; MAPI data
  is generally proprietary.
- **Review screen:** capture the review label, imagery date, presumed owner class, a "PV present"
  flag and outline quality. Show the reviewer the k≥3 hex effect. Target ≤2 minutes per roof
  (KPI 8.2).
- **Imagery:** no imagery in printed letters unless the licence allows it. Show the imagery date
  in the popup.
- **Public layer:** two-tier visibility, noindex, no export, rate limits, view logs, Code
  acceptance gate.

---

## 12. Sources (all seen 2026-10-19 unless noted)

Primary law texts (consolidated, from Hebrew Wikisource transcriptions; verify against Nevo or
Knesset before relying on them):
- Protection of Privacy Law 5741-1981 (incl. Amendment 13): https://he.wikisource.org/wiki/חוק_הגנת_הפרטיות. Used: s.3 definitions ("מידע אישי", "אדם – למעט תאגיד", "דיוור ישיר", "מאגר מידע"), s.2(1),(3),(9), s.8א, s.11, s.17ב1, s.17ה, s.17ו.
- Privacy Protection (Data Security) Regulations 5777-2017: https://he.wikisource.org/wiki/תקנות_הגנת_הפרטיות_(אבטחת_מידע). Used: reg. 2(ג), reg. 16(א), First Schedule item (ח) on assets, ≤10 authorised users exception, Second Schedule thresholds.
- Real Estate Brokers Law 5756-1996: https://he.wikisource.org/wiki/חוק_המתווכים_במקרקעין. Used: s.1, 2, 9, 12, 14, 15.
- Land Law 5729-1969: https://he.wikisource.org/wiki/חוק_המקרקעין. Used: s.3 (lease), s.59ט, s.59י, s.79.
- Civil Wrongs (Torts) Ordinance: https://he.wikisource.org/wiki/פקודת_הנזיקין. Used: s.29, 30.
- Investment Advice Law 5755-1995: https://he.wikisource.org/wiki/חוק_הסדרת_העיסוק_בייעוץ_השקעות,_בשיווק_השקעות_ובניהול_תיקי_השקעות. Used: s.1 definitions.
- Article 29 WP Opinion 4/2007 (WP136), Example 5: https://ec.europa.eu/justice/article-29/documentation/opinion-recommendation/files/2007/wp136_en.pdf

Official services (pages return 403 to the fetcher; content taken from search-result snippets):
- Tabu extract service: https://www.gov.il/he/service/land_registration_extract
- ILA property information: https://www.gov.il/he/service/property-information
- PPA registration and notice services: https://www.gov.il/he/service/registration_in_the_database , https://www.gov.il/he/service/notice-obligation
- Do-not-call registry: https://dnc.fta.gov.il/

Law-firm and secondary summaries:
- Herzog Fox & Neeman (Mondaq), 26 Nov 2025: https://www.mondaq.com/privacy-protection/1709950/major-amendment-to-privacy-law-in-israel
- RSM Israel, Amendment 13: https://www.rsm.global/israel/he/node/228
- AYR via Legalink, PPA consent paper (Feb 2026), 27 Apr 2026: https://www.legalink.net/en/publications/newsletters/israels-privacy-authority-issues-landmark-guidance-on-consent/7410/
- Shibolet, Meuhedet ₪256,000 sanction, 21 Jul 2026: https://www.shibolet.com/%D7%A2%D7%93%D7%9B%D7%95%D7%9F-%D7%9C%D7%A7%D7%95%D7%97%D7%95%D7%AA-%D7%90%D7%9B%D7%99%D7%A4%D7%94-%D7%91%D7%A2%D7%A7%D7%91%D7%95%D7%AA-%D7%AA%D7%99%D7%A7%D7%95%D7%9F-13-%D7%94%D7%A8%D7%A9%D7%95/
- Shibolet, PPA cross-sector audits, 23 Dec 2025: https://www.shibolet.com/?p=23026
- Haim Ravia (law.co.il), anti-spam law, 27 May 2008: https://www.law.co.il/en/news/2008/05/27/knesset-approves-israeli-anti-spam-law/
- Hebrew Wikipedia, חוק הספאם: https://he.wikipedia.org/wiki/חוק_הספאם
- Times of Israel blog (WhatsApp under s.30A), 6 Jul 2026: https://blogs.timesofisrael.com/the-law-your-whatsapp-bot-keeps-breaking/
- Gadgety, DNC registry, 12 Dec 2022: https://www.gadgety.co.il/?p=302859
- Maariv, 4 Feb 2025, government solar potential map: https://www.maariv.co.il/news/israel/article-1169853
- Mako, 4 Feb 2025: https://www.mako.co.il/finances-money/Article-94a0c45b77dc491026.htm
- H3 resolution table: https://h3geo.org/docs/core-library/restable/
- Direct-mail benchmarks (secondary, conflicting): https://www.4over4.com/statistics/direct-mail-response-rate-benchmarks , https://mailpro.org/post/typical-direct-mail-response-rates
- Securities 35-investor rule (secondary): https://www.funder.co.il/article/114720
- ILA, no fee for rooftop PV on an existing building (search snippet, page not opened, UNVERIFIED): possibly https://tashtiot.co.il/?p=26987
- Precedent (German roof exchanges, for context): https://www.solarserver.de/2022/01/13/berliner-solardachboerse-vermittelt-dachflaechen-fuer-photovoltaik-anlagen/

Internal:
- `research/pilot-emek-hefer/data/stats.json`, `data/candidates.geojson` (tier × land-use tally
  and area percentiles computed 2026-10-19)
- `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`, `src/components/site/legalInfo.tsx`,
  `src/lib/labels.ts`, `supabase/migrations/20261018000000_init.sql` (verification_requests,
  review_verification, ownership-docs bucket)
