/**
 * TipTap / React Email editor bodies from `_archive/email-templates/*.ascx`.
 * TipTap-safe markup (tbody tables, blockquote, lists, paragraphs).
 * Portal wording (no legacy binder / iAnyware steps).
 */

/**
 * Label cells use `<td>` (not `<th>`): React Email's `getEmail()` serializer
 * drops TipTap `tableHeader` nodes because they are not EmailNodes.
 */
const LABEL_TD =
  'style="background:#808080;color:#ffffff;font-weight:700;border:1px solid #808080;padding:4px 8px;width:9rem;vertical-align:top"';
const VALUE_TD =
  'style="border:1px solid #808080;padding:4px 8px;vertical-align:top"';

const QUOTE_TABLE = `
<table style="border-collapse:collapse;width:100%;max-width:36rem">
  <tbody>
    <tr>
      <td ${LABEL_TD}><p><strong>Quotation Number</strong></p></td>
      <td ${VALUE_TD}><p><strong>{{policyNumber}}</strong></p></td>
    </tr>
    <tr>
      <td ${LABEL_TD}><p><strong>Cover Type</strong></p></td>
      <td ${VALUE_TD}><p><strong>{{coverType}}</strong></p></td>
    </tr>
    <tr>
      <td ${LABEL_TD}><p><strong>Insured Name</strong></p></td>
      <td ${VALUE_TD}><p><strong>{{insuredName}}</strong></p></td>
    </tr>
  </tbody>
</table>
`.trim();

const QUOTE_TABLE_WITH_SITE = `
<table style="border-collapse:collapse;width:100%;max-width:36rem">
  <tbody>
    <tr>
      <td ${LABEL_TD}><p><strong>Quotation Number</strong></p></td>
      <td ${VALUE_TD}><p><strong>{{policyNumber}}</strong></p></td>
    </tr>
    <tr>
      <td ${LABEL_TD}><p><strong>Cover Type</strong></p></td>
      <td ${VALUE_TD}><p><strong>{{coverType}}</strong></p></td>
    </tr>
    <tr>
      <td ${LABEL_TD}><p><strong>Insured Name</strong></p></td>
      <td ${VALUE_TD}><p><strong>{{insuredName}}</strong></p></td>
    </tr>
    <tr>
      <td ${LABEL_TD}><p><strong>Site Address</strong></p></td>
      <td ${VALUE_TD}><p><strong>{{siteAddress}}</strong></p></td>
    </tr>
  </tbody>
</table>
`.trim();

const RENEWAL_TABLE = `
<table style="border-collapse:collapse;width:100%;max-width:36rem">
  <tbody>
    <tr>
      <td ${LABEL_TD}><p><strong>Policy Number</strong></p></td>
      <td ${VALUE_TD}><p><strong>{{policyNumber}}</strong></p></td>
    </tr>
    <tr>
      <td ${LABEL_TD}><p><strong>Cover Type</strong></p></td>
      <td ${VALUE_TD}><p><strong>{{coverType}}</strong></p></td>
    </tr>
    <tr>
      <td ${LABEL_TD}><p><strong>Insured Name</strong></p></td>
      <td ${VALUE_TD}><p><strong>{{insuredName}}</strong></p></td>
    </tr>
  </tbody>
</table>
`.trim();

const SIGNATURE_AND_NOTICES = `
<p>Kind Regards,</p>
<p>
  <strong>{{accountManagerName}}</strong><br>
  <span style="color: #c00000"><strong>Account Manager</strong></span><br>
  <span style="font-size: 12px">({{accountManagerArNumber}})</span>
</p>
<p>
  <span style="color: #c00000"><strong>Direct:</strong></span> {{accountManagerPhone}}
  <span style="color: #ffafaf"> | </span>
  <span style="color: #c00000"><strong>Email:</strong></span>
  <a href="mailto:{{accountManagerEmail}}">{{accountManagerEmail}}</a>
  <span style="color: #ffafaf"> | </span>
  <span style="color: #c00000"><strong>Web:</strong></span>
  <a href="https://irecon.com.au">irecon.com.au</a>
  <span style="color: #ffafaf"> | </span>
  <a href="https://insuranceadviser.net/financial-services-guide">Financial Services Guide</a><br>
  <span style="color: #c00000"><strong>Office:</strong></span> 02 4655 4311
  <span style="color: #ffafaf"> | </span>
  <span style="color: #c00000"><strong>Post:</strong></span> PO Box 154, Camden NSW 2570
  <span style="color: #ffafaf"> | </span>
  <span style="color: #c00000"><strong>Office:</strong></span> 10 Hill St, Camden, NSW, 2570
</p>
<p>
  <img src="{{footerImage}}" alt="Irecon Advisernet Logo" width="390">
</p>
<p><span style="color: #c00000"><strong>Important Notices:</strong></span></p>
<ul>
  <li>If you are not the intended recipient, please delete this email as its use is prohibited.</li>
  <li>IA does not warrant or represent that this email is free from viruses or defects.</li>
  <li>If you do not wish to receive any further commercial or insurance disclosure electronic messages from IA, please email <a href="mailto:info@iaa.net.au">info@iaa.net.au</a> or contact IA on 02 9954 1311.</li>
  <li>We may use your personal information in line with our Privacy Statement. For more details, call 02 9954 1311, visit <a href="https://www.insuranceadviser.net">www.insuranceadviser.net</a>, or email <a href="mailto:info@iaa.net.au">info@iaa.net.au</a>.</li>
</ul>
`.trim();

const NEXT_STEPS = `
<p><strong><em><u>Where to from here?</u></em></strong></p>
<ul>
  <li>If the client accepts the quotation, proceed to bind using the quote/policy number shown above.</li>
  <li>Send the closing and Stamp Duty Declaration (if applicable) to Steve Duong at ATC (<a href="mailto:stevend@atcis.com.au">stevend@atcis.com.au</a>) — <span style="color: #ff0000"><strong>please also copy me in</strong></span>.</li>
  <li>Your commission is 15%.</li>
</ul>
`.trim();

/** CARPolicyAnnual.ascx */
export const BROKER_ANNUAL_BODY_HTML = `
<blockquote>
  <p><strong><em>Please note ATC reserve the right to revisit or withdraw terms if a claimable incident occurs prior to commencement of the policy.</em></strong></p>
</blockquote>
${QUOTE_TABLE}
<p>Dear {{brokerName}},</p>
<p>Thank you for the opportunity to provide our Contract Works Insurance quotation.</p>
<p><u><strong>Please find the following documents now attached for your interest:</strong></u></p>
<ul>
  <li>Client Quote &amp; Premium Calculations — confirming premium and basis of quotation</li>
  <li>NSW Stamp Duty Declaration (this exemption applies to the Legal Liability section only, and can be deducted from the premium once the declaration has been sent to ATC)</li>
  <li>Policy Schedule</li>
  <li>PDS — Annual Wording</li>
  <li>Policy Comparison (optional, where wording differences need to be highlighted)</li>
</ul>
${NEXT_STEPS}
<p>We trust all in order, however if you have any queries or require further assistance please do not hesitate to contact our office.</p>
<p>Thank you for your continued support.</p>
${SIGNATURE_AND_NOTICES}
`.trim();

/** CARPolicyAnnualRenewal.ascx */
export const BROKER_RENEWAL_BODY_HTML = `
<blockquote>
  <p><strong><em>Please note ATC reserve the right to revisit or withdraw terms if claims are lodged for a loss that occurred prior to the renewal date.</em></strong></p>
</blockquote>
${RENEWAL_TABLE}
<p>Dear {{brokerName}},</p>
<p>Thank you for providing the completed Contract Works Insurance renewal declaration for the forthcoming period.</p>
<p><u><strong>We are pleased to provide terms for adjustment and renewal as follows:</strong></u></p>
<ul>
  <li>Adjustment Premium Calculation</li>
  <li>Renewal Quote &amp; Premium Calculations — confirming renewal premium and basis of quotation (Stamp Duty for Legal Liability Section can be deducted and declaration to be sent to ATC when binding)</li>
  <li>Policy Schedule</li>
  <li>PDS — Annual Wording (updated since last year)</li>
</ul>
${NEXT_STEPS}
<p><span style="color: #ff0000"><strong>** Please note where you have not completed any fields on the Renewal Declaration Form, we have provided renewal terms based on expiring limits &amp; underwriting information.</strong></span></p>
<p>Thank you for your continued support.</p>
${SIGNATURE_AND_NOTICES}
`.trim();

/** CARPolicySingle.ascx */
export const BROKER_SINGLE_BODY_HTML = `
<blockquote>
  <p><strong><em>Please note ATC reserve the right to revisit or withdraw terms if a claimable incident occurs prior to commencement of the policy.</em></strong></p>
</blockquote>
${QUOTE_TABLE_WITH_SITE}
<p>Dear {{brokerName}},</p>
<p>Thank you for the opportunity to provide our Contract Works Insurance quotation for the abovementioned project address.</p>
<p><u><strong>Please find the following documents now attached for your interest:</strong></u></p>
<ul>
  <li>Client Quote &amp; Premium Calculations — confirming premium and basis of quotation (Stamp Duty for Legal Liability Section for NSW risks only &amp; can be deducted once the declaration has been sent to ATC)</li>
  <li>Policy Schedule</li>
  <li>PDS — Single Project Wording</li>
</ul>
${NEXT_STEPS}
<p>Thank you for your continued support.</p>
${SIGNATURE_AND_NOTICES}
`.trim();

/** CARPolicyOwnerBuilder.ascx */
export const BROKER_OWNER_BUILDER_BODY_HTML = `
<blockquote>
  <p><strong><em>Please note ATC reserve the right to revisit or withdraw terms if a claimable incident occurs prior to commencement of the policy.</em></strong></p>
</blockquote>
${QUOTE_TABLE_WITH_SITE}
<p>Dear {{brokerName}},</p>
<p>Thank you for the opportunity to provide Construction Insurance Quote for the abovementioned Owner Builder project.</p>
<p><u><strong>Attached please find the following documents:</strong></u></p>
<ul>
  <li>Client Disclosure &amp; Premium Calculations — confirming premium and basis of quotation</li>
  <li>Policy Schedule</li>
  <li>PDS — Single Project Wording</li>
</ul>
${NEXT_STEPS}
<p>Thank you for your continued support.</p>
${SIGNATURE_AND_NOTICES}
`.trim();

/** CARSendToInsurer.ascx */
export const INSURER_EMAIL_BODY_HTML = `
${QUOTE_TABLE}
<p>Dear Insurer,</p>
<p>We have received a request for a new Contract Works Insurance policy which requires your attention. Please see the message below and refer to the attached documents.</p>
<p>{{insurerEmailBody}}</p>
<p>Thank you for your continued support.</p>
${SIGNATURE_AND_NOTICES}
`.trim();

/** @deprecated Use BROKER_ANNUAL_BODY_HTML */
export const BROKER_EMAIL_BODY_HTML = BROKER_ANNUAL_BODY_HTML;
