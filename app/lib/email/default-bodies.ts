/**
 * HTML defaults converted from `_archive/email-templates/*.ascx`.
 * Styles match ASCX (classes inlined). `GetDataValue` → `{{placeholders}}`.
 * Logo is block (not float) so Important Notices always stacks under the image
 * in Visual + Preview iframes.
 */

const HEAD_FACE = "font-family:Arial,sans-serif;font-size:10pt";

/** Shared signature block from ASCX (broken markup fixed; colors preserved). */
const ASCX_SIGNATURE = `
<p style="margin-left:10px">
  Kind Regards,
</p>
<p style="margin-left:10px">
  <strong>{{accountManagerName}}</strong><br>
  <span style="color:rgb(255,175,175);font-size:9pt"><strong>Account Manager</strong></span><br>
  <span style="font-size:8pt">({{accountManagerArNumber}})</span>
</p>
<p style="margin-left:10px">
  <span style="color:rgb(192,0,0)"><strong>Direct:</strong></span> {{accountManagerPhone}}
  <span style="color:rgb(255,175,175)"><strong>|</strong></span>
  <span style="color:rgb(192,0,0)"><strong>Email:</strong></span>
  <a href="mailto:{{accountManagerEmail}}">{{accountManagerEmail}}</a>
  <span style="color:rgb(255,175,175)"><strong>|</strong></span>
  <span style="color:rgb(192,0,0)"><strong>Web:</strong></span>
  <a href="http://irecon.com.au">irecon.com.au</a>
  <span style="color:rgb(255,175,175)"><strong>|</strong></span>
  <a href="https://insuranceadviser.net/financial-services-guide">Financial Services Guide</a>
  <br>
  <span style="color:rgb(192,0,0)"><strong>Office:</strong></span> 02 4655 4311
  <span style="color:rgb(255,175,175)"><strong>|</strong></span>
  <span style="color:rgb(192,0,0)"><strong>Post:</strong></span> PO Box 154, Camden NSW 2570
  <span style="color:rgb(255,175,175)"><strong>|</strong></span>
  <span style="color:rgb(192,0,0)"><strong>Office:</strong></span> 10 Hill St, Camden, NSW, 2570<br>
</p>
<p style="margin-left:10px">
  <img alt="Irecon Advisernet Logo" src="{{footerImage}}" width="520" style="display:block;width:520px;max-width:100%;height:auto">
</p>
<table border="0" cellspacing="0" cellpadding="0" style="clear:both;font-size:8.5pt;margin-left:10px">
  <tr>
    <td style="color:rgb(192,0,0);font-weight:bold;padding:0">Important Notices:</td>
  </tr>
  <tr>
    <td style="padding:0">
      <ul style="margin-top:0;margin-left:24px;font-size:8pt">
        <li>If you are not the intended recipient, please delete this email as its use is prohibited.</li>
        <li>IA does not warrant or represent that this email is free from viruses or defects.</li>
        <li>If you do not wish to receive any further commercial or insurance disclosure electronic messages from IA, please email <a href="mailto:info@iaa.net.au">info@iaa.net.au</a> or contact IA on 02 9954 1311</li>
        <li>We may use your personal information in line with our Privacy Statement. For more details, you can call us on 02 9954 1311, visit <a href="http://www.insuranceadviser.net">www.insuranceadviser.net</a> or email us on <a href="mailto:info@iaa.net.au">info@iaa.net.au</a></li>
      </ul>
    </td>
  </tr>
</table>
`.trim();

const ASCX_QUOTE_3 = (firstLabel: string) =>
  `
<table class="MsoTableGrid" border="1" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:none">
  <tr style="height:14.2pt">
    <td width="161" valign="top" style="width:120.5pt;border:dotted gray 1.0pt;background:gray;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:white">${firstLabel}</span></b></p>
    </td>
    <td width="435" style="width:326.0pt;border:dotted gray 1.0pt;border-left:none;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:#262626">{{policyNumber}}</span></b></p>
    </td>
  </tr>
  <tr style="height:14.2pt">
    <td width="161" valign="top" style="width:120.5pt;border:dotted gray 1.0pt;border-top:none;background:gray;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:white">Cover Type:</span></b></p>
    </td>
    <td width="435" style="width:326.0pt;border-top:none;border-left:none;border-bottom:dotted gray 1.0pt;border-right:dotted gray 1.0pt;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:#262626">{{coverType}}</span></b></p>
    </td>
  </tr>
  <tr style="height:14.2pt">
    <td width="161" valign="top" style="width:120.5pt;border:dotted gray 1.0pt;border-top:none;background:gray;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:white">Insured Name:</span></b></p>
    </td>
    <td width="435" style="width:326.0pt;border-top:none;border-left:none;border-bottom:dotted gray 1.0pt;border-right:dotted gray 1.0pt;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:#262626">{{insuredName}}</span></b></p>
    </td>
  </tr>
</table>
`.trim();

const ASCX_QUOTE_WITH_SITE = `
<table class="MsoTableGrid" border="1" cellspacing="0" cellpadding="0" style="margin-left:13.8pt;border-collapse:collapse;border:none">
  <tr style="height:14.2pt">
    <td width="161" valign="top" style="width:120.5pt;border:dotted gray 1.0pt;background:gray;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:white">Quotation Number:</span></b></p>
    </td>
    <td width="435" style="width:326.0pt;border:dotted gray 1.0pt;border-left:none;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:#262626">{{policyNumber}}</span></b></p>
    </td>
  </tr>
  <tr style="height:14.2pt">
    <td width="161" valign="top" style="width:120.5pt;border:dotted gray 1.0pt;border-top:none;background:gray;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:white">Cover Type:</span></b></p>
    </td>
    <td width="435" style="width:326.0pt;border-top:none;border-left:none;border-bottom:dotted gray 1.0pt;border-right:dotted gray 1.0pt;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:#262626">{{coverType}}</span></b></p>
    </td>
  </tr>
  <tr style="height:14.2pt">
    <td width="161" valign="top" style="width:120.5pt;border:dotted gray 1.0pt;border-top:none;background:gray;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:white">Insured Name:</span></b></p>
    </td>
    <td width="435" style="width:326.0pt;border-top:none;border-left:none;border-bottom:dotted gray 1.0pt;border-right:dotted gray 1.0pt;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:#262626">{{insuredName}}</span></b></p>
    </td>
  </tr>
  <tr style="height:14.2pt">
    <td width="161" valign="top" style="width:120.5pt;border:dotted gray 1.0pt;border-top:none;background:gray;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:white">Site Address</span></b></p>
    </td>
    <td width="435" style="width:326.0pt;border-top:none;border-left:none;border-bottom:dotted gray 1.0pt;border-right:dotted gray 1.0pt;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:#262626">{{siteAddress}}</span></b></p>
    </td>
  </tr>
</table>
`.trim();

const ASCX_NEXT_STEPS = `
<p><strong><i><u>Where to from here?</u></i></strong></p>
<ul style="list-style-type:disc">
  <li>If the client accepts your quotation, simply close on iAnyware under insurer <span style="color:#FF0000"><strong>ATCF</strong></span> which is specific for facility clients.</li>
  <li>The quote/policy number is already located on the schedule template and shown above. Please use this number when binding.</li>
  <li>You can send the closing and Stamp Duty Declaration (if applicable) directly to Steve Duong at ATC (<a href="mailto:stevend@atcis.com.au">stevend@atcis.com.au</a>) - <span style="color:#FF0000"><strong>please also copy me in</strong></span></li>
  <li>Your commission is 15% </li>
</ul>
`.trim();

/** CARPolicyAnnual.ascx */
export const BROKER_ANNUAL_BODY_HTML = `
<div style="${HEAD_FACE}">
<table border="0" cellspacing="0" cellpadding="10" style="background-color:#FFFFCC;border:1px dashed #FFC000;width:100%">
  <tr>
    <td style="font-size:11pt">
      <strong><i>
        Please note ATC reserve the right to revisit or withdraw terms if a claimable incident occurs prior to commencement of the policy.
      </i></strong>
    </td>
  </tr>
</table>
<br>
${ASCX_QUOTE_3("Quotation Number:")}
<p>Dear {{brokerName}},</p>
<p>Thank you for the opportunity to provide our Contract Works Insurance quotation.</p>
<p style="text-decoration:underline"><strong>Please find the following documents now attached for your interest:</strong></p>
<ul style="list-style-type:disc">
  <li>Client Quote &amp; Premium Calculations - confirming premium and basis of quotation</li>
  <li>NSW Stamp Duty Declaration (this exemption applies to the Legal Liability section only, and can be deducted from the premium once the declaration has been sent to ATC)</li>
  <li>iAnyware Schedule Template (Annual) - drop this straight into iAnyware 'Additional Schedule' page (amend the risk question responses to "refer to schedule")</li>
  <li>PDS - Annual Wording</li>
  <li>Policy Comparison - if you feel you really need to push to wording</li>
</ul>
${ASCX_NEXT_STEPS}
<p>We trust all in order, however if you have any queries or require further assistance please do not hesitate to contact our office.</p>
<p>Thank you for your continued support.</p>
${ASCX_SIGNATURE}
</div>
`.trim();

/** CARPolicyAnnualRenewal.ascx */
export const BROKER_RENEWAL_BODY_HTML = `
<div style="${HEAD_FACE}">
<table border="0" cellspacing="0" cellpadding="10" style="background-color:#FFFFCC;border:1px dashed #FFC000;width:100%">
  <tr>
    <td style="font-size:11pt">
      <strong><i>
        Please note ATC reserve the right to revisit or withdraw terms if claims are lodged for a loss that occurred prior to the renewal date.
      </i></strong>
    </td>
  </tr>
</table>
<br>
${ASCX_QUOTE_3("Policy Number:")}
<p>Dear {{brokerName}},</p>
<p>Thank you for providing the completed Contract Works Insurance renewal declaration for the forthcoming period.</p>
<p style="text-decoration:underline"><strong>We are pleased to provide terms for adjustment and renewal as follows:</strong></p>
<ul style="list-style-type:disc">
  <li>Adjustment Premium Calculation</li>
  <li>Renewal Quote &amp; Premium Calculations - confirming renewal premium &amp; basis of quotation (Stamp Duty for Legal Liability Section can be deducted and declaration to be sent to ATC when binding)</li>
  <li>iAnyware Schedule Template (Annual) - drop this straight into iAnyware 'Additional Schedule' page (amend the risk question responses to "refer to schedule")</li>
  <li>PDS - Annual Wording (updated since last year)</li>
</ul>
${ASCX_NEXT_STEPS}
<table border="0" cellspacing="0" cellpadding="2" style="color:#FF0000">
  <tr>
    <td style="vertical-align:top">**</td>
    <td><strong><i>Please note where you have not completed any fields on the Renewal Declaration Form, we have provided renewal terms based on expiring limits &amp; underwriting information.</i></strong></td>
  </tr>
</table>
<p>Thank you for your continued support.</p>
${ASCX_SIGNATURE}
</div>
`.trim();

/** CARPolicySingle.ascx */
export const BROKER_SINGLE_BODY_HTML = `
<div style="${HEAD_FACE}">
<table border="0" cellspacing="0" cellpadding="10" style="background-color:#FFFFCC;border:1px dashed #FFC000;width:100%">
  <tr>
    <td style="font-size:11pt">
      <strong><i>
        Please note ATC reserve the right to revisit or withdraw terms if a claimable incident occurs prior to commencement of the policy.
      </i></strong>
    </td>
  </tr>
</table>
<br>
${ASCX_QUOTE_WITH_SITE}
<p>Dear {{brokerName}},</p>
<p>Thank you for the opportunity to provide our Contract Works Insurance quotation for the abovementioned project address.</p>
<p style="text-decoration:underline"><strong>Please find the following documents now attached for your interest:</strong></p>
<ul style="list-style-type:disc">
  <li>Client Quote &amp; Premium Calculations - confirming premium and basis of quotation (Stamp Duty for Legal Liability Section for NSW risks only &amp; can be deducted once the declaration has been sent to ATC)</li>
  <li>iAnyware Schedule Template (single) - drop this straight into iAnywhere 'Additional Schedule' page (amend the risk question responses to "refer to schedule")</li>
  <li>PDS - Single Project Wording</li>
</ul>
${ASCX_NEXT_STEPS}
<p>Thank you for your continued support.</p>
${ASCX_SIGNATURE}
</div>
`.trim();

/** CARPolicyOwnerBuilder.ascx — full conversion (classes inlined, GetDataValue → placeholders). */
export const BROKER_OWNER_BUILDER_BODY_HTML = `
<div style="${HEAD_FACE}">
<table border="0" cellspacing="0" cellpadding="10" style="background-color:#FFFFCC;border:1px dashed #FFC000;width:100%">
  <tr>
    <td style="font-size:11pt">
      <strong><i>
        Please note ATC reserve the right to revisit or withdraw terms if a claimable incident occurs prior to commencement of the policy.
      </i></strong>
    </td>
  </tr>
</table>
<br>
<table class="MsoTableGrid" border="1" cellspacing="0" cellpadding="0" style="margin-left:13.8pt;border-collapse:collapse;border:none">
  <tr style="height:14.2pt">
    <td width="161" valign="top" style="width:120.5pt;border:dotted gray 1.0pt;background:gray;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:white">Quotation Number:</span></b></p>
    </td>
    <td width="435" style="width:326.0pt;border:dotted gray 1.0pt;border-left:none;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:#262626">{{policyNumber}}</span></b></p>
    </td>
  </tr>
  <tr style="height:14.2pt">
    <td width="161" valign="top" style="width:120.5pt;border:dotted gray 1.0pt;border-top:none;background:gray;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:white">Cover Type:</span></b></p>
    </td>
    <td width="435" style="width:326.0pt;border-top:none;border-left:none;border-bottom:dotted gray 1.0pt;border-right:dotted gray 1.0pt;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:#262626">{{coverType}}</span></b></p>
    </td>
  </tr>
  <tr style="height:14.2pt">
    <td width="161" valign="top" style="width:120.5pt;border:dotted gray 1.0pt;border-top:none;background:gray;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:white">Insured Name:</span></b></p>
    </td>
    <td width="435" style="width:326.0pt;border-top:none;border-left:none;border-bottom:dotted gray 1.0pt;border-right:dotted gray 1.0pt;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:#262626">{{insuredName}}</span></b></p>
    </td>
  </tr>
  <tr style="height:14.2pt">
    <td width="161" valign="top" style="width:120.5pt;border:dotted gray 1.0pt;border-top:none;background:gray;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:white">Site Address</span></b></p>
    </td>
    <td width="435" style="width:326.0pt;border-top:none;border-left:none;border-bottom:dotted gray 1.0pt;border-right:dotted gray 1.0pt;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:#262626">{{siteAddress}}</span></b></p>
    </td>
  </tr>
</table>
<p>Dear {{brokerName}},</p>
<p>Thank you for the opportunity to provide Construction Insurance Quote for the abovementioned Owner Builder project.</p>
<p style="text-decoration:underline"><strong>Attached please find the following documents:</strong></p>
<ul style="list-style-type:disc">
  <li>Client Disclosure &amp; Premium Calculations - confirming premium and basis of quotation</li>
  <li>iAnyware Schedule Template (Owner Builder) - drop this straight into iAnywhere 'Additional Schedule' page (amend the risk question responses to "refer to schedule")</li>
  <li>PDS - Single Project Wording</li>
</ul>
<p><strong><i><u>Where to from here?</u></i></strong></p>
<ul style="list-style-type:disc">
  <li>If the client accepts your quotation, simply close on iAnyware under insurer <span style="color:#FF0000"><strong>ATCF</strong></span> which is specific for facility clients.</li>
  <li>The quote/policy number is already located on the schedule template and shown above. Please use this number when binding.</li>
  <li>You can send the closing and Stamp Duty Declaration (if applicable) directly to Steve Duong at ATC (<a href="mailto:stevend@atcis.com.au">stevend@atcis.com.au</a>) - <span style="color:#FF0000"><strong>please also copy me in</strong></span></li>
  <li>Your commission is 15% </li>
</ul>
<p>Thank you for your continued support.</p>
${ASCX_SIGNATURE}
</div>
`.trim();

/** CARSendToInsurer.ascx */
export const INSURER_EMAIL_BODY_HTML = `
<div style="${HEAD_FACE}">
<table class="MsoTableGrid" border="1" cellspacing="0" cellpadding="0" style="margin-left:13.8pt;border-collapse:collapse;border:none">
  <tr style="height:14.2pt">
    <td width="161" valign="top" style="width:120.5pt;border:dotted gray 1.0pt;background:gray;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:white">Quotation Number:</span></b></p>
    </td>
    <td width="435" style="width:326.0pt;border:dotted gray 1.0pt;border-left:none;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:#262626">{{policyNumber}}</span></b></p>
    </td>
  </tr>
  <tr style="height:14.2pt">
    <td width="161" valign="top" style="width:120.5pt;border:dotted gray 1.0pt;border-top:none;background:gray;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:white">Cover Type:</span></b></p>
    </td>
    <td width="435" style="width:326.0pt;border-top:none;border-left:none;border-bottom:dotted gray 1.0pt;border-right:dotted gray 1.0pt;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:#262626">{{coverType}}</span></b></p>
    </td>
  </tr>
  <tr style="height:14.2pt">
    <td width="161" valign="top" style="width:120.5pt;border:dotted gray 1.0pt;border-top:none;background:gray;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:white">Insured Name:</span></b></p>
    </td>
    <td width="435" style="width:326.0pt;border-top:none;border-left:none;border-bottom:dotted gray 1.0pt;border-right:dotted gray 1.0pt;padding:0cm 5.4pt 0cm 5.4pt;height:14.2pt">
      <p style="margin-left:-4.2pt;text-indent:4.2pt"><b><span style="font-size:10.0pt;color:#262626">{{insuredName}}</span></b></p>
    </td>
  </tr>
</table>
<p>Dear Insurer,</p>
<p>We have received a request for a new Contract Works Insurance policy which requires your attention. Please see the message below and refer to the attached documents.</p>
<p>{{insurerEmailBody}}</p>
<p>Thank you for your continued support.</p>
${ASCX_SIGNATURE}
</div>
`.trim();
