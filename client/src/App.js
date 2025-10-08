import React, { useState } from 'react';
import client from './feathers';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Home from './Home';

function Login() {
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password');
  const navigate = useNavigate();

  const login = async () => {
    try {
      const result = await client.authenticate({
        strategy: 'local',
        email,
        password
      });
      console.log('Auth success:', result);
      // 保存服务端返回的刷新令牌以便后续自动续期
      if (result && result.refreshToken) {
        window.localStorage.setItem('refreshToken', result.refreshToken);
      }
      navigate('/');
    } catch (error) {
      alert('Error logging in: ' + error.message);
    }
  };

  return (
    <div className="App">
      <h1>Login</h1>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br />
      <button onClick={login}>Login</button>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Home />} />
    </Routes>
  );
}

export default App;
