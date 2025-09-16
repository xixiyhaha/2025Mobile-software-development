const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    inputValue: "",
    placeholder: "请输入您的问题...",
    messages: [],
    toView: "",
    userAvatar: "/images/avatar.png",
    aiAvatar: "/images/ai-avatar.png",
    suggestions: [
      "推荐几首练嗓的歌曲",
      "唱歌时怎么换气更自然？",
      "如何练习高音？"
    ],
    showSuggestions: true, // 初始显示推荐问题
    openid: '',
    sessionId: '', // 会话ID，用于标识不同的聊天会话
    themeColor: '#07c160'
  },

  onLoad() {
    if (!wx.cloud) {
      wx.cloud.init({ env: "cloud1-1grapwhzb010af67" });
    }
    this.initChat();
    
    // 加载主题颜色
    const app = getApp();
    this.setData({
      themeColor: app.globalData.themeColor
    });
    
    // 注册主题颜色变化监听器
    this.registerThemeListener();
  },
  
  onShow() {
    // 每次页面显示时同步主题颜色
    this.syncThemeColor();
  },
  
  // 同步主题色到导航栏
  syncThemeColor() {
    try {
      const app = getApp();
      // 优先使用全局数据中的主题色，没有则从本地存储获取
      const themeColor = app.globalData.themeColor || wx.getStorageSync('themeColor') || '#07c160';
      
      // 对于白色主题，需要将文字颜色设置为黑色以保证可见性
      const frontColor = themeColor === '#f8f8f8' ? '#000000' : '#ffffff';
      
      // 设置导航栏颜色
      wx.setNavigationBarColor({
        frontColor: frontColor,
        backgroundColor: themeColor
      });
      
      // 更新页面数据中的主题色
      if (themeColor !== this.data.themeColor) {
        this.setData({
          themeColor: themeColor
        });
      }
    } catch (error) {
      console.error('同步主题色失败:', error);
      // 出错时使用默认主题色
      this.setData({
        themeColor: '#07c160'
      });
    }
  },
  
  // 注册主题颜色变化监听器
  registerThemeListener() {
    const app = getApp();
    this.themeColorListener = (data) => {
      const { color } = data;
      // 更新主题色并同步到导航栏
      this.setData({
        themeColor: color
      });
      this.syncThemeColor();
    };
    app.on('themeColorChanged', this.themeColorListener);
  },
  
  // 页面卸载时取消注册监听器
  onUnload() {
    if (this.themeColorListener) {
      const app = getApp();
      app.off('themeColorChanged', this.themeColorListener);
    }
  },

  // 初始化聊天
  async initChat() {
    try {
      // 获取用户openid
      const loginRes = await wx.cloud.callFunction({ name: "login" });
      const openid = loginRes.result && loginRes.result.openid;
      if (!openid) {
        console.warn("无法获取用户openid");
        this.setData({ showSuggestions: true });
        this.addAIMessage("您好! 我是练歌智能助手，请问有什么歌曲练习上的问题可以帮到您吗？");
        return;
      }
      
      this.setData({ openid });
      await this.getUserAvatar();
      
      // 生成或获取会话ID
      this.setData({ sessionId: this.generateSessionId() });
      
      // 加载历史聊天记录
      await this.loadChatHistory();
      
      // 如果没有历史记录，显示欢迎语
      if (this.data.messages.length === 0) {
        this.setData({ showSuggestions: true });
        this.addAIMessage("您好! 我是练歌智能助手，请问有什么歌曲练习上的问题可以帮到您吗？");
      }
    } catch (err) {
      console.error("初始化聊天失败:", err);
      this.setData({ showSuggestions: true });
      this.addAIMessage("您好! 我是练歌智能助手，请问有什么歌曲练习上的问题可以帮到您吗？");
    }
  },
  
  // 生成会话ID
  generateSessionId() {
    // 使用日期和随机数生成会话ID
    const date = new Date();
    const timestamp = date.getTime();
    const random = Math.floor(Math.random() * 1000);
    return `${timestamp}_${random}`;
  },

  // 检查并处理数据库集合
  async checkAndCreateCollection() {
    try {
      // 尝试调用集合的count方法来检查集合是否存在
      await db.collection('chatRecords').count();
      console.log('chatRecords集合已存在');
    } catch (error) {
      if (error.errCode === -502005) {
        // 集合不存在，需要通过云函数或在云开发控制台手动创建
        console.log('chatRecords集合不存在，请在云开发控制台手动创建集合');
        // 由于小程序端无法直接创建集合，我们提示用户去控制台创建
        wx.showModal({
          title: '提示',
          content: '首次使用聊天功能，需要创建chatRecords数据库集合\n请在云开发控制台-数据库中创建chatRecords集合',
          showCancel: false
        });
      } else {
        console.error('检查集合失败:', error);
      }
    }
  },
  
  // 加载历史聊天记录
  async loadChatHistory() {
    try {
      wx.showLoading({ title: '加载历史记录中...' });
      
      // 先检查集合是否存在
      await this.checkAndCreateCollection();
      
      const res = await db.collection('chatRecords')
        .where({
          _openid: this.data.openid
        })
        .orderBy('timestamp', 'asc')
        .limit(50) // 限制加载最近50条记录
        .get();
      
      if (res.data && res.data.length > 0) {
        const messages = res.data.map(item => ({
          from: item.from,
          content: item.content,
          avatar: item.from === 'user' ? this.data.userAvatar : this.data.aiAvatar,
          timestamp: item.timestamp
        }));
        
        // 检查用户是否发过消息
        const hasUserMessages = messages.some(msg => msg.from === 'user');
        
        this.setData({
          messages,
          showSuggestions: !hasUserMessages // 只有当用户没有发过消息时才显示推荐问题
        });
        
        // 滚动到最新消息
        setTimeout(() => {
          this.scrollToIndex(messages.length - 1);
        }, 100);
      } else {
        // 没有历史记录时显示建议问题
        this.setData({ showSuggestions: true });
      }
    } catch (err) {
      console.error("加载聊天历史失败:", err);
      // 加载失败时也显示建议问题
      this.setData({ showSuggestions: true });
    } finally {
      wx.hideLoading();
    }
  },

  // 获取当前用户头像
  async getUserAvatar() {
    try {
      if (!this.data.openid) return;

      const res = await db.collection("users").where({ _openid: this.data.openid }).limit(1).get();
      if (res && res.data && res.data.length > 0) {
        const user = res.data[0];
        if (user.avatarUrl) {
          this.setData({ userAvatar: user.avatarUrl });
        }
      }
    } catch (err) {
      console.warn("getUserAvatar fail:", err);
    }
  },

  // 保存聊天消息到数据库
  async saveMessageToDB(message) {
    if (!this.data.openid) return;
    
    try {
      // 先检查集合是否存在
      await this.checkAndCreateCollection();
      
      await db.collection('chatRecords').add({
        data: {
          from: message.from,
          content: message.content,
          sessionId: this.data.sessionId,
          timestamp: db.serverDate()
        }
      });
    } catch (err) {
      console.error("保存聊天消息失败:", err);
      // 忽略错误，继续执行
    }
  },

  // 添加AI消息并保存到数据库
  async addAIMessage(content) {
    const msg = { from: "ai", content, avatar: this.data.aiAvatar };
    this.setData({ messages: [...this.data.messages, msg] });
    
    // 保存到数据库
    await this.saveMessageToDB(msg);
  },

  // 清空聊天记录
  async clearChat() {
    try {
      // 如果有openid，从数据库中删除聊天记录
      if (this.data.openid) {
        wx.showLoading({ title: '清空记录中...' });
        // 先检查集合是否存在
        await this.checkAndCreateCollection();
        
        try {
          await db.collection('chatRecords').where({
            _openid: this.data.openid
          }).remove();
        } catch (dbError) {
          // 如果是因为集合不存在导致的错误，忽略它
          if (dbError.errCode !== -502005) {
            throw dbError;
          }
        }
      }
      
      // 生成新的会话ID
      this.setData({ sessionId: this.generateSessionId() });
      
      // 清空本地消息并显示欢迎语
      this.setData({ 
        messages: []
      });
      this.addAIMessage("您好! 我是练歌智能助手，请问有什么歌曲练习上的问题可以帮到您吗？");
      this.setData({ showSuggestions: true });
    } catch (err) {
      console.error("清空聊天记录失败:", err);
      wx.showToast({ title: '清空失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  askSuggestion(e) {
    const q = e.currentTarget.dataset.q;
    this.setData({ inputValue: q }, () => {
      this.sendMessage();
    });
  },

  onInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  // 滚动到指定消息
  scrollToIndex(index) {
    this.setData({ toView: `msg-${index}` });
  },

  async sendMessage() {
    const question = this.data.inputValue && this.data.inputValue.trim();
    if (!question) return;

    // 用户第一次输入后，隐藏推荐问题
    if (this.data.showSuggestions) {
      this.setData({ showSuggestions: false });
    }

    // 清空输入框
    this.setData({ inputValue: "", placeholder: "请输入您的问题..." });

    // 1. 用户消息
    const userMsg = {
      from: "user",
      content: question,
      avatar: this.data.userAvatar
    };
    const msgs1 = [...this.data.messages, userMsg];
    this.setData({ messages: msgs1 });
    this.scrollToIndex(msgs1.length - 1);
    
    // 保存用户消息到数据库
    await this.saveMessageToDB(userMsg);

    try {
      // 2. 调用 AI
      const res = await wx.cloud.extend.AI.bot.sendMessage({
        data: {
          botId: "ibot-20250913-l8ybhitor8",
          msg: question
        }
      });

      // 3. 插入 AI 占位消息（显示“正在思考...”）
      const aiPlaceholder = { from: "ai", content: "正在思考...", avatar: this.data.aiAvatar };
      let msgs = [...this.data.messages, aiPlaceholder];
      this.setData({ messages: msgs });
      this.scrollToIndex(msgs.length - 1);

      // 4. 处理流式返回
      let accumulated = "";
      if (res && res.eventStream) {
        for await (let event of res.eventStream) {
          if (event.data === "[DONE]") break;
          try {
            const data = JSON.parse(event.data);
            if (data.content) {
              accumulated += data.content;
              const cur = this.data.messages.slice();
              cur[cur.length - 1].content = accumulated;
              this.setData({ messages: cur });
              this.scrollToIndex(cur.length - 1);
            }
          } catch (parseErr) {
            console.warn("parse stream chunk fail:", parseErr);
          }
        }
        
        // 流式返回完成，保存最终的AI回复
        if (accumulated) {
          const aiMsg = { from: "ai", content: accumulated, avatar: this.data.aiAvatar };
          await this.saveMessageToDB(aiMsg);
        }
      } else {
        // fallback: 非流式
        const reply = res?.data || "AI 没有回复";
        const cur = this.data.messages.slice();
        cur[cur.length - 1].content = reply;
        this.setData({ messages: cur });
        this.scrollToIndex(cur.length - 1);
        
        // 保存最终的AI回复
        const aiMsg = { from: "ai", content: reply, avatar: this.data.aiAvatar };
        await this.saveMessageToDB(aiMsg);
      }
    } catch (err) {
      console.error("AI 调用失败:", err);
      const errorMsg = "AI 出错: " + (err?.message || "未知错误");
      const cur = this.data.messages.slice();
      cur[cur.length - 1].content = errorMsg;
      this.setData({ messages: cur });
      this.scrollToIndex(cur.length - 1);
      
      // 保存错误消息
      const aiMsg = { from: "ai", content: errorMsg, avatar: this.data.aiAvatar };
      await this.saveMessageToDB(aiMsg);
    }
  }
});
