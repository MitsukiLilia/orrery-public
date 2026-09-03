# Orrery

> 捡到了故事主角的手机。
> A SillyTavern extension: you found the protagonist's phone.

Orrery 是一个 SillyTavern 第三方扩展。它读取你的酒馆对话正文,在一部「属于故事世界的手机」里生成**余波**——不是复述剧情,而是剧情在小世界里激起的水纹:

- 主角向朋友发的只言片语,和迟迟不回的「既読」
- 工作群里若无其事的八卦
- 匿名论坛上住民们自己的生活,以及评论区里悄悄路过的熟悉身影

世界随每层正文自发生长;你只能围观。这部手机上,你没有账号。

## 功能

- **消息**:主角的私聊与群聊。既読文化、叙事内时间(时间戳按正文推算,不锚现实时钟)、长对话自动摘要
- **论坛**:表板是所属共同体的実名掲示板——真名+所属,建前の場,成员可以招待共同体之外的ゲスト进来发言(叙事另一方要先开「允许登场」开关);裏サイト是成员们背着上面的人说真话的匿名场所,表板上的人在这里全是名無し——猜谁是谁是你的乐趣,主人只能潜水
- **门户**:主人所属组织的内网(お知らせ、申請・承認、通達)或所在地域的新闻与公示;板块由世界自己定,条目点开是一整张页面,旧申请的状态会在暗中推进
- **像真手机一样提示**:未读条数、新帖 NEW 角标、新回复计数;点进对话或帖子直接停在新内容那条分界线上
- **只读围观**:你能做的只有「刷新」「生成 N 条」与反悔删除。不能替任何人发言
- **与酒馆同步回滚**:重 roll、删楼层时,小世界自动倒带到那一刻;也可手动删除某条消息之后的内容、某个联系人或某个帖子
- **认主**:首次使用为手机认主(多人卡/世界观卡填你想围观的人物),一经设定不可更改
- **四主题**:海盐巧克力 / 墨白 / 月夜 / 魔導書,各配一套生成图标
- **语言**:默认中文,可切「日文+中文翻译」双语
- **生成通道**:默认跟随酒馆当前连接;可指定 Connection Profile 或独立 API(OpenAI 兼容)
- **自动刷新**(可选):酒馆出新楼层后自动生成一批余波

## 安装

SillyTavern → 扩展(Extensions)→ 安装扩展(Install extension),粘贴:

```
https://github.com/MitsukiLilia/orrery-public
```

## 快速开始

1. 启用扩展后,酒馆界面右侧会出现悬浮球(也可从魔杖菜单进入)
2. 打开任意角色卡的聊天,点开手机 → 首次会询问「这部手机属于谁?」——单人卡默认角色名;世界观卡请填你想围观的人物,**设定后不可更改**(想换人只能在设置里抹掉这部手机重来)
3. 进「消息」或「论坛」,点「刷新」——世界开始说话
4. 每个对话/帖子内可继续生成,底栏 `−/+` 决定这次要几条;长按(或右键)消息、联系人、楼层、帖子可删除

## 说明与注意

- 世界数据存储在浏览器本地(IndexedDB),按「角色卡+聊天」隔离;不随酒馆聊天文件迁移设备
- SillyTavern 的群聊(group chat)模式暂不支持
- 生成质量取决于你所配置的模型;提示词已内置视角纪律、联系人纪律与 OOC 约束(会读取角色卡与绑定世界书作为人设依据)
- 旧世界升级到実名制后,设置里的「论坛重来」可清空帖子与名册(保留所属与板块)重新开始

## 免责声明 / Disclaimer

本扩展不包含任何预设剧情、角色或文本内容;运行时的一切生成内容均由**用户自行配置的语言模型**产生,内容责任由使用者自负。开发者不对任何第三方模型的输出负责,亦不对使用本扩展产生的任何后果承担责任。本项目与 SillyTavern 官方及任何 IP 版权方无关联。软件按「现状」(AS IS)提供,不含任何明示或默示担保。

This extension ships no preset story, character, or text content; all runtime content is produced by the **user's own configured language model**, and responsibility for generated content rests with the user. The developer is not responsible for the output of any third-party model, nor for any consequences arising from the use of this extension. This project is not affiliated with SillyTavern or any IP rights holder. The software is provided "AS IS", without warranty of any kind.

## License

[PolyForm Noncommercial License 1.0.0](./LICENSE) — 禁止商业使用 / Commercial use is not permitted.
