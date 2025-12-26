const cors = require('cors');
const cookieParser = require('cookie-parser');
const { feathers } = require('@feathersjs/feathers');
const express = require('@feathersjs/express');
const socketio = require('@feathersjs/socketio');
const { AuthenticationService, JWTStrategy } = require('@feathersjs/authentication');
const { LocalStrategy } = require('@feathersjs/authentication-local');
const { hashPassword, protect } = require('@feathersjs/authentication-local').hooks;
const users = require('./users');
const jwt = require('jsonwebtoken');

const app = express(feathers());

// 允许携带凭据的跨域（为设置/读取 HttpOnly Cookie）
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.configure(express.rest());
app.configure(socketio({
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
}));

app.set('authentication', {
  secret: 'supersecret',
  entity: 'user',
  service: 'users',
  strategies: ['local', 'jwt'],
  authStrategies: ['jwt', 'local'],
  local: {
    usernameField: 'email',
    passwordField: 'password'
  },
  jwtOptions: {
    expiresIn: '1m' // 示例：改为 7 天，可用 '1h'、'30m' 等
  },
  // 自定义刷新令牌配置，仅供我们生成和验证刷新令牌时读取
  refreshJwtOptions: {
    expiresIn: '7d'
  }
});

const authentication = new AuthenticationService(app);

authentication.register('jwt', new JWTStrategy());
authentication.register('local', new LocalStrategy());

// 自定义 POST /authentication：调用 Feathers 认证服务，并在响应中设置 HttpOnly Cookie
app.post('/authentication', async (req, res, next) => {
  try {
    const result = await authentication.create(req.body, { provider: 'rest', headers: req.headers });

    // 根据认证结果生成并设置刷新令牌 Cookie
    const authConfig = app.get('authentication') || {};
    const secret = authConfig.secret;
    const refreshExpiresIn = (authConfig.refreshJwtOptions && authConfig.refreshJwtOptions.expiresIn) || '7d';

    const userId = (result && result.user && result.user.id) || (result && result.authentication && result.authentication.payload && result.authentication.payload.sub);
    if (userId) {
      const payload = { sub: userId, type: 'refresh' };
      const refreshToken = jwt.sign(payload, secret, { expiresIn: refreshExpiresIn });
      const isProd = process.env.NODE_ENV === 'production';
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/',
        domain: 'localhost'
      });
      // 额外确保通过原生头设置（某些环境下 res.cookie 未生效）
      const cookieParts = [
        `refreshToken=${refreshToken}`,
        'Path=/',
        'HttpOnly',
        isProd ? 'Secure' : '',
        'SameSite=Lax',
        `Max-Age=${7 * 24 * 60 * 60}`,
        'Domain=localhost'
      ].filter(Boolean);
      res.setHeader('Set-Cookie', cookieParts.join('; '));
      // 继续在响应体中包含 refreshToken，便于调试（前端不使用该字段）
      result.refreshToken = refreshToken;
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 其他方法（如 GET）仍由 Feathers 认证服务处理
app.use('/authentication', authentication);

// 登录成功后在响应中附加 refreshToken
const issueRefreshTokenHook = async (context) => {
  const { app } = context;
  const authConfig = app.get('authentication') || {};
  const secret = authConfig.secret;
  const refreshExpiresIn = (authConfig.refreshJwtOptions && authConfig.refreshJwtOptions.expiresIn) || '7d';

  // 更稳妥地获取用户ID：优先 result.user.id，其次 result.authentication.payload.sub，再其次从 params 中取
  const userId = (
    (context && context.result && context.result.user && context.result.user.id) ||
    (context && context.result && context.result.authentication && context.result.authentication.payload && context.result.authentication.payload.sub) ||
    (context && context.params && context.params.user && context.params.user.id) ||
    (context && context.params && context.params.payload && context.params.payload.sub)
  );
  if (!userId) {
    return context;
  }

  const payload = { sub: userId, type: 'refresh' };
  const refreshToken = jwt.sign(payload, secret, { expiresIn: refreshExpiresIn });
  context.result.refreshToken = refreshToken;
  // 若为 HTTP 请求，设置 HttpOnly Cookie
  const res = (context && context.http && context.http.res) ||
              (context && context.params && context.params.http && context.params.http.res) ||
              (context && context.params && context.params.res) ||
              (context && context.params && context.params.express && context.params.express.res);
  if (res) {
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
      domain: 'localhost'
    });
    // 额外用原生头与 append 确保不被覆盖
    const headerValue = [
      `refreshToken=${refreshToken}`,
      'Path=/',
      'HttpOnly',
      isProd ? 'Secure' : '',
      'SameSite=Lax',
      `Max-Age=${7 * 24 * 60 * 60}`,
      'Domain=localhost'
    ].filter(Boolean).join('; ');
    const existing = res.getHeader && res.getHeader('Set-Cookie');
    if (existing) {
      const arr = Array.isArray(existing) ? existing : [String(existing)];
      arr.push(headerValue);
      res.setHeader('Set-Cookie', arr);
    } else {
      res.setHeader('Set-Cookie', headerValue);
    }
  }
  return context;
};

app.service('authentication').hooks({
  after: {
    create: [issueRefreshTokenHook]
  }
});

app.configure(users);

// 刷新令牌端点：校验refreshToken并签发新的accessToken
app.post('/refresh-token', async (req, res, next) => {
  try {
    // 从 HttpOnly Cookie 读取刷新令牌
    const refreshToken = (req.cookies && req.cookies.refreshToken) || null;
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token cookie' });
    }

    const authConfig = app.get('authentication') || {};
    const secret = authConfig.secret;
    const accessExpiresIn = (authConfig.jwtOptions && authConfig.jwtOptions.expiresIn) || '1d';

    const decoded = jwt.verify(refreshToken, secret);
    if (!decoded || decoded.type !== 'refresh' || !decoded.sub) {
      return res.status(400).json({ error: 'Invalid refresh token' });
    }

    const userId = decoded.sub;
    try {
      await app.service('users').get(userId);
    } catch (_) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accessPayload = { sub: userId };
    const accessToken = jwt.sign(accessPayload, secret, { expiresIn: accessExpiresIn });

    // 可选：刷新令牌轮换，重新签发并设置 Cookie
    const newRefreshToken = jwt.sign({ sub: userId, type: 'refresh' }, secret, { expiresIn: (authConfig.refreshJwtOptions && authConfig.refreshJwtOptions.expiresIn) || '7d' });
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
      domain: 'localhost'
    });
    const cookieParts2 = [
      `refreshToken=${newRefreshToken}`,
      'Path=/',
      'HttpOnly',
      isProd ? 'Secure' : '',
      'SameSite=Lax',
      `Max-Age=${7 * 24 * 60 * 60}`,
      'Domain=localhost'
    ].filter(Boolean);
    res.setHeader('Set-Cookie', cookieParts2.join('; '));

    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
});

// 简单测试路由：仅设置 Cookie 以排查 Set-Cookie 问题
app.get('/test-set-cookie', (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  const sampleToken = 'sample_refresh_token_for_debug';
  // 使用 res.cookie 设置
  res.cookie('refreshToken', sampleToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
  // 同时以原生头设置（双保险）
  const headerValue = [
    `refreshToken=${sampleToken}`,
    'Path=/',
    'HttpOnly',
    isProd ? 'Secure' : '',
    'SameSite=Lax',
    `Max-Age=${7 * 24 * 60 * 60}`,
    'Domain=localhost'
  ].filter(Boolean).join('; ');
  res.setHeader('Set-Cookie', headerValue);
  res.status(204).end();
});

// 登出：清除刷新令牌 Cookie
app.post('/logout', (req, res) => {
  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  });
  res.json({ success: true });
});

app.service('users').hooks({
  before: {
    create: [hashPassword('password')],
    find: [],
    get: [],
    patch: [hashPassword('password')],
    remove: []
  },
  after: {
    all: [protect('password')]
  }
});

app.use(express.errorHandler());

const port = 3030;
app.listen(port).then(() => {
  console.log(`Feathers server listening on port ${port}`);
});