const cors = require('cors');
const { feathers } = require('@feathersjs/feathers');
const express = require('@feathersjs/express');
const socketio = require('@feathersjs/socketio');
const { AuthenticationService, JWTStrategy } = require('@feathersjs/authentication');
const { LocalStrategy } = require('@feathersjs/authentication-local');
const { hashPassword, protect } = require('@feathersjs/authentication-local').hooks;
const users = require('./users');
const jwt = require('jsonwebtoken');

const app = express(feathers());

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
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
    res.json({ accessToken });
  } catch (err) {
    next(err);
  }
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