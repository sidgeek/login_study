import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Netdisk from './Netdisk';

const Home = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [showNetdisk, setShowNetdisk] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('token');
      
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const response = await axios.get('/api/private', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setData(response.data);
      } catch (err) {
        setError('Failed to fetch protected data');
        if (err.response?.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
        }
      }
    };

    fetchData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Home Page</h1>
        <div>
          <button 
            onClick={() => setShowNetdisk(!showNetdisk)} 
            style={styles.netdiskButton}
          >
            {showNetdisk ? 'Hide Netdisk' : 'Baidu Netdisk'}
          </button>
          <button onClick={handleLogout} style={styles.logoutButton}>Logout</button>
        </div>
      </header>
      
      <main style={styles.main}>
        {showNetdisk ? (
          <div style={styles.card}>
            <Netdisk />
          </div>
        ) : (
          <>
            {error && <p style={styles.error}>{error}</p>}
            {data ? (
              <div style={styles.card}>
                <h3>Protected Data:</h3>
                <pre>{JSON.stringify(data, null, 2)}</pre>
              </div>
            ) : (
              <p>Loading...</p>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const styles = {
  container: {
    fontFamily: 'Arial, sans-serif',
    padding: '20px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px'
  },
  netdiskButton: {
    padding: '8px 16px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '10px'
  },
  logoutButton: {
    padding: '8px 16px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  card: {
    padding: '20px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    backgroundColor: '#f9f9f9',
    width: '100%',
    maxWidth: '600px'
  },
  error: {
    color: 'red'
  }
};

export default Home;
