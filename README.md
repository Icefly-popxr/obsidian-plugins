# 知识库工作台插件（knowledge-workbench）

> 草帽航海工作台 — Obsidian 原生插件。深色战情中心风格，海贼王主题，
> 顶部 hero 头图（海贼全员图 + MoltenMetal 熔岩动态），下方为工作台内容。

---

## 🚀 安装（clone 即用）

仓库已包含构建产物 `main.js`，**无需 npm install / build**，clone 下来就能直接启用。

```bash
cd "<你的 Vault>/.obsidian/plugins"
git clone git@github.com:Icefly-popxr/obsidian-plugins.git knowledge-workbench
```

> 目录名必须是 `knowledge-workbench`（要和 `manifest.json` 的 `id` 一致）。

然后 Obsidian → 设置 → 第三方插件 → 刷新列表 → 启用「知识库工作台」。

更新：`cd knowledge-workbench && git pull`，再 Ctrl+P → `Reload app without saving`。

需要改代码时再 `npm install` 装开发依赖。

---

## ✅ 目录说明（单目录，无中转）

本插件目录**就是 git 仓库**，源码和构建产物在同一处，Obsidian 直接加载这里，**无需复制**：

| 项 | 说明 |
|------|------|
| 仓库位置 | `<Vault>/.obsidian/plugins/knowledge-workbench/`（即本目录） |
| 源码 | `src/`（TypeScript）+ `styles.css` + `manifest.json`，**所有修改都在这** |
| 构建产物 | `main.js`（esbuild 输出，已提交入库，clone 即用） |
| 运行时数据 | `data.json`（打卡/习惯，已 gitignore，不入库） |

> 改动流程：改代码 → `npm run build` → Obsidian 里 Ctrl+P → "Reload app without saving"，即可看到改动。

---

## 📁 目录结构

```
<Vault>/.obsidian/plugins/knowledge-workbench/
├── manifest.json          # 插件元数据（id/name/version）
├── versions.json          # 版本兼容映射
├── package.json           # 依赖 + 构建脚本
├── tsconfig.json
├── esbuild.config.mjs     # 打包配置（产物 main.js）
├── styles.css             # 工作台全部样式（主题变量驱动，浅/深色自适应）
└── src/
    ├── main.ts                     # 插件入口：视图注册 / 命令 / 侧边栏图标 / 设置页
    ├── views/
    │   └── WorkbenchView.ts        # 主视图：顶部 hero + 聚合页 + 5 个详情子页
    ├── services/                   # 数据层（全库扫描，Obsidian Vault/MetadataCache API）
    │   ├── vaultService.ts         # 统计 / 最近更新 / 文件工具
    │   ├── kcService.ts            # KC-* 卡片聚合、领域分组、复习到期
    │   ├── projectService.ts       # 01 - Projects 项目进度解析
    │   ├── taskService.ts          # 全库任务语法扫描
    │   └── habitService.ts         # 习惯打卡（插件私有 data.json）
    └── backgrounds/
        ├── MoltenBackground.ts     # MoltenMetal 熔岩 WebGL 背景（原生 TS，无 React）
        └── crewBackdrop.ts         # 海贼王全员背景图（内联 SVG data URI）
```

---

## 🏗️ 架构说明

### 渲染流

```
打开工作台（锚图标 / 命令）
  → WorkbenchView.onOpen → reload() 扫描全库 → render()
  → ① buildHero()     顶部 hero 头图：全员图 + MoltenBackground(WebGL 熔岩)
  → ② renderHome()    聚合页：顶栏 / KPI 统计条 / 左"每日状态" / 右"内容工作流"
  → ③ 所有 .wb-panel/.wb-kpi-card 附加 Border Glow 光标交互（React Bits 移植）
```

### 关键设计

| 项 | 说明 |
|----|------|
| 主题适配 | 全部使用 CSS 变量（`--wb-*`），跟随 Obsidian 浅色/深色，无硬编码 |
| 数据来源 | 全库文件实时扫描（Vault + MetadataCache），点击条目直接打开对应笔记 |
| 复习 | frontmatter `review` 字段驱动（方案 A） |
| 打卡 | 混合式：习惯打卡存插件 `data.json`（settings.habits），英语/播客可扩展写入笔记 |
| hero 熔岩 | ogl 库（WebGL2），IntersectionObserver + visibilitychange 节能，卸载时释放上下文 |
| Border Glow | 纯 CSS `@property --angle` + mesh gradient，光标驱动边缘接近度 |

### 页面清单

- **home** 聚合页：KPI（6 卡）/ 今日待办 / 打卡热力图 / 最近更新 / 目标复盘 / Inbox / 复习到期 / 项目进度 / 采集汇总 / KC 卡片库 / canvas 图表
- **domains** 领域导航页
- **wiki** 概念库页（个人画像 / 迭代线 / 项目目标）
- **podcast** 播客 & 打卡页（点击打卡）
- **board** 卡片看板页（L1/L2/L3 分组）
- **config** 系统配置页（CLAUDE.md / 规则手册 / 快捷键）

---

## 🔧 改动流程（每个 agent 接手必读）

```
① 改源码（本目录内，无需复制）
   ├─ 样式类问题   → styles.css
   ├─ 功能/布局    → src/views/WorkbenchView.ts
   ├─ 数据逻辑     → src/services/*.ts
   ├─ 背景/熔岩    → src/backgrounds/*.ts
   └─ 设置/入口    → src/main.ts

② 构建（Obsidian 直接加载本目录，构建即生效）
   npm run build

③ 验证
   - tsc 无错误（npm run build 已含）
   - 重启 Obsidian 或 Ctrl+P → "Reload app without saving"
```

### 常用验证命令

| 命令 | 用途 |
|------|------|
| `npm run build` | tsc 类型检查 + esbuild 打包（产出 main.js） |
| `npm run dev` | 监听模式（不要在工作流中用，占资源） |
| 产物核对 | `grep -c "关键字符串" main.js` 确认打包内容 |

---

## 🛠️ 可调参数速查

| 想调什么 | 位置 | 默认值 |
|---------|------|--------|
| hero 高度 | `styles.css` `.wb-hero { height }` | `clamp(180px, 26vh, 300px)` |
| 全员图明暗/透明度 | `styles.css` `--wb-hero-crew-opacity/brightness/saturation` | 0.85 / 0.85 / 1.15 |
| 熔岩透明度 | `styles.css` `--wb-hero-molten-opacity` | 0.6 |
| 熔岩配色/强度 | `WorkbenchView.ts` `buildHero()` 的 params | 紫 #8b5cf6 / 红 #e11d2e / 金 #fbbf24 |
| 背景动效开关 | 设置页「背景动效」（showEffects） | 开 |
| 打卡/复习字段 | 设置页 | `review` |

---

## ⚠️ 已知事项

- 产物区文件勿手改；构建会覆盖
- 复习状态原引用旧库 `Straw Hat Pirates/`（不存在），已改为 frontmatter 驱动，无需旧文件
- `prefers-reduced-motion` 下所有动效自动关闭（含熔岩由 JS 侧处理）
- 插件 id：`knowledge-workbench`（community-plugins.json 已注册）
