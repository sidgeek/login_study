import { useState, useEffect } from 'react';
import { Button, List, Spin, message, Card } from 'antd';
import { LeftOutlined } from '@ant-design/icons';
import FileItem from './FileItem';

const ROOT_PATH = import.meta.env.VITE_NETDISK_ROOT_PATH || '/music';

const Netdisk = () => {
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState(ROOT_PATH);
  const [loading, setLoading] = useState(false);

  const fetchFiles = async (path) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }

      // 注意：这里请求的是 /baidu/disk/files，Vite proxy 会转发到后端
      const response = await fetch(`/baidu/disk/files?path=${encodeURIComponent(path)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch files');
      }

      const data = await response.json();
      const list = data.list || [];
      console.log('Fetched files:', list);
      // 排序：文件夹在前
      list.sort((a, b) => {
        const aIsDir = Number(a.isdir) === 1 || a.isdir === true;
        const bIsDir = Number(b.isdir) === 1 || b.isdir === true;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return 0;
      });
      setFiles(list);
      setCurrentPath(path);
    } catch (err) {
      console.error(err);
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(ROOT_PATH);
  }, []);

  const handleFolderClick = (path) => {
    fetchFiles(path);
  };

  const handleBack = () => {
    if (currentPath === ROOT_PATH) return;
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
    fetchFiles(parentPath);
  };

  return (
    <Card 
      title="Baidu Netdisk Files" 
      extra={
        <span style={{ color: '#999', fontSize: '12px' }}>
            Current Path: {currentPath}
        </span>
      }
      style={{ width: '100%' }}
    >
      <div style={{ marginBottom: '16px' }}>
        <Button 
            icon={<LeftOutlined />} 
            onClick={handleBack} 
            disabled={currentPath === ROOT_PATH || loading}
        >
          Back
        </Button>
      </div>

      <Spin spinning={loading}>
        <List
            dataSource={files}
            renderItem={(file) => (
                <FileItem 
                    file={file} 
                    onFolderClick={handleFolderClick} 
                />
            )}
            locale={{ emptyText: 'No files found' }}
            bordered
            size="small"
        />
      </Spin>
    </Card>
  );
};

export default Netdisk;
