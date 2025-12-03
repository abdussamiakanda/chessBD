/**
 * Generate welcome email HTML with user's name
 */
export function generateWelcomeEmail(name) {
  const userName = name || 'there'
  
  const template = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ChessBD!</title>
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
                <h1>Welcome to ChessBD!</h1>
            </div>
            <div class="email-body">
                <h2>Hello ${userName}!</h2>
                
                <p>Welcome to <strong>ChessBD</strong> - Bangladesh's Premier Chess Community! We're thrilled to have you join our growing community of chess enthusiasts.</p>
                
                <div class="info-box">
                    <p style="margin:0">
                        <strong>What's Next?</strong>
                    </p>
                    <ul>
                        <li>Complete your profile to get started</li>
                        <li>Verify your Chess.com username to sync your games</li>
                        <li>Explore upcoming tournaments and events</li>
                        <li>Connect with fellow chess players</li>
                    </ul>
                </div>
                
                <p>Your account has been successfully created. You can now:</p>
                <ul>
                    <li>Participate in tournaments and competitions</li>
                    <li>Track your ratings and game statistics</li>
                    <li>Read the latest chess news and updates</li>
                    <li>Watch live streams from verified streamers</li>
                    <li>Learn and improve with our educational resources</li>
                </ul>
                
                <div class="text-center" style="margin:30px 0">
                    <a href="https://chessbd.app/complete-profile" class="button">Complete Your Profile</a>
                </div>
                
                <div class="divider"></div>
                
                <p class="text-small">
                    If you have any questions or need assistance, feel free to reach out to us. We're here to help you make the most of your ChessBD experience!
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

