const Router = require('koa-router');
const jwt = require('jsonwebtoken');
const { findUser } = require('../utils/db');

const router = new Router();

// JWT 密钥，实际生产环境应放在环境变量中
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// 鉴权中间件
const authMiddleware = async (ctx, next) => {
  const authHeader = ctx.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      ctx.state.user = decoded; // 将用户信息存入 ctx.state
      await next();
    } catch (err) {
      ctx.status = 401;
      ctx.body = { error: 'Unauthorized: Invalid token' };
    }
  } else {
    ctx.status = 401;
    ctx.body = { error: 'Unauthorized: No token provided' };
  }
};

// 登录接口：获取 Token
router.post('/login', async (ctx) => {
  const { username, password } = ctx.request.body;
  
  try {
    const user = await findUser(username, password);

    if (user) {
      // 生成 JWT Token
      const token = jwt.sign(
        { userId: user.userId, username: user.username },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      ctx.body = { 
        message: 'Login successful',
        token: token 
      };
    } else {
      ctx.status = 401;
      ctx.body = { error: 'Invalid credentials' };
    }
  } catch (error) {
    console.error('Login error:', error);
    ctx.status = 500;
    ctx.body = { error: 'Internal server error' };
  }
});

// 受保护的接口
router.get('/private', authMiddleware, async (ctx) => {
  ctx.body = { 
    message: 'You have accessed protected data!',
    user: ctx.state.user,
    data: [1, 2, 3] 
  };
});

module.exports = router;
