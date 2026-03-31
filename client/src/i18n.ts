import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const resources = {
  "zh-CN": {
    translation: {
      // 通用
      save: "保存",
      cancel: "取消",
      confirm: "确认",
      loading: "加载中...",
      success: "成功",
      error: "错误",

      // 偏好设置
      preferences: "偏好设置",
      theme: "主题",
      themeLight: "浅色",
      themeDark: "深色",
      themeSystem: "跟随系统",
      language: "语言",
      languageDesc: "选择您偏好的界面语言",
      themeDesc: "选择您喜欢的主题模式",

      // 用户中心
      profile: "用户中心",
      basicInfo: "基本信息",
      security: "账号安全",
      username: "用户名",
      email: "邮箱",
      avatar: "头像",
      avatarDesc: "点击上传新头像，支持 JPG、PNG、WEBP",
      saveChanges: "保存修改",
      changePassword: "修改密码",
      currentPassword: "当前密码",
      newPassword: "新密码",
      confirmNewPassword: "确认新密码",
      passwordChanged: "密码修改成功",
      profileUpdated: "用户信息已更新",
      avatarUploaded: "头像上传成功",

      // 登录注册
      login: "登录",
      register: "注册",
      loginTitle: "登录",
      registerTitle: "注册",
      logout: "退出登录",
      loginSubtitle: "AI 视频大师",
      loginError: "登录失败",
      registerError1: "两次输入的密码不一致",
      registerError2: "密码长度至少为 6 位",
      registerError3: "注册失败",
      oauthComingSoon: "登录正在开发中，敬请期待！",
      oauthDebugMode: "调试模式 - OAuth 暂不可用",
      otherLoginMethods: "其他登录方式",
      password: "密码",
      confirmPassword: "确认密码",
      loginLoading: "登录中...",
      registerLoading: "注册中...",
      agreeTerms: "注册即表示同意我们的服务条款",
      passwordHint: "密码（至少 6 位）",

      // 首页
      home: "首页",
      studio: "工作台",
      settings: "设置",
      startCreating: "开始创作",
      startCreate: "开始创作",
      configApiKey: "配置 API Key",
      heroBadge: "所见即大片",
      heroSubtitle: "芝麻开门，就是一个 AI 创作团队。",
      workflowTitle: "创作流程",
      workflowDesc: "简单 4 步，从 0 到 1",
      featuresTitle: "核心能力",
      featuresDesc: "每一个环节都经过精心设计",
      comparisonTitle: "与同类产品对比",
      comparisonDesc: "在保持相同生图、生视频效果的前提下，做到更极致的自动化",
      ctaTitle: "准备好了吗？",
      ctaDesc: "只要一句简单的提示，就能打开芝麻开门的世界",
      ctaButton: "立即开始",
      footer: "芝麻开门 Open-Door · AI Video Generation",
      enterStudio: "进入工作台",
      configApi: "配置 API",
      loginRegister: "登录/注册",
      english: "English",
      simplifiedChinese: "简体中文",
      traditionalChinese: "繁体中文",
      japanese: "日本語",
      korean: "한국어",

      // 首页 Hero
      heroTitle: "一个点子 一句话",
      heroSubtitle2: "从创意到大片",
      supportedModels:
        "支持 DeepSeek · Kimi · Gemini · Kling · Seedance · MiniMax",

      // Features
      feature1Title: "智能脚本策划",
      feature1Desc:
        "输入一句话，AI 自动生成结构化分镜脚本，支持 DeepSeek、Kimi、Gemini 等多种大模型。",
      feature2Title: "对标视频分析",
      feature2Desc:
        "上传任意参考视频，Gemini 自动反推每个分镜的提示词、识别人物，分析风格，一键复用。",
      feature3Title: "人物替换工作流",
      feature3Desc:
        "上传角色参考图（支持四宫格三视图），Kling Omni 多参考模式保持全片人物高度一致。",
      feature4Title: "Kling Omni Multi-Shot",
      feature4Desc:
        "全新 Kling 3.0 Omni 引擎，支持多参考生视频、首尾帧、shot_type intelligence，分镜更连贯。",
      feature5Title: "动态音画对齐",
      feature5Desc:
        "先生成 MiniMax TTS 配音并测量精确时长，再以此控制视频 duration，音画永远同步。",
      feature6Title: "剪映分轨草稿",
      feature6Desc:
        "每个分镜独立轨道，自动生成剪映草稿，导入即可在时间线上精细调整，无需手动整理素材。",
      feature7Title: "首帧精确锁定",
      feature7Desc:
        "先用 Nano Banana 生成 4K 关键帧图像，再用图生视频，画质下限极高，主体不漂移。",
      feature8Title: "越用越懂你",
      feature8Desc:
        "Mem0 记忆系统自动学习你的风格偏好，每次生成都会注入你的历史创作习惯。",

      // Workflow
      step1Label: "输入创意",
      step1Desc: "一句话描述你的想法，或上传参考视频让 AI 分析风格",
      step2Label: "AI 策划",
      step2Desc: "AI 自动生成完整分镜脚本，你可以审核和调整每个细节",
      step3Label: "一键生成",
      step3Desc: "并行生成首帧图像，配音、视频，自动拼接成片",
      step4Label: "下载成片",
      step4Desc: "获取 MP4 视频 + 剪映草稿，精细调整后导出",

      // Comparison table
      compareDim: "对比维度",
      compareLibTV: "LibTV",
      compareHuobao: "火宝短剧",
      compareOurs: "芝麻开门 ✦",
      compareRow1: "自然语言对话 + 对标视频分析，一句话驱动",
      compareRow2: "Gemini 自动分析分镜结构，反推提示词、识别人物",
      compareRow3: "四宫格三视图 + Kling Omni 多参考模式",
      compareRow4: "Kling 3.0 Omni + Seedance 1.5 双引擎智能路由",
      compareRow5: "先测配音时长，再控视频 duration",
      compareRow6: "剪映分轨草稿 + MP4 双输出",
      compareRow7: "Mem0 数字孪生，越用越懂你",
      compareRow8: "封装为标准 Skill，可被任意 Agent 调用",

      // 对比表维度
      compareRow1Dim: "交互范式",
      compareRow2Dim: "对标视频反推",
      compareRow3Dim: "人物一致性",
      compareRow4Dim: "视频引擎",
      compareRow5Dim: "音画同步",
      compareRow6Dim: "最终交付",
      compareRow7Dim: "记忆系统",
      compareRow8Dim: "Agent 调用",

      // 对比表 LibTV 列
      libtv1: "节点画布，手动触发",
      libtv2: "无",
      libtv3: "提示词引导",
      libtv4: "Kling 1.x",
      libtv5: "手动剪辑对齐",
      libtv6: "手动下载导入剪映",
      libtv7: "无",
      libtv8: "无",

      // 对比表 火宝列
      huobao1: "表单填写，按步操作",
      huobao2: "无",
      huobao3: "参考图上传",
      huobao4: "单引擎",
      huobao5: "未明确支持",
      huobao6: "压制 MP4",
      huobao7: "无",
      huobao8: "无",

      // 设置页面
      apiConnector: "API 连接器",
      backToStudio: "返回工作台",
      backendConnected: "后端已连接",
      backendDisconnected: "后端未连接",
      checkingBackend: "检查后端...",
      saveConfig: "保存配置",
      apiConfigTitle: "配置 API Key",
      apiConfigDesc: "系统将使用这些接口完成脚本生成、生图、配音和视频合成。",
      securityTip: "安全提示",
      conversationLLM: "对话用大模型",
      conversationLLMDesc: "从下面的配置中，选出来的推理模型提供商。",
      connectionSuccess: "连接成功",
      connectionFailed: "连接失败",
      testConnection: "测试连接",
      getKey: "获取 Key",
      testing: "测试中...",
      saveFailed: "保存失败",
      configured: "已配置",
      fillApiKeyFirst: "请先填写 API Key 并保存，然后再测试连接",
    },
  },
  "en-US": {
    translation: {
      // Common
      save: "Save",
      cancel: "Cancel",
      confirm: "Confirm",
      loading: "Loading...",
      success: "Success",
      error: "Error",

      // Preferences
      preferences: "Preferences",
      theme: "Theme",
      themeLight: "Light",
      themeDark: "Dark",
      themeSystem: "System",
      language: "Language",
      languageDesc: "Choose your preferred interface language",
      themeDesc: "Choose your preferred theme",

      // Profile
      profile: "Profile",
      basicInfo: "Basic Info",
      security: "Security",
      username: "Username",
      email: "Email",
      avatar: "Avatar",
      avatarDesc: "Click to upload new avatar, supports JPG, PNG, WEBP",
      saveChanges: "Save Changes",
      changePassword: "Change Password",
      currentPassword: "Current Password",
      newPassword: "New Password",
      confirmNewPassword: "Confirm New Password",
      passwordChanged: "Password changed successfully",
      profileUpdated: "Profile updated",
      avatarUploaded: "Avatar uploaded",

      // Login/Register
      login: "Login",
      register: "Register",
      loginTitle: "Login",
      registerTitle: "Register",
      logout: "Logout",
      loginSubtitle: "AI Video Master",
      loginError: "Login failed",
      registerError1: "Passwords do not match",
      registerError2: "Password must be at least 6 characters",
      registerError3: "Registration failed",
      oauthComingSoon: "OAuth login is coming soon!",
      oauthDebugMode: "Debug Mode - OAuth not available",
      otherLoginMethods: "Other login methods",
      password: "Password",
      confirmPassword: "Confirm Password",
      loginLoading: "Logging in...",
      registerLoading: "Registering...",
      agreeTerms: "By registering, you agree to our Terms of Service",
      passwordHint: "Password (at least 6 characters)",

      // Home
      home: "Home",
      studio: "Studio",
      settings: "Settings",
      startCreating: "Start Creating",
      startCreate: "Start Creating",
      configApiKey: "Configure API Key",
      heroBadge: "Blockbuster Quality",
      heroSubtitle: "Open-Door is your AI creative team.",
      workflowTitle: "Workflow",
      workflowDesc: "4 simple steps from 0 to 1",
      featuresTitle: "Core Features",
      featuresDesc: "Every detail is carefully designed",
      comparisonTitle: "Compare with Competitors",
      comparisonDesc:
        "Maintain same generation quality while achieving ultimate automation",
      ctaTitle: "Ready?",
      ctaDesc: "Just a simple prompt opens the world of Open-Door",
      ctaButton: "Get Started",
      footer: "芝麻开门 Open-Door · AI Video Generation",
      enterStudio: "Enter Studio",
      configApi: "Configure API",
      loginRegister: "Login / Register",
      english: "English",
      simplifiedChinese: "Simplified Chinese",
      traditionalChinese: "Traditional Chinese",
      japanese: "Japanese",
      korean: "Korean",

      // Home Hero
      heroTitle: "One Idea, One Sentence",
      heroSubtitle2: "From Concept to Blockbuster",
      supportedModels:
        "Supports DeepSeek · Kimi · Gemini · Kling · Seedance · MiniMax",

      // Features
      feature1Title: "Intelligent Script Planning",
      feature1Desc:
        "Enter a sentence, AI automatically generates structured storyboard scripts, supporting DeepSeek, Kimi, Gemini, and more.",
      feature2Title: "Reference Video Analysis",
      feature2Desc:
        "Upload any reference video, Gemini automatically reverse-engineers prompts for each scene, identifies characters, analyzes style.",
      feature3Title: "Character Replacement Workflow",
      feature3Desc:
        "Upload character reference images (supports 4-grid front/side/view), Kling Omni multi-reference mode maintains character consistency.",
      feature4Title: "Kling Omni Multi-Shot",
      feature4Desc:
        "All-new Kling 3.0 Omni engine, supports multi-reference video generation, first/last frames, shot_type intelligence.",
      feature5Title: "Dynamic Audio-Video Sync",
      feature5Desc:
        "Generate MiniMax TTS voiceover first with precise duration measurement, then control video duration for perfect sync.",
      feature6Title: "JianYin Draft with Separate Tracks",
      feature6Desc:
        "Each scene has independent tracks, auto-generates JianYin draft for fine-tuning on timeline without manual organization.",
      feature7Title: "First Frame Precise Lock",
      feature7Desc:
        "Generate 4K keyframe images with Nano Banana first, then image-to-video, extremely high quality floor, no subject drift.",
      feature8Title: "Gets Smarter Over Time",
      feature8Desc:
        "Mem0 memory system automatically learns your style preferences, injects your historical creation habits into every generation.",

      // Workflow
      step1Label: "Input Idea",
      step1Desc:
        "Describe your idea in one sentence, or upload reference video for AI to analyze style",
      step2Label: "AI Planning",
      step2Desc:
        "AI automatically generates complete storyboard, you can review and adjust every detail",
      step3Label: "One-Click Generate",
      step3Desc:
        "Parallel generation of keyframe images, voiceover, video, auto-assembled into final cut",
      step4Label: "Download Result",
      step4Desc: "Get MP4 video + JianYin draft, export after fine-tuning",

      // Comparison table
      compareDim: "Comparison",
      compareLibTV: "LibTV",
      compareHuobao: "FireShow",
      compareOurs: "Open-Door ✦",
      compareRow1:
        "Natural language dialogue + reference video analysis, driven by one sentence",
      compareRow2:
        "Gemini automatically analyzes scene structure, reverse-engineers prompts, identifies characters",
      compareRow3: "4-grid front/side/view + Kling Omni multi-reference mode",
      compareRow4:
        "Kling 3.0 Omni + Seedance 1.5 dual-engine intelligent routing",
      compareRow5: "Measure voice duration first, then control video duration",
      compareRow6: "JianYin separate track draft + MP4 dual output",
      compareRow7: "Mem0 digital twin, gets smarter over time",
      compareRow8: "Encapsulated as standard Skill, can be called by any Agent",

      // Comparison table dimensions
      compareRow1Dim: "Interaction Paradigm",
      compareRow2Dim: "Reference Video Reverse",
      compareRow3Dim: "Character Consistency",
      compareRow4Dim: "Video Engine",
      compareRow5Dim: "Audio-Video Sync",
      compareRow6Dim: "Final Delivery",
      compareRow7Dim: "Memory System",
      compareRow8Dim: "Agent Calling",

      // Comparison table LibTV column
      libtv1: "Node canvas, manual trigger",
      libtv2: "None",
      libtv3: "Prompt guidance",
      libtv4: "Kling 1.x",
      libtv5: "Manual editing alignment",
      libtv6: "Manual download & import to JianYin",
      libtv7: "None",
      libtv8: "None",

      // Comparison table FireShow column
      huobao1: "Form fill, step-by-step",
      huobao2: "None",
      huobao3: "Reference image upload",
      huobao4: "Single engine",
      huobao5: "Not explicitly supported",
      huobao6: "Encoded MP4",
      huobao7: "None",
      huobao8: "None",

      // Settings page
      apiConnector: "API Connector",
      backToStudio: "Back to Studio",
      backendConnected: "Backend Connected",
      backendDisconnected: "Backend Disconnected",
      checkingBackend: "Checking backend...",
      saveConfig: "Save Configuration",
      apiConfigTitle: "Configure API Key",
      apiConfigDesc:
        "The system will use these interfaces for script generation, image generation, voiceover, and video synthesis.",
      securityTip: "Security Tips",
      conversationLLM: "Conversation LLM",
      conversationLLMDesc:
        "Select the reasoning model provider from the configurations below.",
      connectionSuccess: "Connection Successful",
      connectionFailed: "Connection Failed",
      testConnection: "Test Connection",
      getKey: "Get Key",
      testing: "Testing...",
      saveFailed: "Save Failed",
      configured: "Configured",
      fillApiKeyFirst:
        "Please fill in the API Key and save it before testing the connection",
    },
  },
  "zh-TW": {
    translation: {
      // 通用
      save: "儲存",
      cancel: "取消",
      confirm: "確認",
      loading: "載入中...",
      success: "成功",
      error: "錯誤",

      // 偏好設定
      preferences: "偏好設定",
      theme: "主題",
      themeLight: "淺色",
      themeDark: "深色",
      themeSystem: "跟隨系統",
      language: "語言",
      languageDesc: "選擇您偏好的介面語言",
      themeDesc: "選擇您喜歡的主題模式",

      // 使用者中心
      profile: "使用者中心",
      basicInfo: "基本資料",
      security: "帳號安全",
      username: "使用者名稱",
      email: "電子郵件",
      avatar: "頭像",
      avatarDesc: "點擊上傳新頭像，支援 JPG、PNG、WEBP",
      saveChanges: "儲存修改",
      changePassword: "修改密碼",
      currentPassword: "目前密碼",
      newPassword: "新密碼",
      confirmNewPassword: "確認新密碼",
      passwordChanged: "密碼修改成功",
      profileUpdated: "使用者資訊已更新",
      avatarUploaded: "頭像上傳成功",

      // 登入註冊
      login: "登入",
      register: "註冊",
      loginTitle: "登入",
      registerTitle: "註冊",
      logout: "登出",
      loginSubtitle: "AI 影片大師",
      loginError: "登入失敗",
      registerError1: "兩次輸入的密碼不一致",
      registerError2: "密碼長度至少為 6 位",
      registerError3: "註冊失敗",
      oauthComingSoon: "登入正在開發中，敬請期待！",
      oauthDebugMode: "除錯模式 - OAuth 暫不可用",
      otherLoginMethods: "其他登入方式",
      password: "密碼",
      confirmPassword: "確認密碼",
      loginLoading: "登入中...",
      registerLoading: "註冊中...",
      agreeTerms: "註冊即表示同意我們的服務條款",
      passwordHint: "密碼（至少 6 位）",

      // 首頁
      home: "首頁",
      studio: "工作台",
      settings: "設定",
      startCreating: "開始創作",
      startCreate: "開始創作",
      configApiKey: "設定 API Key",
      heroBadge: "所見即大片",
      heroSubtitle: "芝麻開門，就是一個 AI 創作團隊。",
      workflowTitle: "創作流程",
      workflowDesc: "簡單 4 步，從 0 到 1",
      featuresTitle: "核心能力",
      featuresDesc: "每一個環節都經過精心設計",
      comparisonTitle: "與同類產品對比",
      comparisonDesc: "在保持相同生圖、生影片效果的前提下，做到更極致的自動化",
      ctaTitle: "準備好了嗎？",
      ctaDesc: "只要一句簡單的提示，就能打開芝麻開門的世界",
      ctaButton: "立即開始",
      footer: "芝麻開門 Open-Door · AI Video Generation",
      enterStudio: "進入工作台",
      configApi: "設定 API",
      loginRegister: "登入/註冊",
      english: "English",
      simplifiedChinese: "简体中文",
      traditionalChinese: "繁體中文",
      japanese: "日本語",
      korean: "한국어",

      // 首頁 Hero
      heroTitle: "一個點子 一句話",
      heroSubtitle2: "從創意到大片",
      supportedModels:
        "支援 DeepSeek · Kimi · Gemini · Kling · Seedance · MiniMax",

      // Features
      feature1Title: "智慧腳本策劃",
      feature1Desc:
        "輸入一句話，AI 自動生成結構化分鏡腳本，支援 DeepSeek、Kimi、Gemini 等多種大模型。",
      feature2Title: "標竿影片分析",
      feature2Desc:
        "上傳任意參考影片，Gemini 自動反推每個分鏡的提示詞、識別人物，分析風格，一鍵復用。",
      feature3Title: "人物替換工作流",
      feature3Desc:
        "上傳角色參考圖（支援四宮格三視圖），Kling Omni 多參考模式保持全片人物高度一致。",
      feature4Title: "Kling Omni Multi-Shot",
      feature4Desc:
        "全新 Kling 3.0 Omni 引擎，支援多參考生影片、首尾幀、shot_type intelligence，分鏡更連貫。",
      feature5Title: "動態音畫對齊",
      feature5Desc:
        "先生成 MiniMax TTS 配音並測量精確時長，再以此控制影片 duration，音畫永遠同步。",
      feature6Title: "剪映分軌草稿",
      feature6Desc:
        "每個分鏡獨立軌道，自動生成剪映草稿，導入即可在時間線上精細調整，無需手動整理素材。",
      feature7Title: "首幀精確鎖定",
      feature7Desc:
        "先用 Nano Banana 生成 4K 關鍵幀圖像，再用圖生影片，畫質下限極高，主體不飄移。",
      feature8Title: "越用越懂你",
      feature8Desc:
        "Mem0 記憶系統自動學習你的風格偏好，每次生成都會注入你的歷史創作習慣。",

      // Workflow
      step1Label: "輸入創意",
      step1Desc: "一句話描述你的想法，或上傳參考影片讓 AI 分析風格",
      step2Label: "AI 策劃",
      step2Desc: "AI 自動生成完整分鏡腳本，你可以審核和調整每個細節",
      step3Label: "一鍵生成",
      step3Desc: "並行生成首幀圖像，配音、影片，自動拼接成片",
      step4Label: "下載成片",
      step4Desc: "取得 MP4 影片 + 剪映草稿，精細調整後匯出",

      // 對比表
      compareDim: "對比維度",
      compareLibTV: "LibTV",
      compareHuobao: "火寶短劇",
      compareOurs: "芝麻開門 ✦",
      compareRow1: "自然語言對話 + 標竿影片分析，一句話驅動",
      compareRow2: "Gemini 自動分析分鏡結構，反推提示詞、識別人物",
      compareRow3: "四宮格三視圖 + Kling Omni 多參考模式",
      compareRow4: "Kling 3.0 Omni + Seedance 1.5 雙引擎智慧路由",
      compareRow5: "先測配音時長，再控影片 duration",
      compareRow6: "剪映分軌草稿 + MP4 雙輸出",
      compareRow7: "Mem0 數位孿生，越用越懂你",
      compareRow8: "封裝為標準 Skill，可被任意 Agent 調用",

      // 對比表維度
      compareRow1Dim: "互動範式",
      compareRow2Dim: "標竿影片反推",
      compareRow3Dim: "人物一致性",
      compareRow4Dim: "影片引擎",
      compareRow5Dim: "音畫同步",
      compareRow6Dim: "最終交付",
      compareRow7Dim: "記憶系統",
      compareRow8Dim: "Agent 調用",

      // 對比表 LibTV 列
      libtv1: "節點畫布，手動觸發",
      libtv2: "無",
      libtv3: "提示詞引導",
      libtv4: "Kling 1.x",
      libtv5: "手動剪輯對齊",
      libtv6: "手動下載導入剪映",
      libtv7: "無",
      libtv8: "無",

      // 對比表 火寶列
      huobao1: "表單填寫，按步操作",
      huobao2: "無",
      huobao3: "參考圖上傳",
      huobao4: "單引擎",
      huobao5: "未明確支援",
      huobao6: "壓制 MP4",
      huobao7: "無",
      huobao8: "無",

      // 設定頁面
      apiConnector: "API 連接器",
      backToStudio: "返回工作台",
      backendConnected: "後端已連接",
      backendDisconnected: "後端未連接",
      checkingBackend: "檢查後端...",
      saveConfig: "儲存設定",
      apiConfigTitle: "設定 API Key",
      apiConfigDesc: "系統將使用這些接口完成腳本生成、生圖、配音和視頻合成。",
      securityTip: "安全提示",
      conversationLLM: "對話用大模型",
      conversationLLMDesc: "從下面的配置中，選出來的推理模型提供商。",
      connectionSuccess: "連接成功",
      connectionFailed: "連接失敗",
      testConnection: "測試連接",
      getKey: "獲取 Key",
      testing: "測試中...",
      saveFailed: "儲存失敗",
      configured: "已設定",
      fillApiKeyFirst: "請先填寫 API Key 並儲存，然後再測試連線",
    },
  },
  ja: {
    translation: {
      // 共通
      save: "保存",
      cancel: "キャンセル",
      confirm: "確認",
      loading: "読み込み中...",
      success: "成功",
      error: "エラー",

      // 環境設定
      preferences: "環境設定",
      theme: "テーマ",
      themeLight: "ライト",
      themeDark: "ダーク",
      themeSystem: "システム",
      language: "言語",
      languageDesc: "お好みのインターフェース言語を選択",
      themeDesc: "お好みのテーマモードを選択",

      // ユーザーセンター
      profile: "ユーザーセンター",
      basicInfo: "基本情報",
      security: "アカウントセキュリティ",
      username: "ユーザー名",
      email: "メールアドレス",
      avatar: "アバター",
      avatarDesc:
        "クリックして新しいアバターをアップロード、JPG、PNG、WEBP対応",
      saveChanges: "変更を保存",
      changePassword: "パスワード変更",
      currentPassword: "現在のパスワード",
      newPassword: "新しいパスワード",
      confirmNewPassword: "新しいパスワードを確認",
      passwordChanged: "パスワード変更成功",
      profileUpdated: "ユーザー情報が更新されました",
      avatarUploaded: "アバターアップロード成功",

      // ログイン登録
      login: "ログイン",
      register: "登録",
      loginTitle: "ログイン",
      registerTitle: "登録",
      logout: "ログアウト",
      loginSubtitle: "AI 動画生成アシスタント",
      loginError: "ログイン失敗",
      registerError1: "入力したパスワードが一致しません",
      registerError2: "パスワードは6文字以上必要です",
      registerError3: "登録失敗",
      oauthComingSoon: "OAuthログインは開発中です！",
      oauthDebugMode: "デバッグモード - OAuthは利用不可",
      otherLoginMethods: "他のログイン方法",
      password: "パスワード",
      confirmPassword: "パスワード確認",
      loginLoading: "ログイン中...",
      registerLoading: "登録中...",
      agreeTerms: "登録すると利用規約に同意します",
      passwordHint: "パスワード（6文字以上）",

      // ホーム
      home: "ホーム",
      studio: "スタジオ",
      settings: "設定",
      startCreating: "創作を開始",
      startCreate: "創作を開始",
      configApiKey: "API Keyを設定",
      heroBadge: "映える動画を",
      heroSubtitle: "芝麻開門はAIクリエイティブチームです。",
      workflowTitle: "創作フロー",
      workflowDesc: "シンプルな4ステップ、0から1へ",
      featuresTitle: "コア機能",
      featuresDesc: "すべての 工程が丁寧に設計されています",
      comparisonTitle: "競合製品との比較",
      comparisonDesc:
        "同じ画像・動画生成品質を維持しながら、より究極の自動化を実現",
      ctaTitle: "準備はいいですか？",
      ctaDesc: "シンプルなメッセージで芝麻開門の世界を体験",
      ctaButton: "今すぐ開始",
      footer: "芝麻開門 Open-Door · AI Video Generation",
      enterStudio: "スタジオに入る",
      configApi: "APIを設定",
      loginRegister: "ログイン/登録",
      english: "English",
      simplifiedChinese: "简体中文",
      traditionalChinese: "繁體中文",
      japanese: "日本語",
      korean: "한국어",

      // 設定ページ
      apiConnector: "API コネクタ",
      backToStudio: "スタジオに戻る",
      backendConnected: "バックエンド接続済み",
      backendDisconnected: "バックエンド未接続",
      checkingBackend: "バックエンド確認中...",
      saveConfig: "設定を保存",
      apiConfigTitle: "API Keyを設定",
      apiConfigDesc:
        "システムはこれらのインターフェースを使用してスクリプト生成、画像生成、音声合成、動画合成を行います。",
      securityTip: "セキュリティヒント",
      conversationLLM: "会話用LLM",
      conversationLLMDesc:
        "以下の設定から推論モデルプロバイダーを選択してください。",
      connectionSuccess: "接続成功",
      connectionFailed: "接続失敗",
      testConnection: "接続テスト",
      getKey: "キーを取得",
      testing: "テスト中...",
      saveFailed: "保存に失敗しました",
      configured: "設定済み",
      fillApiKeyFirst:
        "API Keyを入力して保存してから、接続テストをしてください",
    },
  },
  ko: {
    translation: {
      // 공통
      save: "저장",
      cancel: "취소",
      confirm: "확인",
      loading: "로딩 중...",
      success: "성공",
      error: "오류",

      // 환경설정
      preferences: "환경설정",
      theme: "테마",
      themeLight: "라이트",
      themeDark: "다크",
      themeSystem: "시스템",
      language: "언어",
      languageDesc: "선호하는 인터페이스 언어 선택",
      themeDesc: "선호하는 테마 모드 선택",

      // 사용자센터
      profile: "사용자센터",
      basicInfo: "기본정보",
      security: "계정보안",
      username: "사용자명",
      email: "이메일",
      avatar: "아바타",
      avatarDesc: "새 아바타를 클릭하여 업로드, JPG, PNG, WEBP 지원",
      saveChanges: "변경사항 저장",
      changePassword: "비밀번호 변경",
      currentPassword: "현재 비밀번호",
      newPassword: "새 비밀번호",
      confirmNewPassword: "새 비밀번호 확인",
      passwordChanged: "비밀번호 변경 성공",
      profileUpdated: "사용자 정보가 업데이트되었습니다",
      avatarUploaded: "아바타 업로드 성공",

      // 로그인 가입
      login: "로그인",
      register: "가입",
      loginTitle: "로그인",
      registerTitle: "가입",
      logout: "로그아웃",
      loginSubtitle: "AI 비디오 생성 도우미",
      loginError: "로그인 실패",
      registerError1: "입력한 비밀번호가 일치하지 않습니다",
      registerError2: "비밀번호는 6자 이상이어야 합니다",
      registerError3: "가입 실패",
      oauthComingSoon: "OAuth 로그인은 개발 중입니다!",
      oauthDebugMode: "디버그 모드 - OAuth 사용 불가",
      otherLoginMethods: "다른 로그인 방법",
      password: "비밀번호",
      confirmPassword: "비밀번호 확인",
      loginLoading: "로그인 중...",
      registerLoading: "가입 중...",
      agreeTerms: "가입하면 서비스 약관에 동의합니다",
      passwordHint: "비밀번호 (6자 이상)",

      // 홈
      home: "홈",
      studio: "스튜디오",
      settings: "설정",
      startCreating: "작업 시작",
      startCreate: "작업 시작",
      configApiKey: "API Key 설정",
      heroBadge: "영화 같은 영상",
      heroSubtitle: "芝麻开门은 AI 크리에이션 팀입니다.",
      workflowTitle: "작업流程",
      workflowDesc: "간단한 4단계, 0에서 1까지",
      featuresTitle: "핵심 기능",
      featuresDesc: "모든 단계가 정밀하게 설계되었습니다",
      comparisonTitle: "同类 제품 비교",
      comparisonDesc:
        "동일한 이미지/비디오 생성 품질을 유지하면서 더욱 궁극적인 자동화 달성",
      ctaTitle: "준비 되셨나요?",
      ctaDesc: "간단한 메시지로芝麻开门의 세계를 경험하세요",
      ctaButton: "지금 시작",
      footer: "芝麻开门 Open-Door · AI Video Generation",
      enterStudio: "스튜디오 입장",
      configApi: "API 설정",
      loginRegister: "로그인/가입",
      english: "English",
      simplifiedChinese: "简体中文",
      traditionalChinese: "繁體中文",
      japanese: "日本語",
      korean: "한국어",

      // 설정 페이지
      apiConnector: "API 커넥터",
      backToStudio: "스튜디오로 돌아가기",
      backendConnected: "백엔드 연결됨",
      backendDisconnected: "백엔드 연결 안됨",
      checkingBackend: "백엔드 확인 중...",
      saveConfig: "구성 저장",
      apiConfigTitle: "API Key 설정",
      apiConfigDesc:
        "시스템은 이 인터페이스를 사용하여 스크립트 생성, 이미지 생성, 음성 합성, 동영상을 합성합니다.",
      securityTip: "보안 팁",
      conversationLLM: "대화용 LLM",
      conversationLLMDesc: "아래 설정에서 추론 모델 공급자를 선택하세요.",
      connectionSuccess: "연결 성공",
      connectionFailed: "연결 실패",
      testConnection: "연결 테스트",
      getKey: "키 가져오기",
      testing: "테스트 중...",
      saveFailed: "저장 실패",
      configured: "설정됨",
      fillApiKeyFirst: "API Key를 입력하고 저장한 후 연결 테스트를 해주세요",
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "zh-CN",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18n;
