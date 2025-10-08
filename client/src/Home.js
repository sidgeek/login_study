import React, { useEffect, useState } from 'react';
import client from './feathers';
import { useNavigate } from 'react-router-dom';

function Home() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await client.reAuthenticate();
        setUser(result?.user || null);
      } catch (e) {
        navigate('/login');
      }
    };
    checkAuth();
  }, [navigate]);

  const logout = async () => {
    await client.logout();
    navigate('/login');
  };

  return (
    <div className="Home">
      <h1>首页</h1>
      {user ? (
        <p>已登录用户：{user.email}</p>
      ) : (
        <p>正在确认登录状态…</p>
      )}
      <button onClick={logout}>退出登录</button>
    </div>
  );
}

export default Home;