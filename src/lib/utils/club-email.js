/**
 * Generate club approval email HTML
 */
export function generateClubApprovalEmail(clubName, ownerName) {
  const userName = ownerName || 'there'
  
  const template = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Club Approved - ChessBD</title>
    <!--[if mso]>
    <style type="text/css">
        body, table, td {font-family: Arial, sans-serif !important;}
    </style>
    <![endif]-->
    <style>
        body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6}
        .email-wrapper{padding:20px 0}
        .email-container{max-width:700px;margin:0 auto;background-color:#1a1f3a;border:1px solid rgba(100,116,139,0.3)}
        .email-header{background-color:rgba(100,116,139,0.15);border-bottom:2px solid rgba(100,116,139,0.6);padding:30px 20px;text-align:center}
        .email-header h1{margin:0;color:#64748b;font-size:28px;font-weight:700}
        .email-body{padding:40px 30px;background-color:#1a1f3a;color:#fff}
        .email-body h2{color:#fff;margin-top:0;font-size:20px}
        .email-body p{color:#e5e7eb;margin:15px 0}
        .email-body ul,.email-body ol{color:#e5e7eb;margin:15px 0;padding-left:25px}
        .email-body li{margin:8px 0;color:#e5e7eb}
        .email-body strong{color:#64748b}
        .email-footer{background-color:#0f1419;border-top:1px solid rgba(100,116,139,0.3);padding:30px 20px;text-align:center}
        .email-footer p{margin:5px 0;color:#9ca3af;font-size:14px}
        .email-footer a{color:#64748b;text-decoration:none}
        .button{display:inline-block;padding:12px 30px;background-color:#475569;color:#fff!important;text-decoration:none;border-radius:8px;font-weight:600;margin:20px 0}
        .info-box{background-color:rgba(100,116,139,0.1);border-left:4px solid rgba(100,116,139,0.6);padding:15px;margin:20px 0;border-radius:4px}
        .info-box p,.info-box ul,.info-box ol{color:#f3f4f6}
        .info-box strong{color:#64748b}
        .info-box ul{margin:10px 0 0;padding-left:20px}
        .info-box li{margin:8px 0}
        .divider{height:1px;background-color:rgba(100,116,139,0.3);margin:30px 0}
        .text-center{text-align:center}
        .text-small{font-size:14px;color:#9ca3af}
        .text-muted{color:#6b7280;font-size:12px}
        @media only screen and (max-width:600px){
            .email-body{padding:30px 20px}
            .email-header h1{font-size:24px}
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <div class="email-header">
                <h1>Club Approved!</h1>
            </div>
            <div class="email-body">
                <h2>Hello ${userName}!</h2>
                
                <p>Great news! Your chess club <strong>"${clubName}"</strong> has been approved and is now live on ChessBD!</p>
                
                <div class="info-box">
                    <p style="margin:0">
                        <strong>What's Next?</strong>
                    </p>
                    <ul>
                        <li>Your club is now visible to all ChessBD users</li>
                        <li>Players can discover and join your club</li>
                        <li>You can manage members and join requests</li>
                        <li>Share your club page with the chess community</li>
                    </ul>
                </div>
                
                <div class="text-center" style="margin:30px 0">
                    <a href="https://chessbd.app/clubs" class="button">View Your Club</a>
                </div>
                
                <div class="divider"></div>
                
                <p class="text-small">
                    Thank you for being part of the ChessBD community. If you have any questions or need assistance, feel free to reach out to us.
                </p>
                
                <p style="margin-top:30px">
                    Best regards,<br>
                    <strong>The ChessBD Team</strong>
                </p>
            </div>
            <div class="email-footer">
                <p><strong>ChessBD</strong> - Bangladesh's Premier Chess Community</p>
                <p>Visit us at <a href="https://chessbd.app">chessbd.app</a></p>
                <p class="text-muted" style="margin-top:20px">
                    This is an automated email. Please do not reply to this message.
                </p>
                <p class="text-muted" style="margin-top:10px;font-size:11px">
                    <a href="https://chessbd.app/unsubscribe" style="color:#6b7280;text-decoration:underline">Unsubscribe</a> from these emails
                </p>
            </div>
        </div>
    </div>
</body>
</html>`
  
  return template
}

/**
 * Generate club removal email HTML
 */
export function generateClubRemovalEmail(clubName, ownerName, reason) {
  const userName = ownerName || 'there'
  
  const template = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Club Removal Notice - ChessBD</title>
    <!--[if mso]>
    <style type="text/css">
        body, table, td {font-family: Arial, sans-serif !important;}
    </style>
    <![endif]-->
    <style>
        body{margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;line-height:1.6}
        .email-wrapper{padding:20px 0}
        .email-container{max-width:700px;margin:0 auto;background-color:#1a1f3a;border:1px solid rgba(220,38,38,0.3)}
        .email-header{background-color:rgba(220,38,38,0.15);border-bottom:2px solid rgba(220,38,38,0.6);padding:30px 20px;text-align:center}
        .email-header h1{margin:0;color:#dc2626;font-size:28px;font-weight:700}
        .email-body{padding:40px 30px;background-color:#1a1f3a;color:#fff}
        .email-body h2{color:#fff;margin-top:0;font-size:20px}
        .email-body p{color:#e5e7eb;margin:15px 0}
        .email-body ul,.email-body ol{color:#e5e7eb;margin:15px 0;padding-left:25px}
        .email-body li{margin:8px 0;color:#e5e7eb}
        .email-body strong{color:#dc2626}
        .email-footer{background-color:#0f1419;border-top:1px solid rgba(220,38,38,0.3);padding:30px 20px;text-align:center}
        .email-footer p{margin:5px 0;color:#9ca3af;font-size:14px}
        .email-footer a{color:#64748b;text-decoration:none}
        .button{display:inline-block;padding:12px 30px;background-color:#dc2626;color:#fff!important;text-decoration:none;border-radius:8px;font-weight:600;margin:20px 0}
        .info-box{background-color:rgba(220,38,38,0.1);border-left:4px solid rgba(220,38,38,0.6);padding:15px;margin:20px 0;border-radius:4px}
        .info-box p,.info-box ul,.info-box ol{color:#f3f4f6}
        .info-box strong{color:#dc2626}
        .info-box ul{margin:10px 0 0;padding-left:20px}
        .info-box li{margin:8px 0}
        .divider{height:1px;background-color:rgba(220,38,38,0.3);margin:30px 0}
        .text-center{text-align:center}
        .text-small{font-size:14px;color:#9ca3af}
        .text-muted{color:#6b7280;font-size:12px}
        @media only screen and (max-width:600px){
            .email-body{padding:30px 20px}
            .email-header h1{font-size:24px}
        }
    </style>
</head>
<body>
    <div class="email-wrapper">
        <div class="email-container">
            <div class="email-header">
                <h1>Club Removal Notice</h1>
            </div>
            <div class="email-body">
                <h2>Hello ${userName}!</h2>
                
                <p>We regret to inform you that your chess club <strong>"${clubName}"</strong> has been removed from ChessBD.</p>
                
                <div class="info-box">
                    <p style="margin:0">
                        <strong>Reason for Removal:</strong>
                    </p>
                    <p style="margin:10px 0 0 0;color:#f3f4f6">
                        ${reason}
                    </p>
                </div>
                
                <p>If you believe this removal was made in error, or if you have any questions, please contact our support team.</p>
                
                <div class="divider"></div>
                
                <p class="text-small">
                    Thank you for your understanding. If you have any questions or concerns, feel free to reach out to us.
                </p>
                
                <p style="margin-top:30px">
                    Best regards,<br>
                    <strong>The ChessBD Team</strong>
                </p>
            </div>
            <div class="email-footer">
                <p><strong>ChessBD</strong> - Bangladesh's Premier Chess Community</p>
                <p>Visit us at <a href="https://chessbd.app">chessbd.app</a></p>
                <p class="text-muted" style="margin-top:20px">
                    This is an automated email. Please do not reply to this message.
                </p>
                <p class="text-muted" style="margin-top:10px;font-size:11px">
                    <a href="https://chessbd.app/unsubscribe" style="color:#6b7280;text-decoration:underline">Unsubscribe</a> from these emails
                </p>
            </div>
        </div>
    </div>
</body>
</html>`
  
  return template
}

