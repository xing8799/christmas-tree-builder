const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* ===== 数据存储 ===== */
const DATA_FILE = path.join(__dirname, 'data', 'data.json');
const UPLOADS_TREES = path.join(__dirname, 'uploads', 'trees');
const UPLOADS_ORNS = path.join(__dirname, 'uploads', 'ornaments');

// 确保目录存在
[UPLOADS_TREES, UPLOADS_ORNS, path.join(__dirname, 'data')].forEach(d => {
  fs.mkdirSync(d, { recursive: true });
});

function initData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({
      trees: [],
      ornaments: [],
      categories: ['星星', '彩球', '彩灯', '雪花', '蝴蝶结', '礼物', '糖果', '其他']
    }, null, 2));
  }
}

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

/* ===== Multer 上传配置 ===== */
function makeStorage(dest) {
  return multer.diskStorage({
    destination: dest,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.png';
      cb(null, Date.now() + '-' + Math.random().toString(36).slice(2, 8) + ext);
    }
  });
}

const imgFilter = (req, file, cb) => {
  const ok = ['image/png', 'image/jpeg', 'image/jpg'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (ok.includes(file.mimetype) || ['.png', '.jpg', '.jpeg'].includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('仅支持 PNG / JPG 格式图片'));
  }
};

const uploadTree = multer({ storage: makeStorage(UPLOADS_TREES), fileFilter: pngFilter });
const uploadOrn = multer({ storage: makeStorage(UPLOADS_ORNS), fileFilter: pngFilter });

/* ===== 管理员密码 ===== */
const ADMIN_PWD = process.env.ADMIN_PASSWORD || 'xmas2024';

/* ===== API 路由 ===== */

// 登录
app.post('/api/login', (req, res) => {
  if (req.body.password === ADMIN_PWD) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: '密码错误' });
  }
});

// 圣诞树 CRUD
app.get('/api/trees', (req, res) => {
  res.json(readData().trees);
});

app.post('/api/trees', uploadTree.single('image'), (req, res) => {
  try {
    const data = readData();
    const tree = {
      id: Date.now().toString(),
      name: req.body.name || '未命名圣诞树',
      size: req.body.size || '45cm',
      imageUrl: '/uploads/trees/' + req.file.filename,
      createdAt: new Date().toISOString()
    };
    data.trees.push(tree);
    writeData(data);
    res.json(tree);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/trees/:id', (req, res) => {
  const data = readData();
  const tree = data.trees.find(t => t.id === req.params.id);
  if (tree) {
    const fp = path.join(__dirname, tree.imageUrl);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    data.trees = data.trees.filter(t => t.id !== req.params.id);
    writeData(data);
  }
  res.json({ success: true });
});

// 配饰 CRUD
app.get('/api/ornaments', (req, res) => {
  res.json(readData().ornaments);
});

app.post('/api/ornaments', uploadOrn.single('image'), (req, res) => {
  try {
    const data = readData();
    const orn = {
      id: Date.now().toString(),
      name: req.body.name || '未命名配饰',
      category: req.body.category || '其他',
      imageUrl: '/uploads/ornaments/' + req.file.filename,
      createdAt: new Date().toISOString()
    };
    data.ornaments.push(orn);
    writeData(data);
    res.json(orn);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ornaments/:id', (req, res) => {
  const data = readData();
  const orn = data.ornaments.find(o => o.id === req.params.id);
  if (orn) {
    const fp = path.join(__dirname, orn.imageUrl);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
    data.ornaments = data.ornaments.filter(o => o.id !== req.params.id);
    writeData(data);
  }
  res.json({ success: true });
});

// 分类 CRUD
app.get('/api/categories', (req, res) => {
  res.json(readData().categories);
});

app.post('/api/categories', (req, res) => {
  const data = readData();
  const name = req.body.name;
  if (name && !data.categories.includes(name)) {
    data.categories.push(name);
    writeData(data);
  }
  res.json({ success: true });
});

app.delete('/api/categories/:name', (req, res) => {
  const data = readData();
  data.categories = data.categories.filter(c => c !== decodeURIComponent(req.params.name));
  writeData(data);
  res.json({ success: true });
});

// 错误处理
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: '上传失败: ' + err.message });
  } else if (err.message === '仅支持 PNG 格式图片') {
    res.status(400).json({ error: err.message });
  } else {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

initData();

app.listen(PORT, () => {
  console.log(`圣诞树合成器已启动: http://localhost:${PORT}`);
});
