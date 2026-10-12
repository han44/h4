'use strict';
/**
 * 种子数据 —— 仅在项目首次启动（data/db.json 不存在）时写入。
 * 所有日期均按"当前时间"动态生成，保证任意时间部署都能看到近 6 个月的趋势数据。
 */
const { hashPassword } = require('./auth');

const DEMO_PASSWORD = '123456'; // 演示密码，生产环境务必修改

/** 价值观标签（与 FSG 认可场景对齐） */
const VALUE_TAGS = ['客户至上', '团队协作', '创新突破', '专业敬业', '担当负责', '持续学习'];

/** 每月可发放积分额度 / 单次认可上限 */
const SETTINGS = {
  monthlyAllowance: 1000,
  maxPointsPerRecognition: 200,
  minPointsPerRecognition: 10,
};

const RAW_EMPLOYEES = [
  ['e001', '1001', '李静', '人力资源部', 'HRBP 经理', 'admin', '#8B5CF6', '1990-03-18', 1260, 2000],
  ['e002', '1002', '王磊', '产品部', '高级产品经理', 'employee', '#2563EB', '1993-07-22', 1840, 860],
  ['e003', '1003', '陈晓雯', '技术部', '前端工程师', 'employee', '#EC4899', '1995-10-05', 1520, 720],
  ['e004', '1004', '刘洋', '技术部', '后端工程师', 'employee', '#0891B2', '1991-01-14', 1180, 640],
  ['e005', '1005', '赵敏', '销售部', '大客户经理', 'employee', '#D97706', '1992-10-18', 2260, 910],
  ['e006', '1006', '孙浩', '市场部', '品牌经理', 'employee', '#059669', '1989-05-30', 980, 780],
  ['e007', '1007', '周雨桐', '产品部', '交互设计师', 'employee', '#DB2777', '1996-10-25', 1340, 830],
  ['e008', '1008', '吴建国', '财务部', '财务分析师', 'employee', '#4F46E5', '1987-11-09', 760, 690],
  ['e009', '1009', '郑凯', '技术部', '测试工程师', 'employee', '#EA580C', '1993-10-12', 1120, 745],
  ['e010', '1010', '林芳', '人力资源部', '招聘专员', 'employee', '#7C3AED', '1997-02-28', 890, 800],
  ['e011', '1011', '何伟', '销售部', '销售代表', 'employee', '#B45309', '1994-08-16', 640, 705],
  ['e012', '1012', '马丽', '市场部', '内容运营', 'employee', '#0D9488', '1998-06-11', 720, 760],
];

/** [from, to, tag, message, points, monthsAgo, read] */
const RAW_RECOGNITIONS = [
  ['e005', 'e002', '客户至上', '客户现场演示准备得非常充分，方案一次通过，帮我们拿下续约。', 200, 0, true],
  ['e001', 'e002', '专业敬业', '福利一体化方案文档结构清晰，评审一次过，专业度很高。', 150, 0, false],
  ['e003', 'e002', '团队协作', '跨部门协调很到位，主动帮技术侧补齐了业务背景。', 100, 0, false],
  ['e004', 'e003', '创新突破', '前端组件库重构让首屏加载快了 40%，思路很巧。', 200, 0, true],
  ['e002', 'e004', '担当负责', '上线前夜主动值守，问题定位很快，责任感强。', 150, 1, true],
  ['e006', 'e005', '客户至上', '季度大客户回访做得细致，客户满意度回到 98%。', 200, 1, true],
  ['e001', 'e005', '持续学习', '主动完成数据分析培训并落地到客户复盘里。', 100, 1, true],
  ['e007', 'e003', '团队协作', '设计与前端联调顺畅，还原度几乎一比一。', 120, 1, true],
  ['e002', 'e007', '创新突破', '员工激励页的视觉提案让人眼前一亮，配色很克制。', 180, 2, true],
  ['e005', 'e006', '专业敬业', '品牌物料质量稳定，交付从不拖延。', 100, 2, true],
  ['e008', 'e002', '担当负责', '预算测算严谨，帮业务避免了超支风险。', 150, 2, true],
  ['e009', 'e004', '专业敬业', '接口测试用例覆盖完整，线上缺陷明显下降。', 120, 2, true],
  ['e010', 'e001', '团队协作', '招聘高峰期主动分担面试安排，团队效率提升明显。', 100, 3, true],
  ['e002', 'e009', '持续学习', '自动化回归接入后，回归时间从 2 天缩短到 3 小时。', 200, 3, true],
  ['e011', 'e005', '客户至上', '带教新人很耐心，客户交接没有出现断档。', 100, 3, true],
  ['e012', 'e006', '创新突破', '短视频选题角度新颖，单条播放量破 10 万。', 150, 3, true],
  ['e004', 'e002', '团队协作', '需求变更沟通及时，避免了一次返工。', 100, 4, true],
  ['e003', 'e007', '专业敬业', '交互稿标注规范，开发几乎零疑问。', 120, 4, true],
  ['e001', 'e010', '担当负责', '校招宣讲连轴转了两周，依然保持高质量。', 150, 4, true],
  ['e006', 'e012', '持续学习', '内容数据复盘方法升级后，选题命中率明显提高。', 100, 4, true],
  ['e005', 'e011', '客户至上', '客户投诉处理得当，挽回了合作关系。', 120, 5, true],
  ['e002', 'e008', '专业敬业', '开票口径梳理得很清楚，统一开票方案终于落地。', 180, 5, true],
  ['e007', 'e002', '创新突破', '原型里的微动效让演示效果提升一个档次。', 100, 5, true],
  ['e009', 'e003', '团队协作', '联调阶段配合默契，问题当日清零。', 100, 5, true],
];

const RAW_REWARDS = [
  ['r1', '星巴克电子饮品券', '全国门店通用，即时发放', 200, 50, '☕', '餐饮'],
  ['r2', '电影通兑券', '支持全国主流院线', 150, 80, '🎬', '文娱'],
  ['r3', '京东购物卡 50 元', '电子卡密，自动发货', 500, 30, '🛍️', '购物'],
  ['r4', '品牌定制保温杯', '实物礼品，行政前台领取', 350, 25, '🥤', '实物'],
  ['r5', '京东购物卡 100 元', '电子卡密，自动发货', 1000, 12, '🎁', '购物'],
  ['r6', '半天带薪休假', '需直属上级审批', 800, 10, '🏖️', '福利'],
];

/** 月度之星候选人（工号 → 推荐理由） */
const RAW_VOTE_CANDIDATES = [
  ['e005', '赵敏', '销售部', '季度签约额团队第一，客户满意度 98%'],
  ['e003', '陈晓雯', '技术部', '主导前端性能治理，首屏加载提速 40%'],
  ['e002', '王磊', '产品部', '推动福利一体化方案落地，跨部门协同高效'],
  ['e009', '郑凯', '技术部', '自动化测试体系搭建，回归效率提升 5 倍'],
];

function monthsAgo(n, day) {
  const d = new Date();
  d.setDate(1);
  d.setHours(10, 0, 0, 0);
  d.setMonth(d.getMonth() - n);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d.toISOString();
}

function nowISO() {
  return new Date().toISOString();
}

function build() {
  const pwdHash = hashPassword(DEMO_PASSWORD);

  const employees = RAW_EMPLOYEES.map(
    ([id, no, name, dept, title, role, color, birthday, points, giveable]) => ({
      id,
      no,
      name,
      dept,
      title,
      role,
      avatarColor: color,
      birthday,
      points,
      giveable,
      passwordHash: pwdHash,
      joinedAt: monthsAgo(24 + (id.charCodeAt(3) % 12), 8),
      active: true,
    })
  );

  const recognitions = RAW_RECOGNITIONS.map(([fromId, toId, tag, message, points, ago, read], i) => ({
    id: `rc${String(i + 1).padStart(3, '0')}`,
    fromId,
    toId,
    tag,
    message,
    points,
    read,
    createdAt: monthsAgo(ago, ((i * 3) % 26) + 1),
  }));

  const rewards = RAW_REWARDS.map(([id, name, desc, cost, stock, emoji, category]) => ({
    id,
    name,
    desc,
    cost,
    stock,
    emoji,
    category,
    active: true,
  }));

  const month = new Date();
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const vote = {
    id: 'v1',
    title: `${month.getMonth() + 1} 月月度之星`,
    monthKey,
    active: true,
    deadline: new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59).toISOString(),
    candidates: RAW_VOTE_CANDIDATES.map(([employeeId, name, dept, reason], i) => ({
      id: `c${i + 1}`,
      employeeId,
      name,
      dept,
      reason,
    })),
    records: [], // { voterId, candidateId, at }
  };

  const redemptions = [
    {
      id: 'rd001',
      employeeId: 'e002',
      rewardId: 'r3',
      name: '京东购物卡 50 元',
      cost: 500,
      status: '已完成',
      createdAt: monthsAgo(2, 12),
    },
    {
      id: 'rd002',
      employeeId: 'e002',
      rewardId: 'r1',
      name: '星巴克电子饮品券',
      cost: 200,
      status: '已完成',
      createdAt: monthsAgo(1, 9),
    },
  ];

  const blessings = [
    { id: 'b001', fromId: 'e005', toId: 'e009', message: '生日快乐！愿今年签单顺利～', createdAt: nowISO() },
    { id: 'b002', fromId: 'e003', toId: 'e009', message: '祝凯哥生日快乐，bug 少一点！', createdAt: nowISO() },
  ];

  return {
    meta: { version: 1, seededAt: nowISO() },
    settings: SETTINGS,
    valueTags: VALUE_TAGS,
    employees,
    recognitions,
    rewards,
    redemptions,
    blessings,
    votes: [vote],
    seq: { recognition: recognitions.length + 1, redemption: redemptions.length + 1, blessing: blessings.length + 1 },
  };
}

module.exports = build;
module.exports.build = build;
