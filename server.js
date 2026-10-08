/**
 * 时代楷模 App 数据服务
 * 技术栈：Node.js + Express，数据源为 data/models.json（可直接编辑该文件增删数据）
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;
const DATA_FILE = path.join(__dirname, 'data', 'models.json');

app.use(cors());
app.use(express.json());

// ---------- 数据加载 ----------
function loadData() {
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const json = JSON.parse(raw);
  return Array.isArray(json.models) ? json.models : [];
}

let MODELS = loadData();

// 兼容“YYYY / YYYY-MM / YYYY-MM-DD”三种日期，补齐为可比较的 YYYYMMDD 数字
function sortKey(dateStr) {
  const parts = String(dateStr || '').split('-');
  const y = (parts[0] || '0000').padEnd(4, '0');
  const m = (parts[1] || '01').padStart(2, '0');
  const d = (parts[2] || '01').padStart(2, '0');
  return Number(`${y}${m}${d}`);
}

function yearOf(dateStr) {
  return String(dateStr || '').slice(0, 4);
}

// 列表项：去掉长文本 story，减小响应体积
function listView(m) {
  return {
    id: m.id,
    name: m.name,
    type: m.type,
    posthumous: m.posthumous,
    awardDate: m.awardDate,
    year: yearOf(m.awardDate),
    identity: m.identity,
    region: m.region,
    summary: m.summary,
    tags: m.tags,
    avatar: m.avatar,
    featured: m.featured
  };
}

// ---------- 基础路由 ----------
app.get('/', (req, res) => {
  res.json({
    service: '时代楷模 App 数据服务',
    version: '1.0.0',
    total: MODELS.length,
    endpoints: [
      'GET /api/models?page=1&pageSize=10&type=personal|collective&year=2020&posthumous=true&featured=true&sort=desc',
      'GET /api/models/:id',
      'GET /api/search?q=关键词',
      'GET /api/featured',
      'GET /api/years',
      'GET /api/stats',
      'GET /health'
    ]
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), total: MODELS.length });
});

// ---------- 楷模列表（分页 + 筛选） ----------
app.get('/api/models', (req, res) => {
  let list = MODELS.slice();
  const { type, year, posthumous, featured, q } = req.query;

  if (type === 'personal' || type === 'collective') {
    list = list.filter((m) => m.type === type);
  }
  if (year) {
    list = list.filter((m) => yearOf(m.awardDate) === String(year));
  }
  if (posthumous === 'true') {
    list = list.filter((m) => m.posthumous === true);
  } else if (posthumous === 'false') {
    list = list.filter((m) => m.posthumous === false);
  }
  if (featured === 'true') {
    list = list.filter((m) => m.featured === true);
  }
  if (q) {
    const kw = String(q).toLowerCase();
    list = list.filter((m) =>
      [m.name, m.identity, m.region, m.summary, (m.tags || []).join(' ')]
        .join(' ')
        .toLowerCase()
        .includes(kw)
    );
  }

  const sort = req.query.sort === 'asc' ? 1 : -1;
  list.sort((a, b) => (sortKey(a.awardDate) - sortKey(b.awardDate)) * sort);

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
  const total = list.length;
  const start = (page - 1) * pageSize;
  const rows = list.slice(start, start + pageSize).map(listView);

  res.json({
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    data: rows
  });
});

// ---------- 楷模详情 ----------
app.get('/api/models/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const m = MODELS.find((x) => x.id === id);
  if (!m) {
    return res.status(404).json({ code: 404, message: `未找到 id=${id} 的楷模记录` });
  }
  res.json({ data: m });
});

// ---------- 搜索 ----------
app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  if (!q) {
    return res.status(400).json({ code: 400, message: '请提供搜索关键词 q' });
  }
  const list = MODELS.filter((m) =>
    [m.name, m.identity, m.region, m.summary, m.story, (m.tags || []).join(' ')]
      .join(' ')
      .toLowerCase()
      .includes(q)
  )
    .sort((a, b) => sortKey(b.awardDate) - sortKey(a.awardDate))
    .map(listView);

  res.json({ q: req.query.q, total: list.length, data: list });
});

// ---------- 重点推荐（首页轮播/推荐位） ----------
app.get('/api/featured', (req, res) => {
  const list = MODELS.filter((m) => m.featured === true)
    .sort((a, b) => sortKey(b.awardDate) - sortKey(a.awardDate))
    .map(listView);
  res.json({ total: list.length, data: list });
});

// ---------- 年份聚合 ----------
app.get('/api/years', (req, res) => {
  const map = {};
  MODELS.forEach((m) => {
    const y = yearOf(m.awardDate);
    map[y] = (map[y] || 0) + 1;
  });
  const data = Object.keys(map)
    .sort((a, b) => Number(a) - Number(b))
    .map((y) => ({ year: y, count: map[y] }));
  res.json({ data });
});

// ---------- 统计 ----------
app.get('/api/stats', (req, res) => {
  const years = MODELS.map((m) => yearOf(m.awardDate)).filter(Boolean).sort();
  res.json({
    total: MODELS.length,
    personal: MODELS.filter((m) => m.type === 'personal').length,
    collective: MODELS.filter((m) => m.type === 'collective').length,
    posthumous: MODELS.filter((m) => m.posthumous === true).length,
    featured: MODELS.filter((m) => m.featured === true).length,
    yearFrom: years[0] || null,
    yearTo: years[years.length - 1] || null
  });
});

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在', path: req.path });
});

app.listen(PORT, () => {
  console.log(`[时代楷模数据服务] 已启动，监听端口 ${PORT}，共加载 ${MODELS.length} 条记录`);
});
