require('dotenv').config(); // 加载环境变量
const Koa = require('koa');
const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const authRouter = require('./routes/auth');
const baiduRouter = require('./routes/baidu');

const app = new Koa();
const router = new Router();

app.use(bodyParser());

// 公开接口
router.get('/', async (ctx) => {
  ctx.body = 'Hello World';
});

app
  .use(router.routes())
  .use(router.allowedMethods())
  .use(new Router({ prefix: '/api' })
    .use(authRouter.routes())
    .use(authRouter.allowedMethods())
    .routes()
  )
  .use(new Router({ prefix: '/api' }).allowedMethods())
  .use(baiduRouter.routes())
  .use(baiduRouter.allowedMethods());

app.listen(3000, () => {
  console.log('Server is running at http://localhost:3000');
});
