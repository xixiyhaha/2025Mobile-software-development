// mine.js
wx.cloud.init({ env: "cloud1-1grapwhzb010af67" });
const db = wx.cloud.database();
const diaryCol = db.collection("diaries");
const folderCol = db.collection("songFolders");
const usersCol = db.collection("users");

// ✅ 云存储默认头像 fileID
const DEFAULT_AVATAR = "cloud://cloud1-xxxxxx/system/default-avatar.png";

// 主题颜色选项
const THEME_COLORS = [
  { name: '绿色', color: '#07c160' },
  { name: '蓝色', color: '#1989fa' },
  { name: '红色', color: '#f44336' },
  { name: '橙色', color: '#ff9800' },
  { name: '黑色', color: '#000000' },
  { name: '白色', color: '#f8f8f8' }
];

Page({
  data: {
    userInfo: null,
    diaryCount: 0,
    collectCount: 0,
    recordCount: 0,
    showSetting: false,
    showHelp: false,
    themeColors: THEME_COLORS,
    currentThemeIndex: 0,
    currentThemeColor: '#07c160'
  },

  gotoSetting() {
    this.setData({ showSetting: true });
  },
  
  gotoHelp() {
    this.setData({ showHelp: true });
  },
  
  closePopup() {
    this.setData({ showSetting: false, showHelp: false });
  },

  onLoad() {
    this.loadUserInfo();
    this.loadCounts();
  },

  onShow() {
    this.loadUserInfo();
    this.loadCounts();
    
    // 每次页面显示时更新主题颜色
    const app = getApp();
    const currentThemeColor = app.globalData.themeColor;
    if (currentThemeColor !== this.data.currentThemeColor) {
      // 查找当前主题颜色对应的索引
      const themeIndex = THEME_COLORS.findIndex(color => color.color === currentThemeColor);
      if (themeIndex !== -1) {
        this.setData({
          currentThemeIndex: themeIndex,
          currentThemeColor: currentThemeColor,
          themeColor: currentThemeColor // 用于页面绑定CSS变量
        });
        // 更新导航栏颜色
        wx.setNavigationBarColor({
          frontColor: '#ffffff',
          backgroundColor: currentThemeColor
        });
      }
    }
    
    // 监听主题颜色变化事件
    this.unregisterThemeListener();
    this.registerThemeListener();
  },

  async loadUserInfo() {
    const openid = wx.getStorageSync("openid");
    if (!openid) return;

    try {
      const res = await usersCol.where({ _openid: openid }).get();
      if (res.data.length > 0) {
        const user = res.data[0];
        const cleanUser = {
          avatarUrl: user.avatarUrl || DEFAULT_AVATAR,
          nickName: user.nickName,
          gender: user.gender ?? 0,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          openid
        };
        this.setData({ userInfo: cleanUser });
        wx.setStorageSync("userInfo", cleanUser);
        
        // 从云数据库加载主题颜色设置
        if (user.themeIndex !== undefined) {
          const themeIndex = user.themeIndex;
          const themeColor = THEME_COLORS[themeIndex].color;
          
          // 更新本地存储
          wx.setStorageSync('themeIndex', themeIndex);
          wx.setStorageSync('themeColor', themeColor);
          
          // 更新页面数据
          this.setData({
            currentThemeIndex: themeIndex,
            currentThemeColor: themeColor
          });
          
          // 应用主题颜色
          this.applyThemeColor(themeColor);
        } else {
          // 如果云数据库中没有主题设置，使用本地存储的设置
          const savedThemeIndex = wx.getStorageSync('themeIndex');
          if (savedThemeIndex !== undefined && savedThemeIndex !== '') {
            const themeColor = THEME_COLORS[savedThemeIndex].color;
            this.setData({
              currentThemeIndex: savedThemeIndex,
              currentThemeColor: themeColor
            });
          }
        }
      }
    } catch (err) {
      console.error("加载用户信息失败:", err);
      
      // 加载失败时，使用本地存储的主题设置
      const savedThemeIndex = wx.getStorageSync('themeIndex');
      if (savedThemeIndex !== undefined && savedThemeIndex !== '') {
        const themeColor = THEME_COLORS[savedThemeIndex].color;
        this.setData({
          currentThemeIndex: savedThemeIndex,
          currentThemeColor: themeColor
        });
      }
    }
  },

  async loadCounts() {
    const openid = wx.getStorageSync("openid");
    if (!openid) return;

    try {
      const diaryRes = await diaryCol.where({ _openid: openid }).count();
      const songRes = await folderCol.where({ _openid: openid }).get();

      const collectCount = songRes.data.length;
      let recordCount = 0;
      songRes.data.forEach(folder => {
        if (folder.recordList && Array.isArray(folder.recordList)) {
          recordCount += folder.recordList.length;
        }
      });

      this.setData({
        diaryCount: diaryRes.total,
        collectCount,
        recordCount
      });
    } catch (err) {
      console.error("获取数量失败:", err);
    }
  },

  // 主题颜色切换
  themeColorChange(e) {
    const index = e.currentTarget.dataset.index;
    const color = THEME_COLORS[index].color;
    
    this.setData({
      currentThemeIndex: index,
      currentThemeColor: color
    });
    
    // 保存主题颜色设置到本地存储
    wx.setStorageSync('themeIndex', index);
    wx.setStorageSync('themeColor', color);
    
    // 保存主题颜色设置到云数据库
    this.saveThemeColorToCloud(index);
    
    // 显示切换成功提示
    wx.showToast({
      title: '主题颜色已切换',
      icon: 'success',
      duration: 1500
    });
    
    // 应用主题颜色变化到全局
    this.applyThemeColor(color);
  },
  
  // 保存主题颜色设置到云数据库
  async saveThemeColorToCloud(themeIndex) {
    const openid = wx.getStorageSync("openid");
    if (!openid) return;
    
    try {
      const userRes = await usersCol.where({ _openid: openid }).get();
      if (userRes.data.length > 0) {
        const userId = userRes.data[0]._id;
        await usersCol.doc(userId).update({
          data: {
            themeIndex: themeIndex,
            themeColor: THEME_COLORS[themeIndex].color,
            updatedAt: db.serverDate()
          }
        });
        console.log('主题颜色已保存到云数据库');
      } else {
        // 如果用户不存在，则创建用户记录
        await usersCol.add({
          data: {
            themeIndex: themeIndex,
            themeColor: THEME_COLORS[themeIndex].color,
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
        });
        console.log('已创建用户记录并保存主题颜色');
      }
    } catch (err) {
      console.error('保存主题颜色到云数据库失败:', err);
      // 不影响用户体验，仅记录错误
    }
  },

  // 应用主题颜色
  applyThemeColor(color) {
    // 更新全局主题颜色
    const app = getApp();
    app.globalData.themeColor = color;
    
    console.log('应用主题颜色:', color);
    
    // 更新tabBar选中颜色
    wx.setTabBarStyle({
      selectedColor: color
    });
    
    // 更新当前页面的CSS变量
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    
    // 通过WXS更新CSS变量
    if (currentPage.setData) {
      // 这里通过设置themeColor数据来触发页面更新
      currentPage.setData({ themeColor: color });
    }
    
    // 发送全局事件通知其他页面更新主题
    app.emit('themeColorChanged', { color: color });
  },
  
  // 注册主题颜色变化监听器
  registerThemeListener() {
    const app = getApp();
    this.themeColorListener = (data) => {
      const { color } = data;
      // 查找当前主题颜色对应的索引
      const themeIndex = THEME_COLORS.findIndex(theme => theme.color === color);
      if (themeIndex !== -1) {
        this.setData({
          currentThemeIndex: themeIndex,
          currentThemeColor: color,
          themeColor: color // 用于页面绑定CSS变量
        });
        // 更新导航栏颜色
        // 对于白色主题，需要将文字颜色设置为黑色以保证可见性
        const frontColor = color === '#f8f8f8' ? '#000000' : '#ffffff';
        wx.setNavigationBarColor({
          frontColor: frontColor,
          backgroundColor: color
        });
      }
    };
    app.on('themeColorChanged', this.themeColorListener);
  },
  
  // 取消注册主题颜色变化监听器
  unregisterThemeListener() {
    if (this.themeColorListener) {
      const app = getApp();
      app.off('themeColorChanged', this.themeColorListener);
      this.themeColorListener = null;
    }
  },

  gotoLogin() {
    wx.navigateTo({ url: "/pages/login/login" });
  },

  // 跳转到我的歌曲页面（即index界面）
  gotoCollection() {
    console.log('跳转到我的歌曲页面');
    try {
      // 使用switchTab跳转到tabBar页面（与日历按钮相同的方式）
      wx.switchTab({ url: "/pages/index/index" });
    } catch (error) {
      console.error('跳转失败:', error);
      wx.showToast({
        title: '跳转失败',
        icon: 'none'
      });
    }
  },

  gotoDiaryList() {
    wx.switchTab({ url: "/pages/calendar/calendar" });
  },

  editUserInfo() {
    wx.navigateTo({ url: "/pages/edit/edit" });
  },

  logout() {
    wx.showModal({
      title: "确认退出",
      content: "退出后需重新登录，是否继续？",
      confirmText: "退出",
      confirmColor: "#F44336",
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync("userInfo");
          wx.removeStorageSync("openid");
          this.setData({
            userInfo: null,
            diaryCount: 0,
            collectCount: 0,
            recordCount: 0
          });
          this.gotoLogin();
        }
      }
    });
  }
});
