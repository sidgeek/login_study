const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/users.json');

// 确保数据目录存在
const ensureDb = () => {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    // 初始化默认 admin 用户
    const initialData = [
      {
        userId: 1,
        username: 'admin',
        password: '123456' // 实际生产环境请使用哈希存储
      }
    ];
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2));
  }
};

const getUsers = () => {
  ensureDb();
  const data = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(data);
};

const saveUsers = (users) => {
  fs.writeFileSync(DB_PATH, JSON.stringify(users, null, 2));
};

const findUser = (username, password) => {
  const users = getUsers();
  return users.find(u => u.username === username && u.password === password);
};

const findUserById = (userId) => {
  const users = getUsers();
  return users.find(u => u.userId === userId);
};

// 根据百度 UK (User Key) 查找用户
const findUserByBaiduId = (baiduId) => {
  const users = getUsers();
  return users.find(u => u.baiduId === baiduId);
};

// 简单的用户 ID 生成器 (取最大 ID + 1)
const generateUserId = () => {
  const users = getUsers();
  const maxId = users.reduce((max, u) => Math.max(max, u.userId), 0);
  return maxId + 1;
};

// 创建用户 (支持可选参数)
const createUser = ({ username, password, baiduId, extraInfo = {} }) => {
  const users = getUsers();
  
  // 检查用户名是否已存在
  if (users.find(u => u.username === username)) {
    // 如果是百度自动注册，遇到重名尝试添加后缀
    if (baiduId) {
      let suffix = 1;
      while (users.find(u => u.username === `${username}_${suffix}`)) {
        suffix++;
      }
      username = `${username}_${suffix}`;
    } else {
      throw new Error('User already exists');
    }
  }
  
  const newUser = {
    userId: generateUserId(),
    username,
    password, // 百度登录用户密码可能为空或特定标识
    baiduId,
    ...extraInfo,
    createdAt: new Date().toISOString()
  };
  
  users.push(newUser);
  saveUsers(users);
  return newUser;
};

module.exports = {
  findUser,
  findUserById,
  findUserByBaiduId,
  createUser
};
