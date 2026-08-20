-- CAR wording seed data from car_wording.csv
-- Generated automatically; re-run: node scripts/db/seed/generate-car-wording-seed.mjs

insert into car_wording (car_wording_id, subject, content)
values
  (1, 'Unsealed Roadworks', $content_1$The Underwriter will indemnify the Insured against an indemnifiable event for all Unsealed Roadworks only up to a maximum combined length of 100 metres any one indemnifiable event.

Definition
Unsealed Roadworks being partially or completed roadworks at any stage of construction that have not received a minimum of one application of a weatherproof course.

Supplementary Exclusion
The Underwriter will not indemnify the Insured against loss or damage caused or aggravated by the use of the Unsealed Roadworks by public vehicles.$content_1$),
  (2, 'Open Trench Limitation (100 metres)', $content_2$We will indemnify the Named Insured against Damage to incomplete Trenches being partially or completely excavated, with or without pipes, ducts, or cables laid therein prior to backfill and final compaction, but only up to a maximum length as shown in the Schedule either in one continuous section or in the aggregate.

We will not indemnify the Named Insured under this endorsement against:
(i)   The cost of rectifying any subsidence of completed backfill regardless of the cause.
(ii)  The cost of cleaning pipes, the ends of which have not been sealed by the end of each working day to prevent entry of water and/or debris.
(iii) The cost of rectifying displacement of pipes or ducts by water unless such pipes and ducts have been secured by the end of each working day by backfill places in a manner intended to counteract pipe buoyancy.$content_2$),
  (3, 'Vegetation', $content_3$We will not indemnify the Insured against Loss of or damage to vegetation which forms part of the Insured Property and which arises directly or indirectly from:
- disease;
- lack of water;
- excess water;
- replanting operations;
- moths, termites, or other insects, vermin, mildew, mould or wet or dry rot;
- transportation operations.

The Endorsement is subject otherwise to the terms and provisions of the Policy to which it is attached.$content_3$),
  (4, 'Existing Buildings or Structures of Principal', $content_4$Existing Buildings or Structures of Principal (Static plus arising out of Contract Works)
The Underwriter will cover the Insured against sudden and unforeseen physical loss or damage, not hereinafter excluded, to Existing Buildings or Structures of Principal, which is in the care, custody or control of the Insured and for which the Insured have agreed to insure, occurring and discovered during the Construction Period.
 
Provided furthermore that indemnity will only be granted in respect of loss or damage to the Existing Buildings or Structures of Principal that has been declared to the Underwriter and noted in the Schedule and will not exceed the limit stated in the Schedule, less any applicable Excess/s.
 
Supplementary Exclusion 
The underwriter will not indemnify the Insured against loss or damage to Existing Buildings or Structures of Principal in respect of ceiling, floor or wall finishes or coverings.
 
Supplementary Condition
All roof and wall openings must be covered by properly fitted and secured tarpaulins outside of normal work hours.$content_4$),
  (5, 'Display Home Wording Endorsement', $content_5$Display Homes, Show Homes & Contents
The Underwriter will indemnify the Insured for Display Homes / Show Homes and / or contents stated in the Policy Schedule for insured damage unless excluded, occurring during the Period of Insurance.
Supplementary Conditions
Coverage under this Policy is conditional upon:
1. all construction works are fully completed at the Display Home/Show Room site; and
2. each site has been cleared of waste and unused construction materials; and
3. all holes and hazardous surfaces have been made safe; and
4. any swimming pool and/or outdoor spa is fenced in accordance with local Building Act requirements; and
5. each Display Home / Show Home is fitted with deadlocks;
6. the Insured or a representative or agent of the Insured is present on site when the speculative home is open 7. for any inspection by the general public or invited guest.
 �Supplementary Exclusions:
The Underwriter will not indemnify the Insured against:
1. Insured damage caused by:
a) wear, tear, rust, corrosion or gradual deterioration;
b) soiled, marked or worn carpets, wall or floor coverings;
c) mechanical breakdown, electrical breakdown, fault, inherent defect, omission or design;
d) birds, animals, vermin, insects, mildew, atmospheric or climatic conditions (other than storms);
e) tree roots;
f) theft unless accompanied by forcible and violent entry into the building;
g) settling of the building.
 
2. The cost of:
a) floor coverings, internal blinds and curtains other than in the room or rooms in which insured damage occurs;
b) the accidental breakage of glass ordinarily carried by hand, or of vases, ornaments and the like;
c) insured damage caused by or resulting from fraud or dishonesty by the Insured or any of the Insured's employees or agents.
3. Consequential loss of any kind.
 
 
Definition
1. Display Homes / Show Homes include:
a) domestic buildings including fixed appliances,
b) in-ground pools, spas and saunas;
c) pergolas and gazebos;
d) driveways and pathways;
e) retaining walls, fences and gates.
   Display Homes / Show Homes exclude:
a) hotel, motel, boarding house, hostel;
b) a temporary or mobile structure;
c) relocatable home, park home, mobile home, caravan;
d) lawns, hedges, trees, shrubs and plants;
e) underground services.
2. Contents include:
a) unfixed floor coverings;
b) curtains and blinds;
c) portable household electrical appliances;
d) fine art, painting, works of art, antiques or curios. These items are limited to $250 for any one article up to a maximum of $1,000 for all articles or claims arising from any one event unless separately specified in the Schedule;
e) property used in connection with a profession carried on in an office in the building.
    Contents exclude:
a) birds, animals, fish and plants;
b) motor vehicles, caravans, watercraft, trailers, aircraft, aerial devices and equipment belonging to these items;
c) stock and/or plant for business purposes;
d) money, cheques, negotiable securities, stamps, title deeds, documents of any kind;
e) articles of jewellery, furs, clothing, watches, gold or silver articles or objects, bullion, precious stones, coin collections, stamp collections and guns.
This Endorsement is subject otherwise to the terms, conditions and exclusions of this Policy.$content_5$),
  (6, 'Heritage Clause', $content_6$Heritage (Modern Materials) Clause
The following clause is added to this Policy

In the case of Existing Buildings or Structures of Principal that has architectural features and/or structural materials possessing ornamental or historical character or for which the original materials are not available, reinstatement value is the cost necessary to replace, repair or restore the building to a reasonably equivalent appearance and capacity using modern materials.$content_6$)
on conflict (car_wording_id) do update set
  subject = excluded.subject,
  content = excluded.content;
