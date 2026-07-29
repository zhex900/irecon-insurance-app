<%@ Control Language="C#" AutoEventWireup="true" CodeBehind="CARSendToInsurer.ascx.cs" Inherits="Website.Emails.CARSendToInsurer" %>

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
    <table class="MsoTableGrid" border="1" cellspacing="0" cellpadding="0" style='margin-left: 13.8pt; border-collapse: collapse; border: none'>
        <tr style='height: 14.2pt'>
            <td width="161" valign="top" style='width: 120.5pt; border: dotted gray 1.0pt; background: gray; padding: 0cm 5.4pt 0cm 5.4pt; height: 14.2pt'>
                <p style='margin-left: -4.2pt; text-indent: 4.2pt'><b><span style='font-size: 10.0pt; color: white'>Quotation Number:</span></b></p>
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
                <p class="MsoNoSpacing" style='margin-left: -4.2pt; text-indent: 4.2pt'><b><span style='font-size: 10.0pt; color: #262626'><%# GetDataValue("InsuredName")%></span></b><b><span style='font-size: 10.0pt; color: #262626'></span></b></p>
            </td>
        </tr>
    </table>

    <p>
        Dear Insurer,
    </p>
    <p>
        We have received a request for a new Contract Works Insurance policy which requires your attention. Please see the message below and refer to the attached documents.</p>
    <p>
        <%# GetDataValue("InsurerEmailBody") %>
    </p>

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

   <table border="0" cellspacing="0" cellpadding="0" style="font-size: 8.5pt; margin-left: 10px;">
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
