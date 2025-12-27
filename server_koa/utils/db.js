const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.POSTGRES_USER || 'postgres',
  host: process.env.POSTGRES_HOST || 'localhost',
  database: process.env.POSTGRES_DB || 'logindb',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  port: process.env.POSTGRES_PORT || 5432,
});

// 确保数据表存在
const ensureDb = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 创建用户主表
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        nickname VARCHAR(64),
        avatar VARCHAR(255),
        bio VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status SMALLINT DEFAULT 1
      );
    `);

    // 创建认证授权表
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_identities (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id),
        identity_type VARCHAR(20) NOT NULL,
        identifier VARCHAR(255) NOT NULL,
        credential VARCHAR(255),
        data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP,
        UNIQUE(identity_type, identifier)
      );
    `);

    // 检查是否需要初始化 admin 用户
    const res = await client.query("SELECT * FROM auth_identities WHERE identity_type = 'username' AND identifier = 'admin'");
    if (res.rowCount === 0) {
      const userRes = await client.query(`
        INSERT INTO users (nickname, created_at, updated_at)
        VALUES ('admin', NOW(), NOW())
        RETURNING id
      `);
      const userId = userRes.rows[0].id;
      
      await client.query(`
        INSERT INTO auth_identities (user_id, identity_type, identifier, credential, created_at)
        VALUES ($1, 'username', 'admin', '123456', NOW())
      `, [userId]);
      
      console.log('Initialized admin user.');
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Error initializing database', e);
    throw e;
  } finally {
    client.release();
  }
};

// 初始化 DB
ensureDb().catch(console.error);

const findUser = async (username, password) => {
  const query = `
    SELECT u.id as "userId", u.nickname as username, ai.credential
    FROM auth_identities ai
    JOIN users u ON ai.user_id = u.id
    WHERE ai.identity_type = 'username' AND ai.identifier = $1
  `;
  const res = await pool.query(query, [username]);
  const user = res.rows[0];
  
  if (user && user.credential === password) {
    return user;
  }
  return null;
};

const findUserById = async (userId) => {
  const query = `SELECT id as "userId", nickname as username FROM users WHERE id = $1`;
  const res = await pool.query(query, [userId]);
  return res.rows[0];
};

// 根据百度 UK (User Key) 查找用户
const findUserByBaiduId = async (baiduId) => {
  const query = `
    SELECT u.id as "userId", u.nickname as username, ai.data
    FROM auth_identities ai
    JOIN users u ON ai.user_id = u.id
    WHERE ai.identity_type = 'baidu' AND ai.identifier = $1
  `;
  const res = await pool.query(query, [String(baiduId)]);
  return res.rows[0];
};

// 创建用户 (支持可选参数)
const createUser = async ({ username, password, baiduId, extraInfo = {} }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 检查用户名是否已存在 (如果是 username 注册)
    if (!baiduId) {
      const check = await client.query("SELECT 1 FROM auth_identities WHERE identity_type = 'username' AND identifier = $1", [username]);
      if (check.rowCount > 0) {
        throw new Error('User already exists');
      }
    }

    // 插入 User 表
    // 如果是百度注册，nickname 取 username 或者 extraInfo 中的 name
    const nickname = username || extraInfo.baiduName || `user_${Date.now()}`;
    const avatar = extraInfo.avatar || '';
    
    const userRes = await client.query(`
      INSERT INTO users (nickname, avatar, created_at, updated_at)
      VALUES ($1, $2, NOW(), NOW())
      RETURNING id
    `, [nickname, avatar]);
    
    const userId = userRes.rows[0].id;

    // 插入 AuthIdentity 表
    if (baiduId) {
      // 百度登录
      await client.query(`
        INSERT INTO auth_identities (user_id, identity_type, identifier, data, created_at)
        VALUES ($1, 'baidu', $2, $3, NOW())
      `, [userId, String(baiduId), extraInfo]);
    } else {
      // 普通注册
      await client.query(`
        INSERT INTO auth_identities (user_id, identity_type, identifier, credential, created_at)
        VALUES ($1, 'username', $2, $3, NOW())
      `, [userId, username, password]);
    }

    await client.query('COMMIT');
    
    return {
      userId,
      username: nickname,
      ...extraInfo
    };

  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  findUser,
  findUserById,
  findUserByBaiduId,
  createUser
};
