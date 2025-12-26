const Router = require('koa-router');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { findUserByBaiduId, createUser } = require('../utils/db');

const router = new Router({ prefix: '/baidu' });

// JWT 密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 授权接口：重定向到百度授权页面
router.get('/auth', async (ctx) => {
  const { BAIDU_APP_KEY, BAIDU_REDIRECT_URI } = process.env;

  if (!BAIDU_APP_KEY || !BAIDU_REDIRECT_URI) {
    ctx.status = 500;
    ctx.body = { error: 'Missing Baidu App Key or Redirect URI in environment variables' };
    return;
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: BAIDU_APP_KEY,
    redirect_uri: BAIDU_REDIRECT_URI,
    scope: 'basic,netdisk',
    display: 'popup'
  });

  const authUrl = `https://openapi.baidu.com/oauth/2.0/authorize?${params.toString()}`;
  console.log('Auth URL:', authUrl);
  ctx.redirect(authUrl);
});

// 回调接口：处理百度返回的 code，并换取 Token
router.get('/callback', async (ctx) => {
  const { code } = ctx.query;
  const { BAIDU_APP_KEY, BAIDU_SECRET_KEY, BAIDU_REDIRECT_URI } = process.env;

  if (!code) {
    ctx.status = 400;
    ctx.body = { error: 'Authorization code missing' };
    return;
  }

  try {
    // 1. 使用 Code 换取 Access Token
    const tokenResponse = await axios.get('https://openapi.baidu.com/oauth/2.0/token', {
      params: {
        grant_type: 'authorization_code',
        code: code,
        client_id: BAIDU_APP_KEY,
        client_secret: BAIDU_SECRET_KEY,
        redirect_uri: BAIDU_REDIRECT_URI
      }
    });

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // 2. 获取用户信息 (使用 uinfo 接口获取 uk)
    const userInfoResponse = await axios.get('https://pan.baidu.com/rest/2.0/xpan/nas', {
      params: {
        method: 'uinfo',
        access_token: access_token
      }
    });

    const baiduUser = userInfoResponse.data;
    // baiduUser 包含: uk, baidu_name, netdisk_name, avatar_url, vip_type
    
    if (!baiduUser || !baiduUser.uk) {
      throw new Error('Failed to retrieve Baidu user info');
    }

    // 3. 查找或创建本地用户
    let user = findUserByBaiduId(baiduUser.uk);

    if (!user) {
      // 用户不存在，自动注册
      // 用户名优先使用 netdisk_name 或 baidu_name，并加上前缀以避免与普通用户冲突
      const baseName = baiduUser.netdisk_name || baiduUser.baidu_name || `user_${baiduUser.uk}`;
      const username = `baidu_${baseName}`;

      user = createUser({
        username: username,
        password: '', // 第三方登录用户无密码
        baiduId: baiduUser.uk,
        extraInfo: {
          baiduName: baiduUser.baidu_name,
          netdiskName: baiduUser.netdisk_name,
          avatar: baiduUser.avatar_url,
          vipType: baiduUser.vip_type,
          accessToken: access_token, // 可选：存储 access_token 以便后续代表用户调用百度接口
          refreshToken: refresh_token
        }
      });
      console.log(`Created new user for Baidu UK: ${baiduUser.uk}`);
    } else {
      console.log(`User found for Baidu UK: ${baiduUser.uk}`);
      // 可选：更新 access_token 等信息
    }

    // 4. 生成 JWT Token
    const token = jwt.sign(
      { userId: user.userId, username: user.username },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 5. 重定向回前端页面，并携带 Token
    // 注意：这里假设前端运行在 5173 端口 (根据用户截图)
    // 并且前端路由就是 /login，不需要 /api
    ctx.redirect(`http://localhost:5173/login?token=${token}`);

  } catch (error) {
    console.error('Baidu Auth Error:', error.response?.data || error.message);
    ctx.status = 500;
    ctx.body = {
      error: 'Failed to exchange token or get user info',
      details: error.response?.data || error.message
    };
  }
});

module.exports = router;
