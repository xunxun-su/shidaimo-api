/**
 * 将“时代楷模数据服务”注册为 Windows 服务并启动（开机自动运行）
 * 用法：node install-service.js
 * 依赖：npm install node-windows
 */
const path = require('path');
const Service = require('node-windows').Service;

const ROOT = __dirname;
const svc = new Service({
  name: 'ShidaimoAPI',
  description: '时代楷模 App 数据服务（Express REST API）',
  script: path.join(ROOT, 'server.js'),
  workingDirectory: ROOT,
  nodeOptions: [],
  env: [
    { name: 'PORT', value: '80' },
    { name: 'NODE_ENV', value: 'production' }
  ],
  maxRetries: 10,
  maxRestarts: 60
});

svc.on('install', () => {
  console.log('服务已安装，正在启动...');
  svc.start();
});

svc.on('start', () => {
  console.log('ShidaimoAPI 服务已启动，监听端口 80');
});

svc.on('alreadyinstalled', () => {
  console.log('服务已存在，尝试启动...');
  svc.start();
});

svc.on('error', (err) => {
  console.error('服务错误:', err);
});

svc.install();
