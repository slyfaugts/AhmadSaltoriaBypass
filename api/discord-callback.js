export default async function handler(req, res) {
  const { code } = req.query;
  const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
  const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
  const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

  if (!code) return res.status(400).json({ error: 'No code provided' });

  try {
    // Exchange code for token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) throw new Error(JSON.stringify(tokenData));

    // Get user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const user = await userRes.json();

    // Return user data as HTML that posts to parent window then closes
    const userData = {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      avatar: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : `https://cdn.discordapp.com/embed/avatars/${parseInt(user.id) % 5}.png`,
      global_name: user.global_name || user.username,
    };

    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html><html><body><script>
      window.opener && window.opener.postMessage(${JSON.stringify({ type: 'DISCORD_LOGIN', user: userData })}, '*');
      window.close();
    </script><p>Login berhasil! Menutup jendela...</p></body></html>`);
  } catch (e) {
    res.status(500).send(`<html><body><script>
      window.opener && window.opener.postMessage(${JSON.stringify({ type: 'DISCORD_ERROR', error: e.message })}, '*');
      window.close();
    </script><p>Login gagal: ${e.message}</p></body></html>`);
  }
}
