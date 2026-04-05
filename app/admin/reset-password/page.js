<!DOCTYPE html>
<html>
<head>
    <title>Admin - Reset User Password</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background: #1a1a2e;
            color: white;
        }
        .container {
            background: #16213e;
            padding: 30px;
            border-radius: 10px;
            border: 2px solid #0f3460;
        }
        h1 { color: #00d9ff; }
        input, button {
            width: 100%;
            padding: 12px;
            margin: 10px 0;
            border-radius: 5px;
            border: 1px solid #0f3460;
            font-size: 16px;
        }
        input {
            background: #0f3460;
            color: white;
        }
        button {
            background: #00d9ff;
            color: #1a1a2e;
            font-weight: bold;
            cursor: pointer;
        }
        button:hover {
            background: #00b8d4;
        }
        .message {
            padding: 15px;
            margin: 15px 0;
            border-radius: 5px;
        }
        .success {
            background: #00ff9520;
            border: 1px solid #00ff95;
            color: #00ff95;
        }
        .error {
            background: #ff006620;
            border: 1px solid #ff0066;
            color: #ff0066;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 Admin Password Reset</h1>
        <p>Reset password for old accounts that can't sign in</p>
        
        <input type="text" id="username" placeholder="Username (e.g., Spheal)" />
        <input type="password" id="newPassword" placeholder="New Password" />
        <button onclick="resetPassword()">Reset Password</button>
        
        <div id="message"></div>
    </div>

    <script>
        async function resetPassword() {
            const username = document.getElementById('username').value;
            const newPassword = document.getElementById('newPassword').value;
            const messageDiv = document.getElementById('message');
            
            if (!username || !newPassword) {
                messageDiv.innerHTML = '<div class="message error">Please enter both username and password</div>';
                return;
            }
            
            try {
                const response = await fetch('/api/admin/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, newPassword })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    messageDiv.innerHTML = `<div class="message success">✅ Password reset successfully for ${username}!</div>`;
                    document.getElementById('username').value = '';
                    document.getElementById('newPassword').value = '';
                } else {
                    messageDiv.innerHTML = `<div class="message error">❌ ${data.error}</div>`;
                }
            } catch (error) {
                messageDiv.innerHTML = `<div class="message error">❌ Error: ${error.message}</div>`;
            }
        }
    </script>
</body>
</html>
