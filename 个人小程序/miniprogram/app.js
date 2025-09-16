// app.js
App({
    onLaunch() {
      // 初始化云开发环境
      if (!wx.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用云能力')
      } else {
        wx.cloud.init({
          traceUser: true,
        })
      }

          // 先从本地存储加载主题颜色（作为备用）
      const savedThemeColor = wx.getStorageSync('themeColor')
      if (savedThemeColor) {
        this.globalData.themeColor = savedThemeColor
      }

      // 检查用户是否已登录
      const userInfo = wx.getStorageSync('userInfo')
      if (!userInfo) {
        // 未登录，跳转到登录页
        wx.navigateTo({
          url: '/pages/login/login'
        })
      } else {
        this.globalData.userInfo = userInfo
        
        // 已登录，尝试从云数据库加载主题颜色
        this.loadThemeColorFromCloud();
      }

      // 应用启动时触发一次主题颜色变化事件，确保所有页面都能收到通知
      this.emit('themeColorChanged', { color: this.globalData.themeColor });
      
      // 应用启动时更新tabBar的选中颜色
      this.updateTabBarSelectedColor(this.globalData.themeColor);
    },
    
    // 从云数据库加载主题颜色
    async loadThemeColorFromCloud() {
      const db = wx.cloud.database();
      const usersCol = db.collection('users');
      const openid = wx.getStorageSync('openid');
      
      if (!openid) return;
      
      try {
        const res = await usersCol.where({ _openid: openid }).get();
        if (res.data.length > 0 && res.data[0].themeColor) {
          const themeColor = res.data[0].themeColor;
          const themeIndex = res.data[0].themeIndex;
          
          // 更新全局主题颜色
          this.globalData.themeColor = themeColor;
          
          // 更新本地存储
          wx.setStorageSync('themeColor', themeColor);
          if (themeIndex !== undefined) {
            wx.setStorageSync('themeIndex', themeIndex);
          }
          
          console.log('从云数据库加载主题颜色:', themeColor);
          
          // 触发主题颜色变化事件，更新所有页面
          this.emit('themeColorChanged', { color: themeColor });
        }
      } catch (err) {
        console.error('从云数据库加载主题颜色失败:', err);
        // 加载失败不影响应用运行，继续使用本地存储或默认颜色
      }
    },
  
  // 自定义事件总线
  on: function(eventName, callback) {
    if (!this._events) this._events = {};
    if (!this._events[eventName]) {
      this._events[eventName] = [];
    }
    this._events[eventName].push(callback);
  },
  
  emit: function(eventName, data) {
    if (!this._events || !this._events[eventName]) return;
    this._events[eventName].forEach(callback => {
      callback(data);
    });
    
    // 当主题颜色变化时，同时更新tabBar的选中颜色
    if (eventName === 'themeColorChanged' && data && data.color) {
      this.updateTabBarSelectedColor(data.color);
    }
  },
  
  off: function(eventName, callback) {
    if (!this._events || !this._events[eventName]) return;
    
    if (!callback) {
      // 如果没有提供回调函数，则移除该事件的所有监听器
      this._events[eventName] = [];
    } else {
      // 移除特定的回调函数
      this._events[eventName] = this._events[eventName].filter(cb => cb !== callback);
    }
  },
    // 动态更新tabBar的选中颜色
  updateTabBarSelectedColor(color) {
    try {
      // 获取当前页面实例
      const pages = getCurrentPages();
      if (pages.length > 0) {
        const currentPage = pages[pages.length - 1];
        // 获取tabBar实例
        const tabBar = currentPage.getTabBar && currentPage.getTabBar();
        if (tabBar) {
          // 更新tabBar的选中颜色
          tabBar.setSelectedColor(color);
          tabBar.update();
        }
      }
      
      // 直接设置tabBar的样式（这是更可靠的方法）
      wx.setTabBarStyle({
        selectedColor: color
      });
    } catch (error) {
      console.error('更新tabBar选中颜色失败:', error);
    }
  },
  
  globalData: {
    userInfo: null,
    themeColor: '#07c160', // 默认主题颜色
    // 底部导航配置（与app.json保持一致）
    tabBarList: [
      {
        pagePath: "/pages/index/index",
        text: "点歌台",
        iconPath: "/images/tab/song-default.png",
        selectedIconPath: "/images/tab/song-selected.png"
      },
      {
        pagePath: "/pages/aiChat/aiChat",
        text: "AI交流",
        iconPath: "/images/tab/ai-default.png",
        selectedIconPath: "/images/tab/ai-selected.png"
      },
      {
        pagePath: "/pages/calendar/calendar",
        text: "日历",
        iconPath: "/images/tab/calendar-default.png",
        selectedIconPath: "/images/tab/calendar-selected.png"
      },
      {
        pagePath: "/pages/mine/mine",
        text: "我的",
        iconPath: "/images/tab/mine-default.png",
        selectedIconPath: "/images/tab/mine-selected.png"
      }
    ]
  }
  })
      