# DMCL Launcher

> 一个为 Windows 打造的现代 Minecraft 启动器。深色界面、实例隔离、自动安装与一键启动。

当前仓库处于 **阶段一（可运行核心）**。这一阶段先打通「安装 → 配置 Java → 启动」的完整链路，并把界面骨架、实例与账户体系搭好；内容生态模块会按阶段继续接入。

![技术栈](https://img.shields.io/badge/Electron-45-2b2e35) ![React](https://img.shields.io/badge/React-19-2b2e35) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-2b2e35)

## 直接运行 Windows 客户端

无需安装 Node.js，也不需要打开浏览器。**推荐使用解压版**，这样默认游戏目录就在启动器旁边：

- **解压版（推荐）**：[release/DMCL-1.0.5-win-x64.zip](release/DMCL-1.0.5-win-x64.zip) — 解压后运行 `DMCL.exe`
- **单文件便携版**：[release/DMCL-Portable-1.0.5.exe](release/DMCL-Portable-1.0.5.exe) — 双击运行（自解压临时目录，游戏数据会回退到 `%APPDATA%\DMCL\minecraft`）
- 校验值见 [release/SHA256SUMS.txt](release/SHA256SUMS.txt)，使用说明见 [release/使用说明.txt](release/使用说明.txt)

> 默认游戏目录：**`DMCL.exe` 所在目录下的 `minecraft`**。实例数据位于 `minecraft\instances\<id>`。
> 配置文件仍保存在 `%APPDATA%\DMCL`。

> `localhost:5173` 只是 `npm run dev` 时 Vite 的开发服务器地址，不是启动器客户端入口。打包后的客户端直接以 `DMCL.exe` 运行。

## 已经完成

- **现代化启动器界面**：自绘窗口、首页、版本库、设置、账户与实例弹窗，完整的深色 / 亮色双主题与放大的舒适字号。
- **实例系统**：每个实例拥有独立的 `mods / resourcepacks / shaderpacks / saves` 目录，共享版本库与资源缓存。
- **原版安装**：读取 Mojang 版本清单，自动下载客户端、依赖库、natives、资源索引与数千个资源对象，支持 SHA1 校验、并发下载、取消与重试。
- **加载器安装**：在安装游戏时可选择原版、Fabric、Forge、NeoForge、OptiFine 或 Quilt；Fabric / Quilt 可一并安装 Fabric API / Quilted Fabric API。Forge、NeoForge 与 OptiFine 使用官方安装器并在任务面板中展示实时日志。
- **Java 运行时**：扫描常见 JDK/JRE 路径与 Minecraft 官方运行时；缺失时可按版本要求自动下载 Eclipse Temurin JRE。
- **游戏启动**：合并版本继承、计算 classpath、处理规则与参数模板、释放 natives、支持自定义内存/JVM 参数、实时日志与进程结束检测。
- **默认游戏体验**：首次启动自动写入简体中文语言，跳过辅助功能引导和多人游戏警告（可在设置中关闭）。
- **版本库**：已安装版本管理、远程版本搜索与筛选（正式版 / 预览版 / 愚人节特殊版本 / 全部）、安装/使用/删除。
- **账户**：离线账户、Microsoft 正版登录。优先使用浏览器回调登录，也保留设备代码方式；支持刷新令牌与系统加密存储。
- **设置中心**：亮色 / 暗色主题、游戏目录、Java 路径、最大内存、JVM 参数、下载源（官方 / BMCLAPI）、并发数、分辨率、启动后行为、文件校验等。
- **版本库**：已安装版本管理、远程版本搜索与筛选、安装/使用/删除。
- **动态与日志**：Mojang 启动器资讯、游戏实时输出、任务进度面板与桌面通知式 Toast。

## 下一阶段

- 模组管理 + Modrinth 搜索与依赖安装
- 资源包 / 光影包管理
- 存档信息解析、导入导出与一键备份
- 外置登录（authlib-injector）
- 可选安装器（NSIS）与自动更新
- 视觉回归截图与端到端测试

## 运行

要求：Windows 10/11、Node.js 22+。

```powershell
cd F:\amcluncher
npm install
npm run dev
```

生产构建与本地预览：

```powershell
npm run build
npm start
```

类型检查：

```powershell
npm run typecheck
```

## Microsoft 登录

Microsoft 要求每个第三方启动器使用自己的 Azure 应用 ID，DMCL 不会附带他人的凭据。首次使用前：

1. 打开 [Azure 应用注册](https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
2. 新建应用，账户类型选择「仅个人 Microsoft 账户」
3. 在「身份验证」中启用「允许公共客户端流」，并添加重定向 URI `http://localhost`
4. 复制「应用程序（客户端）ID」，在 账户中心 → Microsoft 中填入
5. 点击「打开浏览器并登录」，在网页中完成 Microsoft 登录后会自动返回应用

登录成功后可启动正版游戏；令牌保存在本机，并使用系统级加密。浏览器回调与设备代码两种流程均已实现。

## 数据位置

- 启动器配置、缓存与日志：`%APPDATA%\DMCL`
- 默认游戏目录：`DMCL.exe` 所在目录下的 `minecraft`
- 版本、资源与运行库：`<安装目录>\minecraft\{versions,libraries,assets,runtime}`
- 每个实例的游戏数据：`<安装目录>\minecraft\instances\<instance-id>`

> 从旧版升级时，配置文件会自动迁移到 `%APPDATA%\DMCL`，旧实例目录也会尽量迁移；如果之前已经下载过游戏版本，可在设置中把游戏目录指回旧路径继续使用。

开发调试时可以指定独立数据目录，避免污染真实启动器数据：

```powershell
npm run build
node_modules\electron\dist\electron.exe . --data-dir=F:\amcluncher\.dev-data
```

## 已经生成的客户端

`release/` 内是最终用户可以直接使用的文件：

| 文件 | 用途 |
| --- | --- |
| `DMCL-1.0.5-win-x64.zip` | 解压版，推荐；游戏目录位于解压目录旁 |
| `DMCL-Portable-1.0.5.exe` | 单文件便携版；自解压运行，游戏目录回退到 `%APPDATA%` |
| `DMCL-1.0.5-win-x64/` | 未压缩的客户端目录 |
| `SHA256SUMS.txt` | 完整性校验值 |

程序当前未使用商业代码签名证书，首次运行时 SmartScreen 可能提示“未知发布者”，选择“更多信息 → 仍要运行”即可。

重新生成客户端：

```powershell
npm run dist
```

该命令会重新构建，并生成便携单文件、ZIP、未压缩目录和 SHA256 校验文件。

## 技术方案

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 桌面容器 | Electron 45 | 使用 Windows 原生窗口能力与 Chromium 渲染 |
| 界面 | React 19 + TypeScript + 原生 CSS | 无 UI 框架依赖，自绘设计系统 |
| 构建 | electron-vite 6 + Vite 8 | 主进程 / preload / renderer 三端构建 |
| 主进程 | Node.js | 下载、哈希校验、进程管理、启动参数解析 |
| 配置存储 | JSON + 原子写入 | `%APPDATA%\DMCL\config.json` |
| 网络 | Node HTTPS | HTTP 重定向、断点临时文件、重试、镜像回退 |
| 压缩 | adm-zip | 运行库释放与后续资源导入 |
| 图标 | lucide-react | 统一线性图标系统 |

### 目录

```
src/
  main/                 Electron 主进程
    minecraft/          版本解析、安装、Java、启动
    http.ts             下载与镜像回退
    store.ts            配置与账户持久化
    ipc.ts              主进程 API
  preload/              安全桥接层
  renderer/             React 界面
    src/components/     通用 UI 与业务组件
    src/pages/          首页 / 版本库 / 设置
    src/state/          应用状态
  shared/               主进程与界面共享类型
```

## 安全说明

- Renderer 开启 `contextIsolation`、关闭 `nodeIntegration`，仅通过 preload 的受限 API 与主进程通信。
- 所有外部链接通过 `shell.openExternal` 打开，并限制为 HTTP(S)。
- 下载文件默认进行 SHA1 校验；版本删除采用路径边界校验。
- 当前账户令牌（Microsoft refresh token / Minecraft access token）使用 Electron `safeStorage`（Windows DPAPI）加密后写入独立文件，不会以明文出现在 `config.json` 中；外置登录接入时会复用同一套机制。

## 说明

阶段一优先确保核心链路和长期架构的可靠性。模组、资源包、存档等页面目前展示了完整的空状态与路线图，不会误报数据。后续阶段可以直接在这些页面上接入已经预留好的 IPC 接口。
