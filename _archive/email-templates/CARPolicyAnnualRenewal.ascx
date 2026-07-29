<%@ Control Language="C#" AutoEventWireup="true" CodeBehind="CARPolicyAnnualRenewal.ascx.cs" Inherits="Website.Emails.CARPolicyAnnualRenewal" %>

<html>
<head>
    <style>
        body, td {
            font-family: Arial, sans serif;
            font-size: 10pt;
        }
        .auto-style1 {
            text-decoration: underline;
        }
        .auto-style2 {
            color: #FF0000;
        }
    </style>
</head>
<body>
    <table border="0" cellspacing="0" cellpadding="10" style="background-color: #FFFFCC; border: 1px dashed #FFC000; width: 100%;">
      <tr>
        <td style="font-size: 11pt;">
          <strong><i>
            Please note ATC reserve the right to revisit or withdraw terms if claims are lodged for a loss that occurred prior to the renewal date.
          </i></strong>
        </td>
      </tr>
    </table>
    <br />

    <table class="MsoTableGrid" border="1" cellspacing="0" cellpadding="0" style='border-collapse: collapse; border: none'>
        <tr style='height: 14.2pt'>
            <td width="161" valign="top" style='width: 120.5pt; border: dotted gray 1.0pt; background: gray; padding: 0cm 5.4pt 0cm 5.4pt; height: 14.2pt'>
                <p style='margin-left: -4.2pt; text-indent: 4.2pt'><b><span style='font-size: 10.0pt; color: white'>Policy Number:</span></b></p>
            </td>
            <td width="435" style='width: 326.0pt; border: dotted gray 1.0pt; border-left: none; padding: 0cm 5.4pt 0cm 5.4pt; height: 14.2pt'>
                <p class="MsoNoSpacing" style='margin-left: -4.2pt; text-indent: 4.2pt'>
                    <b><span style='font-size: 10.0pt; color: #262626'><%# GetDataValue("PolicyNumber")%></span></b><b><span style='font-size: 10.0pt; color: #262626'>
                    </span></b>
                </p>
            </td>
        </tr>
        <tr style='height: 14.2pt'>
            <td width="161" valign="top" style='width: 120.5pt; border: dotted gray 1.0pt; border-top: none; background: gray; padding: 0cm 5.4pt 0cm 5.4pt; height: 14.2pt'>
                <p style='margin-left: -4.2pt; text-indent: 4.2pt'><b><span style='font-size: 10.0pt; color: white'>Cover Type:</span></b></p>
            </td>
            <td width="435" style='width: 326.0pt; border-top: none; border-left: none; border-bottom: dotted gray 1.0pt; border-right: dotted gray 1.0pt; padding: 0cm 5.4pt 0cm 5.4pt; height: 14.2pt'>
                <p class="MsoNoSpacing" style='margin-left: -4.2pt; text-indent: 4.2pt'><b><span style='font-size: 10.0pt; color: #262626'><%# GetDataValue("CoverType")%></span></b><b><span style='font-size: 10.0pt; color: #262626'></span></b></p>
            </td>
        </tr>
        <tr style='height: 14.2pt'>
            <td width="161" valign="top" style='width: 120.5pt; border: dotted gray 1.0pt; border-top: none; background: gray; padding: 0cm 5.4pt 0cm 5.4pt; height: 14.2pt'>
                <p style='margin-left: -4.2pt; text-indent: 4.2pt'><b><span style='font-size: 10.0pt; color: white'>Insured Name:</span></b></p>
            </td>
            <td width="435" style='width: 326.0pt; border-top: none; border-left: none; border-bottom: dotted gray 1.0pt; border-right: dotted gray 1.0pt; padding: 0cm 5.4pt 0cm 5.4pt; height: 14.2pt'>
                <p class="MsoNoSpacing" style='margin-left: -4.2pt; text-indent: 4.2pt'><b><span style='font-size: 10.0pt; color: #262626'><%# GetDataValue("InsuredName")%></span></span></b><b><span style='font-size: 10.0pt; color: #262626'></span></b></p>
            </td>
        </tr>
    </table>

    <p>Dear <%# GetDataValue("WholesaleBrokerFullName")%>,</p>

    <p>Thank you for providing the completed Contract Works Insurance renewal declaration for the forthcoming period.</p>

    <p class="auto-style1"><strong>We are pleased to provide terms for adjustment and renewal as follows:</strong></p>

    <ul style="list-style-type: disc">
        <li>Adjustment Premium Calculation</li>
        <li>Renewal Quote &amp; Premium Calculations - confirming renewal premium & basis of quotation (Stamp Duty for Legal Liability Section can be deducted and declaration to be sent to ATC when binding)</li>
        <li>iAnyware Schedule Template (Annual) - drop this straight into iAnyware &#39;Additional Schedule&#39; page (amend the risk question responses to &quot;refer to schedule&quot;)</li>
        <li>PDS - Annual Wording (updated since last year)</li>
    </ul>

    <p><strong><i><u>Where to from here?</u></i></strong></p>
    <ul style="list-style-type: disc">
        <li>If the client accepts your quotation, simply close on iAnyware under insurer <span class="auto-style2"><strong>ATCF</strong></span> which is specific for facility clients.</li>
        <li>The quote/policy number is already located on the schedule template and shown above. Please use this number when binding.</li>
        <li>You can send the closing and Stamp Duty Declaration (if applicable) directly to Steve Duong at ATC (<a href="mailto:stevend@atcis.com.au">stevend@atcis.com.au</a>) - <span class="auto-style2"><strong>please also copy me in</strong></span></li>
        <li>Your commission is 15% </li>
    </ul>

    <table border="0" cellspacing="0" cellpadding="2" class="auto-style2">
        <tr>
            <td style="vertical-align: top">**</td>
            <td><strong><i>Please note where you have not completed any fields on the Renewal Declaration Form, we have provided renewal terms based on expiring limits &amp; underwriting information.</i></strong></td>
        </tr>
    </table>

    <p>Thank you for your continued support.</p>

    <p style="margin-left: 10px;">
        Kind Regards,
    </p>
    <p style="margin-left: 10px;">
        <strong><%# GetDataValue("AccountManagerFullName") %></strong><br />
        <span style="color: rgb(255,175,175);font-size: 9pt;"><strong>Account Manager</strong></span><br />
        <span style="font-size: 8pt">(<%# GetDataValue("AccountManagerARNumber") %>)</span>
    </p>
    <p style="margin-left: 10px;">
    <span style="color: rgb(192,0,0)"><strong>Direct:</span> <%#GetDataValue("AccountManagerMobile") %></strong> <span style="color: rgb(255,175,175)"><strong>|</strong></span>
    <span style="color: rgb(192,0,0)"><strong>Email:</span> <a href="mailto:<%# GetDataValue("AccountManagerEmailAddress") %>"><%# GetDataValue("AccountManagerEmailAddress") %></a></strong> <span style="color: rgb(255,175,175)"><strong>|</strong></span>
    <span style="color: rgb(192,0,0)"><strong>Web:</strong></span> <a href="irecon.com.au">irecon.com.au</a> <span style="color: rgb(255,175,175)"><strong>|</strong></span>
    <a href="https://insuranceadviser.net/financial-services-guide">Financial Services Guide</a>
    <br />    
    <span style="color: rgb(192,0,0)"><strong>Office:</strong></span> 02 4655 4311 <span style="color: rgb(255,175,175)"><strong>|</strong></span>
    <span style="color: rgb(192,0,0)"><strong>Post:</strong></span> PO Box 154, Camden NSW 2570 <span style="color: rgb(255,175,175)"><strong>|</strong></span>
    <span style="color: rgb(192,0,0)"><strong>Office:</strong></span> 10 Hill St, Camden, NSW, 2570<br />
    </p>

    <p style="margin-left: 10px;">
        <img style="float: left; margin-right: 10px;" alt="Irecon Advisernet Logo" src="cid:image02" />
    </p>

   <table border="0" cellspacing="0" cellpadding="0" style="font-size: 8.5pt;margin-left: 10px;">
      <tr>
        <td style="color: rgb(192,0,0); font-weight: bold; padding: 0;">Important Notices:</td>
      </tr>
      <tr>
        <td style="padding: 0;">
          <ul style="margin-top:0; margin-left:24px;font-size: 8pt;">
            <li>If you are not the intended recipient, please delete this email as its use is prohibited.</li>
            <li>IA does not warrant or represent that this email is free from viruses or defects.</li>
            <li>If you do not wish to receive any further commercial or insurance disclosure electronic messages from IA, please email <a href="mailto:info@iaa.net.au">info@iaa.net.au</a> or contact IA on 02 9954 1311</li>
            <li>We may use your personal information in line with our Privacy Statement. For more details, you can call us on 02 9954 1311, visit <a href="www.insuranceadviser.net">www.insuranceadviser.net</a> or email us on <a href="mailto:info@iaa.net.au">info@iaa.net.au</a></li>
          </ul>
        </td>
      </tr>
   </table>

</body>
</html>
