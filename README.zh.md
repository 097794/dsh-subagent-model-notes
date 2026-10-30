# dsh-subagent-model-notes

[![test](https://github.com/097794/dsh-subagent-model-notes/actions/workflows/test.yml/badge.svg)](https://github.com/097794/dsh-subagent-model-notes/actions/workflows/test.yml)

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（DSH）的子智能体委派加一层「按模型写说明」：在官方 **子智能体** 设置页旁新增一页，保存后的说明会进入 Agent 派生子智能体时的系统提示，让它按你的计划选模型。

```
设置 → 插件 → 内置插件设置 → 子智能体模型说明
```

## 为什么需要它

DSH 允许你为子智能体授权精确的 `provider/model` 路由（`subagent-model-selection-settings`），并通过 `list_subagent_models` 让 Agent 发现它们。但授权列表只有 `{ provider, model }`，没有任何按模型的描述；pi-ai 提供方的模型目录也不带 description。Agent 看得到名字和路由，却不知道「这个模型什么时候该用」。

本插件补上这一层：一个按模型编辑说明的页面，加上把说明（仅当前会话已授权的路由）注入系统提示的 Host 逻辑。

## 安装

需要带插件系统的 DSH 构建（如 DSH 0.2.1-rc.2 桌面版）。

1. 把本目录克隆/复制到一个固定的位置。
2. 作为 profile bundle 安装：**插件页 → 添加插件 → 本地目录**，或使用插件管理工具的 `install_bundle` 指向本目录的绝对路径。
3. 本地目录安装是**软链**，请保留该目录，不要移动或删除。

安装后会多出一行 `subagent-model-notes`（volatile 的 `notes` 配置）和编辑它的浏览器页面。

## 使用

1. 打开 **设置 → 插件 → 内置插件设置**，官方 **子智能体** 下方会出现 **子智能体模型说明**。
2. 给每个已授权的模型写一条说明，例如「便宜、响应快，适合样板化和低风险任务」。
3. 保存。Agent 下一步的系统提示就会带上这些说明；只有「已授权且有说明」的路由会出现。

页面上的标记含义：

| 标记 | 含义 |
| --- | --- |
| **已授权** | 该路由在当前子智能体允许列表里，说明会进入 Agent 上下文。 |
| **未授权给子智能体** | 说明会保存，但授权前不生效。 |
| **不在当前模型目录中** | 模型暂时不可用，说明仍会保留。 |

## 工作原理

**Host 半侧**（`lib/index.js` + `lib/prompt.js`）

- 监听 `system-prompt/assemble` 瀑布，对所有 Agent 生效。
- 读取官方 `@deepseek-ai/dsh-tool-subagent` 写入的会话投影 `subagentModelSelectionPolicy`；没有该策略说明当前会话未启用子智能体模型选择，插件不注入任何内容。
- 只保留出现在该策略里的路由对应的说明。
- 找到描述中包含 `list_subagent_models` 的工具，把 `subagent-model-notes` 段插在它的说明段之后；该段 `interpolate: false`，说明文字按字面量进入提示词（写入 `{{...}}` 也不会破坏提示词）。
- 纯逻辑在 `lib/prompt.js`，可以脱离 DSH 运行时直接测试。

**浏览器半侧**（`lib/client.js`）

- 在 `plugins.item` 槽里注册一个自定义页面（`order: 11`，紧挨官方子智能体页）。
- 通过 `ctx.configForms` 读写 volatile 的 `notes` 配置，与官方设置页使用同一套带 revision 栅栏的写入通道。
- 通过 `ctx.remote.session.modelCatalog()` 读取实时模型目录，通过 `subagent-model-selection-settings` 命名空间读取官方允许列表，因此页面展示的就是 Agent 实际可选项。

## 兼容性与风险

- 在 **DSH 0.2.1-rc.2**（Windows 桌面版）上开发并验证。依赖该版本中稳定的插件接口（`system-prompt/assemble`、`plugins.item`、volatile Config、`subagentModelSelectionPolicy`），但它们不是公开兼容承诺；升级后可能失效。这是社区插件。
- 说明是**指导，不是强制**：真正的允许列表仍由官方子智能体设置执行；插件不会调用模型，也不会改变路由。
- 若预设把 persona 声明为 `complete`（例如 `minimal`），waterfall 之后组合会被收窄为只有该 persona，说明段会被丢弃——这是 Harness 的既有约束，与其它基于 `system-prompt/assemble` 的插件相同。
- 只有启用了子智能体模型选择的会话会收到该段，且只影响保存之后组装的提示词。

## 开发

```sh
node --test test/prompt.test.mjs
```

`lib/prompt.js` 不引入任何 DSH 模块，路由过滤、格式化与插入位置都可以用普通 Node 测试。

## License

MIT，见 [LICENSE](LICENSE)。
