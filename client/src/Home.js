import React, { useEffect, useState, useRef } from 'react';
import client from './feathers';
import { useNavigate } from 'react-router-dom';

function Home() {
  const [user, setUser] = useState(null);
  const expiryAlertTimeout = useRef(null);
  const navigate = useNavigate();

  const parseJwtExpMs = (token) => {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      const payload = JSON.parse(jsonPayload);
      if (payload && payload.exp) {
        return payload.exp * 1000; // milliseconds
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const scheduleExpiryAlert = (token) => {
    // Clear any existing timer
    if (expiryAlertTimeout.current) {
      clearTimeout(expiryAlertTimeout.current);
      expiryAlertTimeout.current = null;
    }

    if (!token) return;
    const expMs = parseJwtExpMs(token);
    if (!expMs) return;

    const msUntilAlert = expMs - Date.now() - 30_000; // 30 seconds before expiry
    if (msUntilAlert <= 0) {
      // 令牌即将过期，弹出确认框；确认则刷新，否则退出
      const ok = window.confirm('您的登录将于30秒后过期，是否立即续期？');
      if (ok) {
        void tryRefreshToken();
      } else {
        void logout();
      }
      return;
    }

    expiryAlertTimeout.current = setTimeout(() => {
      // 到期前30秒，弹出确认框；确认则刷新，否则退出
      const ok = window.confirm('您的登录将于30秒后过期，是否立即续期？');
      if (ok) {
        void tryRefreshToken();
      } else {
        void logout();
      }
      expiryAlertTimeout.current = null;
    }, msUntilAlert);
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Feathers v5 uses `reauthenticate`; keep a fallback for compatibility
        const result = await (client.reauthenticate ? client.reauthenticate() : client.reAuthenticate());
        setUser(result?.user || null);
        scheduleExpiryAlert(result?.accessToken);
      } catch (e) {
        navigate('/login');
      }
    };
    checkAuth();

    return () => {
      if (expiryAlertTimeout.current) {
        clearTimeout(expiryAlertTimeout.current);
        expiryAlertTimeout.current = null;
      }
    };
  }, [navigate]);

  const logout = async () => {
    if (expiryAlertTimeout.current) {
      clearTimeout(expiryAlertTimeout.current);
      expiryAlertTimeout.current = null;
    }
    window.localStorage.removeItem('refreshToken');
    await client.logout();
    navigate('/login');
  };

  // 使用刷新令牌向服务端请求新的accessToken，并更新客户端状态
  const tryRefreshToken = async () => {
    try {
      const refreshToken = window.localStorage.getItem('refreshToken');
      if (!refreshToken) {
        // 无刷新令牌，提示并退出登录
        window.alert('暂无刷新令牌，已退出登录，请重新登录。');
        await logout();
        return;
      }

      const res = await fetch('http://localhost:3030/refresh-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || '刷新令牌失败');
      }

      const newAccessToken = data?.accessToken;
      if (!newAccessToken) {
        throw new Error('未返回新的访问令牌');
      }

      // 使用新的令牌更新客户端会话
      await client.authenticate({ strategy: 'jwt', accessToken: newAccessToken });

      // 重新安排下一次到期提醒
      scheduleExpiryAlert(newAccessToken);
    } catch (err) {
      // 刷新失败时提示用户
      window.alert('会话续期失败，已退出登录，请重新登录。');
      await logout();
    }
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