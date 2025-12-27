import React from 'react';
import { List, Typography } from 'antd';
import { FolderOutlined, FileOutlined, CustomerServiceOutlined } from '@ant-design/icons';

const { Text } = Typography;

const FileItem = ({ file, onFolderClick }) => {
  // 增强判断逻辑，兼容数字、字符串和布尔值
  const isDir = Number(file.isdir) === 1 || file.isdir === true;
  const isMp3 = !isDir && file.server_filename.toLowerCase().endsWith('.mp3');

  const Icon = isDir ? FolderOutlined : (isMp3 ? CustomerServiceOutlined : FileOutlined);
  const iconColor = isDir ? '#1890ff' : (isMp3 ? '#52c41a' : '#999');

  return (
    <List.Item
      onClick={() => isDir && onFolderClick(file.path)}
      style={{
        cursor: isDir ? 'pointer' : 'default',
        backgroundColor: isDir ? '#fafafa' : 'white',
        transition: 'background-color 0.3s',
        padding: '12px 16px'
      }}
      actions={[
        !isDir && (
            <Text type="secondary" style={{ fontSize: '12px' }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
            </Text>
        )
      ]}
    >
      <List.Item.Meta
        avatar={<Icon style={{ fontSize: '24px', color: iconColor }} />}
        title={
            <Text strong={isDir}>{file.server_filename}</Text>
        }
      />
    </List.Item>
  );
};

export default FileItem;
