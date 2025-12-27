const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 序列化 BigInt，解决 JSON.stringify 报错
BigInt.prototype.toJSON = function () {
  return this.toString();
};

// 确保数据表存在 (Prisma 自动管理，这里只需初始化 admin 用户)
const ensureDb = async () => {
  try {
    // 检查是否需要初始化 admin 用户
    const adminIdentity = await prisma.authIdentity.findUnique({
      where: {
        identityType_identifier: {
          identityType: 'username',
          identifier: 'admin',
        },
      },
    });

    if (!adminIdentity) {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            nickname: 'admin',
          },
        });

        await tx.authIdentity.create({
          data: {
            userId: user.id,
            identityType: 'username',
            identifier: 'admin',
            credential: '123456',
          },
        });
      });
      console.log('Initialized admin user.');
    }
  } catch (e) {
    console.error('Error initializing database', e);
  }
};

// 初始化 DB
ensureDb().catch(console.error);

const findUser = async (username, password) => {
  const identity = await prisma.authIdentity.findUnique({
    where: {
      identityType_identifier: {
        identityType: 'username',
        identifier: username,
      },
    },
    include: {
      user: true,
    },
  });

  if (identity && identity.credential === password) {
    return {
      userId: identity.user.id,
      username: identity.user.nickname,
      credential: identity.credential,
    };
  }
  return null;
};

const findUserById = async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: BigInt(userId) },
  });
  if (user) {
    return {
      userId: user.id,
      username: user.nickname,
    };
  }
  return null;
};

// 根据百度 UK (User Key) 查找用户
const findUserByBaiduId = async (baiduId) => {
  const identity = await prisma.authIdentity.findUnique({
    where: {
      identityType_identifier: {
        identityType: 'baidu',
        identifier: String(baiduId),
      },
    },
    include: {
      user: true,
    },
  });

  if (identity) {
    return {
      userId: identity.user.id,
      username: identity.user.nickname,
      data: identity.data,
    };
  }
  return null;
};

// 创建用户 (支持可选参数)
const createUser = async ({ username, password, baiduId, extraInfo = {} }) => {
  try {
    // 检查用户名是否已存在 (如果是 username 注册)
    if (!baiduId) {
      const existing = await prisma.authIdentity.findUnique({
        where: {
          identityType_identifier: {
            identityType: 'username',
            identifier: username,
          },
        },
      });
      if (existing) {
        throw new Error('User already exists');
      }
    }

    // 插入 User 表
    // 如果是百度注册，nickname 取 username 或者 extraInfo 中的 name
    const nickname = username || extraInfo.baiduName || `user_${Date.now()}`;
    const avatar = extraInfo.avatar || '';

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          nickname,
          avatar,
        },
      });

      // 插入 AuthIdentity 表
      if (baiduId) {
        // 百度登录
        await tx.authIdentity.create({
          data: {
            userId: user.id,
            identityType: 'baidu',
            identifier: String(baiduId),
            data: extraInfo,
          },
        });
      } else {
        // 普通注册
        await tx.authIdentity.create({
          data: {
            userId: user.id,
            identityType: 'username',
            identifier: username,
            credential: password,
          },
        });
      }

      return {
        userId: user.id,
        username: nickname,
        ...extraInfo,
      };
    });

    return result;

  } catch (e) {
    throw e;
  }
};

module.exports = {
  prisma,
  findUser,
  findUserById,
  findUserByBaiduId,
  createUser
};
