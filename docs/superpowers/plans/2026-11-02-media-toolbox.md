# 视听魔盒 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. The user delegated upgrade decisions and execution to the maintainer.

**Goal:** 将旧版视听魔盒更新为可以直接安装使用的四合一 MV3 工具箱。

**Architecture:** 原生 ES modules。播放器和壁纸在本地工具页运行，service worker 处理菜单与收藏的串行写入，纯函数模块负责边界校验。

**Tech Stack:** Chrome MV3 / HTML / CSS / JavaScript、Node test、Playwright、Python zipfile。

**Spec:** `docs/superpowers/specs/2026-11-02-media-toolbox-design.md`

## Global Constraints

- 保留 `stmh-chrome/` 安装目录；运行无 npm 或外部 API 依赖。
- 仅 storage、contextMenus、activeTab 权限；无常驻内容脚本。
- 本地文件不上传；重新打开工具需要重新选择文件，保留进度。
- 视频直链不等于网页解析；不作会员解锁承诺。

## Review Focus

- 带脚本协议、账号密码及控制字符的链接不得执行。
- 多页面收藏写入不能丢失修改；收藏上限有明确反馈。
- 切换音视频、重选文件及异步加载时不串用进度或泄漏 object URL。
- 全屏、窄屏、键盘及深浅主题不遮挡播放器和表单。
- 导出的壁纸 PNG 尺寸准确，无需远程资源。

### Task 1: 本地数据规则

**Files:** `stmh-chrome/js/core.mjs`, `tests/core.test.mjs`
**Interfaces:** normalizeUrl(value), addBookmark(items,input), fileKey(file), resumeTime(saved,duration), formatTime(seconds).

- [x] 写入并运行失败测试：拒绝非 HTTP(S)/带账号 URL；收藏去重及上限；不同文件的进度隔离；完成播放后从头开始。
- [x] 实现纯函数，运行 `node --test tests/core.test.mjs`，通过后提交。

### Task 2: MV3 与四个工具

**Files:** manifest、popup、toolbox、media、wallpaper、navigation 模块和样式。
**Interfaces:** worker messages bookmark:list/add/remove，工具页 `?tool=music|video|wallpaper|navigation`。

- [x] 写浏览器验收脚本并运行，确认当前 MV2 安装不满足验收。
- [x] 实现四个工具、弹窗和右键入口；删去失效 iframe、旧注入脚本和旧 CRX。
- [x] Chromium 真实测试本地 WAV/视频、进度恢复、直链错误提示、收藏存储、壁纸 PNG 导出。
- [x] 运行全部测试；检查真实截图后提交。

### Task 3: 交付

**Files:** scripts/package.py、package.json、README、隐私说明、CI、docs/images。

- [x] 测试包内资源校验与两次打包哈希一致。
- [x] 生成真实截图、更新 README、隐私与变更说明。
- [x] 完成独立代码审查与必要修复，运行完整 Node/浏览器测试。
- [x] 推送分支并创建 PR，生成可安装 ZIP。用户已委托实现升级；独立审查修复和云端检查通过后，将更新合并并发布可安装版本。
