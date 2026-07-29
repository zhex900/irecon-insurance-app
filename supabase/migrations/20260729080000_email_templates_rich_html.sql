-- Seed rich HTML email bodies converted from legacy ASCX templates
-- (_archive/email-templates/CARPolicyAnnual.ascx, CARSendToInsurer.ascx).
-- Only replace the original plain-text seed bodies.

update public.app_email_template
set
  subject = 'CAR policy documents — {{policyNumber}}',
  body = $broker$
<table style="background-color:#ffffcc;border:1px dashed #ffc000;width:100%;max-width:560px;margin:0 0 16px 0;font-family:Arial,sans-serif;">
  <tr>
    <td style="padding:10px;font-size:11pt;">
      <strong><em>Please note ATC reserve the right to revisit or withdraw terms if a claimable incident occurs prior to commencement of the policy.</em></strong>
    </td>
  </tr>
</table>
<table style="border-collapse:collapse;border:none;width:100%;max-width:560px;margin:0 0 16px 0;font-family:Arial,sans-serif;font-size:10pt;">
  <tr>
    <td style="width:140px;border:1px dotted #808080;background:#808080;padding:6px 8px;color:#ffffff;font-weight:bold;">Quotation Number:</td>
    <td style="border:1px dotted #808080;padding:6px 8px;color:#262626;font-weight:bold;">{{policyNumber}}</td>
  </tr>
  <tr>
    <td style="width:140px;border:1px dotted #808080;background:#808080;padding:6px 8px;color:#ffffff;font-weight:bold;">Cover Type:</td>
    <td style="border:1px dotted #808080;padding:6px 8px;color:#262626;font-weight:bold;">{{coverType}}</td>
  </tr>
  <tr>
    <td style="width:140px;border:1px dotted #808080;background:#808080;padding:6px 8px;color:#ffffff;font-weight:bold;">Insured Name:</td>
    <td style="border:1px dotted #808080;padding:6px 8px;color:#262626;font-weight:bold;">{{insuredName}}</td>
  </tr>
</table>
<p style="font-family:Arial,sans-serif;font-size:10pt;">Dear {{brokerName}},</p>
<p style="font-family:Arial,sans-serif;font-size:10pt;">Thank you for the opportunity to provide our Contract Works Insurance quotation.</p>
<p style="font-family:Arial,sans-serif;font-size:10pt;text-decoration:underline;"><strong>Please find the following documents now attached for your interest:</strong></p>
<ul style="font-family:Arial,sans-serif;font-size:10pt;">
  <li>Client Quote &amp; Premium Calculations - confirming premium and basis of quotation</li>
  <li>NSW Stamp Duty Declaration (this exemption applies to the Legal Liability section only, and can be deducted from the premium once the declaration has been sent to ATC)</li>
  <li>iAnyware Schedule Template (Annual) - drop this straight into iAnyware 'Additional Schedule' page (amend the risk question responses to "refer to schedule")</li>
  <li>PDS - Annual Wording</li>
  <li>Policy Comparison - if you feel you really need to push to wording</li>
</ul>
<p style="font-family:Arial,sans-serif;font-size:10pt;"><strong><em><u>Where to from here?</u></em></strong></p>
<ul style="font-family:Arial,sans-serif;font-size:10pt;">
  <li>If the client accepts your quotation, simply close on iAnyware under insurer <span style="color:#ff0000;"><strong>ATCF</strong></span> which is specific for facility clients.</li>
  <li>The quote/policy number is already located on the schedule template and shown above. Please use this number when binding.</li>
  <li>You can send the closing and Stamp Duty Declaration (if applicable) directly to Steve Duong at ATC (<a href="mailto:stevend@atcis.com.au">stevend@atcis.com.au</a>) - <span style="color:#ff0000;"><strong>please also copy me in</strong></span></li>
  <li>Your commission is 15%</li>
</ul>
<p style="font-family:Arial,sans-serif;font-size:10pt;">We trust all in order, however if you have any queries or require further assistance please do not hesitate to contact our office.</p>
<p style="font-family:Arial,sans-serif;font-size:10pt;">Thank you for your continued support.</p>
<p style="margin:16px 0 4px 10px;font-family:Arial,sans-serif;font-size:10pt;">Kind Regards,</p>
<p style="margin:0 0 4px 10px;font-family:Arial,sans-serif;font-size:10pt;">
  <strong>{{accountManagerName}}</strong><br />
  <span style="color:#ffafaf;font-size:9pt;"><strong>Account Manager</strong></span><br />
  <span style="font-size:8pt;">({{accountManagerArNumber}})</span>
</p>
<p style="margin:0 0 12px 10px;font-family:Arial,sans-serif;font-size:10pt;">
  <span style="color:#c00000;"><strong>Direct:</strong></span> {{accountManagerPhone}}
  <span style="color:#ffafaf;"><strong> | </strong></span>
  <span style="color:#c00000;"><strong>Email:</strong></span>
  <a href="mailto:{{accountManagerEmail}}">{{accountManagerEmail}}</a>
  <span style="color:#ffafaf;"><strong> | </strong></span>
  <span style="color:#c00000;"><strong>Web:</strong></span>
  <a href="https://irecon.com.au">irecon.com.au</a>
  <span style="color:#ffafaf;"><strong> | </strong></span>
  <a href="https://insuranceadviser.net/financial-services-guide">Financial Services Guide</a><br />
  <span style="color:#c00000;"><strong>Office:</strong></span> 02 4655 4311
  <span style="color:#ffafaf;"><strong> | </strong></span>
  <span style="color:#c00000;"><strong>Post:</strong></span> PO Box 154, Camden NSW 2570
  <span style="color:#ffafaf;"><strong> | </strong></span>
  <span style="color:#c00000;"><strong>Office:</strong></span> 10 Hill St, Camden, NSW, 2570
</p>
<p style="margin:0 0 12px 10px;">
  <img src="{{footerImage}}" alt="Irecon Advisernet Logo" width="390" style="max-width:100%;height:auto;" />
</p>
<p style="margin:0 0 4px 10px;font-family:Arial,sans-serif;font-size:8.5pt;color:#c00000;font-weight:bold;">Important Notices:</p>
<ul style="margin:0 0 0 34px;padding:0;font-family:Arial,sans-serif;font-size:8pt;">
  <li>If you are not the intended recipient, please delete this email as its use is prohibited.</li>
  <li>IA does not warrant or represent that this email is free from viruses or defects.</li>
  <li>If you do not wish to receive any further commercial or insurance disclosure electronic messages from IA, please email <a href="mailto:info@iaa.net.au">info@iaa.net.au</a> or contact IA on 02 9954 1311</li>
  <li>We may use your personal information in line with our Privacy Statement. For more details, you can call us on 02 9954 1311, visit <a href="https://www.insuranceadviser.net">www.insuranceadviser.net</a> or email us on <a href="mailto:info@iaa.net.au">info@iaa.net.au</a></li>
</ul>
$broker$,
  updated_when = now()
where recipient_type = 'broker'
  and body like 'Dear {{brokerName}}%';

update public.app_email_template
set
  subject = 'CAR policy — {{policyNumber}} — {{clientName}}',
  body = $insurer$
<table style="border-collapse:collapse;border:none;width:100%;max-width:560px;margin:0 0 16px 0;font-family:Arial,sans-serif;font-size:10pt;">
  <tr>
    <td style="width:140px;border:1px dotted #808080;background:#808080;padding:6px 8px;color:#ffffff;font-weight:bold;">Quotation Number:</td>
    <td style="border:1px dotted #808080;padding:6px 8px;color:#262626;font-weight:bold;">{{policyNumber}}</td>
  </tr>
  <tr>
    <td style="width:140px;border:1px dotted #808080;background:#808080;padding:6px 8px;color:#ffffff;font-weight:bold;">Cover Type:</td>
    <td style="border:1px dotted #808080;padding:6px 8px;color:#262626;font-weight:bold;">{{coverType}}</td>
  </tr>
  <tr>
    <td style="width:140px;border:1px dotted #808080;background:#808080;padding:6px 8px;color:#ffffff;font-weight:bold;">Insured Name:</td>
    <td style="border:1px dotted #808080;padding:6px 8px;color:#262626;font-weight:bold;">{{insuredName}}</td>
  </tr>
</table>
<p style="font-family:Arial,sans-serif;font-size:10pt;">Dear Insurer,</p>
<p style="font-family:Arial,sans-serif;font-size:10pt;">We have received a request for a new Contract Works Insurance policy which requires your attention. Please see the message below and refer to the attached documents.</p>
<p style="font-family:Arial,sans-serif;font-size:10pt;">{{insurerEmailBody}}</p>
<p style="font-family:Arial,sans-serif;font-size:10pt;">Thank you for your continued support.</p>
<p style="margin:16px 0 4px 10px;font-family:Arial,sans-serif;font-size:10pt;">Kind Regards,</p>
<p style="margin:0 0 4px 10px;font-family:Arial,sans-serif;font-size:10pt;">
  <strong>{{accountManagerName}}</strong><br />
  <span style="color:#ffafaf;font-size:9pt;"><strong>Account Manager</strong></span><br />
  <span style="font-size:8pt;">({{accountManagerArNumber}})</span>
</p>
<p style="margin:0 0 12px 10px;font-family:Arial,sans-serif;font-size:10pt;">
  <span style="color:#c00000;"><strong>Direct:</strong></span> {{accountManagerPhone}}
  <span style="color:#ffafaf;"><strong> | </strong></span>
  <span style="color:#c00000;"><strong>Email:</strong></span>
  <a href="mailto:{{accountManagerEmail}}">{{accountManagerEmail}}</a>
  <span style="color:#ffafaf;"><strong> | </strong></span>
  <span style="color:#c00000;"><strong>Web:</strong></span>
  <a href="https://irecon.com.au">irecon.com.au</a>
  <span style="color:#ffafaf;"><strong> | </strong></span>
  <a href="https://insuranceadviser.net/financial-services-guide">Financial Services Guide</a><br />
  <span style="color:#c00000;"><strong>Office:</strong></span> 02 4655 4311
  <span style="color:#ffafaf;"><strong> | </strong></span>
  <span style="color:#c00000;"><strong>Post:</strong></span> PO Box 154, Camden NSW 2570
  <span style="color:#ffafaf;"><strong> | </strong></span>
  <span style="color:#c00000;"><strong>Office:</strong></span> 10 Hill St, Camden, NSW, 2570
</p>
<p style="margin:0 0 12px 10px;">
  <img src="{{footerImage}}" alt="Irecon Advisernet Logo" width="390" style="max-width:100%;height:auto;" />
</p>
<p style="margin:0 0 4px 10px;font-family:Arial,sans-serif;font-size:8.5pt;color:#c00000;font-weight:bold;">Important Notices:</p>
<ul style="margin:0 0 0 34px;padding:0;font-family:Arial,sans-serif;font-size:8pt;">
  <li>If you are not the intended recipient, please delete this email as its use is prohibited.</li>
  <li>IA does not warrant or represent that this email is free from viruses or defects.</li>
  <li>If you do not wish to receive any further commercial or insurance disclosure electronic messages from IA, please email <a href="mailto:info@iaa.net.au">info@iaa.net.au</a> or contact IA on 02 9954 1311</li>
  <li>We may use your personal information in line with our Privacy Statement. For more details, you can call us on 02 9954 1311, visit <a href="https://www.insuranceadviser.net">www.insuranceadviser.net</a> or email us on <a href="mailto:info@iaa.net.au">info@iaa.net.au</a></li>
</ul>
$insurer$,
  updated_when = now()
where recipient_type = 'insurer'
  and body like 'Dear Underwriter%';
