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
      window.alert('您的登录将于30秒后过期，请及时保存或重新登录。');
      return;
    }

    expiryAlertTimeout.current = setTimeout(() => {
      window.alert('您的登录将于30秒后过期，请及时保存或重新登录。');
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