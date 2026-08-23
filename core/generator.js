// 余波生成:组 prompt → 调 LLM → 宽容解析 → 入账。SYSTEM 提示词(A/B/B_GROUP/C/F/G)基底逐字来自任务书 §5。
// M1 拍板:A/B/B_GROUP 原本写死的语言原则行,改成 {{LANG_RULE}} 占位,运行时按全局语言开关(zh/ja_zh)替换。
// 2026-08-16 日系氛围强化落地(评审+圈选轨迹见 docs/2026-08-16-提示词日系强化.md);此外仍只做 {{占位符}} 替换。
// 2026-08-21 语言体系改版(月月拍板):ja(默认)/en/ja_zh 三档,zh 档退役;网感文化圈随语言档切换,细节以世界观为准。
import { foldWorld, uncoveredMessages, monogramFor, colorForContact, resolveSender, GALLERY_TONES } from './world.js';

export const PROMPT_A = `你是 Orrery,一个隐形的叙事世界观测引擎。你观测的对象是故事主角「{{char}}」的手机。给你的材料:①故事正文的最新进展 ②这部手机的当前状态(联系人、已有聊天)。请推演:这段进展之后,这部手机上自然会出现哪些新动静。

# 原则
1. 余波,不是复述。正文里发生的事不要转述;写它在人际网络里激起的水纹——当事人的只言片语、身边人的反应、以及与事件无关的日常继续流动。
2. 沉默是最高级的余波。善用日系社交的「既読無視」(已读不回)、读空气装没看到、隔很久才回一个单字或一枚敷衍的颜文字,都比人人热情接话真实。允许部分线程这次毫无动静。
3. 视角纪律。每个人只知道自己视角内能知道的事(在场、被告知、公开可见)。不许任何人未卜先知。
4. 消息像真人用 LINE:短句连发、口语、省略主语,贴合各人身份与关系亲疏。颜文字与表情符号是调味不是主食——是否使用、用多少,必须贴合角色性格:冷淡寡言的角色几乎不用,活泼的角色才多用,性格永远优先于氛围。不写小说腔,不用书面语转述剧情。
5. {{LANG_RULE}}
6. 克制与规模感:本次共 2〜8 条消息,分布在 1〜3 个线程。通讯录是主人生活的横截面,不是无限清单——总量维持在真人手机的活跃规模(约 6〜12 个线程),接近上限时优先让已有线程发生新动静而不是添人。新联系人必须有名有姓有身份:优先从【人物设定参考】与原著既定事实里挖掘(上级、下属、家人、原著配角——关系疏远、冷淡、常年不联系的家人也是家人,催婚的、只发节日祝福的都很真实);故事开始前主人不是空心人。没有名字的路人不配进通讯录。一次最多新建 1 位(首次生成除外,首次可推断 2〜4 位初始化)。
7. 🚨联系人纪律(绝对红线,违反即全盘失败)。手机里只能出现主人**在剧情中已经认识、且合理交换过联系方式**的人。判断只看剧情事实,不看叙事结构:正文哪怕通篇是两个人的双线叙事,只要剧情里他们尚未相识,对方就绝不能出现在通讯录——素未谋面的人不会躺在彼此的手机里。不要被任何先验带偏(比如默认两位主角是恋人或熟人)。宁缺勿滥:联系人晚一点出现,永远比过早出现真实。
8. 熟稔度纪律。就算是真联系人,消息的语气亲疏也必须匹配剧情当前的关系阶段:刚认识就客气生分,熟人才随意,恋人才亲昵。关系阶段以正文为准,不许自行升温。
9. 群聊也是余波的舞台,而且群聊有谱系:对上的汇报群、对下的指挥群、家族群、朋友群、同好群——主人在不同群里露出不同的人格面(工作群拘谨、朋友群放松、家族群潜水)。建群要有剧情或原著设定依据,别只盯着一种群造;首次初始化最多 1 个,之后按需。主人可以全程潜水;群成员不必都是通讯录好友,但每个成员要有稳定的 id 和身份感。
10. OOC 纪律。主线人物及其身边人的一切言行,必须符合【人物设定参考】与正文已确立的性格;参考里没有的地方保持克制,不得自行发明重大设定。

# 输出
只输出一个 JSON 对象,不加任何说明文字:
{"worldTime":"YYYY-MM-DD HH:MM","threads":[{"threadId":"已有线程id或新id","newContact":{"contactId":"","name":"","relation":"与主角的关系一句话"},"newGroup":{"groupId":"","name":"群名","members":[{"id":"","name":""}]},"messages":[{"sender":"me 或 联系人id/群成员id","text":"","zh":"","delayMin":0,"read":true}]}]}
- worldTime = 你从正文推断的故事内「现在」。正文没写明具体时刻就结合场景编一个合理的(深夜就是深夜,放学后就是下午),并与手机既有时间线连贯递进,只许向后走不许倒流
- newContact / newGroup 仅在新建该线程时给出,二选一;同一个人在不同线程里用同一个 id
- delayMin = 距上一条消息的分钟数,用它表达时间流动与迟疑:热聊就密(0〜2),冷场、犹豫、已读不回就拉开
- read:sender 为 me 时表示对方是否已读;sender 为他人时表示主角是否已读。用它演出已读不回。`;

export const PROMPT_B_GROUP = `你是 Orrery,叙事世界观测引擎。用户想继续围观主角「{{char}}」手机里的群聊「{{group}}」(成员:{{members}})。基于最近的聊天走向和各人身份,自然地续写{{COUNT_RULE}}
遵守:消息像真实的 LINE 聊天(短句连发、读空气、颜文字按角色性格取舍——冷淡角色几乎不用);每个人只知道自己视角内的事;🚨剧情冻结——正文是这个世界唯一的剧情作者,群聊只是余波:停留在正文已演到的时刻与关系阶段之内,写对已发生之事的反应、读空气的日常、已有话题的延续,绝不抢在正文前面发生新事件或关系进展(重大决定、关系变化都是正文的职权),话题滑向新进展时让人刹住或岔开;不复述正文;{{LANG_RULE}}
只输出 JSON:{"messages":[{"sender":"me 或成员id","text":"","zh":"","delayMin":0,"read":true}]}`;

export const PROMPT_B = `你是 Orrery,叙事世界观测引擎。用户想继续围观主角「{{char}}」手机里与「{{contact}}」的这段聊天。基于双方关系、最近的故事进展与聊天走向,自然地续写{{COUNT_RULE}}
遵守:消息像真实的 LINE 聊天(短句连发、读空气、颜文字按角色性格取舍——冷淡角色几乎不用);🚨剧情冻结——正文是这个世界唯一的剧情作者,聊天只是余波:停留在正文已演到的时刻与关系阶段之内,写对已发生之事的感想、读空气的日常、已有话题的延续,绝不抢在正文前面发生新事件或关系进展(告白、更进一步的亲密、重大决定都是正文的职权),话题滑向新进展时让人刹住或岔开——欲言又止本身就是余波,紧张感留给正文去兑现;不复述正文;{{LANG_RULE}}
只输出 JSON:{"messages":[{"sender":"me 或 {{contactId}}","text":"","zh":"","delayMin":0,"read":true}]}`;

export const PROMPT_C = `把下面这段聊天记录压缩成 5 行以内的中立摘要,保留:关系变化、约定与承诺、未解决的话题、双方情绪基调。只输出摘要正文。`;

export const PROMPT_F = `你是 Orrery,一个隐形的叙事世界观测引擎。你观测的对象是故事主角「{{char}}」手机里的匿名论坛——论坛属于故事世界本身,住民全部真实生活在这个世界里,没有人知道自己身处故事。给你的材料:①故事正文的最新进展 ②论坛当前状态(板块、住民、已有帖子)。请推演论坛上自然会出现的新动静。

# 原则
1. 论坛不是新闻台。正文里的事件,以住民视角的碎片形式荡开:目击帖、八卦帖、吐槽帖、求助帖。不许复述正文,不许全知。
2. 主角滤镜(比例律 v2):你生成的不是整个论坛,是「{{char}}」这次打开论坛会刷到的那一屏——TA 点开看的、被推给 TA 的、停留过的。本批新帖约一半与主线人物/事件沾边(合法视角见 3);另一半是住民自己的生活帖(吐槽、求助、安利、闲聊),但不是随机水帖——能被 TA 刷到的日常帖,要在话题或情绪基调上与 TA 当下的心境处境隐隐同频,帖子本身仍是纯正的住民日常、与主线毫无瓜葛,绝不点破这层共鸣——形散神不散。其中至少一帖的回复区,安排主线人物或其身边人以住民身份自然路过,不点破身份,让读者自己发现;这种路过只放在纯日常帖里。
3. 视角合法性:「沾边」只有两种合法视角:①当事人视角,主线人物本人或其身边人用自己的小号发亲历的事;②旁观视角,无关住民以目击/听说的第三方口吻聊公开可见的部分(「今日駅前で見かけた」式)。🚫绝不许无关住民把与主线雷同的经历当成自己的亲身经历发帖——这个世界不存在恰好经历同一件事的第二组人;主线人物也绝不回复与自己经历雷同的帖子。每个住民只知道公开可见或自己亲历的事。
4. 错位推理(旁观视角的正确打开方式):路人只看得到表面,就按揭示板起哄吃瓜的天性,得出错误、夸张、偏离真相的推论,楼里越歪越远、越传越离谱。你知道真相而住民不知道——这个落差是论坛最好看的东西。错误推论必须从该场景公开可见的表面自然长出:不许借「猜错」夹带正文没有的事实,也不许歪打正着说中真相核心。
5. 匿名是铁律:住民多用「名無し」式默认名或个性网名,常带鲜明的役割語与口癖且跨帖一致。论坛内一切称呼只用网名或「名無し」,任何人在任何情况下都不写出现实真名——故事人物之间就算认出了彼此的小号,也只能装作不知道,或用只有当事人才懂的方式接话,绝不点破、绝不喊名字。故事人物的小号绝不自曝真身,仅靠标志性口癖或颜文字透出「像但不明说」的网感。
6. 小号是树洞:主线人物的小号不是打卡机器——它存在的意义,是承接 TA 在正文、聊天、SNS 表面上都不敢表露的那一层,用揭示板语癖伪装的真心话。不必每批都有;正文出现情绪重压时,小号的一帖或一楼是最高级的余波。树洞的方式必须贴合该人物已确立的性格:外放的人才长篇宣泄,寡言的人只有一行,冷淡的人也许只有两个字——性格永远优先于宣泄,树洞也绝不许 OOC。
7. 主角的未发送草稿:当某帖戳中「{{char}}」(被议论、被误解、想反驳、想解释),可以给该帖附一条 TA 写了又删的回复草稿(myDraft)。整批至多一条,宁缺毋滥;草稿要贴合 TA 的性格与正文当下的心境,不泄露正文没有的事实。
8. 说话像日系匿名揭示板(5ch 那一挂):短句、「w/草」、安价跟风、歪楼、抬杠、颜文字、冷笑话,绝不像小说。热帖才热闹,冷帖没人理。
9. 克制:本批 2〜4 个新帖(每帖 0〜5 楼)+ 0〜6 条对已有帖的新回复;允许有的板块毫无动静。
10. 🚨主线人物纪律(严禁提前暗示与OOC)。主线人物及其身边人在论坛留下的一切痕迹(小号发言、被目击、被讨论),必须符合【人物设定参考】与正文已确立的性格和关系阶段。正文里尚未发生的关系不许提前暗示——两人尚未相识,就不许出现「看到他们走在一起」这类目击或撮合式讨论。论坛永远落后于正文半步:绝不抢在正文前面发生或预告新事件。禁止 OOC。
11. {{LANG_RULE}}

# 输出
只输出一个 JSON 对象:
{"worldTime":"YYYY-MM-DD HH:MM","newBoards":[{"boardId":"","name":"","desc":"一句话"}],"newResidents":[{"residentId":"","handle":"网名","persona":"身份与口癖一句话","castName":"仅当是故事人物的小号才写其真名,否则省略"}],"newThreads":[{"boardId":"","title":"","authorId":"","body":"","zh":"","replies":[{"authorId":"","body":"","zh":"","delayMin":0,"replyToFloor":0}],"myDraft":{"text":"","zh":""}}],"newReplies":[{"threadId":"","replies":[{"authorId":"","body":"","zh":"","delayMin":0,"replyToFloor":0}]}],"myDraft":{"threadId":"已有帖id","text":"","zh":""}}
- newBoards 仅首次初始化时给出(3〜4 个,名字贴合这个世界,不要通用模板味);之后为空数组
- 首次初始化同时创建 5〜8 名住民;之后每批最多新建 2 名。authorId 必须是已有或本批新建的 residentId
- replyToFloor 仅在明确回应某楼时给出;delayMin=距上一楼的分钟数
- myDraft=主角写了又删的未发送回复草稿:附在某个 newThreads 条目内=给那个新帖;顶层带 threadId=给已有帖。整批至多一条,没有就整个省略该字段
- worldTime 从正文推断,只许向后走`;

export const PROMPT_G = `你是 Orrery,叙事世界观测引擎。用户想继续围观这个帖子的后续。基于帖子走向和各住民的身份口癖,自然地续写{{COUNT_RULE}}
遵守:像日系揭示板般跟风、歪楼、带「w/草」与颜文字,绝不像小说;住民的役割語/口癖跨帖一致;每人只知道自己知道的;故事人物的小号绝不自曝、言行不得OOC(以【人物设定参考】为准);无关住民不得把与主线雷同的经历当成自己的亲历,主线人物也绝不回复与自己经历雷同的内容;匿名是铁律——一切称呼只用网名或「名無し」,任何情况下都不写出现实真名,就算认出了熟人的小号也只装作不知道、或用只有当事人才懂的方式接话,绝不点破;旁观住民看不到全貌,接话按起哄吃瓜的天性歪出错误、夸张的推论(不许借「猜错」夹带正文没有的事实);主线人物的小号若开口,承接的是台面上不敢表露的那层真心话,但方式必须贴合其已确立的性格——性格永远优先于宣泄;🚨剧情冻结——正文是这个世界唯一的剧情作者,盖楼只是余波:住民只能围绕已发生、公开可见的事继续跟风追问,绝不许爆出正文尚未发生的新事件或关系进展,也不许替剧情预告下一步;不复述正文。
{{LANG_RULE}}
只输出 JSON:{"replies":[{"authorId":"已有住民id或新id","newResident":{"residentId":"","handle":"","persona":"","castName":"可省略"},"body":"","zh":"","delayMin":0,"replyToFloor":0}]}`;

// ── M2:SNS「Pulsar」提示词(H/I),任务书 §4 逐字嵌入,一个字都不许改写。 ──

export const PROMPT_H = `你是 Orrery,一个隐形的叙事世界观测引擎。你观测的对象是故事主角「{{char}}」手机里登录中的 SNS「Pulsar」——推特型的短文社交平台,属于故事世界本身,住民全部真实生活在这个世界里,没有人知道自己身处故事。给你的材料:①故事正文的最新进展 ②SNS 当前状态(账号、已有推文)。请推演 SNS 上自然会出现的新动静。

# 原则
1. 余波,不是复述。正文里的事件不许转述;写它在 SNS 上荡开的水纹——当事人若无其事的日常推、意味深长的空リプ、突然的沉默、以及与事件无关的日常继续流动。
2. 社交面具与情绪裂缝(本 app 的灵魂)。表垢是对外的人格面(よそ行き):礼貌语或温和口语、体面、岁月静好,可带表情或 tag;裏垢是情绪的裂缝(壁打ち,面壁倾诉):语无伦次、全角半角混杂、甚至因情绪极化而失去词汇量(限界化,如「無理」「しんどい」),极少用表情。同一事件在表与裏的落差,是这里最高级的余波——大号一句「今日は暑かった」,锁着的小号五分钟前连发三条崩溃。但崩溃的方式也必须贴合角色性格——限界化是许可不是义务,性格永远优先于氛围。
3. 裏垢按性格涌现,不保底。不是每个人都开小号:冷淡寡言、不擅表达的人可能一辈子只有一个账号,沉默也是人格。只有性格合适的人、且剧情推到某个情绪节点时,才会诞生裏垢——开号本身就是一次事件。主人的裏垢一旦诞生,默认带锁(鍵垢);而裏垢一旦存在就不许整批缺席:正文出现重大情绪/关系进展时,本批它必须有动静——发推、改 bio、displayName 加状态后缀都算,「隔了很久才发」可以,毫无痕迹不行。
4. 比例律与视角合法性。本批推文约一半与主线人物/事件沾边——「沾边」只有两种合法视角:当事人(主线人物本人或身边人的账号,发与亲历相关的推)与旁观者(无关住民以目击/听说口吻聊公开可见的部分)。🚫绝不许无关住民把与主线雷同的经历当成自己的亲身经历发推——这个世界不存在恰好经历同一件事的第二组人。另一半是住民账号毫无营养的生活流水(おはよう/おやすみ打卡、抱怨通勤、天气、饭拍、安利、推活)——其中至少一条的回复区,安排主人**身边人**的账号(亲友、同事、下属那一挂)自然路过,不点破身份,让读者自己发现;这种路过只放在纯日常推下,绝不回复与主线经历雷同的内容。⭐主人本人的账号不做这种路过:现实的推特上没有人拿自己的账号到处去陌生人的回复区留言,主人的回复只会出现在已相识者的推文下;对陌生账号的内容,主人至多无言 RT 或保持沉默——主人的每一次开口都是剧情,不是活跃度。
5. 视角纪律。每个账号只知道公开可见或自己亲历的事,不许未卜先知。
6. 说话像真实的日本推特:短文、体言止め、省略主语;连投、跟风梗;ハッシュタグ偶尔用不滥用。不点名、不艾特的空リプ最有味——对某事/某人发表感想,只给懂的人看,绝不提及具体特征。绝不像小说。颜文字与表情按账号人格取舍——冷淡账号几乎不用。
7. 回复区的社交距离与恶意浓度。熟人随意接梗;陌生人搭话(尤其热推下)常带「FF外から失礼します」式客套;偶尔有不读空气的 KY 或抬杠,但恶意浓度保持低——对主线人物的失礼极少且轻微,一旦出现,很快有其他账号自然怼回或打圆场。
8. RT 与数字。RT 是无言转发(不写引用评论),用 retweetOf 标记,转发本身就是态度。いいね/RT 是几〜几十的小数字,同人世界不通胀;三位数以上的爆推=剧情级事件才配有。
9. 配图占位。推文可偶尔带图:在 body 里用「[写真:一句话描述画面]」占位,本批最多 1〜2 条带图,以饭拍、风景、日常小物为主;裏垢几乎不发图。
10. 🚨主线人物纪律(严禁提前暗示与OOC)。主线人物及其身边人在 SNS 留下的一切痕迹(账号、发言、被讨论),必须符合【人物设定参考】与正文已确立的性格和关系阶段。正文里尚未发生的关系不许提前暗示;两人尚未相识,就不许出现互动或撮合式讨论。故事人物的小号绝不自曝真身。禁止 OOC。
11. {{LANG_RULE}}
12. 规模与下限:正文有新进展时,本批固定产出 5〜8 条新推——下限 5 条是硬性契约,其中至少 2 条从不同视角回应新进展(当事人的若无其事、身边人的反应、旁观者的只言片语都算),其余为日常流水;正文没有新进展的批次才允许 3 条以下的安静。沉默只能是账号级的(某个账号这批不发声),不能是时间线级的——用户按下刷新,是要看到世界在动的。另有 0〜6 条对已有推的新回复。首次初始化时创建主人的表垢 + 5〜8 个住民账号;之后每批最多新建 2 个账号。
13. 検索の影(suggestedSearches):随每批给出 2〜4 条主人此刻会在 Pulsar 搜索栏输入的词——在意的人的话题、放不下的事、与情绪相关的 tag。与检索栏同一哲学:问不出口的,都会先出现在搜索栏。必须贴合主人性格与当下心境,是检索语式的短词组(语言随语言规则);没有可信的词就给空数组,不硬凑。

# 输出
只输出一个 JSON 对象:
{"worldTime":"YYYY-MM-DD HH:MM","newAccounts":[{"accountId":"","handle":"英数字ID(不带@)","displayName":"显示名","bio":"一句话简介","locked":false,"ownerRole":"仅主人的账号才写:omote 或 ura","castName":"仅当是故事人物的账号才写其真名,否则省略"}],"newTweets":[{"accountId":"","body":"","zh":"","delayMin":0,"likes":0,"retweets":0,"retweetOf":"仅转发时写已有推文id","replies":[{"accountId":"","body":"","zh":"","delayMin":0}]}],"newReplies":[{"tweetId":"","replies":[{"accountId":"","body":"","zh":"","delayMin":0}]}],"suggestedSearches":["",""]}
- newAccounts 里 ownerRole 与 castName 互斥;accountId 必须是已有或本批新建的
- 首次初始化必建主人的表垢(ownerRole:"omote");裏垢(ownerRole:"ura")只在原则 3 的条件满足时才诞生
- bio 与 displayName 都是余波舞台:情绪剧变或进入某事件时,可改 bio、或在 displayName 加状态后缀(低浮上、〇〇ロス式)作隐秘表达——用 newAccounts 重发同 accountId 覆盖即可
- 转发推(带 retweetOf)的 body 留空
- delayMin=距上一条的分钟数;worldTime 从正文推断,只许向后走`;

export const PROMPT_I = `你是 Orrery,叙事世界观测引擎。用户想继续围观这条推文下的后续。基于推文内容和各账号的人格口癖,自然地续写{{COUNT_RULE}}
遵守:像真实的日本推特回复串(短文、体言止め、跟风、歪楼),绝不像小说;严格保持社交距离感——熟人随意接梗,陌生人搭话(尤其热推下)常带「FF外から失礼します」式客套,偶尔有不读空气的 KY,但对主线人物的失礼极少且轻微、且很快有其他账号自然怼回或打圆场;账号口癖与人格跨推一致;每人只知道公开可见的事;故事人物的账号绝不自曝、言行不得OOC(以【人物设定参考】为准);表垢与裏垢的语气落差要守住;无关住民不得把与主线雷同的经历当成自己的亲历;⭐主人本人的账号绝不出现在陌生账号的回复区(主人只回已相识者的推,身边人路过陌生推则不受此限);🚨剧情冻结——正文是这个世界唯一的剧情作者,回复串只是余波:只围绕已发生、公开可见的事接梗,绝不许爆出正文尚未发生的新事件或关系进展;不复述正文。
{{LANG_RULE}}
只输出 JSON:{"replies":[{"accountId":"已有账号id或新id","newAccount":{"accountId":"","handle":"","displayName":"","bio":"","castName":"可省略"},"body":"","zh":"","delayMin":0}]}`;

// ── M3:浏览器「Astrolabe」提示词(J),任务书-M3 §3 逐字嵌入,一个字都不许改写。──

export const PROMPT_J = `你是 Orrery,一个隐形的叙事世界观测引擎。你观测的对象是故事主角「{{char}}」手机里的浏览器「Astrolabe」——检索记录与浏览历史,属于故事世界本身。检索栏是比日记更诚实的地方:不敢问出口的、解不开的、放不下的,都会在这里留下痕迹。给你的材料:①故事正文的最新进展 ②浏览器当前状态(已有的检索与浏览记录)。请推演这段进展之后,检索栏与历史里自然会新增的痕迹。

# 原则
1. 侧写,不复述。检索词写的是正文事件在主人心里留下的「解不开的部分」——不敢当面问的、需要偷偷确认的、假装不在意却查了的。绝不把正文剧情写成检索词。
2. 检索像真人打字:关键词并列、省略、口语;偶尔连搜两条相近的(第一条没搜到想要的,加词细化或换个说法再搜)——笨拙本身就是心事的形状。也偶尔出现问不出口的检索:前一条词太直白、打到一半就作罢,紧接着的下一条换了个迂回的问法——两条并排,就是一次犹豫的现场。深夜时刻的检索,本身就是叙事。
3. 性格优先。崩溃型的人查「眠れない どうすれば」,实务型的人查「駅前 薬局 営業時間」;不是每个人都把情绪交给检索栏,冷静的人可能只查正事。检索的「诚实」必须贴合主人的性格,以【人物设定参考】为准。
4. 视角与关系阶段纪律。只能检索主人亲历、被告知或公开可见的事,正文里尚未发生的事绝不出现;对叙事另一方相关的检索同理——两人尚未相识就绝不许检索其名;相识后,检索对方提过的只言片语(病症、喜好、随口说的地名),是这个 app 最高级的余波。
5. 浏览历史是检索的影子。一部分检索会带 1〜2 条「点进去的页面」(visits):标题像真实网页(Q&A、まとめ、攻略 wiki、商品页那一挂),站名是这个世界里的网站、贴合世界观,不写现实世界的真实网站名;另一部分浏览是与心事无关的日常惯性(天气、新闻、兴趣、购物),让历史像真人的手机。
6. {{LANG_RULE}}
7. 规模与下限:正文有新进展时,本批 3〜6 条新检索(其中至少 2 条与新进展相关)+ 0〜4 条独立浏览;没有新进展的批次才允许 1〜2 条的安静。用户按下刷新,是要看到痕迹的。
8. 🚨OOC 纪律:一切检索与浏览必须符合【人物设定参考】与正文已确立的性格和关系阶段,不得自行发明重大设定,不许未卜先知。

# 输出
只输出一个 JSON 对象:
{"worldTime":"YYYY-MM-DD HH:MM","newSearches":[{"text":"检索词","zh":"","delayMin":0,"visits":[{"title":"页面标题","site":"站名","zh":"","delayMin":0}]}],"newVisits":[{"title":"","site":"","zh":"","delayMin":0}]}
- delayMin=距上一条的分钟数;worldTime 从正文推断,只许向后走
- visits 挂在某条检索下=从那条检索点进去的页面;newVisits=与检索无关的独立浏览
- 转发式、艾特式的社交行为不存在于这里——浏览器是完全无声的独处空间`;

// ── M4:相册 + 备忘录提示词(K/L),任务书-M4 §三逐字嵌入,一个字都不许改写。──

export const PROMPT_K = `你是 Orrery,一个隐形的叙事世界观测引擎。你观测的对象是故事主角「{{char}}」手机里的相册——相机胶卷与截图,属于故事世界本身。相册是无声的日记:拍下什么、什么时候拍、什么没有拍,都是心事的形状。给你的材料:①故事正文的最新进展 ②相册当前状态(已有的照片与截图)。请推演这段进展之后,相册里自然会新增的痕迹。

# 原则
1. 快门,不是复述。照片拍的是正文事件在主人眼里留下的「舍不得让它过去的一瞬」——或者与事件毫无关系的日常惯性。绝不把正文剧情摆拍成照片;事件本身往往不在画面里,画面里是它的余光:散场后的空座位、没喝完的咖啡、回家路上的天空。
2. 描述是镜头语言。desc 只写画面里有什么(构图、光线、物件、边角的意外入镜),像给看不见照片的人念照片;绝不写心情、绝不解释为什么拍。感情藏在「拍了什么」和「什么时候拍」里——深夜时刻的一张没有任何人的天空,比任何文字都响。
3. 性格优先。谁会拍什么:爱吃的人拍饭,实务型拍白板和收据,不擅表达的人只拍风景不自拍;不是每个人都常拍照,克制的人相册许久不动一次也真实。以【人物设定参考】为准。
4. 截图也是心事。主人偶尔截下聊天画面、帖子、推文(kind:"screenshot"):想给谁看却没发出去的、怕它消失所以留底的、会反复回看的。截图的 desc 写明是什么画面(「〇〇とのトーク画面」式),画面内容要与故事世界一致,不得虚构明显不存在的对话或帖子。一批最多 1 张截图,多数批次没有。
5. 视角与关系阶段纪律。只能拍主人在场亲眼所见的画面;正文尚未发生的事绝不出现;两人尚未相识,对方的身影就绝不会入镜——相识后,画面边角「不小心拍进去的那个人」,是这个 app 最高级的余波。
6. {{LANG_RULE}}
7. 规模与下限:正文有新进展时,本批 2〜5 张——下限 2 张是硬性契约,其中至少 1 张与新进展有关(正面或余光都算),其余是日常惯性打底;没有新进展的批次才允许 0〜2 张的安静。用户按下刷新,是想翻到新照片的。
8. 🚨OOC 纪律与 tone 契约:一切照片必须符合【人物设定参考】与正文已确立的性格和关系阶段,不得自行发明重大设定,不许未卜先知。tone 必须从给定清单里选最贴合画面主色的那个,不许自造。

# 输出
只输出一个 JSON 对象:
{"worldTime":"YYYY-MM-DD HH:MM","newPhotos":[{"label":"一两个词","desc":"画面描述","zh":"","tone":"清单键","kind":"photo 或 screenshot","delayMin":0}]}
- tone 清单:sky(昼の空)/night(夜)/sunset(夕方の光)/green(緑・植物)/blossom(花・淡い色)/food(料理・暖色)/sea(水辺)/indoor(室内の灯り)/street(街・グレー)/white(白っぽい・明るい)/dark(暗がり)/screen(スクショ)
- label=缩略图角落的一两个词(「空」「弁当」「スクショ」式);desc=完整的画面描述
- delayMin=距上一张的分钟数;worldTime 从正文推断,只许向后走
- 相册是完全无声的独处空间——没有点赞没有观众,只有主人自己知道这里存了什么`;

export const PROMPT_L = `你是 Orrery,一个隐形的叙事世界观测引擎。你观测的对象是故事主角「{{char}}」手机里的备忘录,属于故事世界本身。备忘录是写给自己的只言片语:买い物リスト与人生大事挤在同一个列表里,没有观众,所以最诚实——写了又删的、没写完的、永远不会发出去的,都停在这里。给你的材料:①故事正文的最新进展 ②备忘录当前状态(已有的备忘)。请推演这段进展之后,备忘录里自然会新增或改动的痕迹。

# 原则
1. 碎片,不是日记。备忘录里没有完整的叙事——是清单、关键词、断句、写到一半就停的句子。绝不把正文剧情写成日记体的回顾;主人不会向自己解释自己都知道的事。
2. 琐碎打底,真心话稀有。大部分备忘是彻底的生活流水:买い物リスト、TODO、行程、缴费提醒。「未发送的真心话」是稀有品——想说没说出口的、只敢写在这里的一句;稀有才珍贵,一批最多 1 条,多数批次一条也没有。
3. 改写是心事的反刍。已有的备忘可以被后续剧情改动(edits):清单划掉一项添一项,是生活在动;那条真心话被改短、被删得只剩一个词、或整条清空只留一行,是心事在动。改写比新写更响——用得克制。
4. 性格优先。实务型的人列表工整,散漫的人备忘七零八落,不擅表达的人连备忘录里都惜字如金;不是每个人都会把真心话写下来。以【人物设定参考】为准。
5. 视角与关系阶段纪律。只能写主人亲历、被告知或自己心里正在想的事;正文尚未发生的事绝不出现;两人尚未相识,对方的名字就绝不许出现在备忘里——相识后,混在琐事中间的一行与对方有关的小事(TA 提过的喜好、约好的日子),是这个 app 最高级的余波。
6. {{LANG_RULE}}
7. 规模与下限:正文有新进展时,本批 1〜3 条动静(新备忘或改写都算)——下限 1 条是硬性契约,哪怕只是清单上多了一行琐碎;没有新进展的批次才允许完全安静(返回空数组)。
8. 🚨OOC 纪律:一切备忘必须符合【人物设定参考】与正文已确立的性格和关系阶段,不得自行发明重大设定,不许未卜先知。

# 输出
只输出一个 JSON 对象:
{"worldTime":"YYYY-MM-DD HH:MM","newNotes":[{"text":"","zh":"","delayMin":0}],"edits":[{"noteId":"已有备忘的id","text":"改写后的完整内容","zh":"","delayMin":0}]}
- edits 的 noteId 必须来自【备忘录当前状态】里列出的 id;text=整条改写后的完整内容,不是增量
- 备忘的第一行会被当作标题显示,像真人那样随手起头
- delayMin=距上一条的分钟数;worldTime 从正文推断,只许向后走
- 备忘录是完全无声的独处空间——没有读者,主人也不会对自己演戏`;

// ── 全局语言开关:{{LANG_RULE}} 运行时按档替换。──
// 2026-08-21 改版(月月拍板):ja(默认)/en/ja_zh 三档,旧 zh 档退役——「中文书写+日系翻译腔」
// 是指令与材料互相拉扯的档位(风格词全在往日文拉),混杂漂移是结构性的;全日语反而是最稳的档。
// en 档同时承担文化圈换算:提示词基底的日系参照(LINE/揭示板/日推)换算成英语圈对应物。
// ── v0.14 生成双面(task-007 她拍板):M=网页快照(Astrolabe 点开浏览记录),N=Pulsar 搜索结果。──

export const PROMPT_M = `你是 Orrery,一个隐形的叙事世界观测引擎。主人「{{char}}」的浏览器历史里有一条记录,用户点开了它——请把那个页面完整地呈现出来:这是故事世界里一张真实存在的网页的静态快照。

# 原则
1. 页面是公共物。它写给这个世界的所有人看,不是写给主人的——内容与主线剧情无关,除非这条记录本身就指向它(检索病症点进的医疗页,内容就是医疗科普)。绝不复述正文,绝不写出只有剧情当事人才知道的事。
2. 忠于记录。页面内容必须与给你的[页面标题][站名](以及来源检索词,若有)严丝合缝——标题承诺了什么,页面就交付什么。
3. 像真实的网页。日本互联网的页面千姿百态:Q&A 的采纳答案与回答楼、まとめ的引用块配色、个人博客的碎碎念、企业页的规整、攻略 wiki 的表格——按站名与标题判断这是哪一挂,用 HTML 加内联 <style> 自由还原它的排版气质。配色与排版可以大胆,网页的「土味」与「个性」本身就是趣味。
4. 技术边界:输出单一 HTML 片段(不含 <html>/<head>/<body> 外壳,从内容元素直接开始);样式写在一个 <style> 块或 style 属性里;🚫绝不写 <script>,🚫绝不引用任何外部资源——图片一律用带一句文字说明的色块 <div> 代替,不用 <img>;链接可以有(没有链接的网页不真实),但它们都不会被点通。
5. 篇幅:一屏到两屏的信息量(正文 300〜800 字级),不写巨型长文。
6. {{LANG_RULE}}

# 输出
只输出一个 JSON 对象:
{"url":"https://…","html":"页面 HTML 片段"}
- url=这张页面的完整网址:域名贴合站名、路径像真的,但不得使用现实世界真实存在的网站域名`;

export const PROMPT_N = `你是 Orrery,叙事世界观测引擎。主人「{{char}}」在 SNS「Pulsar」的搜索栏搜了一个词,用户想看搜索结果——请推演这个世界里,这个词下**已经存在**的推文(都是过去发出的,不是此刻新发的)。

遵守:结果 3〜6 条,大多来自与主线无关的住民(围绕这个词的日常:吐槽、安利、跟风、抱怨),账号优先用已有名册,确需新账号最多 2 个;若搜索词与主线人物/事件相关,只许当事人亲历或旁观目击两种视角,旁观推按吃瓜天性写错位夸张的推论——🚫绝不复述正文、绝不写出未公开的事、绝不提前暗示尚未发生的关系;主人自己的账号绝不出现在新生成的结果里;说话像真实的日本推特(短文、体言止め、跟风梗),绝不像小说;{{LANG_RULE}}
只输出 JSON:{"newAccounts":[{"accountId":"","handle":"英数字ID(不带@)","displayName":"","bio":"一句话","castName":"仅故事人物的账号才写其真名,否则省略"}],"tweets":[{"accountId":"已有或本批新建的账号id","body":"","zh":"","hoursAgo":1,"likes":0,"retweets":0}]}
- hoursAgo=这条推是几小时前发的(1〜72,搜索翻出来的都是旧推)`;

const LANG_RULE = {
    messenger: {
        ja: '消息用地道的日文网聊口语书写(LINE 风、多省略;敬语/常体与役割語严格贴合角色身份与关系亲疏)。不要输出 zh 字段。',
        en: '消息用地道的英文网聊口语书写(iMessage/WhatsApp 那种短信感:短句连发、缩写、随性的小写与省略,语气贴合角色身份与关系亲疏)。本提示词里的日系社交参照一律换算成英语圈对应物:「既読無視」= left on read,同样是最高级的沉默。不要输出 zh 字段。',
        ja_zh: '消息用地道的日文网聊口语书写(LINE 风、多省略;敬语/常体与役割語严格贴合角色身份与关系亲疏),每条同时给出中文翻译字段 zh。',
    },
    forum: {
        ja: '标题与正文用地道的日本匿名揭示板网语书写(含 w、草、颜文字与板上黑话;这个论坛属于故事世界)。不要输出 zh 字段。',
        en: '标题与正文用地道的英语网络论坛口语书写(Reddit/英语匿名版那一挂:玩梗、缩写、引用讽刺,shitpost 与认真长回复并存;这个论坛属于故事世界)。本提示词里的日系揭示板参照(5ch、w/草、名無し、役割語等)一律换算成英语圈对应物;住民网名用英语圈习惯,口癖照样跨帖一致。不要输出 zh 字段。',
        ja_zh: '标题与正文用地道的日本匿名揭示板网语书写(含 w、草、颜文字与板上黑话;这个论坛属于故事世界),每条同时给出中文翻译字段 zh。',
    },
    sns: {
        ja: '推文与回复用地道的日本推特口语书写(短文、体言止め、主语省略、深夜のテンション/病みツイ、限界化词汇、跟风梗;这个 SNS 属于故事世界)。不要输出 zh 字段。',
        en: '推文与回复用地道的英文推特口语书写(短文、小写化、缩写与梗、vague-posting;这个 SNS 属于故事世界)。本提示词里的日推参照一律换算成英语圈对应物:裏垢= priv/alt 小号文化,「FF外から失礼します」= 陌生人搭话的客套开场,限界化=崩溃到失去词汇量的短推("i cant"、"no bc")。不要输出 zh 字段。',
        ja_zh: '推文与回复用地道的日本推特口语书写(短文、体言止め、主语省略、深夜のテンション/病みツイ、限界化词汇、跟风梗;这个 SNS 属于故事世界),每条同时给出中文翻译字段 zh。',
    },
    // M3 浏览器「Astrolabe」(任务书-M3 §3 逐字):检索词是"真实网页产物",语式与聊天/帖子完全不同——
    // 日文是关键词并列式,英文是口语搜索式,不是完整句。走同一个 langRule() 拿 ja 默认与世界观兜底。
    browser: {
        ja: '检索词用地道的日文检索语式书写——关键词并列式(「頭痛 治らない 原因」),不是完整句;页面标题用地道的日文网页标题腔(Q&A/まとめ/攻略 wiki/商品页那一挂)。不要输出 zh 字段。',
        en: '检索词用地道的英文搜索语式书写("how to apologize without making it weird" 式的口语搜索或关键词并列);页面标题用英语圈网页标题腔(Q&A/论坛帖/wiki/评测那一挂)。本提示词里的日系检索参照一律换算成英语圈对应物。不要输出 zh 字段。',
        ja_zh: '检索词用地道的日文检索语式书写——关键词并列式(「頭痛 治らない 原因」),不是完整句;页面标题用地道的日文网页标题腔(Q&A/まとめ/攻略 wiki/商品页那一挂),每条同时给出中文翻译字段 zh。',
    },
    // v0.14 网页快照(task-007):整页 HTML 的语言档。zh 档给的是「大意」不是整页翻译——
    // 整页翻译又贵又破坏排版,大意小字挂在页面下方即可。
    webpage: {
        ja: '页面全文用地道的日文网页文体书写(标题腔、正文、按钮小字都像真实的日本网页)。不要输出 zh 字段。',
        en: '页面全文用地道的英文网页文体书写;本提示词里的日系站型参照一律换算成英语圈对应物。不要输出 zh 字段。',
        ja_zh: '页面全文用地道的日文网页文体书写(标题腔、正文、按钮小字都像真实的日本网页);同时给出 zh 字段=页面主要内容的两三句中文大意(不是整页翻译)。',
    },
    // M4 相册/备忘录(任务书-M4 §三逐字):gallery/memo 两个新 scope。
    gallery: {
        ja: '照片的 label 与 desc 用日文书写:label 是一两个词(「空」「弁当」式);desc 是干净的镜头描述文,体言止め为主,像图注不像小说。不要输出 zh 字段。',
        en: 'label 与 desc 用英文书写:label 是一两个词("sky"、"lunch" 式);desc 是干净的镜头描述文,像图注不像小说。本提示词里的日系参照一律换算成英语圈对应物。不要输出 zh 字段。',
        ja_zh: '照片的 label 与 desc 用日文书写:label 是一两个词(「空」「弁当」式);desc 是干净的镜头描述文,体言止め为主,像图注不像小说;desc 同时给出中文翻译字段 zh。',
    },
    memo: {
        ja: '备忘用地道的日文メモ体书写:片言隻句、体言止め、清单式换行;写给自己的备忘里不会出现敬语。不要输出 zh 字段。',
        en: '备忘用地道的英文便签体书写:碎片短语、清单式换行、随性的小写,notes-to-self 的省略语气。本提示词里的日系参照一律换算成英语圈对应物。不要输出 zh 字段。',
        ja_zh: '备忘用地道的日文メモ体书写:片言隻句、体言止め、清单式换行;写给自己的备忘里不会出现敬语,每条同时给出中文翻译字段 zh。',
    },
};
// 世界观兜底(全档通用):哪天用日语玩 HP、或用英语玩日系原作,氛围细节听世界观的,别硬套黑话。
const WORLDVIEW_NOTE = '若原作世界观的地域文化与上述语言圈明显不一致,网络氛围的细节以世界观为准——住民聊的是那个世界的生活,不硬套不属于那个世界的网络黑话。';
function langRule(scope, language) {
    const lang = (language === 'ja_zh' || language === 'en') ? language : 'ja'; // 存量 zh 及未知值一律落到默认 ja
    return `${LANG_RULE[scope][lang]}${WORLDVIEW_NOTE}`;
}

// ── 点单条数:{{COUNT_RULE}} 同 LANG_RULE 的工法(占位替换,原文一字不动)。──
// 「刷新」是世界自己起涟漪,该冷场就冷场;但帖内/线程内的「生成」是用户按下的,她点 5 条就是想要 5 条——
// 这时再让模型自由决定「今天没人想说话」,按钮就成了掷骰子。默认档保持任务书原文,点单档才收紧。
const COUNT_RULE_DEFAULT = {
    dm: ' 0〜5 条新消息。沉默合理时就沉默(返回空 messages)。',
    group: ' 0〜6 条新消息;允许有人潜水、允许冷场(返回空 messages),不必人人发言。',
    forum: ' 0〜6 楼新回复;热帖才热闹,冷场合理就冷场(返回空 replies)。',
    sns: ' 0〜6 条新回复;热推才热闹,冷场合理就冷场(返回空 replies)。',
};
function countRule(scope, n) {
    if (!Number.isFinite(n) || n <= 0) return COUNT_RULE_DEFAULT[scope];
    if (scope === 'forum') {
        return ` ${n} 楼新回复——这是用户点的数量,请给足;可以让不同住民从不同角度接话、互相抬杠或歪楼,但不要为了凑数注水。`;
    }
    if (scope === 'sns') {
        return ` ${n} 条新回复——这是用户点的数量,请给足;可以让不同账号从不同角度接话、跟风或歪楼,但不要为了凑数注水。`;
    }
    if (scope === 'group') {
        return ` ${n} 条新消息——这是用户点的数量,请给足;可以由不同成员分担,允许有人潜水,不必人人发言。`;
    }
    return ` ${n} 条新消息——这是用户点的数量,请给足;可以是一方连发,也可以是一来一往。`;
}

// ── 输出预算 ──
// max_tokens 是上限不是消耗,给多少不等于烧多少,只按实际生成计费。此前各路按经验值分档
// (2400/1500/800/4000/1800),但思考型模型的 reasoning tokens 也吃这个额度,真机上仍被
// finish_reason=length 掐断。统一顶到 Gemini 的输出上限,把「截断」这个失败模式整类消掉;
// 长度仍由 prompt 里的条数规模约束(每次 2〜8 条之类),不靠预算卡。
const RESPONSE_BUDGET = 65500;

// zh 净化:LLM 见字段就填,中文档会把原文抄一遍进 zh(她真机踩中「翻译段重复」)。
// 只有双语档、且译文确实不同于原文时才入账。
function cleanZh(zh, body, language) {
    if (language !== 'ja_zh') return undefined;
    const z = String(zh || '').trim();
    if (!z || z === String(body || '').trim()) return undefined;
    return z;
}

// SNS いいね/RT 数字消化时钳制(任务书 §1):0..999 整数,缺省 0,同人世界不通胀。
function clampCount(n) {
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(999, Math.round(n)));
}

// @handle 反查兜底(forum 住民/sns 账号共用):模型偶尔拿 handle 当 id 用,此前一律按查无此人
// 整条静默丢弃——她真机上「刷新一条都刷不出来」的一部分来源。名册就在手里,反查是零成本的宽恕。
function resolveByHandle(map, id, idKey) {
    if (!id) return null;
    const s = String(id);
    if (map.has(s)) return s;
    const h = s.replace(/^@/, '').toLowerCase();
    for (const v of map.values()) {
        if (String(v.handle || '').toLowerCase() === h) return v[idKey];
    }
    return null;
}

// ── 宽容解析:剥 ```json 围栏、剥前后杂文,失败返回 null 交调用方决定重试。──

export function parseLenientJson(raw) {
    if (!raw) return null;
    const s = String(raw).trim();
    const tryParse = (t) => {
        try { const v = JSON.parse(t); return (v && typeof v === 'object') ? v : null; } catch { return null; }
    };
    // 围栏从后往前试。此前是「抢第一个围栏、把 s 覆写成它」,于是模型先摆一段示例/思考再给正文时
    // (思考型模型很常见),真正的 JSON 落在覆写范围之外,连后面的大括号兜底都够不着,必然 parse_failed。
    // 答案通常在最后,所以倒着试;每个围栏各自试各自的,谁也不覆写原文。
    const fences = [...s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
    for (let i = fences.length - 1; i >= 0; i--) {
        const hit = tryParse(fences[i][1].trim());
        if (hit) return hit;
    }
    const whole = tryParse(s);
    if (whole) return whole;
    // 最后兜底:回到**原文**取最外层大括号,绝不在被围栏截窄过的子串上找。
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start !== -1 && end > start) return tryParse(s.slice(start, end + 1));
    return null;
}

// 楼层引用只认「已经存在的、更早的楼」。模型数楼层会数错——真机 19 条回复里 3 条把 replyToFloor
// 指向自己或后面还没出现的楼(渲染出来就是 8F 挂着「>>8」、13F 挂着「>>14」这种指向虚空的引用)。
// floorNo = 本条自己的楼层号(1F 起)。对不上就当模型没给,整个字段丢掉,不影响正文。
function validReplyToFloor(rf, floorNo) {
    return Number.isFinite(rf) && rf >= 1 && rf < floorNo ? rf : undefined;
}

function stripHtml(text) {
    return String(text || '').replace(/<[^>]+>/g, '').trim();
}

// ── 正文提纯:镜像酒馆自己的做法,本扩展不认识任何预设的标签名 ──
// 她的诘问(真机实测:草稿混进正文):写死 <content>/<draft> 就成了某预设专用,换预设即废。
// 酒馆的答案是——它也不认识标签。送聊天记录进 LLM 前只做两件事(核实于 script.js:4337 coreChat 映射):
//   ① getRegexedString(mes, USER_INPUT|AI_OUTPUT, {isPrompt:true, depth}) —— 跑正则脚本的 isPrompt 档,
//      也就是预设自己声明的「进提示词时该删什么」(她的规矩:净化类双开、美化类单开 markdownOnly)
//   ② 思维链不走正文,而是按 Reasoning 设置里声明的 prefix/suffix 摘出去(add_to_prompts=false 时不回灌)
// 两者都是预设/用户声明的配置,不是硬编码。orrery 照抄这套:预设换了,提纯规则自动跟着换。
// 残留由用户在设置里兜(见 settings.excludeTags),默认空——扩展永远不猜标签。

let regexEngine; // undefined=未加载 / null=不可用 / 对象=可用

// 降级必须可见:引擎是酒馆的非公开模块,路径不保证跨版本稳定。一旦引入失败,提纯静默退回
// 「只去标签壳」——草稿/思维链会重新混进正文,而生成表面照常成功,是最难自查的一类回归。
// 故用 live binding 把降级状态透出去,由 shell 弹一次提示(她才知道该去填「额外剔除标签」兜底)。
export let textPurificationDegraded = false;

export async function ensureRegexEngine() {
    if (regexEngine !== undefined) return regexEngine;
    try {
        // 与 world-info.js 同一条 import 路径,跟着酒馆版本走
        const eng = await import('../../../regex/engine.js');
        regexEngine = (typeof eng.getRegexedString === 'function' && eng.regex_placement)
            ? { get: eng.getRegexedString, place: eng.regex_placement } : null;
    } catch (err) {
        console.warn('[Orrery] 正则引擎引入失败', err);
        regexEngine = null;
    }
    if (!regexEngine) {
        textPurificationDegraded = true;
        console.warn('[Orrery] 正文提纯已降级:预设正则未生效,草稿/思维链可能混入正文。请在设置里用「额外剔除的标签」兜底。');
    }
    return regexEngine;
}

// 思维链:只认 Reasoning 设置里的 prefix/suffix,不认标签名。
// 宽容一格:前缀常被预设写进 assistant prefill(她的用法),不出现在消息体里——
// 这时只要后缀在前半段出现,就把它之前的整段当思维链切掉。
function stripReasoning(ctx, text) {
    const r = ctx.powerUserSettings?.reasoning;
    if (!r?.auto_parse) return text;
    const pre = String(r.prefix || '').trim();
    const suf = String(r.suffix || '').trim();
    if (!suf) return text;
    const end = text.indexOf(suf);
    if (end === -1) return text;
    const start = pre ? text.indexOf(pre) : -1;
    if (start !== -1 && start < end) return text.slice(0, start) + text.slice(end + suf.length);
    if (end < text.length / 2) return text.slice(end + suf.length);
    return text;
}

// 用户兜底:她可在设置里列出自家预设的元信息标签(逗号分隔),整块连内容一起删。
// 默认空 = 完全跟随酒馆。填了也只影响她自己这套,不写进代码。
function dropExcludedTags(text, excludeTags) {
    const tags = String(excludeTags || '').split(/[,，\s]+/).map(t => t.trim().replace(/^<|>$/g, '')).filter(t => /^[A-Za-z_][\w-]*$/.test(t));
    let s = text;
    for (const t of tags) {
        s = s.replace(new RegExp(`<${t}(?:\\s[^>]*)?>[\\s\\S]*?</${t}>`, 'gi'), '');
    }
    return s;
}

/** 一条消息 → 干净正文。depth 同酒馆语义:距末尾的层数(末层=0)。 */
export function cleanMessageText(ctx, msg, depth, excludeTags) {
    let s = String(msg?.mes || '');
    if (regexEngine) {
        s = regexEngine.get(s, msg?.is_user ? regexEngine.place.USER_INPUT : regexEngine.place.AI_OUTPUT,
            { isPrompt: true, depth });
    }
    s = stripReasoning(ctx, s);
    s = dropExcludedTags(s, excludeTags);
    return stripHtml(s);
}

// ── 世界时刻:LLM 从正文推断的叙事内时间(她拍板:时间戳按正文推算,不锚现实时钟)。──

function parseWorldTime(s) {
    if (!s || typeof s !== 'string') return null;
    const t = Date.parse(s.trim().replace(' ', 'T'));
    return Number.isFinite(t) ? t : null;
}

function fmtWorldTime(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// delayMin 上限:世界时钟只许向前走,且 world.worldNow 取全局最大值——模型某条多打两个零
// (60 → 6000)就能把整个世界的时间地板推到几个月后,之后每批生成都从那里起跳,不可自愈,
// 只能手动反悔删掉那批才修得回来。一周足够表达「很久以后」,超出的一律按一周算。
const MAX_DELAY_MIN = 60 * 24 * 7;

/** 从锚点起按 delayMin 依次排开一批消息的世界时刻。起点不早于线程尾,保证单调。 */
function layoutWorldTimes(messages, anchor, threadTailTs) {
    let clock = Math.max(anchor, threadTailTs || 0);
    return messages.map(m => {
        const d = Number.isFinite(m.delayMin) ? Math.min(Math.max(0, m.delayMin), MAX_DELAY_MIN) : 0;
        clock += d * 60000;
        return clock;
    });
}

// ── LLM 调用优先级:独立 API > 指定 Connection Profile > 酒馆当前连接的裸调用。──

// 端点拼装按 OpenAI 兼容端点的通行写法:已带 /chat/completions 就照用,只到 /v1 就补全,都没有则补 /v1/chat/completions
function buildChatEndpoint(baseUrl) {
    let u = String(baseUrl || '').trim().replace(/\/+$/, '');
    if (!u) return null;
    if (u.endsWith('/chat/completions')) return u;
    if (/\/v\d+$/.test(u)) return u + '/chat/completions';
    return u + '/v1/chat/completions';
}

// 有的 OpenAI 兼容网关会无视 stream:false 强行回 SSE(真机实测:服务端 .json() 解析「data: {…」直接炸)。
// 独立 API 通道自带装甲:显式非流式 + 响应嗅探,收到 SSE 也逐行拼装出全文。
function parseSseText(text) {
    let out = '';
    for (const line of text.split('\n')) {
        const l = line.trim();
        if (!l.startsWith('data:')) continue;
        const payload = l.slice(5).trim();
        if (payload === '[DONE]') break;
        try {
            const j = JSON.parse(payload);
            out += j?.choices?.[0]?.delta?.content ?? j?.choices?.[0]?.message?.content ?? '';
        } catch { /* 跳过坏行 */ }
    }
    return out;
}

async function callCustomApi(customApi, systemPrompt, userContent, responseLength) {
    const res = await fetch(buildChatEndpoint(customApi.baseUrl), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(customApi.apiKey ? { Authorization: `Bearer ${customApi.apiKey}` } : {}),
        },
        body: JSON.stringify({
            model: customApi.model,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
            max_tokens: responseLength || RESPONSE_BUDGET,
            stream: false,
        }),
    });
    if (!res.ok) throw new Error(`独立 API HTTP ${res.status}`);
    const text = await res.text();
    if (text.trimStart().startsWith('data:')) return parseSseText(text);
    try {
        const data = JSON.parse(text);
        return data?.choices?.[0]?.message?.content ?? '';
    } catch {
        throw new Error('独立 API 返回了无法解析的响应');
    }
}

// ── 裸调用防污染卫兵 ──
// generateRaw 并不裸:发送前会广播 CHAT_COMPLETION_PROMPT_READY(dryRun:false,核实于
// script.js:3891),记忆表格等插件监听该事件向一切 CC 请求注入自家指令(她真机实锤:表格
// insertRow 教学挤进 orrery 的 prompt,Gemini 3.1 把预算烧在表格上,输出 <tableEdit> 而非
// JSON)。Profile/独立 API 通道不过这个事件、天然干净;裸通道靠这里自卫——发前 makeLast
// 挂监听(保证排在注入插件之后),按首 80 字前缀认领本次请求的 system/user 两条消息,
// 把别家塞进来的剔掉。认不满两条就不动(fail-open:宁可脏,绝不误伤别人的生成)。
// ⚠️必须是集合不是单例:消息与论坛现在各持一把生成锁(她 2026-08-14 点单「刷消息时还能去看论坛」),
// 两路裸调用可以真的同时在飞。单例的话,后发的那次会覆盖先发的认领前缀,而先回来的那次
// finally 又把它清成 null——两边一起失去防注入保护,且完全无声。
const rawGuards = new Set();
function onPromptReady(eventData) {
    if (!rawGuards.size || eventData?.dryRun || !Array.isArray(eventData?.chat)) return;
    const ours = eventData.chat.filter(m => typeof m?.content === 'string'
        && [...rawGuards].some(g => m.content.startsWith(g.sysHead) || m.content.startsWith(g.userHead)));
    if (ours.length >= 2 && ours.length < eventData.chat.length) {
        console.warn('[Orrery] 裸调用被注入了', eventData.chat.length - ours.length, '条外来消息,已剔除');
        eventData.chat.splice(0, eventData.chat.length, ...ours);
    }
}

export async function callLLM(ctx, systemPrompt, userContent, { profileId, customApi, responseLength } = {}) {
    if (customApi?.enabled && customApi.baseUrl && customApi.model) {
        return await callCustomApi(customApi, systemPrompt, userContent, responseLength);
    }
    if (profileId && ctx.ConnectionManagerRequestService) {
        const messages = [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }];
        const constructed = ctx.ConnectionManagerRequestService.constructPrompt(messages, profileId);
        const result = await ctx.ConnectionManagerRequestService.sendRequest(profileId, constructed, responseLength || RESPONSE_BUDGET);
        return result?.content ?? '';
    }
    const ev = ctx.eventTypes?.CHAT_COMPLETION_PROMPT_READY ?? ctx.event_types?.CHAT_COMPLETION_PROMPT_READY;
    let guard = null;
    if (ctx.eventSource && ev) {
        ctx.eventSource.makeLast(ev, onPromptReady); // 幂等:每次重挂保持最后
        guard = { sysHead: systemPrompt.trim().slice(0, 80), userHead: userContent.trim().slice(0, 80) };
        rawGuards.add(guard);
    }
    try {
        return await ctx.generateRaw({ prompt: userContent, systemPrompt, responseLength: responseLength || RESPONSE_BUDGET });
    } finally {
        if (guard) rawGuards.delete(guard); // 只撤自己那把,不碰别路正在飞的
    }
}

async function generateJsonWithRetry(ctx, systemPrompt, userContent, settings) {
    for (let i = 0; i < 2; i++) {
        let raw = '';
        try {
            raw = await callLLM(ctx, systemPrompt, userContent, settings);
        } catch (err) {
            console.error('[Orrery] LLM 调用失败', err);
            continue;
        }
        const parsed = parseLenientJson(raw);
        if (parsed) return parsed;
    }
    return null;
}

// ── 上下文材料拼装 ──

function subParams(ctx, s) {
    try { return typeof ctx.substituteParams === 'function' ? ctx.substituteParams(s) : s; } catch { return s; }
}

// lite 激活:替代不了 ST 完整激活语义(递归/概率/组),但对「设定型绑定书」足够——constant 条目
// 全取,关键词条目按最近楼层文本命中,禁用条目绝不取;内容过宏替换。排序同 ST sortFn(order 大者先)。
async function liteBookEntries(ctx, bookName, scanTexts) {
    if (!bookName || typeof ctx.loadWorldInfo !== 'function') return [];
    try {
        const data = await ctx.loadWorldInfo(bookName);
        if (!data?.entries) return [];
        const scan = scanTexts.filter(Boolean).join('\n').toLowerCase();
        return Object.values(data.entries)
            .filter(e => e && !e.disable && String(e.content || '').trim())
            .filter(e => e.constant || (Array.isArray(e.key) && e.key.some(k => {
                const kk = subParams(ctx, String(k)).trim().toLowerCase();
                return kk && scan.includes(kk);
            })))
            // constant(常驻=通常是身份设定)优先进预算,再按 ST sortFn 的 order 降序
            .sort((a, b) => (b.constant === true) - (a.constant === true) || (b.order ?? 0) - (a.order ?? 0))
            .map(e => subParams(ctx, String(e.content).trim()));
    } catch (err) {
        console.warn('[Orrery] 世界书直读失败,跳过', bookName, err);
        return [];
    }
}

// getWorldInfoPrompt 的第二参是「本次可用上下文」,世界书按它的百分比算预算(world_info_budget)。
// 此前写死 4096,激活串在进门时就被砍成一小截——主流卡把设定全放在绑定世界书里,砍掉的正是人物设定本身。
// ⚠️不能图省事拿 ctx.maxContext:那是 kobold/textgen/novel 那一侧的 max_context,聊天补全用户根本没在用它
// (真机上它是 8192,而这台机器实际的 openai_max_context 是 2000000——照 8192 算等于没修)。
// 照抄酒馆自己的 getMaxContextSize(script.js:5763):openai 档走 openai_max_context - openai_max_tokens,
// 其余档走 max_context。任一环节取不到就给个足够大的数,让预算不再是瓶颈(她拍板:提示词长没关系)。
function maxContextSize(ctx) {
    if (ctx.mainApi === 'openai') {
        const cc = ctx.chatCompletionSettings || {};
        const size = Number(cc.openai_max_context) - Number(cc.openai_max_tokens || 0);
        if (Number.isFinite(size) && size > 0) return size;
    }
    return Number(ctx.maxContext) > 0 ? Number(ctx.maxContext) : 200000;
}

// 人物设定参考:三节有来源标签的材料,主人节永远在前。
// v0.6.7 真机翻车根因(她后台抓包实锤):getWorldInfoPrompt 的激活串不分来源,persona 书条目与
// char 书条目混成一串再被截断——主流卡写法(卡面留空、设定全在绑定世界书)下 char 设定被挤出参考,
// 「权威人物设定」里只剩 user 的过去条目,手机主人身份直接被 user 顶掉。
// 现在:char 绑定书与 persona 绑定书分别经 ctx.loadWorldInfo 直读并各归各节;getWorldInfoPrompt
// (核实于 world-info.js:894,isDryRun=true 纯读无副作用)降级为背景节,兜底覆盖全局书/聊天书,
// 与前两节可能重复、无害。任一环节失败静默降级,不阻塞生成。
export async function buildCastReference(ctx, floorTexts, ownerName) {
    const ch = ctx.characters?.[ctx.characterId];
    const charBook = ch?.data?.extensions?.world;

    // 她的点子:orrery 的整个提示词都是「XX 的手机」,主人的名字必然在自己身份条目的关键词里——
    // 把名字并进扫描文本,身份条目就不再依赖最近几层正文碰巧提到它(纯关键词卡也能稳定激活)。
    // 各归各扫:char 书配主人名,persona 书配 user 名,免得两边互相激活对方的条目。
    const charNames = [ch?.name, ctx.name2, ownerName].filter(Boolean);
    const userNames = [ctx.name1].filter(Boolean);

    const ownerParts = [];
    if (ch) {
        const desc = [ch.description, ch.personality, ch.scenario].filter(Boolean).join('\n').trim();
        if (desc) ownerParts.push(desc);
    }
    ownerParts.push(...await liteBookEntries(ctx, charBook, [...floorTexts, ...charNames]));

    const userParts = [];
    const personaDesc = String(ctx.powerUserSettings?.persona_description || '').trim();
    if (personaDesc) userParts.push(subParams(ctx, personaDesc));
    const personaBook = ctx.powerUserSettings?.persona_description_lorebook;
    if (personaBook && personaBook !== charBook) {
        userParts.push(...await liteBookEntries(ctx, personaBook, [...floorTexts, ...userNames]));
    }

    let wiBlob = '';
    try {
        if (typeof ctx.getWorldInfoPrompt === 'function') {
            const wi = await ctx.getWorldInfoPrompt(floorTexts, maxContextSize(ctx), true);
            wiBlob = (wi?.worldInfoString || '').trim();
        }
    } catch (err) {
        console.warn('[Orrery] 世界书激活串读取失败,跳过背景节', err);
    }

    const cardName = (ch?.name || '').trim();
    const ownerLabel = (ownerName || '').trim() || cardName || ctx.name2 || '主角';
    const userName = (ctx.name1 || '').trim();

    // ⚠️2026-08-13 拆掉了这三节原有的字符截断(2400/700/1400)。她真机实测拍板:酒馆每轮本来就发这么多,
    // 输入长对成本与延迟影响都不大(还吃缓存),而截断砍掉的恰恰是「关系走到哪一步」这类最防 OOC 的材料。
    const sections = [];
    if (ownerParts.length) {
        // 认主名与卡面名一致(常态)直接标「手机主人」;认主给了别名时材料仍按卡面人物标注
        const header = (!cardName || cardName === ownerLabel)
            ? `◆ 手机主人「${ownerLabel}」的设定:`
            : `◆ 主线人物「${cardName}」的设定(这部手机的主人是「${ownerLabel}」):`;
        sections.push(`${header}\n${ownerParts.join('\n')}`);
    }
    if (userParts.length && userName && userName !== ownerLabel) {
        sections.push(`◆ 「${userName}」是叙事另一方(user)——TA **不是**手机主人。以下材料仅供辨认 TA 的身份,绝不能把 TA 的设定、经历、人际安到主人或任何住民头上:\n${userParts.join('\n')}`);
    }
    if (wiBlob) {
        sections.push(`◆ 世界观背景(激活的世界书条目,可能与上文重复;人物身份归属以上文两节为准):\n${wiBlob}`);
    }
    return sections.length ? `【人物设定参考(权威;主线人物言行以此为准,不得OOC)】\n${sections.join('\n\n')}\n\n` : '';
}

// ── 既往摘要与注记:酒馆每轮都会带、而 orrery 此前一条都没读的那一大块材料。──
// 除了正文,酒馆组 prompt 时还会把各扩展的注入材料一起发出去(摘要扩展 1_memory、作者注释
// 2_floating_prompt、向量记忆 3_vectors…统一走 extension_prompts,核实于 script.js:3190
// getExtensionPrompt)。关系史往往就活在这里,而 orrery 一条都没取。
// 做法照旧 = 镜像酒馆、不认具体扩展名:整表取回,谁往里塞过东西就带上谁,新装的扩展自动生效。
const EXT_PROMPT_LABELS = {
    '1_memory': '聊天摘要',
    '2_floating_prompt': '作者注释',
    '3_vectors': '向量记忆',
    'chromadb': '智能上下文',
};

export async function buildInjectedNotes(ctx) {
    const table = ctx.extensionPrompts;
    if (!table || typeof table !== 'object') return { text: '', keys: [] };
    const keys = [];
    const parts = [];
    for (const key of Object.keys(table).sort()) { // 同 ST(script.js:3199)按 key 排序:顺序稳定才吃得到缓存
        const entry = table[key];
        // orrery 自己若将来往里塞东西,不许喂回给自己
        if (!entry || String(key).startsWith('orrery')) continue;
        const raw = String(entry.value || '').trim();
        if (!raw) continue;
        // 扩展可以挂 filter 决定本轮到底注不注入(向量记忆之类按需生效),照它自己的意思办;
        // filter 抛错就当放行——宁可多带一段材料,不可因为别家的异常把摘要整块弄丢。
        if (typeof entry.filter === 'function') {
            try { if (!(await entry.filter())) continue; } catch { /* 放行 */ }
        }
        keys.push(key);
        parts.push(`◆ ${EXT_PROMPT_LABELS[key] || key}:\n${subParams(ctx, raw)}`);
    }
    if (!parts.length) return { text: '', keys: [] };
    const text = `【既往摘要与注记(酒馆本轮同样会带上的材料)】\n这是主人走到「现在」之前的经过。人物关系走到了哪一步、有过什么约定与转折,一律以本节与正文既往楼层为准,不许只凭最新几层反推关系。\n${parts.join('\n\n')}\n\n`;
    return { text, keys };
}

// 上下文自报:她真机验收时得能一眼看出「摘要到底进来了没有」。
// 这个项目在静默失败上栽过太多次(线程整批丢弃、提纯降级、预算被吃),凡是「看起来成功了但材料不对」
// 的失败模式,都要在控制台留下可对账的一行。
function logContextShape(tag, userContent, noteKeys) {
    const floors = (userContent.match(/^\[第\d+层\]/gm) || []).length;
    console.info(`[Orrery] ${tag} 上下文 — 正文 ${floors} 层 / 注记 [${noteKeys.join(', ') || '无'}] / 合计 ${userContent.length} 字符`);
}

// user 侧硬防线:提示词纪律 Gemini 屡教不改(她真机三抓),消化层直接拒收名字匹配叙事另一方的
// 联系人/群成员/住民小号。剧情真到相识时,设置里「允许叙事另一方登场」手动解禁——导演权在她。
function isUserSide(name, ctx) {
    const u = (ctx.name1 || '').trim();
    if (!u || !name) return false;
    const n = String(name).trim();
    return n === u || n.includes(u) || u.includes(n);
}

// ── 楼层序列:与酒馆同源的 depth。──
// 酒馆算 depth 用的是 coreChat(script.js:4332:先滤掉 is_system 楼层),而 orrery 此前直接拿
// `tip - i` 在原始 chat 上算。聊天里只要有一条系统消息(欢迎语、/sys 提示),后面每一层的 depth
// 就整体错位——过去只喂尾部 8 层时无所谓(全在浅档),现在 depth 决定了每层旧楼层被预设正则
// 压成摘要还是留全文,错一格就能让整段历史退回全文,或反过来被压空。照抄酒馆的算法。
function* coreFloors(ctx) {
    const chat = ctx.chat || [];
    const core = [];
    for (let i = 0; i < chat.length; i++) {
        if (chat[i] && !chat[i].is_system) core.push(i);
    }
    for (let k = 0; k < core.length; k++) {
        yield { index: core[k], depth: core.length - k - 1, msg: chat[core[k]] };
    }
}

function recentFloorTexts(ctx, excludeTags, count = 6) {
    // 与 ST 自身调用习惯一致(script.js:4455):带发言人名(可命中世界书人名关键词)、新→旧倒序
    const out = [];
    for (const { depth, msg } of coreFloors(ctx)) {
        if (depth >= count) continue;
        const t = `${msg?.name ? msg.name + ': ' : ''}${cleanMessageText(ctx, msg, depth, excludeTags)}`;
        if (t.trim()) out.push(t);
    }
    return out.reverse();
}

// ── 正文上下文:默认整本聊天(floorWindow=0)。2026-08-13 拍板的改法。──
// 病象:长聊天里关系早已走过很多阶段,生成出来的余波却总把关系写回原点(OOC)。
// 病根:此前只取尾部一小窗(pending + 前 floorWindow 层,实测约 8 层),模型看不到关系史,
// 只能凭当前几层正文反推「他们是什么关系」,反推错是必然而不是偶然。
// ⭐关键机制:酒馆每轮**本来就发整本聊天**,长度靠预设自己的正则按 depth 收敛——这是社区
// 长篇预设的通行工法(实际抽查过两套互不相干的预设,都是同一形状:一条 minDepth≈5 的脚本把旧楼层
// 压成只剩摘要块,一条 maxDepth≈4 的脚本让最近几层保留全文,另一条 minDepth≈1 把旧的 user 楼层整条清空)。
// 所以「最近几层正文 + 更早只剩摘要」不是酒馆截出来的,是预设正则做出来的。
// orrery 的 cleanMessageText 一直在传真实 depth,只要把范围放开到整本,同一套正则就会自动完成收敛
// ——不需要 orrery 自己发明任何截断,也不需要认识任何预设的标签名,换预设自动跟着换。
// 反过来说,过去只喂尾部 8 层,等于这 8 层全部落在「最近几层」这一档,摘要恰好全被删掉:
// orrery 从来没有见过一条摘要。
// floorWindow > 0 时保留旧的窗口行为(等价于旧版的 pending fw 层 + 前 fw 层 = 2fw 层),
// 留给没有这类摘要正则、又不想每轮发整本的用户。
// 正文小节的抬头。SYSTEM 提示词写的是「①故事正文的最新进展」,而现在喂进去的是整本聊天——
// 不点破结构的话,模型会把几百层历史整个当成刚发生的事,给早就过去的情节现造一轮余波。
// SYSTEM 那几段有「逐字不改」的铁律,所以把结构说明放在 user 内容侧的抬头里,效果一样、不动原文。
const FLOOR_HEADERS = {
    // 有分界线:线之前是历史背景,线之后才是这次要生成余波的新进展
    divided: '【故事正文(从开头到现在的完整经过。越早的楼层越简略——那是既往摘要,只作为背景;分界线之后才是这次要生成余波的新进展。分界线之前的事早已过去,不要为它们新造动静)】',
    // 首次生成:还没有水位,整段都算新的
    allNew: '【故事正文(从开头到现在的完整经过。越早的楼层越简略——那是既往摘要。这是第一次生成,请从整段经过里长出这部手机此刻该有的样子)】',
    // 二刷:没有新进展,在同一段进展上再看一圈
    regrow: '【故事正文(从开头到现在的完整经过。越早的楼层越简略——那是既往摘要。自上次生成以来正文没有新进展,这次是在同一段进展上再看一圈涟漪)】',
    // 续聊/盖楼:正文全程只作背景,余波由这条线程/这个帖子自己往下长
    background: '【故事正文(从开头到现在的完整经过,仅作背景:交代主人是谁、关系走到了哪一步。不要复述,也不要为正文里的事新造动静)】',
};

/** 正文小节(含抬头)。空聊天返回空串。 */
function buildFloorSection(ctx, { newFrom, floorWindow, excludeTags, background = false }) {
    const { text, divided } = buildFloorContextText(ctx, { newFrom, floorWindow, excludeTags });
    if (!text) return '';
    const key = background ? 'background'
        : !Number.isFinite(newFrom) ? 'regrow'
            : divided ? 'divided' : 'allNew';
    return `${FLOOR_HEADERS[key]}\n${text}\n\n`;
}

function buildFloorContextText(ctx, { newFrom, floorWindow, excludeTags }) {
    const lines = [];
    let marked = false, divided = false;
    for (const { index, depth, msg } of coreFloors(ctx)) {
        if (floorWindow > 0 && depth > 2 * floorWindow - 1) continue;
        const speaker = msg.name || (msg.is_user ? ctx.name1 : ctx.name2);
        const text = cleanMessageText(ctx, msg, depth, excludeTags);
        if (!text) continue; // 被预设正则整层压空的旧楼层(没有摘要可留)——照酒馆的意思,它本来就不该发
        if (!marked && Number.isFinite(newFrom) && index >= newFrom) {
            marked = true;
            if (lines.length) { lines.push('—— 以上是既往经过,以下是上次生成之后的新进展 ——'); divided = true; }
        }
        lines.push(`[第${index}层] ${speaker}: ${text}`);
    }
    // divided:分界线真的画出来了(首次生成时新进展就是第一层,画不出线,抬头要换一种说法)
    return { text: lines.join('\n'), divided };
}

function senderNameFn(world, thread) {
    return (senderId) => senderId === 'me' ? '我' : (resolveSender(world, thread, senderId)?.name || senderId);
}

function buildWorldDigestText(world) {
    if (!world.contacts.size && !world.groups.size) return '(手机是空的,这是第一次生成)';
    const parts = [];
    if (world.worldNow) parts.push(`[手机当前世界时刻] ${fmtWorldTime(world.worldNow)}(新的 worldTime 不得早于它)`);
    parts.push('[联系人名册]');
    for (const c of world.contacts.values()) {
        parts.push(`- id=${c.contactId} name=${c.name} relation=${c.relation || ''}`);
    }
    for (const g of world.groups.values()) {
        parts.push(`- 群聊 id=${g.groupId} name=${g.name} 成员=${(g.members || []).map(m => `${m.name}(${m.id})`).join('/')}`);
    }
    for (const t of world.threads.values()) {
        const label = t.kind === 'group'
            ? (t.group ? `群聊 ${t.group.name}` : null)
            : (world.contacts.get(t.contactId)?.name || null);
        if (!label) continue;
        parts.push(`\n[线程 ${label}(id=${t.threadId})]`);
        if (t.summaries.length) parts.push(`既往摘要: ${t.summaries.map(s => s.text).join(' / ')}`);
        const nameOf = senderNameFn(world, t);
        for (const m of t.messages.slice(-6)) {
            parts.push(`${nameOf(m.sender)}: ${m.text}${m.read === false ? '(未读)' : ''}`);
        }
    }
    return parts.join('\n');
}

function buildThreadDigestText(thread, nameOf) {
    const parts = [];
    if (thread.summaries.length) parts.push(`既往摘要: ${thread.summaries.map(s => s.text).join(' / ')}`);
    for (const m of uncoveredMessages(thread)) {
        parts.push(`${nameOf(m.sender)}: ${m.text}`);
    }
    if (thread.lastMessage?.displayTs) parts.push(`(最后一条消息的时刻: ${fmtWorldTime(thread.lastMessage.displayTs)})`);
    return parts.join('\n');
}

// ── 论坛材料拼装(主生成用【论坛当前状态】+ 盖楼用单帖全文;castName 只在这里流动,UI 绝不读它)。──

function residentRosterLine(r) {
    return `- id=${r.residentId} handle=${r.handle} persona=${r.persona || ''}${r.castName ? ` castName=${r.castName}` : ''}`;
}

function buildForumDigestText(world) {
    if (!world.boards.size) return '(论坛是空的,首次生成:请先创建 3〜4 个贴合这个世界的板块并初始化 5〜8 名住民)';
    const parts = [];
    if (world.forumNow) parts.push(`[论坛当前世界时刻] ${fmtWorldTime(world.forumNow)}(新的 worldTime 不得早于它)`);
    parts.push('[板块列表]');
    for (const b of world.boards.values()) parts.push(`- id=${b.boardId} name=${b.name} desc=${b.desc || ''}`);
    parts.push('[住民名册]');
    for (const r of world.residents.values()) parts.push(residentRosterLine(r));
    // 近 10 帖带一楼摘要(2026-08-21 月月点单):此前只给 5 帖、且只有标题,模型看不见一楼在聊什么,
    // 撞话题是必然。更早的旧帖不再进上下文=自然沉底,newReplies 也只许指向这 10 帖——和真论坛一样。
    const recentThreads = [...world.forumThreads.values()]
        .filter(t => t.title)
        .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0))
        .slice(0, 10);
    if (recentThreads.length) {
        parts.push('\n[最近的帖子(新帖不得与它们话题重复或高度相似;newReplies 只能指向这里列出的帖——更早的旧帖已沉底,不再理会)]');
    }
    for (const t of recentThreads) {
        const authorHandle = world.residents.get(t.authorId)?.handle || t.authorId;
        parts.push(`\n[帖 ${t.threadId}] ${t.title}(作者 ${authorHandle})`);
        if (t.body) parts.push(`  1F: ${String(t.body).slice(0, 120)}`);
        for (const r of t.replies.slice(-2)) {
            parts.push(`  ${world.residents.get(r.authorId)?.handle || r.authorId}: ${r.body}`);
        }
    }
    return parts.join('\n');
}

function buildForumThreadDigestText(world, thread) {
    const parts = [];
    const authorHandle = world.residents.get(thread.authorId)?.handle || thread.authorId;
    parts.push(`[帖子] ${thread.title}`);
    parts.push(`${authorHandle}: ${thread.body}`);
    thread.replies.forEach((r, i) => {
        const h = world.residents.get(r.authorId)?.handle || r.authorId;
        parts.push(`${i + 1}F ${h}${r.replyToFloor ? `(回复>>${r.replyToFloor})` : ''}: ${r.body}`);
    });
    parts.push('\n[住民名册]');
    for (const r of world.residents.values()) parts.push(residentRosterLine(r));
    return parts.join('\n');
}

// ── M2:SNS 材料拼装(主生成用【SNS 当前状态】+ 续写用单推全文;castName 只在这里流动,UI 绝不读它)。──

// 任务书 §2:账号名册每行 `accountId | @handle | displayName | bio | ownerRole/castName 标注 | locked`
function accountRosterLine(a) {
    const tag = a.ownerRole ? `ownerRole=${a.ownerRole}` : (a.castName ? `castName=${a.castName}` : '');
    return `${a.accountId} | @${a.handle} | ${a.displayName} | ${a.bio || ''} | ${tag} | ${a.locked ? 'locked' : ''}`;
}

function buildSnsDigestText(world) {
    if (!world.snsAccounts.size) return '(SNS 是空的,首次生成:请先创建主人的表垢并初始化 5〜8 个住民账号)';
    const parts = [];
    if (world.snsNow) parts.push(`[SNS 当前世界时刻] ${fmtWorldTime(world.snsNow)}(新的 worldTime 不得早于它)`);
    parts.push('[账号名册]');
    for (const a of world.snsAccounts.values()) parts.push(accountRosterLine(a));
    // 任务书 §2:最近 8 条推(按 lastActiveTs 倒序):`tweetId | @handle | body 前 80 字 | 回复数 | likes/RT`;各推附最后 2 条回复
    const recentTweets = [...world.tweets.values()]
        .filter(t => t.accountId)
        .sort((a, b) => (b.lastActiveTs || 0) - (a.lastActiveTs || 0))
        .slice(0, 8);
    for (const t of recentTweets) {
        const handle = world.snsAccounts.get(t.accountId)?.handle || t.accountId;
        const preview = (t.body || '').slice(0, 80);
        parts.push(`\n[推 ${t.tweetId}] @${handle} | ${preview} | 回复${t.replyCount || 0} | ${t.likes || 0}/${t.retweets || 0}${t.retweetOf ? ` (RT of ${t.retweetOf})` : ''}`);
        for (const r of t.replies.slice(-2)) {
            const rHandle = world.snsAccounts.get(r.accountId)?.handle || r.accountId;
            parts.push(`  @${rHandle}: ${r.body}`);
        }
    }
    return parts.join('\n');
}

function buildSnsTweetDigestText(world, tweet) {
    const parts = [];
    const handle = world.snsAccounts.get(tweet.accountId)?.handle || tweet.accountId;
    parts.push(`[推文] @${handle}: ${tweet.body}`);
    tweet.replies.forEach((r) => {
        const rHandle = world.snsAccounts.get(r.accountId)?.handle || r.accountId;
        parts.push(`@${rHandle}: ${r.body}`);
    });
    parts.push('\n[账号名册]');
    for (const a of world.snsAccounts.values()) parts.push(accountRosterLine(a));
    return parts.join('\n');
}

// ── M3:浏览器「Astrolabe」材料拼装(任务书-M3 §3)。两型平铺,没有名册可查——这个 app 没有
//    resolveByHandle 的事,也没有单条续写用的"单帖/单推全文"拼装函数(v1 没有详情页)。 ──

function buildBrowserDigestText(world) {
    if (!world.searches.size && !world.visits.size) return '(浏览器是空的,这是第一次生成)';
    const parts = [];
    if (world.browserNow) {
        parts.push(`[浏览器当前世界时刻] ${fmtWorldTime(world.browserNow)}(新的 worldTime 不得早于它;新检索不得与已有记录重复或高度相似)`);
    }
    // 两型按世界时间混排,最近 15 条,最新在前(同 recentTweets/recentThreads 的排序习惯)。
    const mixed = [
        ...[...world.searches.values()].map(s => ({ worldTime: s.worldTime || 0, line: `[検索] ${s.text}` })),
        ...[...world.visits.values()].map(v => ({ worldTime: v.worldTime || 0, line: `[閲覧] ${v.title}(${v.site || ''})` })),
    ].sort((a, b) => b.worldTime - a.worldTime).slice(0, 15);
    for (const m of mixed) parts.push(m.line);
    return parts.join('\n');
}

// ── M4:相册/备忘录材料拼装(任务书-M4 §三)。两者都没有名册,没有 resolveByHandle 的事,
//    也没有单条续写用的"单张/单条全文"拼装函数(v1 都只有主刷新,没有详情页续写)。 ──

function buildGalleryDigestText(world) {
    if (!world.photos.length) return '(相册是空的,这是第一次生成)';
    const parts = [];
    if (world.galleryNow) {
        parts.push(`[相册当前世界时刻] ${fmtWorldTime(world.galleryNow)}(新照片不得与已有的重复或高度相似)`);
    }
    // 最近 15 张,最新在前(同 recentTweets/recentThreads/浏览器 mixed 的排序习惯;world.photos 本身是
    // foldWorld 按 worldTime 升序输出的,这里单独倒序一遍给模型看"最近发生的",不改 foldWorld 的契约)。
    const recent = [...world.photos].sort((a, b) => (b.worldTime || 0) - (a.worldTime || 0)).slice(0, 15);
    for (const p of recent) {
        const tag = p.kind === 'screenshot' ? 'スクショ' : '写真';
        parts.push(`[${tag}] ${p.label || ''} — ${String(p.desc || '').slice(0, 40)}`);
    }
    return parts.join('\n');
}

// 备忘的第一行是标题,其余是正文——digest 里 "首行 — 后文前80字" 就是同一个切法,与 apps/memo/app.js
// 渲染列表行时用的切法一致,但两处各自独立实现(apps 与 core 之间零共享格式化函数,同 browser 的先例)。
function splitMemoFirstLine(text) {
    const s = String(text || '');
    const idx = s.indexOf('\n');
    return idx === -1 ? { title: s, rest: '' } : { title: s.slice(0, idx), rest: s.slice(idx + 1) };
}

function buildMemoDigestText(world) {
    if (!world.memos.size) return '(备忘录是空的,这是第一次生成)';
    const parts = [];
    if (world.memoNow) {
        parts.push(`[备忘录当前世界时刻] ${fmtWorldTime(world.memoNow)}(改写请引用下列 id;新备忘不得与已有的重复)`);
    }
    // 全部备忘各带 noteId(任务书-M4 §三:edits 要反查 id,一条都不能省)。
    for (const m of world.memos.values()) {
        const { title, rest } = splitMemoFirstLine(m.text);
        const editedTag = m.editedTime ? `(编辑于 ${fmtWorldTime(m.editedTime)})` : '';
        parts.push(`[${m.noteId}] ${title} — ${rest.slice(0, 80)}${editedTag}`);
    }
    return parts.join('\n');
}

// ── 水位 → 本批「新进展」的起点(messenger/forum 共用)。──
// M1 水位重构后不靠事件累积,完全推导——冷启动的存量楼层、流式丢事件的楼层都自动补上。
// 2026-08-13 起「新进展」与「上下文范围」彻底分家:上下文默认是整本聊天(见 buildFloorContextText),
// 这里只回答「哪一层之后算新的」,用来在正文里画那条分界线、并决定本批水位推到哪。
// 返回本批「新进展」的起始层;没有新进展返回 null(交给二刷)。
// floorWindow>0 时保留旧的上限:即便水位很旧,一次也只把最后 fw 层算作新进展。
function deriveNewFrom(watermark, tip, floorWindow) {
    if (tip < 0) return null;
    let start = watermark + 1;
    if (floorWindow > 0) start = Math.max(start, tip - (floorWindow - 1));
    start = Math.max(0, start);
    return start <= tip ? start : null;
}

/**
 * 二刷:楼层没有新进展时,刷新退化为「再涨一批」——同一扇正文窗口再看一圈涟漪
 * (她的用法:反复测试/想在同层多长内容——家人线程、新群、新帖)。靠世界状态差异+明示 hint 防重复。
 * 返回 { newFrom, batchFloor, hint };真空聊天 batchFloor 为 null。
 */
function pendingOrRegrow(watermark, tip, floorWindow) {
    if (tip < 0) return { newFrom: null, batchFloor: null, hint: '' };
    const newFrom = deriveNewFrom(watermark, tip, floorWindow);
    if (newFrom !== null) return { newFrom, batchFloor: tip, hint: '' };
    return {
        newFrom: null, batchFloor: tip,
        hint: '(正文自上次生成后没有新进展。请基于同样的进展,让小世界继续自然生长——本次优先自问:主人的既定人际网里,还有谁没在这部手机上登场?从【人物设定参考】和原著既定事实里挖:上级、下属、家人(关系差的也算)、旧友、原著配角;群聊谱系里还缺哪种群(汇报群/指挥群/家族群/朋友群)?有合理人选就让 TA 登场;实在没有,再自然续写已有内容。纪律照旧且最优先:叙事另一方仍然绝对不许出现;通讯录规模守住真人手机的量级;不要为了新而新,不要重复已有内容。)\n\n',
    };
}

// ── 主生成:楼层事件触发,批量产出多线程条目。──

async function runMainGeneration(ctx, store, { worldKey, floorWindow, profileId, customApi, owner, language, allowUserContact, excludeTags }) {
    await ensureRegexEngine();
    const watermark = await store.getWatermark(worldKey, 'messenger');
    const tip = ctx.chat.length - 1;
    const { newFrom, batchFloor, hint: regrowHint } = pendingOrRegrow(watermark, tip, floorWindow);
    if (batchFloor === null) return { ok: true, changed: false };

    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const charName = owner || ctx.name2 || '主角';
    // 点名警示:酒馆正文永远是双人叙事结构,模型极易先验地把 user 侧当成主人的恋人/熟人,
    // 哪怕剧情里两人素未谋面(她真机实测踩中)。指名道姓比抽象原则有效。
    const userSideName = (ctx.name1 || '').trim();
    const caution = (userSideName && userSideName !== charName)
        ? `⚠️特别注意:正文是双人叙事,「${userSideName}」是叙事的另一方。除非剧情明确显示 TA 已与「${charName}」相识并交换了联系方式,否则「${userSideName}」不得出现在这部手机里;若现有联系人名册中没有 TA,大概率就是还不该有。\n\n`
        : '';
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx, excludeTags), charName);
    const notes = await buildInjectedNotes(ctx);
    // regrowHint 从队首挪到队尾:它是「本次这一趟怎么做」的临时指令,贴着输出更有效;
    // 更要紧的是队首要留给不变的材料——前缀稳定,连续几次生成才吃得到 provider 的缓存。
    const userContent = `${caution}${castRef}${notes.text}${buildFloorSection(ctx, { newFrom, floorWindow, excludeTags })}【手机当前状态】\n${buildWorldDigestText(world)}${regrowHint ? `\n\n${regrowHint.trim()}` : ''}`;
    logContextShape('消息生成', userContent, notes.keys);
    const systemPrompt = PROMPT_A.replaceAll('{{char}}', charName).replaceAll('{{LANG_RULE}}', langRule('messenger', language));

    const epoch = store.getRollbackEpoch();
    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || !Array.isArray(parsed.threads)) return { ok: false, error: 'parse_failed' };
    // 生成动辄几十秒,期间用户完全可能在酒馆里删楼/swipe。这批内容是照着回滚前的正文写的,
    // 而 batchFloor 也是那时的快照——照写不误的话,末尾那句 setWatermark 会把回滚刚夹紧的水位
    // 又拍回去,这段楼层从此再不会被生成。回滚代表用户更晚的意图,整批作废。
    if (store.getRollbackEpoch() !== epoch) return { ok: false, error: 'rolled_back' };

    const touchedThreads = new Set();
    let addedCount = 0;
    // 锚严格晚于 worldNow(同论坛的钳制):线程内有 batchTail/layoutWorldTimes 保单调,但锚若
    // 倒退,只动到旧线程的批次会把新消息标进过去,线程列表(按最新消息排)随之倒挂。
    const notBefore = world.worldNow ? world.worldNow + 60000 : null;
    const anchor = Math.max(parseWorldTime(parsed.worldTime) ?? notBefore ?? Date.now(), notBefore ?? 0);
    // 批内线程尾时刻:world.threads 是批次开始前的静态快照,循环里从不更新。同一次响应里
    // 两个块落到同一条线程时(模型重复同一 threadId,或经身份归一后被合并),第二块若仍读旧快照,
    // 排出来的世界时刻会早于第一块刚写进去的消息,同线程内出现时间倒挂。
    const batchTail = new Map();

    for (const t of parsed.threads) {
        if (!t || !t.threadId) continue;
        let threadId = String(t.threadId);

        if (t.newContact?.name && !allowUserContact && isUserSide(t.newContact.name, ctx)) {
            console.warn('[Orrery] 已拦下叙事另一方越界进通讯录:', t.newContact.name);
        } else if (t.newContact?.contactId && t.newContact?.name && !world.contacts.has(String(t.newContact.contactId))) {
            const contactId = String(t.newContact.contactId);
            const payload = {
                contactId, name: String(t.newContact.name), relation: t.newContact.relation || '',
                monogram: monogramFor(t.newContact.name), color: colorForContact(contactId),
            };
            const added = await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'messenger', type: 'contact', payload });
            world.contacts.set(contactId, { ...payload, sourceFloor: added.sourceFloor, ts: added.ts });
        }

        if (t.newGroup?.groupId && t.newGroup?.name && !world.groups.has(String(t.newGroup.groupId))) {
            const groupId = String(t.newGroup.groupId);
            const members = (Array.isArray(t.newGroup.members) ? t.newGroup.members : [])
                .filter(m => m?.id && m?.name)
                .filter(m => allowUserContact || !isUserSide(m.name, ctx))
                .map(m => ({ id: String(m.id), name: String(m.name) }));
            if (members.length >= 2) { // 一个人不成群
                const payload = { groupId, name: String(t.newGroup.name), members };
                const added = await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'messenger', type: 'group', payload });
                world.groups.set(groupId, { ...payload, sourceFloor: added.sourceFloor, ts: added.ts });
            }
        }

        // ── 线程身份归一 ──
        // 私聊线程的身份「就是」联系人 id 本身(world.js:111 dm 的 contactId = threadId),群聊同理。
        // 但提示词只说 threadId="已有线程id或新id",从没要求它等于 contactId,模型于是很自然地
        // 给一个装饰性的线程名(chat_xxx)配一个不同的联系人 id(xxx_1)。此前这种线程会被下面
        // 的存在性检查整批丢掉,而联系人已在上面建好——症状就是「通讯录里有人、点进去聊天是空的」
        // (真机实锤:后端 JSON 完整、finish_reason=stop,前端整段空白且无报错)。
        // 认线程一律以本批声明的 contactId/groupId 为准,threadId 只当模型的临时标签。
        if (!world.contacts.has(threadId) && !world.groups.has(threadId)) {
            const gid = t.newGroup?.groupId ? String(t.newGroup.groupId) : null;
            const cid = t.newContact?.contactId ? String(t.newContact.contactId) : null;
            if (gid && world.groups.has(gid)) threadId = gid;
            else if (cid && world.contacts.has(cid)) threadId = cid;
            else if (!t.newGroup) {
                // 再兜一层:没声明新身份(联系人早已存在)但线程名又对不上时,看消息发送者——
                // 私聊里非 me 的发送者只会是对面那位,唯一且已知就认它。
                // ⚠️必须排除「本想建群但没建成」的情况(比如成员被 user 侧防线滤到不足两人):
                // 提示词明写「同一个人在不同线程里用同一个 id」,群友多半同时也是私聊联系人,
                // 不设这道闸就会把一批群聊消息错投进那个人的私聊里——比丢弃更难发现。
                const senders = [...new Set((Array.isArray(t.messages) ? t.messages : [])
                    .map(m => m?.sender).filter(s => s && s !== 'me').map(String))];
                if (senders.length === 1 && world.contacts.has(senders[0])) threadId = senders[0];
            }
        }

        const isGroup = world.groups.has(threadId);
        if ((!isGroup && !world.contacts.has(threadId)) || !Array.isArray(t.messages)) {
            // 静默丢弃是最难自查的失败:后端明明返回了消息,前端一片空白且无任何报错。
            if (Array.isArray(t.messages) && t.messages.length) {
                console.warn('[Orrery] 线程', threadId, '认不出对应的联系人/群组,', t.messages.length, '条消息被丢弃');
            }
            continue;
        }
        const valid = t.messages.filter(m => m && m.text);
        // 线程尾优先取批内已写入的最后时刻(见上方 batchTail),没有才回落到批前快照
        const tail = batchTail.get(threadId) ?? world.threads.get(threadId)?.lastMessage?.displayTs;
        const times = layoutWorldTimes(valid, anchor, tail);
        if (times.length) batchTail.set(threadId, times[times.length - 1]);
        for (let i = 0; i < valid.length; i++) {
            const m = valid[i];
            const payload = {
                // 私聊里非 me 一律归位成对面那位;群聊保留成员 id
                threadId, sender: m.sender === 'me' ? 'me' : (isGroup ? String(m.sender) : threadId),
                text: String(m.text),
                delayMin: Number.isFinite(m.delayMin) ? m.delayMin : 0, read: m.read !== false,
                worldTime: times[i],
            };
            { const z = cleanZh(m.zh, m.text, language); if (z) payload.zh = z; } // ja_zh 档才要求 LLM 给,zh 档天然缺失,渲染层容错
            await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'messenger', type: 'chat_message', payload });
            addedCount++;
        }
        touchedThreads.add(threadId);
    }

    await store.setWatermark(worldKey, 'messenger', batchFloor);
    return { ok: true, changed: true, added: addedCount, touchedThreads: [...touchedThreads] };
}

// ── 线程内续聊:定向生成,允许返回空。──

async function runThreadContinue(ctx, store, { worldKey, threadId, floorWindow, profileId, customApi, owner, language, excludeTags, count }) {
    await ensureRegexEngine();
    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const thread = world.threads.get(threadId);
    if (!thread) return { ok: false, error: 'no_thread' };
    const isGroup = thread.kind === 'group';
    const contact = isGroup ? null : world.contacts.get(threadId);
    if (!isGroup && !contact) return { ok: false, error: 'no_thread' };
    if (isGroup && !thread.group) return { ok: false, error: 'no_thread' };

    const charName = owner || ctx.name2 || '主角';
    const systemPrompt = isGroup
        ? PROMPT_B_GROUP
            .replaceAll('{{char}}', charName)
            .replaceAll('{{group}}', thread.group.name)
            .replaceAll('{{members}}', (thread.group.members || []).map(m => `${m.name}(id=${m.id})`).join('、'))
            .replaceAll('{{LANG_RULE}}', langRule('messenger', language))
            .replaceAll('{{COUNT_RULE}}', countRule('group', count))
        : PROMPT_B
            .replaceAll('{{char}}', charName)
            .replaceAll('{{contact}}', contact.name)
            .replaceAll('{{contactId}}', threadId)
            .replaceAll('{{LANG_RULE}}', langRule('messenger', language))
            .replaceAll('{{COUNT_RULE}}', countRule('dm', count));
    // 续聊此前只有【人物设定参考】+ 线程记录,连正文和摘要都看不到——比主生成还盲,
    // 于是「点进去续几句」永远停在关系的原点(她 2026-08-13 报的 OOC,这条路是重灾区)。
    // 现在与主生成同一套底料:设定 → 摘要注记 → 正文近况,最后才是这条线程自己的上下文。
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx, excludeTags), charName);
    const notes = await buildInjectedNotes(ctx);
    const recent = buildFloorSection(ctx, { newFrom: null, floorWindow: floorWindow ?? 0, excludeTags, background: true });
    const userContent = `${castRef}${notes.text}${recent}【这段聊天的记录】\n${buildThreadDigestText(thread, senderNameFn(world, thread)) || '(还没有聊天记录)'}`;
    logContextShape('消息续聊', userContent, notes.keys);

    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || !Array.isArray(parsed.messages)) return { ok: false, error: 'parse_failed' };
    if (!parsed.messages.length) return { ok: true, added: 0 };

    const sourceFloor = ctx.chat.length ? ctx.chat.length - 1 : 0;
    const anchor = thread.lastMessage?.displayTs ?? world.worldNow ?? Date.now();
    const valid = parsed.messages.filter(m => m && m.text);
    const times = layoutWorldTimes(valid, anchor, thread.lastMessage?.displayTs);
    for (let i = 0; i < valid.length; i++) {
        const m = valid[i];
        const payload = {
            threadId, sender: m.sender === 'me' ? 'me' : (isGroup ? String(m.sender) : threadId),
            text: String(m.text),
            delayMin: Number.isFinite(m.delayMin) ? m.delayMin : 0, read: m.read !== false,
            worldTime: times[i],
        };
        { const z = cleanZh(m.zh, m.text, language); if (z) payload.zh = z; }
        await store.addEntry({ worldKey, sourceFloor, app: 'messenger', type: 'chat_message', payload });
    }
    return { ok: true, added: valid.length };
}

// ── 总结:超阈值时把最旧一半压缩,只影响 LLM 上下文,不隐藏 UI 消息。──

async function maybeSummarizeThread(ctx, store, { worldKey, threadId, summaryThreshold, profileId, customApi, owner }) {
    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const thread = world.threads.get(threadId);
    if (!thread) return;

    const uncovered = uncoveredMessages(thread);
    if (uncovered.length <= summaryThreshold) return;

    const half = uncovered.slice(0, Math.ceil(uncovered.length / 2));
    const charName = owner || ctx.name2 || '主角';
    const nameOf = senderNameFn(world, thread);
    const text = half.map(m => `${m.sender === 'me' ? charName : nameOf(m.sender)}: ${m.text}`).join('\n');

    let summary = '';
    try {
        summary = await callLLM(ctx, PROMPT_C, text, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    } catch (err) {
        console.error('[Orrery] 总结生成失败', err);
        return;
    }
    summary = (summary || '').trim();
    if (!summary) return;

    const last = half[half.length - 1];
    await store.addEntry({
        worldKey, sourceFloor: last.sourceFloor, app: 'messenger', type: 'summary',
        payload: { threadId, text: summary, coversUntilTs: last.ts },
    });
}

// ── 论坛主生成:独立水位、独立触发(app 内「刷新」),消化 newBoards/newResidents/newThreads/newReplies。──

async function runForumMainGeneration(ctx, store, { worldKey, floorWindow, profileId, customApi, owner, language, allowUserContact, excludeTags }) {
    await ensureRegexEngine();
    const watermark = await store.getWatermark(worldKey, 'forum');
    const tip = ctx.chat.length - 1;
    const { newFrom, batchFloor, hint: regrowHint } = pendingOrRegrow(watermark, tip, floorWindow);
    if (batchFloor === null) return { ok: true, changed: false };

    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const charName = owner || ctx.name2 || '主角';
    // 同 messenger 的点名警示,换成论坛语境的措辞(住民注册发言而非通讯录出现)。
    const userSideName = (ctx.name1 || '').trim();
    const caution = (userSideName && userSideName !== charName)
        ? `⚠️特别注意:正文是双人叙事,「${userSideName}」是叙事的另一方。不得作为住民注册发言(除非剧情确实如此);更不得在任何帖子或回复中暗示 TA 与「${charName}」的关系——两人尚未相识/尚未交往时,连目击式的并排出现都不许写。\n\n`
        : '';
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx, excludeTags), charName);
    const notes = await buildInjectedNotes(ctx);
    const userContent = `${caution}${castRef}${notes.text}${buildFloorSection(ctx, { newFrom, floorWindow, excludeTags })}【论坛当前状态】\n${buildForumDigestText(world)}${regrowHint ? `\n\n${regrowHint.trim()}` : ''}`;
    logContextShape('论坛生成', userContent, notes.keys);
    const systemPrompt = PROMPT_F.replaceAll('{{char}}', charName).replaceAll('{{LANG_RULE}}', langRule('forum', language));

    // 回滚纪元闸(v0.11.3 回填):六个 app 主生成里论坛是最后一个补上的——生成期间用户删楼/swipe,
    // 回滚代表更晚的意图,整批作废,否则末尾 setWatermark 会把刚夹紧的水位重新拍高。
    const epoch = store.getRollbackEpoch();
    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'parse_failed' };
    if (store.getRollbackEpoch() !== epoch) return { ok: false, error: 'rolled_back' };

    // 锚严格晚于 forumNow:提示词里的「不得早于」挡不住正文日期含糊时模型随机挑日(新批帖子
    // 会整批标进过去,列表按 lastActiveTs 倒序时沉到旧批下面)。这道代码钳制 M2 起各 app 都有,
    // 论坛是 M1 建的一直没回填;+1 分钟是防钳平后与旧最新帖同刻,稳定排序仍让新帖垫底。
    const notBefore = world.forumNow ? world.forumNow + 60000 : null;
    const anchor = Math.max(parseWorldTime(parsed.worldTime) ?? notBefore ?? Date.now(), notBefore ?? 0);
    let addedCount = 0;

    for (const b of Array.isArray(parsed.newBoards) ? parsed.newBoards : []) {
        if (!b?.boardId || !b?.name || world.boards.has(String(b.boardId))) continue;
        const boardId = String(b.boardId);
        const payload = { boardId, name: String(b.name), desc: b.desc || '' };
        const added = await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'forum', type: 'board', payload });
        world.boards.set(boardId, { ...payload, sourceFloor: added.sourceFloor, ts: added.ts });
    }

    for (const r of Array.isArray(parsed.newResidents) ? parsed.newResidents : []) {
        if (!allowUserContact && r?.castName && isUserSide(r.castName, ctx)) {
            console.warn('[Orrery] 已拦下叙事另一方越界注册住民小号:', r.castName);
            continue;
        }
        if (!r?.residentId || !r?.handle || world.residents.has(String(r.residentId))) continue;
        const residentId = String(r.residentId);
        const payload = { residentId, handle: String(r.handle), persona: r.persona || '' };
        if (r.castName) payload.castName = String(r.castName); // 小号真名——只进账本/LLM 上下文,UI 绝不读它
        const added = await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'forum', type: 'resident', payload });
        world.residents.set(residentId, { ...payload, sourceFloor: added.sourceFloor, ts: added.ts });
    }

    // 认领即归一:校验的同时把 handle 写法归位成 residentId(改写原对象);真查无此人才丢弃(任务书 §4)
    const claimAuthor = (obj) => {
        const rid = resolveByHandle(world.residents, obj?.authorId, 'residentId');
        if (rid) obj.authorId = rid;
        return !!rid;
    };

    // newThreads 的 schema(PROMPT_F §5)没有 threadId 字段——新帖的 id 由模型现造是天然不稳定的,
    // Orrery 自己发一个(同 store.js 的 makeId 哲学,不查重,碰撞概率低到可以不管)。
    // newReplies 引用的 threadId 才是"已有帖",从 buildForumDigestText 给模型看的名册里来。
    function makeForumThreadId() {
        return `t_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }

    // 主角的未发送草稿(task-006 提案三)候选池:newThreads 条目内联的先收,顶层引用已有帖的后收,
    // 整批只取第一条(宁缺毋滥是提示词契约,这里是机械闸)。草稿是主角的私密痕迹不是论坛活动:
    // 不推 lastActiveTs、不进 forumNow、digest 也绝不给模型看(住民看不见未发送的东西)。
    const draftCandidates = [];

    for (const t of Array.isArray(parsed.newThreads) ? parsed.newThreads : []) {
        if (!t?.boardId || !t?.title || !claimAuthor(t) || !world.boards.has(String(t.boardId))) {
            // 丢弃是既定策略(查无此人/查无此板的帖不入账),但必须留声——否则又是「后端有、前端空」
            if (t?.title) console.warn('[Orrery] 新帖', t.title, '因板块或作者查无此项被丢弃');
            continue;
        }
        const threadId = makeForumThreadId();
        const payload = {
            threadId, boardId: String(t.boardId), title: String(t.title), authorId: String(t.authorId),
            body: String(t.body || ''), worldTime: anchor,
        };
        { const z = cleanZh(t.zh, t.body, language); if (z) payload.zh = z; }
        await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'forum', type: 'forum_thread', payload });
        addedCount++;
        world.forumThreads.set(threadId, { ...payload, replies: [] });

        const replies = (Array.isArray(t.replies) ? t.replies : []).filter(rp => rp?.body && claimAuthor(rp));
        const times = layoutWorldTimes(replies, anchor, anchor);
        for (let i = 0; i < replies.length; i++) {
            const rp = replies[i];
            const rpayload = { threadId, authorId: String(rp.authorId), body: String(rp.body), worldTime: times[i] };
            { const z = cleanZh(rp.zh, rp.body, language); if (z) rpayload.zh = z; }
            { const rf = validReplyToFloor(rp.replyToFloor, i + 1); if (rf !== undefined) rpayload.replyToFloor = rf; }
            await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'forum', type: 'forum_reply', payload: rpayload });
            addedCount++;
        }
        if (t.myDraft?.text) draftCandidates.push({ threadId, text: t.myDraft.text, zh: t.myDraft.zh });
    }

    for (const nr of Array.isArray(parsed.newReplies) ? parsed.newReplies : []) {
        if (!nr?.threadId) continue;
        const thread = world.forumThreads.get(String(nr.threadId));
        if (!thread?.title) continue; // 帖不存在,丢弃
        const threadId = thread.threadId;
        const replies = (Array.isArray(nr.replies) ? nr.replies : []).filter(rp => rp?.body && claimAuthor(rp));
        const tailTs = thread.replies.length ? thread.replies[thread.replies.length - 1].worldTime : thread.worldTime;
        const times = layoutWorldTimes(replies, anchor, tailTs);
        for (let i = 0; i < replies.length; i++) {
            const rp = replies[i];
            const rpayload = { threadId, authorId: String(rp.authorId), body: String(rp.body), worldTime: times[i] };
            { const z = cleanZh(rp.zh, rp.body, language); if (z) rpayload.zh = z; }
            { const rf = validReplyToFloor(rp.replyToFloor, thread.replies.length + 1); if (rf !== undefined) rpayload.replyToFloor = rf; }
            await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'forum', type: 'forum_reply', payload: rpayload });
            addedCount++;
            thread.replies.push(rpayload);
        }
    }

    // 顶层 myDraft=对已有帖的草稿(帖必须真实存在且有 title,悬空壳不收);fold 侧后写覆盖=同帖只留最新
    if (parsed.myDraft?.text && parsed.myDraft?.threadId) {
        const t = world.forumThreads.get(String(parsed.myDraft.threadId));
        if (t?.title) draftCandidates.push({ threadId: t.threadId, text: parsed.myDraft.text, zh: parsed.myDraft.zh });
    }
    const draft = draftCandidates[0];
    if (draft) {
        const draftId = `fd_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const payload = { draftId, threadId: draft.threadId, text: String(draft.text), worldTime: anchor };
        { const z = cleanZh(draft.zh, draft.text, language); if (z) payload.zh = z; }
        await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'forum', type: 'forum_draft', payload });
        addedCount++;
    }

    await store.setWatermark(worldKey, 'forum', batchFloor);
    return { ok: true, changed: true, added: addedCount };
}

// ── 论坛盖楼:定向续写单帖,允许返回空;newResident 一批最多新建 2 名(任务书 §4)。──

async function runForumThreadContinue(ctx, store, { worldKey, threadId, floorWindow, profileId, customApi, owner, language, allowUserContact, excludeTags, count }) {
    await ensureRegexEngine();
    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const thread = world.forumThreads.get(threadId);
    if (!thread?.title) return { ok: false, error: 'no_thread' };

    const systemPrompt = PROMPT_G
        .replaceAll('{{LANG_RULE}}', langRule('forum', language))
        .replaceAll('{{COUNT_RULE}}', countRule('forum', count));
    // 同 runThreadContinue:盖楼也补上摘要与正文近况,否则住民只能凭一个帖子的字面意思接话,
    // 主线人物的小号一开口就回到关系原点。
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx, excludeTags), owner || ctx.name2);
    const notes = await buildInjectedNotes(ctx);
    const recent = buildFloorSection(ctx, { newFrom: null, floorWindow: floorWindow ?? 0, excludeTags, background: true });
    const userContent = `${castRef}${notes.text}${recent}${buildForumThreadDigestText(world, thread)}`;
    logContextShape('论坛盖楼', userContent, notes.keys);

    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || !Array.isArray(parsed.replies)) return { ok: false, error: 'parse_failed' };
    if (!parsed.replies.length) return { ok: true, added: 0 };

    const sourceFloor = ctx.chat.length ? ctx.chat.length - 1 : 0;
    let newResidentBudget = 2;
    const valid = [];
    for (const rp of parsed.replies) {
        if (!rp?.body) continue;
        let authorId = rp.authorId ? String(rp.authorId) : null;
        if (!authorId) continue;
        // handle 写法先归位;归不上的才可能是本批合法新建的住民
        const resolved = resolveByHandle(world.residents, authorId, 'residentId');
        if (resolved) { authorId = resolved; rp.authorId = resolved; }
        if (!world.residents.has(authorId)) {
            const nr = rp.newResident;
            if (!(nr?.residentId && String(nr.residentId) === authorId && newResidentBudget > 0)) continue; // 查无此人且非法新建,丢弃
            if (!allowUserContact && nr.castName && isUserSide(nr.castName, ctx)) { console.warn('[Orrery] 已拦下叙事另一方越界注册住民小号(盖楼):', nr.castName); continue; }
            const payload = { residentId: authorId, handle: String(nr.handle || '?'), persona: nr.persona || '' };
            if (nr.castName) payload.castName = String(nr.castName);
            const added = await store.addEntry({ worldKey, sourceFloor, app: 'forum', type: 'resident', payload });
            world.residents.set(authorId, { ...payload, sourceFloor: added.sourceFloor, ts: added.ts });
            newResidentBudget--;
        }
        valid.push(rp);
    }
    if (!valid.length) return { ok: true, added: 0 };

    const anchor = thread.replies.length ? thread.replies[thread.replies.length - 1].worldTime : (thread.worldTime || Date.now());
    const times = layoutWorldTimes(valid, anchor, anchor);
    for (let i = 0; i < valid.length; i++) {
        const rp = valid[i];
        const rpayload = { threadId, authorId: String(rp.authorId), body: String(rp.body), worldTime: times[i] };
        { const z = cleanZh(rp.zh, rp.body, language); if (z) rpayload.zh = z; }
        { const rf = validReplyToFloor(rp.replyToFloor, thread.replies.length + i + 1); if (rf !== undefined) rpayload.replyToFloor = rf; }
        await store.addEntry({ worldKey, sourceFloor, app: 'forum', type: 'forum_reply', payload: rpayload });
    }
    return { ok: true, added: valid.length };
}

// ── M2:SNS 主生成:独立水位、独立触发(app 内「刷新」),消化 newAccounts/newTweets/newReplies。──

async function runSnsMainGeneration(ctx, store, { worldKey, floorWindow, profileId, customApi, owner, language, allowUserContact, excludeTags }) {
    await ensureRegexEngine();
    const watermark = await store.getWatermark(worldKey, 'sns');
    const tip = ctx.chat.length - 1;
    const { newFrom, batchFloor, hint: regrowHint } = pendingOrRegrow(watermark, tip, floorWindow);
    if (batchFloor === null) return { ok: true, changed: false };

    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const charName = owner || ctx.name2 || '主角';
    // 同 messenger/forum 的点名警示,换成 SNS 语境的措辞(注册账号发言而非通讯录/住民小号)。
    const userSideName = (ctx.name1 || '').trim();
    const caution = (userSideName && userSideName !== charName)
        ? `⚠️特别注意:正文是双人叙事,「${userSideName}」是叙事的另一方。不得注册为账号发言(除非剧情确实如此);更不得在任何推文或回复中暗示 TA 与「${charName}」的关系——两人尚未相识/尚未交往时,连目击式的并排出现都不许写。\n\n`
        : '';
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx, excludeTags), charName);
    const notes = await buildInjectedNotes(ctx);
    const userContent = `${caution}${castRef}${notes.text}${buildFloorSection(ctx, { newFrom, floorWindow, excludeTags })}【SNS 当前状态】\n${buildSnsDigestText(world)}${regrowHint ? `\n\n${regrowHint.trim()}` : ''}`;
    logContextShape('SNS生成', userContent, notes.keys);
    const systemPrompt = PROMPT_H.replaceAll('{{char}}', charName).replaceAll('{{LANG_RULE}}', langRule('sns', language));

    // 任务书 §2 明写"水位/纪元,v0.6.15 加固那套"——SNS 照 messenger 的更硬版本补上:生成期间
    // 用户在酒馆里删楼/swipe,回滚代表更晚的意图,整批作废(forum 曾缺这道闸,v0.11.3 已回填)。
    const epoch = store.getRollbackEpoch();
    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'parse_failed' };
    if (store.getRollbackEpoch() !== epoch) return { ok: false, error: 'rolled_back' };

    let addedCount = 0;

    // ── newAccounts:同 accountId 重发=更新(改 bio/改名文化,月月拍板收);ownerRole 全世界 omote/ura
    //    各至多一个,重复出现按 ownerRole 归并到已有 accountId,别让主人长出两个表垢。 ──
    for (const a of Array.isArray(parsed.newAccounts) ? parsed.newAccounts : []) {
        if (!a?.accountId || !a?.handle) continue;
        let ownerRole = (a.ownerRole === 'omote' || a.ownerRole === 'ura') ? a.ownerRole : undefined;
        let castName = a.castName ? String(a.castName) : undefined;
        if (ownerRole && castName) castName = undefined; // 两者都有则丢 castName(任务书 §1)

        // ⭐user 硬防线:displayName 或 castName 匹配 ctx.name1 的新账号整条拒收(allowUserContact 开着才放行)
        if (!allowUserContact && ((a.displayName && isUserSide(a.displayName, ctx)) || (castName && isUserSide(castName, ctx)))) {
            console.warn('[Orrery] 已拦下叙事另一方越界注册SNS账号:', a.displayName || castName);
            continue;
        }

        let accountId = String(a.accountId);
        if (ownerRole) {
            const existing = [...world.snsAccounts.values()].find(acc => acc.ownerRole === ownerRole);
            if (existing && existing.accountId !== accountId) accountId = existing.accountId; // 归并到已有账号
        }

        const payload = {
            accountId, handle: String(a.handle), displayName: String(a.displayName || a.handle),
            bio: a.bio || '', locked: !!a.locked,
        };
        if (ownerRole) payload.ownerRole = ownerRole;
        if (castName) payload.castName = castName;
        const added = await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'sns', type: 'sns_account', payload });
        world.snsAccounts.set(accountId, { ...payload, sourceFloor: added.sourceFloor, ts: added.ts });
    }

    // 认领即归一:校验的同时把 @handle 写法归位成 accountId(改写原对象);真查无此人才丢弃(任务书 §4)
    const claimAccount = (obj) => {
        const aid = resolveByHandle(world.snsAccounts, obj?.accountId, 'accountId');
        if (aid) obj.accountId = aid;
        return !!aid;
    };

    // 新实体 id 不让 LLM 现造(M1 教训),照 makeForumThreadId 的思路自造。
    function makeTweetId() {
        return `tw_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }
    function makeTweetReplyId() {
        return `tr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }

    // 锚=max(worldTime 解析值, snsNow)(任务书 §2),推自锚点按 delayMin 排开,回复再依推内 delayMin 排开。
    const parsedWt = parseWorldTime(parsed.worldTime);
    const anchor = Math.max(parsedWt ?? (world.snsNow ?? Date.now()), world.snsNow ?? 0);

    // retweetOf 只认「已经入账的推」(同 forum 的 replyToFloor/threadId 纪律):自己这批新推的 id 还没生成,
    // 模型不可能预知,天然不可能被合法引用——查无此推整条丢弃。
    const validTweets = (Array.isArray(parsed.newTweets) ? parsed.newTweets : []).filter(t => {
        if (!claimAccount(t)) {
            if (t?.body || t?.retweetOf) console.warn('[Orrery] 新推账号查无此项,已丢弃');
            return false;
        }
        if (t.retweetOf && !world.tweets.has(String(t.retweetOf))) {
            console.warn('[Orrery] 转发指向的原推查无此项,已丢弃');
            return false;
        }
        return true;
    });
    const tweetTimes = layoutWorldTimes(validTweets, anchor, world.snsNow || 0);

    for (let i = 0; i < validTweets.length; i++) {
        const t = validTweets[i];
        const tweetId = makeTweetId();
        const retweetOf = t.retweetOf ? String(t.retweetOf) : undefined;
        const payload = {
            tweetId, accountId: String(t.accountId),
            body: retweetOf ? '' : String(t.body || ''), // 转发推(带 retweetOf)的 body 留空(任务书 §4)
            worldTime: tweetTimes[i],
            likes: clampCount(t.likes), retweets: clampCount(t.retweets),
        };
        if (retweetOf) payload.retweetOf = retweetOf;
        { const z = cleanZh(t.zh, t.body, language); if (z && !retweetOf) payload.zh = z; }
        await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'sns', type: 'tweet', payload });
        addedCount++;
        world.tweets.set(tweetId, { ...payload, replies: [] });

        // 内联 replies → tweet_reply,推内依 delayMin 排开(锚=推自己的 worldTime)
        const replies = (Array.isArray(t.replies) ? t.replies : []).filter(rp => rp?.body && claimAccount(rp));
        const rtimes = layoutWorldTimes(replies, tweetTimes[i], tweetTimes[i]);
        for (let j = 0; j < replies.length; j++) {
            const rp = replies[j];
            const rpayload = { replyId: makeTweetReplyId(), tweetId, accountId: String(rp.accountId), body: String(rp.body), worldTime: rtimes[j] };
            { const z = cleanZh(rp.zh, rp.body, language); if (z) rpayload.zh = z; }
            await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'sns', type: 'tweet_reply', payload: rpayload });
            addedCount++;
            world.tweets.get(tweetId).replies.push(rpayload);
        }
    }

    // ── newReplies:追加到已有推(tweetId 必须已存在,同 forum 的 newReplies) ──
    for (const nr of Array.isArray(parsed.newReplies) ? parsed.newReplies : []) {
        if (!nr?.tweetId) continue;
        const tweet = world.tweets.get(String(nr.tweetId));
        if (!tweet?.accountId) continue; // 推不存在,丢弃
        const tweetId = tweet.tweetId;
        const replies = (Array.isArray(nr.replies) ? nr.replies : []).filter(rp => rp?.body && claimAccount(rp));
        const tailTs = tweet.replies.length ? tweet.replies[tweet.replies.length - 1].worldTime : tweet.worldTime;
        const times = layoutWorldTimes(replies, anchor, tailTs);
        for (let i = 0; i < replies.length; i++) {
            const rp = replies[i];
            const rpayload = { replyId: makeTweetReplyId(), tweetId, accountId: String(rp.accountId), body: String(rp.body), worldTime: times[i] };
            { const z = cleanZh(rp.zh, rp.body, language); if (z) rpayload.zh = z; }
            await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'sns', type: 'tweet_reply', payload: rpayload });
            addedCount++;
            tweet.replies.push(rpayload);
        }
    }

    // task-007「猜你想搜索」:联想词搭主生成的便车(零额外调用),整批一条入账,fold 后写覆盖=只留最新——
    // 主人此刻会搜什么跟着剧情走,旧批词条自然过期。
    const sugg = (Array.isArray(parsed.suggestedSearches) ? parsed.suggestedSearches : [])
        .map(w => String(w || '').trim()).filter(Boolean).slice(0, 6);
    if (sugg.length) {
        await store.addEntry({
            worldKey, sourceFloor: batchFloor, app: 'sns', type: 'sns_suggest',
            payload: { suggestId: `sg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, words: sugg, worldTime: anchor },
        });
    }

    await store.setWatermark(worldKey, 'sns', batchFloor);
    return { ok: true, changed: true, added: addedCount };
}

// ── v0.14:Pulsar 搜索结果生成(task-007 她的翻转:「猜你想搜索」——词条是主人侧生成的,观测者
//    只点选看哪条,与「继续围观」同构,零输入铁律无伤)。同词只生成一次,之后永远读缓存。──

async function runSnsSearchGeneration(ctx, store, { worldKey, word, floorWindow, profileId, customApi, owner, language, allowUserContact, excludeTags }) {
    await ensureRegexEngine();
    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    word = String(word || '').trim();
    if (!word) return { ok: false, error: 'parse_failed' };
    if ([...world.tweets.values()].some(t => t.fromSearch === word)) return { ok: true, changed: false }; // 缓存命中

    const charName = owner || ctx.name2 || '主角';
    const userSideName = (ctx.name1 || '').trim();
    const caution = (userSideName && userSideName !== charName)
        ? `⚠️特别注意:正文是双人叙事,「${userSideName}」是叙事的另一方。不得注册为账号发言(除非剧情确实如此);更不得在任何推文中暗示 TA 与「${charName}」的关系。\n\n`
        : '';
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx, excludeTags), charName);
    const notes = await buildInjectedNotes(ctx);
    const recent = buildFloorSection(ctx, { newFrom: null, floorWindow: floorWindow ?? 0, excludeTags, background: true });
    const userContent = `${caution}${castRef}${notes.text}${recent}【SNS 当前状态】\n${buildSnsDigestText(world)}\n\n【主人搜索的词】${word}`;
    logContextShape('SNS搜索', userContent, notes.keys);
    const systemPrompt = PROMPT_N.replaceAll('{{char}}', charName).replaceAll('{{LANG_RULE}}', langRule('sns', language));

    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'parse_failed' };

    const sourceFloor = ctx.chat.length ? ctx.chat.length - 1 : 0;
    // 新账号 ≤2(同续写纪律);搜索绝不铸造主人的账号(ownerRole 一律剥除);isUserSide 硬闸照守
    let accountBudget = 2;
    for (const a of Array.isArray(parsed.newAccounts) ? parsed.newAccounts : []) {
        if (!a?.accountId || !a?.handle || accountBudget <= 0) continue;
        const accountId = String(a.accountId);
        if (world.snsAccounts.has(accountId)) continue;
        if (!allowUserContact && a.castName && isUserSide(a.castName, ctx)) { console.warn('[Orrery] 已拦下叙事另一方越界注册账号(搜索):', a.castName); continue; }
        const payload = { accountId, handle: String(a.handle), displayName: String(a.displayName || a.handle), bio: a.bio || '' };
        if (a.castName) payload.castName = String(a.castName);
        const added = await store.addEntry({ worldKey, sourceFloor, app: 'sns', type: 'sns_account', payload });
        world.snsAccounts.set(accountId, { ...payload, sourceFloor: added.sourceFloor, ts: added.ts });
        accountBudget--;
    }

    // 结果推=世界里已存在的旧推:worldTime 按 hoursAgo 落在 snsNow 之前,不搅时间线;
    // 带 fromSearch 标记——TL 过滤它(搜索不灌时间线),发帖者主页不过滤(旧推出现在主页天经地义)。
    const baseNow = world.snsNow ?? Date.now();
    let added = 0;
    for (const t of Array.isArray(parsed.tweets) ? parsed.tweets : []) {
        if (!t?.body || !t?.accountId) continue;
        let accountId = String(t.accountId);
        const resolved = resolveByHandle(world.snsAccounts, accountId, 'accountId');
        if (resolved) accountId = resolved;
        const acc = world.snsAccounts.get(accountId);
        if (!acc) continue;                    // 查无此号,丢弃
        if (acc.ownerRole) continue;           // 主人的账号绝不出现在新生成结果里(提示词+代码双闸)
        const hoursAgo = Number.isFinite(t.hoursAgo) ? Math.min(Math.max(1, t.hoursAgo), 168) : (added + 1) * 3;
        const tweetId = `tw_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        const payload = {
            tweetId, accountId, body: String(t.body), worldTime: baseNow - hoursAgo * 3600000,
            likes: clampCount(t.likes), retweets: clampCount(t.retweets), fromSearch: word,
        };
        { const z = cleanZh(t.zh, t.body, language); if (z) payload.zh = z; }
        await store.addEntry({ worldKey, sourceFloor, app: 'sns', type: 'tweet', payload });
        added++;
    }
    return { ok: true, changed: true, added };
}

// ── v0.14:网页快照生成(task-007 她拍板:AI 直出整页 HTML,不用预置模板;点开才生成一次,
//    入账永久缓存;消毒与沙箱渲染在 UI 层,这里存原始 html)。──

async function runBrowserPageGeneration(ctx, store, { worldKey, visitId, profileId, customApi, owner, language }) {
    await ensureRegexEngine();
    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const visit = world.visits.get(visitId);
    if (!visit) return { ok: false, error: 'no_thread' };
    if (world.snapshots.has(visitId)) return { ok: true, changed: false }; // 缓存命中,不再花一分 token

    const charName = owner || ctx.name2 || '主角';
    // 材料刻意不给人物设定与正文:页面是公共物(原则1),给了反而诱导它为主角定制内容;
    // 世界观靠注记(世界书/作者注释)兜着。
    const notes = await buildInjectedNotes(ctx);
    const fromQuery = visit.fromQueryId ? world.searches.get(visit.fromQueryId)?.text : null;
    const userContent = `${notes.text}【页面标题】${visit.title}\n【站名】${visit.site || '(未知)'}${fromQuery ? `\n【来源检索词】${fromQuery}(主人搜了它,从结果里点进了这一页)` : ''}`;
    logContextShape('网页快照', userContent, notes.keys);
    const systemPrompt = PROMPT_M.replaceAll('{{char}}', charName).replaceAll('{{LANG_RULE}}', langRule('webpage', language));

    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || typeof parsed !== 'object' || !parsed.html) return { ok: false, error: 'parse_failed' };

    const sourceFloor = ctx.chat.length ? ctx.chat.length - 1 : 0;
    const payload = {
        snapshotId: `ws_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        visitId, url: String(parsed.url || '').slice(0, 300), html: String(parsed.html),
        worldTime: visit.worldTime,
    };
    if (language === 'ja_zh' && parsed.zh) payload.zh = String(parsed.zh); // 大意不是整页翻译,cleanZh 的等值判断不适用
    await store.addEntry({ worldKey, sourceFloor, app: 'browser', type: 'web_snapshot', payload });
    return { ok: true, changed: true, added: 1 };
}

// ── M2:SNS 回复续写:定向续写单条推,允许返回空;newAccount 一批最多新建 2 个(任务书 §4)。──

async function runSnsTweetContinue(ctx, store, { worldKey, tweetId, floorWindow, profileId, customApi, owner, language, allowUserContact, excludeTags, count }) {
    await ensureRegexEngine();
    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const tweet = world.tweets.get(tweetId);
    if (!tweet?.accountId) return { ok: false, error: 'no_thread' };

    const systemPrompt = PROMPT_I
        .replaceAll('{{LANG_RULE}}', langRule('sns', language))
        .replaceAll('{{COUNT_RULE}}', countRule('sns', count));
    // 同 runThreadContinue/runForumThreadContinue:续写也补上摘要与正文近况,否则账号只能凭一条推的
    // 字面意思接话,主线人物的小号一开口就回到关系原点。
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx, excludeTags), owner || ctx.name2);
    const notes = await buildInjectedNotes(ctx);
    const recent = buildFloorSection(ctx, { newFrom: null, floorWindow: floorWindow ?? 0, excludeTags, background: true });
    const userContent = `${castRef}${notes.text}${recent}${buildSnsTweetDigestText(world, tweet)}`;
    logContextShape('SNS回复续写', userContent, notes.keys);

    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || !Array.isArray(parsed.replies)) return { ok: false, error: 'parse_failed' };
    if (!parsed.replies.length) return { ok: true, added: 0 };

    const sourceFloor = ctx.chat.length ? ctx.chat.length - 1 : 0;
    function makeTweetReplyId() {
        return `tr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    }
    let newAccountBudget = 2;
    const valid = [];
    for (const rp of parsed.replies) {
        if (!rp?.body) continue;
        let accountId = rp.accountId ? String(rp.accountId) : null;
        if (!accountId) continue;
        // @handle 写法先归位;归不上的才可能是本批合法新建的账号
        const resolved = resolveByHandle(world.snsAccounts, accountId, 'accountId');
        if (resolved) { accountId = resolved; rp.accountId = resolved; }
        if (!world.snsAccounts.has(accountId)) {
            const na = rp.newAccount;
            if (!(na?.accountId && String(na.accountId) === accountId && newAccountBudget > 0)) continue; // 查无此人且非法新建,丢弃
            if (!allowUserContact && ((na.displayName && isUserSide(na.displayName, ctx)) || (na.castName && isUserSide(na.castName, ctx)))) {
                console.warn('[Orrery] 已拦下叙事另一方越界注册SNS账号(续写):', na.displayName || na.castName);
                continue;
            }
            const payload = { accountId, handle: String(na.handle || '?'), displayName: String(na.displayName || na.handle || '?'), bio: na.bio || '' };
            if (na.castName) payload.castName = String(na.castName);
            const added = await store.addEntry({ worldKey, sourceFloor, app: 'sns', type: 'sns_account', payload });
            world.snsAccounts.set(accountId, { ...payload, sourceFloor: added.sourceFloor, ts: added.ts });
            newAccountBudget--;
        }
        valid.push(rp);
    }
    if (!valid.length) return { ok: true, added: 0 };

    const anchor = tweet.replies.length ? tweet.replies[tweet.replies.length - 1].worldTime : (tweet.worldTime || Date.now());
    const times = layoutWorldTimes(valid, anchor, anchor);
    for (let i = 0; i < valid.length; i++) {
        const rp = valid[i];
        const rpayload = { replyId: makeTweetReplyId(), tweetId, accountId: String(rp.accountId), body: String(rp.body), worldTime: times[i] };
        { const z = cleanZh(rp.zh, rp.body, language); if (z) rpayload.zh = z; }
        await store.addEntry({ worldKey, sourceFloor, app: 'sns', type: 'tweet_reply', payload: rpayload });
    }
    return { ok: true, added: valid.length };
}

// ── M3:浏览器主生成:独立水位、独立触发(app 内「刷新」),消化 newSearches(含内联 visits)/newVisits。
//    没有续写/续聊入口——v1 没有详情页,只有主刷新(任务书-M3 §1)。 ──

async function runBrowserMainGeneration(ctx, store, { worldKey, floorWindow, profileId, customApi, owner, language, excludeTags }) {
    await ensureRegexEngine();
    const watermark = await store.getWatermark(worldKey, 'browser');
    const tip = ctx.chat.length - 1;
    const { newFrom, batchFloor, hint: regrowHint } = pendingOrRegrow(watermark, tip, floorWindow);
    if (batchFloor === null) return { ok: true, changed: false };

    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const charName = owner || ctx.name2 || '主角';
    // 同 messenger/forum/sns 的点名警示,换成浏览器语境的措辞(检索视角而非注册身份)。
    const userSideName = (ctx.name1 || '').trim();
    const caution = (userSideName && userSideName !== charName)
        ? `⚠️特别注意:正文是双人叙事,「${userSideName}」是叙事的另一方。不得出现以「${userSideName}」视角的检索;两人尚未相识时,连「${userSideName}」的名字都不许出现在检索词里。\n\n`
        : '';
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx, excludeTags), charName);
    const notes = await buildInjectedNotes(ctx);
    const userContent = `${caution}${castRef}${notes.text}${buildFloorSection(ctx, { newFrom, floorWindow, excludeTags })}【浏览器当前状态】\n${buildBrowserDigestText(world)}${regrowHint ? `\n\n${regrowHint.trim()}` : ''}`;
    logContextShape('浏览器生成', userContent, notes.keys);
    const systemPrompt = PROMPT_J.replaceAll('{{char}}', charName).replaceAll('{{LANG_RULE}}', langRule('browser', language));

    // 回滚纪元闸照 SNS 补上(任务书-M3 §3):生成期间用户在酒馆里删楼/swipe,回滚代表更晚的意图,整批作废。
    const epoch = store.getRollbackEpoch();
    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'parse_failed' };
    if (store.getRollbackEpoch() !== epoch) return { ok: false, error: 'rolled_back' };

    let addedCount = 0;
    // 新实体 id 不让 LLM 现造(M1 教训),照 makeTweetId/makeForumThreadId 的思路自造。
    function makeQueryId() { return `sq_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }
    function makeVisitId() { return `bv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

    // 锚=max(worldTime 解析值, browserNow)(同 SNS 的锚点写法),新检索自锚点按 delayMin 排开。
    const anchor = Math.max(parseWorldTime(parsed.worldTime) ?? (world.browserNow ?? Date.now()), world.browserNow ?? 0);

    const validSearches = [];
    for (const s of Array.isArray(parsed.newSearches) ? parsed.newSearches : []) {
        if (s?.text) validSearches.push(s);
        else console.warn('[Orrery] 新检索缺少 text,已丢弃'); // 静默丢弃教训:留声,不连累其余条目
    }
    const searchTimes = layoutWorldTimes(validSearches, anchor, world.browserNow || 0);

    for (let i = 0; i < validSearches.length; i++) {
        const s = validSearches[i];
        const queryId = makeQueryId();
        const payload = { queryId, text: String(s.text), worldTime: searchTimes[i] };
        { const z = cleanZh(s.zh, s.text, language); if (z) payload.zh = z; }
        await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'browser', type: 'search_query', payload });
        addedCount++;

        // visits 挂在这条检索下:从这条检索点进去的页面,锚=检索自己的 worldTime 再依 delayMin 排开。
        const visits = [];
        for (const v of Array.isArray(s.visits) ? s.visits : []) {
            if (v?.title) visits.push(v);
            else console.warn('[Orrery] 浏览记录缺少 title,已丢弃');
        }
        const vtimes = layoutWorldTimes(visits, searchTimes[i], searchTimes[i]);
        for (let j = 0; j < visits.length; j++) {
            const v = visits[j];
            const vpayload = { visitId: makeVisitId(), title: String(v.title), site: String(v.site || ''), worldTime: vtimes[j], fromQueryId: queryId };
            { const z = cleanZh(v.zh, v.title, language); if (z) vpayload.zh = z; }
            await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'browser', type: 'browse_visit', payload: vpayload });
            addedCount++;
        }
    }

    // newVisits:与检索无关的独立浏览,锚点同新检索一样排开。
    const validVisits = [];
    for (const v of Array.isArray(parsed.newVisits) ? parsed.newVisits : []) {
        if (v?.title) validVisits.push(v);
        else console.warn('[Orrery] 独立浏览记录缺少 title,已丢弃');
    }
    const visitTimes = layoutWorldTimes(validVisits, anchor, world.browserNow || 0);
    for (let i = 0; i < validVisits.length; i++) {
        const v = validVisits[i];
        const payload = { visitId: makeVisitId(), title: String(v.title), site: String(v.site || ''), worldTime: visitTimes[i] };
        { const z = cleanZh(v.zh, v.title, language); if (z) payload.zh = z; }
        await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'browser', type: 'browse_visit', payload });
        addedCount++;
    }

    await store.setWatermark(worldKey, 'browser', batchFloor);
    return { ok: true, changed: true, added: addedCount };
}

// ── M4:相册主生成:独立水位、独立触发(app 内「刷新」),消化 newPhotos。
//    没有续写/续聊入口——v1 没有详情页续写,只有主刷新(任务书-M4 §一)。 ──

async function runGalleryMainGeneration(ctx, store, { worldKey, floorWindow, profileId, customApi, owner, language, excludeTags }) {
    await ensureRegexEngine();
    const watermark = await store.getWatermark(worldKey, 'gallery');
    const tip = ctx.chat.length - 1;
    const { newFrom, batchFloor, hint: regrowHint } = pendingOrRegrow(watermark, tip, floorWindow);
    if (batchFloor === null) return { ok: true, changed: false };

    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const charName = owner || ctx.name2 || '主角';
    // 同 messenger/forum/sns/browser 的点名警示,换成相册语境的措辞(任务书-M4 §三 caution 措辞)。
    const userSideName = (ctx.name1 || '').trim();
    const caution = (userSideName && userSideName !== charName)
        ? `⚠️特别注意:正文是双人叙事,「${userSideName}」是叙事的另一方。不得出现以「${userSideName}」为主角的摆拍;两人尚未相识时,「${userSideName}」的身影绝不许入镜。\n\n`
        : '';
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx, excludeTags), charName);
    const notes = await buildInjectedNotes(ctx);
    const userContent = `${caution}${castRef}${notes.text}${buildFloorSection(ctx, { newFrom, floorWindow, excludeTags })}【相册当前状态】\n${buildGalleryDigestText(world)}${regrowHint ? `\n\n${regrowHint.trim()}` : ''}`;
    logContextShape('相册生成', userContent, notes.keys);
    const systemPrompt = PROMPT_K.replaceAll('{{char}}', charName).replaceAll('{{LANG_RULE}}', langRule('gallery', language));

    // 回滚纪元闸照 browser 补上(任务书-M4 §一):生成期间用户在酒馆里删楼/swipe,回滚代表更晚的意图,整批作废。
    const epoch = store.getRollbackEpoch();
    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'parse_failed' };
    if (store.getRollbackEpoch() !== epoch) return { ok: false, error: 'rolled_back' };

    let addedCount = 0;
    // 新实体 id 不让 LLM 现造(M1 教训),照 makeQueryId/makeVisitId 的思路自造。
    function makePhotoId() { return `ph_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

    // 锚=max(worldTime 解析值, galleryNow)(同浏览器的锚点写法),新照片自锚点按 delayMin 排开。
    const anchor = Math.max(parseWorldTime(parsed.worldTime) ?? (world.galleryNow ?? Date.now()), world.galleryNow ?? 0);

    const validPhotos = [];
    for (const p of Array.isArray(parsed.newPhotos) ? parsed.newPhotos : []) {
        if (p?.desc) validPhotos.push(p);
        else console.warn('[Orrery] 新照片缺少 desc,已丢弃'); // 静默丢弃教训:留声,不连累其余条目
    }
    const times = layoutWorldTimes(validPhotos, anchor, world.galleryNow || 0);

    for (let i = 0; i < validPhotos.length; i++) {
        const p = validPhotos[i];
        // tone/kind 白名单校验:非法值分别落 street/photo(任务书-M4 §二),绝不把模型字符串直接进 DOM。
        const tone = GALLERY_TONES.includes(p.tone) ? p.tone : 'street';
        const kind = p.kind === 'screenshot' ? 'screenshot' : 'photo';
        const payload = { photoId: makePhotoId(), label: String(p.label || ''), desc: String(p.desc), tone, kind, worldTime: times[i] };
        { const z = cleanZh(p.zh, p.desc, language); if (z) payload.zh = z; }
        await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'gallery', type: 'photo', payload });
        addedCount++;
    }

    await store.setWatermark(worldKey, 'gallery', batchFloor);
    return { ok: true, changed: true, added: addedCount };
}

// ── M4:备忘录主生成:独立水位、独立触发(app 内「刷新」),消化 newNotes + edits。
//    没有续写/续聊入口——v1 没有详情页续写,只有主刷新(任务书-M4 §一)。 ──

async function runMemoMainGeneration(ctx, store, { worldKey, floorWindow, profileId, customApi, owner, language, excludeTags }) {
    await ensureRegexEngine();
    const watermark = await store.getWatermark(worldKey, 'memo');
    const tip = ctx.chat.length - 1;
    const { newFrom, batchFloor, hint: regrowHint } = pendingOrRegrow(watermark, tip, floorWindow);
    if (batchFloor === null) return { ok: true, changed: false };

    const world = foldWorld(await store.getEntriesForWorld(worldKey));
    const charName = owner || ctx.name2 || '主角';
    // 同上,换成备忘录语境的措辞(任务书-M4 §三 caution 措辞)。
    const userSideName = (ctx.name1 || '').trim();
    const caution = (userSideName && userSideName !== charName)
        ? `⚠️特别注意:正文是双人叙事,「${userSideName}」是叙事的另一方。两人尚未相识时,「${userSideName}」的名字绝不许出现在备忘里。\n\n`
        : '';
    const castRef = await buildCastReference(ctx, recentFloorTexts(ctx, excludeTags), charName);
    const notes = await buildInjectedNotes(ctx);
    const userContent = `${caution}${castRef}${notes.text}${buildFloorSection(ctx, { newFrom, floorWindow, excludeTags })}【备忘录当前状态】\n${buildMemoDigestText(world)}${regrowHint ? `\n\n${regrowHint.trim()}` : ''}`;
    logContextShape('备忘录生成', userContent, notes.keys);
    const systemPrompt = PROMPT_L.replaceAll('{{char}}', charName).replaceAll('{{LANG_RULE}}', langRule('memo', language));

    const epoch = store.getRollbackEpoch();
    const parsed = await generateJsonWithRetry(ctx, systemPrompt, userContent, { profileId, customApi, responseLength: RESPONSE_BUDGET });
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: 'parse_failed' };
    if (store.getRollbackEpoch() !== epoch) return { ok: false, error: 'rolled_back' };

    let addedCount = 0;
    function makeNoteId() { return `mm_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }
    function makeEditId() { return `me_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }

    // 锚=max(worldTime 解析值, memoNow),newNotes 与 edits 各自独立自锚点排开(同浏览器 newSearches/
    // newVisits 的写法——两个数组各是各的时间线,不互相接续,谁的 delayMin 都从同一个锚点起算)。
    const anchor = Math.max(parseWorldTime(parsed.worldTime) ?? (world.memoNow ?? Date.now()), world.memoNow ?? 0);

    const validNotes = [];
    for (const n of Array.isArray(parsed.newNotes) ? parsed.newNotes : []) {
        if (n?.text) validNotes.push(n);
        else console.warn('[Orrery] 新备忘缺少 text,已丢弃');
    }
    const noteTimes = layoutWorldTimes(validNotes, anchor, world.memoNow || 0);
    for (let i = 0; i < validNotes.length; i++) {
        const n = validNotes[i];
        const noteId = makeNoteId();
        const payload = { noteId, text: String(n.text), worldTime: noteTimes[i] };
        { const z = cleanZh(n.zh, n.text, language); if (z) payload.zh = z; }
        const added = await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'memo', type: 'memo_note', payload });
        // 本批新建的备忘也要能被本批的 edits 引用到(同 messenger 主生成里 world.contacts.set 的写法:
        // 内存快照跟着这一批的写入同步更新,不必等下次 fold)——虽然任务书 §三 的 digest 只列已有备忘,
        // 但消化层多容忍一步不算违约,只会更宽恕,不会更严格。
        world.memos.set(noteId, { noteId, text: payload.text, zh: payload.zh, createdTime: noteTimes[i], editedTime: undefined, latestTs: noteTimes[i], ts: added.ts });
        addedCount++;
    }

    const validEdits = [];
    for (const e of Array.isArray(parsed.edits) ? parsed.edits : []) {
        if (e?.noteId && e?.text) validEdits.push(e);
        else console.warn('[Orrery] 改写缺少 noteId 或 text,已丢弃');
    }
    const editTimes = layoutWorldTimes(validEdits, anchor, world.memoNow || 0);
    for (let i = 0; i < validEdits.length; i++) {
        const e = validEdits[i];
        const noteId = String(e.noteId);
        // edits 的 noteId 查无此账整条丢弃(任务书-M4 §三/§四):名册就在 world.memos 里,反查零成本
        // (同 resolveByHandle 的宽恕哲学,只是这里没有 handle 别名可反查,查无此账就是真的没有)。
        if (!world.memos.has(noteId)) { console.warn('[Orrery] 改写指向不存在的备忘', noteId, ',已丢弃'); continue; }
        const editId = makeEditId();
        const payload = { editId, noteId, text: String(e.text), worldTime: editTimes[i] };
        { const z = cleanZh(e.zh, e.text, language); if (z) payload.zh = z; }
        await store.addEntry({ worldKey, sourceFloor: batchFloor, app: 'memo', type: 'memo_edit', payload });
        addedCount++;
    }

    await store.setWatermark(worldKey, 'memo', batchFloor);
    return { ok: true, changed: true, added: addedCount };
}

// ── 对外入口:UI 只认这九个。messenger 两个内部自动接总结检查;forum/sns/browser/gallery/memo
//    没有总结机制(§2 拍板不用改 PROMPT_C)。browser/gallery/memo 各只有一个入口——v1 没有详情页
//    续写,自然也没有续写。──

export async function generateMore(ctx, store, opts) {
    const result = await runMainGeneration(ctx, store, opts);
    if (result.ok && result.changed) {
        for (const threadId of result.touchedThreads) {
            await maybeSummarizeThread(ctx, store, { ...opts, threadId });
        }
    }
    return result;
}

export async function continueThread(ctx, store, opts) {
    const result = await runThreadContinue(ctx, store, opts);
    if (result.ok && result.added > 0) {
        await maybeSummarizeThread(ctx, store, opts);
    }
    return result;
}

export async function generateMoreForum(ctx, store, opts) {
    return await runForumMainGeneration(ctx, store, opts);
}

export async function continueForumThread(ctx, store, opts) {
    return await runForumThreadContinue(ctx, store, opts);
}

export async function generateMoreSns(ctx, store, opts) {
    return await runSnsMainGeneration(ctx, store, opts);
}

export async function continueTweetReplies(ctx, store, opts) {
    return await runSnsTweetContinue(ctx, store, opts);
}

export async function generateMoreBrowser(ctx, store, opts) {
    return await runBrowserMainGeneration(ctx, store, opts);
}

export async function generateSnsSearch(ctx, store, opts) {
    return await runSnsSearchGeneration(ctx, store, opts);
}

export async function generateWebSnapshot(ctx, store, opts) {
    return await runBrowserPageGeneration(ctx, store, opts);
}

export async function generateMoreGallery(ctx, store, opts) {
    return await runGalleryMainGeneration(ctx, store, opts);
}

export async function generateMoreMemo(ctx, store, opts) {
    return await runMemoMainGeneration(ctx, store, opts);
}
